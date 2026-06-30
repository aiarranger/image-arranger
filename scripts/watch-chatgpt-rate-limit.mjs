#!/usr/bin/env node
// Waits for the approved ChatGPT marker tab to become usable again after a
// visible rate-limit message. This script only runs --check; it never attaches
// references, inserts prompts, or sends generation requests.

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const SERVER = option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217").replace(/\/$/, "");
const INTERVAL_MIN = Number(option("--interval-min", "30"));
const MAX_CHECKS = Number(option("--max-checks", "0"));
const SERVICE_SCRIPT = "scripts/process-service-queue.mjs";

if (flag("--help") || flag("-h")) {
  console.log(`Wait for ChatGPT rate-limit state to clear.

Usage:
  node scripts/watch-chatgpt-rate-limit.mjs [--server http://127.0.0.1:4217] [--interval-min 30] [--max-checks 0]

Behavior:
  - runs ChatGPT --check --ensure-tab only
  - if the check passes, exits 0
  - if visible rate-limit wording remains, waits --interval-min and checks again
  - if another preflight error appears, exits non-zero

Default --max-checks 0 means keep checking until clear.`);
  process.exit(0);
}

function flag(name) {
  return args.includes(name);
}

function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitOutput(output) {
  return /ChatGPT marker tab is temporarily rate limited|リクエストが多すぎます|Too many requests|rate limit/i.test(output);
}

function runCheck() {
  return spawnSync(process.execPath, [
    SERVICE_SCRIPT,
    "--check",
    "--service",
    "chatgpt",
    "--ensure-tab",
    "--server",
    SERVER,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

async function main() {
  if (!Number.isFinite(INTERVAL_MIN) || INTERVAL_MIN <= 0) {
    throw new Error(`--interval-min must be positive: ${INTERVAL_MIN}`);
  }
  if (!Number.isFinite(MAX_CHECKS) || MAX_CHECKS < 0) {
    throw new Error(`--max-checks must be 0 or greater: ${MAX_CHECKS}`);
  }

  let attempt = 0;
  while (MAX_CHECKS === 0 || attempt < MAX_CHECKS) {
    attempt += 1;
    const checkedAt = new Date().toISOString();
    const result = runCheck();
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status === 0) {
      process.stdout.write(output);
      console.log(JSON.stringify({
        ok: true,
        cleared: true,
        checkedAt,
        attempts: attempt,
        nextCommand: `IMAGE_ARRANGER_IMAGE_MODEL=高 node scripts/process-service-queue.mjs --server ${SERVER}`,
      }, null, 2));
      return;
    }

    if (!isRateLimitOutput(output)) {
      process.stdout.write(output);
      process.exitCode = result.status ?? 1;
      return;
    }

    const nextCheckAt = new Date(Date.now() + INTERVAL_MIN * 60 * 1000).toISOString();
    console.log(JSON.stringify({
      ok: false,
      cleared: false,
      reason: "chatgpt-rate-limit",
      checkedAt,
      attempts: attempt,
      nextCheckAt,
      intervalMin: INTERVAL_MIN,
    }, null, 2));

    if (MAX_CHECKS !== 0 && attempt >= MAX_CHECKS) {
      process.exitCode = 75;
      return;
    }
    await sleep(INTERVAL_MIN * 60 * 1000);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
