#!/usr/bin/env node
// Common image-arranger queue entrypoint. It reads queued targets, then delegates
// service-specific browser work to the ChatGPT or Vidu driver.

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const SERVER = option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217").replace(/\/$/, "");
const REQUEST_ID = option("--request", "");
const SERVICE = option("--service", "all");
const MAX_TARGETS = Number(option("--max", "20"));
const CHECK_ONLY = flag("--check");
const DRY_RUN = flag("--dry-run");
const SETUP_PROFILE = flag("--setup-profile");
const LIST_PROFILES = flag("--list-profiles");

const SERVICES = new Set(["all", "chatgpt", "vidu"]);

if (flag("--help") || flag("-h")) {
  console.log(`image-arranger service queue processor.

Usage:
  node scripts/process-service-queue.mjs --setup-profile --service chatgpt
  node scripts/process-service-queue.mjs --setup-profile --service vidu
  node scripts/process-service-queue.mjs --list-profiles --service chatgpt
  node scripts/process-service-queue.mjs --list-profiles --service vidu
  node scripts/process-service-queue.mjs --check --service chatgpt --ensure-tab
  node scripts/process-service-queue.mjs --check --service vidu
  node scripts/process-service-queue.mjs --dry-run
  node scripts/process-service-queue.mjs

Options:
  --server <url>       image-arranger server (default ${SERVER})
  --service <name>     all, chatgpt, or vidu (default all)
  --request <id>       limit processing to one request id
  --max <n>            max targets per delegated driver (default ${MAX_TARGETS})
  --dry-run            list eligible ChatGPT/Vidu targets without browser work
  --check              run service preflight checks

ChatGPT passthrough:
  --setup-profile, --list-profiles, --profile-choice <n>, --profile-config <path>,
  --ensure-tab, --keep-modal, --download-dir <dir>, --image-model <pattern>

Vidu passthrough:
  --setup-profile, --list-profiles, --profile-choice <n>, --profile-config <path>,
  --vidu-url <url>, --download-dir <dir>, --timeout-min <n>, --allow-paid, --keep-tabs

Vidu --check always verifies the selected profile marker tab and attempts the
profile-safe setup/repair route when that marker tab is missing.

Profile setup/list always requires --service chatgpt or --service vidu.`);
  process.exit(0);
}

function flag(name) {
  return args.includes(name);
}

function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function api(path) {
  const response = await fetch(`${SERVER}${path}`);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} -> HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload;
}

function isChatgptTarget(row) {
  return ["generate", "improve"].includes(row.action)
    && (row.service === "chatgpt" || !row.service)
    && !row.inputs?.endFrame
    && row.mode !== "video";
}

function isViduTarget(row) {
  return row.action === "generate"
    && (row.service === "vidu" || row.mode === "video" || Boolean(row.inputs?.endFrame));
}

function serviceForTarget(row) {
  if (isViduTarget(row)) return "vidu";
  if (isChatgptTarget(row)) return "chatgpt";
  return "unsupported";
}

function selectTargets(queue) {
  const rows = (queue.requests ?? [])
    .filter((row) => (REQUEST_ID ? row.requestId === REQUEST_ID : true))
    .map((row) => ({ ...row, dispatchService: serviceForTarget(row) }))
    .filter((row) => SERVICE === "all" ? true : row.dispatchService === SERVICE)
    .filter((row) => row.dispatchService === "chatgpt" || row.dispatchService === "vidu");
  return rows.slice(0, Math.max(1, MAX_TARGETS));
}

function summarizeTargets(rows) {
  const counts = { chatgpt: 0, vidu: 0, unsupported: 0 };
  for (const row of rows) {
    counts[row.dispatchService] = (counts[row.dispatchService] ?? 0) + 1;
  }
  return {
    counts,
    targets: rows.map((row) => ({
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      service: row.dispatchService,
      requestedService: row.service,
      mode: row.mode,
      action: row.action,
      overview: row.overview,
      entryId: row.entryId,
      outputDir: row.outputDir,
      refImages: row.inputs?.refImages ?? [],
      startFrame: row.inputs?.startFrame ?? null,
      endFrame: row.inputs?.endFrame ?? null,
    })),
  };
}

function passIfPresent(target, source = target) {
  const value = option(source);
  return value == null ? [] : [target, value];
}

function commonArgs() {
  const next = ["--server", SERVER];
  if (REQUEST_ID) next.push("--request", REQUEST_ID);
  if (option("--max") != null) next.push("--max", String(MAX_TARGETS));
  if (DRY_RUN) next.push("--dry-run");
  if (CHECK_ONLY) next.push("--check");
  return next;
}

function chatgptArgs() {
  const next = [
    ...commonArgs(),
    ...passIfPresent("--profile-choice"),
    ...passIfPresent("--profile-config"),
    ...passIfPresent("--download-dir"),
    ...passIfPresent("--image-model"),
  ];
  if (flag("--ensure-tab")) next.push("--ensure-tab");
  if (flag("--keep-modal")) next.push("--keep-modal");
  if (SETUP_PROFILE) next.push("--setup-profile");
  if (LIST_PROFILES) next.push("--list-profiles");
  return next;
}

function viduArgs() {
  const next = [
    ...commonArgs(),
    ...passIfPresent("--profile-choice"),
    ...passIfPresent("--profile-config"),
    ...passIfPresent("--vidu-url"),
    ...passIfPresent("--download-dir"),
    ...passIfPresent("--timeout-min"),
  ];
  if (flag("--allow-paid")) next.push("--allow-paid");
  if (flag("--keep-tabs")) next.push("--keep-tabs");
  if (SETUP_PROFILE) next.push("--setup-profile");
  if (LIST_PROFILES) next.push("--list-profiles");
  return next;
}

function runDriver(service) {
  const script = service === "chatgpt"
    ? "scripts/process-chatgpt-profile-queue.mjs"
    : "scripts/process-vidu-queue.mjs";
  const driverArgs = service === "chatgpt" ? chatgptArgs() : viduArgs();
  console.log(`\n==> ${service}: node ${script} ${driverArgs.join(" ")}`);
  const result = spawnSync(process.execPath, [script, ...driverArgs], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function servicesFromTargets(rows) {
  return [...new Set(rows.map((row) => row.dispatchService))]
    .filter((service) => service === "chatgpt" || service === "vidu");
}

async function main() {
  if (!SERVICES.has(SERVICE)) {
    throw new Error(`Unsupported --service ${SERVICE}; choose all, chatgpt, or vidu`);
  }
  if (SETUP_PROFILE || LIST_PROFILES) {
    if (SERVICE === "all") {
      throw new Error("--setup-profile and --list-profiles require an explicit --service chatgpt or --service vidu");
    }
    process.exitCode = runDriver(SERVICE);
    return;
  }

  const queue = await api("/api/requests");
  const selected = selectTargets(queue);
  const supported = selected.filter((row) => row.dispatchService === "chatgpt" || row.dispatchService === "vidu");
  const summary = summarizeTargets(selected);

  if (DRY_RUN) {
    console.log(JSON.stringify({
      server: SERVER,
      projectRoot: queue.projectRoot,
      service: SERVICE,
      ...summary,
    }, null, 2));
    return;
  }

  let services = [];
  if (CHECK_ONLY && SERVICE !== "all") {
    services = [SERVICE];
  } else {
    services = servicesFromTargets(supported);
  }

  if (!services.length) {
    console.log(JSON.stringify({
      ok: true,
      message: CHECK_ONLY
        ? "No queued ChatGPT/Vidu targets matched. Use --service chatgpt or --service vidu to force a specific preflight."
        : "No eligible queued ChatGPT/Vidu targets",
      server: SERVER,
      projectRoot: queue.projectRoot,
      service: SERVICE,
      ...summary,
    }, null, 2));
    return;
  }

  let exitCode = 0;
  for (const service of services) {
    const code = runDriver(service);
    if (code !== 0) exitCode = code;
  }
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
