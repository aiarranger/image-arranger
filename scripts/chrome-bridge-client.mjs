#!/usr/bin/env node
// Synchronous client used by chrome-route-windows.mjs to talk to the local
// Chrome bridge host. The host is started on demand and relays commands to the
// unpacked Chrome extension installed in the selected normal Chrome profile.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.IMAGE_ARRANGER_CHROME_BRIDGE_PORT || "4218");
const HOST_URL = process.env.IMAGE_ARRANGER_CHROME_BRIDGE_URL || `http://127.0.0.1:${PORT}`;
const HOST_SCRIPT = join(SCRIPT_DIR, "chrome-bridge-host.mjs");
const TOKEN_FILE = process.env.IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN_FILE || join(process.cwd(), "workspace/.local/chrome-bridge-token");
const HEALTH_ONLY = process.argv.includes("--health");

function assertLocalBridgeUrl() {
  const parsed = new URL(HOST_URL);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`IMAGE_ARRANGER_CHROME_BRIDGE_URL must be local http://127.0.0.1 or localhost, got ${HOST_URL}`);
  }
  if (PORT !== 4218 && process.env.IMAGE_ARRANGER_CHROME_BRIDGE_ALLOW_PORT_OVERRIDE !== "1") {
    throw new Error("IMAGE_ARRANGER_CHROME_BRIDGE_PORT must stay 4218 because extensions/chrome-bridge polls that fixed local port. Port override is only allowed in tests.");
  }
  if (parsed.port && Number(parsed.port) !== PORT) {
    throw new Error(`IMAGE_ARRANGER_CHROME_BRIDGE_URL port (${parsed.port}) must match IMAGE_ARRANGER_CHROME_BRIDGE_PORT (${PORT})`);
  }
}

function bridgeToken() {
  if (process.env.IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN) return process.env.IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN;
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, "utf8").trim();
  mkdirSync(dirname(TOKEN_FILE), { recursive: true });
  const token = randomBytes(32).toString("base64url");
  writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  return token;
}

function authHeaders(extra = {}) {
  return {
    "X-Image-Arranger-Bridge-Token": bridgeToken(),
    ...extra,
  };
}

function readStdin() {
  return new Promise((resolveRead, rejectRead) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolveRead(data));
    process.stdin.on("error", rejectRead);
  });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${HOST_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${path} -> HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  }
  return payload;
}

async function health(timeoutMs = 500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchJson("/health", { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function startHost() {
  const token = bridgeToken();
  const child = spawn(process.execPath, [HOST_SCRIPT, "--port", String(PORT)], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN: token,
      IMAGE_ARRANGER_CHROME_BRIDGE_TOKEN_FILE: TOKEN_FILE,
    },
  });
  child.unref();
}

async function ensureHost() {
  try {
    await health();
    return;
  } catch {
    startHost();
  }
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 5000) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    try {
      await health(1000);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Chrome bridge host did not start on ${HOST_URL}: ${lastError?.message ?? "unknown error"}`);
}

async function main() {
  assertLocalBridgeUrl();
  await ensureHost();
  if (HEALTH_ONLY) {
    const payload = await health(2000);
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  const raw = await readStdin();
  const command = raw.trim() ? JSON.parse(raw) : {};
  const controller = new AbortController();
  const timeoutMs = Math.max(10000, Number(command.timeoutMs || 60000) + 5000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = await fetchJson("/driver/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } finally {
    clearTimeout(timer);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
