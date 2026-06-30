import * as macosRoute from "./chrome-route-macos.mjs";
import * as windowsRoute from "./chrome-route-windows.mjs";

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

export function usesChromeBridgeRoute() {
  return windowsRoute.usesWindowsChromeBridgeRoute();
}

export function assertChromeRunning(message) {
  if (process.platform === "win32") return windowsRoute.assertChromeRunning(message);
  if (process.platform === "darwin") return macosRoute.assertChromeRunning(message);
  throw new Error("image-arranger browser automation supports macOS AppleScript or Windows Chrome bridge only.");
}

export function assertSingleBridgeCandidateForProfile(profile) {
  return windowsRoute.assertSingleBridgeCandidateForProfile(profile);
}

export function findChromeTabByUrlPart(urlPart, options = {}) {
  return usesChromeBridgeRoute()
    ? windowsRoute.findChromeTabByUrlPart(urlPart, options)
    : macosRoute.findChromeTabByUrlPart(urlPart, options);
}

export function openChromeTabProfileSafe(url, options = {}) {
  return usesChromeBridgeRoute()
    ? windowsRoute.openChromeTabProfileSafe(url, options)
    : macosRoute.openChromeTabProfileSafe(url, options);
}

export async function ensureChromeMarkerTabProfileSafeWithRoute(route, {
  markerPart,
  markerUrl,
  profile,
  profileConfigPath = "",
  serviceLabel = "service",
  activate = true,
  repairWaitMs = 1500,
  missingMessage = null,
} = {}) {
  let existing = null;
  let initialFindError = null;
  let repairError = null;
  try {
    existing = route.findChromeTabByUrlPart(markerPart, {
      activate,
      profile,
      profileConfigPath,
    });
  } catch (error) {
    initialFindError = error;
  }

  if (!existing) {
    try {
      route.openChromeTabProfileSafe(markerUrl, {
        activate,
        profile,
        profileConfigPath,
      });
      await delay(repairWaitMs);
      existing = route.findChromeTabByUrlPart(markerPart, {
        activate,
        profile,
        profileConfigPath,
      });
    } catch (error) {
      repairError = error;
    }
  }

  if (!existing) {
    if (typeof missingMessage === "function") {
      throw new Error(missingMessage({ initialFindError, repairError }));
    }
    const detail = [
      initialFindError ? `Initial marker check: ${initialFindError.message}` : "",
      repairError ? `Profile-safe repair failed: ${repairError.message}` : "",
      "Profile-safe repair ran, but the marker tab was still not found.",
    ].filter(Boolean).join(" ");
    throw new Error([
      `${serviceLabel} marker tab was not found for the selected Chrome profile ${profile?.profileName ?? "(unknown)"} / ${profile?.email ?? "(unknown)"}.`,
      "Chrome must already be running in the selected profile.",
      "Do not launch another Chrome profile or probe other profiles.",
      detail,
    ].filter(Boolean).join(" "));
  }

  return {
    markerTab: existing,
    initialFindError,
    repairError,
  };
}

export async function ensureChromeMarkerTabProfileSafe(options = {}) {
  return ensureChromeMarkerTabProfileSafeWithRoute({
    findChromeTabByUrlPart,
    openChromeTabProfileSafe,
  }, options);
}

export function runChromeTabJsByUrlPart(urlPart, js, options = {}) {
  return usesChromeBridgeRoute()
    ? windowsRoute.runChromeTabJsByUrlPart(urlPart, js, options)
    : macosRoute.runChromeTabJsByUrlPart(urlPart, js, options);
}
