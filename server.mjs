#!/usr/bin/env node

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

import {
  BASE_KIT_PARTS,
  composeAnalyzePrompt,
  composeQualityCheckPrompt,
  composeQualityRepairPrompt,
  parseKitParts,
  parseQualityCheckResult,
} from "./prompts.mjs";
import {
  HttpError,
  originPolicyViolation,
  readBody,
  safeResolve,
  sendError,
  sendJson,
  serveFile,
} from "./http-util.mjs";
import { extractPngMetadata } from "./png-metadata.mjs";

export {
  composeAnalyzePrompt,
  composeQualityCheckPrompt,
  composeQualityRepairPrompt,
  removeBackgroundFromPng,
  parseKitParts,
  parseQualityCheckResult,
};

const TOOL_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4217;
const DEFAULT_WORKSPACE = join(TOOL_ROOT, "workspace", "sample");
const DEFAULT_STATE_FILE = join(DEFAULT_WORKSPACE, "deck.json");
const DEFAULT_REQUEST_DIR = join(DEFAULT_WORKSPACE, "requests");
const DEFAULT_OUTPUT_DIR = join(DEFAULT_WORKSPACE, "outputs");
const DEFAULT_ASSET_DIR = join(DEFAULT_WORKSPACE, "assets");
const DEFAULT_SAMPLE_DECK = join(TOOL_ROOT, "examples", "sample-deck.json");
const SAMPLE_ASSET_DIR = join(TOOL_ROOT, "examples", "assets");
const DEFAULT_REMBG_MODEL = "isnet-anime";
const SCHEMA_VERSION = "image-arranger.v1";
const LEGACY_SCHEMA_VERSION = "prompt-deck.v1";
// Ordered list of every schema this server understands, oldest first. The
// index of a schema is its generation number; anything not in this list and
// not matching SCHEMA_VERSION is treated as "from an unknown (newer) server"
// by the forward-compat guard in normalizeState().
const KNOWN_SCHEMA_VERSIONS = [LEGACY_SCHEMA_VERSION, SCHEMA_VERSION];
const MAX_ASSET_BYTES = 80 * 1024 * 1024;
const MAX_BACKGROUND_REMOVAL_PIXELS = 16_000_000;
const MAX_BACKGROUND_REMOVAL_DECODE_BYTES = 80 * 1024 * 1024;
const REMBG_TIMEOUT_MS = 180000;
// Keep this many timestamped deck snapshots under workspace/.history.
const HISTORY_LIMIT = 20;

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"]);
const INIT_MODES = new Set(["sample", "empty"]);
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\b[A-Za-z0-9_]*api[_-]?key[A-Za-z0-9_]*\b/i,
  /\b[A-Za-z0-9_]*token[A-Za-z0-9_]*\b/i,
  /\bpassword\b/i,
];
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
const PROJECT_SPECIFIC_PATTERNS = [
  /\/Users\//,
  /\/home\//,
  /C:\\Users/i,
];

function pngCrc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = PNG_CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(pngCrc32(body), 0);
  return Buffer.concat([length, body, crcBuffer]);
}

function materializeKitParts(character, sourceFiles, parts) {
  const files = (Array.isArray(sourceFiles) ? sourceFiles : [sourceFiles]).filter(Boolean);
  const created = [];
  const existingIds = new Set(collectEntries(character).map((item) => item.id));
  for (const part of parts ?? []) {
    const label = String(part.label ?? part.key ?? "").trim();
    const prompt = String(part.prompt ?? "").trim();
    if (!label || !prompt) continue;
    const category = character.base?.[part.category] ? part.category : "accessory";
    character.base[category] = character.base[category] ?? [];
    const partKey = safeSlug(part.key ?? label, "part");
    const id = makeUniqueId(existingIds, `base-kit-${partKey}`);
    existingIds.add(id);
    const item = entry(id, label, prompt);
    item.partKey = partKey;
    item.tags = ["base-kit"];
    for (const [index, file] of files.entries()) {
      item.assets.push({
        id: `asset-${safeSlug(id)}-source${index ? `-${index}` : ""}`,
        kind: "image",
        file,
        name: files.length > 1 ? `source-reference-${index + 1}` : "source-reference",
        adopted: false,
        prompt: "",
        sourceLicense: "",
        aiGenerated: false,
        humanReviewed: true,
        usageNotes: "ベース分解の元画像（参照用）",
        tags: ["source-reference"],
      });
    }
    character.base[category].unshift(item);
    created.push(item);
  }
  return created;
}

function parseArgs(argv = process.argv.slice(2)) {
  let config = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--config" && argv[index + 1]) {
      config = readJson(resolve(argv[index + 1]));
      break;
    }
  }
  const configHasProjectRoot = Object.prototype.hasOwnProperty.call(config, "projectRoot");
  const args = {
    port: DEFAULT_PORT,
    workspace: DEFAULT_WORKSPACE,
    init: "sample",
    projectRoot: TOOL_ROOT,
    doctor: false,
    ...config,
  };
  const explicit = {};
  let projectRootExplicit = configHasProjectRoot;
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--config") {
      index += 1;
    } else if (key === "--port") {
      args.port = Number(value);
      index += 1;
    } else if (key === "--workspace") {
      args.workspace = value;
      index += 1;
    } else if (key === "--state") {
      explicit.stateFile = resolve(value);
      index += 1;
    } else if (key === "--requests") {
      explicit.requestDir = resolve(value);
      index += 1;
    } else if (key === "--outputs") {
      explicit.outputDir = resolve(value);
      index += 1;
    } else if (key === "--assets") {
      explicit.assetDir = resolve(value);
      index += 1;
    } else if (key === "--project-root") {
      args.projectRoot = resolve(value);
      projectRootExplicit = true;
      index += 1;
    } else if (key === "--init") {
      args.init = value;
      index += 1;
    } else if (key === "--doctor") {
      args.doctor = true;
    }
  }
  const workspace = resolve(args.workspace ?? DEFAULT_WORKSPACE);
  const inferredProjectRoot = workspace === TOOL_ROOT || workspace.startsWith(TOOL_ROOT + sep) ? TOOL_ROOT : workspace;
  const init = INIT_MODES.has(args.init) ? args.init : "sample";
  return {
    port: args.port,
    init,
    doctor: Boolean(args.doctor),
    workspace,
    stateFile: resolve(explicit.stateFile ?? args.stateFile ?? join(workspace, "deck.json")),
    requestDir: resolve(explicit.requestDir ?? args.requestDir ?? join(workspace, "requests")),
    outputDir: resolve(explicit.outputDir ?? args.outputDir ?? join(workspace, "outputs")),
    assetDir: resolve(explicit.assetDir ?? args.assetDir ?? join(workspace, "assets")),
    projectRoot: resolve(projectRootExplicit ? args.projectRoot : inferredProjectRoot),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function toPosixPath(value) {
  return String(value).split(sep).join("/");
}

function safeSlug(value, fallback = "item") {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 90) || fallback;
}

function isPathInsideAny(path, roots) {
  const resolved = resolve(path);
  return roots.some((rootPath) => {
    const root = resolve(rootPath);
    return resolved === root || resolved.startsWith(root + sep);
  });
}

function workspaceAssetRoots(context) {
  return [context.assetDir, context.outputDir];
}

function workspaceAssetFileExists(context, file) {
  try {
    const resolved = safeResolve(context.projectRoot, file);
    return isPathInsideAny(resolved, workspaceAssetRoots(context))
      && existsSync(resolved)
      && !statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

// ---------------------------------------------------------------------------
// Single-writer model + deck.json backups.
//
// All deck.json mutations go through writeState(), which serializes the
// read-modify-write window through an in-process async mutex (runExclusive).
// The tool is a LOCAL, single-process, single-writer app: one server owns one
// workspace. We do not support multiple server processes writing the same
// deck.json concurrently — that is explicitly out of scope. The mutex only
// guards against the lost-update race between concurrent in-flight HTTP
// requests handled by THIS process (many mutating handlers read state, then
// `await readBody()`, then write; without serialization a request that commits
// during another's await gap would be clobbered by stale in-memory state).
// ---------------------------------------------------------------------------

let writeChain = Promise.resolve();

// Serialize an async critical section. Each call waits for the previous one to
// settle, so deck read-modify-write sequences never interleave.
function runExclusive(task) {
  const run = writeChain.then(() => task());
  // Keep the chain alive even if a task rejects; swallow here so one failed
  // mutation does not poison every later mutation.
  writeChain = run.then(() => {}, () => {});
  return run;
}

// Write a rotating backup of the deck before overwriting it. Keeps the most
// recent `deck.json.bak` plus a capped set of timestamped snapshots under
// workspace/.history so an accidental bad save (or a botched migration) can be
// recovered manually.
function backupDeck(stateFile) {
  if (!existsSync(stateFile)) return;
  try {
    copyFileSync(stateFile, `${stateFile}.bak`);
    const historyDir = join(dirname(stateFile), ".history");
    ensureDir(historyDir);
    const stamp = nowIso().replace(/[:.]/g, "-");
    copyFileSync(stateFile, join(historyDir, `${basename(stateFile)}.${stamp}`));
    const prefix = `${basename(stateFile)}.`;
    const snapshots = readdirSync(historyDir)
      .filter((name) => name.startsWith(prefix))
      .sort();
    for (const stale of snapshots.slice(0, Math.max(0, snapshots.length - HISTORY_LIMIT))) {
      try { rmSync(join(historyDir, stale)); } catch { /* best-effort rotation */ }
    }
  } catch (error) {
    // Backups are best-effort: never let a backup failure block a real save.
    console.error("deck backup failed:", error?.message ?? error);
  }
}

// Canonical writer for deck.json: back up the previous version, then write.
function writeState(stateFile, state) {
  backupDeck(stateFile);
  writeJson(stateFile, state);
}

function readTextIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function asset(id, kind, file, name, prompt = "") {
  return {
    id,
    kind,
    file,
    name,
    adopted: true,
    prompt,
    sourceLicense: "",
    aiGenerated: true,
    humanReviewed: true,
    usageNotes: "",
    tags: [],
  };
}

function entry(id, overview, prompt, assets = []) {
  return {
    id,
    overview,
    prompt,
    version: 1,
    checked: false,
    requestStatus: "idle",
    tags: [],
    assets,
  };
}

function blankBase() {
  return {
    master: [
      entry(
        "base-common-rules",
        "共通ルール",
        "Keep the result usable as a game material. No UI, no text, no logo, no watermark. Prefer stable composition, readable silhouette, and easy asset extraction.",
      ),
    ],
    accessory: [],
    expression: [],
    clothing: [],
    background: [],
  };
}

function materialCategoryLabels() {
  return {
    expression: { ja: "場面/用途", en: "Scene / Use" },
    clothing: { ja: "形式", en: "Format" },
  };
}

function baseEntry(id, overview, prompt) {
  return entry(id, overview, prompt, []);
}

function characterBaseTemplate(characterId) {
  return {
    master: [
      baseEntry(
        `base-${characterId}-master-full-body`,
        "全身ベース",
        "masterpiece, full body character sheet, neutral standing pose, consistent face, clean background, high detail",
      ),
    ],
    accessory: [
      baseEntry(`base-${characterId}-accessory-ribbon`, "赤リボン", "red ribbon hair accessory, small"),
      baseEntry(`base-${characterId}-accessory-mini-bag`, "ミニバッグ", "holding a small shoulder bag"),
    ],
    expression: [
      baseEntry(`base-${characterId}-expression-smile`, "笑顔", "bright smile, soft eyes, slightly blushing"),
      baseEntry(`base-${characterId}-expression-neutral`, "真顔", "calm neutral expression, looking forward"),
    ],
    clothing: [
      baseEntry(`base-${characterId}-clothing-uniform`, "制服", "school uniform, blazer, pleated skirt"),
      baseEntry(`base-${characterId}-clothing-casual`, "私服", "casual hoodie and jeans"),
    ],
    background: [
      baseEntry(`base-${characterId}-background-classroom`, "教室", "classroom interior, afternoon light from window"),
      baseEntry(`base-${characterId}-background-street-dusk`, "夕方の街", "city street at dusk, warm street lights, bokeh"),
    ],
  };
}

function characterImageTemplate(characterId, base) {
  return [
    imageEntry(
      `image-${characterId}-classroom-smile-uniform`,
      "教室で笑顔・制服",
      "",
      [],
      {
        master: base.master[0]?.id ?? "",
        accessory: [
          base.accessory[0]?.id,
          base.accessory[1]?.id,
        ].filter(Boolean),
        expression: [base.expression[0]?.id].filter(Boolean),
        clothing: [base.clothing[0]?.id].filter(Boolean),
        background: [base.background[0]?.id].filter(Boolean),
      },
    ),
  ];
}

function imageEntry(id, overview, prompt, assets = [], refs = {}, options = {}) {
  return {
    ...entry(id, overview, prompt, assets),
    useBaseRefs: Boolean(options.useBaseRefs),
    refs: {
      master: "",
      accessory: [],
      expression: "",
      clothing: "",
      background: "",
      ...refs,
    },
  };
}

export function createEmptyState() {
  return {
    schema: SCHEMA_VERSION,
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    settings: {
      lang: "ja",
      currentCharacterId: "starter-character",
      mode: "base",
    },
    characters: [
      {
        id: "starter-character",
        name: "Starter Character",
        categoryLabels: {},
        description: "Blank character workspace. Add base entries, image prompts, and adopted assets.",
        base: characterBaseTemplate("starter-character"),
        images: [],
        videos: [],
      },
    ],
    requestDirectory: "requests",
    outputDirectory: "outputs",
  };
}

export function createSampleState() {
  if (existsSync(DEFAULT_SAMPLE_DECK)) {
    const state = readJson(DEFAULT_SAMPLE_DECK);
    state.createdAt = state.createdAt || nowIso();
    state.updatedAt = nowIso();
    return normalizeState(state);
  }
  return createEmptyState();
}

export function createSeedState(options = {}) {
  if (options.init === "empty") return createEmptyState();
  return createSampleState();
}

function readState(stateFile, projectRoot, init = "sample") {
  if (!existsSync(stateFile)) {
    const state = createSeedState({ projectRoot, init });
    writeJson(stateFile, state);
    return state;
  }
  const raw = readJson(stateFile);
  if (isNewerSchema(raw.schema)) {
    // Forward-compat guard: this deck was written by a newer server than us.
    // Snapshot it before refusing so the user never loses the newer file by
    // running an older binary against it.
    backupDeck(stateFile);
    throw new SchemaVersionError(raw.schema);
  }
  return normalizeState(raw);
}

// A schema we don't recognize AND that isn't the current/legacy version is
// assumed to come from a newer server (forward incompatibility).
function isNewerSchema(schema) {
  if (!schema) return false;
  return !KNOWN_SCHEMA_VERSIONS.includes(schema);
}

class SchemaVersionError extends HttpError {
  constructor(schema) {
    super(
      409,
      "Deck was written by a newer version of image-arranger; please upgrade.",
      `deck.json schema "${schema}" is newer than this server understands `
      + `(supported: ${KNOWN_SCHEMA_VERSIONS.join(", ")}). `
      + `A backup was written to deck.json.bak. Upgrade image-arranger to open it.`,
    );
    this.schema = schema;
  }
}

function normalizeState(state) {
  if (isNewerSchema(state.schema)) {
    // Reached when normalizeState is called directly (e.g. PUT /api/state body)
    // with a deck claiming a newer schema. Refuse rather than silently mutate.
    throw new SchemaVersionError(state.schema);
  }
  if (state.schema === LEGACY_SCHEMA_VERSION || !state.schema) {
    state.schema = SCHEMA_VERSION;
  }
  for (const character of state.characters ?? []) {
    const legacyWorkflow = character.workflow;
    character.categoryLabels = {
      ...(legacyWorkflow === "material" ? materialCategoryLabels() : {}),
      ...(character.categoryLabels ?? {}),
    };
    character.base = character.base ?? blankBase();
    for (const category of ["master", "accessory", "expression", "clothing", "background"]) {
      character.base[category] = character.base[category] ?? [];
    }
    for (const category of Object.keys(character.categoryLabels ?? {})) {
      character.base[category] = character.base[category] ?? [];
    }
    character.images = character.images ?? [];
    character.videos = character.videos ?? [];
    for (const entryItem of collectEntries(character)) {
      if (entryItem.qualityGate && typeof entryItem.qualityGate === "object") {
        entryItem.qualityGate = {
          enabled: Boolean(entryItem.qualityGate.enabled),
          maxAttempts: Math.max(1, Math.min(10, Number(entryItem.qualityGate.maxAttempts) || 3)),
        };
      }
      for (const assetItem of entryItem.assets ?? []) {
        assetItem.sourceLicense = assetItem.sourceLicense ?? "";
        assetItem.aiGenerated = typeof assetItem.aiGenerated === "boolean" ? assetItem.aiGenerated : false;
        assetItem.humanReviewed = typeof assetItem.humanReviewed === "boolean" ? assetItem.humanReviewed : false;
        assetItem.usageNotes = assetItem.usageNotes ?? "";
        assetItem.requestStatus = assetItem.requestStatus ?? "idle";
        assetItem.improveChecked = Boolean(assetItem.improveChecked);
        assetItem.improvementPrompt = assetItem.improvementPrompt ?? "";
      }
    }
  }
  return state;
}

function collectEntries(character) {
  const entries = [];
  for (const rows of Object.values(character.base ?? {})) {
    for (const item of rows ?? []) entries.push(item);
  }
  for (const item of character.images ?? []) entries.push(item);
  for (const item of character.videos ?? []) entries.push(item);
  return entries;
}

function targetMatches(target, action, entryId, assetId = "") {
  const targetAction = target.action ?? (target.assetId ? "improve" : "generate");
  return targetAction === action && target.entryId === entryId && String(target.assetId ?? "") === String(assetId ?? "");
}

function normalizeQualityGate(value) {
  if (!value || typeof value !== "object" || value.enabled === false) return null;
  const maxAttempts = Math.max(1, Math.min(10, Number(value.maxAttempts) || 3));
  const requiredParts = Array.isArray(value.requiredParts)
    ? value.requiredParts.map((part) => ({
      entryId: String(part.entryId ?? part.id ?? "").trim(),
      category: String(part.category ?? "").trim(),
      overview: String(part.overview ?? part.label ?? part.entryId ?? "").trim(),
      prompt: String(part.prompt ?? "").trim(),
      file: String(part.file ?? "").trim(),
      visibilityRule: "compare-if-visible",
    })).filter((part) => part.entryId || part.file || part.overview)
    : [];
  return {
    enabled: true,
    mode: "compare-if-visible",
    maxAttempts,
    requiredParts,
  };
}

function applyRequestStatus(state, targets, status, characterId = "") {
  for (const character of state.characters ?? []) {
    if (characterId && character.id !== characterId) continue;
    for (const entryItem of collectEntries(character)) {
      if (targets.some((target) => targetMatches(target, "generate", entryItem.id))) {
        entryItem.requestStatus = status;
        entryItem.checked = false;
      }
      for (const assetItem of entryItem.assets ?? []) {
        if (targets.some((target) => targetMatches(target, "improve", entryItem.id, assetItem.id)
          || targetMatches(target, "analyze", entryItem.id, assetItem.id))) {
          assetItem.requestStatus = status;
          assetItem.improveChecked = false;
        }
      }
    }
  }
  state.updatedAt = nowIso();
}

function buildRequest(state, body, context) {
  const character = state.characters.find((item) => item.id === body.characterId) ?? state.characters[0];
  const mode = body.mode ?? state.settings?.mode ?? "image";
  const requestId = `req_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const workspaceOutputs = toPosixPath(relative(context.projectRoot, context.outputDir));
  const targets = (body.targets ?? []).map((target) => {
    const action = target.action === "improve" ? "improve" : target.action === "draft-prompt" ? "draft-prompt" : "generate";
    const defaultOutputDir = action === "improve"
      ? `${workspaceOutputs}/${character.id}/improvements`
      : `${workspaceOutputs}/${character.id}`;
    return {
      action,
      entryId: target.entryId,
      assetId: target.assetId ?? null,
      assetName: target.assetName ?? null,
      assetFile: target.assetFile ?? null,
      overview: target.overview,
      prompt: target.prompt,
      referenceUrl: target.referenceUrl ?? null,
      basePrompt: target.basePrompt ?? "",
      improvementPrompt: target.improvementPrompt ?? "",
      inputs: target.inputs ?? { startFrame: null, endFrame: null, refImages: [] },
      outputDir: target.outputDir ?? defaultOutputDir,
      service: target.service ?? (mode === "video" || target.inputs?.startFrame || target.inputs?.endFrame ? "vidu" : "chatgpt"),
      qualityGate: normalizeQualityGate(target.qualityGate),
      status: "requested",
      results: [],
    };
  });
  const services = new Set(targets.map((target) => target.service));
  const service = services.size === 1 ? [...services][0] : "mixed";
  return {
    schema: "image-arranger-request.v1",
    requestId,
    status: "requested",
    character: character.id,
    characterName: character.name,
    mode,
    service,
    targets,
    requestedAt: nowIso(),
    completedAt: null,
    note: "image-arranger writes this request only. Ask an agent or operator to process queued image/video generation requests; the generation service is operated outside this tool and this file is updated after processing.",
  };
}

function readRequestFiles(context) {
  if (!existsSync(context.requestDir)) return [];
  const requests = [];
  for (const file of readdirSync(context.requestDir)) {
    if (!file.endsWith(".json")) continue;
    const requestPath = join(context.requestDir, file);
    const requestPayload = readJson(requestPath);
    requestPayload.requestId = requestPayload.requestId ?? basename(file, ".json");
    requests.push({ file, requestPath, requestPayload });
  }
  return requests.sort((a, b) => String(b.requestPayload.requestedAt ?? "").localeCompare(String(a.requestPayload.requestedAt ?? "")));
}

function normalizeRequestAction(value, fallback = "generate") {
  return ["generate", "improve", "analyze", "draft-prompt"].includes(value) ? value : fallback;
}

function requestSelectorMatches(target, selector, requestPayload, targetIndex) {
  if (selector.requestId) {
    return selector.requestId === requestPayload.requestId && Number(selector.targetIndex) === targetIndex;
  }
  return targetMatches(
    target,
    normalizeRequestAction(selector.action),
    selector.entryId,
    selector.assetId ?? "",
  );
}

function cancelRequestFiles(context, selectors) {
  let cancelled = 0;
  for (const { requestPath, requestPayload } of readRequestFiles(context)) {
    let changed = false;
    for (const [targetIndex, target] of (requestPayload.targets ?? []).entries()) {
      if (target.status !== "requested") continue;
      const match = selectors.some((selector) => requestSelectorMatches(target, selector, requestPayload, targetIndex));
      if (!match) continue;
      target.status = "cancelled";
      target.cancelledAt = nowIso();
      changed = true;
      cancelled += 1;
    }
    if (!changed) continue;
    const active = (requestPayload.targets ?? []).some((target) => target.status === "requested");
    requestPayload.status = active ? "requested" : "cancelled";
    if (!active) requestPayload.completedAt = nowIso();
    writeJson(requestPath, requestPayload);
  }
  return cancelled;
}

function completeRequestFiles(context, selectors) {
  let completed = 0;
  const completedTargets = [];
  for (const { requestPath, requestPayload } of readRequestFiles(context)) {
    let changed = false;
    for (const [targetIndex, target] of (requestPayload.targets ?? []).entries()) {
      if (target.status !== "requested") continue;
      const selector = selectors.find((selector) => requestSelectorMatches(target, selector, requestPayload, targetIndex));
      if (!selector) continue;
      if (selector.error) {
        target.status = "error";
        target.errorMessage = String(selector.error);
        if (selector.qualityReport) target.qualityReport = selector.qualityReport;
        target.erroredAt = nowIso();
        changed = true;
        completedTargets.push({ requestPath, requestPayload, target, selector });
        continue;
      }
      target.status = "completed";
      target.completedAt = nowIso();
      if (Array.isArray(selector.results)) target.results = selector.results;
      if (selector.qualityReport) target.qualityReport = selector.qualityReport;
      if ((target.action ?? "") === "draft-prompt") {
        const drafted = selector.prompt
          ?? (Array.isArray(selector.results) ? selector.results.find((item) => item?.prompt)?.prompt : null);
        if (drafted && String(drafted).trim()) target.draftedPrompt = String(drafted).trim();
        const draftedTitle = selector.overview
          ?? (Array.isArray(selector.results) ? selector.results.find((item) => item?.overview)?.overview : null);
        if (draftedTitle && String(draftedTitle).trim()) target.draftedOverview = String(draftedTitle).trim();
      }
      if ((target.action ?? "") === "analyze") {
        const partsSource = selector.parts
          ?? (Array.isArray(selector.results) ? selector.results.find((item) => item?.parts)?.parts : null);
        if (partsSource) {
          try {
            const parsed = parseKitParts(partsSource);
            if (parsed.length) target.analysisParts = parsed;
          } catch {
            // keep target completed; invalid parts payloads are simply not stored
          }
        }
      }
      changed = true;
      completed += 1;
      completedTargets.push({ requestPath, requestPayload, target, selector });
    }
    if (!changed) continue;
    const active = (requestPayload.targets ?? []).some((target) => target.status === "requested");
    const someError = (requestPayload.targets ?? []).some((target) => target.status === "error");
    requestPayload.status = active ? "requested" : (someError ? "error" : "completed");
    if (!active) requestPayload.completedAt = nowIso();
    requestPayload.updatedAt = nowIso();
    writeJson(requestPath, requestPayload);
  }
  return { completed, completedTargets };
}

function listKitResults(context) {
  const rows = [];
  for (const { file, requestPayload } of readRequestFiles(context)) {
    for (const [targetIndex, target] of (requestPayload.targets ?? []).entries()) {
      if ((target.action ?? "") !== "analyze") continue;
      if (!Array.isArray(target.analysisParts) || !target.analysisParts.length) continue;
      if (target.kitImportedAt) continue;
      rows.push({
        requestId: requestPayload.requestId,
        targetIndex,
        requestFile: file,
        characterId: requestPayload.character ?? "",
        characterName: requestPayload.characterName ?? "",
        sourceEntryId: target.entryId ?? "",
        sourceAssetId: target.assetId ?? "",
        sourceFile: target.inputs?.sourceAsset ?? target.assetFile ?? "",
        sourceFiles: target.inputs?.sourceAssets ?? target.inputs?.refImages ?? [],
        completedAt: target.completedAt ?? "",
        parts: target.analysisParts,
      });
    }
  }
  return rows;
}

function qualityIssueRows(report) {
  const attempts = Array.isArray(report?.attempts) ? report.attempts : [];
  return attempts.flatMap((attempt) => Array.isArray(attempt?.issues) ? attempt.issues : []);
}

function listQualityReports(context) {
  const rows = [];
  for (const { file, requestPayload } of readRequestFiles(context)) {
    for (const [targetIndex, target] of (requestPayload.targets ?? []).entries()) {
      if (!target.qualityReport) continue;
      const attempts = Array.isArray(target.qualityReport.attempts) ? target.qualityReport.attempts : [];
      const resultFiles = [...new Set([
        ...(Array.isArray(target.results) ? target.results.map((item) => item?.file).filter(Boolean) : []),
        ...attempts.map((item) => item?.file).filter(Boolean),
      ])];
      rows.push({
        requestId: requestPayload.requestId,
        targetIndex,
        requestFile: file,
        characterId: requestPayload.character ?? "",
        characterName: requestPayload.characterName ?? "",
        mode: requestPayload.mode ?? "",
        action: target.action ?? (target.assetId ? "improve" : "generate"),
        entryId: target.entryId ?? "",
        assetId: target.assetId ?? "",
        overview: target.overview ?? target.entryId ?? "",
        status: target.status ?? requestPayload.status ?? "",
        completedAt: target.completedAt ?? target.erroredAt ?? requestPayload.updatedAt ?? requestPayload.completedAt ?? "",
        resultFiles,
        issueCount: qualityIssueRows(target.qualityReport).length,
        qualityReport: target.qualityReport,
      });
    }
  }
  return rows.sort((a, b) => String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? "")));
}

function markKitResultImported(context, requestId, targetIndex) {
  for (const { requestPath, requestPayload } of readRequestFiles(context)) {
    if (requestPayload.requestId !== requestId) continue;
    const target = requestPayload.targets?.[targetIndex];
    if (!target) return false;
    target.kitImportedAt = nowIso();
    requestPayload.updatedAt = nowIso();
    writeJson(requestPath, requestPayload);
    return true;
  }
  return false;
}

function listRequestedTargets(context, state = null) {
  const rows = [];
  for (const { file, requestPayload } of readRequestFiles(context)) {
    for (const [targetIndex, target] of (requestPayload.targets ?? []).entries()) {
      if (target.status !== "requested") continue;
      const action = target.action ?? (target.assetId ? "improve" : "generate");
      const characterId = requestPayload.character ?? "";
      const character = state?.characters?.find((item) => item.id === characterId);
      const entryItem = character ? findEntryInCharacter(character, target.entryId) : null;
      const assetItem = entryItem?.assets?.find((assetItem) => assetItem.id === target.assetId);
      rows.push({
        requestId: requestPayload.requestId,
        targetIndex,
        requestFile: file,
        characterId,
        characterName: requestPayload.characterName ?? character?.name ?? characterId,
        mode: requestPayload.mode ?? "",
        service: target.service ?? requestPayload.service ?? "",
        action,
        entryId: target.entryId,
        assetId: target.assetId ?? "",
        overview: target.overview ?? entryItem?.overview ?? target.entryId,
        assetName: target.assetName ?? assetItem?.name ?? "",
        prompt: target.prompt ?? "",
        referenceUrl: target.referenceUrl ?? "",
        basePrompt: target.basePrompt ?? "",
        improvementPrompt: target.improvementPrompt ?? "",
        inputs: target.inputs ?? { startFrame: null, endFrame: null, refImages: [] },
        outputDir: target.outputDir ?? "",
        qualityGate: target.qualityGate ?? null,
        requestedAt: requestPayload.requestedAt ?? "",
        existsInDeck: Boolean(entryItem) && (!(action === "improve" || action === "analyze") || Boolean(assetItem)),
      });
    }
  }
  return rows;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value ?? {}, key);
}

function updateRequestTarget(context, state, body) {
  const requestId = String(body.requestId ?? "").trim();
  const targetIndex = Number(body.targetIndex);
  if (!requestId || !Number.isInteger(targetIndex) || targetIndex < 0) {
    throw new HttpError(400, "requestId and targetIndex are required");
  }

  for (const { requestPath, requestPayload } of readRequestFiles(context)) {
    if (requestPayload.requestId !== requestId) continue;
    const target = requestPayload.targets?.[targetIndex];
    if (!target) throw new HttpError(404, "Request target was not found");

    const action = target.action ?? (target.assetId ? "improve" : "generate");
    const hasPrompt = hasOwn(body, "prompt");
    const hasImprovementPrompt = hasOwn(body, "improvementPrompt");
    const nextPrompt = hasPrompt ? String(body.prompt ?? "") : target.prompt;
    const nextImprovementPrompt = hasImprovementPrompt ? String(body.improvementPrompt ?? "") : target.improvementPrompt;

    if (hasPrompt) target.prompt = nextPrompt;
    if (action === "improve" && hasImprovementPrompt) target.improvementPrompt = nextImprovementPrompt;
    target.updatedAt = nowIso();
    requestPayload.updatedAt = target.updatedAt;
    writeJson(requestPath, requestPayload);

    const character = state.characters?.find((item) => item.id === (requestPayload.character ?? ""));
    const entryItem = character ? findEntryInCharacter(character, target.entryId) : null;
    let deckUpdated = false;
    let existsInDeck = false;

    if (entryItem && action === "generate") {
      existsInDeck = true;
      if (hasPrompt) {
        entryItem.prompt = nextPrompt;
        deckUpdated = true;
      }
    } else if (entryItem && action === "improve") {
      const assetItem = entryItem.assets?.find((item) => item.id === target.assetId);
      existsInDeck = Boolean(assetItem);
      if (assetItem && hasImprovementPrompt) {
        assetItem.improvementPrompt = nextImprovementPrompt;
        deckUpdated = true;
      }
    }

    if (deckUpdated) {
      state.updatedAt = nowIso();
      writeState(context.stateFile, state);
    }

    return {
      requestPayload,
      target,
      deckUpdated,
      existsInDeck,
    };
  }

  throw new HttpError(404, "Request was not found");
}

function recomputeRequestedStatuses(state, context) {
  for (const character of state.characters ?? []) {
    for (const entryItem of collectEntries(character)) {
      if (entryItem.requestStatus === "requested") entryItem.requestStatus = "idle";
      for (const assetItem of entryItem.assets ?? []) {
        if (assetItem.requestStatus === "requested") assetItem.requestStatus = "idle";
      }
    }
  }
  for (const target of listRequestedTargets(context, state)) {
    const character = state.characters?.find((item) => item.id === target.characterId);
    if (!character) continue;
    const entryItem = findEntryInCharacter(character, target.entryId);
    if (!entryItem) continue;
    if (target.action === "improve" || target.action === "analyze") {
      const assetItem = entryItem.assets?.find((item) => item.id === target.assetId);
      if (assetItem) assetItem.requestStatus = "requested";
    } else {
      entryItem.requestStatus = "requested";
    }
  }
  state.updatedAt = nowIso();
}

function cancellationTargetsForEntry(entryItem) {
  return [
    { action: "generate", entryId: entryItem.id },
    { action: "draft-prompt", entryId: entryItem.id },
    ...(entryItem.assets ?? []).flatMap((assetItem) => [
      { action: "improve", entryId: entryItem.id, assetId: assetItem.id },
      { action: "analyze", entryId: entryItem.id, assetId: assetItem.id },
    ]),
  ];
}

function cancellationTargetsForCharacter(character) {
  return collectEntries(character).flatMap((entryItem) => cancellationTargetsForEntry(entryItem));
}

function makeUniqueId(existingIds, prefix) {
  let index = 1;
  let id = prefix;
  while (existingIds.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}

function findCharacter(state, characterId) {
  return state.characters.find((item) => item.id === characterId) ?? state.characters[0];
}

function findEntryInCharacter(character, entryId) {
  for (const item of collectEntries(character)) {
    if (item.id === entryId) return item;
  }
  return null;
}

function makeCharacterFromBody(state, body) {
  const name = String(body.name ?? "").trim();
  if (!name) throw new HttpError(400, "Character name is required");
  const existingIds = new Set((state.characters ?? []).map((item) => item.id));
  const id = makeUniqueId(existingIds, safeSlug(body.id || name, "character"));
  const source = body.copyBaseFrom
    ? state.characters.find((item) => item.id === body.copyBaseFrom)
    : null;
  const base = source?.base
    ? structuredClone(source.base)
    : characterBaseTemplate(id);
  return {
    id,
    name,
    categoryLabels: source?.categoryLabels
      ? structuredClone(source.categoryLabels)
      : {},
    description: String(body.description ?? ""),
    base,
    images: [],
    videos: [],
  };
}

// PNGs from A1111 / NovelAI / ComfyUI carry the generation prompt in text
// chunks — surface it automatically instead of requiring an Eagle-style
// plugin. Only fills empty prompts (never overwrites user input) and never
// throws: corrupt or metadata-free files leave the asset untouched.
function applyPngMetadata(asset, filePath) {
  if (asset.prompt || !filePath.toLowerCase().endsWith(".png")) return;
  try {
    const metadata = extractPngMetadata(readFileSync(filePath));
    if (!metadata) return;
    asset.prompt = metadata.prompt;
    asset.promptSource = `png-metadata:${metadata.source}`;
    asset.aiGenerated = true;
    if (metadata.parameters && metadata.parameters !== metadata.prompt) {
      asset.promptMetadata = metadata.parameters;
    }
  } catch {
    // Unreadable file — keep the asset exactly as a plain upload.
  }
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePngRgba(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) {
    throw new HttpError(400, "Background removal currently supports PNG assets only");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw new HttpError(400, "PNG is truncated");
    const data = buffer.subarray(start, end);
    if (type === "IHDR") {
      if (data.length !== 13) throw new HttpError(400, "PNG has an invalid IHDR chunk");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }

  if (!width || !height || bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new HttpError(400, "Background removal supports non-interlaced 8-bit RGB/RGBA PNG assets");
  }
  if (!idat.length) throw new HttpError(400, "PNG has no image data");

  const channels = colorType === 6 ? 4 : 3;
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > MAX_BACKGROUND_REMOVAL_PIXELS) {
    throw new HttpError(413, `PNG is too large for background removal (${MAX_BACKGROUND_REMOVAL_PIXELS} pixels max)`);
  }
  const stride = width * channels;
  const expected = height * (stride + 1);
  if (!Number.isSafeInteger(expected) || expected > MAX_BACKGROUND_REMOVAL_DECODE_BYTES) {
    throw new HttpError(413, "PNG decoded data is too large for background removal");
  }
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    throw new HttpError(400, "PNG image data could not be decoded");
  }
  if (inflated.length < expected) throw new HttpError(400, "PNG image data is incomplete");
  const rows = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[src + x];
      const left = x >= channels ? rows[dst + x - channels] : 0;
      const up = y > 0 ? rows[dst + x - stride] : 0;
      const upLeft = y > 0 && x >= channels ? rows[dst + x - stride - channels] : 0;
      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new HttpError(400, "PNG uses an unsupported filter");
      rows[dst + x] = value & 0xff;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const src = pixel * channels;
    const dst = pixel * 4;
    rgba[dst] = rows[src];
    rgba[dst + 1] = rows[src + 1];
    rgba[dst + 2] = rows[src + 2];
    rgba[dst + 3] = colorType === 6 ? rows[src + 3] : 255;
  }
  return { width, height, data: rgba };
}

function encodeRgbaPng(image) {
  const raw = Buffer.alloc(image.height * (1 + image.width * 4));
  for (let y = 0; y < image.height; y += 1) {
    image.data.copy(raw, y * (1 + image.width * 4) + 1, y * image.width * 4, (y + 1) * image.width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pixelOffset(image, x, y) {
  return (y * image.width + x) * 4;
}

function colorDistanceSq(data, index, key) {
  const dr = data[index] - key[0];
  const dg = data[index + 1] - key[1];
  const db = data[index + 2] - key[2];
  return dr * dr + dg * dg + db * db;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function colorLuminance(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function colorSaturation(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function rgbToYuv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  return [
    rn * 0.2126 + gn * 0.7152 + bn * 0.0722,
    rn * -0.1146 + gn * -0.3854 + bn * 0.5,
    rn * 0.5 + gn * -0.4542 + bn * -0.0458,
  ];
}

function chromaDistance(data, index, keyYuv) {
  const pixelYuv = rgbToYuv(data[index], data[index + 1], data[index + 2]);
  return Math.hypot(pixelYuv[1] - keyYuv[1], pixelYuv[2] - keyYuv[2]);
}

function isChromaGreen(data, index) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return (
    (g >= 145 && r <= 145 && b <= 155 && g - r >= 45 && g - b >= 35)
    || (g >= 92 && g - r >= 26 && g - b >= 22)
  );
}

function edgeBackgroundColor(image) {
  const samples = [];
  const { width, height, data } = image;
  const add = (x, y) => {
    const index = pixelOffset(image, x, y);
    if (data[index + 3] < 16) return;
    samples.push([data[index], data[index + 1], data[index + 2]]);
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 180))) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 180))) {
    add(0, y);
    add(width - 1, y);
  }
  if (!samples.length) return [255, 255, 255];
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const mid = samples.slice(Math.floor(samples.length * 0.25), Math.ceil(samples.length * 0.75));
  return [0, 1, 2].map((channel) =>
    Math.round(mid.reduce((sum, item) => sum + item[channel], 0) / Math.max(1, mid.length)));
}

function chromaKeyColor(image) {
  const samples = [];
  const { width, height, data } = image;
  const add = (x, y) => {
    const index = pixelOffset(image, x, y);
    if (data[index + 3] >= 16 && isChromaGreen(data, index)) {
      samples.push([data[index], data[index + 1], data[index + 2]]);
    }
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 240))) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 240))) {
    add(0, y);
    add(width - 1, y);
  }
  if (!samples.length) return [0, 255, 0];
  return [0, 1, 2].map((channel) => {
    const values = samples.map((item) => item[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function floodBackgroundMask(image, keyColor, tolerance, seedBottom) {
  const { width, height, data } = image;
  const mask = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  const queue = [];
  const toleranceSq = tolerance * tolerance;

  const push = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pos = y * width + x;
    if (seen[pos]) return;
    const index = pos * 4;
    const alpha = data[index + 3];
    const keyLike = colorDistanceSq(data, index, keyColor) <= toleranceSq;
    const transparent = alpha < 16;
    if (!transparent && !keyLike) return;
    seen[pos] = 1;
    mask[pos] = 255;
    queue.push(pos);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    if (seedBottom) push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const pos = queue[head];
    const x = pos % width;
    const y = Math.floor(pos / width);
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return mask;
}

function chromaMask(image) {
  const mask = new Uint8Array(image.width * image.height);
  for (let pos = 0; pos < mask.length; pos += 1) {
    if (isChromaGreen(image.data, pos * 4)) mask[pos] = 255;
  }
  return mask;
}

function chromaForegroundAlpha(image, keyColor, options = {}) {
  const alpha = new Uint8Array(image.width * image.height);
  const keyYuv = rgbToYuv(keyColor[0], keyColor[1], keyColor[2]);
  const tolerance = Number.isFinite(Number(options.chromaTolerance))
    ? clamp(Number(options.chromaTolerance), 0.01, 0.24)
    : 0.075;
  const smoothness = Number.isFinite(Number(options.chromaSmoothness))
    ? clamp(Number(options.chromaSmoothness), 0.02, 0.36)
    : 0.19;
  const dominanceStart = Number.isFinite(Number(options.greenDominanceStart))
    ? clamp(Number(options.greenDominanceStart), 0, 160)
    : 18;
  const dominanceEnd = Number.isFinite(Number(options.greenDominanceEnd))
    ? clamp(Number(options.greenDominanceEnd), dominanceStart + 1, 240)
    : 118;

  for (let pos = 0; pos < alpha.length; pos += 1) {
    const index = pos * 4;
    if (image.data[index + 3] <= 0) {
      alpha[pos] = 0;
      continue;
    }
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    const dist = chromaDistance(image.data, index, keyYuv);
    const distanceAlpha = Math.pow(smoothstep(tolerance, tolerance + smoothness, dist), 1.35);
    const greenDominance = g - Math.max(r, b);
    const dominanceAlpha = 1 - smoothstep(dominanceStart, dominanceEnd, greenDominance);
    alpha[pos] = Math.round(clamp(Math.min(distanceAlpha, dominanceAlpha), 0, 1) * 255);
  }
  return { alpha, tolerance, smoothness, dominanceStart, dominanceEnd };
}

function countMask(mask) {
  let count = 0;
  for (const value of mask) if (value) count += 1;
  return count;
}

function buildBackgroundMask(image, options = {}) {
  const { width, height } = image;
  const edgeTotal = Math.max(1, width * 2 + height * 2 - 4);
  let edgeGreen = 0;
  for (let x = 0; x < width; x += 1) {
    if (isChromaGreen(image.data, pixelOffset(image, x, 0))) edgeGreen += 1;
    if (isChromaGreen(image.data, pixelOffset(image, x, height - 1))) edgeGreen += 1;
  }
  for (let y = 1; y < height - 1; y += 1) {
    if (isChromaGreen(image.data, pixelOffset(image, 0, y))) edgeGreen += 1;
    if (isChromaGreen(image.data, pixelOffset(image, width - 1, y))) edgeGreen += 1;
  }
  const greenRatio = edgeGreen / edgeTotal;
  if (options.mode === "chroma" || greenRatio >= 0.25) {
    const keyColor = chromaKeyColor(image);
    const matte = chromaForegroundAlpha(image, keyColor, options);
    return {
      mask: chromaMask(image),
      foregroundAlpha: matte.alpha,
      mode: "chroma-green",
      keyColor,
      edgeGreenRatio: greenRatio,
      matte: {
        tolerance: matte.tolerance,
        smoothness: matte.smoothness,
        greenDominanceStart: matte.dominanceStart,
        greenDominanceEnd: matte.dominanceEnd,
      },
    };
  }
  const keyColor = edgeBackgroundColor(image);
  const seedBottom = options.seedBottom === true;
  const tolerance = Math.max(12, Math.min(96, Number(options.tolerance) || 34));
  return {
    mask: floodBackgroundMask(image, keyColor, tolerance, seedBottom),
    mode: "edge-flood",
    keyColor,
    edgeGreenRatio: greenRatio,
  };
}

function applyMaskToAlpha(image, mask) {
  let removed = 0;
  for (let pos = 0; pos < mask.length; pos += 1) {
    if (!mask[pos]) continue;
    const index = pos * 4 + 3;
    if (image.data[index]) removed += 1;
    image.data[index] = 0;
  }
  return removed;
}

function applyForegroundAlpha(image, foregroundAlpha) {
  let removedPixels = 0;
  let softenedPixels = 0;
  let changedPixels = 0;
  for (let pos = 0; pos < foregroundAlpha.length; pos += 1) {
    const index = pos * 4 + 3;
    const originalAlpha = image.data[index];
    const nextAlpha = Math.round((originalAlpha * foregroundAlpha[pos]) / 255);
    if (nextAlpha !== originalAlpha) changedPixels += 1;
    if (originalAlpha > 0 && nextAlpha <= 0) removedPixels += 1;
    if (nextAlpha > 0 && nextAlpha < originalAlpha) softenedPixels += 1;
    image.data[index] = nextAlpha;
  }
  return { removedPixels, softenedPixels, changedPixels };
}

function despillChromaKey(image, keyColor) {
  let adjusted = 0;
  for (let pos = 0; pos < image.width * image.height; pos += 1) {
    const index = pos * 4;
    const alpha = image.data[index + 3];
    if (alpha <= 0) continue;
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    const alphaRatio = alpha / 255;
    if (alphaRatio > 0 && alphaRatio < 0.995) {
      image.data[index] = Math.round(clamp((r - keyColor[0] * (1 - alphaRatio)) / alphaRatio, 0, 255));
      image.data[index + 1] = Math.round(clamp((g - keyColor[1] * (1 - alphaRatio)) / alphaRatio, 0, 255));
      image.data[index + 2] = Math.round(clamp((b - keyColor[2] * (1 - alphaRatio)) / alphaRatio, 0, 255));
      adjusted += 1;
      continue;
    }
    const rb = Math.max(r, b);
    if (g > rb + 12 && g >= 70) {
      image.data[index + 1] = Math.min(g, rb + 8);
      adjusted += 1;
    }
  }
  return adjusted;
}

function isGreenYellowResidue(r, g, b) {
  return (
    (g > b + 16 && g >= r - 24 && r < 190)
    || (g > b + 12 && r > b + 10 && g >= 45 && r < 215 && g >= r - 70)
    || (g > b + 7 && g >= r - 10 && r < 135 && b < 125 && g >= 50)
    || (g > Math.min(r, b) + 8 && r < 180 && b < 150 && g >= 42 && b < r * 0.9)
  );
}

function isPurpleMagentaPaletteColor(r, g, b) {
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  return (
    saturation >= 30
    && r >= 35
    && b >= 40
    && b >= r * 0.45
    && g <= Math.min(r, b) + 14
    && (r >= g + 22 || b >= g + 20)
    && !(r > 220 && g > 185 && b > 185)
  );
}

function hasTransparentNeighbor(image, pos, radius = 2, threshold = 8) {
  const x = pos % image.width;
  const y = Math.floor(pos / image.width);
  for (let dy = -radius; dy <= radius; dy += 1) {
    const ny = y + dy;
    if (ny < 0 || ny >= image.height) continue;
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      if (nx < 0 || nx >= image.width) continue;
      if (image.data[(ny * image.width + nx) * 4 + 3] <= threshold) return true;
    }
  }
  return false;
}

function dominantPurpleMagentaColor(image) {
  let totalWeight = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let pos = 0; pos < image.width * image.height; pos += 1) {
    const index = pos * 4;
    const alpha = image.data[index + 3];
    if (alpha < 180) continue;
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    if (!isPurpleMagentaPaletteColor(r, g, b)) continue;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    const weight = (alpha / 255) * Math.max(1, saturation);
    sumR += r * weight;
    sumG += g * weight;
    sumB += b * weight;
    totalWeight += weight;
  }
  if (!totalWeight) return null;
  return [sumR / totalWeight, sumG / totalWeight, sumB / totalWeight];
}

function matchLuminance(color, reference) {
  const colorLuma = Math.max(1, colorLuminance(color[0], color[1], color[2]));
  const referenceLuma = Math.max(1, colorLuminance(reference[0], reference[1], reference[2]));
  const scale = clamp(referenceLuma / colorLuma, 0.35, 1.8);
  return color.map((channel) => clamp(Math.round(channel * scale), 0, 255));
}

function nearbyCleanEdgeColor(image, pos, radius = 5) {
  const x = pos % image.width;
  const y = Math.floor(pos / image.width);
  let totalWeight = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    const ny = y + dy;
    if (ny < 0 || ny >= image.height) continue;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      if (nx < 0 || nx >= image.width || (dx === 0 && dy === 0)) continue;
      const index = (ny * image.width + nx) * 4;
      const alpha = image.data[index + 3];
      if (alpha < 160) continue;
      const r = image.data[index];
      const g = image.data[index + 1];
      const b = image.data[index + 2];
      if (isGreenYellowResidue(r, g, b) || (g > Math.min(r, b) + 8 && r < 185 && b < 170)) continue;
      const distance = Math.hypot(dx, dy);
      const weight = (alpha / 255) / Math.max(1, distance);
      sumR += r * weight;
      sumG += g * weight;
      sumB += b * weight;
      totalWeight += weight;
    }
  }
  if (!totalWeight) return null;
  return [sumR / totalWeight, sumG / totalWeight, sumB / totalWeight];
}

function suppressChromaEdgeResidue(image, options = {}) {
  const neighborRadius = Number.isFinite(Number(options.neighborRadius))
    ? clamp(Math.round(Number(options.neighborRadius)), 1, 12)
    : 2;
  const neighborThreshold = Number.isFinite(Number(options.neighborThreshold))
    ? clamp(Math.round(Number(options.neighborThreshold)), 0, 255)
    : 8;
  const cleanRadius = Number.isFinite(Number(options.cleanRadius))
    ? clamp(Math.round(Number(options.cleanRadius)), 2, 12)
    : 5;
  const paletteColor = dominantPurpleMagentaColor(image);
  let adjusted = 0;
  for (let pos = 0; pos < image.width * image.height; pos += 1) {
    const index = pos * 4;
    const alpha = image.data[index + 3];
    if (alpha <= 8 || !hasTransparentNeighbor(image, pos, neighborRadius, neighborThreshold)) continue;
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    if (!isGreenYellowResidue(r, g, b)) continue;
    const clean = paletteColor ? matchLuminance(paletteColor, [r, g, b]) : nearbyCleanEdgeColor(image, pos, cleanRadius);
    if (clean) {
      const strength = paletteColor ? (alpha < 245 ? 0.98 : 0.94) : (alpha < 250 ? 0.86 : 0.68);
      const rr = Math.round(r * (1 - strength) + clean[0] * strength);
      let gg = Math.round(g * (1 - strength) + clean[1] * strength);
      let bb = Math.round(b * (1 - strength) + clean[2] * strength);
      if (paletteColor) {
        gg = Math.min(gg, Math.max(6, Math.round(Math.min(rr, bb) * 0.52)));
        if (bb < rr * 0.58 && rr < 190) bb = Math.max(bb, Math.round(rr * 0.78));
      }
      image.data[index] = rr;
      image.data[index + 1] = gg;
      image.data[index + 2] = bb;
    } else {
      image.data[index + 1] = Math.min(g, Math.max(b + 10, Math.round(r * 0.72)));
      image.data[index + 2] = Math.max(b, Math.min(180, Math.round((r + b) / 2)));
    }
    adjusted += 1;
  }
  return adjusted;
}

function isLightNeutralResidue(r, g, b) {
  const luma = colorLuminance(r, g, b);
  const saturation = colorSaturation(r, g, b);
  return (
    (luma >= 224 && saturation <= 118)
    || (luma >= 198 && saturation <= 46)
    || (luma >= 178 && saturation <= 24)
  );
}

function nearbyForegroundColor(image, pos, radius = 8) {
  const x = pos % image.width;
  const y = Math.floor(pos / image.width);
  let totalWeight = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    const ny = y + dy;
    if (ny < 0 || ny >= image.height) continue;
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      if (nx < 0 || nx >= image.width || (dx === 0 && dy === 0)) continue;
      const index = (ny * image.width + nx) * 4;
      const alpha = image.data[index + 3];
      if (alpha < 220) continue;
      const r = image.data[index];
      const g = image.data[index + 1];
      const b = image.data[index + 2];
      if (isLightNeutralResidue(r, g, b) || isGreenYellowResidue(r, g, b)) continue;
      const saturation = colorSaturation(r, g, b);
      const luma = colorLuminance(r, g, b);
      const distance = Math.hypot(dx, dy);
      const colorWeight = 1 + saturation / 48 + Math.max(0, 185 - luma) / 110;
      const weight = (alpha / 255) * colorWeight / Math.max(1, distance);
      sumR += r * weight;
      sumG += g * weight;
      sumB += b * weight;
      totalWeight += weight;
    }
  }
  if (!totalWeight) return null;
  return [sumR / totalWeight, sumG / totalWeight, sumB / totalWeight];
}

function suppressLightEdgeResidue(image, options = {}) {
  const neighborRadius = Number.isFinite(Number(options.neighborRadius))
    ? clamp(Math.round(Number(options.neighborRadius)), 1, 12)
    : 4;
  const neighborThreshold = Number.isFinite(Number(options.neighborThreshold))
    ? clamp(Math.round(Number(options.neighborThreshold)), 0, 255)
    : 16;
  const cleanRadius = Number.isFinite(Number(options.cleanRadius))
    ? clamp(Math.round(Number(options.cleanRadius)), 2, 16)
    : 9;
  let adjustedPixels = 0;
  let removedPixels = 0;
  for (let pos = 0; pos < image.width * image.height; pos += 1) {
    const index = pos * 4;
    const alpha = image.data[index + 3];
    if (alpha <= 0 || !hasTransparentNeighbor(image, pos, neighborRadius, neighborThreshold)) continue;
    const r = image.data[index];
    const g = image.data[index + 1];
    const b = image.data[index + 2];
    if (!isLightNeutralResidue(r, g, b)) continue;
    const luma = colorLuminance(r, g, b);
    const saturation = colorSaturation(r, g, b);
    const clean = nearbyForegroundColor(image, pos, cleanRadius);
    if (!clean) {
      if (alpha <= 56 && luma >= 198 && saturation <= 52) {
        image.data[index + 3] = 0;
        removedPixels += 1;
      }
      continue;
    }
    const cleanLuma = colorLuminance(clean[0], clean[1], clean[2]);
    const cleanSaturation = colorSaturation(clean[0], clean[1], clean[2]);
    const likelyContaminated = cleanLuma <= luma - 10 || cleanSaturation >= saturation + 16;
    if (!likelyContaminated && !(alpha <= 72 && luma >= 205)) continue;
    if (alpha <= 42 && luma >= 205 && saturation <= 58) {
      image.data[index + 3] = 0;
      removedPixels += 1;
      continue;
    }
    const strength = alpha < 96 ? 0.98 : alpha < 224 ? 0.9 : 0.72;
    const lumaKeep = alpha < 96 ? 0.16 : alpha < 240 ? 0.24 : 0.32;
    const targetLuma = cleanLuma + Math.max(0, luma - cleanLuma) * lumaKeep;
    const matched = matchLuminance(clean, [targetLuma, targetLuma, targetLuma]);
    image.data[index] = Math.round(r * (1 - strength) + matched[0] * strength);
    image.data[index + 1] = Math.round(g * (1 - strength) + matched[1] * strength);
    image.data[index + 2] = Math.round(b * (1 - strength) + matched[2] * strength);
    if (alpha < 224 && cleanLuma <= luma - 28) {
      image.data[index + 3] = Math.max(32, Math.round(alpha * 0.86));
    }
    adjustedPixels += 1;
  }
  return { adjustedPixels, removedPixels };
}

function bleedTransparentRgb(image, alphaThreshold = 0) {
  const total = image.width * image.height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  let filled = 0;

  for (let pos = 0; pos < total; pos += 1) {
    if (image.data[pos * 4 + 3] > alphaThreshold) {
      seen[pos] = 1;
      queue[tail] = pos;
      tail += 1;
    }
  }
  if (!tail) return 0;

  const copyTo = (from, to) => {
    const src = from * 4;
    const dst = to * 4;
    image.data[dst] = image.data[src];
    image.data[dst + 1] = image.data[src + 1];
    image.data[dst + 2] = image.data[src + 2];
    seen[to] = 1;
    queue[tail] = to;
    tail += 1;
    filled += 1;
  };

  while (head < tail) {
    const pos = queue[head];
    head += 1;
    const x = pos % image.width;
    const y = Math.floor(pos / image.width);
    if (x > 0 && !seen[pos - 1]) copyTo(pos, pos - 1);
    if (x + 1 < image.width && !seen[pos + 1]) copyTo(pos, pos + 1);
    if (y > 0 && !seen[pos - image.width]) copyTo(pos, pos - image.width);
    if (y + 1 < image.height && !seen[pos + image.width]) copyTo(pos, pos + image.width);
  }
  return filled;
}

function edgeAlphaSmoothing(image, options = {}) {
  const strength = Number.isFinite(Number(options.edgeSmoothStrength))
    ? clamp(Number(options.edgeSmoothStrength), 0, 0.85)
    : 0.42;
  if (strength <= 0) return { adjustedPixels: 0, expandedPixels: 0 };

  const total = image.width * image.height;
  const sourceAlpha = new Uint8Array(total);
  for (let pos = 0; pos < total; pos += 1) sourceAlpha[pos] = image.data[pos * 4 + 3];

  let adjustedPixels = 0;
  let expandedPixels = 0;
  const weights = [
    [-1, -1, 1], [0, -1, 2], [1, -1, 1],
    [-1, 0, 2], [0, 0, 4], [1, 0, 2],
    [-1, 1, 1], [0, 1, 2], [1, 1, 1],
  ];

  for (let pos = 0; pos < total; pos += 1) {
    const x = pos % image.width;
    const y = Math.floor(pos / image.width);
    let nearTransparent = false;
    let nearForeground = false;
    let sum = 0;
    let weightTotal = 0;
    for (const [dx, dy, weight] of weights) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= image.width || ny < 0 || ny >= image.height) continue;
      const alpha = sourceAlpha[ny * image.width + nx];
      if (alpha <= 4) nearTransparent = true;
      if (alpha >= 96) nearForeground = true;
      sum += alpha * weight;
      weightTotal += weight;
    }
    if (!nearTransparent || !nearForeground) continue;
    const originalAlpha = sourceAlpha[pos];
    const blurredAlpha = sum / Math.max(1, weightTotal);
    let nextAlpha = Math.round(originalAlpha * (1 - strength) + blurredAlpha * strength);
    if (originalAlpha === 0 && nextAlpha < 10) nextAlpha = 0;
    if (nextAlpha === originalAlpha) continue;
    image.data[pos * 4 + 3] = nextAlpha;
    adjustedPixels += 1;
    if (originalAlpha === 0 && nextAlpha > 0) expandedPixels += 1;
  }

  return { adjustedPixels, expandedPixels, strength };
}

function alphaComponents(image, threshold = 32) {
  const { width, height, data } = image;
  const seen = new Uint8Array(width * height);
  const components = [];
  const stack = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start] || data[start * 4 + 3] <= threshold) continue;
      seen[start] = 1;
      stack.length = 0;
      stack.push(start);
      const pixels = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      for (let head = 0; head < stack.length; head += 1) {
        const pos = stack[head];
        pixels.push(pos);
        const px = pos % width;
        const py = Math.floor(pos / width);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        for (const next of [pos - 1, pos + 1, pos - width, pos + width]) {
          if (next < 0 || next >= seen.length || seen[next]) continue;
          const nx = next % width;
          if ((next === pos - 1 && nx === width - 1) || (next === pos + 1 && nx === 0)) continue;
          if (data[next * 4 + 3] <= threshold) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      components.push({ area: pixels.length, bbox: [minX, minY, maxX + 1, maxY + 1], pixels });
    }
  }
  components.sort((a, b) => b.area - a.area);
  return components;
}

function removeDetachedAlphaFragments(image, options = {}) {
  const components = alphaComponents(image, Number(options.alphaThreshold) || 32);
  if (!components.length) return { before: 0, after: 0, removedFragments: 0, removedPixels: 0, largestRemoved: 0 };
  const largest = components[0].area;
  const defaultMinKeepArea = Math.max(80, Math.min(1800, Math.round(largest * 0.003)));
  const minKeepArea = Math.max(1, Math.round(Number(options.minKeepArea) || defaultMinKeepArea));
  let removedFragments = 0;
  let removedPixels = 0;
  let largestRemoved = 0;
  for (const component of components) {
    if (component.area >= minKeepArea) continue;
    removedFragments += 1;
    removedPixels += component.area;
    largestRemoved = Math.max(largestRemoved, component.area);
    for (const pos of component.pixels) image.data[pos * 4 + 3] = 0;
  }
  return {
    before: components.length,
    after: components.length - removedFragments,
    removedFragments,
    removedPixels,
    largestRemoved,
    minKeepArea,
  };
}

function removeAlphaLineArtifacts(image) {
  const main = alphaComponents(image, 128)[0] ?? null;
  const mainTop = main?.bbox?.[1] ?? 0;
  const components = alphaComponents(image, 0);
  let removedFragments = 0;
  let removedPixels = 0;
  let largestRemoved = 0;

  for (const component of components) {
    if (component === main || component.area > 20000) continue;
    const [minX, minY, maxX, maxY] = component.bbox;
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const aspect = boxW / Math.max(1, boxH);
    let sumAlpha = 0;
    let maxAlpha = 0;
    for (const pos of component.pixels) {
      const alpha = image.data[pos * 4 + 3];
      sumAlpha += alpha;
      maxAlpha = Math.max(maxAlpha, alpha);
    }
    const meanAlpha = sumAlpha / Math.max(1, component.area);
    const horizontalLine = boxW >= 80 && boxH <= 8 && aspect >= 12 && meanAlpha <= 150;
    const topLineFragment = (
      main
      && minY < mainTop
      && maxY <= mainTop + 4
      && boxW >= 10
      && boxH <= 6
      && meanAlpha <= 110
      && maxAlpha <= 170
    );
    const softSpeck = component.area <= 72 && maxAlpha <= 72;
    const softIsland = component.area <= 180 && maxAlpha <= 96 && boxW <= 32 && boxH <= 32;
    if (!horizontalLine && !topLineFragment && !softSpeck && !softIsland) continue;
    for (const pos of component.pixels) image.data[pos * 4 + 3] = 0;
    removedFragments += 1;
    removedPixels += component.area;
    largestRemoved = Math.max(largestRemoved, component.area);
  }

  return { removedFragments, removedPixels, largestRemoved };
}

function hasTransparentPixelNearBox(image, bbox, radius = 24) {
  const [minX, minY, maxX, maxY] = bbox;
  const startX = Math.max(0, minX - radius);
  const startY = Math.max(0, minY - radius);
  const endX = Math.min(image.width, maxX + radius);
  const endY = Math.min(image.height, maxY + radius);
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (x >= minX && x < maxX && y >= minY && y < maxY) continue;
      if (image.data[(y * image.width + x) * 4 + 3] <= 8) return true;
    }
  }
  return false;
}

function removeLightBackgroundComponents(image, options = {}) {
  const alphaThreshold = Number.isFinite(Number(options.alphaThreshold))
    ? clamp(Math.round(Number(options.alphaThreshold)), 0, 254)
    : 8;
  const minArea = Number.isFinite(Number(options.minArea))
    ? Math.max(1, Math.round(Number(options.minArea)))
    : 28;
  const maxDistance = Number.isFinite(Number(options.maxDistance))
    ? Math.max(1, Math.round(Number(options.maxDistance)))
    : 32;
  const maxPureDistance = Number.isFinite(Number(options.maxPureDistance))
    ? Math.max(maxDistance, Math.round(Number(options.maxPureDistance)))
    : 80;
  const { width, height, data } = image;
  const seen = new Uint8Array(width * height);
  const stack = [];
  let removedFragments = 0;
  let removedPixels = 0;
  let largestRemoved = 0;

  const isCandidate = (pos) => {
    const index = pos * 4;
    if (data[index + 3] <= alphaThreshold) return false;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return colorLuminance(r, g, b) >= 232 && colorSaturation(r, g, b) <= 16;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start] || !isCandidate(start)) continue;
      seen[start] = 1;
      stack.length = 0;
      stack.push(start);
      const pixels = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let head = 0; head < stack.length; head += 1) {
        const pos = stack[head];
        const px = pos % width;
        const py = Math.floor(pos / width);
        const index = pos * 4;
        pixels.push(pos);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        sumR += data[index];
        sumG += data[index + 1];
        sumB += data[index + 2];
        for (const next of [pos - 1, pos + 1, pos - width, pos + width]) {
          if (next < 0 || next >= seen.length || seen[next]) continue;
          const nx = next % width;
          if ((next === pos - 1 && nx === width - 1) || (next === pos + 1 && nx === 0)) continue;
          if (!isCandidate(next)) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }

      if (pixels.length < minArea) continue;
      const avg = [sumR / pixels.length, sumG / pixels.length, sumB / pixels.length];
      const avgLuma = colorLuminance(avg[0], avg[1], avg[2]);
      const avgSaturation = colorSaturation(avg[0], avg[1], avg[2]);
      const bbox = [minX, minY, maxX + 1, maxY + 1];
      const nearTransparent = hasTransparentPixelNearBox(image, bbox, maxDistance);
      const pureDistantBackground = (
        pixels.length >= 60
        && avgLuma >= 246
        && avgSaturation <= 4
        && hasTransparentPixelNearBox(image, bbox, maxPureDistance)
      );
      if (avgLuma < 238 || avgSaturation > 12 || (!nearTransparent && !pureDistantBackground)) continue;
      for (const pos of pixels) data[pos * 4 + 3] = 0;
      removedFragments += 1;
      removedPixels += pixels.length;
      largestRemoved = Math.max(largestRemoved, pixels.length);
    }
  }

  return { removedFragments, removedPixels, largestRemoved };
}

function composeOnColor(image, color) {
  const out = { width: image.width, height: image.height, data: Buffer.alloc(image.width * image.height * 4) };
  for (let pos = 0; pos < image.width * image.height; pos += 1) {
    const index = pos * 4;
    const alpha = image.data[index + 3] / 255;
    out.data[index] = Math.round(image.data[index] * alpha + color[0] * (1 - alpha));
    out.data[index + 1] = Math.round(image.data[index + 1] * alpha + color[1] * (1 - alpha));
    out.data[index + 2] = Math.round(image.data[index + 2] * alpha + color[2] * (1 - alpha));
    out.data[index + 3] = 255;
  }
  return out;
}

function resizeNearest(image, maxSize) {
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = { width, height, data: Buffer.alloc(width * height * 4) };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor(x / scale));
      const sy = Math.min(image.height - 1, Math.floor(y / scale));
      image.data.copy(out.data, (y * width + x) * 4, (sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4);
    }
  }
  return out;
}

function auditBackgroundPixel(panelName, x, y, tile = 32) {
  if (panelName === "app") return [255, 248, 238];
  if (panelName === "dark") return [18, 18, 18];
  if (panelName === "blue") return [0, 120, 255];
  return ((Math.floor(x / tile) + Math.floor(y / tile)) % 2) ? [210, 210, 210] : [255, 255, 255];
}

function writeBackgroundRemovalAudit(original, result, destination) {
  const panels = [
    { name: "original", image: resizeNearest(original, 260), flat: true },
    { name: "app", image: resizeNearest(composeOnColor(result, [255, 248, 238]), 260) },
    { name: "dark", image: resizeNearest(composeOnColor(result, [18, 18, 18]), 260) },
    { name: "blue", image: resizeNearest(composeOnColor(result, [0, 120, 255]), 260) },
    { name: "checker", image: resizeNearest(result, 260), checker: true },
  ];
  const cell = 280;
  const labelHeight = 24;
  const out = {
    width: cell * panels.length,
    height: cell + labelHeight,
    data: Buffer.alloc(cell * panels.length * (cell + labelHeight) * 4, 255),
  };
  for (const [panelIndex, panel] of panels.entries()) {
    const ox = panelIndex * cell + Math.floor((cell - panel.image.width) / 2);
    const oy = Math.floor((cell - panel.image.height) / 2);
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const dst = (y * out.width + panelIndex * cell + x) * 4;
        const bg = auditBackgroundPixel(panel.checker ? "checker" : panel.name, x, y);
        out.data[dst] = bg[0];
        out.data[dst + 1] = bg[1];
        out.data[dst + 2] = bg[2];
        out.data[dst + 3] = 255;
      }
    }
    for (let y = 0; y < panel.image.height; y += 1) {
      for (let x = 0; x < panel.image.width; x += 1) {
        const src = (y * panel.image.width + x) * 4;
        const dst = ((oy + y) * out.width + ox + x) * 4;
        const alpha = panel.flat ? 1 : panel.image.data[src + 3] / 255;
        out.data[dst] = Math.round(panel.image.data[src] * alpha + out.data[dst] * (1 - alpha));
        out.data[dst + 1] = Math.round(panel.image.data[src + 1] * alpha + out.data[dst + 1] * (1 - alpha));
        out.data[dst + 2] = Math.round(panel.image.data[src + 2] * alpha + out.data[dst + 2] * (1 - alpha));
        out.data[dst + 3] = 255;
      }
    }
  }
  writeFileSync(destination, encodeRgbaPng(out));
}

function normalizeBackgroundRemovalEngine(value) {
  const engine = String(value ?? "").trim().toLowerCase();
  if (["auto", "smart", "ai-auto", "auto-ai"].includes(engine)) return "auto";
  if (["rembg", "ai", "ai-matting", "matting"].includes(engine)) return "rembg";
  return "local";
}

function resolveRembgBinary(options = {}) {
  const explicit = String(process.env.IMAGE_ARRANGER_REMBG_BIN ?? "").trim();
  if (explicit) {
    if (explicit.includes("/") || explicit.includes("\\")) {
      const binary = isAbsolute(explicit) ? explicit : resolve(TOOL_ROOT, explicit);
      return existsSync(binary) ? binary : "";
    }
    return explicit;
  }

  const bundled = join(TOOL_ROOT, ".venv-rembg", "bin", "rembg");
  if (existsSync(bundled)) return bundled;
  return "rembg";
}

function sanitizedRembgModel(value) {
  const model = String(value ?? "").trim();
  if (!model) return "";
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(model)) {
    throw new HttpError(400, "Invalid rembg model name");
  }
  return model;
}

function numericOption(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.round(clamp(number, min, max));
}

function sanitizeBackgroundRemovalOptions(raw = {}) {
  const input = raw && typeof raw === "object" ? raw : {};
  const options = {};
  if (input.engine !== undefined) options.engine = normalizeBackgroundRemovalEngine(input.engine);
  if (input.mode !== undefined) options.mode = String(input.mode);
  if (input.seedBottom !== undefined) options.seedBottom = Boolean(input.seedBottom);
  if (input.keepFragments !== undefined) options.keepFragments = Boolean(input.keepFragments);
  if (input.keepArtifacts !== undefined) options.keepArtifacts = Boolean(input.keepArtifacts);
  if (input.keepLightComponents !== undefined) options.keepLightComponents = Boolean(input.keepLightComponents);
  if (input.alphaMatting !== undefined) options.alphaMatting = Boolean(input.alphaMatting);
  if (input.postProcessMask !== undefined) options.postProcessMask = Boolean(input.postProcessMask);
  if (input.rembgModel !== undefined) {
    const model = sanitizedRembgModel(input.rembgModel);
    if (model) options.rembgModel = model;
  }
  const edgeSmoothStrength = Number(input.edgeSmoothStrength);
  if (Number.isFinite(edgeSmoothStrength)) options.edgeSmoothStrength = clamp(edgeSmoothStrength, 0, 0.85);
  const foreground = numericOption(input.alphaMattingForegroundThreshold, 0, 255);
  if (foreground !== undefined) options.alphaMattingForegroundThreshold = foreground;
  const background = numericOption(input.alphaMattingBackgroundThreshold, 0, 255);
  if (background !== undefined) options.alphaMattingBackgroundThreshold = background;
  const erode = numericOption(input.alphaMattingErodeSize, 0, 64);
  if (erode !== undefined) options.alphaMattingErodeSize = erode;
  return options;
}

function removeBackgroundWithRembg(sourcePath, outputPath, auditPath, options = {}, originalImage = null) {
  const binary = resolveRembgBinary(options);
  if (!binary) throw new Error("rembg binary was not found");

  const model = String(options.rembgModel ?? process.env.IMAGE_ARRANGER_REMBG_MODEL ?? DEFAULT_REMBG_MODEL).trim() || DEFAULT_REMBG_MODEL;
  const tempOutput = `${outputPath}.rembg-${randomUUID().slice(0, 8)}.png`;
  const args = ["i", "-m", model];
  if (options.alphaMatting !== false) args.push("-a");
  if (options.postProcessMask === true) args.push("-ppm");
  if (Number.isFinite(Number(options.alphaMattingForegroundThreshold))) {
    args.push("-af", String(Math.round(Number(options.alphaMattingForegroundThreshold))));
  }
  if (Number.isFinite(Number(options.alphaMattingBackgroundThreshold))) {
    args.push("-ab", String(Math.round(Number(options.alphaMattingBackgroundThreshold))));
  }
  if (Number.isFinite(Number(options.alphaMattingErodeSize))) {
    args.push("-ae", String(Math.round(Number(options.alphaMattingErodeSize))));
  }
  args.push(sourcePath, tempOutput);

  ensureDir(dirname(outputPath));
  try {
    execFileSync(binary, args, {
      cwd: TOOL_ROOT,
      stdio: "ignore",
      timeout: REMBG_TIMEOUT_MS,
    });
    if (!existsSync(tempOutput)) throw new Error("rembg did not write an output file");
    const original = originalImage ?? decodePngRgba(readFileSync(sourcePath));
    const result = decodePngRgba(readFileSync(tempOutput));
    const fragments = options.keepFragments === true
      ? { before: 0, after: 0, removedFragments: 0, removedPixels: 0, largestRemoved: 0 }
      : removeDetachedAlphaFragments(result, options);
    const lineArtifacts = options.keepArtifacts === true
      ? { removedFragments: 0, removedPixels: 0, largestRemoved: 0 }
      : removeAlphaLineArtifacts(result);
    const lightResidue = suppressLightEdgeResidue(result, { neighborRadius: 5, neighborThreshold: 48, cleanRadius: 10 });
    const rgbBleedPixels = bleedTransparentRgb(result);
    const edgeSmoothing = edgeAlphaSmoothing(result, {
      ...options,
      edgeSmoothStrength: Number.isFinite(Number(options.edgeSmoothStrength))
        ? options.edgeSmoothStrength
        : 0.24,
    });
    const postSmoothRgbBleedPixels = bleedTransparentRgb(result);
    writeFileSync(outputPath, encodeRgbaPng(result));
    if (auditPath) {
      ensureDir(dirname(auditPath));
      writeBackgroundRemovalAudit(original, result, auditPath);
    }
    return {
      width: result.width,
      height: result.height,
      mode: `rembg:${model}`,
      engine: "rembg",
      model,
      alphaMatting: options.alphaMatting !== false,
      keyColor: null,
      edgeGreenRatio: 0,
      maskPixels: 0,
      removedPixels: 0,
      softenedPixels: 0,
      changedPixels: 0,
      decontaminatedPixels: 0,
      residuePixels: 0,
      rgbBleedPixels,
      edgeSmoothing,
      lightResidue,
      postSmoothResiduePixels: 0,
      postSmoothRgbBleedPixels,
      fragments,
      lineArtifacts,
      lightComponents: { removedFragments: 0, removedPixels: 0, largestRemoved: 0 },
      matte: { source: "rembg", model },
    };
  } finally {
    if (existsSync(tempOutput)) rmSync(tempOutput, { force: true });
  }
}

function removeBackgroundLocally(original, outputPath, auditPath, options = {}) {
  const result = { width: original.width, height: original.height, data: Buffer.from(original.data) };
  const background = buildBackgroundMask(result, options);
  const matteResult = background.foregroundAlpha
    ? applyForegroundAlpha(result, background.foregroundAlpha)
    : { removedPixels: applyMaskToAlpha(result, background.mask), softenedPixels: 0, changedPixels: 0 };
  const decontaminatedPixels = background.mode === "chroma-green" ? despillChromaKey(result, background.keyColor) : 0;
  const fragments = options.keepFragments === true
    ? { before: 0, after: 0, removedFragments: 0, removedPixels: 0, largestRemoved: 0 }
    : removeDetachedAlphaFragments(result, options);
  const lineArtifacts = options.keepArtifacts === true
    ? { removedFragments: 0, removedPixels: 0, largestRemoved: 0 }
    : removeAlphaLineArtifacts(result);
  const lightComponents = background.mode === "edge-flood" && options.keepLightComponents !== true
    ? removeLightBackgroundComponents(result, options)
    : { removedFragments: 0, removedPixels: 0, largestRemoved: 0 };
  const residuePixels = background.mode === "chroma-green"
    ? suppressChromaEdgeResidue(result, { neighborRadius: 5, neighborThreshold: 64, cleanRadius: 8 })
    : 0;
  const rgbBleedPixels = bleedTransparentRgb(result);
  const edgeSmoothing = edgeAlphaSmoothing(result, options);
  const lightResidue = suppressLightEdgeResidue(result, { neighborRadius: 5, neighborThreshold: 48, cleanRadius: 10 });
  const postSmoothResiduePixels = background.mode === "chroma-green"
    ? suppressChromaEdgeResidue(result, { neighborRadius: 10, neighborThreshold: 220, cleanRadius: 8 })
    : 0;
  const postSmoothRgbBleedPixels = bleedTransparentRgb(result);
  ensureDir(dirname(outputPath));
  writeFileSync(outputPath, encodeRgbaPng(result));
  if (auditPath) {
    ensureDir(dirname(auditPath));
    writeBackgroundRemovalAudit(original, result, auditPath);
  }
  return {
    width: result.width,
    height: result.height,
    mode: background.mode,
    keyColor: background.keyColor,
    edgeGreenRatio: Number(background.edgeGreenRatio.toFixed(3)),
    maskPixels: countMask(background.mask),
    removedPixels: matteResult.removedPixels,
    softenedPixels: matteResult.softenedPixels,
    changedPixels: matteResult.changedPixels,
    decontaminatedPixels,
    residuePixels,
    rgbBleedPixels,
    edgeSmoothing,
    lightResidue,
    postSmoothResiduePixels,
    postSmoothRgbBleedPixels,
    fragments,
    lineArtifacts,
    lightComponents,
    matte: background.matte,
  };
}

function removeBackgroundFromPng(sourcePath, outputPath, auditPath, options = {}) {
  const original = decodePngRgba(readFileSync(sourcePath));
  const engine = normalizeBackgroundRemovalEngine(
    options.engine ?? process.env.IMAGE_ARRANGER_BACKGROUND_REMOVAL_ENGINE,
  );
  if (engine === "rembg") {
    try {
      return removeBackgroundWithRembg(sourcePath, outputPath, auditPath, options, original);
    } catch (error) {
      if (options.fallbackToLocal === false) throw error;
      const report = removeBackgroundLocally(original, outputPath, auditPath, options);
      return { ...report, engine: "local", fallbackReason: error?.message ?? String(error) };
    }
  }

  if (engine === "auto") {
    const preview = { width: original.width, height: original.height, data: Buffer.from(original.data) };
    const background = buildBackgroundMask(preview, options);
    if (background.mode !== "chroma-green") {
      try {
        return removeBackgroundWithRembg(sourcePath, outputPath, auditPath, options, original);
      } catch (error) {
        const report = removeBackgroundLocally(original, outputPath, auditPath, options);
        return { ...report, engine: "local", fallbackReason: error?.message ?? String(error) };
      }
    }
  }

  const report = removeBackgroundLocally(original, outputPath, auditPath, options);
  return { ...report, engine: "local" };
}

function copyAssetIntoWorkspace(context, characterId, entryId, body) {
  const sourceFileRaw = String(body.sourceFile ?? "").trim();
  if (!sourceFileRaw) throw new HttpError(400, "Asset source file is required");
  if (isAbsolute(sourceFileRaw)) {
    throw new HttpError(400, "Asset source file must be a project-relative path");
  }
  const sourceFile = safeResolve(context.projectRoot, sourceFileRaw);
  if (!existsSync(sourceFile) || statSync(sourceFile).isDirectory()) {
    throw new HttpError(404, "Asset source file was not found");
  }
  const ext = extname(sourceFile).toLowerCase();
  if (!ASSET_EXTENSIONS.has(ext)) {
    throw new HttpError(400, "Unsupported asset file type");
  }
  const stats = statSync(sourceFile);
  if (stats.size > MAX_ASSET_BYTES) {
    throw new HttpError(413, "Asset file is too large");
  }
  const assetName = safeSlug(body.name || basename(sourceFile, ext), "asset");
  const destinationDir = join(context.assetDir, safeSlug(characterId, "character"), safeSlug(entryId, "entry"));
  ensureDir(destinationDir);
  let destination = join(destinationDir, `${assetName}${ext}`);
  let suffix = 1;
  while (existsSync(destination)) {
    suffix += 1;
    destination = join(destinationDir, `${assetName}-${suffix}${ext}`);
  }
  copyFileSync(sourceFile, destination);
  const asset = {
    id: `asset-${safeSlug(entryId)}-${randomUUID().slice(0, 8)}`,
    kind: ext === ".mp4" || ext === ".webm" ? "video" : "image",
    file: toPosixPath(relative(context.projectRoot, destination)),
    name: body.name || basename(destination, ext),
    adopted: Boolean(body.adopted),
    prompt: String(body.prompt ?? ""),
    sourceLicense: String(body.sourceLicense ?? ""),
    aiGenerated: Boolean(body.aiGenerated),
    humanReviewed: Boolean(body.humanReviewed),
    usageNotes: String(body.usageNotes ?? ""),
    tags: body.reference ? ["source-reference"] : [],
  };
  applyPngMetadata(asset, destination);
  return asset;
}

function createBackgroundRemovedAsset(context, character, targetEntry, sourceAsset, options = {}) {
  if (!sourceAsset?.file || sourceAsset.kind === "video" || !/\.png$/i.test(sourceAsset.file)) {
    return { skipped: true, reason: "not-png" };
  }
  if (options.dedupe) {
    const existing = (targetEntry.assets ?? []).find((assetItem) =>
      assetItem.backgroundRemoval?.sourceAssetId === sourceAsset.id
      && assetItem.file
      && workspaceAssetFileExists(context, assetItem.file));
    if (existing) return { skipped: true, reason: "already-exists", asset: existing };
  }

  const sourcePath = safeResolve(context.projectRoot, sourceAsset.file);
  if (!isPathInsideAny(sourcePath, workspaceAssetRoots(context))) {
    throw new HttpError(403, "Background removal source must be inside workspace assets or outputs");
  }
  if (!existsSync(sourcePath) || statSync(sourcePath).isDirectory()) {
    return { skipped: true, reason: "source-missing" };
  }

  const destinationDir = join(context.assetDir, safeSlug(character.id, "character"), safeSlug(targetEntry.id, "entry"));
  ensureDir(destinationDir);
  const stem = safeSlug(`${sourceAsset.name || basename(sourceAsset.file, extname(sourceAsset.file))}-transparent`, "transparent");
  let destination = join(destinationDir, `${stem}.png`);
  let auditDestination = join(destinationDir, `${stem}-review.png`);
  let suffix = 1;
  while (existsSync(destination) || existsSync(auditDestination)) {
    suffix += 1;
    destination = join(destinationDir, `${stem}-${suffix}.png`);
    auditDestination = join(destinationDir, `${stem}-${suffix}-review.png`);
  }

  let report;
  try {
    report = removeBackgroundFromPng(sourcePath, destination, auditDestination, options.removeBackgroundOptions ?? {});
  } catch (error) {
    rmSync(destination, { force: true });
    rmSync(auditDestination, { force: true });
    throw error;
  }
  const reviewFile = toPosixPath(relative(context.projectRoot, auditDestination));
  const newAsset = {
    id: `asset-${safeSlug(targetEntry.id)}-${randomUUID().slice(0, 8)}`,
    kind: "image",
    file: toPosixPath(relative(context.projectRoot, destination)),
    name: basename(destination, ".png"),
    adopted: false,
    prompt: sourceAsset.prompt ?? "",
    sourceLicense: sourceAsset.sourceLicense ?? "",
    aiGenerated: Boolean(sourceAsset.aiGenerated),
    humanReviewed: false,
    usageNotes: [
      `Background removed from ${sourceAsset.name || sourceAsset.id}.`,
      `Review composite: ${reviewFile}.`,
      `mode=${report.mode}, removed=${report.removedPixels}px, fragments=${report.fragments.removedFragments}, lines=${report.lineArtifacts.removedFragments}.`,
    ].join(" "),
    tags: [...new Set([...(sourceAsset.tags ?? []).filter((tag) => tag !== "source-reference"), "background-removed"])],
    backgroundRemoval: {
      sourceAssetId: sourceAsset.id,
      sourceFile: sourceAsset.file,
      reviewFile,
      report,
      createdAt: nowIso(),
    },
  };
  return { skipped: false, asset: newAsset, reviewFile, report };
}

function findRegisteredResultAsset(entryItem, result) {
  const resultFile = String(result?.file ?? "").trim();
  const resultAssetId = String(result?.assetId ?? "").trim();
  if (resultAssetId) {
    const byId = (entryItem.assets ?? []).find((assetItem) => assetItem.id === resultAssetId);
    if (byId) return byId;
  }
  if (!resultFile) return null;
  const resultLeaf = basename(resultFile);
  const generated = (entryItem.assets ?? []).filter((assetItem) =>
    assetItem.file
    && !(assetItem.tags ?? []).includes("source-reference")
    && !(assetItem.tags ?? []).includes("background-removed"));
  return [...generated].reverse().find((assetItem) =>
    assetItem.file === resultFile || basename(assetItem.file) === resultLeaf) ?? null;
}

function registerCompletionResultAssets(context, state, completedTargets) {
  const rows = [];
  let deckChanged = false;
  const changedRequestPaths = new Set();

  for (const { requestPath, requestPayload, target } of completedTargets) {
    const action = target.action ?? (target.assetId ? "improve" : "generate");
    if (target.status !== "completed" || !["generate", "improve"].includes(action)) continue;
    const character = state.characters?.find((item) => item.id === requestPayload.character);
    const targetEntry = character ? findEntryInCharacter(character, target.entryId) : null;
    if (!character || !targetEntry) continue;

    for (const result of target.results ?? []) {
      const resultFile = String(result?.file ?? "").trim();
      if (!resultFile || isAbsolute(resultFile)) {
        rows.push({ entryId: target.entryId, file: resultFile, skipped: true, reason: resultFile ? "absolute-file" : "missing-file" });
        continue;
      }
      let sourcePath;
      try {
        sourcePath = safeResolve(context.projectRoot, resultFile);
      } catch {
        rows.push({ entryId: target.entryId, file: resultFile, skipped: true, reason: "outside-project" });
        continue;
      }
      if (!existsSync(sourcePath) || statSync(sourcePath).isDirectory()) {
        rows.push({ entryId: target.entryId, file: resultFile, skipped: true, reason: "file-missing" });
        continue;
      }

      let sourceAsset = findRegisteredResultAsset(targetEntry, result);
      if (!sourceAsset) {
        sourceAsset = copyAssetIntoWorkspace(context, character.id, targetEntry.id, {
          sourceFile: resultFile,
          name: result.name ?? result.assetName ?? basename(resultFile, extname(resultFile)),
          prompt: result.prompt ?? target.prompt ?? target.basePrompt ?? "",
          sourceLicense: result.sourceLicense ?? "",
          aiGenerated: result.aiGenerated ?? true,
          humanReviewed: result.humanReviewed ?? false,
          usageNotes: result.usageNotes ?? "Registered automatically from request completion.",
          adopted: false,
        });
        targetEntry.assets = [...(targetEntry.assets ?? []), sourceAsset];
        result.assetId = sourceAsset.id;
        result.registeredFile = sourceAsset.file;
        deckChanged = true;
        if (requestPath) changedRequestPaths.add(requestPath);
      } else if (!result.assetId) {
        result.assetId = sourceAsset.id;
        if (requestPath) changedRequestPaths.add(requestPath);
      }

      const wantsTransparent = result.removeBackground !== false && target.autoRemoveBackground !== false;
      let transparent = null;
      if (wantsTransparent && sourceAsset.kind !== "video" && /\.png$/i.test(sourceAsset.file) && !(sourceAsset.tags ?? []).includes("background-removed")) {
        try {
          transparent = createBackgroundRemovedAsset(context, character, targetEntry, sourceAsset, {
            dedupe: true,
            removeBackgroundOptions: {
              engine: "auto",
              mode: "auto",
              seedBottom: false,
            },
          });
          if (!transparent.skipped && transparent.asset) {
            targetEntry.assets = [...(targetEntry.assets ?? []), transparent.asset];
            result.transparentAssetId = transparent.asset.id;
            result.transparentFile = transparent.asset.file;
            result.backgroundRemovalReviewFile = transparent.reviewFile;
            deckChanged = true;
            if (requestPath) changedRequestPaths.add(requestPath);
          } else if (transparent.asset) {
            result.transparentAssetId = transparent.asset.id;
            result.transparentFile = transparent.asset.file;
            result.backgroundRemovalReviewFile = transparent.asset.backgroundRemoval?.reviewFile;
            if (requestPath) changedRequestPaths.add(requestPath);
          }
        } catch (error) {
          transparent = { skipped: true, reason: "background-removal-failed", error: error?.message ?? String(error) };
        }
      }

      rows.push({
        entryId: target.entryId,
        file: resultFile,
        assetId: sourceAsset.id,
        transparentAssetId: result.transparentAssetId ?? "",
        transparentFile: result.transparentFile ?? "",
        skipped: false,
        backgroundRemoval: transparent
          ? {
            skipped: Boolean(transparent.skipped),
            reason: transparent.reason ?? "",
            error: transparent.error ?? "",
            reviewFile: transparent.reviewFile ?? transparent.asset?.backgroundRemoval?.reviewFile ?? "",
            report: transparent.report ?? transparent.asset?.backgroundRemoval?.report ?? null,
          }
          : { skipped: true, reason: wantsTransparent ? "not-png" : "disabled" },
      });
    }
  }

  if (deckChanged) state.updatedAt = nowIso();
  for (const requestPath of changedRequestPaths) {
    const completed = completedTargets.find((item) => item.requestPath === requestPath);
    if (completed?.requestPayload) {
      completed.requestPayload.updatedAt = nowIso();
      writeJson(requestPath, completed.requestPayload);
    }
  }
  return { rows, deckChanged };
}


// Minimal stored (no compression) ZIP writer — keeps the bulk-download
// endpoint dependency-free.
function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = file.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([dir, name]));
    offset += 30 + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}

// API response-shape convention (P3-API-1):
//   - GET /api/state returns the deck state object BARE (no envelope). This is
//     an intentional, frozen contract: the frontend loads it directly as the
//     app state (app.js), and changing it would be a breaking change. The bare
//     object is self-identifying via its `schema`/`version` fields.
//   - Every OTHER endpoint returns an envelope: `{ ok: true, ... }` on success
//     (mutations also echo the resulting `state`), and `{ ok: false, error }`
//     on failure (see sendError). New endpoints should follow the envelope
//     form; /api/state is the sole documented exception.
async function handleApi(request, response, context, url) {
  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, readState(context.stateFile, context.projectRoot, context.init));
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/requests") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    sendJson(response, 200, {
      ok: true,
      projectRoot: toPosixPath(context.projectRoot),
      requests: listRequestedTargets(context, state),
    });
    return true;
  }
  if (request.method === "PUT" && url.pathname === "/api/state") {
    const body = await readBody(request);
    const current = readState(context.stateFile, context.projectRoot, context.init);
    if (body.updatedAt && current.updatedAt && body.updatedAt !== current.updatedAt) {
      sendJson(response, 409, {
        ok: false,
        error: "State was updated elsewhere. Reload before saving.",
        serverUpdatedAt: current.updatedAt,
      });
      return true;
    }
    normalizeState(body);
    body.updatedAt = nowIso();
    writeState(context.stateFile, body);
    sendJson(response, 200, { ok: true, state: body });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/requests") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const requestPayload = buildRequest(state, body, context);
    ensureDir(context.requestDir);
    ensureDir(context.outputDir);
    const requestPath = join(context.requestDir, `${requestPayload.requestId}.json`);
    writeJson(requestPath, requestPayload);
    applyRequestStatus(state, requestPayload.targets, "requested", requestPayload.character);
    recomputeRequestedStatuses(state, context);
    writeState(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      request: requestPayload,
      requestFile: toPosixPath(relative(context.projectRoot, requestPath)),
      state,
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/requests/update") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const result = updateRequestTarget(context, state, body);
    sendJson(response, 200, {
      ok: true,
      request: result.requestPayload,
      target: result.target,
      deckUpdated: result.deckUpdated,
      existsInDeck: result.existsInDeck,
      requests: listRequestedTargets(context, state),
      state,
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/requests/cancel") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const selectors = (body.targets ?? []).map((target) => ({
      requestId: target.requestId ?? body.requestId ?? "",
      targetIndex: target.targetIndex,
      action: normalizeRequestAction(target.action),
      entryId: target.entryId,
      assetId: target.assetId ?? "",
    })).filter((target) => (target.requestId && target.targetIndex !== undefined) || target.entryId);
    if (!selectors.length) throw new HttpError(400, "No request targets to cancel");
    const cancelled = cancelRequestFiles(context, selectors);
    recomputeRequestedStatuses(state, context);
    writeState(context.stateFile, state);
    sendJson(response, 200, { ok: true, cancelled, requests: listRequestedTargets(context, state), state });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/requests/complete") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const targets = Array.isArray(body.targets) ? body.targets : [body];
    const selectors = targets.map((target) => ({
      requestId: target.requestId ?? body.requestId ?? "",
      targetIndex: target.targetIndex ?? body.targetIndex,
      action: normalizeRequestAction(target.action),
      entryId: target.entryId,
      assetId: target.assetId ?? "",
      results: Array.isArray(target.results) ? target.results : (Array.isArray(body.results) ? body.results : []),
      parts: target.parts ?? body.parts ?? null,
      prompt: target.prompt ?? body.prompt ?? null,
      overview: target.overview ?? body.overview ?? null,
      qualityReport: target.qualityReport ?? body.qualityReport ?? null,
      error: target.error ?? body.error ?? null,
    })).filter((target) => (target.requestId && target.targetIndex !== undefined) || target.entryId);
    if (!selectors.length) throw new HttpError(400, "No request targets to complete");
    const { completed, completedTargets } = completeRequestFiles(context, selectors);
    const erroredTargets = completedTargets
      .filter(({ target }) => target.status === "error")
      .map(({ target }) => ({ action: target.action ?? "generate", entryId: target.entryId, assetId: target.assetId ?? "" }));
    if (erroredTargets.length) applyRequestStatus(state, erroredTargets, "error");
    const kitResultsStored = completedTargets.filter(({ target }) => (target.action ?? "") === "analyze" && target.analysisParts?.length).length;
    // draft-prompt 完了: エージェントが書いたプロンプトを entry に取り込み、そのまま生成キューへ
    const draftQueued = [];
    for (const { requestPayload, target } of completedTargets) {
      if ((target.action ?? "") !== "draft-prompt" || target.status !== "completed" || !target.draftedPrompt) continue;
      const character = state.characters?.find((item) => item.id === requestPayload.character);
      const entryItem = character ? findEntryInCharacter(character, target.entryId) : null;
      if (!entryItem) continue;
      entryItem.prompt = target.draftedPrompt;
      if (target.draftedOverview) entryItem.overview = target.draftedOverview;
      const generation = buildRequest(state, {
        characterId: requestPayload.character,
        mode: requestPayload.mode ?? "image",
        targets: [{
          action: "generate",
          entryId: entryItem.id,
          overview: entryItem.overview,
          prompt: target.draftedPrompt,
          referenceUrl: target.referenceUrl ?? null,
          inputs: target.inputs ?? { startFrame: null, endFrame: null, refImages: [] },
          qualityGate: target.qualityGate ?? null,
        }],
      }, context);
      ensureDir(context.requestDir);
      ensureDir(context.outputDir);
      writeJson(join(context.requestDir, `${generation.requestId}.json`), generation);
      draftQueued.push(generation.requestId);
    }
    const postprocess = registerCompletionResultAssets(context, state, completedTargets);
    recomputeRequestedStatuses(state, context);
    writeState(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      completed,
      errored: erroredTargets.length,
      kitResultsStored,
      draftQueued,
      postprocess: postprocess.rows,
      kitResults: listKitResults(context),
      requests: listRequestedTargets(context, state),
      state,
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/characters") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const character = makeCharacterFromBody(state, body);
    state.characters.push(character);
    state.settings = {
      ...(state.settings ?? {}),
      currentCharacterId: character.id,
    };
    state.updatedAt = nowIso();
    writeState(context.stateFile, state);
    sendJson(response, 200, { ok: true, character, state });
    return true;
  }
  const characterRoute = url.pathname.match(/^\/api\/characters\/([^/]+)$/);
  if (characterRoute && (request.method === "PUT" || request.method === "DELETE")) {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const characterId = decodeURIComponent(characterRoute[1]);
    const characterIndex = state.characters.findIndex((item) => item.id === characterId);
    if (characterIndex < 0) throw new HttpError(404, "Character was not found");
    if (request.method === "PUT") {
      const body = await readBody(request);
      const name = String(body.name ?? "").trim();
      if (!name) throw new HttpError(400, "Character name is required");
      const character = state.characters[characterIndex];
      character.name = name;
      character.description = String(body.description ?? "");
      state.updatedAt = nowIso();
      writeState(context.stateFile, state);
      sendJson(response, 200, { ok: true, character, state });
      return true;
    }
    if ((state.characters ?? []).length <= 1) {
      throw new HttpError(400, "The last character cannot be deleted");
    }
    const character = state.characters[characterIndex];
    const cancelled = cancelRequestFiles(context, cancellationTargetsForCharacter(character));
    state.characters.splice(characterIndex, 1);
    const nextCharacter = state.characters[Math.max(0, characterIndex - 1)] ?? state.characters[0];
    state.settings = {
      ...(state.settings ?? {}),
      currentCharacterId: nextCharacter?.id ?? "",
    };
    recomputeRequestedStatuses(state, context);
    writeState(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      cancelled,
      characterId,
      state,
      requests: listRequestedTargets(context, state),
    });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/base-kit/presets") {
    sendJson(response, 200, { ok: true, parts: BASE_KIT_PARTS });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/base-kit/results") {
    sendJson(response, 200, { ok: true, kitResults: listKitResults(context) });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/quality-reports") {
    sendJson(response, 200, { ok: true, qualityReports: listQualityReports(context) });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/base-kit/analyze") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const character = findCharacter(state, body.characterId);
    const selections = Array.isArray(body.sources) && body.sources.length
      ? body.sources
      : [{ entryId: body.sourceEntryId, assetId: body.sourceAssetId }];
    const resolvedSources = [];
    for (const selection of selections) {
      const selEntry = findEntryInCharacter(character, selection.entryId);
      const selAsset = selEntry?.assets?.find((item) => item.id === selection.assetId);
      if (selEntry && selAsset?.file) resolvedSources.push({ entry: selEntry, asset: selAsset });
    }
    if (!resolvedSources.length) throw new HttpError(404, "Source asset was not found");
    const sourceEntry = resolvedSources[0].entry;
    const sourceAsset = resolvedSources[0].asset;
    const sourceFiles = resolvedSources.map((item) => item.asset.file);
    const requestedParts = (Array.isArray(body.parts) ? body.parts : [])
      .map((part) => ({
        key: safeSlug(part.key ?? part.label, "part"),
        label: String(part.label ?? part.key ?? "").trim(),
        category: String(part.category ?? "accessory"),
        hint: String(part.hint ?? ""),
      }))
      .filter((part) => part.label);
    const parts = requestedParts.length ? requestedParts : BASE_KIT_PARTS;
    const characterName = String(body.characterName ?? character.name ?? "").trim() || character.name;
    const extraRequest = String(body.extraRequest ?? "").trim();
    const requestId = `req_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
    const requestPayload = {
      schema: "image-arranger-request.v1",
      requestId,
      status: "requested",
      character: character.id,
      characterName: character.name,
      mode: "kit",
      service: "chatgpt",
      targets: [{
        action: "analyze",
        entryId: sourceEntry.id,
        assetId: sourceAsset.id,
        assetName: sourceAsset.name ?? sourceAsset.id,
        assetFile: sourceAsset.file,
        overview: `${characterName} / ベース分解 分析`,
        prompt: composeAnalyzePrompt(characterName, parts, extraRequest),
        basePrompt: "",
        improvementPrompt: "",
        parts,
        extraRequest,
        expects: "json",
        inputs: { startFrame: null, endFrame: null, refImages: sourceFiles, sourceAsset: sourceAsset.file, sourceAssets: sourceFiles },
        outputDir: null,
        status: "requested",
        results: [],
      }],
      requestedAt: nowIso(),
      completedAt: null,
      note: "Analysis request: the processor reads the attached image, writes part prompts as JSON, and returns them via POST /api/requests/complete (parts) or the paste-import UI. No image generation in this step.",
    };
    ensureDir(context.requestDir);
    const requestPath = join(context.requestDir, `${requestPayload.requestId}.json`);
    writeJson(requestPath, requestPayload);
    applyRequestStatus(state, [
      ...requestPayload.targets,
      ...resolvedSources.slice(1).map((item) => ({ action: "analyze", entryId: item.entry.id, assetId: item.asset.id })),
    ], "requested", character.id);
    recomputeRequestedStatuses(state, context);
    writeState(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      request: requestPayload,
      requestFile: toPosixPath(relative(context.projectRoot, requestPath)),
      requests: listRequestedTargets(context, state),
      state,
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/base-kit/import") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const character = findCharacter(state, body.characterId);
    let parts;
    try {
      parts = parseKitParts(body.json ?? body.parts ?? "");
    } catch {
      throw new HttpError(400, "Invalid analysis JSON");
    }
    if (!parts.length) throw new HttpError(400, "Analysis JSON has no parts");
    let sourceFiles = Array.isArray(body.sourceFiles) ? body.sourceFiles.filter(Boolean) : [];
    if (!sourceFiles.length) {
      const sourceEntry = body.sourceEntryId ? findEntryInCharacter(character, body.sourceEntryId) : null;
      const sourceAsset = sourceEntry?.assets?.find((item) => item.id === body.sourceAssetId);
      const fallback = sourceAsset?.file ?? String(body.sourceFile ?? "");
      sourceFiles = fallback ? [fallback] : [];
    }
    const created = materializeKitParts(character, sourceFiles, parts);
    if (!created.length) throw new HttpError(400, "Analysis JSON has no usable parts (label and prompt are required)");
    if (body.requestId && Number.isInteger(Number(body.targetIndex))) {
      markKitResultImported(context, String(body.requestId), Number(body.targetIndex));
    }
    state.updatedAt = nowIso();
    writeState(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      created: created.map((item) => ({ id: item.id, overview: item.overview, prompt: item.prompt })),
      kitResults: listKitResults(context),
      state,
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/assets/upload") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const character = findCharacter(state, url.searchParams.get("characterId"));
    const targetEntry = findEntryInCharacter(character, url.searchParams.get("entryId"));
    if (!targetEntry) throw new HttpError(404, "Prompt entry was not found");
    const filename = url.searchParams.get("filename") || "upload.png";
    const ext = extname(filename).toLowerCase();
    if (!ASSET_EXTENSIONS.has(ext)) throw new HttpError(400, "Unsupported asset file type");
    const assetName = safeSlug(url.searchParams.get("name") || basename(filename, ext), "asset");
    const destinationDir = join(context.assetDir, safeSlug(character.id, "character"), safeSlug(targetEntry.id, "entry"));
    ensureDir(destinationDir);
    let destination = join(destinationDir, `${assetName}${ext}`);
    let suffix = 1;
    while (existsSync(destination)) {
      suffix += 1;
      destination = join(destinationDir, `${assetName}-${suffix}${ext}`);
    }
    await new Promise((resolveUpload, rejectUpload) => {
      const stream = createWriteStream(destination);
      let size = 0;
      request.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_ASSET_BYTES) {
          stream.destroy();
          request.destroy();
          rejectUpload(new HttpError(413, "Asset file is too large"));
        }
      });
      request.pipe(stream);
      stream.on("finish", resolveUpload);
      stream.on("error", rejectUpload);
      request.on("error", rejectUpload);
    });
    const newAsset = {
      id: `asset-${safeSlug(targetEntry.id)}-${randomUUID().slice(0, 8)}`,
      kind: ext === ".mp4" || ext === ".webm" ? "video" : "image",
      file: toPosixPath(relative(context.projectRoot, destination)),
      name: url.searchParams.get("name") || basename(destination, ext),
      adopted: false,
      prompt: "",
      sourceLicense: "",
      aiGenerated: true,
      humanReviewed: true,
      usageNotes: "",
      tags: [],
    };
    applyPngMetadata(newAsset, destination);
    targetEntry.assets = [...(targetEntry.assets ?? []), newAsset];
    state.updatedAt = nowIso();
    writeState(context.stateFile, state);
    sendJson(response, 200, { ok: true, asset: newAsset, state });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/assets") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const character = findCharacter(state, body.characterId);
    const targetEntry = findEntryInCharacter(character, body.entryId);
    if (!targetEntry) throw new HttpError(404, "Prompt entry was not found");
    const newAsset = copyAssetIntoWorkspace(context, character.id, targetEntry.id, body);
    targetEntry.assets = [...(targetEntry.assets ?? []), newAsset];
    state.updatedAt = nowIso();
    ensureDir(context.assetDir);
    writeState(context.stateFile, state);
    sendJson(response, 200, { ok: true, asset: newAsset, state });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/assets/remove-background") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const character = findCharacter(state, body.characterId);
    const targetEntry = findEntryInCharacter(character, body.entryId);
    if (!targetEntry) throw new HttpError(404, "Prompt entry was not found");
    const sourceAsset = targetEntry.assets?.find((item) => item.id === body.assetId);
    if (!sourceAsset?.file) throw new HttpError(404, "Source asset was not found");
    if (/\.(mp4|webm|gif|jpe?g|webp)$/i.test(sourceAsset.file)) {
      throw new HttpError(400, "Background removal currently supports PNG assets");
    }

    const created = createBackgroundRemovedAsset(context, character, targetEntry, sourceAsset, {
      removeBackgroundOptions: sanitizeBackgroundRemovalOptions(body.options),
    });
    if (created.skipped || !created.asset) throw new HttpError(400, `Background removal skipped: ${created.reason ?? "unknown"}`);
    targetEntry.assets = [...(targetEntry.assets ?? []), created.asset];
    state.updatedAt = nowIso();
    writeState(context.stateFile, state);
    sendJson(response, 200, { ok: true, asset: created.asset, reviewFile: created.reviewFile, report: created.report, state });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/export") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const character = findCharacter(state, url.searchParams.get("characterId"));
    const ids = String(url.searchParams.get("entries") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) throw new HttpError(400, "entries query parameter is required");
    const files = [];
    const seen = new Set();
    for (const id of ids) {
      const entryItem = findEntryInCharacter(character, id);
      if (!entryItem) continue;
      const generated = (entryItem.assets ?? []).filter((asset) => !(asset.tags ?? []).includes("source-reference") && asset.file);
      const adopted = generated.filter((asset) => asset.adopted);
      for (const asset of (adopted.length ? adopted : generated)) {
        const absolute = safeResolve(context.projectRoot, asset.file);
        if (!existsSync(absolute) || statSync(absolute).isDirectory()) continue;
        let name = `${safeSlug(entryItem.overview || entryItem.id, "entry")}/${basename(asset.file)}`;
        let suffix = 1;
        while (seen.has(name)) {
          suffix += 1;
          name = `${safeSlug(entryItem.overview || entryItem.id, "entry")}/${suffix}-${basename(asset.file)}`;
        }
        seen.add(name);
        files.push({ name, data: readFileSync(absolute) });
      }
    }
    if (!files.length) throw new HttpError(404, "No downloadable assets in the selected entries");
    const stamp = nowIso().replace(/[-:]/g, "").slice(0, 15);
    response.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="image-arranger-export-${stamp}.zip"`,
    });
    response.end(buildZip(files));
    return true;
  }
  // Full-deck JSON export: download the canonical deck.json. This is the
  // documented backup/transfer format — the same JSON the server persists,
  // re-importable via POST /api/deck/import.
  if (request.method === "GET" && url.pathname === "/api/deck/export") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const stamp = nowIso().replace(/[-:]/g, "").slice(0, 15);
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="image-arranger-deck-${stamp}.json"`,
    });
    response.end(`${JSON.stringify(state, null, 2)}\n`);
    return true;
  }
  // Full-deck JSON import: replace the current deck with a previously exported
  // one. The incoming deck is normalized (and rejected by the schema guard if
  // it is from a newer server); the previous deck is backed up before the
  // overwrite (writeState -> backupDeck).
  if (request.method === "POST" && url.pathname === "/api/deck/import") {
    const body = await readBody(request);
    const incoming = body && typeof body === "object" && body.deck && typeof body.deck === "object"
      ? body.deck
      : body;
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.characters)) {
      throw new HttpError(400, "Import body must be a deck object with a characters array");
    }
    normalizeState(incoming);
    incoming.updatedAt = nowIso();
    writeState(context.stateFile, incoming);
    sendJson(response, 200, { ok: true, state: incoming });
    return true;
  }
  return false;
}

function scanString(patterns, text) {
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function validateStateForPublish(state, context) {
  const warnings = [];
  const errors = [];
  const serialized = JSON.stringify(state);
  for (const source of scanString(SECRET_PATTERNS, serialized)) {
    errors.push(`Secret-like text matched pattern: ${source}`);
  }
  for (const source of scanString(PROJECT_SPECIFIC_PATTERNS, serialized)) {
    warnings.push(`Project-specific text matched pattern: ${source}`);
  }
  const entries = (state.characters ?? []).flatMap((character) => collectEntries(character));
  for (const entryItem of entries) {
    for (const assetItem of entryItem.assets ?? []) {
      if (assetItem.file && isAbsolute(assetItem.file)) {
        errors.push(`Asset uses absolute path: ${assetItem.file}`);
      }
      if (assetItem.file && !safePathLooksInsideProject(context.projectRoot, assetItem.file)) {
        warnings.push(`Asset path is outside project-relative form: ${assetItem.file}`);
      }
      if (!assetItem.sourceLicense) {
        warnings.push(`Asset is missing sourceLicense: ${assetItem.id ?? assetItem.file}`);
      }
      if (typeof assetItem.aiGenerated !== "boolean") {
        warnings.push(`Asset is missing aiGenerated flag: ${assetItem.id ?? assetItem.file}`);
      }
      if (typeof assetItem.humanReviewed !== "boolean") {
        warnings.push(`Asset is missing humanReviewed flag: ${assetItem.id ?? assetItem.file}`);
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function safePathLooksInsideProject(projectRoot, value) {
  try {
    safeResolve(projectRoot, value);
    return true;
  } catch {
    return false;
  }
}

export function runDoctor(options = {}) {
  const context = {
    init: INIT_MODES.has(options.init) ? options.init : "sample",
    stateFile: resolve(options.stateFile ?? DEFAULT_STATE_FILE),
    requestDir: resolve(options.requestDir ?? DEFAULT_REQUEST_DIR),
    outputDir: resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR),
    assetDir: resolve(options.assetDir ?? DEFAULT_ASSET_DIR),
    projectRoot: resolve(options.projectRoot ?? TOOL_ROOT),
  };
  const state = readState(context.stateFile, context.projectRoot, context.init);
  const publish = validateStateForPublish(state, context);
  const checks = {
    stateFile: context.stateFile,
    requestDir: context.requestDir,
    outputDir: context.outputDir,
    assetDir: context.assetDir,
    publish,
  };
  return {
    ok: publish.ok,
    checks,
  };
}


// ---------------------------------------------------------------------------
// Sample workspace seeding: user-visible base references only. The server does
// not create queued work or generated-looking outputs on first run.
// ---------------------------------------------------------------------------

function seedSampleAssets(context) {
  if (context.init !== "sample") return;
  const state = readState(context.stateFile, context.projectRoot, context.init);
  const character = state.characters?.[0];
  if (!character || character.id !== "sample-character") return;
  const pick = (list, id) => (list ?? []).find((item) => item.id === id);
  const base = character.base ?? {};
  const master = pick(base.master, "base-sample-character-master");
  if (!master) return;
  if ((master.assets ?? []).length) return;

  const specs = [
    { entry: master, source: "aichan_design.png", file: "base-master-adopted.png", adopted: true, name: "Aichan design sheet / AIちゃん設定資料" },
    { entry: master, source: "aichan.png", file: "base-key-visual-adopted.png", adopted: true, name: "Aichan key visual / AIちゃんキー画像" },
  ].filter((spec) => spec.entry);

  const assetIds = new Map();
  for (const spec of specs) {
    const destination = join(context.assetDir, spec.file);
    const source = join(SAMPLE_ASSET_DIR, spec.source);
    if (!existsSync(destination)) {
      if (!existsSync(source)) throw new Error(`Bundled sample asset is missing: ${source}`);
      copyFileSync(source, destination);
    }
    const assetId = `asset-${safeSlug(spec.entry.id)}-${spec.file.replace(/[^a-z0-9]+/gi, "-")}`;
    assetIds.set(spec.file, assetId);
    spec.entry.assets = [...(spec.entry.assets ?? []), {
      id: assetId,
      kind: "image",
      file: toPosixPath(relative(context.projectRoot, destination)),
      name: spec.name,
      adopted: spec.adopted,
      prompt: spec.adopted ? (spec.entry.prompt ?? "") : "",
      sourceLicense: "User-provided sample asset",
      aiGenerated: false,
      humanReviewed: true,
      usageNotes: "Bundled Aichan sample base reference. Replace with your own art before publishing a private workspace.",
      tags: [],
    }];
  }

  recomputeRequestedStatuses(state, context);
  writeState(context.stateFile, state);
}

export function createImageArrangerServer(options = {}) {
  const context = {
    port: options.port ?? DEFAULT_PORT,
    init: INIT_MODES.has(options.init) ? options.init : "sample",
    stateFile: resolve(options.stateFile ?? DEFAULT_STATE_FILE),
    requestDir: resolve(options.requestDir ?? DEFAULT_REQUEST_DIR),
    outputDir: resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR),
    assetDir: resolve(options.assetDir ?? DEFAULT_ASSET_DIR),
    projectRoot: resolve(options.projectRoot ?? TOOL_ROOT),
  };
  ensureDir(dirname(context.stateFile));
  ensureDir(context.requestDir);
  ensureDir(context.outputDir);
  ensureDir(context.assetDir);
  readState(context.stateFile, context.projectRoot, context.init);
  seedSampleAssets(context);

  const publicRoot = join(TOOL_ROOT, "public");
  const server = createServer(async (request, response) => {
    try {
      const violation = originPolicyViolation(request);
      if (violation) throw new HttpError(403, violation);
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      // Mutating API calls run through the single-writer mutex so their
      // read-modify-write of deck.json cannot interleave (see runExclusive).
      // Read-only GETs skip the lock to stay responsive.
      const isMutating = url.pathname.startsWith("/api/") && (request.method ?? "GET") !== "GET";
      const handled = isMutating
        ? await runExclusive(() => handleApi(request, response, context, url))
        : await handleApi(request, response, context, url);
      if (handled) return;
      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/asset") {
        const assetFile = url.searchParams.get("path") ?? "";
        const resolved = safeResolve(context.projectRoot, assetFile);
        // Serve only workspace asset/output files — never source code,
        // configuration, or deck data.
        const allowedRoots = [context.assetDir, context.outputDir].map((dir) => resolve(dir));
        const within = allowedRoots.some((root) => resolved === root || resolved.startsWith(root + sep));
        if (!within) throw new HttpError(403, "Asset path is outside the workspace asset directories");
        serveFile(response, resolved, request);
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405);
        response.end("Method not allowed");
        return;
      }
      const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      serveFile(response, safeResolve(publicRoot, requested), request);
    } catch (error) {
      sendError(response, error);
    }
  });
  return { server, context };
}

export const createPromptDeckServer = createImageArrangerServer;

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  if (args.doctor) {
    const result = runDoctor(args);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }
  const { server, context } = createImageArrangerServer(args);
  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      const nextPort = Number(context.port) + 1;
      const workspaceArg = JSON.stringify(args.workspace ?? ".");
      console.error(`image-arranger: port ${context.port} is already in use.`);
      console.error("Start another instance on a different port with:");
      console.error(`  node server.mjs --workspace ${workspaceArg} --init ${context.init} --port ${nextPort}`);
      console.error("");
      console.error("If you used npm start, stop the running server or run the command above directly.");
      process.exit(1);
      return;
    }
    console.error(`image-arranger: failed to start: ${error?.message ?? error}`);
    process.exit(1);
  });
  server.listen(context.port, "127.0.0.1", () => {
    console.log(`image-arranger: http://127.0.0.1:${context.port}/`);
    console.log(`workspace: ${args.workspace}`);
    console.log(`init: ${context.init}`);
    console.log(`state: ${context.stateFile}`);
    console.log(`requests: ${context.requestDir}`);
    console.log(`outputs: ${context.outputDir}`);
  });
}
