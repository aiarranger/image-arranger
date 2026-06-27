// PNG generation-metadata reader.
//
// Stable Diffusion WebUI (A1111), NovelAI, and ComfyUI all embed the
// generation prompt in PNG tEXt/iTXt/zTXt chunks. extractPngMetadata() walks
// the chunks and returns { source, prompt, parameters } so uploads can be
// auto-annotated (Eagle needs a plugin for this; we do it natively).
// Contract: never throws on malformed/hostile input — returns null instead.

import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Cap everything we persist into deck.json — prompts beyond this are noise.
const MAX_STORED_TEXT = 4000;
// Refuse to inflate compressed text chunks beyond this — protects against
// zip-bomb style zTXt/iTXt payloads in hostile files.
const MAX_INFLATED_BYTES = 1 << 20; // 1 MiB

function cleanText(value) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, MAX_STORED_TEXT).trim();
}

function inflateCapped(data) {
  try {
    return inflateSync(data, { maxOutputLength: MAX_INFLATED_BYTES });
  } catch {
    return null;
  }
}

// Walk PNG chunks and collect tEXt/iTXt/zTXt entries as { keyword: text }.
// Returns null when the buffer is not a PNG or carries no text chunks.
// Malformed chunks are skipped; CRCs are not verified (we only read text).
export function readPngTextChunks(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length + 12) return null;
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return null;
  const texts = {};
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length - offset - 12) break; // truncated or corrupt
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length; // 4 length + 4 type + data + 4 CRC
    if (type === "IEND") break;
    try {
      if (type === "tEXt") {
        const sep = data.indexOf(0);
        if (sep < 1) continue;
        // Spec says Latin-1, but A1111/NovelAI write UTF-8 into tEXt; UTF-8
        // decode is the pragmatic choice (pure ASCII is unaffected).
        texts[data.toString("latin1", 0, sep)] ??= data.toString("utf8", sep + 1);
      } else if (type === "zTXt") {
        const sep = data.indexOf(0);
        if (sep < 1 || sep + 2 > data.length || data[sep + 1] !== 0) continue;
        const inflated = inflateCapped(data.subarray(sep + 2));
        if (inflated) texts[data.toString("latin1", 0, sep)] ??= inflated.toString("utf8");
      } else if (type === "iTXt") {
        // keyword\0 compressionFlag compressionMethod languageTag\0
        // translatedKeyword\0 text
        const sep = data.indexOf(0);
        if (sep < 1 || sep + 3 > data.length) continue;
        const compressed = data[sep + 1] === 1;
        const langEnd = data.indexOf(0, sep + 3);
        if (langEnd < 0) continue;
        const translatedEnd = data.indexOf(0, langEnd + 1);
        if (translatedEnd < 0) continue;
        const payload = data.subarray(translatedEnd + 1);
        const text = compressed ? inflateCapped(payload)?.toString("utf8") : payload.toString("utf8");
        if (text != null) texts[data.toString("latin1", 0, sep)] ??= text;
      }
    } catch {
      // Skip the malformed chunk, keep walking.
    }
  }
  return Object.keys(texts).length ? texts : null;
}

// A1111 "parameters" block: positive prompt line(s), then optional
// "Negative prompt: ..." line(s), then a "Steps: 20, Sampler: ..." line.
function parseA1111Positive(parameters) {
  const cut = parameters.search(/\r?\nNegative prompt:|\r?\nSteps:\s*\d/);
  return cleanText(cut >= 0 ? parameters.slice(0, cut) : parameters);
}

// ComfyUI "prompt" chunk holds the workflow in API JSON form. Pull text from
// CLIPTextEncode-style nodes, preferring ones not titled "negative"; fall
// back to a trimmed excerpt of the raw JSON when nothing parses.
function parseComfyPositive(promptText) {
  try {
    const workflow = JSON.parse(promptText);
    const positives = [];
    const negatives = [];
    for (const node of Object.values(workflow ?? {})) {
      if (!node || typeof node !== "object") continue;
      if (!String(node.class_type ?? "").includes("CLIPTextEncode")) continue;
      const text = node.inputs?.text;
      if (typeof text !== "string" || !text.trim()) continue;
      const title = String(node._meta?.title ?? "").toLowerCase();
      (title.includes("negative") ? negatives : positives).push(text);
    }
    const positive = cleanText(positives[0] ?? negatives[0] ?? "");
    if (positive) return positive;
  } catch {
    // Not JSON — fall through to the excerpt.
  }
  return cleanText(promptText).slice(0, 400).trim();
}

// Recognize generator metadata in a PNG buffer. Returns
//   { source: "a1111" | "novelai" | "comfyui", prompt, parameters }
// or null when the buffer is not a PNG / has no recognizable metadata.
// `prompt` is the positive prompt; `parameters` keeps the fuller block
// (A1111 parameters text, NovelAI Comment JSON, ComfyUI workflow JSON),
// both NUL-stripped and capped at 4000 chars. Never throws.
export function extractPngMetadata(buffer) {
  try {
    const texts = readPngTextChunks(buffer);
    if (!texts) return null;
    // NovelAI: Software=NovelAI plus Description (prompt) + Comment (JSON).
    if (
      typeof texts.Description === "string" &&
      (texts.Software === "NovelAI" || typeof texts.Comment === "string")
    ) {
      const prompt = cleanText(texts.Description);
      if (prompt) return { source: "novelai", prompt, parameters: cleanText(texts.Comment) };
    }
    if (typeof texts.parameters === "string") {
      const prompt = parseA1111Positive(texts.parameters);
      if (prompt) return { source: "a1111", prompt, parameters: cleanText(texts.parameters) };
    }
    if (typeof texts.prompt === "string") {
      const prompt = parseComfyPositive(texts.prompt);
      if (prompt) return { source: "comfyui", prompt, parameters: cleanText(texts.prompt) };
    }
    return null;
  } catch {
    return null;
  }
}
