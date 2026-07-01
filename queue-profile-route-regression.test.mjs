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

test("ChatGPT send accepts marker-tab generation without requiring an immediate /c/ URL", () => {
  const macos = read("./scripts/chatgpt-route-macos.mjs");
  const windows = read("./scripts/chatgpt-route-windows.mjs");
  const processor = read("./scripts/process-chatgpt-profile-queue.mjs");
  assert.match(macos, /hasStopButton/);
  assert.match(macos, /if \(result\.hasConversation \|\| result\.hasStopButton\) return result/);
  assert.match(macos, /did not start generating/);
  assert.match(windows, /state\.hasConversation \|\| state\.hasStopButton/);
  assert.match(windows, /did not start generating/);
  assert.match(processor, /!sent\.url\.includes\("\/c\/"\) && !sent\.hasStopButton/);
  assert.match(processor, /: currentChatgptMarkerPart/);
  assert.doesNotMatch(processor, /Could not confirm sent ChatGPT conversation/);
});

test("ChatGPT image processor reports service-side transient failures before completion", () => {
  const processor = read("./scripts/process-chatgpt-profile-queue.mjs");
  assert.match(processor, /transientError/);
  assert.match(processor, /Something went wrong/);
  assert.match(processor, /ChatGPT image generation failed before an image was produced/);
});

test("ChatGPT image save opens the generated image button wrapper before saving", () => {
  const processor = read("./scripts/process-chatgpt-profile-queue.mjs");
  assert.match(processor, /closest\('button,\[role="button"\]'\)/);
  assert.match(processor, /openerLabel/);
  assert.match(processor, /firePointerSequence\(opener\)/);
  assert.match(processor, /alt\.startsWith\('生成された画像'\)/);
  assert.match(processor, /sort\(\(a, b\) => b\.index - a\.index/);
  assert.match(processor, /startBrowserBlobDownload/);
  assert.match(processor, /fetch\(src, \{ credentials: 'include' \}\)/);
  assert.match(processor, /imageArrangerChatgptBlobDownload_/);
});

test("ChatGPT composer cleanup ignores old conversation attachment buttons", () => {
  const processor = read("./scripts/process-chatgpt-profile-queue.mjs");
  assert.match(processor, /const composerRoot = ed\.closest\('form'\)/);
  assert.match(processor, /composerRoot\.querySelectorAll\('button'\)/);
  assert.doesNotMatch(processor, /const labels = Array\.from\(document\.querySelectorAll\('button'\)\)/);
});

test("ChatGPT reference attach falls back when clipboard paste cannot focus the composer", () => {
  const processor = read("./scripts/process-chatgpt-profile-queue.mjs");
  assert.match(processor, /let attachAttemptError = null/);
  assert.match(processor, /clipboard attach failed before upload appeared/);
  assert.match(processor, /attachReference\(abs, \{ via: retryVia \}\)/);
  assert.match(processor, /await waitForAttachmentCount\(expectedAttachments\)/);
});

test("macOS Chrome route uses the same marker/window profile check for ChatGPT and Vidu", () => {
  const macosRoute = read("./scripts/chrome-route-macos.mjs");
  assert.doesNotMatch(macosRoute, /chrome:\/\/version/);
  assert.doesNotMatch(macosRoute, /profileProofTab/);
  assert.doesNotMatch(macosRoute, /skipProfileProof/);
  assert.doesNotMatch(macosRoute, /#profile_path/);
  assert.match(macosRoute, /profileWindowCheckScript/);
  assert.match(macosRoute, /chromeWindowTitle/);
  assert.match(macosRoute, /candidateWindow in windows/);
  assert.match(macosRoute, /chromeWindowName/);
  assert.match(macosRoute, /WRONG_PROFILE/);
  assert.match(macosRoute, /fileContainsAllAscii/);
  assert.match(macosRoute, /newestSessionProofHit/);
  assert.match(macosRoute, /freshnessWindowMs = 5 \* 60 \* 1000/);
  assert.match(macosRoute, /ignored-stale/);
  assert.match(macosRoute, /const sessionNeedles = \[agentWork, proofParts\.directoryPart, proofParts\.emailPart\]/);
  assert.match(macosRoute, /const wrongUrl = profilePath/);
  assert.match(macosRoute, /sessionProfileProof\(profile, wrongUrl, urlPart\)/);
  assert.match(macosRoute, /buildActiveTabScript\(wrongUrl\)/);
  assert.doesNotMatch(macosRoute, /buildScript\(null\)/);
  assert.match(macosRoute, /target tab profile mismatch/);
  assert.match(macosRoute, /No Chrome window matched the selected profile/);
});

test("macOS ChatGPT attach/send does not run an unprofiled all-window marker scan", () => {
  const macos = read("./scripts/chatgpt-route-macos.mjs");
  assert.doesNotMatch(macos, /URL of t contains/);
  assert.doesNotMatch(macos, /execute targetTab javascript/);
  assert.match(macos, /runChromeTabJsByUrlPart\(markerPart/);
  assert.match(macos, /profile,/);
});

test("Vidu driver stops when the marker tab disappears during processing and does not reopen another profile", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  assert.match(vidu, /Vidu marker tab disappeared during processing/);
  assert.match(vidu, /Re-run the common profile-safe marker setup\/check/);
  assert.doesNotMatch(vidu, /openViduMarkerInConfiguredChromeProfile/);
});

test("Vidu driver baselines preexisting selected history/result videos before upload or submit", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  assert.match(vidu, /preexistingViduResultSummary/);
  assert.match(vidu, /preexisting Vidu history\/result surface visible/);
  assert.match(vidu, /baseline will be recorded and excluded/);
  assert.match(vidu, /before processing target/);
  assert.match(vidu, /--check finished: selected normal Chrome profile \+ Vidu page are ready/);
  assert.match(vidu, /const beforeVideos = \[/);
});

test("Vidu upload uses the shared ChatGPT/Vidu browser route and does not keep a proof bypass", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  assert.match(vidu, /currentViduRunMarkerPart/);
  assert.match(vidu, /markerPartForViduRun/);
  assert.doesNotMatch(vidu, /skipProfileProof/);
  assert.match(vidu, /waitForReadyViduPageState/);
  assert.match(vidu, /Vidu marker for this run/);
  assert.match(vidu, /const BROWSER_UPLOAD_CHUNK_SIZE = 240000/);
  assert.match(vidu, /const state = await waitForReadyViduPageState\(runMarkerPart\)/);
});

test("Vidu paid-credit gate treats numeric create-button text as a cost", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  const helper = read("./scripts/vidu-processing-helpers.mjs");
  assert.match(vidu, /visibleCreditCost/);
  assert.match(vidu, /作成\|生成\|Create\|Generate/);
  assert.match(helper, /hasCreditLabel \? numbers\[numbers\.length - 1\] : numbers\[0\]/);
  assert.match(vidu, /Vidu create button shows a non-zero credit cost/);
});

test("Vidu paid-credit approval can be local to the selected profile config", () => {
  const vidu = read("./scripts/process-vidu-queue.mjs");
  assert.match(vidu, /readLocalAllowPaid/);
  assert.match(vidu, /raw\?\.allowPaid === true/);
  assert.match(vidu, /LOCAL_ALLOW_PAID/);
  assert.match(vidu, /allow paid credits/);
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
