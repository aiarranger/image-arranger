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

// ---------------------------------------------------------------------------
// CENTRALIZED SELECTORS. Every CSS selector / regex the automation depends on
// lives here so a ChatGPT UI change is a one-place fix. SELECTORS.md (repo
// root) documents each entry and how to patch it. The self-test below
// (selectorSelfTest) probes the "core" entries against the live page so
// `--check` can report breakage with an actionable message instead of failing
// obscurely deep in the pipeline.
//
// Each core entry is an ordered list of CSS selector candidates: the first one
// that matches an element on the page wins. Listing fallbacks (e.g. a stable
// data-testid plus a structural CSS path) keeps the driver working across
// minor UI revisions and is locale-agnostic by construction.
// ---------------------------------------------------------------------------

export const SELECTORS = {
  // Where the user's prompt is typed. ChatGPT uses a contenteditable div with
  // id #prompt-textarea; the structural fallback covers id renames.
  composer: ['#prompt-textarea', 'main div[contenteditable="true"]'],
  // Hidden <input type=file> that DOM.setFileInputFiles targets to attach
  // reference images. There is exactly one on the composer.
  fileInput: ['input[type="file"]'],
  // The "send" button. data-testid is the stable signal; aria-label fallbacks
  // cover both JP and EN labels.
  sendButton: ['[data-testid="send-button"]', 'button[aria-label*="Send"]', 'button[aria-label*="送信"]'],
  // One container per message turn in the conversation transcript.
  conversationTurn: ['[data-testid^="conversation-turn-"]', 'article'],
};

// Structural signals used by REPLY_STATE / error / login detection. These are
// not "must exist on every page" elements, so they are kept out of the
// self-test's core set, but are documented in SELECTORS.md.
export const SIGNALS = {
  // Present while the assistant is streaming a response.
  stopButton: '[data-testid="stop-button"]',
  // The image-generation action overlay that marks a finished render.
  imageGenOverlay: '[data-testid^="image-gen-overlay"]',
  // Marks a turn as the user's (so its attachments are never mistaken for a
  // deliverable). Locale-independent.
  userMessage: '[data-testid*="user-message"]',
  // Positively marks a turn as the assistant's. Preferred over the negative
  // "not user-message" rule: when present anywhere in the conversation, a
  // deliverable image is only accepted inside an assistant turn, so a
  // user-uploaded reference on a matching content host can never be mistaken
  // for the result. Locale-independent; falls back to the negative rule when
  // ChatGPT exposes no assistant signal at all.
  assistantMessage: '[data-message-author-role="assistant"], [data-testid*="assistant"]',
  // Hosts that serve real generated/uploaded image bytes (vs. UI sprites).
  imageSrc: /backend-api|estuary|oaiusercontent|files\.openai|^blob:/,
  // attachImages() upload-progress probes — centralized so every ChatGPT
  // selector lives in one place (the "every selector in one place" guarantee).
  // Baseline thumbnail count is measured before/after setFileInputFiles.
  uploadThumb: 'form img',
  // Any of these inside the composer means an attachment is still uploading.
  uploadSpinner: 'form [role="progressbar"], form svg.animate-spin, form circle[stroke-dashoffset]',
};

const COMPOSER = `(${JSON.stringify(SELECTORS.composer)}.map((s) => document.querySelector(s)).find(Boolean) ?? null)`;

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
      // A logged-out chatgpt.com still shows a composer, so the composer alone
      // is not a reliable "logged in" signal. Detect logout STRUCTURALLY and
      // locale-agnostically, then confirm login via the composer.
      //
      // 1) The auth buttons link to /auth/login and /auth/* (or carry
      //    data-testid hooks) regardless of UI language.
      const authLink = document.querySelector(
        'a[href*="/auth/login"], a[href*="/auth/signup"], [data-testid="login-button"], [data-testid*="signup"]',
      );
      if (authLink) return "logged-out";
      // 2) The login wall sometimes redirects the URL itself.
      if (/\\/auth\\/(login|signup)/.test(location.pathname)) return "logged-out";
      // 3) Locale text fallback (broadened beyond JP/EN) only if structure was
      //    inconclusive — covers a few common ChatGPT UI languages.
      const header = (document.querySelector('header')?.innerText ?? "");
      if (/\\b(Log ?in|Sign ?up)\\b|ログイン|サインアップ|Anmelden|Iniciar sesión|Se connecter|Accedi|로그인|登录|登入/i.test(header)) {
        return "logged-out";
      }
      // Confirmed logged in only when the composer is present.
      if (${COMPOSER}) return "ok";
      return "unknown";
    })()`);
    if (state !== "unknown") return state;
    await sleep(1000);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Selector self-test. Probes the CENTRALIZED SELECTORS core entries against the
// live ChatGPT page (after login). Never throws on a missing element — it
// reports which entries matched and which did not, so `--check` can print one
// clear, actionable message pointing at SELECTORS.md when ChatGPT's UI shifts.
// ---------------------------------------------------------------------------

// WARN-ONLY monitored signals: probed by the self-test and reported by --check
// when absent, but they NEVER fail the gate / cause exit 3. Only the
// load-bearing core SELECTORS do that. These are structural hooks that help
// detection stay locale-neutral but have safe fallbacks if ChatGPT drops them.
export const MONITORED_SIGNALS = {
  userMessage: SIGNALS.userMessage,
  imageGenOverlay: SIGNALS.imageGenOverlay,
};

// Build the warnings array from the in-page monitored-signal probe result.
// Tolerant of a missing/odd result (keeps selectorSelfTest non-throwing).
function monitoredSignalChecks(signalResults) {
  const src = signalResults && typeof signalResults === "object" ? signalResults : {};
  return Object.entries(MONITORED_SIGNALS).map(([name, selector]) => ({
    name,
    selector,
    present: src[name] === true,
  }));
}

export async function selectorSelfTest(page) {
  // Evaluate every candidate list in-page; report the first matching selector
  // per entry (or null). Wrapped in try/catch so a page-side error degrades to
  // "not found" rather than crashing the probe. Returns a `{ checks: [...] }`
  // object map so the caller can shape-guard against undefined/null results.
  const results = await evaluate(page, `(() => {
    const groups = ${JSON.stringify(SELECTORS)};
    const checks = [];
    for (const [name, candidates] of Object.entries(groups)) {
      let matched = null;
      for (const selector of candidates) {
        try {
          if (document.querySelector(selector)) { matched = selector; break; }
        } catch (e) { /* invalid selector on this build — try the next */ }
      }
      checks.push({ name, ok: matched !== null, matched, candidates });
    }
    return { checks };
  })()`).catch((error) => ({ __error: error.message }));

  // Probe the WARN-ONLY monitored signals separately — a failure here must not
  // affect the core result, so it degrades to {} (all reported as absent).
  const signalResults = await evaluate(page, `(() => {
    const sigs = ${JSON.stringify(MONITORED_SIGNALS)};
    const out = {};
    for (const [name, selector] of Object.entries(sigs)) {
      try { out[name] = Boolean(document.querySelector(selector)); }
      catch (e) { out[name] = false; }
    }
    return out;
  })()`).catch(() => ({}));

  // Shape-guard: selectorSelfTest must NEVER throw (its whole job is to report
  // breakage cleanly). `evaluate` can resolve to undefined/null even without a
  // rejection — e.g. CDP returns no value, or the frame detached mid-probe — in
  // which case the existing .catch does not fire. Any result that is not the
  // expected object map degrades to a well-formed failure instead of letting
  // Object.entries(undefined) throw and escape the function. Also report the
  // WARN-ONLY monitored signals (userMessage, imageGenOverlay): they are
  // surfaced by --check when absent but never fail the gate (load-bearing
  // selectors do that).
  const monitored = monitoredSignalChecks(signalResults);
  if (!results || typeof results !== "object" || results.__error || !Array.isArray(results.checks)) {
    return {
      ok: false,
      pageError: results?.__error ?? "no result",
      checks: [],
      missing: Object.keys(SELECTORS),
      warnings: monitored,
    };
  }

  const checks = results.checks;
  const missing = checks.filter((c) => !c.ok).map((c) => c.name);
  return { ok: missing.length === 0, checks, missing, warnings: monitored };
}

export async function attachImages(page, files, { timeoutMs = 90000 } = {}) {
  if (!files.length) return 0;
  for (const file of files) {
    if (!existsSync(file)) throw new Error(`reference image not found: ${file}`);
  }
  const before = await evaluate(page, `document.querySelectorAll(${JSON.stringify(SIGNALS.uploadThumb)}).length`);
  const { root } = await page.send("DOM.getDocument", { depth: 1 });
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector: SELECTORS.fileInput[0] });
  if (!nodeId) throw new Error("file input was not found on the page");
  await page.send("DOM.setFileInputFiles", { files, nodeId });
  // Wait until every upload finished: thumbnail count reached and no spinner.
  const expected = before + files.length;
  await waitFor(
    page,
    `document.querySelectorAll(${JSON.stringify(SIGNALS.uploadThumb)}).length >= ${expected} && !document.querySelector(${JSON.stringify(SIGNALS.uploadSpinner)})`,
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
    const candidates = ${JSON.stringify(SELECTORS.sendButton)};
    const button = candidates.map((s) => document.querySelector(s)).find(Boolean);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error("send button was not found or is disabled");
  // The composer empties once the message is accepted.
  await waitFor(page, `((${COMPOSER})?.innerText ?? "").trim().length === 0`, { timeoutMs: 15000, label: "composer cleared after send" });
}

// Locale-neutral generation-failure detection. We do NOT rely on UI language:
// the primary signal is structural (the image never lands and no overlay
// appears), and this regex is only a fast-path that recognizes refusal copy
// across several common ChatGPT locales. It is intentionally broad; the
// pipeline already retries, so an occasional false positive just costs a retry.
// NOTE on tightening (L3): generic policy/guideline words match benign
// assistant prose ("our content guidelines say…", "Richtlinien für…"), so they
// only count when a refusal/violation CUE is nearby (violat…/against…/gegen…).
// Direct refusals ("can't create that image", "no puedo generar") stay
// standalone. Detection remains locale-aware; the pipeline retries, so the goal
// is to drop obvious false positives without losing genuine refusal coverage.
const ERROR_TEXT = new RegExp([
  // English — direct refusals (standalone)
  "wasn['’]t able to (?:generate|create)", "can['’]t (?:create|generate) (?:that|this|the) image",
  "unable to (?:generate|create)", "I (?:can['’]t|cannot) help (?:with|create)",
  // English — policy/guideline only with a violation/against cue nearby
  "against (?:our|the) (?:usage|content) polic(?:y|ies)?",
  "violat\\w* [^.]*(?:polic|guideline|content|usage)",
  "(?:polic|guideline|content)\\w* [^.]*violat",
  // Japanese — direct refusals stay standalone; policy needs the 違反 cue
  "画像を生成できませんでした", "生成できません", "(?:利用規約|コンテンツポリシー|ポリシー)に違反",
  // Spanish / French / German / Portuguese / Italian / Korean / Chinese
  "no (?:puedo|pude) (?:generar|crear)", "(?:viola|contra) [^.]*(?:política|directrices)",
  "je ne peux pas (?:générer|créer)", "(?:viole|contre) [^.]*(?:politique|règles)",
  "kann (?:dieses|das) Bild nicht", "(?:verstößt|gegen) [^.]*Richtlinien",
  "não (?:posso|consigo) (?:gerar|criar)",
  "non posso (?:generare|creare)",
  "이미지를 (?:생성|만들) 수 없", "(?:정책|콘텐츠 정책)(?:을|를)? ?위반",
  "无法(?:生成|创建)", "违反[^。]*(?:政策|内容政策)",
].join("|"), "i");

// Reads the conversation state. ChatGPT renders turns as
// [data-testid^="conversation-turn-"] (CSS fallback: <article>). Finished
// renders are detected STRUCTURALLY and locale-agnostically:
//   1) The image lives in an ASSISTANT turn (not the user's turn — reference
//      thumbnails there are never deliverables) and its src is served from a
//      real content host (SIGNALS.imageSrc).
//   2) An image-gen action overlay (SIGNALS.imageGenOverlay) marks a finished
//      render; the caller uses it to skip the stabilization wait.
//   3) Last-resort heuristics only when structure is ambiguous: a localized
//      generated-image alt prefix (list, not JP-only) OR naturalWidth > 600.
const REPLY_STATE = `(() => {
  const turnSel = ${JSON.stringify(SELECTORS.conversationTurn.join(", "))};
  const imgSrcRe = ${SIGNALS.imageSrc.toString()};
  // Localized alt prefixes for a finished generated image across locales. Used
  // only as a soft signal; never required.
  const GEN_ALT = ["生成された画像", "Generated image", "Imagen generada", "Image générée",
    "Generiertes Bild", "Imagem gerada", "Immagine generata", "생성된 이미지", "生成的图片", "生成的圖片"];

  const streaming = Boolean(document.querySelector('${SIGNALS.stopButton}'));
  const overlay = Boolean(document.querySelector('${SIGNALS.imageGenOverlay}'));
  const turns = [...document.querySelectorAll(turnSel)];
  const last = turns[turns.length - 1];
  const text = (last?.innerText ?? "").slice(0, 1500);

  // PREFER a positive assistant-turn signal. If ChatGPT exposes one anywhere in
  // the conversation, we trust it and accept an image only when its turn is an
  // assistant turn — so a user-uploaded reference image (matching content host,
  // not in a <form>) can never be mistaken for the deliverable, even if the
  // user-message testid was dropped/renamed. Only when NO assistant signal
  // exists at all do we fall back to the looser "not user-message" rule.
  const hasAssistantSignal = Boolean(document.querySelector('${SIGNALS.assistantMessage}'));

  const images = [...document.querySelectorAll('main img')]
    .filter((img) => imgSrcRe.test(img.src))
    .filter((img) => !img.closest('form'))
    .filter((img) => {
      // STRUCTURAL: a deliverable lives in an assistant turn, not the user's.
      const turn = img.closest(turnSel);
      if (hasAssistantSignal) {
        // Positive signal available: require the image to sit in an assistant
        // turn. This is strictly safer than the negative rule below.
        if (turn && turn.querySelector('${SIGNALS.assistantMessage}')) return true;
        // A turn that is the assistant's would have matched above; a turn that
        // is the user's (or any non-assistant turn) is rejected here.
        if (turn) return false;
        // No turn container resolved (markup drift): fall through to soft signals.
      } else {
        // FALLBACK (no assistant signal anywhere): the legacy negative rule —
        // accept any non-user turn.
        if (turn && turn.querySelector('${SIGNALS.userMessage}')) return false;
        if (turn) return true;
      }
      // No turn container resolved (markup drift): fall back to soft signals.
      const alt = img.alt ?? "";
      if (GEN_ALT.some((p) => alt.startsWith(p))) return true;
      return img.naturalWidth > 600;
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
