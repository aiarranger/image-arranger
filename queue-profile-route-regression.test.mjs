import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(file) {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

test("ChatGPT and Vidu drivers both use the shared marker-tab setup route", () => {
  const chatgpt = read("./scripts/process-chatgpt-profile-queue.mjs");
  const vidu = read("./scripts/process-vidu-queue.mjs");
  assert.match(chatgpt, /ensureChromeMarkerTabProfileSafe/);
  assert.match(vidu, /ensureChromeMarkerTabProfileSafe/);
  assert.doesNotMatch(chatgpt, /openChromeTabProfileSafe/);
  assert.doesNotMatch(vidu, /openChromeTabProfileSafe/);
});

test("Vidu driver does not contain service-owned Chrome executable launch or profile probing", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  for (const forbidden of [
    /\/Applications\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome/,
    /spawn\([^)]*Google Chrome/s,
    /--profile-directory=\$\{/,
    /detectLoggedInViduProfile/,
    /probeViduProfile/,
    /saveDetectedViduProfile/,
    /starting scripted profile detection/,
    /scripted profile probe/,
    /IMAGE_ARRANGER_VIDU_ALLOW_PROFILE_PROBE/,
    /IMAGE_ARRANGER_VIDU_ALLOW_MARKER_LAUNCH/,
  ]) {
    assert.doesNotMatch(vidu, forbidden, `forbidden Vidu profile route returned: ${forbidden}`);
  }
});

test("Common service entrypoint does not expose Vidu profile-probe escape hatches", () => {
  const service = read("./scripts/process-service-queue.mjs");
  assert.doesNotMatch(service, /--allow-profile-probe/);
  assert.doesNotMatch(service, /--allow-marker-launch/);
  assert.match(service, /scripts\/process-chatgpt-profile-queue\.mjs/);
  assert.match(service, /scripts\/process-vidu-queue\.mjs/);
});

test("macOS Chrome route proves the actual profile before using a matching marker URL", () => {
  const macosRoute = read("./scripts/chrome-route-macos.mjs");
  assert.match(macosRoute, /chrome:\/\/version/);
  assert.match(macosRoute, /profileProofTab/);
  assert.match(macosRoute, /#profile_path/);
  assert.match(macosRoute, /WRONG_PROFILE/);
  assert.match(macosRoute, /target tab profile mismatch/);
  assert.match(macosRoute, /No Chrome window matched the selected profile/);
});

test("Vidu driver stops when the marker tab disappears during processing and does not reopen another profile", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  assert.match(vidu, /Vidu marker tab disappeared during processing/);
  assert.match(vidu, /Re-run the common profile-safe marker setup\/check/);
  assert.doesNotMatch(vidu, /openViduMarkerInConfiguredChromeProfile/);
});

test("Profile-route docs reject probing and direct profile-directory launches", () => {
  const docs = [
    read("./AGENTS.md"),
    read("./skills/image-arranger-queue-processing/SKILL.md"),
  ].join("\n");
  assert.match(docs, /ChatGPT and Vidu must share the same Chrome marker-tab setup behavior/);
  assert.match(docs, /Do not probe signed-in\s+Chrome profiles/);
  assert.match(docs, /do not use\s+`open -a "Google Chrome" \.\.\. --profile-directory=\.\.\.`/);
  assert.doesNotMatch(docs, /must probe signed-in Chrome profiles/);
  assert.doesNotMatch(docs, /automatically probe signed-in Chrome profiles/);
});

test("Profile-route test plan explicitly covers multi-profile and human-interruption cases", () => {
  const plan = read("./docs/queue-profile-route-test-plan.md");
  assert.match(plan, /MULTI-01/);
  assert.match(plan, /wrong-profile marker/i);
  assert.match(plan, /HUMAN-01/);
  assert.match(plan, /human closes/i);
  assert.match(plan, /HUMAN-05/);
  assert.match(plan, /active Vidu task/i);
});
