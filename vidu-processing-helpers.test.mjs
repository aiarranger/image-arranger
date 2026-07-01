import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDistinctViduFrameInputs,
  isInsufficientViduCreditError,
  isInsufficientViduCreditState,
  stableVideoKey,
  visibleCreditCost,
} from "./scripts/vidu-processing-helpers.mjs";

test("visibleCreditCost treats create/generate button numbers as paid credit cost", () => {
  assert.equal(visibleCreditCost("作成する 8"), 8);
  assert.equal(visibleCreditCost("Generate 4"), 4);
  assert.equal(visibleCreditCost("Create 0 credits"), 0);
  assert.equal(visibleCreditCost("Ready"), 0);
});

test("visibleCreditCost prefers the numeric value next to explicit credit labels", () => {
  assert.equal(visibleCreditCost("Generate 1 video - 8 credits"), 8);
  assert.equal(visibleCreditCost("生成 1 本 / 消費 6 クレジット"), 6);
});

test("isInsufficientViduCreditState separates purchase gate from paid create cost", () => {
  assert.equal(isInsufficientViduCreditState({ submitText: "クレジットが足りません 購入" }), true);
  assert.equal(isInsufficientViduCreditState({ body: "Insufficient credits. Add credits to continue." }), true);
  assert.equal(isInsufficientViduCreditState({ submitText: "作成する 8" }), false);
});

test("isInsufficientViduCreditError detects account-credit blockers", () => {
  const error = new Error("Vidu account has insufficient credits; purchase/add credits before retrying. Submit text: クレジットが足りません 購入");
  error.code = "VIDU_INSUFFICIENT_CREDITS";
  assert.equal(isInsufficientViduCreditError(error), true);
  assert.equal(isInsufficientViduCreditError(new Error("Vidu generation timed out")), false);
});

test("stableVideoKey ignores volatile query strings and hashes", () => {
  assert.equal(
    stableVideoKey("https://cdn.example.com/result.mp4?Expires=1&Signature=abc"),
    "https://cdn.example.com/result.mp4",
  );
  assert.equal(stableVideoKey("blob:https://www.vidu.com/abc?x=1"), "blob:https://www.vidu.com/abc");
});

test("assertDistinctViduFrameInputs accepts start-only Vidu generation", () => {
  assert.deepEqual(
    assertDistinctViduFrameInputs({ startFrame: "/tmp/a.png", endFrame: null }),
    { ok: true, mode: "start-only" },
  );
});

test("assertDistinctViduFrameInputs rejects the same start/end file before paid submit", () => {
  assert.throws(
    () => assertDistinctViduFrameInputs({
      startFrame: "/tmp/a.png",
      endFrame: "/tmp/../tmp/a.png",
      startSha256: "sha-a",
      endSha256: "sha-a",
    }),
    /same file|start-only mode/,
  );
});

test("assertDistinctViduFrameInputs rejects different paths with identical content hashes", () => {
  assert.throws(
    () => assertDistinctViduFrameInputs({
      startFrame: "/tmp/a.png",
      endFrame: "/tmp/b.png",
      startSha256: "same-sha",
      endSha256: "same-sha",
    }),
    /same SHA-256|start-only mode/,
  );
});
