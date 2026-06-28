const BRIDGE_URL = "http://127.0.0.1:4218";
const CLIENT_ID_KEY = "imageArrangerChromeBridgeClientId";

let clientIdPromise = null;
let profileEmailPromise = null;
let polling = false;

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function callbackToPromise(fn) {
  return new Promise((resolveCall, rejectCall) => {
    fn((value) => {
      const error = chrome.runtime.lastError;
      if (error) rejectCall(new Error(error.message));
      else resolveCall(value);
    });
  });
}

async function getClientId() {
  if (clientIdPromise) return clientIdPromise;
  clientIdPromise = (async () => {
    const stored = await callbackToPromise((done) => chrome.storage?.local?.get?.([CLIENT_ID_KEY], done)).catch(() => ({}));
    if (stored?.[CLIENT_ID_KEY]) return stored[CLIENT_ID_KEY];
    const next = crypto.randomUUID();
    await callbackToPromise((done) => chrome.storage?.local?.set?.({ [CLIENT_ID_KEY]: next }, done)).catch(() => null);
    return next;
  })();
  return clientIdPromise;
}

async function getProfileEmail() {
  if (profileEmailPromise) return profileEmailPromise;
  profileEmailPromise = callbackToPromise((done) => (
    chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, done)
  ))
    .then((info) => (info?.email || "").toLowerCase())
    .catch(() => "");
  return profileEmailPromise;
}

async function getRequiredProfileEmail() {
  const email = await getProfileEmail();
  if (!email) {
    throw new Error("Chrome profile email is empty. Sign in to the selected Chrome profile and confirm the extension has identity.email permission.");
  }
  return email;
}

async function postJson(path, body) {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

async function getJson(path) {
  const response = await fetch(`${BRIDGE_URL}${path}`);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}

async function hello() {
  return postJson("/extension/hello", {
    clientId: await getClientId(),
    email: await getRequiredProfileEmail(),
    extensionId: chrome.runtime.id,
    userAgent: navigator.userAgent,
  });
}

function markerFromUrlPart(urlPart) {
  const params = new URLSearchParams(String(urlPart || "").replace(/^\?/, ""));
  const agentWork = params.get("agent-work") || "";
  const profileEmail = (params.get("profile-email") || "").toLowerCase();
  const profileDirectory = params.get("profile-directory") || "";
  if (!["image-arranger", "image-arranger-vidu"].includes(agentWork) || !profileEmail || !profileDirectory) {
    throw new Error(`invalid image-arranger marker: ${urlPart}`);
  }
  return { agentWork, profileEmail, profileDirectory };
}

function tabMatchesMarker(tabUrl, marker) {
  let parsed;
  try {
    parsed = new URL(tabUrl);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const expectedHosts = marker.agentWork === "image-arranger-vidu"
    ? ["vidu.com", "www.vidu.com"]
    : ["chatgpt.com"];
  return parsed.protocol === "https:"
    && expectedHosts.includes(host)
    && parsed.searchParams.get("agent-work") === marker.agentWork
    && parsed.searchParams.get("profile-directory") === marker.profileDirectory
    && (parsed.searchParams.get("profile-email") || "").toLowerCase() === marker.profileEmail;
}

function tabAllowedForMarker(tabUrl, marker) {
  let parsed;
  try {
    parsed = new URL(tabUrl);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:") return false;
  if (marker.agentWork === "image-arranger-vidu") {
    return ["vidu.com", "www.vidu.com"].includes(host);
  }
  if (marker.agentWork === "image-arranger") {
    return host === "chatgpt.com";
  }
  return false;
}

function tabResult(tab, matchedBy) {
  return {
    found: true,
    matchedBy,
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url || "",
    title: tab.title || "",
  };
}

async function focusTab(tab) {
  if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => null);
  if (tab.id != null) await chrome.tabs.update(tab.id, { active: true }).catch(() => null);
}

async function findTab(urlPart, activate, tabId = null) {
  const marker = markerFromUrlPart(urlPart);
  if (tabId != null && Number.isFinite(Number(tabId))) {
    const tab = await chrome.tabs.get(Number(tabId)).catch(() => null);
    if (tab && tabAllowedForMarker(tab.url || "", marker)) {
      if (activate) await focusTab(tab);
      return tabResult(tab, "tabId");
    }
  }
  const tabs = await chrome.tabs.query({});
  const tab = tabs.find((item) => tabMatchesMarker(item.url || "", marker));
  if (!tab) return { found: false };
  if (activate) await focusTab(tab);
  return tabResult(tab, "marker");
}

async function runJs(command) {
  const tab = await findTab(command.urlPart, command.activate, command.tabId);
  if (!tab.found || tab.tabId == null) {
    throw new Error(`target tab not found: ${command.urlPart}`);
  }
  const debuggee = { tabId: tab.tabId };
  await chrome.debugger.attach(debuggee, "1.3");
  try {
    const expression = `(() => {
      const value = (() => { ${command.js} })();
      return JSON.stringify(value === undefined ? null : value);
    })()`;
    const evaluated = await chrome.debugger.sendCommand(debuggee, "Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (evaluated.exceptionDetails) {
      const detail = evaluated.exceptionDetails.exception?.description
        || evaluated.exceptionDetails.text
        || "Runtime.evaluate failed";
      throw new Error(detail);
    }
    const raw = evaluated.result?.value;
    return raw ? JSON.parse(raw) : null;
  } finally {
    await chrome.debugger.detach(debuggee).catch(() => null);
  }
}

async function handleCommand(command) {
  if (command.type === "noop") return;
  const clientId = await getClientId();
  if (command.type === "find-tab") {
    const result = await findTab(command.urlPart, command.activate, command.tabId);
    await postJson("/extension/result", { id: command.id, clientId, extensionId: chrome.runtime.id, ok: true, result });
    return;
  }
  if (command.type === "run-js") {
    const result = await runJs(command);
    await postJson("/extension/result", { id: command.id, clientId, extensionId: chrome.runtime.id, ok: true, result });
    return;
  }
  throw new Error(`Unsupported command type: ${command.type}`);
}

async function pollOnce() {
  const clientId = await getClientId();
  const email = await getRequiredProfileEmail();
  const query = new URLSearchParams({
    clientId,
    email,
    extensionId: chrome.runtime.id,
  });
  const command = await getJson(`/extension/next?${query.toString()}`);
  try {
    await handleCommand(command);
  } catch (error) {
    if (command?.id) {
      await postJson("/extension/result", {
        id: command.id,
        clientId,
        extensionId: chrome.runtime.id,
        ok: false,
        error: error.stack || error.message,
      }).catch(() => null);
    }
  }
}

async function pollLoop() {
  if (polling) return;
  polling = true;
  while (true) {
    try {
      await hello();
      await pollOnce();
    } catch {
      await delay(2000);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  pollLoop();
});

chrome.runtime.onStartup.addListener(() => {
  pollLoop();
});

pollLoop();
