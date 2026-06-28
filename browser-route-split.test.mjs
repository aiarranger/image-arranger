import assert from "node:assert/strict";
import { test } from "node:test";
import * as profileModule from "./scripts/service-browser-profile.mjs";
import { usesChromeBridgeRoute } from "./scripts/service-browser-route.mjs";

test("service-browser-profile exports profile/config helpers only, not OS tab-control helpers", () => {
  for (const forbiddenExport of [
    "assertChromeRunning",
    "assertSingleBridgeCandidateForProfile",
    "findChromeTabByUrlPart",
    "runAppleScript",
    "runChromeTabJsByUrlPart",
    "usesChromeBridgeRoute",
  ]) {
    assert.equal(forbiddenExport in profileModule, false, `${forbiddenExport} must stay in route-specific files`);
  }
});

test("service-browser-route selects the Windows bridge only on Windows or explicit force", () => {
  const previous = process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE;
  try {
    delete process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE;
    assert.equal(usesChromeBridgeRoute(), process.platform === "win32");
    process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE = "1";
    assert.equal(usesChromeBridgeRoute(), true);
    process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE = "true";
    assert.equal(usesChromeBridgeRoute(), true);
    process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE = "false";
    assert.equal(usesChromeBridgeRoute(), process.platform === "win32");
  } finally {
    if (previous == null) delete process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE;
    else process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE = previous;
  }
});
