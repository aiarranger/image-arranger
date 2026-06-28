#!/usr/bin/env node
// Operator-specific ChatGPT queue processor for the existing Chrome profile.
// It intentionally does not launch Chrome, does not use CDP, and does not use
// Codex image generation. See skills/image-arranger-queue-processing/SKILL.md.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, join, resolve } from "node:path";
import * as chatgptMacRoute from "./chatgpt-route-macos.mjs";
import * as chatgptWindowsRoute from "./chatgpt-route-windows.mjs";
import {
  assertNoUserDataDirProcesses,
  assertRequiredChromeProfile,
  listChromeProfiles,
  printServiceProfileCandidates,
  readServiceProfileConfig,
  setupServiceChromeProfile,
} from "./service-browser-profile.mjs";
import {
  assertChromeRunning,
  assertSingleBridgeCandidateForProfile,
  findChromeTabByUrlPart,
  runChromeTabJsByUrlPart,
  usesChromeBridgeRoute,
} from "./service-browser-route.mjs";

const args = process.argv.slice(2);
const SERVER = option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217").replace(/\/$/, "");
const REQUEST_ID = option("--request", "");
const MAX_TARGETS = Number(option("--max", "1"));
const CHECK_ONLY = flag("--check");
const DRY_RUN = flag("--dry-run");
const ENSURE_TAB = flag("--ensure-tab");
const KEEP_MODAL = flag("--keep-modal");
const SETUP_PROFILE = flag("--setup-profile");
const LIST_PROFILES = flag("--list-profiles");
const PROFILE_CHOICE = option("--profile-choice", option("--choice", ""));
const PROFILE_CONFIG_PATH = resolve(option("--profile-config", "workspace/.local/chatgpt-profile.json"));

const CHATGPT_MARKER_BASE_URL = "https://chatgpt.com/";
const CHATGPT_MARKER_WORK = "image-arranger";
const CHATGPT_MARKER_BASE_PART = `agent-work=${CHATGPT_MARKER_WORK}`;
const DOWNLOAD_DIR = resolve(option("--download-dir", process.env.IMAGE_ARRANGER_CHATGPT_DOWNLOAD_DIR ?? join(homedir(), "Downloads")));
const DISALLOWED_PROFILE = join(homedir(), ".image-arranger", "agent-chrome");
const SERVICE = "chatgpt";
const SERVICE_LABEL = "ChatGPT";
let currentChatgptMarkerPart = CHATGPT_MARKER_BASE_PART;
let currentChatgptProfile = null;
let currentChatgptTabId = null;

if (flag("--help") || flag("-h")) {
  console.log(`Existing-profile ChatGPT queue processor.

Usage:
  node scripts/process-chatgpt-profile-queue.mjs --setup-profile
  node scripts/process-chatgpt-profile-queue.mjs --setup-profile --profile-choice <number>
  node scripts/process-chatgpt-profile-queue.mjs --list-profiles
  node scripts/process-chatgpt-profile-queue.mjs --check --ensure-tab
  node scripts/process-chatgpt-profile-queue.mjs --dry-run
  node scripts/process-chatgpt-profile-queue.mjs --request <requestId>
  node scripts/process-chatgpt-profile-queue.mjs

Options:
  --server <url>   image-arranger server (default ${SERVER})
  --request <id>   process one request id
  --max <n>        max targets to process (default 1)
  --check          verify the approved route preconditions only
  --ensure-tab     with --check, reuse the ChatGPT marker tab and verify login/composer
  --dry-run        list eligible queued ChatGPT image targets
  --keep-modal     leave the ChatGPT image modal open after saving
  --download-dir <dir>
                  normal Chrome download directory (default ${DOWNLOAD_DIR})
  --setup-profile  list Chrome profiles, let the operator choose, and save local config
  --profile-choice <n>
                  non-interactive selection for --setup-profile
  --list-profiles  print Chrome profile candidates and exit
  --profile-config <path>
                  local profile config path (default ${PROFILE_CONFIG_PATH})

Hard rules:
  - use only the locally selected existing Google Chrome profile
  - do not launch Chrome or Chromium
  - do not create service tabs; reuse the exact marker URL already open in the selected profile
  - do not use scripts/process-queue.mjs, CDP, file chooser, virtual PNG clipboard, or Codex image generation`);
  process.exit(0);
}

function flag(name) {
  return args.includes(name);
}

function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function slugify(value, fallback = "chatgpt-image") {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

async function api(path, body = null) {
  const response = await fetch(`${SERVER}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {});
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload;
}

function markerParamsForProfile(profile) {
  return new URLSearchParams({
    "agent-work": CHATGPT_MARKER_WORK,
    "profile-directory": profile.profileDir,
    "profile-email": profile.email,
  });
}

function markerUrlForProfile(profile) {
  const url = new URL(CHATGPT_MARKER_BASE_URL);
  url.search = markerParamsForProfile(profile).toString();
  return url.toString();
}

function markerPartForProfile(profile) {
  return markerParamsForProfile(profile).toString();
}

function runTabJs(targetPart, js, { activate = true, tabId = null } = {}) {
  return runChromeTabJsByUrlPart(targetPart, js, {
    activate,
    errorLabel: "ChatGPT tab",
    profile: currentChatgptProfile,
    profileConfigPath: PROFILE_CONFIG_PATH,
    tabId,
  });
}

function activeChatgptTargetPart(conversationPart = "") {
  return usesChromeBridgeRoute() ? currentChatgptMarkerPart : conversationPart;
}

function activeChatgptTabId() {
  return usesChromeBridgeRoute() ? currentChatgptTabId : null;
}

function runActiveChatgptJs(conversationPart, js, { activate = false } = {}) {
  return runTabJs(activeChatgptTargetPart(conversationPart), js, {
    activate,
    tabId: activeChatgptTabId(),
  });
}

function assertNoDisallowedChrome() {
  assertNoUserDataDirProcesses({
    label: "Rejected ChatGPT automation Chrome profile",
    rejectedPaths: [DISALLOWED_PROFILE],
  });
}

function printProfileCandidates(profiles = listChromeProfiles()) {
  printServiceProfileCandidates({
    service: SERVICE,
    serviceLabel: SERVICE_LABEL,
    profileConfigPath: PROFILE_CONFIG_PATH,
    profiles,
  });
}

function loadProfileConfig() {
  return readServiceProfileConfig({
    service: SERVICE,
    serviceLabel: SERVICE_LABEL,
    profileConfigPath: PROFILE_CONFIG_PATH,
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

function assertRequiredProfile(profileConfig) {
  return assertRequiredChromeProfile(profileConfig, {
    service: SERVICE,
    serviceLabel: SERVICE_LABEL,
  });
}

async function routePreflight({ ensureTab = false } = {}) {
  const profileConfig = loadProfileConfig();
  assertChromeRunning();
  assertNoDisallowedChrome();
  const approvedProfile = assertRequiredProfile(profileConfig);
  currentChatgptProfile = approvedProfile;
  assertSingleBridgeCandidateForProfile(approvedProfile);
  currentChatgptMarkerPart = markerPartForProfile(approvedProfile);
  const markerUrl = markerUrlForProfile(approvedProfile);
  const queue = await api("/api/requests");
  const result = {
    ok: true,
    server: SERVER,
    projectRoot: queue.projectRoot,
    requestCount: queue.requests?.length ?? 0,
    profileConfigPath: PROFILE_CONFIG_PATH,
    approvedProfile,
    markerUrl,
    markerTab: null,
  };
  if (ensureTab) {
    const existing = findChromeTabByUrlPart(currentChatgptMarkerPart, {
      activate: true,
      profile: approvedProfile,
      profileConfigPath: PROFILE_CONFIG_PATH,
    });
    if (!existing) {
      throw new Error(`ChatGPT marker tab was not found for the selected Chrome profile. Open this exact URL in ${approvedProfile.profileName} / ${approvedProfile.email}, then rerun. This script must not create tabs itself: ${markerUrl}.`);
    }
    currentChatgptTabId = existing.tabId ?? null;
    if (usesChromeBridgeRoute() && currentChatgptTabId == null) {
      throw new Error("ChatGPT marker tab was found through the Chrome bridge, but the bridge did not return tabId. Windows ChatGPT processing must stop because the tab cannot be followed after the marker URL changes to a conversation URL.");
    }
    try {
      result.markerTab = runTabJs(currentChatgptMarkerPart, `
      const body = document.body.innerText || "";
      const composer = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
      return {
        url: location.href,
        title: document.title,
        isAuthLogin: location.href.includes('/auth/login'),
        composerExists: Boolean(composer),
        bodyStart: body.slice(0, 120)
      };
      `, { tabId: currentChatgptTabId });
    } catch (error) {
      throw new Error(`ChatGPT marker tab was not found for the selected Chrome profile. Open this exact URL in ${approvedProfile.profileName} / ${approvedProfile.email}, then rerun. This script must not create tabs itself: ${markerUrl}. Original error: ${error.message}`);
    }
    if (result.markerTab.isAuthLogin || !result.markerTab.composerExists) {
      throw new Error(`ChatGPT marker tab is not ready: ${JSON.stringify(result.markerTab)}`);
    }
  }
  return result;
}

function eligibleTargets(queue) {
  return (queue.requests ?? [])
    .filter((row) => ["generate", "improve"].includes(row.action))
    .filter((row) => row.service === "chatgpt" || !row.service)
    .filter((row) => REQUEST_ID ? row.requestId === REQUEST_ID : true)
    .slice(0, MAX_TARGETS);
}

function cleanComposer() {
  return runTabJs(currentChatgptMarkerPart, `
    const isAttachmentLabel = (label) => {
      const value = label || '';
      return (value.includes('image(') && value.includes(').png'))
        || /\\.(png|jpe?g|webp|gif)\\b/i.test(value)
        || /uploaded image|open image|アップロード済み|添付済み/i.test(value);
    };
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const button of buttons) {
      const label = button.getAttribute('aria-label') || button.innerText || '';
      if (isAttachmentLabel(label) || (/delete|remove|削除/i.test(label) && /image|file|画像|ファイル/i.test(label))) {
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    }
    const ed = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
    if (!ed) return { ok: false, reason: 'no-composer', url: location.href, title: document.title };
    ed.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(ed);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    return {
      ok: true,
      url: location.href,
      title: document.title,
      composerTextLength: (ed.innerText || ed.textContent || '').length,
      deleteButtonCount: Array.from(document.querySelectorAll('button')).filter((button) => {
        const label = button.getAttribute('aria-label') || button.innerText || '';
        return isAttachmentLabel(label) || (/delete|remove|削除/i.test(label) && /image|file|画像|ファイル/i.test(label));
      }).length
    };
  `, { tabId: activeChatgptTabId() });
}

async function waitForNoAttachments(timeoutMs = 30000) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < timeoutMs) {
    state = runTabJs(currentChatgptMarkerPart, `
      const isAttachmentLabel = (label) => {
        const value = label || '';
        return (value.includes('image(') && value.includes(').png'))
          || /\\.(png|jpe?g|webp|gif)\\b/i.test(value)
          || /uploaded image|open image|アップロード済み|添付済み/i.test(value);
      };
      const labels = Array.from(document.querySelectorAll('button'))
        .map((button) => button.getAttribute('aria-label') || button.innerText || '');
      const attachmentLabels = labels.filter((label) => isAttachmentLabel(label)
        || (/delete|remove|削除/i.test(label) && /image|file|画像|ファイル/i.test(label)));
      return { attachmentCount: attachmentLabels.length, attachmentLabels };
    `, { activate: false, tabId: activeChatgptTabId() });
    if (state.attachmentCount === 0) return state;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for old ChatGPT attachments to clear: ${JSON.stringify(state)}`);
}

function attachReference(absPath) {
  if (usesChromeBridgeRoute()) {
    return chatgptWindowsRoute.attachReference({
      absPath,
      markerPart: currentChatgptMarkerPart,
      runTabJs,
      tabId: activeChatgptTabId(),
    });
  }
  return chatgptMacRoute.attachReference({
    absPath,
    markerPart: currentChatgptMarkerPart,
  });
}

async function waitForAttachmentCount(expectedCount, timeoutMs = 240000) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < timeoutMs) {
    state = runTabJs(currentChatgptMarkerPart, `
      const isAttachmentLabel = (label) => {
        const value = label || '';
        return (value.includes('image(') && value.includes(').png'))
          || /\\.(png|jpe?g|webp|gif)\\b/i.test(value)
          || /uploaded image|open image|アップロード済み|添付済み/i.test(value);
      };
      const composer = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
      const root = composer?.closest('form') || composer?.parentElement?.parentElement || document.body;
      const scopedButtons = Array.from(root.querySelectorAll('button'));
      const labels = scopedButtons.map((button) => button.getAttribute('aria-label') || button.innerText || '');
      const deleteButtons = labels
        .filter((label) => isAttachmentLabel(label) || (/delete|remove|削除/i.test(label) && /image|file|画像|ファイル/i.test(label)));
      const uploadedImageButtons = labels
        .filter((label) => /uploaded image|open image|アップロード済み|添付済み/i.test(label));
      const thumbnailImages = Array.from(root.querySelectorAll('img'))
        .filter((img) => {
          const src = img.currentSrc || img.src || '';
          const alt = img.alt || '';
          const rect = img.getBoundingClientRect();
          return rect.width > 20 && rect.height > 20
            && (src.startsWith('blob:') || src.startsWith('data:') || /\\.(png|jpe?g|webp|gif)\\b/i.test(alt));
        });
      const send = document.querySelector('[data-testid="send-button"]');
      return {
        attachmentCount: Math.max(deleteButtons.length, uploadedImageButtons.length, thumbnailImages.length),
        deleteButtonCount: deleteButtons.length,
        deleteButtons,
        uploadedImageButtons,
        thumbnailImageCount: thumbnailImages.length,
        sendDisabled: send ? (send.disabled || send.getAttribute('aria-disabled') === 'true') : null
      };
    `, { activate: false, tabId: activeChatgptTabId() });
    if (state.attachmentCount >= expectedCount) return state;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${expectedCount} ChatGPT attachment(s): ${JSON.stringify(state)}`);
}

function insertPrompt(prompt) {
  return runTabJs(currentChatgptMarkerPart, `
    const expected = ${JSON.stringify(prompt)};
    const ed = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
    if (!ed) return { ok: false, reason: 'no-composer' };
    ed.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(ed);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, expected);
    const innerText = ed.innerText || '';
    const textContent = ed.textContent || '';
    const normalizedInnerText = innerText.replace(/\\n{3,}/g, '\\n\\n');
    const send = document.querySelector('[data-testid="send-button"]');
    return {
      ok: normalizedInnerText === expected || innerText === expected || textContent === expected,
      innerTextLength: innerText.length,
      textContentLength: textContent.length,
      expectedLength: expected.length,
      normalizedInnerTextEqual: normalizedInnerText === expected,
      startsCorrect: normalizedInnerText.startsWith(expected.slice(0, 80)),
      endsCorrect: normalizedInnerText.endsWith(expected.slice(-80)),
      sendDisabled: send ? (send.disabled || send.getAttribute('aria-disabled') === 'true') : null
    };
  `, { tabId: activeChatgptTabId() });
}

async function waitForSendReady(prompt, timeoutMs = 120000) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < timeoutMs) {
    state = runTabJs(currentChatgptMarkerPart, `
      const expected = ${JSON.stringify(prompt)};
      const ed = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
      const send = document.querySelector('[data-testid="send-button"]');
      if (!ed) return { ok: false, reason: 'no-composer' };
      const innerText = ed.innerText || '';
      const textContent = ed.textContent || '';
      const normalizedInnerText = innerText.replace(/\\n{3,}/g, '\\n\\n');
      return {
        ok: normalizedInnerText === expected || innerText === expected || textContent === expected,
        innerTextLength: innerText.length,
        textContentLength: textContent.length,
        expectedLength: expected.length,
        sendDisabled: send ? (send.disabled || send.getAttribute('aria-disabled') === 'true') : null,
        sendExists: Boolean(send),
        uploadTextPresent: /アップロード中|Uploading|処理中|Processing/i.test(document.body.innerText || '')
      };
    `, { activate: false, tabId: activeChatgptTabId() });
    if (!state.ok) throw new Error(`Prompt changed while waiting to send: ${JSON.stringify(state)}`);
    if (state.sendExists && !state.sendDisabled) return state;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ChatGPT send button to enable: ${JSON.stringify(state)}`);
}

async function sendPrompt() {
  if (usesChromeBridgeRoute()) {
    return chatgptWindowsRoute.sendPrompt({
      markerPart: currentChatgptMarkerPart,
      runTabJs,
      tabId: activeChatgptTabId(),
      sleep,
    });
  }
  return chatgptMacRoute.sendPrompt({
    markerPart: currentChatgptMarkerPart,
  });
}

async function waitForGeneratedImage(conversationPart, timeoutMs = 15 * 60 * 1000) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < timeoutMs) {
    state = runActiveChatgptJs(conversationPart, `
      const isUploadedImageAlt = (alt) => {
        const value = (alt || '').trim();
        return value.startsWith('image(') && value.endsWith(').png') && value.length <= 32;
      };
      const body = document.body.innerText || '';
      const generated = Array.from(document.querySelectorAll('img')).map((img, index) => {
        const rect = img.getBoundingClientRect();
        return {
          index,
          alt: img.alt || '',
          src: (img.currentSrc || img.src || '').slice(0, 180),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          area: Math.round(rect.width * rect.height),
          visible: rect.width > 40 && rect.height > 40
        };
      }).filter((img) => img.visible
        && img.src.includes('/backend-api/estuary/content')
        && img.naturalWidth > 256
        && img.naturalHeight > 256
        && img.alt
        && !isUploadedImageAlt(img.alt));
      return {
        url: location.href,
        title: document.title,
        hasStopButton: Boolean(document.querySelector('[data-testid="stop-button"]')),
        generatedCount: generated.length,
        generated,
        refused: /申し訳|できません|I can.?t|cannot|policy|ポリシー/i.test(body.slice(-2000)),
        bodyTail: body.slice(-500)
      };
    `, { activate: false });
    if (!state.hasStopButton && state.generatedCount > 0) return state;
    if (!state.hasStopButton && state.refused && state.generatedCount === 0) {
      throw new Error(`ChatGPT appears to have refused or errored: ${state.bodyTail}`);
    }
    await sleep(30000);
  }
  throw new Error(`Timed out waiting for ChatGPT generated image: ${JSON.stringify(state)}`);
}

function listDownloadImages() {
  if (!existsSync(DOWNLOAD_DIR)) return [];
  return readdirSync(DOWNLOAD_DIR)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .map((name) => {
      const file = join(DOWNLOAD_DIR, name);
      const stat = statSync(file);
      return { file, mtimeMs: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function saveGeneratedImage(conversationPart) {
  const before = Date.now();
  const opened = runActiveChatgptJs(conversationPart, `
    const isUploadedImageAlt = (alt) => {
      const value = (alt || '').trim();
      return value.startsWith('image(') && value.endsWith(').png') && value.length <= 32;
    };
    const candidates = Array.from(document.querySelectorAll('img')).map((img) => {
      const rect = img.getBoundingClientRect();
      return { img, rect, area: rect.width * rect.height };
    }).filter(({ img, rect }) => rect.width > 40
      && rect.height > 40
      && (img.currentSrc || img.src || '').includes('/backend-api/estuary/content')
      && img.naturalWidth > 256
      && img.naturalHeight > 256
      && img.alt
      && !isUploadedImageAlt(img.alt))
      .sort((a, b) => b.area - a.area);
    if (!candidates.length) return { ok: false, reason: 'generated-image-not-found' };
    candidates[0].img.scrollIntoView({ block: 'center', inline: 'center' });
    candidates[0].img.click();
    return { ok: true, alt: candidates[0].img.alt, width: candidates[0].img.naturalWidth, height: candidates[0].img.naturalHeight };
  `);
  if (!opened.ok) throw new Error(`Could not open generated image: ${JSON.stringify(opened)}`);
  await sleep(1200);
  const saved = runActiveChatgptJs(conversationPart, `
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveCandidates = buttons.map((button) => {
      const label = (button.getAttribute('aria-label') || button.innerText || '').trim();
      const rect = button.getBoundingClientRect();
      return { button, label, rect };
    }).filter(({ label }) => /^(保存|Save|Download|ダウンロード)$/i.test(label));
    const save = saveCandidates.find(({ rect }) => rect.width > 0 && rect.height > 0) ?? saveCandidates[0];
    if (!save) {
      return { ok: false, labels: buttons.map((button) => button.getAttribute('aria-label') || button.innerText || '').filter(Boolean).slice(-40) };
    }
    save.button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    save.button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    save.button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return {
      ok: true,
      label: save.label,
      width: Math.round(save.rect.width),
      height: Math.round(save.rect.height)
    };
  `);
  if (!saved.ok) throw new Error(`Could not click ChatGPT save button: ${JSON.stringify(saved)}`);
  let found = null;
  for (let i = 0; i < 30; i += 1) {
    found = listDownloadImages().find((item) => item.mtimeMs >= before - 2000 && item.size > 0);
    if (found) break;
    await sleep(1000);
  }
  if (!found) throw new Error("ChatGPT save did not create a new image file in Downloads");
  if (!KEEP_MODAL) {
    runActiveChatgptJs(conversationPart, `
      const close = Array.from(document.querySelectorAll('button')).find((button) => (button.getAttribute('aria-label') || '') === '全画面表示を閉じる');
      if (close) close.click();
      return { closed: Boolean(close) };
    `, { activate: false });
  }
  return { downloaded: found, opened, saved };
}

function resolveProjectPath(projectRoot, file) {
  return isAbsolute(file) ? file : resolve(projectRoot, file);
}

function uniqueOutputPath(projectRoot, target, downloadedFile) {
  const outputDir = target.outputDir || "workspace/sample/outputs";
  const absOutputDir = resolveProjectPath(projectRoot, outputDir);
  mkdirSync(absOutputDir, { recursive: true });
  const extension = extname(downloadedFile) || ".png";
  const base = slugify(target.overview || target.entryId || "chatgpt-image");
  const fileName = `${base}-chatgpt-${timestampForFile()}${extension}`;
  return {
    abs: join(absOutputDir, fileName),
    rel: `${outputDir.replace(/\/$/, "")}/${fileName}`,
  };
}

async function processTarget(queue, target) {
  const projectRoot = queue.projectRoot;
  const refs = target.inputs?.refImages ?? [];
  if (refs.length > 2) throw new Error(`Too many reference images for this route (${refs.length}); ask the operator to reduce them`);

  console.log(`[${target.requestId}:${target.targetIndex}] prepare ChatGPT tab`);
  await routePreflight({ ensureTab: true });
  const cleaned = cleanComposer();
  if (!cleaned.ok) throw new Error(`Could not clean composer: ${JSON.stringify(cleaned)}`);
  await waitForNoAttachments();

  let expectedAttachments = 0;
  for (const ref of refs) {
    const abs = resolveProjectPath(projectRoot, ref);
    if (!existsSync(abs)) throw new Error(`Reference image does not exist: ${abs}`);
    expectedAttachments += 1;
    console.log(`[${target.requestId}:${target.targetIndex}] attach ${ref}`);
    attachReference(abs);
    await waitForAttachmentCount(expectedAttachments);
  }

  const promptState = insertPrompt(target.prompt ?? "");
  if (!promptState.ok) {
    throw new Error(`Prompt was not verified before send: ${JSON.stringify(promptState)}`);
  }
  const sendReady = promptState.sendDisabled
    ? await waitForSendReady(target.prompt ?? "")
    : promptState;
  if (sendReady.sendDisabled) {
    throw new Error(`ChatGPT send button stayed disabled before send: ${JSON.stringify(sendReady)}`);
  }
  console.log(`[${target.requestId}:${target.targetIndex}] prompt verified, sending`);
  const sent = await sendPrompt();
  if (!sent.url || !sent.url.includes("/c/")) throw new Error(`Could not confirm sent ChatGPT conversation: ${JSON.stringify(sent)}`);
  const conversationPart = sent.url.split("/c/")[1]?.split(/[?#]/)[0] ?? sent.url;

  console.log(`[${target.requestId}:${target.targetIndex}] waiting for generated image in ${sent.url}`);
  const generated = await waitForGeneratedImage(conversationPart);
  console.log(`[${target.requestId}:${target.targetIndex}] generated image ready (${generated.generatedCount})`);

  const saveResult = await saveGeneratedImage(conversationPart);
  const output = uniqueOutputPath(projectRoot, target, saveResult.downloaded.file);
  copyFileSync(saveResult.downloaded.file, output.abs);
  console.log(`[${target.requestId}:${target.targetIndex}] saved ${output.rel}`);

  const complete = await api("/api/requests/complete", {
    requestId: target.requestId,
    targetIndex: target.targetIndex,
    results: [{ file: output.rel }],
  });
  console.log(`[${target.requestId}:${target.targetIndex}] complete ok; queue remaining ${(complete.requests ?? []).length}`);
  return { target, output, saveResult, complete };
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

  if (CHECK_ONLY) {
    const preflight = await routePreflight({ ensureTab: ENSURE_TAB });
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  const queue = await api("/api/requests");
  const targets = eligibleTargets(queue);
  if (DRY_RUN) {
    console.log(JSON.stringify({
      server: SERVER,
      projectRoot: queue.projectRoot,
      eligibleCount: targets.length,
      targets: targets.map((row) => ({
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        action: row.action,
        service: row.service,
        overview: row.overview,
        refs: row.inputs?.refImages ?? [],
        outputDir: row.outputDir,
      })),
    }, null, 2));
    return;
  }
  if (!targets.length) {
    console.log(JSON.stringify({ ok: true, message: "No eligible queued ChatGPT image targets", server: SERVER }, null, 2));
    return;
  }
  const results = [];
  for (const target of targets) {
    results.push(await processTarget(queue, target));
  }
  console.log(JSON.stringify({
    ok: true,
    processed: results.map(({ target, output }) => ({
      requestId: target.requestId,
      targetIndex: target.targetIndex,
      file: output.rel,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
