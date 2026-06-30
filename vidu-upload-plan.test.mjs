import assert from "node:assert/strict";
import { test } from "node:test";
import {
  planViduUploadStrategy,
  VIDU_UPLOAD_PLAN_FUNCTION_JS,
} from "./scripts/vidu-upload-plan.mjs";

test("Vidu start-only uploads exactly one start file into the first image input", () => {
  assert.deepEqual(planViduUploadStrategy(1, 1), {
    ok: true,
    strategy: "single-frame-first-input",
    assignments: [{ inputIndex: 0, fileIndexes: [0] }],
  });
  assert.deepEqual(planViduUploadStrategy(1, 2), {
    ok: true,
    strategy: "single-frame-first-input",
    assignments: [{ inputIndex: 0, fileIndexes: [0] }],
  });
});

test("Vidu start/end uploads two files to separate inputs when both slots exist", () => {
  assert.deepEqual(planViduUploadStrategy(2, 2), {
    ok: true,
    strategy: "two-frame-separate-inputs",
    assignments: [
      { inputIndex: 0, fileIndexes: [0] },
      { inputIndex: 1, fileIndexes: [1] },
    ],
  });
});

test("Vidu start/end falls back to one multiple-file input when only one image input exists", () => {
  assert.deepEqual(planViduUploadStrategy(2, 1), {
    ok: true,
    strategy: "two-frame-single-multiple-input",
    assignments: [{ inputIndex: 0, fileIndexes: [0, 1] }],
    dropTargetIndex: 0,
  });
});

test("Vidu upload planner reports no image input and rejects invalid frame counts", () => {
  assert.deepEqual(planViduUploadStrategy(1, 0), { ok: false, reason: "file input not found" });
  assert.throws(() => planViduUploadStrategy(0, 2), /got 0/);
  assert.throws(() => planViduUploadStrategy(3, 2), /got 3/);
});

test("Browser-injected Vidu upload planner source stays executable in page context", () => {
  assert.match(VIDU_UPLOAD_PLAN_FUNCTION_JS, /function planViduUploadStrategy/);
  const pageContext = new Function(`${VIDU_UPLOAD_PLAN_FUNCTION_JS}; return planViduUploadStrategy(2, 2);`);
  assert.deepEqual(pageContext(), {
    ok: true,
    strategy: "two-frame-separate-inputs",
    assignments: [
      { inputIndex: 0, fileIndexes: [0] },
      { inputIndex: 1, fileIndexes: [1] },
    ],
  });
});
