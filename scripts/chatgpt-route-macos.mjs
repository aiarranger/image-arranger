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

function focusComposer(markerPart, { profile = null } = {}) {
  return runMarkerJs(markerPart, `
    const ed = document.querySelector('#prompt-textarea, div[contenteditable="true"]');
    if (!ed) return { ok: false, reason: 'no-composer' };
    ed.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = ed.getBoundingClientRect();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + Math.min(rect.height / 2, 24))
    };
    ed.dispatchEvent(new MouseEvent('mousedown', opts));
    ed.focus();
    ed.dispatchEvent(new MouseEvent('mouseup', opts));
    ed.dispatchEvent(new MouseEvent('click', opts));
    return {
      ok: document.activeElement === ed || ed.contains(document.activeElement),
      focusState: document.activeElement === ed || ed.contains(document.activeElement) ? 'focused' : 'focus-attempted'
    };
  `, { activate: true, profile });
}

function systemEventsKeystroke(scriptBody) {
  runAppleScript(`
tell application "System Events"
  tell process "Google Chrome" to set frontmost to true
  ${scriptBody}
end tell
`);
}

function attachReferenceFromClipboard({ absPath, markerPart, profile = null }) {
  runAppleScript(`
set imagePath to "${osaString(absPath)}"
set the clipboard to (read (POSIX file imagePath) as «class PNGf»)
`);
  const focused = focusComposer(markerPart, { profile });
  if (!focused.ok) throw new Error(`ChatGPT composer was not focused before paste: ${JSON.stringify(focused)}`);
  systemEventsKeystroke(`
delay 0.4
delay 0.1
keystroke "v" using command down
delay 1
`);
  return { ok: true, via: "macos-clipboard" };
}

function attachReferenceWithFilePicker({ absPath, markerPart, profile = null }) {
  systemEventsKeystroke("key code 53");
  const buttonInfo = runMarkerJs(markerPart, `
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const buttons = Array.from(document.querySelectorAll('button, [role=button]')).filter(visible);
    const button = document.querySelector('[data-testid="composer-plus-btn"]')
      || buttons.find((element) => /ファイルなどを追加|Add photos and files|Attach files|Add files|ファイル.*追加/i.test(normalize(element.getAttribute('aria-label') || element.innerText || element.textContent)));
    if (!button) return {
      ok: false,
      reason: 'composer plus button not found',
      labels: buttons.map((element) => normalize(element.getAttribute('aria-label') || element.innerText || element.textContent)).filter(Boolean).slice(-20),
    };
    button.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = button.getBoundingClientRect();
    return {
      ok: true,
      x: Math.round(window.screenX + rect.left + rect.width / 2),
      y: Math.round(window.screenY + rect.top + rect.height / 2),
      label: normalize(button.getAttribute('aria-label') || button.innerText || button.textContent)
    };
  `, { activate: true, profile });
  if (!buttonInfo.ok) throw new Error(`Could not locate ChatGPT add-files button: ${JSON.stringify(buttonInfo)}`);
  systemEventsKeystroke(`click at {${buttonInfo.x}, ${buttonInfo.y}}`);
  const menuInfo = runMarkerJs(markerPart, `
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const elements = Array.from(document.querySelectorAll('[role=menuitem], [role=group], button, [role=button], div')).filter(visible);
    const exact = elements.filter((element) => {
      const label = normalize(element.getAttribute('aria-label') || element.innerText || element.textContent);
      return /^(写真とファイルを追加|Add photos and files|Upload from computer|Upload files|Add files)$/.test(label);
    });
    const item = exact.find((element) => {
      const rect = element.getBoundingClientRect();
      const role = element.getAttribute('role') || '';
      return rect.width >= 80 && rect.height >= 20 && /^(menuitem|group|button)$/.test(role || element.tagName.toLowerCase());
    }) || exact.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width >= 80 && rect.height >= 20;
    });
    if (!item) return {
      ok: false,
      reason: 'photos/files menu item not found',
      labels: elements.map((element) => normalize(element.getAttribute('aria-label') || element.innerText || element.textContent)).filter(Boolean).filter((label) => /写真|ファイル|Upload|Add/.test(label)).slice(-20),
    };
    const rect = item.getBoundingClientRect();
    return {
      ok: true,
      x: Math.round(window.screenX + rect.left + rect.width / 2),
      y: Math.round(window.screenY + rect.top + rect.height / 2),
      label: normalize(item.getAttribute('aria-label') || item.innerText || item.textContent)
    };
  `, { activate: true, profile });
  if (!menuInfo.ok) throw new Error(`Could not locate ChatGPT photos/files menu item: ${JSON.stringify(menuInfo)}`);
  runAppleScript(`
set imagePath to "${osaString(absPath)}"
set the clipboard to imagePath
tell application "System Events"
  tell process "Google Chrome" to set frontmost to true
  click at {${menuInfo.x}, ${menuInfo.y}}
  delay 0.8
  keystroke "g" using {command down, shift down}
  delay 0.2
  keystroke "v" using command down
  key code 36
  delay 0.4
  key code 36
end tell
delay 1
`);
  return { ok: true, via: "macos-visible-file-picker" };
}

function runMarkerJs(markerPart, js, { activate = true, profile = null } = {}) {
  return runChromeTabJsByUrlPart(markerPart, js, {
    activate,
    errorLabel: "ChatGPT macOS attach tab",
    profile,
  });
}

function attachReferenceWithBrowserFileInput({ absPath, markerPart, profile = null }) {
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
  `, { activate: true, profile });
  for (let offset = 0; offset < data.length; offset += BROWSER_UPLOAD_CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + BROWSER_UPLOAD_CHUNK_SIZE);
    runMarkerJs(markerPart, `
      const upload = window.__imageArrangerChatgptUploads?.[${JSON.stringify(uploadId)}];
      if (!upload) throw new Error("ChatGPT upload store missing");
      upload.chunks.push(${JSON.stringify(chunk)});
      return { chunks: upload.chunks.length };
    `, { activate: false, profile });
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
  `, { activate: true, profile });
  if (!committed.ok || committed.fileCount < 1) {
    throw new Error(`ChatGPT macOS browser file attach failed: ${JSON.stringify(committed)}`);
  }
  return committed;
}

export function attachReference({ absPath, markerPart, via = "clipboard", profile = null }) {
  if (via === "browser-file-input") {
    return attachReferenceWithBrowserFileInput({ absPath, markerPart, profile });
  }
  if (via === "file-picker") {
    return attachReferenceWithFilePicker({ absPath, markerPart, profile });
  }
  return attachReferenceFromClipboard({ absPath, markerPart, profile });
}

export function sendPrompt({ markerPart, profile = null }) {
  focusComposer(markerPart, { profile });
  const clickResult = runMarkerJs(markerPart, `
    const send = document.querySelector('[data-testid="send-button"]');
    if (!send) return { ok: false, reason: 'no-send-button' };
    const disabled = send.disabled || send.getAttribute('aria-disabled') === 'true';
    if (disabled) return { ok: false, reason: 'send-disabled' };
    send.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    send.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return { ok: true };
  `, { activate: true, profile });
  if (!clickResult.ok) {
    systemEventsKeystroke("key code 36");
  }
  let result = null;
  for (let i = 0; i < 120; i += 1) {
    result = runMarkerJs(markerPart, `
      return {
        url: location.href,
        title: document.title,
        hasMarker: location.href.includes(${JSON.stringify(markerPart)}),
        hasConversation: location.href.includes('/c/'),
        hasStopButton: !!document.querySelector('[data-testid="stop-button"]'),
        composerExists: !!document.querySelector('#prompt-textarea, div[contenteditable="true"]')
      };
    `, { activate: false, profile });
    if (result.hasConversation || result.hasStopButton) return result;
    runAppleScript("delay 1");
  }
  throw new Error(`sent ChatGPT conversation tab did not start generating: ${JSON.stringify(result)}`);
}
