#!/usr/bin/env node
// Scripted Vidu queue processor: takes queued video targets from a running
// image-arranger server, drives Vidu's normal web UI over CDP, downloads the
// generated MP4 export, registers it as an asset candidate, and reports
// completion back to image-arranger.

if (typeof WebSocket === "undefined") {
  console.error("scripts/process-vidu-queue.mjs needs Node 22+ (global WebSocket). The server itself runs on Node 20+.");
  process.exit(1);
}

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import {
  DEFAULTS, RunLog, ensureChrome, openPage, closePage, evaluate, waitFor, sleep,
} from "./agent-browser.mjs";

const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const HELP = `Scripted Vidu queue processor — drives Vidu's web UI over CDP to
fulfill queued video-generation targets from a running image-arranger server.

Usage:
  node scripts/process-vidu-queue.mjs --check
  node scripts/process-vidu-queue.mjs
  node scripts/process-vidu-queue.mjs --request <id>
  node scripts/process-vidu-queue.mjs --dry-run

Options:
  --server <url>       image-arranger server (default http://127.0.0.1:4217, $IMAGE_ARRANGER_SERVER)
  --cdp-port <n>       automation Chrome CDP port (default ${DEFAULTS.cdpPort})
  --vidu-url <url>     Vidu create page (default https://www.vidu.com/ja/create/img2video)
  --max <n>            cap targets processed (default 20)
  --timeout-min <n>    generation wait timeout per target (default 25)
  --allow-paid         allow submitting when Vidu's create button shows a non-zero credit cost
  --keep-tabs          leave Vidu tabs open for inspection
  --help, -h           show this help and exit`;

if (flag("--help") || flag("-h")) {
  console.log(HELP);
  process.exit(0);
}

const SERVER = (option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217")).replace(/\/$/, "");
const CDP_PORT = Number(option("--cdp-port", DEFAULTS.cdpPort));
const VIDU_URL = option("--vidu-url", process.env.IMAGE_ARRANGER_VIDU_URL ?? "https://www.vidu.com/ja/create/img2video");
const MAX_TARGETS = Number(option("--max", "20"));
const TIMEOUT_MS = Math.max(1, Number(option("--timeout-min", "25")) || 25) * 60 * 1000;
const ALLOW_PAID = flag("--allow-paid") || process.env.IMAGE_ARRANGER_VIDU_ALLOW_PAID === "1";

async function api(path, body = null) {
  const response = await fetch(`${SERVER}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  return payload;
}

function slugify(value, fallback = "output") {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || fallback;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

function relPath(projectRoot, file) {
  return file.startsWith(projectRoot) ? file.slice(projectRoot.length + 1) : file;
}

function isViduTarget(row) {
  return row.action === "generate" && (
    row.service === "vidu"
    || row.mode === "video"
    || Boolean(row.inputs?.endFrame)
  );
}

function resolveProjectFile(projectRoot, file) {
  if (!file) return "";
  return isAbsolute(file) ? file : resolve(projectRoot, file);
}

async function openViduPage() {
  const page = await openPage(VIDU_URL, { cdpPort: CDP_PORT });
  await waitFor(page, "document.readyState === \"complete\"", { timeoutMs: 30000, label: "Vidu page load" });
  await sleep(8000);
  return page;
}

async function closeTopBanner(page) {
  await evaluate(page, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => /^(Close|閉じる)$/i.test(item.getAttribute('aria-label') || item.innerText.trim()));
    if (!button) return false;
    button.click();
    return true;
  })()`).catch(() => false);
}

async function viduState(page) {
  return evaluate(page, `(() => {
    const body = document.body?.innerText ?? "";
    const submit = document.querySelector('[data-testid="form-submit-button"]');
    const videos = [...document.querySelectorAll('video')]
      .map((video) => video.currentSrc || video.src || "")
      .filter((src) => src && /\\.mp4(\\?|$)/i.test(src));
    return {
      url: location.href,
      title: document.title,
      body: body.replace(/\\s+/g, " ").slice(0, 3000),
      fileInputs: document.querySelectorAll('input[type=file]').length,
      uploadPreviews: [...document.querySelectorAll('img[alt="upload preview"]')].length,
      textareaCount: document.querySelectorAll('textarea').length,
      submitText: (submit?.innerText ?? "").replace(/\\s+/g, " ").trim(),
      submitDisabled: !submit || submit.disabled || submit.getAttribute("aria-disabled") === "true",
      videos,
    };
  })()`);
}

async function checkViduLogin(page) {
  const state = await viduState(page);
  if (state.fileInputs > 0 && state.textareaCount > 0 && /作成|Create|Generate/i.test(state.body)) return { status: "ok", state };
  if (/ログイン|Sign in|Log in|Login/i.test(state.body)) return { status: "logged-out", state };
  return { status: "unknown", state };
}

async function uploadFrames(page, files) {
  if (files.length !== 2) throw new Error(`Vidu start/end generation needs exactly 2 frames; got ${files.length}`);
  const { root } = await page.send("DOM.getDocument", { depth: 1 });
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type=file]' });
  if (!nodeId) throw new Error("Vidu file input was not found");
  await page.send("DOM.setFileInputFiles", { nodeId, files });
  await waitFor(
    page,
    `(() => {
      const body = document.body?.innerText ?? "";
      const previews = document.querySelectorAll('img[alt="upload preview"]').length;
      const framePairReady = previews >= 2 || /フレーム\\s*1\\s*-\\s*フレーム\\s*2|Frame\\s*1\\s*-\\s*Frame\\s*2/i.test(body);
      return framePairReady && !/アップロード中|Uploading/i.test(body);
    })()`,
    { timeoutMs: 180000, intervalMs: 1000, label: "Vidu start/end frame upload completion" },
  );
  await sleep(1500);
}

const FIRE_POINTER_SEQUENCE = `(el) => {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    const Ctor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, buttons: 1, pointerId: 1 }));
  }
}`;

async function setDurationIfAvailable(page, durationSec) {
  if (!durationSec) return { status: "skipped" };
  const want = String(Number(durationSec));
  const opened = await evaluate(page, `(() => {
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
  })()`);
  if (opened.status !== "opened") return opened;

  try {
    await waitFor(
      page,
      `document.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item]').length > 0`,
      { timeoutMs: 6000, label: "Vidu duration menu" },
    );
  } catch {
    return { status: "unavailable", reason: "duration menu did not open", current: opened.current };
  }

  const picked = await evaluate(page, `(() => {
    const want = ${JSON.stringify(want)};
    const normalize = (text) => (text || "").replace(/\\s+/g, " ").trim();
    const items = [...document.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item]')];
    const item = items.find((el) => new RegExp("^" + want + "\\\\s*(秒|s)?$", "i").test(normalize(el.innerText)));
    if (!item) return { status: "not-found", seen: items.map((el) => normalize(el.innerText)).filter(Boolean).slice(0, 20) };
    (${FIRE_POINTER_SEQUENCE})(item);
    return { status: "picked", text: normalize(item.innerText) };
  })()`);
  await sleep(700);
  return picked;
}

async function setViduPrompt(page, prompt) {
  const written = await evaluate(page, `(() => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return null;
    textarea.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (setter) setter.call(textarea, ${JSON.stringify(prompt)});
    else textarea.value = ${JSON.stringify(prompt)};
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return textarea.value;
  })()`);
  if (written == null) throw new Error("Vidu prompt textarea was not found");
  const normalize = (value) => String(value).replace(/\s+/g, " ").trim();
  if (!normalize(written).startsWith(normalize(prompt).slice(0, 80))) {
    throw new Error(`Vidu prompt mismatch after insert: "${String(written).slice(0, 120)}"`);
  }
}

function visibleCreditCost(text) {
  const numbers = String(text).match(/\b\d+\b/g) ?? [];
  if (!numbers.length) return 0;
  return Number(numbers[numbers.length - 1]) || 0;
}

async function clickCreate(page) {
  const state = await waitFor(
    page,
    `(() => {
      const button = document.querySelector('[data-testid="form-submit-button"]');
      if (!button) return false;
      const text = (button.innerText || "").replace(/\\s+/g, " ").trim();
      const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
      const uploading = /アップロード中|Uploading/i.test(document.body?.innerText ?? "");
      return !disabled && !uploading ? { ok: true, text } : false;
    })()`,
    { timeoutMs: 120000, intervalMs: 1000, label: "Vidu create button enabled" },
  ).catch(async () => {
    const current = await evaluate(page, `(() => {
      const button = document.querySelector('[data-testid="form-submit-button"]');
      if (!button) return { ok: false, reason: "submit button not found" };
      const text = (button.innerText || "").replace(/\\s+/g, " ").trim();
      const disabled = button.disabled || button.getAttribute("aria-disabled") === "true";
      const uploading = /アップロード中|Uploading/i.test(document.body?.innerText ?? "");
      return { ok: false, reason: uploading ? "uploads are still pending" : disabled ? "submit button is disabled" : "submit button did not become ready", text };
    })()`);
    return current;
  });
  if (!state.ok) throw new Error(`Vidu create button unavailable: ${state.reason}${state.text ? ` (${state.text})` : ""}`);
  const cost = visibleCreditCost(state.text);
  if (cost > 0 && !ALLOW_PAID) {
    throw new Error(`Vidu create button shows a non-zero credit cost (${state.text}). Rerun with --allow-paid if this is intended.`);
  }
  const clicked = await evaluate(page, `(() => {
    const button = document.querySelector('[data-testid="form-submit-button"]');
    if (!button) return false;
    button.scrollIntoView({ block: "center", inline: "center" });
    (${FIRE_POINTER_SEQUENCE})(button);
    return true;
  })()`);
  if (!clicked) throw new Error("Vidu create button disappeared before click");
  return state;
}

async function waitForNewVideo(page, beforeVideos, { onTick = null } = {}) {
  const before = new Set(beforeVideos);
  const startedAt = Date.now();
  let lastBeat = 0;
  let lastReload = 0;
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const state = await viduState(page);
    const fresh = state.videos.filter((src) => !before.has(src) && !src.startsWith("blob:"));
    if (fresh.length) return { status: "video", src: fresh[0], state };
    if (/生成に失敗|失敗しました|Failed|error|insufficient|クレジット不足|policy|規約違反/i.test(state.body)) {
      return { status: "error", message: state.body.slice(0, 500), state };
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (onTick && elapsed - lastBeat >= 30) {
      lastBeat = elapsed;
      onTick(elapsed, state);
    }
    if (elapsed >= 180 && state.videos.length === 0 && elapsed - lastReload >= 120) {
      lastReload = elapsed;
      await page.send("Page.reload", { ignoreCache: true });
      await waitFor(page, "document.readyState === \"complete\"", { timeoutMs: 30000, label: "Vidu reload after empty history" }).catch(() => {});
      await sleep(8000);
    }
    await sleep(10000);
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
  if (buffer.length < 100000) throw new Error(`Vidu MP4 download was suspiciously small (${buffer.length} bytes)`);
  writeFileSync(destination, buffer);
  return { bytes: buffer.length };
}

async function main() {
  const queue = await api("/api/requests");
  const projectRoot = queue.projectRoot;
  const runLog = new RunLog(join(projectRoot, "agent-logs"), `vidu-run-${timestamp()}`);
  runLog.log(`server ${SERVER}, projectRoot ${projectRoot}`);
  runLog.log(`Vidu URL ${VIDU_URL}`);
  runLog.log(`run log: ${runLog.dir}`);

  const all = queue.requests ?? [];
  const wanted = all
    .filter((row) => option("--request") ? row.requestId === option("--request") : true)
    .filter(isViduTarget)
    .slice(0, MAX_TARGETS);
  const skipped = all.filter((row) => !wanted.includes(row));
  for (const row of skipped) {
    runLog.log(`skipping ${row.requestId}[${row.targetIndex}] (action=${row.action}, service=${row.service})`, "warn");
  }
  runLog.log(`${wanted.length} vidu video target(s) to process`);
  if (flag("--dry-run")) {
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

  const chrome = await ensureChrome({ cdpPort: CDP_PORT, log: (message) => runLog.log(message) });
  runLog.log(`automation Chrome ready (${chrome.alreadyRunning ? "already running" : "launched"}): ${chrome.version?.Browser ?? ""}`);

  {
    const page = await openViduPage();
    try {
      await closeTopBanner(page);
      const login = await checkViduLogin(page);
      await runLog.shot(page, "vidu-login-check");
      runLog.attachJson("vidu check state", login.state);
      if (login.status !== "ok") {
        runLog.log(`Vidu is not ready (state: ${login.status}). Sign in to Vidu in the automation Chrome window, then rerun.`, "error");
        console.error("\n>>> Sign in to Vidu in the automation Chrome window, then rerun this script. <<<\n");
        process.exitCode = 2;
        return;
      }
      runLog.log("Vidu login/create page OK");
    } finally {
      await closePage(page);
    }
  }
  if (flag("--check")) {
    runLog.log("--check finished: Chrome + Vidu page are ready");
    return;
  }

  const summary = [];

  async function processTarget(row) {
    const tag = row.entryId;
    runLog.section(`${row.requestId}[${row.targetIndex}] ${row.overview ?? row.entryId}`);
    runLog.attachJson(`target ${tag}`, row);

    const startFrame = resolveProjectFile(projectRoot, row.inputs?.startFrame);
    const endFrame = resolveProjectFile(projectRoot, row.inputs?.endFrame);
    if (!startFrame || !endFrame) throw new Error("Vidu target is missing inputs.startFrame or inputs.endFrame");
    const outputDir = resolve(projectRoot, row.outputDir || "outputs");
    mkdirSync(outputDir, { recursive: true });
    const fileBase = `${slugify(row.entryId.replace(/^video-/, ""), row.entryId)}-${timestamp()}`;
    const destination = join(outputDir, `${fileBase}.mp4`);

    const page = await openViduPage();
    try {
      await closeTopBanner(page);
      const before = await viduState(page);
      runLog.attachJson(`before ${tag}`, before);
      const beforeVideos = before.videos ?? [];
      runLog.log(`[${tag}] Vidu page opened; ${beforeVideos.length} existing video(s) visible`);

      await uploadFrames(page, [startFrame, endFrame]);
      runLog.log(`[${tag}] uploaded start/end frames`);
      await runLog.shot(page, `uploaded-${tag}`);

      const duration = await setDurationIfAvailable(page, row.inputs?.durationSec);
      runLog.attachJson(`duration ${tag}`, duration);
      if (duration.status === "picked" || duration.status === "already") {
        runLog.log(`[${tag}] duration: ${duration.text ?? duration.current}`);
      } else if (row.inputs?.durationSec) {
        runLog.log(`[${tag}] could not set duration ${row.inputs.durationSec}s (${duration.status}); relying on the prompt/default`, "warn");
      }

      await setViduPrompt(page, row.prompt);
      runLog.log(`[${tag}] prompt inserted and verified`);
      await runLog.shot(page, `before-create-${tag}`);

      const submit = await clickCreate(page);
      runLog.log(`[${tag}] Vidu create submitted (${submit.text || "no visible cost text"})`);
      const reply = await waitForNewVideo(page, beforeVideos, {
        onTick: (elapsed, state) => runLog.log(
          `[${tag}] waiting ${elapsed}s — videos:${state.videos.length} submit:${state.submitText || "(none)"}`,
        ),
      });
      await runLog.shot(page, `vidu-result-${tag}`);
      if (reply.status !== "video") {
        const message = reply.status === "timeout" ? "Vidu generation timed out" : `Vidu generation failed: ${reply.message}`;
        throw new Error(message);
      }

      const saved = await downloadVideo(reply.src, destination);
      runLog.log(`[${tag}] video saved: ${destination} (${Math.round(saved.bytes / 1024)} KB)`);
      const relFile = relPath(projectRoot, destination);
      const registered = await api("/api/assets", {
        characterId: row.characterId,
        entryId: row.entryId,
        sourceFile: relFile,
        name: basename(destination, ".mp4"),
        prompt: row.prompt,
        aiGenerated: true,
        humanReviewed: false,
        adopted: false,
        usageNotes: "Generated by Vidu web app via scripts/process-vidu-queue.mjs.",
      });
      runLog.log(`[${tag}] registered as asset candidate: ${registered.asset?.id} -> ${registered.asset?.file}`);
      await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        results: [{ file: relFile, prompt: row.prompt }],
      });
      runLog.log(`[${tag}] reported completed via /api/requests/complete`);
      return {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        entryId: row.entryId,
        status: "completed",
        file: relFile,
        asset: registered.asset?.id,
      };
    } finally {
      if (!flag("--keep-tabs")) await closePage(page);
    }
  }

  for (const row of wanted) {
    try {
      summary.push(await processTarget(row));
    } catch (error) {
      runLog.log(`[${row.entryId}] failed: ${error.message}`, "error");
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
    runLog.log(`${item.status === "completed" ? "completed" : "error"} ${item.requestId}[${item.targetIndex}] ${item.entryId} ${item.file ?? item.message ?? ""}`);
  }
  console.log(`\nRun log: ${runLog.dir}/log.md`);
  if (summary.some((item) => item.status === "error")) process.exitCode = 1;
}

main().then(() => {
  setTimeout(() => process.exit(process.exitCode ?? 0), 200);
}).catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});
