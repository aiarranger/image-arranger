import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assertSingleBridgeCandidateForProfile } from "./scripts/chrome-route-windows.mjs";

const HOST = "127.0.0.1";
const TOKEN = "test-bridge-token";
const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

async function getFreePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, HOST, resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  return port;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.token ? { "X-Image-Arranger-Bridge-Token": options.token } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${response.status}: ${JSON.stringify(payload)}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function startHost(t) {
  const port = await getFreePort();
  const child = spawn(process.execPath, ["scripts/chrome-bridge-host.mjs", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN: TOKEN,
      IMAGE_ARRANGER_CHROME_BRIDGE_MIN_TIMEOUT_MS: "100",
      IMAGE_ARRANGER_CHROME_BRIDGE_LONG_POLL_MS: "100",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(() => {
    if (child.exitCode == null) child.kill();
  });
  const baseUrl = `http://${HOST}:${port}`;
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 5000) {
    try {
      await fetchJson(`${baseUrl}/health`, { token: TOKEN });
      return { baseUrl };
    } catch (error) {
      lastError = error;
      if (child.exitCode != null) break;
      await delay(100);
    }
  }
  throw new Error(`bridge host did not start: ${lastError?.message || "unknown"} ${output}`);
}

function marker(email = "target@example.com") {
  return new URLSearchParams({
    "agent-work": "image-arranger-vidu",
    "profile-directory": "Default",
    "profile-email": email,
  }).toString();
}

test("Chrome bridge rejects unauthenticated driver commands and non-extension browser origins", async (t) => {
  const { baseUrl } = await startHost(t);
  await assert.rejects(
    () => fetchJson(`${baseUrl}/driver/command`, {
      method: "POST",
      body: JSON.stringify({ type: "find-tab", urlPart: marker(), timeoutMs: 10000 }),
    }),
    /Invalid or missing image-arranger Chrome bridge token/,
  );
  await assert.rejects(
    () => fetchJson(`${baseUrl}/extension/next?clientId=fake&email=target%40example.com&extensionId=${EXTENSION_ID}`),
    /Extension commands must come from the image-arranger Chrome extension/,
  );
  await assert.rejects(
    () => fetchJson(`${baseUrl}/extension/result`, {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "text/plain" },
      body: JSON.stringify({ id: "not-real", ok: true }),
    }),
    /Extension commands must come from the image-arranger Chrome extension/,
  );
});

test("unbound bridge binding refuses duplicate signed-in emails in Chrome Local State", () => {
  const root = mkdtempSync(join(tmpdir(), "image-arranger-chrome-local-state-"));
  const previousRoot = process.env.IMAGE_ARRANGER_CHROME_USER_DATA_ROOT;
  const previousForce = process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE;
  try {
    writeFileSync(join(root, "Local State"), JSON.stringify({
      profile: {
        info_cache: {
          Default: { name: "Main", user_name: "same@example.com" },
          "Profile 1": { name: "Other", user_name: "same@example.com" },
        },
      },
    }));
    process.env.IMAGE_ARRANGER_CHROME_USER_DATA_ROOT = root;
    process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE = "true";
    assert.throws(
      () => assertSingleBridgeCandidateForProfile({ email: "same@example.com" }),
      /Multiple Chrome profiles use same@example\.com/,
    );
  } finally {
    if (previousRoot == null) delete process.env.IMAGE_ARRANGER_CHROME_USER_DATA_ROOT;
    else process.env.IMAGE_ARRANGER_CHROME_USER_DATA_ROOT = previousRoot;
    if (previousForce == null) delete process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE;
    else process.env.IMAGE_ARRANGER_FORCE_CHROME_BRIDGE = previousForce;
    rmSync(root, { recursive: true, force: true });
  }
});

test("Chrome bridge dispatches commands to the selected profile email", async (t) => {
  const { baseUrl } = await startHost(t);
  const email = "target@example.com";
  const nextPromise = fetchJson(`${baseUrl}/extension/next?clientId=client-a&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  await delay(50);
  const driverPromise = fetchJson(`${baseUrl}/driver/command`, {
    method: "POST",
    token: TOKEN,
    body: JSON.stringify({ type: "find-tab", urlPart: marker(email), activate: true, timeoutMs: 10000 }),
  });
  const command = await nextPromise;
  assert.equal(command.type, "find-tab");
  assert.equal(command.targetEmail, email);
  assert.equal(command.urlPart, marker(email));
  await fetchJson(`${baseUrl}/extension/result`, {
    method: "POST",
    headers: { Origin: EXTENSION_ORIGIN },
    body: JSON.stringify({
      id: command.id,
      clientId: "client-a",
      extensionId: EXTENSION_ID,
      ok: true,
      result: {
        found: true,
        url: `https://www.vidu.com/ja/create/img2video?${marker(email)}`,
      },
    }),
  });
  const result = await driverPromise;
  assert.equal(result.ok, true);
  assert.equal(result.result.found, true);
  assert.equal(result.result.bridgeClientId, "client-a");
  assert.equal(result.result.bridgeExtensionId, EXTENSION_ID);
});

test("Chrome bridge requeues target-tab misses to another matching profile client", async (t) => {
  const { baseUrl } = await startHost(t);
  const email = "target@example.com";
  const firstPoll = fetchJson(`${baseUrl}/extension/next?clientId=client-a&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  const secondPoll = fetchJson(`${baseUrl}/extension/next?clientId=client-b&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  await delay(50);
  const driverPromise = fetchJson(`${baseUrl}/driver/command`, {
    method: "POST",
    token: TOKEN,
    body: JSON.stringify({ type: "run-js", urlPart: marker(email), js: "return 42;", timeoutMs: 10000 }),
  });
  const firstCommand = await firstPoll;
  assert.equal(firstCommand.type, "run-js");
  const missAck = await fetchJson(`${baseUrl}/extension/result`, {
    method: "POST",
    headers: { Origin: EXTENSION_ORIGIN },
    body: JSON.stringify({
      id: firstCommand.id,
      clientId: "client-a",
      extensionId: EXTENSION_ID,
      ok: false,
      error: `target tab not found: ${marker(email)}`,
    }),
  });
  assert.equal(missAck.requeued, true);
  const secondCommand = await secondPoll;
  assert.equal(secondCommand.id, firstCommand.id);
  assert.equal(secondCommand.type, "run-js");
  await fetchJson(`${baseUrl}/extension/result`, {
    method: "POST",
    headers: { Origin: EXTENSION_ORIGIN },
    body: JSON.stringify({
      id: secondCommand.id,
      clientId: "client-b",
      extensionId: EXTENSION_ID,
      ok: true,
      result: 42,
    }),
  });
  const result = await driverPromise;
  assert.equal(result.ok, true);
  assert.equal(result.result, 42);
});

test("Chrome bridge dispatches only to the bound client when expectedClientId is set", async (t) => {
  const { baseUrl } = await startHost(t);
  const email = "target@example.com";
  const wrongPoll = fetchJson(`${baseUrl}/extension/next?clientId=client-a&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  const rightPoll = fetchJson(`${baseUrl}/extension/next?clientId=client-b&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  await delay(50);
  const driverPromise = fetchJson(`${baseUrl}/driver/command`, {
    method: "POST",
    token: TOKEN,
    body: JSON.stringify({
      type: "find-tab",
      urlPart: marker(email),
      tabId: 123,
      expectedClientId: "client-b",
      expectedExtensionId: EXTENSION_ID,
      timeoutMs: 10000,
    }),
  });
  const command = await rightPoll;
  assert.equal(command.dispatchedTo, "client-b");
  assert.equal(command.tabId, 123);
  const wrong = await wrongPoll;
  assert.equal(wrong.type, "noop");
  await fetchJson(`${baseUrl}/extension/result`, {
    method: "POST",
    headers: { Origin: EXTENSION_ORIGIN },
    body: JSON.stringify({
      id: command.id,
      clientId: "client-b",
      extensionId: EXTENSION_ID,
      ok: true,
      result: { found: true },
    }),
  });
  const result = await driverPromise;
  assert.equal(result.ok, true);
});

test("Chrome bridge refuses stale or mismatched extension results", async (t) => {
  const { baseUrl } = await startHost(t);
  const email = "target@example.com";
  const nextPromise = fetchJson(`${baseUrl}/extension/next?clientId=client-a&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  await delay(50);
  const driverPromise = fetchJson(`${baseUrl}/driver/command`, {
    method: "POST",
    token: TOKEN,
    body: JSON.stringify({ type: "find-tab", urlPart: marker(email), timeoutMs: 10000 }),
  });
  const command = await nextPromise;
  await assert.rejects(
    () => fetchJson(`${baseUrl}/extension/result`, {
      method: "POST",
      headers: { Origin: EXTENSION_ORIGIN },
      body: JSON.stringify({
        id: command.id,
        clientId: "client-b",
        extensionId: EXTENSION_ID,
        ok: true,
        result: { found: true },
      }),
    }),
    /result client does not match/,
  );
  await fetchJson(`${baseUrl}/extension/result`, {
    method: "POST",
    headers: { Origin: EXTENSION_ORIGIN },
    body: JSON.stringify({
      id: command.id,
      clientId: "client-a",
      extensionId: EXTENSION_ID,
      ok: true,
      result: { found: true },
    }),
  });
  await driverPromise;
});

test("Chrome bridge timeout removes stale queued commands", async (t) => {
  const { baseUrl } = await startHost(t);
  const email = "target@example.com";
  await assert.rejects(
    () => fetchJson(`${baseUrl}/driver/command`, {
      method: "POST",
      token: TOKEN,
      body: JSON.stringify({ type: "find-tab", urlPart: marker(email), timeoutMs: 100 }),
    }),
    /timed out/,
  );
  const next = await fetchJson(`${baseUrl}/extension/next?clientId=client-a&email=${encodeURIComponent(email)}&extensionId=${EXTENSION_ID}`, {
    headers: { Origin: EXTENSION_ORIGIN },
  });
  assert.equal(next.type, "noop");
});
