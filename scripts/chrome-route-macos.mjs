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

export function findChromeTabByUrlPart(urlPart, { activate = true } = {}) {
  if (process.platform !== "darwin") return null;
  const script = `
set targetPart to "${osaString(urlPart)}"
tell application "Google Chrome"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains targetPart) then
        if ${activate ? "true" : "false"} then
          set active tab index of w to ti
          set index of w to 1
          activate
        end if
        set tabUrl to (URL of t as text)
        set tabTitle to ""
        try
          set tabTitle to (title of t as text)
        end try
        return tabUrl & linefeed & tabTitle
      end if
    end repeat
  end repeat
end tell
return ""
`;
  const output = runAppleScript(script);
  if (!output) return null;
  const [foundUrl = "", title = ""] = output.split(/\r?\n/);
  return { url: foundUrl, title };
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
  const workChecks = proofAgentWorks
    .map((work) => `(u contains "agent-work=${osaString(work)}")`)
    .join(" or ");
  const script = `
set targetUrl to "${osaString(target.toString())}"
set directoryPart to "${osaString(directoryPart)}"
set emailPart to "${osaString(emailPart)}"
set foundWindow to false
set resultText to ""
tell application "Google Chrome"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      set u to URL of t
      if (u contains directoryPart) and (u contains emailPart) and (${workChecks}) then
        set newTab to make new tab at end of tabs of w with properties {URL:targetUrl}
        set active tab index of w to (count of tabs of w)
        if ${activate ? "true" : "false"} then
          set index of w to 1
          activate
        end if
        delay 0.5
        set newTabUrl to (URL of newTab as text)
        set newTabTitle to ""
        try
          set newTabTitle to (title of newTab as text)
        end try
        set resultText to newTabUrl & linefeed & newTabTitle
        set foundWindow to true
        exit repeat
      end if
    end repeat
    if foundWindow then exit repeat
  end repeat
end tell
if not foundWindow then error "No existing profile-proof marker tab found for " & directoryPart & " / " & emailPart
return resultText
`;
  const output = runAppleScript(script);
  const [foundUrl = "", title = ""] = output.split(/\r?\n/);
  return { url: foundUrl, title, opened: true };
}

export function runChromeTabJsByUrlPart(urlPart, js, {
  activate = true,
  errorLabel = "Chrome tab",
} = {}) {
  if (process.platform !== "darwin") {
    throw new Error(`${errorLabel} page inspection needs macOS AppleScript on this route.`);
  }
  const encoded = Buffer.from(`JSON.stringify((() => { ${js} })())`, "utf8").toString("base64");
  const script = `
set targetPart to "${osaString(urlPart)}"
set foundTab to false
set resultText to ""
tell application "Google Chrome"
  if (count of windows) is 0 then error "Google Chrome has no open windows"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains targetPart) then
        set active tab index of w to ti
        if ${activate ? "true" : "false"} then
          set index of w to 1
          activate
        end if
        set resultText to execute active tab of w javascript "eval(new TextDecoder().decode(Uint8Array.from(atob('${encoded}'), (ch) => ch.charCodeAt(0))))"
        set foundTab to true
        exit repeat
      end if
    end repeat
    if foundTab then exit repeat
  end repeat
end tell
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
      if (!/target tab not found|正しくないインデックス|invalid index|can.?t get tab|cannot get tab|tab .*を取り出すことはできません/i.test(message)) {
        throw error;
      }
      run("sleep", ["1"]);
    }
  }
  throw lastError;
}
