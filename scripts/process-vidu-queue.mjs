#!/usr/bin/env node
// Scripted Vidu queue processor. It uses a marker tab in the operator-selected
// normal Chrome profile; it must not launch a second Chrome/Chromium instance
// or fall back to generated automation profiles. Missing marker tabs are a
// profile-safe setup/repair concern, not a reason to switch profiles.

if (typeof WebSocket === "undefined") {
  console.error("scripts/process-vidu-queue.mjs needs Node 22+ (global WebSocket). The server itself runs on Node 20+.");
  process.exit(1);
}

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { RunLog } from "./agent-browser.mjs";
import {
  assertNoUserDataDirProcesses,
  listChromeProfiles,
  loadServiceChromeProfile,
  printServiceProfileCandidates,
  setupServiceChromeProfile,
} from "./service-browser-profile.mjs";
import {
  assertChromeRunning,
  assertSingleBridgeCandidateForProfile,
  ensureChromeMarkerTabProfileSafe,
  findChromeTabByUrlPart,
  runChromeTabJsByUrlPart,
} from "./service-browser-route.mjs";
import {
  buildViduMarkerUrl as buildViduMarkerUrlForProfile,
  isViduLoggedOutPageState,
  legacyMarkerPartForViduProfile,
  markerPartForViduProfile,
} from "./vidu-route-helpers.mjs";
import { VIDU_UPLOAD_PLAN_FUNCTION_JS } from "./vidu-upload-plan.mjs";
import {
  assertDistinctViduFrameInputs,
  isInsufficientViduCreditError,
  isInsufficientViduCreditState,
  stableVideoKey,
  visibleCreditCost,
} from "./vidu-processing-helpers.mjs";

const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const HELP = `Vidu queue processor — processes queued image-to-video targets in
a Vidu marker tab in the selected normal Chrome profile.

Usage:
  node scripts/process-vidu-queue.mjs --check
  node scripts/process-vidu-queue.mjs --setup-profile
  node scripts/process-vidu-queue.mjs --list-profiles
  node scripts/process-vidu-queue.mjs
  node scripts/process-vidu-queue.mjs --request <id>
  node scripts/process-vidu-queue.mjs --dry-run

Options:
  --server <url>       image-arranger server (default http://127.0.0.1:4217, $IMAGE_ARRANGER_SERVER)
  --setup-profile      choose the normal Chrome profile used for Vidu
  --profile-choice <n> non-interactive selection for --setup-profile
  --list-profiles      print Chrome profile candidates and exit
  --profile-config <path>
                       local Vidu profile config path (default workspace/.local/vidu-profile.json)
  --vidu-url <url>     Vidu create page (default https://www.vidu.com/ja/create/img2video)
  --download-dir <dir> normal Chrome download directory (default ~/Downloads)
  --max <n>            cap targets processed (default 20)
  --timeout-min <n>    generation wait timeout per target (default 25)
  --allow-paid         allow submitting when Vidu visibly shows a non-zero credit cost
  --keep-tabs          leave the Vidu marker tab on the result page after processing
  --help, -h           show this help and exit

Hard rules:
  - Vidu uses the selected normal Chrome profile, not a separate automation profile
  - this script never launches another Chrome/Chromium instance for the same profile
  - if the marker tab is missing, this script uses the common profile-safe setup/repair route before processing
  - if the configured Vidu profile is logged out or unusable, stop before upload/prompt/create
  - do not probe other Chrome profiles from the Vidu driver
  - the previous implicit ~/.image-arranger/vidu-chrome and ~/.image-arranger/vidu-profiles profiles are not used
  - do not use Codex image generation as a fallback for queued Vidu work`;

if (flag("--help") || flag("-h")) {
  console.log(HELP);
  process.exit(0);
}

const SERVER = (option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217")).replace(/\/$/, "");
const SETUP_PROFILE = flag("--setup-profile");
const LIST_PROFILES = flag("--list-profiles");
const PROFILE_CHOICE = option("--profile-choice", option("--choice", ""));
const PROFILE_CONFIG_PATH = resolve(option("--profile-config", "workspace/.local/vidu-profile.json"));
const VIDU_URL = option("--vidu-url", process.env.IMAGE_ARRANGER_VIDU_URL ?? "https://www.vidu.com/ja/create/img2video");
const DOWNLOAD_DIR = resolve(option("--download-dir", process.env.IMAGE_ARRANGER_VIDU_DOWNLOAD_DIR ?? join(homedir(), "Downloads")));
const MAX_TARGETS = Number(option("--max", "20"));
const CHECK_ONLY = flag("--check");
const DRY_RUN = flag("--dry-run");
const REQUEST_ID = option("--request", "");
const TIMEOUT_MS = Math.max(1, Number(option("--timeout-min", "25")) || 25) * 60 * 1000;
function readLocalAllowPaid() {
  try {
    const raw = JSON.parse(readFileSync(PROFILE_CONFIG_PATH, "utf8"));
    return raw?.allowPaid === true || raw?.viduAllowPaid === true || raw?.policy?.allowPaid === true;
  } catch {
    return false;
  }
}
const LOCAL_ALLOW_PAID = readLocalAllowPaid();
const ALLOW_PAID = flag("--allow-paid") || process.env.IMAGE_ARRANGER_VIDU_ALLOW_PAID === "1" || LOCAL_ALLOW_PAID;
const SERVICE = "vidu";
const SERVICE_LABEL = "Vidu";
const BROWSER_UPLOAD_CHUNK_SIZE = 240000;
const MIN_VIDEO_BYTES = 100000;
const START_FRAME_RMSE_THRESHOLD = 0.12;
const STRICT_START_FRAME_CHECK = process.env.IMAGE_ARRANGER_VIDU_STRICT_START_FRAME === "1";
let currentViduProfile = null;
let currentViduUrl = VIDU_URL;
let currentViduRunMarkerPart = "";

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function api(path, body = null) {
  const response = await fetch(`${SERVER}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  return payload;
}

function printProfileCandidates(profiles = listChromeProfiles()) {
  printServiceProfileCandidates({
    service: SERVICE,
    serviceLabel: SERVICE_LABEL,
    profileConfigPath: PROFILE_CONFIG_PATH,
    profiles,
  });
}

async function setupProfile() {
  await setupServiceChromeProfile({
    service: SERVICE,
    serviceLabel: SERVICE_LABEL,
    profileChoice: PROFILE_CHOICE,
    profileConfigPath: PROFILE_CONFIG_PATH,
  });
}

function loadViduProfileConfig() {
  return loadServiceChromeProfile({
    service: SERVICE,
    serviceLabel: SERVICE_LABEL,
    profileConfigPath: PROFILE_CONFIG_PATH,
  });
}

function assertNoLegacyViduAutomationChrome() {
  assertNoUserDataDirProcesses({
    label: "Legacy Vidu automation Chrome",
    rejectedPaths: [
      join(homedir(), ".image-arranger/vidu-chrome"),
      join(homedir(), ".image-arranger/vidu-profiles"),
    ],
  });
}

function buildViduMarkerUrl(profile, runId = "") {
  return buildViduMarkerUrlForProfile({ viduUrl: currentViduUrl, profile, runId });
}

function markerPartForProfile(profile) {
  return markerPartForViduProfile(profile);
}

function markerPartForViduRun(profile, runId) {
  return `${markerPartForProfile(profile)}&run=${encodeURIComponent(runId)}`;
}

function runViduJs(markerPart, js, { activate = false } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return runChromeTabJsByUrlPart(markerPart, js, {
        activate,
        errorLabel: "Vidu marker tab",
        profile: currentViduProfile,
        profileConfigPath: PROFILE_CONFIG_PATH,
      });
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      if (attempt >= 2 || !/target tab not found|returned no value|missing value|正しくないインデックス|invalid index|can.?t get tab|cannot get tab|tab .*を取り出すことはできません/i.test(message)) {
        throw error;
      }
      if (!currentViduProfile) throw error;
      spawnSync("sleep", ["2"]);
    }
  }
  throw new Error(`Vidu marker tab disappeared during processing. Re-run the common profile-safe marker setup/check before processing again. Original error: ${lastError?.message ?? lastError}`);
}

function usableViduCreateState(state) {
  return state?.readyState === "complete"
    && !state.loggedOut
    && state.fileInputs > 0
    && state.textareaCount > 0;
}

async function resolveReadyViduProfile(configuredProfile, runLog) {
  currentViduProfile = configuredProfile;
  const selectedState = await waitForNormalProfileViduPage(configuredProfile, runLog);
  if (usableViduCreateState(selectedState)) {
    return {
      profile: configuredProfile,
      markerPart: markerPartForProfile(configuredProfile),
      state: selectedState,
    };
  }
  throw new Error(`Configured Vidu profile is not usable. Refusing to probe or open other Chrome profiles. State: ${JSON.stringify({
    url: selectedState.url,
    title: selectedState.title,
    loggedOut: selectedState.loggedOut,
    fileInputs: selectedState.fileInputs,
    textareaCount: selectedState.textareaCount,
    submitText: selectedState.submitText,
    body: String(selectedState.body ?? "").slice(0, 800),
  })}`);
}

async function waitForState(label, getter, predicate, { timeoutMs = 30000, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();
  let last = null;
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      last = await getter();
      if (predicate(last)) return last;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  const detail = lastError ? lastError.message : JSON.stringify(last).slice(0, 1200);
  throw new Error(`${label} timed out: ${detail}`);
}

async function waitForNormalProfileViduPage(profile, runLog) {
  const url = buildViduMarkerUrl(profile);
  const markerPart = markerPartForProfile(profile);
  const legacyPart = legacyMarkerPartForViduProfile(profile);
  const legacy = (() => {
    try {
      return findChromeTabByUrlPart(legacyPart, {
        activate: false,
        profile,
        profileConfigPath: PROFILE_CONFIG_PATH,
      });
    } catch {
      return null;
    }
  })();
  const ensured = await ensureChromeMarkerTabProfileSafe({
    markerPart,
    markerUrl: url,
    profile,
    profileConfigPath: PROFILE_CONFIG_PATH,
    serviceLabel: SERVICE_LABEL,
    activate: true,
    missingMessage: ({ initialFindError, repairError }) => {
      const legacyHint = legacy
        ? " A legacy Vidu marker tab is open but it lacks profile-email, so it is not a safe profile proof."
        : "";
      return [
        `Vidu marker tab was not found for the selected Chrome profile ${profile.profileName} / ${profile.email}.${legacyHint}`,
        "The common profile-safe route failed; Chrome must already be running in the selected profile.",
        "Do not launch another Chrome profile or probe other profiles.",
        initialFindError ? `Initial marker check: ${initialFindError.message}` : "",
        repairError ? `Profile-safe repair failed: ${repairError.message}` : "",
      ].filter(Boolean).join(" ");
    },
  });
  const existing = ensured.markerTab;
  runLog.log(`reusing selected-profile Vidu marker tab: ${existing.url}`);

  const state = await waitForReadyViduPageState(markerPart);
  return state;
}

async function waitForReadyViduPageState(markerPart) {
  return waitForState(
    "Vidu selected normal Chrome profile page",
    () => viduState(markerPart),
    (item) => item.readyState === "complete" && (item.loggedOut || (item.fileInputs > 0 && item.textareaCount > 0)),
    { timeoutMs: 30000, intervalMs: 1000 },
  );
}

async function resetViduMarkerTab(profile, runLog) {
  const markerPart = markerPartForProfile(profile);
  currentViduRunMarkerPart = "";
  const runId = timestamp();
  const targetUrl = buildViduMarkerUrl(profile, runId);
  const runMarkerPart = markerPartForViduRun(profile, runId);
  runViduJs(markerPart, `
    history.replaceState(null, document.title, ${JSON.stringify(targetUrl)});
    return { url: location.href };
  `, { activate: true });
  currentViduRunMarkerPart = runMarkerPart;
  await delay(1000);
  const state = await waitForReadyViduPageState(runMarkerPart);
  await closeTopBanner(runMarkerPart);
  runLog.log(`Vidu marker for this run: ${currentViduRunMarkerPart}`);
  return state;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

function slugify(value, fallback = "output") {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || fallback;
}

function relPath(projectRoot, file) {
  return file.startsWith(projectRoot) ? file.slice(projectRoot.length + 1) : file;
}

function isViduTarget(row) {
  return row.action === "generate" && (
    row.service === "vidu"
    || row.mode === "video"
    || Boolean(row.inputs?.startFrame)
    || Boolean(row.inputs?.endFrame)
  );
}

function resolveProjectFile(projectRoot, file) {
  if (!file) return "";
  return isAbsolute(file) ? file : resolve(projectRoot, file);
}

function assertExistingFile(label, file) {
  if (!file || !existsSync(file)) throw new Error(`${label} was not found: ${file || "(empty)"}`);
  const stat = statSync(file);
  if (!stat.isFile()) throw new Error(`${label} is not a file: ${file}`);
  return file;
}

function mimeForFile(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

const FIRE_POINTER_SEQUENCE = `(el) => {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    const Ctor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, buttons: 1, pointerId: 1 }));
  }
}`;

async function closeTopBanner(markerPart) {
  try {
    return runViduJs(markerPart, `
      const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((item) => /^(Close|閉じる|×|x)$/i.test(normalize(item.getAttribute("aria-label") || item.innerText)));
      if (!button) return false;
      button.click();
      return true;
    `);
  } catch {
    return false;
  }
}

function viduState(markerPart) {
  return runViduJs(markerPart, `
    const body = document.body?.innerText ?? "";
    const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const buttons = [...document.querySelectorAll('button, a')];
    const submit = document.querySelector('[data-testid="form-submit-button"]')
      || buttons.find((item) => /作成|生成|Create|Generate/i.test(normalize(item.innerText || item.getAttribute("aria-label"))));
    const videos = [...document.querySelectorAll('video')]
      .map((video) => video.currentSrc || video.src || "")
      .filter(Boolean);
    const directVideos = videos.filter((src) => /\\.mp4(\\?|$)/i.test(src) && !src.startsWith("blob:"));
    const uploadImages = [...document.querySelectorAll("img")]
      .map((img) => ({
        src: img.currentSrc || img.src || "",
        alt: img.alt || "",
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      }))
      .filter((img) => /upload|preview|frame/i.test(img.alt) || img.src.startsWith("blob:") || img.src.startsWith("data:"));
    const downloadButtons = buttons
      .filter((item) => visible(item))
      .map((item) => ({
        text: normalize(item.innerText || item.getAttribute("aria-label") || item.getAttribute("title") || ""),
        href: item.href || "",
      }))
      .filter((item) => /download|ダウンロード|保存/i.test(item.text) || /\\.mp4(\\?|$)/i.test(item.href));
    const visibleActionTexts = buttons
      .filter((item) => visible(item))
      .map((item) => normalize(item.innerText || item.getAttribute("aria-label") || item.getAttribute("title") || ""))
      .filter(Boolean);
    const loggedOut = (${isViduLoggedOutPageState.toString()})({
      pathname: location.pathname,
      body,
      visibleActionTexts,
    });
    const fileInputs = [...document.querySelectorAll("input[type=file]")];
    const createRoot = submit?.closest("form")
      || submit?.closest('[class*="create" i]')
      || submit?.parentElement
      || document.body;
    const createText = normalize(createRoot?.innerText ?? "");
    const currentFormBusy = /アップロード中|作成中|生成中|Uploading|Processing|Generating|In progress/i.test(createText)
      && (!submit || submit.disabled || submit.getAttribute("aria-disabled") === "true");
    const historyHasProcessingText = /処理中|Processing|Generating|In progress/i.test(body);
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      body: normalize(body).slice(0, 3000),
      bodyStart: normalize(body).slice(0, 800),
      fileInputs: fileInputs.length,
      fileInputFiles: fileInputs.map((input) => input.files?.length ?? 0),
      uploadPreviews: uploadImages.length,
      textareaCount: document.querySelectorAll("textarea").length,
      submitText: normalize(submit?.innerText ?? submit?.getAttribute("aria-label") ?? ""),
      submitDisabled: !submit || submit.disabled || submit.getAttribute("aria-disabled") === "true",
      uploading: /アップロード中|Uploading/i.test(body),
      activeTask: currentFormBusy,
      historyHasProcessingText,
      loggedOut,
      videos,
      directVideos,
      downloadButtons,
    };
  `);
}

function assertNoActiveViduTask(state, phase) {
  if (state?.loggedOut) {
    const body = String(state.body ?? state.bodyStart ?? "").slice(0, 1200);
    throw new Error(`Vidu page is logged out during ${phase}; this is likely the wrong Chrome profile or an unsigned Vidu session. Do not submit. State: ${JSON.stringify({
      url: state.url,
      title: state.title,
      submitText: state.submitText,
      body,
    })}`);
  }
  if (!state?.activeTask) return;
  const body = String(state.body ?? state.bodyStart ?? "").slice(0, 1200);
  throw new Error(`Vidu already has an active upload/generation task during ${phase}; do not submit another Vidu request until the visible task finishes or fails. State: ${JSON.stringify({
    url: state.url,
    title: state.title,
    submitText: state.submitText,
    uploading: state.uploading,
    body,
  })}`);
}

function preexistingViduResultSummary(state) {
  const directVideoCount = Array.isArray(state?.directVideos) ? state.directVideos.length : 0;
  const videoCount = Array.isArray(state?.videos) ? state.videos.length : 0;
  const downloadCount = Array.isArray(state?.downloadButtons) ? state.downloadButtons.length : 0;
  const uploadedFrames = Array.isArray(state?.fileInputFiles)
    ? state.fileInputFiles.reduce((sum, count) => sum + Number(count || 0), 0)
    : 0;
  const hasUploadPreview = Number(state?.uploadPreviews || 0) > 0 || uploadedFrames > 0;
  const visible = !hasUploadPreview && (directVideoCount > 0 || downloadCount > 0 || (videoCount > 0 && state?.historyHasProcessingText));
  return {
    visible,
    videos: videoCount,
    directVideos: directVideoCount,
    downloadButtons: downloadCount,
    uploadPreviews: Number(state?.uploadPreviews || 0),
    fileInputFiles: state?.fileInputFiles,
  };
}

function logPreexistingViduResultIfVisible(state, phase, runLog, tag = "vidu") {
  const summary = preexistingViduResultSummary(state);
  if (!summary.visible) return summary;
  const body = String(state.body ?? state.bodyStart ?? "").slice(0, 1200);
  const detail = {
    url: state.url,
    title: state.title,
    submitText: state.submitText,
    submitDisabled: state.submitDisabled,
    videos: summary.videos,
    directVideos: summary.directVideos,
    downloadButtons: summary.downloadButtons,
    uploadPreviews: summary.uploadPreviews,
    fileInputFiles: summary.fileInputFiles,
    body,
  };
  runLog.log(
    `[${tag}] preexisting Vidu history/result surface visible during ${phase}; baseline will be recorded and excluded from current-result detection. State: ${JSON.stringify(detail)}`,
    "warn",
  );
  return summary;
}

async function uploadFrames(markerPart, files, runLog, tag) {
  if (files.length < 1 || files.length > 2) throw new Error(`Vidu generation needs 1 start frame or 2 start/end frames; got ${files.length}`);
  assertNoActiveViduTask(viduState(markerPart), "before frame upload");
  const expectedFileCount = files.length;
  const frameLabel = expectedFileCount === 1 ? "start frame" : "start/end frames";
  const uploadId = `vidu-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  runViduJs(markerPart, `
    window.__imageArrangerViduUploads = window.__imageArrangerViduUploads || {};
    window.__imageArrangerViduUploads[${JSON.stringify(uploadId)}] = { files: [] };
    return { ok: true };
  `);

  for (const [index, file] of files.entries()) {
    const data = readFileSync(file).toString("base64");
    const fileInfo = { name: basename(file), type: mimeForFile(file), size: statSync(file).size };
    runLog.log(`[${tag}] preparing ${fileInfo.name} (${Math.round(fileInfo.size / 1024)} KB)`);
    runViduJs(markerPart, `
      const upload = window.__imageArrangerViduUploads?.[${JSON.stringify(uploadId)}];
      if (!upload) throw new Error("upload store missing");
      upload.files[${index}] = {
        name: ${JSON.stringify(fileInfo.name)},
        type: ${JSON.stringify(fileInfo.type)},
        chunks: []
      };
      return { ok: true };
    `);
    for (let offset = 0; offset < data.length; offset += BROWSER_UPLOAD_CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + BROWSER_UPLOAD_CHUNK_SIZE);
      runViduJs(markerPart, `
        const upload = window.__imageArrangerViduUploads?.[${JSON.stringify(uploadId)}];
        const file = upload?.files?.[${index}];
        if (!file) throw new Error("upload file store missing");
        file.chunks.push(${JSON.stringify(chunk)});
        return { chunks: file.chunks.length };
      `);
    }
  }

  const committed = runViduJs(markerPart, `
    const uploadId = ${JSON.stringify(uploadId)};
    const upload = window.__imageArrangerViduUploads?.[uploadId];
    const expectedFileCount = ${expectedFileCount};
    if (!upload || upload.files.length !== expectedFileCount || upload.files.some((file) => !file?.chunks?.length)) {
      throw new Error("upload chunks incomplete");
    }
    const inputs = [...document.querySelectorAll("input[type=file]")]
      .filter((input) => /image|png|jpe?g|webp/i.test(input.accept || ""));
    ${VIDU_UPLOAD_PLAN_FUNCTION_JS}
    const plan = planViduUploadStrategy(expectedFileCount, inputs.length);
    if (!plan.ok) return plan;
    const buildFile = (file) => {
      const binary = atob(file.chunks.join(""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], file.name, { type: file.type });
    };
    const assignFiles = (input, files) => {
      const dt = new DataTransfer();
      for (const file of files) dt.items.add(buildFile(file));
      input.scrollIntoView({ block: "center", inline: "center" });
      try {
        input.files = dt.files;
      } catch {
        Object.defineProperty(input, "files", { configurable: true, value: dt.files });
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return [...input.files].map((file) => file.name);
    };

    const strategy = plan.strategy;
    let assignedNames = [];
    for (const assignment of plan.assignments) {
      assignedNames.push(...assignFiles(
        inputs[assignment.inputIndex],
        assignment.fileIndexes.map((fileIndex) => upload.files[fileIndex]),
      ));
    }
    if (plan.dropTargetIndex !== undefined) {
      try {
        const dt = new DataTransfer();
        for (const fileIndex of plan.assignments.find((item) => item.inputIndex === plan.dropTargetIndex)?.fileIndexes ?? []) {
          dt.items.add(buildFile(upload.files[fileIndex]));
        }
        inputs[plan.dropTargetIndex].dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      } catch {
        // DragEvent construction is not available in every Chromium context.
      }
    }
    delete window.__imageArrangerViduUploads[uploadId];
    return {
      ok: true,
      strategy,
      fileCount: assignedNames.length,
      names: assignedNames,
      inputFileCounts: inputs.map((input) => input.files?.length ?? 0),
    };
  `, { activate: true });
  if (!committed.ok || committed.fileCount !== expectedFileCount) {
    throw new Error(`Vidu file injection failed: ${JSON.stringify(committed)}`);
  }

  await waitForState(
    `Vidu ${frameLabel} upload completion`,
    () => viduState(markerPart),
    (state) => {
      const uploadedCountReady = state.uploadPreviews >= expectedFileCount
        || state.fileInputFiles.some((count) => count >= expectedFileCount);
      const framePairReady = expectedFileCount === 2
        && /フレーム\s*1\s*-\s*フレーム\s*2|Frame\s*1\s*-\s*Frame\s*2|First\s*Frame.*Last\s*Frame/i.test(state.body);
      return (uploadedCountReady || framePairReady) && !state.uploading;
    },
    { timeoutMs: 180000, intervalMs: 1000 },
  );
  await delay(1200);
  return committed;
}

async function setDurationIfAvailable(markerPart, durationSec) {
  if (!durationSec) return { status: "skipped" };
  const want = String(Number(durationSec));
  const opened = runViduJs(markerPart, `
    const want = ${JSON.stringify(want)};
    const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
    const numeric = [...document.querySelectorAll('button[role="combobox"]')]
      .filter((button) => /^\\d+\\s*(秒|s)?$/i.test(normalize(button.innerText)));
    const button = numeric[0];
    if (!button) return { status: "unavailable" };
    const current = normalize(button.innerText);
    if (new RegExp("^" + want + "\\\\s*(秒|s)?$", "i").test(current)) return { status: "already", current };
    button.scrollIntoView({ block: "center", inline: "center" });
    (${FIRE_POINTER_SEQUENCE})(button);
    return { status: "opened", current };
  `, { activate: true });
  if (opened.status !== "opened") return opened;

  try {
    await waitForState(
      "Vidu duration menu",
      () => runViduJs(markerPart, `
        return document.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item]').length;
      `),
      (count) => count > 0,
      { timeoutMs: 6000, intervalMs: 500 },
    );
  } catch {
    return { status: "unavailable", reason: "duration menu did not open", current: opened.current };
  }

  const picked = runViduJs(markerPart, `
    const want = ${JSON.stringify(want)};
    const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
    const items = [...document.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item]')];
    const item = items.find((el) => new RegExp("^" + want + "\\\\s*(秒|s)?$", "i").test(normalize(el.innerText)));
    if (!item) return { status: "not-found", seen: items.map((el) => normalize(el.innerText)).filter(Boolean).slice(0, 20) };
    (${FIRE_POINTER_SEQUENCE})(item);
    return { status: "picked", text: normalize(item.innerText) };
  `, { activate: true });
  await delay(700);
  return picked;
}

async function setViduPrompt(markerPart, prompt) {
  assertNoActiveViduTask(viduState(markerPart), "before prompt insert");
  const text = String(prompt ?? "").trim();
  if (!text) throw new Error("Vidu target prompt is empty");
  const written = runViduJs(markerPart, `
    const textarea = document.querySelector("textarea");
    if (!textarea) return null;
    textarea.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (setter) setter.call(textarea, ${JSON.stringify(text)});
    else textarea.value = ${JSON.stringify(text)};
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return textarea.value;
  `, { activate: true });
  if (written == null) throw new Error("Vidu prompt textarea was not found");
  const normalize = (value) => String(value).replace(/\s+/g, " ").trim();
  if (!normalize(written).startsWith(normalize(text).slice(0, 80))) {
    throw new Error(`Vidu prompt mismatch after insert: "${String(written).slice(0, 120)}"`);
  }
  return written;
}

async function clickCreate(markerPart) {
  const state = await waitForState(
    "Vidu create button enabled",
    () => viduState(markerPart),
    (item) => item.submitText && !item.submitDisabled && !item.uploading,
    { timeoutMs: 120000, intervalMs: 1000 },
  );
  if (isInsufficientViduCreditState(state)) {
    const error = new Error(`Vidu account has insufficient credits; purchase/add credits before retrying. Submit text: ${state.submitText || "(empty)"}`);
    error.code = "VIDU_INSUFFICIENT_CREDITS";
    throw error;
  }
  const cost = visibleCreditCost(state.submitText);
  if (cost > 0 && !ALLOW_PAID) {
    throw new Error(`Vidu create button shows a non-zero credit cost (${state.submitText}). Rerun with --allow-paid if this is intended.`);
  }
  assertNoActiveViduTask(state, "before create submit");
  const preSubmit = viduState(markerPart);
  assertNoActiveViduTask(preSubmit, "immediately before create submit");
  const clicked = runViduJs(markerPart, `
    const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
    const button = document.querySelector('[data-testid="form-submit-button"]')
      || [...document.querySelectorAll("button")].find((item) => /作成|生成|Create|Generate/i.test(normalize(item.innerText || item.getAttribute("aria-label"))));
    if (!button) return { clicked: false };
    button.scrollIntoView({ block: "center", inline: "center" });
    (${FIRE_POINTER_SEQUENCE})(button);
    return { clicked: true, text: normalize(button.innerText || button.getAttribute("aria-label")) };
  `, { activate: true });
  if (!clicked.clicked) throw new Error("Vidu create button disappeared before click");
  return state;
}

async function waitForNewVideo(markerPart, beforeVideos, { onTick = null } = {}) {
  const before = new Set(beforeVideos.map(stableVideoKey));
  const startedAt = Date.now();
  let lastBeat = 0;
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const state = viduState(markerPart);
    const freshVideos = state.videos.filter((src) => !before.has(stableVideoKey(src)));
    const freshDirect = state.directVideos.filter((src) => !before.has(stableVideoKey(src)));
    if (freshDirect.length) return { status: "video", src: freshDirect[0], state, browserDownload: false };
    if (freshVideos.length && state.downloadButtons.length) {
      return { status: "video", src: freshVideos[0], state, browserDownload: true };
    }
    if (/生成に失敗|失敗しました|Generation failed|Failed to generate|クレジット不足|ポリシーに違反|policy violation|規約違反/i.test(state.body) || isInsufficientViduCreditState(state)) {
      return { status: "error", message: state.body.slice(0, 800), state };
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (onTick && elapsed - lastBeat >= 30) {
      lastBeat = elapsed;
      onTick(elapsed, state);
    }
    await delay(10000);
  }
  return { status: "timeout" };
}

async function downloadVideo(url, destination) {
  if (!/\.mp4(\?|$)/i.test(url) || url.startsWith("blob:")) {
    throw new Error(`Vidu did not expose a downloadable MP4 URL: ${url.slice(0, 120)}`);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Vidu MP4 download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < MIN_VIDEO_BYTES) throw new Error(`Vidu MP4 download was suspiciously small (${buffer.length} bytes)`);
  writeFileSync(destination, buffer);
  return { bytes: buffer.length, source: "direct-url" };
}

function listDownloadFiles(downloadDir) {
  if (!existsSync(downloadDir)) return [];
  return readdirSync(downloadDir)
    .filter((name) => /\.(mp4|mov|webm)$/i.test(name) && !/\.crdownload$/i.test(name))
    .map((name) => {
      const file = join(downloadDir, name);
      const stat = statSync(file);
      return { file, name, size: stat.size, mtimeMs: stat.mtimeMs };
    })
    .filter((item) => item.size >= MIN_VIDEO_BYTES)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function findDuplicateExistingVideo(file, outputDir) {
  const current = resolve(file);
  const currentHash = sha256(current);
  const duplicate = readdirSync(outputDir)
    .filter((name) => /\.(mp4|mov|webm)$/i.test(name))
    .map((name) => resolve(outputDir, name))
    .filter((candidate) => candidate !== current && existsSync(candidate))
    .find((candidate) => sha256(candidate) === currentHash);
  return duplicate ? { file: duplicate, sha256: currentHash } : null;
}

function commandAvailable(command) {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function runChecked(command, commandArgs, label) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${label} failed${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

function normalizedRmseFromCompareOutput(output) {
  const match = String(output).match(/\((0(?:\.\d+)?|1(?:\.0+)?)\)/);
  if (!match) throw new Error(`ImageMagick compare RMSE output was not parseable: ${String(output).slice(0, 200)}`);
  return Number(match[1]);
}

function assertStartFrameContinuity({ startFrame, videoFile, outputDir, tag, runLog }) {
  if (!commandAvailable("ffmpeg") || !commandAvailable("magick") || !commandAvailable("compare")) {
    throw new Error("Start-frame continuity check requires ffmpeg, magick, and compare on PATH.");
  }
  const checkDir = join(outputDir, ".vidu-start-frame-checks");
  mkdirSync(checkDir, { recursive: true });
  const base = `${slugify(tag, "vidu")}-${timestamp()}`;
  const videoFrame = join(checkDir, `${base}-video-frame.jpg`);
  const normalizedStart = join(checkDir, `${base}-start.png`);
  const normalizedVideo = join(checkDir, `${base}-video.png`);
  runChecked("ffmpeg", [
    "-v", "error",
    "-ss", "0.2",
    "-i", videoFile,
    "-frames:v", "1",
    videoFrame,
  ], "Vidu start-frame extraction");
  runChecked("magick", [
    startFrame,
    "-resize", "64x64!",
    "-colorspace", "Gray",
    normalizedStart,
  ], "Start-frame normalization");
  runChecked("magick", [
    videoFrame,
    "-resize", "64x64!",
    "-colorspace", "Gray",
    normalizedVideo,
  ], "Vidu first-frame normalization");
  const compare = spawnSync("compare", [
    "-metric", "RMSE",
    normalizedStart,
    normalizedVideo,
    "null:",
  ], { encoding: "utf8" });
  const compareOutput = [compare.stderr, compare.stdout].filter(Boolean).join("\n").trim();
  if (![0, 1].includes(compare.status)) {
    throw new Error(`ImageMagick RMSE compare failed: ${compareOutput}`);
  }
  const normalizedRmse = normalizedRmseFromCompareOutput(compareOutput);
  runLog.log(`[${tag}] start-frame continuity RMSE ${normalizedRmse.toFixed(6)} (threshold ${START_FRAME_RMSE_THRESHOLD}, strict=${STRICT_START_FRAME_CHECK})`);
  if (normalizedRmse > START_FRAME_RMSE_THRESHOLD) {
    const message = `Vidu result first frame does not match inputs.startFrame closely enough (RMSE ${normalizedRmse.toFixed(6)} > ${START_FRAME_RMSE_THRESHOLD}); this may indicate stale-history pickup or scene replacement.`;
    if (STRICT_START_FRAME_CHECK) throw new Error(`${message} Refusing to register because IMAGE_ARRANGER_VIDU_STRICT_START_FRAME=1.`);
    runLog.log(`[${tag}] ${message} Continuing because strict start-frame rejection is disabled.`, "warn");
  }
  return normalizedRmse;
}

function verifyStartFrameContinuity({ startFrame, videoFile, outputDir, tag, runLog }) {
  try {
    return { ok: true, rmse: assertStartFrameContinuity({ startFrame, videoFile, outputDir, tag, runLog }) };
  } catch (error) {
    if (STRICT_START_FRAME_CHECK) {
      return { ok: false, blocking: true, message: error.message };
    }
    runLog.log(`[${tag}] start-frame continuity check skipped or failed: ${error.message}. Continuing because strict start-frame rejection is disabled.`, "warn");
    return { ok: true, skipped: true, message: error.message };
  }
}

async function waitForDownloadedVideo(downloadDir, startedAtMs, beforeFiles) {
  const stable = new Map();
  while (Date.now() - startedAtMs < 10 * 60 * 1000) {
    for (const item of listDownloadFiles(downloadDir)) {
      if (beforeFiles.has(item.file)) continue;
      if (item.mtimeMs < startedAtMs - 5000) continue;
      const previous = stable.get(item.file);
      const stableCount = previous && previous.size === item.size ? previous.stableCount + 1 : 1;
      stable.set(item.file, { size: item.size, stableCount });
      if (stableCount >= 2) return item;
    }
    await delay(2000);
  }
  throw new Error(`Timed out waiting for Vidu browser download in ${downloadDir}`);
}

async function clickDownloadAndCopy(markerPart, destination, startedAtMs, runLog, tag) {
  const beforeFiles = new Set(listDownloadFiles(DOWNLOAD_DIR).map((item) => item.file));
  const clicked = runViduJs(markerPart, `
    const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const candidates = [...document.querySelectorAll("a, button")]
      .filter((el) => visible(el))
      .map((el) => ({
        el,
        text: normalize(el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || ""),
        href: el.href || "",
      }))
      .filter((item) => /download|ダウンロード|保存/i.test(item.text) || /\\.mp4(\\?|$)/i.test(item.href));
    const direct = candidates.find((item) => /\\.mp4(\\?|$)/i.test(item.href));
    if (direct) return { status: "href", href: direct.href, text: direct.text };
    const item = candidates[candidates.length - 1];
    if (!item) return { status: "missing" };
    item.el.scrollIntoView({ block: "center", inline: "center" });
    (${FIRE_POINTER_SEQUENCE})(item.el);
    return { status: "clicked", text: item.text };
  `, { activate: true });
  if (clicked.status === "href") {
    runLog.log(`[${tag}] Vidu download href found; downloading directly`);
    return downloadVideo(clicked.href, destination);
  }
  if (clicked.status !== "clicked") {
    throw new Error(`Vidu download button was not found: ${JSON.stringify(clicked)}`);
  }
  runLog.log(`[${tag}] Vidu download button clicked (${clicked.text || "no label"}); waiting in ${DOWNLOAD_DIR}`);
  const downloaded = await waitForDownloadedVideo(DOWNLOAD_DIR, startedAtMs, beforeFiles);
  copyFileSync(downloaded.file, destination);
  return { bytes: downloaded.size, source: "browser-download", downloaded: downloaded.file };
}

async function saveViduResult(markerPart, result, destination, submittedAtMs, runLog, tag) {
  if (result.src && !result.browserDownload) {
    try {
      return await downloadVideo(result.src, destination);
    } catch (error) {
      runLog.log(`[${tag}] direct Vidu video download failed; trying browser download button: ${error.message}`, "warn");
    }
  }
  return clickDownloadAndCopy(markerPart, destination, submittedAtMs, runLog, tag);
}

async function main() {
  if (LIST_PROFILES) {
    printProfileCandidates();
    return;
  }
  if (SETUP_PROFILE) {
    await setupProfile();
    return;
  }

  const queue = CHECK_ONLY ? { projectRoot: process.cwd(), requests: [] } : await api("/api/requests");
  const projectRoot = queue.projectRoot;
  const runLog = new RunLog(join(projectRoot, "agent-logs"), `vidu-run-${timestamp()}`);
  runLog.log(`${CHECK_ONLY ? "check-only" : `server ${SERVER}`}, projectRoot ${projectRoot}`);
  runLog.log(`Vidu URL ${VIDU_URL}`);
  runLog.log(`download dir ${DOWNLOAD_DIR}`);
  runLog.log(`allow paid credits: ${ALLOW_PAID ? "yes" : "no"}${LOCAL_ALLOW_PAID ? " (local profile config)" : ""}`);
  runLog.log(`run log: ${runLog.dir}`);

  const all = queue.requests ?? [];
  const wanted = all
    .filter((row) => REQUEST_ID ? row.requestId === REQUEST_ID : true)
    .filter(isViduTarget)
    .slice(0, MAX_TARGETS);
  const skipped = all.filter((row) => !wanted.includes(row));
  for (const row of skipped) {
    runLog.log(`skipping ${row.requestId}[${row.targetIndex}] (action=${row.action}, service=${row.service})`, "warn");
  }
  runLog.log(`${wanted.length} vidu video target(s) to process`);
  if (DRY_RUN) {
    runLog.attachJson("dry-run targets", wanted);
    console.log(JSON.stringify(wanted.map((row) => ({
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      entryId: row.entryId,
      overview: row.overview,
      startFrame: row.inputs?.startFrame,
      endFrame: row.inputs?.endFrame,
      durationSec: row.inputs?.durationSec,
    })), null, 2));
    return;
  }

  if (!CHECK_ONLY && wanted.length === 0) {
    runLog.log("No Vidu video targets to process; Chrome was not started.");
    return;
  }

  const viduProfile = loadViduProfileConfig();
  try {
    assertChromeRunning();
  } catch (error) {
    runLog.log(`${error.message}; Vidu processing stopped before marker setup. Chrome is not started by this driver.`, "error");
    process.exitCode = 2;
    return;
  }
  currentViduProfile = viduProfile.chrome;
  assertSingleBridgeCandidateForProfile(viduProfile.chrome);
  runLog.log(`Vidu profile config ${viduProfile.configPath}`);
  runLog.log(`Vidu configured normal Chrome profile ${viduProfile.chrome.profileName} / ${viduProfile.chrome.email} / ${viduProfile.chrome.profileDir}`);
  assertNoLegacyViduAutomationChrome();

  const readyProfile = await resolveReadyViduProfile(viduProfile.chrome, runLog);
  const activeViduProfile = readyProfile.profile;
  const markerPart = readyProfile.markerPart;
  currentViduProfile = activeViduProfile;
  assertSingleBridgeCandidateForProfile(activeViduProfile);
  runLog.log(`Vidu active normal Chrome profile ${activeViduProfile.profileName} / ${activeViduProfile.email} / ${activeViduProfile.profileDir}`);

  const pageState = usableViduCreateState(readyProfile.state)
    ? readyProfile.state
    : await waitForNormalProfileViduPage(activeViduProfile, runLog);
  runLog.attachJson("vidu normal-profile check state", pageState);
  if (!(pageState.fileInputs > 0 && pageState.textareaCount > 0) || pageState.loggedOut) {
    runLog.log(`Vidu is not ready in the selected normal Chrome profile. State: ${JSON.stringify(pageState)}`, "error");
    console.error("\n>>> Vidu is not ready in the selected Chrome profile. Upload/prompt/create was not attempted, and no other profile was opened. <<<\n");
    process.exitCode = 2;
    return;
  }
  runLog.log("Vidu normal Chrome profile page OK");

  if (CHECK_ONLY) {
    if (pageState.activeTask) {
      runLog.log(`--check found active Vidu upload/generation; do not submit a new target yet. State: ${JSON.stringify({
        url: pageState.url,
        submitText: pageState.submitText,
        uploading: pageState.uploading,
        body: String(pageState.body ?? "").slice(0, 1200),
      })}`, "error");
      process.exitCode = 2;
      return;
    }
    logPreexistingViduResultIfVisible(pageState, "--check", runLog, "check");
    runLog.log("--check finished: selected normal Chrome profile + Vidu page are ready");
    return;
  }

  const summary = [];

  async function processTarget(row) {
    const tag = row.entryId;
    runLog.section(`${row.requestId}[${row.targetIndex}] ${row.overview ?? row.entryId}`);
    runLog.attachJson(`target ${tag}`, row);
    currentViduUrl = row.inputs?.viduUrl ?? VIDU_URL;
    runLog.log(`[${tag}] target Vidu URL ${currentViduUrl}`);

    const startFrame = assertExistingFile("inputs.startFrame", resolveProjectFile(projectRoot, row.inputs?.startFrame));
    const endFrame = row.inputs?.endFrame
      ? assertExistingFile("inputs.endFrame", resolveProjectFile(projectRoot, row.inputs.endFrame))
      : null;
    assertDistinctViduFrameInputs({
      startFrame,
      endFrame,
      startSha256: sha256(startFrame),
      endSha256: endFrame ? sha256(endFrame) : "",
    });
    const frameFiles = [startFrame, endFrame].filter(Boolean);
    const outputDir = resolve(projectRoot, row.outputDir || "outputs");
    mkdirSync(outputDir, { recursive: true });
    const fileBase = `${slugify(String(row.entryId ?? "video").replace(/^video-/, ""), row.entryId)}-${timestamp()}`;
    const destination = join(outputDir, `${fileBase}.mp4`);

    const startState = await resetViduMarkerTab(activeViduProfile, runLog);
    const targetMarkerPart = currentViduRunMarkerPart || markerPart;
    if (startState.loggedOut || startState.fileInputs === 0 || startState.textareaCount === 0) {
      throw new Error(`Vidu create page is not usable: ${JSON.stringify(startState).slice(0, 1200)}`);
    }
    assertNoActiveViduTask(startState, "before processing target");
    logPreexistingViduResultIfVisible(startState, "before processing target", runLog, tag);
    const beforeVideos = [
      ...new Set([
        ...(startState.videos ?? []),
        ...(startState.directVideos ?? []),
      ]),
    ];
    runLog.log(`[${tag}] Vidu page ready; ${beforeVideos.length} existing video/direct URL(s) visible`);

    const upload = await uploadFrames(targetMarkerPart, frameFiles, runLog, tag);
    runLog.log(`[${tag}] uploaded ${frameFiles.length === 1 ? "start frame" : "start/end frames"} via ${upload.strategy}: ${upload.names.join(", ")}`);

    const duration = await setDurationIfAvailable(targetMarkerPart, row.inputs?.durationSec);
    runLog.attachJson(`duration ${tag}`, duration);
    if (duration.status === "picked" || duration.status === "already") {
      runLog.log(`[${tag}] duration: ${duration.text ?? duration.current}`);
    } else if (row.inputs?.durationSec) {
      runLog.log(`[${tag}] could not set duration ${row.inputs.durationSec}s (${duration.status}); relying on the prompt/default`, "warn");
    }

    await setViduPrompt(targetMarkerPart, row.prompt);
    runLog.log(`[${tag}] prompt inserted and verified`);

    const submittedAt = Date.now();
    const submit = await clickCreate(targetMarkerPart);
    runLog.log(`[${tag}] Vidu create submitted (${submit.submitText || "no visible cost text"})`);
    const seenVideos = [...beforeVideos];
    let saved = null;
    while (!saved) {
      const result = await waitForNewVideo(targetMarkerPart, seenVideos, {
        onTick: (elapsed, state) => runLog.log(
          `[${tag}] waiting ${elapsed}s - videos:${state.videos.length} submit:${state.submitText || "(none)"}`,
        ),
      });
      if (result.status !== "video") {
        const message = result.status === "timeout" ? "Vidu generation timed out" : `Vidu generation failed: ${result.message}`;
        const error = new Error(message);
        if (isInsufficientViduCreditState(result.state ?? result.message)) {
          error.code = "VIDU_INSUFFICIENT_CREDITS";
        }
        throw error;
      }

      const candidate = await saveViduResult(targetMarkerPart, result, destination, submittedAt, runLog, tag);
      const duplicate = findDuplicateExistingVideo(destination, outputDir);
      if (duplicate) {
        if (result.src) seenVideos.push(result.src);
        runLog.log(`[${tag}] ignored stale Vidu history pickup: ${duplicate.file} has the same sha256 ${duplicate.sha256}; waiting for another result URL`, "warn");
        continue;
      }
      const continuity = verifyStartFrameContinuity({ startFrame, videoFile: destination, outputDir, tag, runLog });
      if (!continuity.ok) {
        if (result.src) seenVideos.push(result.src);
        runLog.log(`[${tag}] ignored Vidu candidate that failed start-frame continuity: ${continuity.message}`, "warn");
        continue;
      }
      saved = candidate;
    }
    const relFile = relPath(projectRoot, destination);
    runLog.log(`[${tag}] video saved: ${destination} (${Math.round(saved.bytes / 1024)} KB, ${saved.source})`);

    const complete = await api("/api/requests/complete", {
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      results: [{ file: relFile, prompt: row.prompt, service: "vidu" }],
    });
    runLog.attachJson(`completion ${tag}`, {
      postprocess: complete.postprocess,
      remainingRequests: (complete.requests ?? []).length,
    });
    runLog.log(`[${tag}] reported completed via /api/requests/complete`);

    if (!flag("--keep-tabs")) {
      try {
        runViduJs(targetMarkerPart, `
          history.replaceState(null, document.title, ${JSON.stringify(buildViduMarkerUrl(activeViduProfile))});
          return { url: location.href };
        `);
      } catch {
        // Keeping the result page open is acceptable if URL cleanup fails.
      }
    }
    return {
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      entryId: row.entryId,
      status: "completed",
      file: relFile,
    };
  }

  for (const row of wanted) {
    try {
      summary.push(await processTarget(row));
    } catch (error) {
      runLog.log(`[${row.entryId}] failed: ${error.message}`, "error");
      if (isInsufficientViduCreditError(error)) {
        runLog.log(`[${row.entryId}] request left pending because this is an account-credit blocker, not a generated-asset failure`, "error");
        summary.push({
          requestId: row.requestId,
          targetIndex: row.targetIndex,
          entryId: row.entryId,
          status: "blocked_pending",
          message: error.message,
        });
        continue;
      }
      await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        error: error.message,
      }).catch((completeError) => runLog.log(`[${row.entryId}] could not report error: ${completeError.message}`, "error"));
      summary.push({
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        entryId: row.entryId,
        status: "error",
        message: error.message,
      });
    }
  }

  runLog.section("Summary");
  runLog.attachJson("summary", summary);
  for (const item of summary) {
    runLog.log(`${item.status} ${item.requestId}[${item.targetIndex}] ${item.entryId} ${item.file ?? item.message ?? ""}`);
  }
  console.log(`\nRun log: ${runLog.dir}/log.md`);
  if (summary.some((item) => item.status === "error")) process.exitCode = 1;
  if (summary.some((item) => item.status === "blocked_pending")) process.exitCode = Math.max(process.exitCode ?? 0, 2);
}

main().then(() => {
  setTimeout(() => process.exit(process.exitCode ?? 0), 200);
}).catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});
