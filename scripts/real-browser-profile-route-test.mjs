#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  findChromeTabByUrlPart,
  openChromeTabProfileSafe,
  runAppleScript,
  runChromeTabJsByUrlPart,
} from "./chrome-route-macos.mjs";
import { ensureChromeMarkerTabProfileSafe, ensureChromeMarkerTabProfileSafeWithRoute } from "./service-browser-route.mjs";

const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const runId = `ia-real-browser-${Date.now()}`;
const userDataDir = mkdtempSync(join(tmpdir(), `${runId}-`));
const selectedProfile = {
  profileDir: "Default",
  profileName: "Real Browser Test Selected",
  email: "selected.route-test@example.invalid",
};
const wrongProfileDir = "Profile 1";
const results = [];

function chromeCommandLines() {
  const result = spawnSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  return result.stdout
    .trim()
    .split("\n")
    .filter((line) => line.includes("/Applications/Google Chrome.app/Contents/"));
}

function testChromePids() {
  return chromeCommandLines()
    .filter((line) => line.includes(`--user-data-dir=${userDataDir}`))
    .map((line) => Number(line.trim().split(/\s+/, 1)[0]))
    .filter(Number.isFinite);
}

function assertNoPreexistingChrome() {
  const lines = chromeCommandLines();
  if (lines.length) {
    throw new Error([
      "Refusing to run the real-browser profile route test while a non-test Google Chrome is already running.",
      "Close Chrome first, then rerun npm run test:real-browser-route.",
      ...lines,
    ].join("\n"));
  }
}

function markerUrl(markerPart, profileDir = selectedProfile.profileDir, email = selectedProfile.email) {
  return `https://example.com/?agent-work=image-arranger&profile-directory=${encodeURIComponent(profileDir)}&profile-email=${encodeURIComponent(email)}&${markerPart}`;
}

function seedAppleEventsJavascriptPreference(profileDir) {
  const profileRoot = join(userDataDir, profileDir);
  const preferencesPath = join(profileRoot, "Preferences");
  mkdirSync(profileRoot, { recursive: true });
  const preferences = existsSync(preferencesPath)
    ? JSON.parse(readFileSync(preferencesPath, "utf8"))
    : {};
  preferences.browser = {
    ...(preferences.browser ?? {}),
    allow_javascript_apple_events: true,
  };
  preferences.account_values = {
    ...(preferences.account_values ?? {}),
    browser: {
      ...(preferences.account_values?.browser ?? {}),
      allow_javascript_apple_events: true,
    },
  };
  writeFileSync(preferencesPath, `${JSON.stringify(preferences, null, 2)}\n`);
}

function launchChrome(profileDir, url) {
  seedAppleEventsJavascriptPreference(profileDir);
  const child = spawn(CHROME_BIN, [
    `--user-data-dir=${userDataDir}`,
    `--profile-directory=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-background-networking",
    "--disable-features=ChromeWhatsNewUI,SigninIntercept",
    "--new-window",
    url,
  ], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function waitFor(label, fn, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

function closeTabsByUrlPart(urlPart) {
  const escaped = String(urlPart).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  runAppleScript(`
set targetPart to "${escaped}"
tell application "Google Chrome"
  repeat with wi from (count of windows) to 1 by -1
    set w to window wi
    repeat with ti from (count of tabs of w) to 1 by -1
      set t to tab ti of w
      if (URL of t contains targetPart) then close t
    end repeat
  end repeat
end tell
`);
}

function assertAppleEventsJavascriptEnabled() {
  const result = spawnSync("osascript", [], {
    encoding: "utf8",
    input: `
tell application "Google Chrome"
  if (count of windows) is 0 then error "Google Chrome has no open windows"
  set w to window 1
  set savedTabIndex to active tab index of w
  set probeTabCreated to false
  set resultText to ""
  try
    set probeTab to make new tab at end of tabs of w with properties {URL:"about:blank"}
    set probeTabCreated to true
    set active tab index of w to (count of tabs of w)
    delay 0.2
    set resultText to execute active tab of w javascript "JSON.stringify({ok:true})"
  on error errMsg
    set resultText to "ERROR:" & errMsg
  end try
  if probeTabCreated then
    try
      close active tab of w
    end try
  end if
  try
    set active tab index of w to savedTabIndex
  end try
  if resultText starts with "ERROR:" then error resultText
  return resultText
end tell
`,
  });
  if (result.status === 0 && /"ok":true/.test(result.stdout)) return;
  const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  throw new Error([
    "Chrome Apple Events JavaScript is disabled, so the real-browser profile proof cannot run.",
    "Enable Chrome menu: View / Develop > Allow JavaScript from Apple Events, then rerun npm run test:real-browser-route.",
    "The script stopped after one probe to avoid opening repeated chrome://version tabs.",
    detail,
  ].filter(Boolean).join("\n"));
}

async function quitTestChrome() {
  try {
    let pids = testChromePids();
    if (pids.length) {
      spawnSync("kill", pids.map(String), { stdio: "ignore" });
      await delay(2000);
    }
    pids = testChromePids();
    if (pids.length) {
      spawnSync("kill", ["-9", ...pids.map(String)], { stdio: "ignore" });
      await delay(1000);
    }
  } catch (error) {
    console.error(`cleanup warning: ${error.message}`);
  }
}

async function withFreshChrome(fn) {
  assertNoPreexistingChrome();
  await fn();
  await quitTestChrome();
  assertNoPreexistingChrome();
}

function record(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`ok ${id} - ${detail}`);
}

async function waitForSelectedProfileBlank() {
  return waitFor("selected Default profile window", () => {
    const tab = findChromeTabByUrlPart("about:blank", { profile: selectedProfile, activate: true });
    return tab?.profilePath?.endsWith(`/${selectedProfile.profileDir}`) ? tab : null;
  });
}

async function launchSelectedProfileAndAssertAppleEventsJavascript() {
  launchChrome(selectedProfile.profileDir, "about:blank");
  await waitFor("test Chrome launch", () => chromeCommandLines().length);
  assertAppleEventsJavascriptEnabled();
  record("REAL-PRE-01", "Apple Events JavaScript is enabled for the test Chrome session");
}

async function waitForWrongProfileMarker(markerPart) {
  return waitFor("wrong-profile marker mismatch", () => {
    try {
      findChromeTabByUrlPart(markerPart, { profile: selectedProfile, activate: true });
    } catch (error) {
      if (/active Chrome window profile did not match|target tab matched URL part/i.test(error.message)) return error;
      throw error;
    }
    return null;
  });
}

async function realWrongProfileThenSelectedRepair() {
  const markerPart = `ia-route-test=${runId}-multi-profile`;
  launchChrome(selectedProfile.profileDir, "about:blank");
  await waitForSelectedProfileBlank();
  launchChrome(wrongProfileDir, markerUrl(markerPart));
  const mismatch = await waitForWrongProfileMarker(markerPart);
  const ensured = await ensureChromeMarkerTabProfileSafe({
    markerPart,
    markerUrl: markerUrl(markerPart),
    profile: selectedProfile,
    repairWaitMs: 500,
  });
  assert.match(mismatch.message, /profile did not match/);
  assert.match(ensured.initialFindError?.message ?? "", /profile did not match/);
  assert.equal(ensured.markerTab.profilePath.endsWith(`/${selectedProfile.profileDir}`), true);
  record("REAL-01", "wrong-profile marker existed, then repair created and reused the selected-profile marker");
}

async function realWrongProfileOnlyStops() {
  const markerPart = `ia-route-test=${runId}-wrong-only`;
  launchChrome(wrongProfileDir, markerUrl(markerPart));
  await waitForWrongProfileMarker(markerPart);
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafe({
      markerPart,
      markerUrl: markerUrl(markerPart),
      profile: selectedProfile,
      repairWaitMs: 500,
    }),
    /Do not launch another Chrome profile or probe other profiles|No Chrome window matched the selected profile/,
  );
  record("REAL-02", "only a wrong-profile marker/window was available, so the route stopped");
}

async function realHumanClosesMarkerDuringRepairStops() {
  const markerPart = `ia-route-test=${runId}-human-close`;
  launchChrome(selectedProfile.profileDir, "about:blank");
  await waitForSelectedProfileBlank();
  let closedAfterOpen = false;
  const route = {
    findChromeTabByUrlPart,
    openChromeTabProfileSafe(url, options) {
      const opened = openChromeTabProfileSafe(url, options);
      closeTabsByUrlPart(markerPart);
      closedAfterOpen = true;
      return opened;
    },
  };
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafeWithRoute(route, {
      markerPart,
      markerUrl: markerUrl(markerPart),
      profile: selectedProfile,
      repairWaitMs: 500,
    }),
    /marker tab was still not found/,
  );
  assert.equal(closedAfterOpen, true);
  record("REAL-03", "marker tab was closed during repair, so processing stopped instead of continuing");
}

async function realJsRouteWrongProfileStops() {
  const markerPart = `ia-route-test=${runId}-js-wrong-profile`;
  launchChrome(wrongProfileDir, markerUrl(markerPart));
  await waitForWrongProfileMarker(markerPart);
  assert.throws(
    () => runChromeTabJsByUrlPart(markerPart, "return { touched: true };", {
      profile: selectedProfile,
      errorLabel: "real browser profile route test",
    }),
    /target tab matched URL part but the active Chrome window profile did not match/,
  );
  record("REAL-04", "page JavaScript route also stopped on a wrong-profile marker");
}

try {
  if (process.platform !== "darwin") {
    throw new Error("real-browser profile route test currently covers the macOS AppleScript route only.");
  }
  assertNoPreexistingChrome();
  await withFreshChrome(launchSelectedProfileAndAssertAppleEventsJavascript);
  await withFreshChrome(realWrongProfileThenSelectedRepair);
  await withFreshChrome(realWrongProfileOnlyStops);
  await withFreshChrome(realHumanClosesMarkerDuringRepairStops);
  await withFreshChrome(realJsRouteWrongProfileStops);
  console.log(JSON.stringify({ ok: true, userDataDir, results }, null, 2));
} finally {
  await quitTestChrome();
  rmSync(userDataDir, { recursive: true, force: true });
}
