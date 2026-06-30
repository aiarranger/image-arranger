export function planViduUploadStrategy(expectedFileCount, inputCount) {
  if (expectedFileCount < 1 || expectedFileCount > 2) {
    throw new Error(`Vidu generation needs 1 start frame or 2 start/end frames; got ${expectedFileCount}`);
  }
  if (inputCount < 1) {
    return { ok: false, reason: "file input not found" };
  }
  if (expectedFileCount === 1) {
    return {
      ok: true,
      strategy: "single-frame-first-input",
      assignments: [{ inputIndex: 0, fileIndexes: [0] }],
    };
  }
  if (inputCount >= 2) {
    return {
      ok: true,
      strategy: "two-frame-separate-inputs",
      assignments: [
        { inputIndex: 0, fileIndexes: [0] },
        { inputIndex: 1, fileIndexes: [1] },
      ],
    };
  }
  return {
    ok: true,
    strategy: "two-frame-single-multiple-input",
    assignments: [{ inputIndex: 0, fileIndexes: [0, 1] }],
    dropTargetIndex: 0,
  };
}

export const VIDU_UPLOAD_PLAN_FUNCTION_JS = String(planViduUploadStrategy);
