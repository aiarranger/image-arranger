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
