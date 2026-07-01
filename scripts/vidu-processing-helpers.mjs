import { resolve } from "node:path";

export function visibleCreditCost(text) {
  const visible = String(text ?? "");
  const numbers = visible.match(/\b\d+\b/g) ?? [];
  const hasCreditLabel = /(credit|credits|クレジット|消費|cost|C\b)/i.test(visible);
  if (!hasCreditLabel && !/作成|生成|Create|Generate/i.test(visible)) return 0;
  if (!numbers.length) return 0;
  return Number(hasCreditLabel ? numbers[numbers.length - 1] : numbers[0]) || 0;
}

export function isInsufficientViduCreditState(stateOrText) {
  const visible = typeof stateOrText === "string"
    ? stateOrText
    : `${stateOrText?.submitText || ""}\n${stateOrText?.body || ""}`;
  return /クレジットが足りません|Insufficient credits|Not enough credits/i.test(visible);
}

export function isInsufficientViduCreditError(errorOrText) {
  const visible = typeof errorOrText === "string"
    ? errorOrText
    : `${errorOrText?.code || ""}\n${errorOrText?.message || ""}`;
  return /VIDU_INSUFFICIENT_CREDITS|Vidu account has insufficient credits|purchase\/add credits before retrying/i.test(visible)
    || isInsufficientViduCreditState(visible);
}

export function stableVideoKey(src) {
  const value = String(src ?? "");
  if (value.startsWith("blob:")) return value.split(/[?#]/)[0];
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

export function hasActiveViduTaskState(state) {
  if (!state) return false;
  return Boolean(state.activeTask);
}

export function assertDistinctViduFrameInputs({ startFrame, endFrame, startSha256 = "", endSha256 = "" }) {
  if (!endFrame) return { ok: true, mode: "start-only" };
  const start = resolve(startFrame);
  const end = resolve(endFrame);
  if (start === end) {
    throw new Error("Vidu start/end frames resolve to the same file. Use start-only mode for one-image generation, or provide a distinct end frame.");
  }
  if (startSha256 && endSha256 && startSha256 === endSha256) {
    throw new Error(`Vidu start/end frames have the same SHA-256 (${startSha256}). Use start-only mode for one-image generation, or provide a distinct end frame.`);
  }
  return { ok: true, mode: "start-end" };
}
