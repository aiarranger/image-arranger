#!/usr/bin/env node

import { createServer } from "node:http";
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

import {
  BASE_KIT_PARTS,
  composeAnalyzePrompt,
  composeQualityCheckPrompt,
  composeQualityRepairPrompt,
  parseKitParts,
  parseQualityCheckResult,
} from "./prompts.mjs";
import {
  PALETTES,
  clipLine,
  crc32,
  drawSoftCircle,
  drawText,
  encodePng,
  fillRect,
  hash32,
  makeCanvas,
  mix,
  mulberry32,
  paintBackdrop,
  sanitizeText,
  textWidth,
  wrapLines,
} from "./placeholder-art.mjs";
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
  parseKitParts,
  parseQualityCheckResult,
};

const TOOL_ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4217;
const DEFAULT_WORKSPACE = join(TOOL_ROOT, "workspace", "demo");
const DEFAULT_STATE_FILE = join(DEFAULT_WORKSPACE, "deck.json");
const DEFAULT_REQUEST_DIR = join(DEFAULT_WORKSPACE, "requests");
const DEFAULT_OUTPUT_DIR = join(DEFAULT_WORKSPACE, "outputs");
const DEFAULT_ASSET_DIR = join(DEFAULT_WORKSPACE, "assets");
const DEFAULT_SAMPLE_DECK = join(TOOL_ROOT, "examples", "sample-deck.json");
const SCHEMA_VERSION = "image-arranger.v1";
const LEGACY_SCHEMA_VERSION = "prompt-deck.v1";
// Ordered list of every schema this server understands, oldest first. The
// index of a schema is its generation number; anything not in this list and
// not matching SCHEMA_VERSION is treated as "from an unknown (newer) server"
// by the forward-compat guard in normalizeState().
const KNOWN_SCHEMA_VERSIONS = [LEGACY_SCHEMA_VERSION, SCHEMA_VERSION];
const MAX_ASSET_BYTES = 80 * 1024 * 1024;
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
const PROJECT_SPECIFIC_PATTERNS = [
  /\/Users\//,
  /\/home\//,
  /C:\\Users/i,
];

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
  const args = {
    port: DEFAULT_PORT,
    workspace: DEFAULT_WORKSPACE,
    init: "sample",
    projectRoot: TOOL_ROOT,
    doctor: false,
    ...config,
  };
  const explicit = {};
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
      index += 1;
    } else if (key === "--init") {
      args.init = value;
      index += 1;
    } else if (key === "--doctor") {
      args.doctor = true;
    }
  }
  const workspace = resolve(args.workspace ?? DEFAULT_WORKSPACE);
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
    projectRoot: resolve(args.projectRoot ?? TOOL_ROOT),
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
      service: target.service ?? (mode === "video" || target.inputs?.endFrame ? "vidu" : "chatgpt"),
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

function requestSelectorMatches(target, selector, requestPayload, targetIndex) {
  if (selector.requestId) {
    return selector.requestId === requestPayload.requestId && Number(selector.targetIndex) === targetIndex;
  }
  return targetMatches(
    target,
    selector.action === "improve" ? "improve" : selector.action === "draft-prompt" ? "draft-prompt" : "generate",
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
        completedTargets.push({ requestPayload, target, selector });
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
      completedTargets.push({ requestPayload, target, selector });
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
      action: target.action === "improve" ? "improve" : "generate",
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
      action: ["improve", "analyze", "draft-prompt"].includes(target.action) ? target.action : "generate",
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
    recomputeRequestedStatuses(state, context);
    writeState(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      completed,
      errored: erroredTargets.length,
      kitResultsStored,
      draftQueued,
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
// Sample workspace seeding: dependency-free placeholder art (rendering
// primitives in placeholder-art.mjs, shared with scripts/demo-agent.mjs) plus
// a pre-populated queue, so every tab of a fresh `--init sample` workspace is
// alive on first run without bundling binary fixtures.
// ---------------------------------------------------------------------------

function makeSampleArt(spec) {
  const seed = hash32(spec.file);
  const rng = mulberry32(seed);
  const palette = PALETTES[spec.palette % PALETTES.length];
  const canvas = makeCanvas(spec.w, spec.h);
  const glow = paintBackdrop(canvas, palette, rng);
  const white = [246, 248, 252];
  const soft = [224, 228, 238];
  const ink = mix(palette.from, [0, 0, 0], 0.62);

  const badge = sanitizeText(spec.badge) || "SAMPLE";
  fillRect(canvas, 28, 26, textWidth(badge, 2) + 24, 32, ink, 0.5);
  drawText(canvas, 40, 35, badge, 2, white, 0.95);
  fillRect(canvas, 28, 70, 110, 4, glow, 0.9);

  const panelX = 32;
  const panelW = spec.w - panelX * 2;
  const captionLines = spec.caption ? wrapLines(sanitizeText(spec.caption), Math.floor((panelW - 40) / 12), 2) : [];
  const titleScale = sanitizeText(spec.title).length <= Math.floor((panelW - 40) / 24) ? 4 : 3;
  const panelH = 30 + titleScale * 7 + (captionLines.length ? 10 + captionLines.length * 22 : 0);
  const panelY = spec.h - panelH - 26;
  fillRect(canvas, panelX, panelY, panelW, panelH, ink, 0.55);

  const titleLine = clipLine(sanitizeText(spec.title) || "SAMPLE", Math.floor((panelW - 40) / (6 * titleScale)));
  drawText(canvas, panelX + 21, panelY + 17, titleLine, titleScale, [0, 0, 0], 0.3);
  drawText(canvas, panelX + 20, panelY + 16, titleLine, titleScale, white, 0.98);
  captionLines.forEach((line, index) => {
    drawText(canvas, panelX + 20, panelY + 26 + titleScale * 7 + index * 22, line, 2, soft, 0.92);
  });
  return encodePng(canvas);
}

const SAMPLE_REQUEST_NOTE = "image-arranger writes this request only. Ask an agent or operator to process queued image/video generation requests; the generation service is operated outside this tool and this file is updated after processing.";

function seedSampleAssets(context) {
  if (context.init !== "sample") return;
  const state = readState(context.stateFile, context.projectRoot, context.init);
  const character = state.characters?.[0];
  if (!character || character.id !== "sample-character") return;
  const pick = (list, id) => (list ?? []).find((item) => item.id === id);
  const base = character.base ?? {};
  const master = pick(base.master, "base-sample-character-master");
  const cap = pick(base.accessory, "base-sample-character-accessory-cap");
  const smile = pick(base.expression, "base-sample-character-expression-smile");
  const focus = pick(base.expression, "base-sample-character-expression-focus");
  const jacket = pick(base.clothing, "base-sample-character-clothing-casual");
  const studio = pick(base.background, "base-sample-character-background-studio");
  const imageSmile = pick(character.images, "image-sample-character-studio-smile");
  const imageRooftop = pick(character.images, "image-sample-character-rooftop-dusk");
  const video = pick(character.videos, "video-sample-character-dusk-greeting");
  if (!master || !imageSmile) return;
  if ((master.assets ?? []).length || (imageSmile.assets ?? []).length) return;

  const specs = [
    { entry: master, file: "base-master-adopted.png", w: 768, h: 1024, palette: 5, adopted: true, badge: "BASE / MASTER", title: "AOI - FULL-BODY BASE", caption: "teal bob, amber eyes, sky-blue cap, mustard courier jacket", name: "Canonical full-body sheet / 全身カノニカル" },
    { entry: master, file: "base-master-earlier.png", w: 768, h: 1024, palette: 7, adopted: false, badge: "BASE / CANDIDATE", title: "EARLIER TAKE", caption: "kept for comparison - proportions drift", name: "Earlier take / 比較用の旧テイク" },
    { entry: cap, file: "base-cap-adopted.png", w: 640, h: 640, palette: 3, adopted: true, badge: "BASE / ACCESSORY", title: "SKY-BLUE CAP", name: "Cap reference / キャップ参照" },
    { entry: smile, file: "base-smile-adopted.png", w: 640, h: 640, palette: 2, adopted: true, badge: "BASE / EXPRESSION", title: "SMILE", name: "Smile reference / 笑顔参照" },
    { entry: smile, file: "base-smile-alt.png", w: 640, h: 640, palette: 1, adopted: false, badge: "BASE / CANDIDATE", title: "SMILE - ALT", caption: "wider grin - awaiting review", name: "Alternate smile / 笑顔の別案" },
    { entry: focus, file: "base-focus-adopted.png", w: 640, h: 640, palette: 0, adopted: true, badge: "BASE / EXPRESSION", title: "FOCUSED", name: "Focused reference / 集中参照" },
    { entry: jacket, file: "base-jacket-adopted.png", w: 768, h: 960, palette: 4, adopted: true, badge: "BASE / CLOTHING", title: "COURIER JACKET", name: "Jacket reference / ジャケット参照" },
    { entry: studio, file: "base-studio-adopted.png", w: 1024, h: 640, palette: 6, adopted: true, badge: "BASE / BACKGROUND", title: "STUDIO", name: "Studio backdrop / スタジオ背景" },
    { entry: imageSmile, file: "image-studio-smile-adopted.png", w: 1024, h: 640, palette: 2, adopted: true, badge: "IMAGE / ADOPTED", title: "SMILING IN THE STUDIO", caption: "waist-up, soft key light", name: "Adopted result / 採用カット" },
    { entry: imageSmile, file: "image-studio-smile-take2.png", w: 1024, h: 640, palette: 3, adopted: false, badge: "IMAGE / CANDIDATE", title: "STUDIO - TAKE 2", caption: "cooler light - candidate", name: "Take 2 / テイク2（候補）" },
    { entry: imageRooftop, file: "image-rooftop-dusk-take1.png", w: 1024, h: 640, palette: 1, adopted: false, badge: "IMAGE / NEW RESULT", title: "ROOFTOP AT DUSK", caption: "fresh from the queue - review and adopt", name: "New result / 新着結果（未採用）" },
  ].filter((spec) => spec.entry);

  const assetIds = new Map();
  for (const spec of specs) {
    const destination = join(context.assetDir, spec.file);
    if (!existsSync(destination)) writeFileSync(destination, makeSampleArt(spec));
    const assetId = `asset-${safeSlug(spec.entry.id)}-${spec.file.replace(/[^a-z0-9]+/gi, "-")}`;
    assetIds.set(spec.file, assetId);
    spec.entry.assets = [...(spec.entry.assets ?? []), {
      id: assetId,
      kind: "image",
      file: toPosixPath(relative(context.projectRoot, destination)),
      name: spec.name,
      adopted: spec.adopted,
      prompt: spec.adopted ? (spec.entry.prompt ?? "") : "",
      sourceLicense: "CC0 (generated placeholder)",
      aiGenerated: false,
      humanReviewed: true,
      usageNotes: "Locally generated placeholder bundled with the sample workspace - replace with your own art.",
      tags: [],
    }];
  }

  if (video && !video.startFrame && !video.endFrame) {
    video.startFrame = assetIds.get("image-studio-smile-adopted.png") ?? "";
    video.endFrame = assetIds.get("image-rooftop-dusk-take1.png") ?? "";
  }

  seedSampleRequests(context, { character, video, imageRooftop, assetIds });
  recomputeRequestedStatuses(state, context);
  writeState(context.stateFile, state);
}

// Pre-populate the queue so the request lifecycle (pending + completed) is
// visible on first run: one completed image request whose result is already
// registered as a candidate, and one pending video request for the demo
// agent or a human operator to pick up.
function seedSampleRequests(context, refs) {
  ensureDir(context.requestDir);
  if (readdirSync(context.requestDir).some((file) => file.endsWith(".json"))) return;
  const { character, video, imageRooftop, assetIds } = refs;
  const workspaceOutputs = toPosixPath(relative(context.projectRoot, context.outputDir));
  const relAsset = (file) => toPosixPath(relative(context.projectRoot, join(context.assetDir, file)));

  if (imageRooftop) {
    writeJson(join(context.requestDir, "req_sample_completed_rooftop.json"), {
      schema: "image-arranger-request.v1",
      requestId: "req_sample_completed_rooftop",
      status: "completed",
      character: character.id,
      characterName: character.name,
      mode: "image",
      service: "chatgpt",
      targets: [{
        action: "generate",
        entryId: imageRooftop.id,
        assetId: null,
        assetName: null,
        assetFile: null,
        overview: imageRooftop.overview,
        prompt: imageRooftop.prompt,
        referenceUrl: null,
        basePrompt: "",
        improvementPrompt: "",
        inputs: { startFrame: null, endFrame: null, refImages: [] },
        outputDir: `${workspaceOutputs}/${character.id}`,
        service: "chatgpt",
        status: "completed",
        completedAt: nowIso(),
        results: [{ file: relAsset("image-rooftop-dusk-take1.png"), assetId: assetIds.get("image-rooftop-dusk-take1.png"), sample: true }],
      }],
      requestedAt: nowIso(),
      completedAt: nowIso(),
      updatedAt: nowIso(),
      note: SAMPLE_REQUEST_NOTE,
    });
  }

  if (video) {
    const startFile = relAsset("image-studio-smile-adopted.png");
    const endFile = relAsset("image-rooftop-dusk-take1.png");
    writeJson(join(context.requestDir, "req_sample_pending_video.json"), {
      schema: "image-arranger-request.v1",
      requestId: "req_sample_pending_video",
      status: "requested",
      character: character.id,
      characterName: character.name,
      mode: "video",
      service: "vidu",
      targets: [{
        action: "generate",
        entryId: video.id,
        assetId: null,
        assetName: null,
        assetFile: null,
        overview: video.overview,
        prompt: video.prompt,
        referenceUrl: null,
        basePrompt: "",
        improvementPrompt: "",
        inputs: { startFrame: startFile, endFrame: endFile, durationSec: video.durationSec ?? 8, refImages: [startFile, endFile] },
        outputDir: `${workspaceOutputs}/${character.id}`,
        service: "vidu",
        status: "requested",
        results: [],
      }],
      requestedAt: nowIso(),
      completedAt: null,
      note: SAMPLE_REQUEST_NOTE,
    });
  }
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
