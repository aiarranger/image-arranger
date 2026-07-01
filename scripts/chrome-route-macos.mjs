import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function assertChromeRunning(message = "Google Chrome is not running. Start the selected normal Chrome profile first; this script must not switch to another browser route.") {
  const result = spawnSync("pgrep", ["-x", "Google Chrome"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(message);
}

export function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${commandArgs.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout;
}

export function runAppleScript(script) {
  return run("osascript", [], { input: script }).trim();
}

export function osaString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function profileWindowCheckScript(profile) {
  if (!profile?.profileName && !profile?.profileDir) {
    return `
        set profileOk to true
        set chromeWindowName to ""
        set chromeProfilePath to "not-checked:window-profile-label-only"
`;
  }
  return `
        set expectedProfileName to "${osaString(profile.profileName ?? "")}"
        set expectedProfileDir to "${osaString(profile.profileDir ?? "")}"
        set chromeWindowName to ""
        set chromeWindowTitle to ""
        set chromeProfilePath to "not-checked:window-profile-label-only"
        try
          set chromeWindowTitle to (name of w as text)
          set chromeWindowName to chromeWindowTitle
        end try
        try
          tell application "System Events"
            tell process "Google Chrome"
              set frontWindowName to (name of front window as text)
              if frontWindowName contains expectedProfileName then
                set chromeWindowName to frontWindowName
              else
                repeat with candidateWindow in windows
                  set candidateName to ""
                  try
                    set candidateName to (name of candidateWindow as text)
                  end try
                  if candidateName is not "" and expectedProfileName is not "" and chromeWindowTitle is not "" then
                    if candidateName contains expectedProfileName and candidateName contains chromeWindowTitle then
                      set chromeWindowName to candidateName
                      exit repeat
                    end if
                  end if
                end repeat
              end if
            end tell
          end tell
        end try
        set chromeProfileLabel to ""
        if chromeWindowName contains " - Google Chrome - " then
          set oldDelimiters to AppleScript's text item delimiters
          set AppleScript's text item delimiters to " - Google Chrome - "
          set chromeProfileLabel to (last text item of chromeWindowName as text)
          set AppleScript's text item delimiters to oldDelimiters
        end if
        set profileOk to false
        if expectedProfileName is not "" then
          if chromeProfileLabel is expectedProfileName then set profileOk to true
          if chromeProfileLabel contains expectedProfileName then set profileOk to true
          if chromeProfileLabel contains ("(" & expectedProfileName & ")") then set profileOk to true
          if chromeWindowName is expectedProfileName then set profileOk to true
        else if expectedProfileDir is not "" then
          set profileOk to true
        end if
`;
}

function profileMismatchMessage(urlPart, profile, windowName, profilePath = "") {
  return [
    `target tab matched URL part but the active Chrome window profile did not match.`,
    `urlPart=${urlPart}`,
    `expectedProfile=${profile?.profileName ?? "(none)"} / ${profile?.profileDir ?? "(none)"} / ${profile?.email ?? "(none)"}`,
    `windowName=${windowName || "(empty)"}`,
    `profilePath=${profilePath || "(empty)"}`,
  ].join(" ");
}

function chromeUserDataRoot() {
  return join(homedir(), "Library/Application Support/Google/Chrome");
}

function sessionFilesForProfile(profileDir) {
  if (!profileDir) return [];
  const sessionsDir = join(chromeUserDataRoot(), profileDir, "Sessions");
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir)
    .filter((name) => /^(Session|Tabs)_/i.test(name))
    .map((name) => join(sessionsDir, name))
    .filter((file) => {
      try {
        return statSync(file).isFile();
      } catch {
        return false;
      }
    });
}

function profileDirsWithSessions() {
  const root = chromeUserDataRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name === "Default" || /^Profile \d+$/i.test(name))
    .filter((name) => existsSync(join(root, name, "Sessions")));
}

function fileContainsAscii(file, value) {
  if (!value) return false;
  try {
    return readFileSync(file).includes(Buffer.from(String(value), "utf8"));
  } catch {
    return false;
  }
}

function fileContainsAllAscii(file, values) {
  if (!values.length) return false;
  try {
    const buffer = readFileSync(file);
    return values.every((value) => buffer.includes(Buffer.from(String(value), "utf8")));
  } catch {
    return false;
  }
}

function newestSessionProofHit(profileDir, sessionNeedles) {
  const hits = [];
  for (const file of sessionFilesForProfile(profileDir)) {
    if (!fileContainsAllAscii(file, sessionNeedles)) continue;
    try {
      hits.push({ profileDir, file, mtimeMs: statSync(file).mtimeMs });
    } catch {
      // Ignore files that disappear while Chrome is writing session state.
    }
  }
  return hits.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? null;
}

function sessionProfileProof(profile, foundUrl, urlPart) {
  if (process.platform !== "darwin") return { ok: false, reason: "not-macos" };
  if (!profile?.profileDir || !profile?.email) return { ok: false, reason: "missing-profile-fields" };
  const proofParts = profileProofParts(profile);
  const markerNeedle = foundUrl || urlPart;
  if (!markerNeedle) return { ok: false, reason: "missing-marker-url" };
  if (!String(markerNeedle).includes(proofParts.directoryPart) || !String(markerNeedle).includes(proofParts.emailPart)) {
    return { ok: false, reason: "marker-url-lacks-profile-proof-parts" };
  }
  const agentWork = String(markerNeedle).match(/agent-work=[^&]+/)?.[0] ?? "";
  const sessionNeedles = [agentWork, proofParts.directoryPart, proofParts.emailPart].filter(Boolean);

  const matchingProfiles = [];
  for (const profileDir of profileDirsWithSessions()) {
    const hit = newestSessionProofHit(profileDir, sessionNeedles);
    if (hit) matchingProfiles.push(hit);
  }

  const expectedHit = matchingProfiles.find((hit) => hit.profileDir === profile.profileDir);
  if (!expectedHit) {
    return { ok: false, reason: `marker-not-found-in-expected-profile-session:${profile.profileDir}` };
  }
  const freshnessWindowMs = 5 * 60 * 1000;
  const otherFreshMatches = matchingProfiles
    .filter((hit) => hit.profileDir !== profile.profileDir)
    .filter((hit) => hit.mtimeMs >= expectedHit.mtimeMs - freshnessWindowMs);
  if (otherFreshMatches.length > 0) {
    return { ok: false, reason: `marker-also-found-in-other-current-profile-sessions:${otherFreshMatches.map((hit) => hit.profileDir).join(",")}` };
  }
  const staleMatches = matchingProfiles
    .filter((hit) => hit.profileDir !== profile.profileDir)
    .map((hit) => hit.profileDir);
  return {
    ok: true,
    reason: `marker-session-proof:${profile.profileDir}${staleMatches.length ? `;ignored-stale:${staleMatches.join(",")}` : ""}`,
    profilePath: `session-proof:${join(chromeUserDataRoot(), profile.profileDir, "Sessions")}`,
  };
}

export function findChromeTabByUrlPart(urlPart, { activate = true, profile = null } = {}) {
  if (process.platform !== "darwin") return null;
  const enforceProfile = Boolean(profile?.profileName || profile?.profileDir);
const script = `
set targetPart to "${osaString(urlPart)}"
set foundWrongProfile to false
set wrongProfileWindowName to ""
set wrongProfilePath to ""
set wrongProfileUrl to ""
set wrongProfileTitle to ""
tell application "Google Chrome"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains targetPart) then
        set active tab index of w to ti
        set index of w to 1
        activate
        delay 0.1
${profileWindowCheckScript(profile)}
        if ${enforceProfile ? "true" : "false"} and not profileOk then
          set foundWrongProfile to true
          set wrongProfileWindowName to chromeWindowName
          set wrongProfilePath to chromeProfilePath
          try
            set wrongProfileUrl to (URL of t as text)
          end try
          try
            set wrongProfileTitle to (title of t as text)
          end try
        else
          if not ${activate ? "true" : "false"} then
            -- The tab had to be activated briefly to read the macOS window name.
            -- Leave it active rather than guessing a previous active tab/window.
          end if
          set tabUrl to (URL of t as text)
          set tabTitle to ""
          try
            set tabTitle to (title of t as text)
          end try
          return tabUrl & linefeed & tabTitle & linefeed & chromeWindowName & linefeed & chromeProfilePath
        end if
      end if
    end repeat
  end repeat
end tell
if foundWrongProfile then return "WRONG_PROFILE" & linefeed & wrongProfileWindowName & linefeed & wrongProfilePath & linefeed & wrongProfileUrl & linefeed & wrongProfileTitle
return ""
`;
  const output = runAppleScript(script);
  if (!output) return null;
  const [foundUrl = "", title = "", windowName = "", profilePath = "", wrongTitle = ""] = output.split(/\r?\n/);
  if (foundUrl === "WRONG_PROFILE") {
    const wrongWindowName = title;
    const wrongProfilePath = windowName;
    const wrongUrl = profilePath;
    const proof = sessionProfileProof(profile, wrongUrl, urlPart);
    if (proof.ok) {
      return {
        url: wrongUrl,
        title: wrongTitle,
        windowName: wrongWindowName,
        profilePath: proof.profilePath,
        profileProof: proof.reason,
      };
    }
    throw new Error(`${profileMismatchMessage(urlPart, profile, wrongWindowName, wrongProfilePath)} sessionProof=${proof.reason} wrongUrl=${wrongUrl}`);
  }
  return { url: foundUrl, title, windowName, profilePath };
}

function profileProofParts(profile) {
  return {
    directoryPart: profile.profileDir ? `profile-directory=${encodeURIComponent(profile.profileDir)}` : "",
    emailPart: profile.email ? `profile-email=${encodeURIComponent(profile.email)}` : "",
  };
}

export function openChromeTabProfileSafe(url, {
  activate = true,
  profile = null,
  proofAgentWorks = ["image-arranger", "image-arranger-vidu"],
} = {}) {
  if (process.platform !== "darwin") return null;
  const target = new URL(url);
  if (!["https:", "http:"].includes(target.protocol)) {
    throw new Error(`Refusing to open non-http marker URL: ${url}`);
  }
  if (!profile?.profileDir || !profile?.email) {
    throw new Error("profile-safe tab creation needs profileDir and email");
  }
  const { directoryPart, emailPart } = profileProofParts(profile);
  if (!directoryPart || !emailPart) {
    throw new Error("profile-safe tab creation needs marker profile-directory and profile-email proof parts");
  }
  if (!target.toString().includes(directoryPart) || !target.toString().includes(emailPart)) {
    throw new Error("profile-safe tab creation target URL must include profile-directory and profile-email proof parts");
  }
  if (!proofAgentWorks.some((work) => target.searchParams.get("agent-work") === work)) {
    throw new Error(`profile-safe tab creation target URL has unapproved agent-work: ${target.searchParams.get("agent-work") ?? "(none)"}`);
  }
  const script = `
set targetUrl to "${osaString(target.toString())}"
set foundWindow to false
set foundWrongProfile to false
set wrongProfileWindowName to ""
set wrongProfilePath to ""
set resultText to ""
tell application "Google Chrome"
  if (count of windows) is 0 then error "Google Chrome has no open windows"
  repeat with wi from 1 to count of windows
    set w to window wi
    set index of w to 1
    activate
    delay 0.1
${profileWindowCheckScript(profile)}
    if profileOk then
      set newTab to make new tab at end of tabs of w with properties {URL:targetUrl}
      set active tab index of w to (count of tabs of w)
      if ${activate ? "true" : "false"} then
        set index of w to 1
        activate
      end if
      delay 0.5
      set newTabUrl to targetUrl
      try
        set newTabUrl to (URL of newTab as text)
      end try
      set newTabTitle to ""
      try
        set newTabTitle to (title of newTab as text)
      end try
      set resultText to newTabUrl & linefeed & newTabTitle & linefeed & chromeWindowName & linefeed & chromeProfilePath
      set foundWindow to true
      exit repeat
    else
      set foundWrongProfile to true
      set wrongProfileWindowName to chromeWindowName
      set wrongProfilePath to chromeProfilePath
    end if
    if foundWindow then exit repeat
  end repeat
end tell
if not foundWindow and foundWrongProfile then error "No Chrome window matched the selected profile; last inspected windowName=" & wrongProfileWindowName & " profilePath=" & wrongProfilePath
if not foundWindow then error "No Chrome window matched the selected profile"
return resultText
`;
  const output = runAppleScript(script);
  const [foundUrl = "", title = "", windowName = "", profilePath = ""] = output.split(/\r?\n/);
  return { url: foundUrl, title, windowName, profilePath, opened: true };
}

export function runChromeTabJsByUrlPart(urlPart, js, {
  activate = true,
  errorLabel = "Chrome tab",
  profile = null,
} = {}) {
  if (process.platform !== "darwin") {
    throw new Error(`${errorLabel} page inspection needs macOS AppleScript on this route.`);
  }
  const encoded = Buffer.from(`JSON.stringify((() => { ${js} })())`, "utf8").toString("base64");
  const buildScript = (profileForCheck) => {
    const enforceProfile = Boolean(profileForCheck?.profileName || profileForCheck?.profileDir);
    const profileCheckScript = enforceProfile ? profileWindowCheckScript(profileForCheck) : profileWindowCheckScript(null);
    return `
set targetPart to "${osaString(urlPart)}"
set foundTab to false
set resultText to ""
set foundWrongProfile to false
set wrongProfileWindowName to ""
set wrongProfilePath to ""
set wrongProfileUrl to ""
tell application "Google Chrome"
  if (count of windows) is 0 then error "Google Chrome has no open windows"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains targetPart) then
        set active tab index of w to ti
        set index of w to 1
        activate
        delay 0.1
${profileCheckScript}
        if ${enforceProfile ? "true" : "false"} and not profileOk then
          set foundWrongProfile to true
          set wrongProfileWindowName to chromeWindowName
          set wrongProfilePath to chromeProfilePath
          try
            set wrongProfileUrl to (URL of t as text)
          end try
        else
          set active tab index of w to ti
          set resultText to execute active tab of w javascript "eval(new TextDecoder().decode(Uint8Array.from(atob('${encoded}'), (ch) => ch.charCodeAt(0))))"
          set foundTab to true
          exit repeat
        end if
      end if
    end repeat
    if foundTab then exit repeat
  end repeat
end tell
if foundWrongProfile then return "__WRONG_PROFILE__" & linefeed & wrongProfileWindowName & linefeed & wrongProfilePath & linefeed & wrongProfileUrl
if not foundTab then error "target tab not found: " & targetPart
return resultText
`;
  };
  const buildActiveTabScript = (expectedUrl) => `
set targetPart to "${osaString(urlPart)}"
set expectedUrl to "${osaString(expectedUrl)}"
tell application "Google Chrome"
  if (count of windows) is 0 then error "Google Chrome has no open windows"
  set w to front window
  set t to active tab of w
  set activeUrl to (URL of t as text)
  if activeUrl is not expectedUrl then error "session-proof active tab changed: " & activeUrl
  if activeUrl does not contain targetPart then error "session-proof active tab no longer matches: " & targetPart
  return execute active tab of w javascript "eval(new TextDecoder().decode(Uint8Array.from(atob('${encoded}'), (ch) => ch.charCodeAt(0))))"
end tell
`;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      let raw = runAppleScript(buildScript(profile));
      if (raw.startsWith("__WRONG_PROFILE__")) {
        const [, windowName = "", profilePath = "", wrongUrl = ""] = raw.split(/\r?\n/);
        const proof = sessionProfileProof(profile, wrongUrl, urlPart);
        if (!proof.ok) {
          throw new Error(profileMismatchMessage(urlPart, profile, windowName, `${profilePath || ""}${profilePath ? " " : ""}${proof.reason}`));
        }
        raw = runAppleScript(buildActiveTabScript(wrongUrl));
      }
      if (!raw || raw === "missing value") throw new Error(`AppleScript returned no value for ${errorLabel} ${urlPart}`);
      return JSON.parse(raw);
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      if (/target tab profile mismatch/i.test(message)) {
        const mismatch = message.replace(/^.*target tab profile mismatch:\s*/i, "");
        const [windowName = "", profilePath = ""] = mismatch.split(/\s+profilePath=/);
        throw new Error(profileMismatchMessage(urlPart, profile, windowName, profilePath));
      }
      if (!/target tab not found|正しくないインデックス|invalid index|can.?t get tab|cannot get tab|tab .*を取り出すことはできません/i.test(message)) {
        throw error;
      }
      run("sleep", ["1"]);
    }
  }
  throw lastError;
}
