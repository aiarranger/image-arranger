// Agent browser driver: drives a dedicated automation Chrome over the DevTools
// protocol (CDP). No clipboard, no synthetic keystrokes, no OS accessibility
// permissions — attachments use DOM.setFileInputFiles and every step is
// verified against the live DOM.
//
// The automation Chrome uses its own user-data-dir (default
// ~/.image-arranger/agent-chrome), so it never touches the user's main
// browser profile. One-time setup: run `node scripts/process-queue.mjs --check`
// and sign in to the generation service in the window that opens.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export const DEFAULTS = {
  cdpPort: 9377,
  profileDir: join(homedir(), ".image-arranger", "agent-chrome"),
  chatUrl: "https://chatgpt.com/",
};

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${url} -> HTTP ${response.status}`);
  return response.json();
}

// ---------------------------------------------------------------------------
// Run logger: writes log.md + events.jsonl + numbered screenshots into one
// folder per run, so the operator can review everything without transcripts.
// ---------------------------------------------------------------------------

export class RunLog {
  constructor(rootDir, runName) {
    this.dir = join(rootDir, runName);
    this.shotsDir = join(this.dir, "shots");
    mkdirSync(this.shotsDir, { recursive: true });
    this.logFile = join(this.dir, "log.md");
    this.eventsFile = join(this.dir, "events.jsonl");
    this.shotCount = 0;
    writeFileSync(this.logFile, `# Agent run ${runName}\n\n`);
    writeFileSync(this.eventsFile, "");
  }

  log(message, level = "info") {
    const stamp = new Date().toISOString();
    const line = `- \`${stamp}\` ${level === "error" ? "❌ " : level === "warn" ? "⚠️ " : ""}${message}`;
    appendFileSync(this.logFile, `${line}\n`);
    appendFileSync(this.eventsFile, `${JSON.stringify({ at: stamp, level, message })}\n`);
    console.log(`[${level}] ${message}`);
  }

  section(title) {
    appendFileSync(this.logFile, `\n## ${title}\n\n`);
    appendFileSync(this.eventsFile, `${JSON.stringify({ at: new Date().toISOString(), level: "section", message: title })}\n`);
    console.log(`\n=== ${title} ===`);
  }

  attachJson(label, value) {
    appendFileSync(this.logFile, `<details><summary>${label}</summary>\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n</details>\n`);
  }

  async shot(page, label) {
    try {
      const { data } = await page.send("Page.captureScreenshot", { format: "png" });
      this.shotCount += 1;
      const name = `${String(this.shotCount).padStart(3, "0")}-${label.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60)}.png`;
      writeFileSync(join(this.shotsDir, name), Buffer.from(data, "base64"));
      appendFileSync(this.logFile, `\n![${label}](shots/${name})\n`);
      return name;
    } catch (error) {
      this.log(`screenshot failed (${label}): ${error.message}`, "warn");
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal CDP client over the WebSocket global (Node 22+).
// ---------------------------------------------------------------------------

export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Map();
    ws.addEventListener("close", () => {
      for (const { reject: rejectCall } of this.pending.values()) {
        rejectCall(new Error("CDP WebSocket closed (tab gone or Chrome quit)"));
      }
      this.pending.clear();
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: resolveCall, reject: rejectCall } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) rejectCall(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ""}`));
        else resolveCall(message.result);
      } else if (message.method) {
        for (const handler of this.eventHandlers.get(message.method) ?? []) handler(message.params);
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      ws.addEventListener("open", resolveOpen, { once: true });
      ws.addEventListener("error", () => rejectOpen(new Error(`WebSocket connect failed: ${wsUrl}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
    });
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, []);
    this.eventHandlers.get(method).push(handler);
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

// ---------------------------------------------------------------------------
// Automation Chrome lifecycle.
// ---------------------------------------------------------------------------

function chromePath() {
  const fromEnv = process.env.IMAGE_ARRANGER_CHROME;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome executable was not found; set IMAGE_ARRANGER_CHROME to its path");
}

export async function ensureChrome({ cdpPort = DEFAULTS.cdpPort, profileDir = DEFAULTS.profileDir, log = console.log } = {}) {
  const versionUrl = `http://127.0.0.1:${cdpPort}/json/version`;
  try {
    const version = await httpJson(versionUrl);
    return { alreadyRunning: true, version };
  } catch {
    // not running yet
  }
  mkdirSync(profileDir, { recursive: true });
  const executable = chromePath();
  log(`launching automation Chrome: ${executable} (profile ${profileDir}, CDP ${cdpPort})`);
  spawn(executable, [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${cdpPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    "--window-size=1480,980",
    "about:blank",
  ], { detached: true, stdio: "ignore" }).unref();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);
    try {
      const version = await httpJson(versionUrl);
      return { alreadyRunning: false, version };
    } catch {
      // keep waiting
    }
  }
  throw new Error(`automation Chrome did not expose CDP on port ${cdpPort} within 20s`);
}

export async function openPage(url, { cdpPort = DEFAULTS.cdpPort } = {}) {
  let info;
  try {
    info = await httpJson(`http://127.0.0.1:${cdpPort}/json/new`, { method: "PUT" });
  } catch {
    info = await httpJson(`http://127.0.0.1:${cdpPort}/json/new`);
  }
  const page = await Cdp.connect(info.webSocketDebuggerUrl);
  page.targetId = info.id;
  page.cdpPort = cdpPort;
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Page.navigate", { url });
  return page;
}

export async function closePage(page) {
  try {
    await httpJson(`http://127.0.0.1:${page.cdpPort}/json/close/${page.targetId}`);
  } catch {
    // tab already gone
  }
  page.close();
}

export async function evaluate(page, expression, { awaitPromise = false } = {}) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(`page JS failed: ${detail}`);
  }
  return result.result?.value;
}

export async function waitFor(page, expression, { timeoutMs = 30000, intervalMs = 500, label = expression } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(page, expression);
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting for: ${label}`);
}

// ---------------------------------------------------------------------------
// ChatGPT page driver. Selectors are centralized here so a UI change needs a
// one-place fix; every step verifies its own outcome via the DOM.
// ---------------------------------------------------------------------------

const COMPOSER = `document.querySelector('#prompt-textarea') ?? document.querySelector('main div[contenteditable="true"]')`;

export async function openChat({ cdpPort = DEFAULTS.cdpPort, chatUrl = DEFAULTS.chatUrl } = {}) {
  const page = await openPage(chatUrl, { cdpPort });
  await waitFor(page, `document.readyState === "complete"`, { timeoutMs: 30000, label: "page load" });
  return page;
}

export async function checkLogin(page, { timeoutMs = 20000 } = {}) {
  const startedAt = Date.now();
  let state = "unknown";
  while (Date.now() - startedAt < timeoutMs) {
    state = await evaluate(page, `(() => {
      // A logged-out chatgpt.com still shows a composer, so the reliable
      // signal is the header login/signup buttons.
      const header = (document.querySelector('header')?.innerText ?? "");
      if (/ログイン|Log in|Sign up|サインアップ/.test(header)) return "logged-out";
      if (${COMPOSER}) return "ok";
      return "unknown";
    })()`);
    if (state !== "unknown") return state;
    await sleep(1000);
  }
  return state;
}

export async function attachImages(page, files, { timeoutMs = 90000 } = {}) {
  if (!files.length) return 0;
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`reference image not found: ${file}`);
  }
  const before = await evaluate(page, `document.querySelectorAll('form img').length`);
  const { root } = await page.send("DOM.getDocument", { depth: 1 });
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type="file"]' });
  if (!nodeId) throw new Error("file input was not found on the page");
  await page.send("DOM.setFileInputFiles", { files, nodeId });
  // Wait until every upload finished: thumbnail count reached and no spinner.
  const expected = before + files.length;
  await waitFor(
    page,
    `document.querySelectorAll('form img').length >= ${expected} && !document.querySelector('form [role="progressbar"], form svg.animate-spin, form circle[stroke-dashoffset]')`,
    { timeoutMs, intervalMs: 1000, label: `${files.length} attachment thumbnails` },
  );
  await sleep(1500);
  return files.length;
}

export async function setPrompt(page, prompt) {
  const written = await evaluate(page, `(() => {
    const editor = ${COMPOSER};
    if (!editor) return null;
    editor.focus();
    const selection = window.getSelection();
    selection.selectAllChildren(editor);
    document.execCommand("insertText", false, ${JSON.stringify(prompt)});
    return editor.innerText;
  })()`);
  if (written == null) throw new Error("composer was not found");
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  if (!normalize(written).startsWith(normalize(prompt).slice(0, 80))) {
    throw new Error(`composer text mismatch after insert: "${written.slice(0, 120)}"`);
  }
  return written;
}

export async function sendMessage(page) {
  const clicked = await evaluate(page, `(() => {
    const button = document.querySelector('[data-testid="send-button"]')
      ?? document.querySelector('button[aria-label*="送信"], button[aria-label*="Send"]');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error("send button was not found or is disabled");
  // The composer empties once the message is accepted.
  await waitFor(page, `((${COMPOSER})?.innerText ?? "").trim().length === 0`, { timeoutMs: 15000, label: "composer cleared after send" });
}

const ERROR_TEXT = /画像を生成できませんでした|コンテンツポリシー|利用規約に違反|wasn['’]t able to generate|can['’]t (?:create|generate) (?:that|this) image|content policy/i;

// Reads the conversation state. ChatGPT renders turns as
// [data-testid^="conversation-turn-"]; a finished generated image carries an
// alt like 「生成された画像：…」 and an image-gen action overlay. Reference
// thumbnails live inside the (collapsible) user message, so exclude them.
const REPLY_STATE = `(() => {
  const streaming = Boolean(document.querySelector('[data-testid="stop-button"]'));
  const overlay = Boolean(document.querySelector('[data-testid^="image-gen-overlay"]'));
  const turns = [...document.querySelectorAll('[data-testid^="conversation-turn-"], article')];
  const last = turns[turns.length - 1];
  const text = (last?.innerText ?? "").slice(0, 1500);
  const images = [...document.querySelectorAll('main img')]
    .filter((img) => /backend-api|estuary|oaiusercontent|files\\.openai|^blob:/.test(img.src))
    .filter((img) => !img.closest('form'))
    .filter((img) => {
      // Reference attachments live in the user's turn — never deliverables.
      const turn = img.closest('[data-testid^="conversation-turn-"], article');
      if (turn && turn.querySelector('[data-testid*="user-message"]')) return false;
      return (img.alt ?? "").startsWith("生成された画像") || img.naturalWidth > 600;
    })
    .map((img) => img.src);
  return { streaming, overlay, turns: turns.length, text, images };
})()`;

export async function waitForImageReply(page, { timeoutMs = 15 * 60 * 1000, onTick = null } = {}) {
  const startedAt = Date.now();
  let lastBeat = 0;
  let stableHits = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const state = await evaluate(page, REPLY_STATE);
    if (!state.streaming && state.images.length) {
      // The overlay marks a finished render; without it, require two stable
      // polls so a progressive preview is not grabbed mid-generation.
      stableHits += 1;
      if (state.overlay || stableHits >= 2) {
        return { status: "image", src: state.images[state.images.length - 1], text: state.text };
      }
    } else {
      stableHits = 0;
    }
    if (ERROR_TEXT.test(state.text)) return { status: "error", text: state.text };
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (onTick && elapsed - lastBeat >= 30) {
      lastBeat = elapsed;
      onTick(elapsed, state);
    }
    await sleep(5000);
  }
  return { status: "timeout" };
}

export async function downloadImage(page, src, destination) {
  // Tier 1: in-page fetch -> base64 (original bytes, no UI involved).
  try {
    const dataUrl = await evaluate(page, `(async () => {
      const response = await fetch(${JSON.stringify(src)});
      if (!response.ok) throw new Error("HTTP " + response.status);
      const blob = await response.blob();
      return await new Promise((resolveRead, rejectRead) => {
        const reader = new FileReader();
        reader.onload = () => resolveRead(reader.result);
        reader.onerror = () => rejectRead(reader.error);
        reader.readAsDataURL(blob);
      });
    })()`, { awaitPromise: true });
    const base64 = String(dataUrl).split(",", 2)[1];
    if (!base64 || base64.length < 10000) throw new Error("fetched image is suspiciously small");
    writeFileSync(destination, Buffer.from(base64, "base64"));
    return { method: "fetch", bytes: Buffer.byteLength(base64, "base64") };
  } catch (error) {
    // Tier 2: draw to canvas (works when fetch is blocked but the image is not CORS-tainted).
    const dataUrl = await evaluate(page, `(async () => {
      const img = [...document.images].find((item) => item.src === ${JSON.stringify(src)});
      if (!img) throw new Error("image element disappeared");
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    })()`, { awaitPromise: true });
    const base64 = String(dataUrl).split(",", 2)[1];
    if (!base64 || base64.length < 10000) throw new Error(`image download failed (fetch: ${error.message}; canvas output too small)`);
    writeFileSync(destination, Buffer.from(base64, "base64"));
    return { method: "canvas", bytes: Buffer.byteLength(base64, "base64") };
  }
}
