#!/usr/bin/env node

import { createServer } from "node:http";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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
const MAX_BODY_CHARS = 1_000_000;
const MAX_ASSET_BYTES = 80 * 1024 * 1024;

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
    "Analyze the attached character image carefully and build the part list for a reusable",
    `character identity kit for ${JSON.stringify(String(characterName ?? ""))}.`,
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

function materializeKitParts(character, sourceFile, parts) {
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
    if (sourceFile) {
      item.assets.push({
        id: `asset-${safeSlug(id)}-source`,
        kind: "image",
        file: sourceFile,
        name: "source-reference",
        adopted: true,
        prompt: "",
        sourceLicense: "",
        aiGenerated: false,
        humanReviewed: true,
        usageNotes: "ベース分解の元画像（参照用）",
        tags: ["source-reference"],
      });
    }
    character.base[category].push(item);
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
  return normalizeState(readJson(stateFile));
}

function normalizeState(state) {
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
    for (const imageItem of character.images) {
      if (typeof imageItem.useBaseRefs !== "boolean") {
        imageItem.useBaseRefs = legacyWorkflow === "character";
      }
    }
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
    const action = target.action === "improve" ? "improve" : "generate";
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
    selector.action === "improve" ? "improve" : "generate",
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
      target.status = "completed";
      target.completedAt = nowIso();
      if (Array.isArray(selector.results)) target.results = selector.results;
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
    requestPayload.status = active ? "requested" : "completed";
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
      writeJson(context.stateFile, state);
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
  const sourceFile = isAbsolute(sourceFileRaw)
    ? resolve(sourceFileRaw)
    : safeResolve(context.projectRoot, sourceFileRaw);
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
    tags: [],
  };
}

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
    normalizeState(body);
    body.updatedAt = nowIso();
    writeJson(context.stateFile, body);
    sendJson(response, 200, { ok: true, state: body });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/requests") {
    const state = readState(context.stateFile, context.projectRoot, context.init);
    const body = await readBody(request);
    const requestPayload = buildRequest(state, body, context);
    applyRequestStatus(state, requestPayload.targets, "requested", requestPayload.character);
    ensureDir(context.requestDir);
    ensureDir(context.outputDir);
    const requestPath = join(context.requestDir, `${requestPayload.requestId}.json`);
    writeJson(requestPath, requestPayload);
    writeJson(context.stateFile, state);
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
    writeJson(context.stateFile, state);
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
      action: ["improve", "analyze"].includes(target.action) ? target.action : "generate",
      entryId: target.entryId,
      assetId: target.assetId ?? "",
      results: Array.isArray(target.results) ? target.results : (Array.isArray(body.results) ? body.results : []),
      parts: target.parts ?? body.parts ?? null,
    })).filter((target) => (target.requestId && target.targetIndex !== undefined) || target.entryId);
    if (!selectors.length) throw new HttpError(400, "No request targets to complete");
    const { completed, completedTargets } = completeRequestFiles(context, selectors);
    const kitResultsStored = completedTargets.filter(({ target }) => (target.action ?? "") === "analyze" && target.analysisParts?.length).length;
    recomputeRequestedStatuses(state, context);
    writeJson(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      completed,
      kitResultsStored,
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
    writeJson(context.stateFile, state);
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
      writeJson(context.stateFile, state);
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
    writeJson(context.stateFile, state);
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
    const sourceEntry = findEntryInCharacter(character, body.sourceEntryId);
    const sourceAsset = sourceEntry?.assets?.find((item) => item.id === body.sourceAssetId);
    if (!sourceEntry || !sourceAsset?.file) throw new HttpError(404, "Source asset was not found");
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
        inputs: { startFrame: null, endFrame: null, refImages: [sourceAsset.file], sourceAsset: sourceAsset.file },
        outputDir: null,
        status: "requested",
        results: [],
      }],
      requestedAt: nowIso(),
      completedAt: null,
      note: "Analysis request: the processor reads the attached image, writes part prompts as JSON, and returns them via POST /api/requests/complete (parts) or the paste-import UI. No image generation in this step.",
    };
    applyRequestStatus(state, requestPayload.targets, "requested", character.id);
    ensureDir(context.requestDir);
    const requestPath = join(context.requestDir, `${requestPayload.requestId}.json`);
    writeJson(requestPath, requestPayload);
    writeJson(context.stateFile, state);
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
    const sourceEntry = body.sourceEntryId ? findEntryInCharacter(character, body.sourceEntryId) : null;
    const sourceAsset = sourceEntry?.assets?.find((item) => item.id === body.sourceAssetId);
    const created = materializeKitParts(character, sourceAsset?.file ?? String(body.sourceFile ?? ""), parts);
    if (!created.length) throw new HttpError(400, "Analysis JSON has no usable parts (label and prompt are required)");
    if (body.requestId && Number.isInteger(Number(body.targetIndex))) {
      markKitResultImported(context, String(body.requestId), Number(body.targetIndex));
    }
    state.updatedAt = nowIso();
    writeJson(context.stateFile, state);
    sendJson(response, 200, {
      ok: true,
      created: created.map((item) => item.id),
      kitResults: listKitResults(context),
      state,
    });
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
    writeJson(context.stateFile, state);
    sendJson(response, 200, { ok: true, asset: newAsset, state });
    return true;
  }
  return false;
}

function serveFile(response, path) {
  if (!existsSync(path) || statSync(path).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": MIME[extname(path).toLowerCase()] ?? "application/octet-stream" });
  response.end(readFileSync(path));
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

  const publicRoot = join(TOOL_ROOT, "public");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      if (await handleApi(request, response, context, url)) return;
      if (request.method === "GET" && url.pathname === "/asset") {
        const assetFile = url.searchParams.get("path") ?? "";
        serveFile(response, safeResolve(context.projectRoot, assetFile));
        return;
      }
      if (request.method !== "GET") {
        response.writeHead(405);
        response.end("Method not allowed");
        return;
      }
      const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      serveFile(response, safeResolve(publicRoot, requested));
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
