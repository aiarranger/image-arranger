import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const BROWSER_UPLOAD_CHUNK_SIZE = 24000;

function mimeForFile(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

export function attachReference({ absPath, markerPart, runTabJs, tabId = null }) {
  const uploadId = `chatgpt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const data = readFileSync(absPath).toString("base64");
  const fileInfo = { name: basename(absPath), type: mimeForFile(absPath), size: statSync(absPath).size };
  runTabJs(markerPart, `
    window.__imageArrangerChatgptUploads = window.__imageArrangerChatgptUploads || {};
    window.__imageArrangerChatgptUploads[${JSON.stringify(uploadId)}] = {
      name: ${JSON.stringify(fileInfo.name)},
      type: ${JSON.stringify(fileInfo.type)},
      chunks: []
    };
    return { ok: true };
  `, { activate: true, tabId });
  for (let offset = 0; offset < data.length; offset += BROWSER_UPLOAD_CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + BROWSER_UPLOAD_CHUNK_SIZE);
    runTabJs(markerPart, `
      const upload = window.__imageArrangerChatgptUploads?.[${JSON.stringify(uploadId)}];
      if (!upload) throw new Error("ChatGPT upload store missing");
      upload.chunks.push(${JSON.stringify(chunk)});
      return { chunks: upload.chunks.length };
    `, { activate: false, tabId });
  }
  const committed = runTabJs(markerPart, `
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
    const scopedInputs = composerRoot ? [...composerRoot.querySelectorAll("input[type=file]")] : [];
    const pageInputs = [...document.querySelectorAll("input[type=file]")];
    const input = scopedInputs.find(acceptsImage)
      || scopedInputs[0]
      || pageInputs.find((item) => acceptsImage(item) && (item.closest("form") === composerRoot))
      || null;
    if (input) {
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
        via: "input",
        fileCount: input.files?.length ?? 0,
        inputAccept: input.getAttribute("accept") || "",
        inputAria: input.getAttribute("aria-label") || ""
      };
    }
    const target = composerRoot || composer || document.body;
    try {
      for (const type of ["dragenter", "dragover", "drop"]) {
        const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
        target.dispatchEvent(event);
      }
    } catch (error) {
      delete window.__imageArrangerChatgptUploads[${JSON.stringify(uploadId)}];
      return { ok: false, via: "drop", reason: error?.message || String(error), target: target.tagName };
    }
    delete window.__imageArrangerChatgptUploads[${JSON.stringify(uploadId)}];
    return { ok: true, via: "drop", fileCount: dt.files.length, target: target.tagName };
  `, { activate: true, tabId });
  if (!committed.ok || committed.fileCount < 1) {
    throw new Error(`ChatGPT bridge file attach failed: ${JSON.stringify(committed)}`);
  }
  return committed;
}

export async function sendPrompt({ markerPart, runTabJs, tabId = null, sleep }) {
  const clicked = runTabJs(markerPart, `
    const send = document.querySelector('[data-testid="send-button"]');
    if (!send) return { ok: false, reason: "send-button-not-found", url: location.href, title: document.title };
    if (send.disabled || send.getAttribute("aria-disabled") === "true") {
      return { ok: false, reason: "send-button-disabled", url: location.href, title: document.title };
    }
    send.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      send.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, buttons: 1, pointerId: 1 }));
    }
    return { ok: true, url: location.href, title: document.title };
  `, { activate: true, tabId });
  if (!clicked.ok) throw new Error(`Could not click ChatGPT send button: ${JSON.stringify(clicked)}`);
  let state = null;
  for (let i = 0; i < 180; i += 1) {
    state = runTabJs(markerPart, `
      return {
        url: location.href,
        title: document.title,
        hasMarker: location.href.includes(${JSON.stringify(markerPart)}),
        hasConversation: location.href.includes('/c/'),
        hasStopButton: Boolean(document.querySelector('[data-testid="stop-button"]')),
        composerExists: Boolean(document.querySelector('#prompt-textarea, div[contenteditable="true"]'))
      };
    `, { activate: false, tabId });
    if (state.hasConversation || state.hasStopButton) return state;
    await sleep(1000);
  }
  throw new Error(`sent ChatGPT conversation tab did not start generating: ${JSON.stringify(state)}`);
}
