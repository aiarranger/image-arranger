#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  findChromeTabByUrlPart,
  openChromeTabProfileSafe,
  runAppleScript,
  runChromeTabJsByUrlPart,
} from "./chrome-route-macos.mjs";
import { sendPrompt as sendChatgptPrompt } from "./chatgpt-route-macos.mjs";
import { ensureChromeMarkerTabProfileSafe, ensureChromeMarkerTabProfileSafeWithRoute } from "./service-browser-route.mjs";
import { loadServiceChromeProfile } from "./service-browser-profile.mjs";

const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const runId = `ia-real-browser-${Date.now()}`;
const userDataDir = mkdtempSync(join(tmpdir(), `${runId}-`));
const ALLOW_EXISTING_CHROME = process.argv.includes("--allow-existing-chrome")
  || process.env.IMAGE_ARRANGER_REAL_BROWSER_ALLOW_EXISTING_CHROME === "1";
let selectedProfile = {
  profileDir: "Profile 1",
  profileName: "Selected Route Profile",
  email: "selected.route-test@example.invalid",
};
const wrongProfile = {
  profileDir: "Default",
  profileName: "Wrong Route Profile",
  email: "wrong.route-test@example.invalid",
};
const wrongProfileDir = "Default";
const results = [];
let testServer = null;
let testServerBaseUrl = "";

function loadSavedNormalChromeProfile() {
  const { chrome } = loadServiceChromeProfile({
    service: "chatgpt",
    serviceLabel: "ChatGPT",
    profileConfigPath: resolve("workspace/.local/chatgpt-profile.json"),
  });
  return chrome;
}

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

function assertNoTestChrome() {
  const pids = testChromePids();
  if (pids.length) {
    throw new Error(`Test Chrome process(es) are still running for ${userDataDir}: ${pids.join(", ")}`);
  }
}

async function startTestServer() {
  if (testServerBaseUrl) return testServerBaseUrl;
  testServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const title = url.searchParams.get("title") || "Image Arranger Route Test";
    const body = url.searchParams.get("fake-chatgpt") === "1"
      ? `<!doctype html><meta charset="utf-8"><title>${title}</title>
        <body>
          <main>
            <div id="prompt-textarea" contenteditable="true">ready</div>
            <button data-testid="send-button">Send</button>
          </main>
          <script>
            window.__sent = 0;
            const markSent = () => {
              window.__sent += 1;
              if (!document.querySelector('[data-testid="stop-button"]')) {
                const stop = document.createElement('button');
                stop.setAttribute('data-testid', 'stop-button');
                stop.textContent = 'Stop';
                document.body.appendChild(stop);
              }
            };
            const send = document.querySelector('[data-testid="send-button"]');
            send.addEventListener('mousedown', markSent);
            send.addEventListener('click', markSent);
          </script>
        </body>`
      : `<!doctype html><meta charset="utf-8"><title>${title}</title><body>${title}</body>`;
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(body);
  });
  await new Promise((resolve, reject) => {
    testServer.once("error", reject);
    testServer.listen(0, "127.0.0.1", resolve);
  });
  const address = testServer.address();
  testServerBaseUrl = `http://127.0.0.1:${address.port}/`;
  return testServerBaseUrl;
}

async function stopTestServer() {
  if (!testServer) return;
  await new Promise((resolve) => testServer.close(resolve));
  testServer = null;
  testServerBaseUrl = "";
}

function routePageUrl(urlPart, { title = "Image Arranger Route Test" } = {}) {
  const url = new URL(testServerBaseUrl);
  url.searchParams.set("title", title);
  url.searchParams.set("route-window", urlPart);
  return url.toString();
}

function markerUrl(markerPart, profile = selectedProfile, { title = "Image Arranger Route Test", fakeChatgpt = false } = {}) {
  const [key, value = ""] = String(markerPart).split("=", 2);
  const params = [
    ["title", title],
    ["agent-work", "image-arranger"],
    ["profile-directory", profile.profileDir],
    ["profile-email", profile.email],
    ...(fakeChatgpt ? [["fake-chatgpt", "1"]] : []),
    [key, value],
  ].map(([paramKey, paramValue]) => `${encodeURIComponent(paramKey)}=${encodeURIComponent(paramValue)}`);
  return `${testServerBaseUrl}?${params.join("&")}`;
}

function seedChromeLocalStateProfile(profileDir, profile) {
  const localStatePath = join(userDataDir, "Local State");
  const localState = existsSync(localStatePath)
    ? JSON.parse(readFileSync(localStatePath, "utf8"))
    : {};
  localState.profile = {
    ...(localState.profile ?? {}),
    info_cache: {
      ...(localState.profile?.info_cache ?? {}),
      [profileDir]: {
        ...(localState.profile?.info_cache?.[profileDir] ?? {}),
        name: profile.profileName,
        shortcut_name: profile.profileName,
        user_name: profile.email,
        gaia_name: profile.profileName,
      },
    },
  };
  writeFileSync(localStatePath, `${JSON.stringify(localState, null, 2)}\n`);
}

function seedAppleEventsJavascriptPreference(profileDir, profile) {
  seedChromeLocalStateProfile(profileDir, profile);
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
  const profile = profileDir === selectedProfile.profileDir ? selectedProfile : wrongProfile;
  seedAppleEventsJavascriptPreference(profileDir, profile);
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

function assertAppleEventsJavascriptEnabled(urlPart) {
  try {
    const result = runChromeTabJsByUrlPart(urlPart, "return { ok: true };", {
      profile: selectedProfile,
      errorLabel: "real browser Apple Events probe",
    });
    if (result?.ok === true) return;
    throw new Error(`unexpected probe result: ${JSON.stringify(result)}`);
  } catch (error) {
    const detail = String(error?.message ?? error);
  throw new Error([
    "Chrome Apple Events JavaScript is disabled, so the real-browser marker/window-label route cannot run.",
    "Enable Chrome menu: View / Develop > Allow JavaScript from Apple Events, then rerun npm run test:real-browser-route.",
    "The script stopped after one selected-profile route-page probe.",
    detail,
  ].filter(Boolean).join("\n"));
  }
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
  if (ALLOW_EXISTING_CHROME) {
    assertNoTestChrome();
  } else {
    assertNoPreexistingChrome();
  }
  await fn();
  await quitTestChrome();
  if (ALLOW_EXISTING_CHROME) {
    assertNoTestChrome();
  } else {
    assertNoPreexistingChrome();
  }
}

async function withExistingNormalChrome(fn) {
  const lines = chromeCommandLines();
  if (!lines.length) throw new Error("Google Chrome is not running. Start the saved normal Chrome profile first.");
  assertNoTestChrome();
  await fn();
  assertNoTestChrome();
}

function record(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`ok ${id} - ${detail}`);
}

async function waitForSelectedProfileBlank() {
  return waitFor("selected Profile 1 window", () => {
    const tab = findChromeTabByUrlPart(`${runId}-selected-window`, { profile: selectedProfile, activate: true });
    return tab?.windowName?.includes(selectedProfile.profileName) ? tab : null;
  });
}

async function waitForSelectedProfileUrlPart(urlPart) {
  return waitFor("selected profile route page", () => {
    try {
      const tab = findChromeTabByUrlPart(urlPart, { profile: selectedProfile, activate: true });
      return tab?.windowName?.includes(selectedProfile.profileName) ? tab : null;
    } catch (error) {
      if (/profile did not match|target tab matched URL part/i.test(error.message)) return null;
      throw error;
    }
  });
}

async function launchSelectedProfileAndAssertAppleEventsJavascript() {
  const markerPart = `ia-route-test=${runId}-pre`;
  launchChrome(selectedProfile.profileDir, markerUrl(markerPart));
  await waitFor("test Chrome launch", () => testChromePids().length);
  await waitForSelectedProfileUrlPart(markerPart);
  assertAppleEventsJavascriptEnabled(markerPart);
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
  launchChrome(selectedProfile.profileDir, routePageUrl(`${runId}-selected-window`));
  await waitForSelectedProfileBlank();
  launchChrome(wrongProfileDir, markerUrl(markerPart, wrongProfile));
  const mismatch = await waitForWrongProfileMarker(markerPart);
  const ensured = await ensureChromeMarkerTabProfileSafe({
    markerPart,
    markerUrl: markerUrl(markerPart),
    profile: selectedProfile,
    repairWaitMs: 500,
  });
  assert.match(mismatch.message, /profile did not match/);
  assert.match(ensured.initialFindError?.message ?? "", /profile did not match/);
  assert.equal(ensured.markerTab.windowName.includes(selectedProfile.profileName), true);
  record("REAL-01", "wrong-profile marker existed, then repair created and reused the selected-profile marker");
}

async function realWrongProfileSpoofedTitleStops() {
  const markerPart = `ia-route-test=${runId}-spoof-title`;
  launchChrome(wrongProfileDir, markerUrl(markerPart, wrongProfile, { title: selectedProfile.profileName }));
  const mismatch = await waitForWrongProfileMarker(markerPart);
  assert.match(mismatch.message, /profile did not match/);
  assert.doesNotMatch(mismatch.message, new RegExp(`windowName=.*${selectedProfile.profileName}.*profile did not match`));
  record("REAL-05", "wrong-profile marker with a spoofed selected-profile page title still stopped");
}

async function realNeutralTitleSelectedProfileWorks() {
  const markerPart = `ia-route-test=${runId}-neutral-title`;
  launchChrome(selectedProfile.profileDir, markerUrl(markerPart, selectedProfile, { title: "Neutral Route Page" }));
  const found = await waitForSelectedProfileUrlPart(markerPart);
  assert.equal(found.title, "Neutral Route Page");
  assert.equal(found.windowName.includes(selectedProfile.profileName), true);
  record("REAL-06", "selected-profile route worked with a neutral page title");
}

async function realChatgptSendUsesSelectedProfileRoute() {
  const markerPart = `ia-route-test=${runId}-fake-chatgpt`;
  launchChrome(selectedProfile.profileDir, markerUrl(markerPart, selectedProfile, { title: "Selected Fake ChatGPT", fakeChatgpt: true }));
  launchChrome(wrongProfileDir, markerUrl(markerPart, wrongProfile, { title: "Wrong Fake ChatGPT", fakeChatgpt: true }));
  await waitForWrongProfileMarker(markerPart);
  await waitForSelectedProfileUrlPart(markerPart);
  const sent = sendChatgptPrompt({ markerPart, profile: selectedProfile });
  assert.equal(sent.hasStopButton, true);
  const selectedState = runChromeTabJsByUrlPart(markerPart, "return { sent: window.__sent || 0, title: document.title, hasStopButton: !!document.querySelector('[data-testid=\"stop-button\"]') };", {
    profile: selectedProfile,
    errorLabel: "real browser fake ChatGPT selected tab",
  });
  assert.equal(selectedState.hasStopButton, true);
  assert.equal(selectedState.title, "Selected Fake ChatGPT");
  record("REAL-07", "ChatGPT macOS send used the selected-profile tab when a wrong-profile duplicate marker also existed");
}

async function normalExistingMarkerRepairWorks() {
  const markerPart = `ia-route-test=${runId}-normal-marker`;
  const ensured = await ensureChromeMarkerTabProfileSafe({
    markerPart,
    markerUrl: markerUrl(markerPart, selectedProfile, { title: "Normal Chrome Marker Repair" }),
    profile: selectedProfile,
    repairWaitMs: 500,
  });
  assert.equal(ensured.markerTab.windowName.includes(selectedProfile.profileName), true);
  record("REAL-NORMAL-01", "existing normal Chrome selected profile created and reused a profile-safe marker tab");
}

async function normalExistingJsRouteWorks() {
  const markerPart = `ia-route-test=${runId}-normal-js`;
  await ensureChromeMarkerTabProfileSafe({
    markerPart,
    markerUrl: markerUrl(markerPart, selectedProfile, { title: "Normal Chrome JS Route" }),
    profile: selectedProfile,
    repairWaitMs: 500,
  });
  const result = runChromeTabJsByUrlPart(markerPart, "return { touched: true, title: document.title };", {
    profile: selectedProfile,
    errorLabel: "normal Chrome profile route test",
  });
  assert.deepEqual(result, { touched: true, title: "Normal Chrome JS Route" });
  record("REAL-NORMAL-02", "existing normal Chrome selected profile ran page JavaScript through the shared route");
}

async function normalExistingHumanClosesRepairStops() {
  const markerPart = `ia-route-test=${runId}-normal-human-close`;
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
      markerUrl: markerUrl(markerPart, selectedProfile, { title: "Normal Chrome Human Close" }),
      profile: selectedProfile,
      repairWaitMs: 500,
    }),
    /marker tab was still not found/,
  );
  assert.equal(closedAfterOpen, true);
  record("REAL-NORMAL-03", "existing normal Chrome stops if the marker tab is closed during repair");
}

async function normalExistingChatgptSendWorks() {
  const markerPart = `ia-route-test=${runId}-normal-fake-chatgpt`;
  await ensureChromeMarkerTabProfileSafe({
    markerPart,
    markerUrl: markerUrl(markerPart, selectedProfile, { title: "Normal Fake ChatGPT", fakeChatgpt: true }),
    profile: selectedProfile,
    repairWaitMs: 500,
  });
  const sent = sendChatgptPrompt({ markerPart, profile: selectedProfile });
  assert.equal(sent.hasStopButton, true);
  const state = runChromeTabJsByUrlPart(markerPart, "return { sent: window.__sent || 0, title: document.title, hasStopButton: !!document.querySelector('[data-testid=\"stop-button\"]') };", {
    profile: selectedProfile,
    errorLabel: "normal Chrome fake ChatGPT selected tab",
  });
  assert.equal(state.title, "Normal Fake ChatGPT");
  assert.equal(state.hasStopButton, true);
  record("REAL-NORMAL-04", "ChatGPT macOS send operated through the existing selected normal Chrome profile");
}

async function realWrongProfileOnlyStops() {
  const markerPart = `ia-route-test=${runId}-wrong-only`;
  launchChrome(wrongProfileDir, markerUrl(markerPart, wrongProfile));
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
  launchChrome(selectedProfile.profileDir, routePageUrl(`${runId}-selected-window`));
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
  launchChrome(wrongProfileDir, markerUrl(markerPart, wrongProfile));
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
  await startTestServer();
  if (ALLOW_EXISTING_CHROME) {
    console.warn("warning: running real-browser route test against the saved normal Chrome profile; actions are restricted to unique local marker URLs and no temporary Chrome profile is launched.");
    selectedProfile = loadSavedNormalChromeProfile();
    assertNoTestChrome();
    await withExistingNormalChrome(normalExistingMarkerRepairWorks);
    await withExistingNormalChrome(normalExistingJsRouteWorks);
    await withExistingNormalChrome(normalExistingHumanClosesRepairStops);
    await withExistingNormalChrome(normalExistingChatgptSendWorks);
    console.log(JSON.stringify({ ok: true, mode: "existing-normal-chrome", results }, null, 2));
  } else {
    assertNoPreexistingChrome();
    await withFreshChrome(launchSelectedProfileAndAssertAppleEventsJavascript);
    await withFreshChrome(realWrongProfileThenSelectedRepair);
    await withFreshChrome(realWrongProfileOnlyStops);
    await withFreshChrome(realHumanClosesMarkerDuringRepairStops);
    await withFreshChrome(realJsRouteWrongProfileStops);
    await withFreshChrome(realWrongProfileSpoofedTitleStops);
    await withFreshChrome(realNeutralTitleSelectedProfileWorks);
    await withFreshChrome(realChatgptSendUsesSelectedProfileRoute);
    console.log(JSON.stringify({ ok: true, mode: "disposable-no-existing-chrome", userDataDir, results }, null, 2));
  }
} finally {
  try {
    closeTabsByUrlPart(runId);
  } catch {
    // Best effort only: if normal Chrome is closed, there is nothing to clean.
  }
  await quitTestChrome();
  rmSync(userDataDir, { recursive: true, force: true });
  await stopTestServer();
}
