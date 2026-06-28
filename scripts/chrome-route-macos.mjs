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
        return (URL of t) & linefeed & (title of t)
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
        if ${activate ? "true" : "false"} then
          set active tab index of w to ti
          set index of w to 1
          activate
        end if
        set resultText to execute t javascript "eval(new TextDecoder().decode(Uint8Array.from(atob('${encoded}'), (ch) => ch.charCodeAt(0))))"
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
  const raw = runAppleScript(script);
  if (!raw || raw === "missing value") throw new Error(`AppleScript returned no value for ${errorLabel} ${urlPart}`);
  return JSON.parse(raw);
}
