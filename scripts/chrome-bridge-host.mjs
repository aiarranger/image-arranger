#!/usr/bin/env node
// Local-only command relay for the image-arranger Chrome bridge extension.
// Driver scripts send commands here; the installed Chrome extension long-polls
// this host from the selected normal Chrome profile and executes them there.

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const PORT = Number(option("--port", process.env.IMAGE_ARRANGER_CHROME_BRIDGE_PORT || "4218"));
const HOST = "127.0.0.1";
const LONG_POLL_MS = Number(process.env.IMAGE_ARRANGER_CHROME_BRIDGE_LONG_POLL_MS || "25000");
const MIN_DRIVER_TIMEOUT_MS = Number(process.env.IMAGE_ARRANGER_CHROME_BRIDGE_MIN_TIMEOUT_MS || "10000");
const BRIDGE_TOKEN = process.env.IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN || "";

const commands = [];
const pendingDrivers = new Map();
const waitingExtensions = new Map();
const clients = new Map();

function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function allowedCorsOrigin(request) {
  const origin = String(request.headers.origin || "");
  if (!origin) return "";
  return origin.startsWith("chrome-extension://") ? origin : "";
}

function corsHeaders(request, extra = {}) {
  const origin = allowedCorsOrigin(request);
  return {
    "Cache-Control": "no-store",
    ...(origin ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    } : {}),
    ...extra,
  };
}

function sendJson(request, response, status, payload) {
  response.writeHead(status, corsHeaders(request, { "Content-Type": "application/json" }));
  response.end(JSON.stringify(payload));
}

function requireBridgeToken(request) {
  if (!BRIDGE_TOKEN) {
    throw new Error("Chrome bridge host token is not configured. Start the host through scripts/chrome-bridge-client.mjs.");
  }
  const received = String(request.headers["x-image-arranger-bridge-token"] || "");
  if (received !== BRIDGE_TOKEN) {
    throw new Error("Invalid or missing image-arranger Chrome bridge token");
  }
}

function readBody(request) {
  return new Promise((resolveRead, rejectRead) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        request.destroy(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolveRead(data ? JSON.parse(data) : {});
      } catch (error) {
        rejectRead(error);
      }
    });
    request.on("error", rejectRead);
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function targetEmailFromUrlPart(urlPart) {
  const params = new URLSearchParams(String(urlPart || "").replace(/^\?/, ""));
  return normalizeEmail(params.get("profile-email") || "");
}

function validateDriverCommandOrigin(request) {
  const origin = String(request.headers.origin || "");
  if (origin) {
    throw new Error(`Driver commands must come from the local Node client, not browser origin ${origin}`);
  }
}

function validateExtensionOrigin(request) {
  const origin = String(request.headers.origin || "");
  if (!origin || !origin.startsWith("chrome-extension://")) {
    throw new Error(`Extension commands must come from the image-arranger Chrome extension, not browser origin ${origin}`);
  }
  return origin.replace(/^chrome-extension:\/\//, "").replace(/\/$/, "");
}

function assertExtensionIdMatchesOrigin(request, extensionId) {
  const originExtensionId = validateExtensionOrigin(request);
  if (String(extensionId || "") !== originExtensionId) {
    throw new Error("Bridge extension id does not match the request Origin");
  }
  return originExtensionId;
}

function validateDriverUrlPart(urlPart) {
  const value = String(urlPart || "");
  const params = new URLSearchParams(value.replace(/^\?/, ""));
  if (!["image-arranger", "image-arranger-vidu"].includes(params.get("agent-work") || "")
    || !params.get("profile-directory")
    || !params.get("profile-email")) {
    throw new Error("Chrome bridge driver commands require a marker URL part containing agent-work, profile-directory, and profile-email");
  }
}

function removeQueuedCommand(commandId) {
  const index = commands.findIndex((command) => command.id === commandId);
  if (index >= 0) commands.splice(index, 1);
}

function rememberClient(client) {
  const clientId = String(client.clientId || "").trim();
  if (!clientId) return null;
  const email = normalizeEmail(client.email);
  if (!email) return null;
  const current = {
    clientId,
    email,
    extensionId: String(client.extensionId || ""),
    userAgent: String(client.userAgent || ""),
    lastSeenAt: new Date().toISOString(),
    lastSeenMs: Date.now(),
  };
  clients.set(clientId, current);
  return current;
}

function commandMatchesClient(command, client) {
  if (!client) return false;
  if (command.attemptedClients?.includes(client.clientId)) return false;
  if (command.expectedClientId && client.clientId !== command.expectedClientId) return false;
  if (command.expectedExtensionId && client.extensionId !== command.expectedExtensionId) return false;
  if (command.targetEmail && client.email !== command.targetEmail) return false;
  return true;
}

function publicClients() {
  return [...clients.values()]
    .filter((client) => Date.now() - client.lastSeenMs < 120000)
    .map((client) => ({
      clientId: client.clientId,
      email: client.email,
      extensionId: client.extensionId,
      lastSeenAt: client.lastSeenAt,
    }));
}

function nextCommandForClient(client) {
  const index = commands.findIndex((command) => commandMatchesClient(command, client));
  if (index < 0) return null;
  const [command] = commands.splice(index, 1);
  command.dispatchedTo = client.clientId;
  command.dispatchedExtensionId = client.extensionId;
  if (!command.attemptedClients.includes(client.clientId)) {
    command.attemptedClients.push(client.clientId);
  }
  return command;
}

function dispatchWaitingExtensions() {
  for (const [clientId, waiter] of waitingExtensions) {
    const client = clients.get(clientId);
    const command = nextCommandForClient(client);
    if (!command) continue;
    waitingExtensions.delete(clientId);
    clearTimeout(waiter.timer);
    sendJson(waiter.request, waiter.response, 200, command);
  }
}

function completeDriver(commandId, payload) {
  const pending = pendingDrivers.get(commandId);
  if (!pending) return false;
  pendingDrivers.delete(commandId);
  removeQueuedCommand(commandId);
  clearTimeout(pending.timer);
  sendJson(pending.request, pending.response, payload.ok ? 200 : 500, payload);
  return true;
}

function shouldRetryOnAnotherClient(payload, command) {
  if (command?.expectedClientId) return false;
  if (payload.ok) return payload.result?.found === false;
  return /target tab not found/i.test(String(payload.error || ""));
}

function hasUnattemptedMatchingClient(command) {
  return [...clients.values()].some((client) => commandMatchesClient(command, client));
}

async function handleDriverCommand(request, response) {
  requireBridgeToken(request);
  validateDriverCommandOrigin(request);
  const body = await readBody(request);
  validateDriverUrlPart(body.urlPart);
  const command = {
    id: randomUUID(),
    type: String(body.type || ""),
    urlPart: String(body.urlPart || ""),
    js: String(body.js || ""),
    activate: Boolean(body.activate),
    tabId: body.tabId == null || body.tabId === "" ? null : Number(body.tabId),
    timeoutMs: Math.max(MIN_DRIVER_TIMEOUT_MS, Number(body.timeoutMs || 60000)),
    targetEmail: targetEmailFromUrlPart(body.urlPart),
    expectedClientId: String(body.expectedClientId || "").trim(),
    expectedExtensionId: String(body.expectedExtensionId || "").trim(),
    createdAt: new Date().toISOString(),
    attemptedClients: [],
  };
  if (!["find-tab", "run-js"].includes(command.type)) {
    sendJson(request, response, 400, { ok: false, error: `Unsupported bridge command type: ${command.type}` });
    return;
  }
  const timer = setTimeout(() => {
    pendingDrivers.delete(command.id);
    removeQueuedCommand(command.id);
    const matchingClients = publicClients().filter((client) => !command.targetEmail || client.email === command.targetEmail);
    sendJson(request, response, 504, {
      ok: false,
      error: "Chrome bridge command timed out. Install/reload extensions/chrome-bridge in the selected signed-in Chrome profile, then open the exact marker URL in that profile.",
      expectedEmail: command.targetEmail || "",
      matchingClients,
      allConnectedClients: publicClients(),
    });
  }, command.timeoutMs);
  pendingDrivers.set(command.id, { request, response, timer, command });
  commands.push(command);
  dispatchWaitingExtensions();
}

async function handleExtensionHello(request, response) {
  const body = await readBody(request);
  assertExtensionIdMatchesOrigin(request, body.extensionId);
  const client = rememberClient(body);
  if (!client) {
    sendJson(request, response, 400, {
      ok: false,
      error: "Bridge extension did not report a signed-in Chrome profile email. Confirm the extension has identity.email permission and Chrome Sync/profile sign-in is active.",
    });
    return;
  }
  sendJson(request, response, 200, {
    ok: true,
    client,
    pendingCommands: commands.length,
  });
  dispatchWaitingExtensions();
}

function handleExtensionNext(request, response, url) {
  assertExtensionIdMatchesOrigin(request, url.searchParams.get("extensionId"));
  const client = rememberClient({
    clientId: url.searchParams.get("clientId"),
    email: url.searchParams.get("email"),
    extensionId: url.searchParams.get("extensionId"),
    userAgent: request.headers["user-agent"] || "",
  });
  if (!client) {
    sendJson(request, response, 400, { ok: false, error: "clientId is required" });
    return;
  }
  const command = nextCommandForClient(client);
  if (command) {
    sendJson(request, response, 200, command);
    return;
  }
  const timer = setTimeout(() => {
    waitingExtensions.delete(client.clientId);
    sendJson(request, response, 200, { type: "noop" });
  }, LONG_POLL_MS);
  waitingExtensions.set(client.clientId, { request, response, timer });
}

async function handleExtensionResult(request, response) {
  const body = await readBody(request);
  assertExtensionIdMatchesOrigin(request, body.extensionId);
  const id = String(body.id || "");
  const ok = Boolean(body.ok);
  const payload = ok
    ? { ok: true, result: body.result ?? null }
    : { ok: false, error: String(body.error || "Chrome bridge extension command failed") };
  const pending = pendingDrivers.get(id);
  const resultClientId = String(body.clientId || "").trim();
  const resultExtensionId = String(body.extensionId || "").trim();
  if (pending?.command?.dispatchedTo && resultClientId !== pending.command.dispatchedTo) {
    sendJson(request, response, 403, {
      ok: false,
      delivered: false,
      error: "Chrome bridge result client does not match the dispatched client",
      expectedClientId: pending.command.dispatchedTo,
      actualClientId: resultClientId,
    });
    return;
  }
  if (pending?.command?.dispatchedExtensionId && resultExtensionId !== pending.command.dispatchedExtensionId) {
    sendJson(request, response, 403, {
      ok: false,
      delivered: false,
      error: "Chrome bridge result extension does not match the dispatched extension",
      expectedExtensionId: pending.command.dispatchedExtensionId,
      actualExtensionId: resultExtensionId,
    });
    return;
  }
  if (payload.ok && payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)) {
    payload.result.bridgeClientId = resultClientId;
    payload.result.bridgeExtensionId = resultExtensionId;
  }
  if (pending?.command && shouldRetryOnAnotherClient(payload, pending.command) && hasUnattemptedMatchingClient(pending.command)) {
    commands.push(pending.command);
    dispatchWaitingExtensions();
    sendJson(request, response, 200, {
      ok: true,
      delivered: false,
      requeued: true,
      attemptedClients: pending.command.attemptedClients,
    });
    return;
  }
  const delivered = completeDriver(id, payload);
  sendJson(request, response, 200, { ok: true, delivered });
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
  if (request.method === "OPTIONS") {
    if (!allowedCorsOrigin(request)) {
      sendJson(request, response, 403, { ok: false, error: "CORS origin is not allowed" });
      return;
    }
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }
  Promise.resolve().then(async () => {
    if (request.method === "GET" && url.pathname === "/health") {
      requireBridgeToken(request);
      sendJson(request, response, 200, {
        ok: true,
        pid: process.pid,
        clients: publicClients(),
        queuedCommands: commands.length,
        pendingDrivers: pendingDrivers.size,
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/driver/command") {
      await handleDriverCommand(request, response);
      return;
    }
    if (request.method === "POST" && url.pathname === "/extension/hello") {
      await handleExtensionHello(request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/extension/next") {
      handleExtensionNext(request, response, url);
      return;
    }
    if (request.method === "POST" && url.pathname === "/extension/result") {
      await handleExtensionResult(request, response);
      return;
    }
    sendJson(request, response, 404, { ok: false, error: "Not found" });
  }).catch((error) => {
    sendJson(request, response, 500, { ok: false, error: error.stack || error.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`image-arranger Chrome bridge host listening on http://${HOST}:${PORT}`);
});
