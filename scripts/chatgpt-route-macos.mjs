import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { osaString, runAppleScript, runChromeTabJsByUrlPart } from "./chrome-route-macos.mjs";

const BROWSER_UPLOAD_CHUNK_SIZE = 24000;

function mimeForFile(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

function attachReferenceFromClipboard({ absPath, markerPart }) {
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
        execute t javascript "(() => { const ed = document.querySelector('#prompt-textarea, div[contenteditable=\\\"true\\\"]'); if (!ed) return 'no-composer'; ed.scrollIntoView({ block: 'center', inline: 'nearest' }); const rect = ed.getBoundingClientRect(); const opts = { bubbles: true, cancelable: true, view: window, clientX: Math.round(rect.left + rect.width / 2), clientY: Math.round(rect.top + Math.min(rect.height / 2, 24)) }; ed.dispatchEvent(new MouseEvent('mousedown', opts)); ed.focus(); ed.dispatchEvent(new MouseEvent('mouseup', opts)); ed.dispatchEvent(new MouseEvent('click', opts)); return document.activeElement === ed || ed.contains(document.activeElement) ? 'focused' : 'focus-attempted'; })();"
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

function attachReferenceWithFilePicker({ absPath, markerPart }) {
  const script = `
set imagePath to "${osaString(absPath)}"
set markerPart to "${osaString(markerPart)}"
set foundTab to false
set targetTab to missing value
set buttonInfo to ""
tell application "Google Chrome"
  repeat with wi from 1 to count of windows
    set w to window wi
    repeat with ti from 1 to count of tabs of w
      set t to tab ti of w
      if (URL of t contains markerPart) then
        set active tab index of w to ti
        set index of w to 1
        activate
        set targetTab to t
        set foundTab to true
        exit repeat
      end if
    end repeat
    if foundTab then exit repeat
  end repeat
end tell
if not foundTab then error "ChatGPT marker tab was not found"

delay 0.2
tell application "System Events"
  tell process "Google Chrome" to set frontmost to true
  key code 53
end tell
delay 0.2

tell application "Google Chrome"
  set buttonInfo to execute targetTab javascript "(() => { const normalize = (value) => String(value || '').replace(/\\\\s+/g, ' ').trim(); const visible = (element) => { const rect = element.getBoundingClientRect(); const style = window.getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; }; const buttons = Array.from(document.querySelectorAll('button, [role=button]')).filter(visible); const button = document.querySelector('[data-testid=\\\"composer-plus-btn\\\"]') || buttons.find((element) => /ファイルなどを追加|Add photos and files|Attach files|Add files|ファイル.*追加/i.test(normalize(element.getAttribute('aria-label') || element.innerText || element.textContent))); if (!button) return ['ERROR', 'composer plus button not found', buttons.map((element) => normalize(element.getAttribute('aria-label') || element.innerText || element.textContent)).filter(Boolean).slice(-20).join(' | ')].join('\\\\n'); button.scrollIntoView({ block: 'center', inline: 'center' }); const rect = button.getBoundingClientRect(); return ['OK', Math.round(window.screenX + rect.left + rect.width / 2), Math.round(window.screenY + rect.top + rect.height / 2), normalize(button.getAttribute('aria-label') || button.innerText || button.textContent)].join('\\\\n'); })();"
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to linefeed
set buttonParts to text items of buttonInfo
set AppleScript's text item delimiters to oldDelimiters
if item 1 of buttonParts is not "OK" then error "Could not locate ChatGPT add-files button: " & buttonInfo
set buttonX to (item 2 of buttonParts) as integer
set buttonY to (item 3 of buttonParts) as integer

tell application "System Events"
  tell process "Google Chrome" to set frontmost to true
  click at {buttonX, buttonY}
end tell
delay 0.5

set menuInfo to ""
tell application "Google Chrome"
  set menuInfo to execute targetTab javascript "(() => { const normalize = (value) => String(value || '').replace(/\\\\s+/g, ' ').trim(); const visible = (element) => { const rect = element.getBoundingClientRect(); const style = window.getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; }; const elements = Array.from(document.querySelectorAll('[role=menuitem], [role=group], button, [role=button], div')).filter(visible); const exact = elements.filter((element) => { const label = normalize(element.getAttribute('aria-label') || element.innerText || element.textContent); return /^(写真とファイルを追加|Add photos and files|Upload from computer|Upload files|Add files)$/.test(label); }); const item = exact.find((element) => { const rect = element.getBoundingClientRect(); const role = element.getAttribute('role') || ''; return rect.width >= 80 && rect.height >= 20 && /^(menuitem|group|button)$/.test(role || element.tagName.toLowerCase()); }) || exact.find((element) => { const rect = element.getBoundingClientRect(); return rect.width >= 80 && rect.height >= 20; }); if (!item) return ['ERROR', 'photos/files menu item not found', elements.map((element) => normalize(element.getAttribute('aria-label') || element.innerText || element.textContent)).filter(Boolean).filter((label) => /写真|ファイル|Upload|Add/.test(label)).slice(-20).join(' | ')].join('\\\\n'); const rect = item.getBoundingClientRect(); return ['OK', Math.round(window.screenX + rect.left + rect.width / 2), Math.round(window.screenY + rect.top + rect.height / 2), normalize(item.getAttribute('aria-label') || item.innerText || item.textContent)].join('\\\\n'); })();"
end tell
set oldDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to linefeed
set menuParts to text items of menuInfo
set AppleScript's text item delimiters to oldDelimiters
if item 1 of menuParts is not "OK" then error "Could not locate ChatGPT photos/files menu item: " & menuInfo
set menuX to (item 2 of menuParts) as integer
set menuY to (item 3 of menuParts) as integer

tell application "System Events"
  tell process "Google Chrome" to set frontmost to true
  click at {menuX, menuY}
  delay 0.8
  keystroke "g" using {command down, shift down}
  delay 0.2
  set the clipboard to imagePath
  keystroke "v" using command down
  key code 36
  delay 0.4
  key code 36
end tell
delay 1
`;
  runAppleScript(script);
  return { ok: true, via: "macos-visible-file-picker" };
}

function runMarkerJs(markerPart, js, { activate = true } = {}) {
  return runChromeTabJsByUrlPart(markerPart, js, {
    activate,
    errorLabel: "ChatGPT macOS attach tab",
  });
}

function attachReferenceWithBrowserFileInput({ absPath, markerPart }) {
  const uploadId = `chatgpt-macos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const data = readFileSync(absPath).toString("base64");
  const fileInfo = { name: basename(absPath), type: mimeForFile(absPath), size: statSync(absPath).size };
  runMarkerJs(markerPart, `
    window.__imageArrangerChatgptUploads = window.__imageArrangerChatgptUploads || {};
    window.__imageArrangerChatgptUploads[${JSON.stringify(uploadId)}] = {
      name: ${JSON.stringify(fileInfo.name)},
      type: ${JSON.stringify(fileInfo.type)},
      chunks: []
    };
    return { ok: true };
  `, { activate: true });
  for (let offset = 0; offset < data.length; offset += BROWSER_UPLOAD_CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + BROWSER_UPLOAD_CHUNK_SIZE);
    runMarkerJs(markerPart, `
      const upload = window.__imageArrangerChatgptUploads?.[${JSON.stringify(uploadId)}];
      if (!upload) throw new Error("ChatGPT upload store missing");
      upload.chunks.push(${JSON.stringify(chunk)});
      return { chunks: upload.chunks.length };
    `, { activate: false });
  }
  const committed = runMarkerJs(markerPart, `
    const upload = window.__imageArrangerChatgptUploads?.[${JSON.stringify(uploadId)}];
    if (!upload?.chunks?.length) throw new Error("ChatGPT upload chunks incomplete");
    const binary = atob(upload.chunks.join(""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], upload.name, { type: upload.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    const acceptsImage = (input) => {
      const accept = (input.getAttribute("accept") || "").toLowerCase();
      return !accept || /image|png|jpg|jpeg|webp|gif|\\*/.test(accept);
    };
    const composer = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
    const composerRoot = composer?.closest("form") || composer?.parentElement?.parentElement || null;
    const pageInputs = [...document.querySelectorAll("input[type=file]")];
    const input = pageInputs.find((item) => item.id === "upload-files")
      || pageInputs.find((item) => item.id === "upload-photos")
      || (composerRoot ? [...composerRoot.querySelectorAll("input[type=file]")].find(acceptsImage) : null)
      || pageInputs.find(acceptsImage)
      || null;
    if (!input) {
      delete window.__imageArrangerChatgptUploads[${JSON.stringify(uploadId)}];
      return { ok: false, reason: "file-input-not-found" };
    }
    try {
      input.files = dt.files;
    } catch {
      Object.defineProperty(input, "files", { configurable: true, value: dt.files });
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    delete window.__imageArrangerChatgptUploads[${JSON.stringify(uploadId)}];
    return {
      ok: true,
      via: "browser-file-input",
      fileCount: input.files?.length ?? 0,
      inputId: input.id || "",
      inputAccept: input.getAttribute("accept") || ""
    };
  `, { activate: true });
  if (!committed.ok || committed.fileCount < 1) {
    throw new Error(`ChatGPT macOS browser file attach failed: ${JSON.stringify(committed)}`);
  }
  return committed;
}

export function attachReference({ absPath, markerPart, via = "clipboard" }) {
  if (via === "browser-file-input") {
    return attachReferenceWithBrowserFileInput({ absPath, markerPart });
  }
  if (via === "file-picker") {
    return attachReferenceWithFilePicker({ absPath, markerPart });
  }
  return attachReferenceFromClipboard({ absPath, markerPart });
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
        execute t javascript "(() => { const ed = document.querySelector('#prompt-textarea, div[contenteditable=\\\"true\\\"]'); if (!ed) return 'no-composer'; ed.scrollIntoView({ block: 'center', inline: 'nearest' }); const rect = ed.getBoundingClientRect(); const opts = { bubbles: true, cancelable: true, view: window, clientX: Math.round(rect.left + rect.width / 2), clientY: Math.round(rect.top + Math.min(rect.height / 2, 24)) }; ed.dispatchEvent(new MouseEvent('mousedown', opts)); ed.focus(); ed.dispatchEvent(new MouseEvent('mouseup', opts)); ed.dispatchEvent(new MouseEvent('click', opts)); return document.activeElement === ed || ed.contains(document.activeElement) ? 'focused' : 'focus-attempted'; })();"
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
set clickResult to ""
tell application "Google Chrome"
  set clickResult to execute targetTab javascript "JSON.stringify((() => { const send = document.querySelector('[data-testid=\\\"send-button\\\"]'); if (!send) return { ok: false, reason: 'no-send-button' }; const disabled = send.disabled || send.getAttribute('aria-disabled') === 'true'; if (disabled) return { ok: false, reason: 'send-disabled' }; send.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); send.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return { ok: true }; })())"
end tell
if clickResult does not contain "\\"ok\\":true" then
  tell application "System Events" to key code 36
end if
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
