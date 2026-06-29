import * as macosRoute from "./chrome-route-macos.mjs";
import * as windowsRoute from "./chrome-route-windows.mjs";

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

export function runChromeTabJsByUrlPart(urlPart, js, options = {}) {
  return usesChromeBridgeRoute()
    ? windowsRoute.runChromeTabJsByUrlPart(urlPart, js, options)
    : macosRoute.runChromeTabJsByUrlPart(urlPart, js, options);
}
