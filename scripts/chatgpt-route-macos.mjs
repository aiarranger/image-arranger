import { osaString, runAppleScript } from "./chrome-route-macos.mjs";

export function attachReference({ absPath, markerPart }) {
  const script = `
set imagePath to "${osaString(absPath)}"
set the clipboard to (read (POSIX file imagePath) as «class PNGf»)
set foundTab to false
tell application "Google Chrome"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains "${osaString(markerPart)}") then
        set active tab index of w to ti
        set index of w to 1
        activate
        execute t javascript "(() => { const ed = document.querySelector('#prompt-textarea, div[contenteditable=\\\"true\\\"]'); if (ed) ed.focus(); return 'focused'; })();"
        set foundTab to true
        exit repeat
      end if
    end repeat
    if foundTab then exit repeat
  end repeat
end tell
if not foundTab then error "ChatGPT marker tab was not found"
delay 0.4
tell application "System Events"
  tell process "Google Chrome" to set frontmost to true
  delay 0.1
  keystroke "v" using command down
end tell
delay 1
`;
  runAppleScript(script);
  return { ok: true, via: "macos-clipboard" };
}

export function sendPrompt({ markerPart }) {
  const script = `
set foundTab to false
set resultText to ""
set targetTab to missing value
tell application "Google Chrome"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains "${osaString(markerPart)}") then
        set active tab index of w to ti
        set index of w to 1
        activate
        execute t javascript "(() => { const ed = document.querySelector('#prompt-textarea, div[contenteditable=\\\"true\\\"]'); if (ed) ed.focus(); return 'focused'; })();"
        set targetTab to t
        set foundTab to true
        exit repeat
      end if
    end repeat
    if foundTab then exit repeat
  end repeat
end tell
if not foundTab then error "ChatGPT marker tab was not found"
delay 0.3
tell application "System Events" to key code 36
delay 1
tell application "Google Chrome"
  repeat 120 times
    try
      set resultText to execute targetTab javascript "JSON.stringify((() => ({url: location.href, title: document.title, hasMarker: location.href.includes('${osaString(markerPart)}'), hasConversation: location.href.includes('/c/'), hasStopButton: !!document.querySelector('[data-testid=\\\"stop-button\\\"]'), composerExists: !!document.querySelector('#prompt-textarea, div[contenteditable=\\\"true\\\"]')}))())"
      if resultText contains "\\"hasConversation\\":true" then return resultText
    end try
    delay 1
  end repeat
end tell
error "sent ChatGPT conversation tab did not leave the marker tab: " & resultText
`;
  return JSON.parse(runAppleScript(script));
}
