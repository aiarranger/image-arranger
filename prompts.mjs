// prompts.mjs — base-kit vocabulary + analyze-prompt composition / parsing.

export const BASE_KIT_PARTS = [
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

function extractFirstJsonObject(text) {
  const source = String(text ?? "");
  const start = source.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function parseJsonObjectFromText(text, label) {
  const value = String(text ?? "").trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [
    fenced ? fenced[1] : "",
    value,
    extractFirstJsonObject(value),
  ].filter(Boolean);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`${label} JSON must be an object`);
}

function compactPart(part, index) {
  return {
    index: index + 1,
    entryId: String(part.entryId ?? part.id ?? ""),
    category: String(part.category ?? ""),
    label: String(part.overview ?? part.label ?? part.entryId ?? `part-${index + 1}`),
    prompt: String(part.prompt ?? ""),
  };
}

export function composeQualityCheckPrompt({ characterName = "", overview = "", prompt = "", parts = [] } = {}) {
  const compact = (parts ?? []).map(compactPart).filter((part) => part.entryId || part.label);
  const partLines = compact.length
    ? compact.map((part) => [
      `Reference image ${part.index}:`,
      `- entryId: ${part.entryId || "(none)"}`,
      `- category: ${part.category || "(none)"}`,
      `- label: ${part.label}`,
      part.prompt ? `- canonical description: ${part.prompt}` : "",
    ].filter(Boolean).join("\n")).join("\n\n")
    : "(No part references were supplied.)";
  return [
    "画像生成は不要です。これは生成結果の品質検査タスクです。",
    "",
    "The FIRST attached image is the generated candidate to inspect.",
    "Every later attached image is a canonical base/part reference, in the exact order listed below.",
    "",
    `Character: ${JSON.stringify(String(characterName ?? ""))}`,
    `Target: ${JSON.stringify(String(overview ?? ""))}`,
    prompt ? `Original generation prompt:\n${String(prompt)}` : "",
    "",
    "Part references:",
    partLines,
    "",
    "Judge from this perspective:",
    "- Do NOT fail a part merely because it is absent, hidden, cropped out, or too small to identify in the candidate.",
    "- Only compare a part when the candidate visibly contains the same kind of part or feature.",
    "- If that visible part/feature matches the reference identity closely enough, mark it same.",
    "- If that visible part/feature is materially different from the canonical reference, mark it mismatch.",
    "- If visibility is ambiguous, mark it not_visible or uncertain and do not count it as a repair issue.",
    "- Do not judge art style, pose, or composition unless they directly change the canonical part identity.",
    "",
    "Return ONLY one JSON code block in this exact shape:",
    "{",
    "  \"ok\": true,",
    "  \"summary\": \"short result\",",
    "  \"parts\": [",
    "    {",
    "      \"entryId\": \"<entryId from above>\",",
    "      \"label\": \"<label from above>\",",
    "      \"visible\": true,",
    "      \"status\": \"same | mismatch | not_visible | uncertain\",",
    "      \"problem\": \"<empty unless mismatch>\",",
    "      \"repairPrompt\": \"<concrete fix instruction when mismatch>\"",
    "    }",
    "  ],",
    "  \"issues\": [",
    "    { \"entryId\": \"<mismatched entryId>\", \"label\": \"<label>\", \"problem\": \"<what differs>\", \"repairPrompt\": \"<fix>\" }",
    "  ]",
    "}",
    "",
    "\"ok\" must be false only when there is at least one visible mismatch in \"issues\".",
  ].filter(Boolean).join("\n");
}

export function parseQualityCheckResult(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const source = text
    ? parseJsonObjectFromText(text, "quality check")
    : value;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("quality check JSON must be an object");
  }
  const parts = Array.isArray(source.parts) ? source.parts.map((part) => ({
    entryId: String(part.entryId ?? ""),
    label: String(part.label ?? part.entryId ?? ""),
    visible: Boolean(part.visible),
    status: String(part.status ?? "").trim() || (part.visible ? "uncertain" : "not_visible"),
    problem: String(part.problem ?? ""),
    repairPrompt: String(part.repairPrompt ?? ""),
  })) : [];
  const issues = Array.isArray(source.issues)
    ? source.issues
      .map((issue) => ({
        entryId: String(issue.entryId ?? ""),
        label: String(issue.label ?? issue.entryId ?? ""),
        problem: String(issue.problem ?? "").trim(),
        repairPrompt: String(issue.repairPrompt ?? "").trim(),
      }))
      .filter((issue) => issue.entryId || issue.problem || issue.repairPrompt)
    : parts
      .filter((part) => part.status === "mismatch")
      .map((part) => ({
        entryId: part.entryId,
        label: part.label,
        problem: part.problem,
        repairPrompt: part.repairPrompt,
      }));
  return {
    ok: typeof source.ok === "boolean" ? source.ok : issues.length === 0,
    summary: String(source.summary ?? ""),
    parts,
    issues,
  };
}

export function composeQualityRepairPrompt({ originalPrompt = "", issues = [], attempt = 1, maxAttempts = 3 } = {}) {
  const issueLines = (issues ?? []).map((issue, index) => [
    `${index + 1}. ${String(issue.label || issue.entryId || "part")}`,
    issue.problem ? `Problem: ${issue.problem}` : "",
    issue.repairPrompt ? `Fix: ${issue.repairPrompt}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
  return [
    "Recreate the requested image as exactly ONE image.",
    "",
    "Keep the original scene, composition intent, pose, lighting, and mood as much as possible.",
    "The attached canonical identity/base references are the ground truth for character identity and parts.",
    "The LAST attached image is the previous failed attempt: use it only as a composition guide, and do not copy its incorrect details.",
    "",
    "Repair only the visible mismatched parts listed below. Do not force a referenced part to appear if the scene naturally hides, crops, or omits it. If such a part is visible in the new image, it must match the corresponding canonical reference.",
    "",
    issueLines ? `Visible mismatches to repair (attempt ${attempt}/${maxAttempts}):\n${issueLines}` : "No specific mismatch list was provided; preserve the canonical references carefully.",
    "",
    "No text, no logo, no watermark, no UI.",
    "",
    originalPrompt ? `Original prompt:\n${originalPrompt}` : "",
  ].filter(Boolean).join("\n");
}
