import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bindServiceBridgeClientId,
  listChromeProfiles,
} from "./service-browser-profile.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export function usesWindowsChromeBridgeRoute() {
  return process.platform === "win32"
    || process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE === "1"
    || process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE === "true";
}

export function assertChromeRunning(message = "Google Chrome is not running. Start the selected normal Chrome profile first; this script must not switch to another browser route.") {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", "Get-Process chrome -ErrorAction SilentlyContinue"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(message);
}

export function assertSingleBridgeCandidateForProfile(profile) {
  if (!usesWindowsChromeBridgeRoute() || profile?.bridgeClientId) return;
  const sameEmailProfiles = listChromeProfiles()
    .filter((candidate) => String(candidate.email || "").trim().toLowerCase() === String(profile?.email || "").trim().toLowerCase());
  if (sameEmailProfiles.length > 1) {
    throw new Error(`Multiple Chrome profiles use ${profile.email}. The bridge cannot prove Chrome's profile directory before the first bind, so automatic binding is blocked. Remove the bridge from non-selected profiles or use a profile with a unique signed-in email, then rerun --setup-profile and --check. Profiles: ${JSON.stringify(sameEmailProfiles)}`);
  }
  const health = runChromeBridgeHealth();
  const email = String(profile?.email || "").trim().toLowerCase();
  const candidates = (health.clients ?? []).filter((client) => String(client.email || "").trim().toLowerCase() === email);
  if (candidates.length > 1) {
    throw new Error(`Multiple Chrome bridge clients are connected for ${email}. Disable the bridge extension in non-selected profiles, rerun --setup-profile for this service, then run --check again. Candidates: ${JSON.stringify(candidates)}`);
  }
}

export function findChromeTabByUrlPart(urlPart, {
  activate = true,
  profile = null,
  profileConfigPath = "",
} = {}) {
  if (!usesWindowsChromeBridgeRoute()) return null;
  const result = runChromeBridgeCommand({
    type: "find-tab",
    urlPart,
    activate,
    expectedClientId: profile?.bridgeClientId || "",
    expectedExtensionId: profile?.bridgeExtensionId || "",
  }, { errorLabel: "Chrome bridge find-tab" });
  if (result?.found && result.bridgeClientId && profile && (!profile.bridgeClientId || (result.bridgeExtensionId && !profile.bridgeExtensionId))) {
    bindServiceBridgeClientId({
      profileConfigPath,
      profile,
      bridgeClientId: result.bridgeClientId,
      bridgeExtensionId: result.bridgeExtensionId || "",
    });
  }
  return result?.found ? {
    url: result.url ?? "",
    title: result.title ?? "",
    tabId: result.tabId ?? null,
    windowId: result.windowId ?? null,
    bridgeClientId: result.bridgeClientId ?? "",
    bridgeExtensionId: result.bridgeExtensionId ?? "",
  } : null;
}

export function openChromeTabProfileSafe(url, {
  activate = true,
  profile = null,
  profileConfigPath = "",
} = {}) {
  if (!usesWindowsChromeBridgeRoute()) return null;
  const target = new URL(url);
  const urlPart = target.search.replace(/^\?/, "");
  const result = runChromeBridgeCommand({
    type: "open-tab",
    url: target.toString(),
    urlPart,
    activate,
    expectedClientId: profile?.bridgeClientId || "",
    expectedExtensionId: profile?.bridgeExtensionId || "",
  }, { errorLabel: "Chrome bridge open-tab" });
  if (result?.bridgeClientId && profile && (!profile.bridgeClientId || (result.bridgeExtensionId && !profile.bridgeExtensionId))) {
    bindServiceBridgeClientId({
      profileConfigPath,
      profile,
      bridgeClientId: result.bridgeClientId,
      bridgeExtensionId: result.bridgeExtensionId || "",
    });
  }
  return result;
}

export function runChromeTabJsByUrlPart(urlPart, js, {
  activate = true,
  errorLabel = "Chrome tab",
  profile = null,
  tabId = null,
} = {}) {
  if (!usesWindowsChromeBridgeRoute()) {
    throw new Error(`${errorLabel} page inspection needs the Windows Chrome bridge on this route.`);
  }
  if (!profile?.bridgeClientId) {
    throw new Error(`${errorLabel} needs a bound Chrome bridge client id. Run the service --check after preparing the marker URL through a profile-safe setup/repair route in the selected profile; manual opening in that selected profile is the fallback.`);
  }
  return runChromeBridgeCommand({
    type: "run-js",
    urlPart,
    js,
    activate,
    tabId,
    expectedClientId: profile.bridgeClientId,
    expectedExtensionId: profile.bridgeExtensionId || "",
  }, { errorLabel });
}

export function runChromeBridgeCommand(command, { errorLabel }) {
  const clientPath = join(SCRIPT_DIR, "chrome-bridge-client.mjs");
  const timeoutMs = Number(process.env.IMAGE_ARRANGER_CHROME_BRIDGE_TIMEOUT_MS || "60000");
  const result = spawnSync(process.execPath, [clientPath], {
    input: JSON.stringify({ ...command, timeoutMs }),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${errorLabel} failed through Chrome bridge${detail ? `: ${detail}` : ""}`);
  }
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${errorLabel} returned invalid Chrome bridge JSON: ${result.stdout.slice(0, 500)}`);
  }
  if (!payload.ok) {
    throw new Error(`${errorLabel} failed through Chrome bridge: ${payload.error || "unknown error"}`);
  }
  return payload.result;
}

export function runChromeBridgeHealth() {
  const clientPath = join(SCRIPT_DIR, "chrome-bridge-client.mjs");
  const result = spawnSync(process.execPath, [clientPath, "--health"], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`Chrome bridge health failed${detail ? `: ${detail}` : ""}`);
  }
  return JSON.parse(result.stdout);
}
