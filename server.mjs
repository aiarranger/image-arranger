#!/usr/bin/env node

import { createServer } from "node:http";
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

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
const MAX_BODY_CHARS = 1_000_000;
const MAX_ASSET_BYTES = 80 * 1024 * 1024;
// Keep this many timestamped deck snapshots under workspace/.history.
const HISTORY_LIMIT = 20;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

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

class HttpError extends Error {
  constructor(status, publicMessage, detail = "") {
    super(detail || publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

const BASE_KIT_PARTS = [
  { key: "face-front", label: "顔アップ（正面）", labelEn: "Face close-up (front)", category: "master", hint: "exact eye shape and spacing, iris design, eyebrows, mouth, jawline, hairline, keep subtle asymmetry" },
  { key: "turnaround", label: "全身ターンアラウンド", labelEn: "Full-body turnaround", category: "master", hint: "front, three-quarter, side, and back full-body views, neutral standing pose, consistent proportions" },
  { key: "expressions", label: "表情差分シート", labelEn: "Expression sheet", category: "expression", hint: "same face, same angle, same scale: smile, neutral, angry, sad, surprised, wink on one sheet" },
  { key: "hair", label: "髪型構造", labelEn: "Hair structure", category: "accessory", hint: "front, side, and back hair structure, strand flow, highlight and mesh color placement" },
  { key: "horns", label: "角", labelEn: "Horns", category: "accessory", hint: "horns only, natural attachment to the scalp, multiple angles" },
  { key: "wings", label: "翼", labelEn: "Wings", category: "accessory", hint: "wings only, natural attachment to the back, open and folded poses" },
  { key: "tail", label: "尻尾", labelEn: "Tail", category: "accessory", hint: "tail only, natural attachment point, a few curve variations" },
  { key: "outfit", label: "衣装", labelEn: "Outfit", category: "clothing", hint: "flat clothing reference front and back, fabric, fasteners, zippers, chains, trims" },
  { key: "props", label: "小物", labelEn: "Props", category: "accessory", hint: "accessories isolated: choker, bag, gloves, shoes, jewelry" },
  { key: "palette", label: "カラーパレット", labelEn: "Color palette", category: "accessory", hint: "color swatch grid of the character's main colors, swatches only, no text" },
];

export function composeAnalyzePrompt(characterName, parts = BASE_KIT_PARTS, extraRequest = "") {
  const lines = (parts ?? []).map((part) => `- key: ${part.key} / label: ${part.label} / category: ${part.category}${part.hint ? ` / focus: ${part.hint}` : ""}`);
  const extra = String(extraRequest ?? "").trim();
  return [
    "画像生成は不要です。これは画像分析タスクです。",
    "",
    "Analyze the attached character image(s) carefully and build the part list for a reusable",
    `character identity kit for ${JSON.stringify(String(characterName ?? ""))}.`,
    "If multiple images are attached, they all depict the same character; use them together",
    "(e.g. one for overall structure, another for face or color details).",
    "",
    "YOU decide which parts to include, based on what actually exists in this image and",
    "what matters for keeping this character consistent across future generations.",
    "Use this standard vocabulary as a guide (key / label / category / focus):",
    ...lines,
    "",
    "Rules for choosing parts:",
    "- Skip vocabulary parts that do not apply to this character (e.g. no wings -> no wings part).",
    "- Add parts NOT in the vocabulary if this character has other identity-critical features",
    "  (unique body parts, signature markings, etc.). Use category \"accessory\" for attached",
    "  features and props, \"master\" only for whole-identity references.",
    ...(extra ? [
      "",
      "User-requested additions (include these as parts when they exist in the image):",
      extra,
    ] : []),
    "",
    "For each chosen part, describe THIS character's actual visual features precisely",
    "(exact colors, shapes, proportions, attachment points, materials), in generation-ready English.",
    "",
    "Return ONLY one JSON code block in this exact shape:",
    "{",
    `  "character": ${JSON.stringify(String(characterName ?? ""))},`,
    "  \"parts\": [",
    "    { \"key\": \"<part key>\", \"label\": \"<part label>\", \"category\": \"<part category>\",",
    "      \"prompt\": \"<English prompt that generates exactly ONE isolated reference image of this part>\" }",
    "  ]",
    "}",
    "",
    "Each \"prompt\" must:",
    "- generate exactly ONE isolated reference image of that part only",
    "- trace the existing design faithfully (no redesign, no generic anime face correction)",
    "- treat horns, wings, and tails as body parts with natural attachment, not accessories",
    "- specify a flat neutral background, clean cel-style rendering, no text, no logo, no watermark, no UI",
  ].join("\n");
}

export function parseKitParts(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Array.isArray(value.parts) ? value.parts : [];
  const text = String(value ?? "").trim();
  if (!text) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const parsed = JSON.parse(fenced ? fenced[1] : text);
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed?.parts) ? parsed.parts : [];
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
    const id = makeUniqueId(existingIds, `base-kit-${safeSlug(part.key ?? label, "part")}`);
    existingIds.add(id);
    const item = entry(id, label, prompt);
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
        target.erroredAt = nowIso();
        changed = true;
        completedTargets.push({ requestPayload, target, selector });
        continue;
      }
      target.status = "completed";
      target.completedAt = nowIso();
      if (Array.isArray(selector.results)) target.results = selector.results;
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

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendError(response, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.publicMessage : "Internal server error";
  if (status >= 500) console.error(error);
  sendJson(response, status, { ok: false, error: message });
}

function readBody(request, maxBodyChars = MAX_BODY_CHARS) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return Promise.reject(new HttpError(415, "Content-Type must be application/json"));
  }
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    let rejected = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (rejected) return;
      raw += chunk;
      if (raw.length > maxBodyChars) {
        rejected = true;
        rejectBody(new HttpError(413, "Request body too large"));
      }
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        rejectBody(new HttpError(400, "Invalid JSON body"));
      }
    });
    request.on("error", (error) => {
      if (!rejected) rejectBody(error);
    });
  });
}

function safeResolve(baseDir, requestedPath) {
  const root = resolve(baseDir);
  if (!requestedPath || String(requestedPath).includes("\0")) {
    throw new HttpError(400, "Invalid path");
  }
  const resolved = resolve(root, requestedPath);
  const rel = relative(root, resolved);
  if (rel && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new HttpError(403, "Path is outside the allowed directory");
  }
  // A symlink inside the tree must not escape it: realpath the deepest
  // existing ancestor of the resolved path and re-check containment.
  let probe = resolved;
  while (probe !== root && !existsSync(probe)) probe = dirname(probe);
  try {
    const rootReal = realpathSync(root);
    const probeReal = realpathSync(probe);
    if (probeReal !== rootReal && !probeReal.startsWith(rootReal + sep)) {
      throw new HttpError(403, "Path resolves outside the allowed directory");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "Path could not be verified");
  }
  return resolved;
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
  return {
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
}


const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
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

// Stream files larger than this (instead of readFileSync) so big video assets
// do not buffer fully into memory.
const STREAM_THRESHOLD_BYTES = 1024 * 1024;

// Parse a single-range "bytes=start-end" header. Returns null when absent or
// unsatisfiable/malformed (caller then serves the full body, per RFC 7233 we
// may ignore a Range we cannot satisfy). Multi-range requests are not
// supported and fall back to a full 200 response.
function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") return null;
  let start;
  let end;
  if (startRaw === "") {
    // Suffix range: last N bytes.
    const suffix = Number(endRaw);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === "" ? size - 1 : Number(endRaw);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= size) {
    return { unsatisfiable: true };
  }
  return { start, end: Math.min(end, size - 1) };
}

function serveFile(response, path, request = null) {
  if (!existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  const contentType = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const size = statSync(path).size;
  const isHead = (request?.method ?? "GET") === "HEAD";
  const range = parseRange(request?.headers?.range, size);

  // Strict Content-Security-Policy on HTML responses. `default-src 'self'`
  // blocks inline/remote script-URI injection (e.g. a malicious shared deck
  // whose referenceUrl is `javascript:...`) and third-party beacons.
  // NOTE: the frontend's Font Awesome cdnjs <link> is removed in a parallel
  // track (P2-FA-1). Once FA is vendored locally this policy is exactly right;
  // until then, a manual check in THIS worktree will see the cdnjs stylesheet
  // blocked — that is expected and fine, not a regression.
  const securityHeaders = contentType.startsWith("text/html")
    ? {
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; "
        + "style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; "
        + "frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    }
    : {};

  if (range?.unsatisfiable) {
    response.writeHead(416, {
      "Content-Range": `bytes */${size}`,
      "Accept-Ranges": "bytes",
    });
    response.end();
    return;
  }

  if (range) {
    const length = range.end - range.start + 1;
    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": length,
      "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      "Accept-Ranges": "bytes",
      ...securityHeaders,
    });
    if (isHead) { response.end(); return; }
    createReadStream(path, { start: range.start, end: range.end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
    ...securityHeaders,
  });
  if (isHead) { response.end(); return; }
  if (size > STREAM_THRESHOLD_BYTES) {
    createReadStream(path).pipe(response);
    return;
  }
  response.end(readFileSync(path));
}

// The server binds to 127.0.0.1, but any web page the user browses can
// still issue requests to it (DNS rebinding / CSRF onto localhost). Require
// a loopback Host header, and for state-changing methods a loopback (or
// absent) Origin.
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function originPolicyViolation(request) {
  let hostname = "";
  try {
    hostname = new URL(`http://${request.headers.host ?? ""}`).hostname;
  } catch {
    return "Missing or malformed Host header";
  }
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    return `Host "${request.headers.host}" is not allowed on this local server`;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method ?? "GET")) {
    const origin = String(request.headers.origin ?? "");
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
          return `Origin "${origin}" is not allowed on this local server`;
        }
      } catch {
        return `Origin "${origin}" is not allowed on this local server`;
      }
    }
  }
  return null;
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
// Sample workspace placeholders: dependency-free PNG generation so a fresh
// `--init sample` workspace shows canonical / adopted / candidate assets
// without bundling binary fixtures.
// ---------------------------------------------------------------------------

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crcBuffer]);
}

function makePlaceholderPng(width, height, fromColor, toColor) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    const mix = y / height;
    for (let x = 0; x < width; x += 1) {
      const stripe = (x + y) % 96 < 48 ? 1 : 0.84;
      for (let channel = 0; channel < 3; channel += 1) {
        row[1 + x * 3 + channel] = Math.round((fromColor[channel] * (1 - mix) + toColor[channel] * mix) * stripe);
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function seedSampleAssets(context) {
  if (context.init !== "sample") return;
  const state = readState(context.stateFile, context.projectRoot, context.init);
  const character = state.characters?.[0];
  if (!character || character.id !== "sample-character") return;
  const master = character.base?.master?.[0];
  const imageEntry = character.images?.[0];
  if (!master || !imageEntry) return;
  if ((master.assets ?? []).length || (imageEntry.assets ?? []).length) return;
  const placeholders = [
    { name: "base-reference.png", colors: [[108, 92, 231], [36, 30, 66]], target: master, adopted: true, label: "Canonical reference (placeholder)" },
    { name: "studio-smile-adopted.png", colors: [[26, 158, 110], [16, 52, 38]], target: imageEntry, adopted: true, label: "Adopted candidate (placeholder)" },
    { name: "studio-smile-candidate.png", colors: [[199, 125, 10], [66, 42, 8]], target: imageEntry, adopted: false, label: "Unadopted candidate (placeholder)" },
  ];
  for (const item of placeholders) {
    const destination = join(context.assetDir, item.name);
    if (!existsSync(destination)) {
      writeFileSync(destination, makePlaceholderPng(640, 400, item.colors[0], item.colors[1]));
    }
    item.target.assets = [...(item.target.assets ?? []), {
      id: `asset-${safeSlug(item.target.id)}-${item.name.replace(/[^a-z0-9]+/gi, "-")}`,
      kind: "image",
      file: toPosixPath(relative(context.projectRoot, destination)),
      name: item.label,
      adopted: item.adopted,
      prompt: "",
      sourceLicense: "CC0 (generated placeholder)",
      aiGenerated: false,
      humanReviewed: true,
      usageNotes: "Placeholder bundled with the sample workspace so candidates and adoption are visible on first run.",
      tags: [],
    }];
  }
  state.updatedAt = nowIso();
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
  server.listen(context.port, "127.0.0.1", () => {
    console.log(`image-arranger: http://127.0.0.1:${context.port}/`);
    console.log(`workspace: ${args.workspace}`);
    console.log(`init: ${context.init}`);
    console.log(`state: ${context.stateFile}`);
    console.log(`requests: ${context.requestDir}`);
    console.log(`outputs: ${context.outputDir}`);
  });
}
