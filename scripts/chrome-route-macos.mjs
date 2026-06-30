import { spawnSync } from "node:child_process";

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

function profileProofCheckScript(profile) {
  if (!profile?.profileName && !profile?.profileDir) {
    return `
        set profileOk to true
        set chromeWindowName to ""
        set chromeProfilePath to ""
`;
  }
  return `
        set expectedProfileName to "${osaString(profile.profileName ?? "")}"
        set expectedProfileDir to "${osaString(profile.profileDir ?? "")}"
        set chromeWindowName to ""
        set chromeProfilePath to ""
        try
          tell application "System Events"
            tell process "Google Chrome"
              set chromeWindowName to (name of front window as text)
            end tell
          end tell
        end try
        set profileOk to false
        if expectedProfileDir is not "" then
          set savedTabIndex to active tab index of w
          set profileProofTabCreated to false
          try
            set profileProofTab to make new tab at end of tabs of w with properties {URL:"chrome://version"}
            set profileProofTabCreated to true
            set active tab index of w to (count of tabs of w)
            repeat 20 times
              delay 0.25
              set chromeProfilePath to execute active tab of w javascript "(document.querySelector('#profile_path') || {}).innerText || ''"
              if chromeProfilePath is not "" then exit repeat
            end repeat
            if chromeProfilePath ends with ("/" & expectedProfileDir) then set profileOk to true
          on error errMsg
            set chromeProfilePath to "ERROR:" & errMsg
          end try
          if profileProofTabCreated then
            try
              close active tab of w
            end try
          end if
          try
            set active tab index of w to savedTabIndex
          end try
        else
          if (chromeWindowName contains "Google Chrome") and (chromeWindowName contains expectedProfileName) then set profileOk to true
          if chromeWindowName contains (" - Google Chrome - " & expectedProfileName) then set profileOk to true
          if chromeWindowName ends with (" - " & expectedProfileName) then set profileOk to true
          if chromeWindowName is expectedProfileName then set profileOk to true
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

function profileProofErrorScript() {
  return `
        if chromeProfilePath starts with "ERROR:" then error chromeProfilePath
`;
}

export function findChromeTabByUrlPart(urlPart, { activate = true, profile = null } = {}) {
  if (process.platform !== "darwin") return null;
  const enforceProfile = Boolean(profile?.profileName || profile?.profileDir);
const script = `
set targetPart to "${osaString(urlPart)}"
set foundWrongProfile to false
set wrongProfileWindowName to ""
set wrongProfilePath to ""
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
${profileProofCheckScript(profile)}
${profileProofErrorScript()}
        if ${enforceProfile ? "true" : "false"} and not profileOk then
          set foundWrongProfile to true
          set wrongProfileWindowName to chromeWindowName
          set wrongProfilePath to chromeProfilePath
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
if foundWrongProfile then return "WRONG_PROFILE" & linefeed & wrongProfileWindowName & linefeed & wrongProfilePath
return ""
`;
  const output = runAppleScript(script);
  if (!output) return null;
  const [foundUrl = "", title = "", windowName = "", profilePath = ""] = output.split(/\r?\n/);
  if (foundUrl === "WRONG_PROFILE") {
    throw new Error(profileMismatchMessage(urlPart, profile, title, windowName));
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
${profileProofCheckScript(profile)}
${profileProofErrorScript()}
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
  const enforceProfile = Boolean(profile?.profileName || profile?.profileDir);
  const script = `
set targetPart to "${osaString(urlPart)}"
set foundTab to false
set resultText to ""
set foundWrongProfile to false
set wrongProfileWindowName to ""
set wrongProfilePath to ""
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
${profileProofCheckScript(profile)}
${profileProofErrorScript()}
        if ${enforceProfile ? "true" : "false"} and not profileOk then
          set foundWrongProfile to true
          set wrongProfileWindowName to chromeWindowName
          set wrongProfilePath to chromeProfilePath
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
if foundWrongProfile then error "target tab profile mismatch: " & wrongProfileWindowName & " profilePath=" & wrongProfilePath
if not foundTab then error "target tab not found: " & targetPart
return resultText
`;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const raw = runAppleScript(script);
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
