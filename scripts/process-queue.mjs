#!/usr/bin/env node
// Scripted queue processor: takes ChatGPT image-generation targets from a
// running image-arranger server and carries each one through the whole
// pipeline — fresh chat, attach references, send prompt, wait, save the
// result into outputDir, register it as an asset candidate, report
// completion — while writing a reviewable run log (markdown + screenshots)
// into agent-logs/.
//
//   node scripts/process-queue.mjs --check                  one-time setup / health check
//   node scripts/process-queue.mjs                          process every queued chatgpt generate target
//   node scripts/process-queue.mjs --request <id>           process one request only
//   node scripts/process-queue.mjs --dry-run                list what would be processed
//
// Options: --server http://127.0.0.1:4217  --cdp-port 9377  --max <n>
//          --keep-tabs (leave chat tabs open for inspection)

if (typeof WebSocket === "undefined") {
  console.error("scripts/process-queue.mjs needs Node 22+ (global WebSocket). The server itself runs on Node 20+.");
  process.exit(1);
}

import { mkdirSync } from "node:fs";
import { isAbsolute, join, resolve, basename } from "node:path";
import {
  DEFAULTS, RunLog, ensureChrome, openChat, closePage, checkLogin,
  attachImages, setPrompt, sendMessage, waitForImageReply, downloadImage, sleep,
  selectorSelfTest,
} from "./agent-browser.mjs";

const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const HELP = `Scripted queue processor — drives ChatGPT's web UI over CDP to fulfill
queued image-generation targets from a running image-arranger server.

Usage:
  node scripts/process-queue.mjs --check          one-time setup / health check
                                                  (Chrome + login + selector self-test)
  node scripts/process-queue.mjs                  process every queued chatgpt generate target
  node scripts/process-queue.mjs --request <id>   process one request only
  node scripts/process-queue.mjs --dry-run        list what would be processed (needs server)

Options:
  --server <url>     image-arranger server (default http://127.0.0.1:4217, $IMAGE_ARRANGER_SERVER)
  --cdp-port <n>     automation Chrome CDP port (default ${DEFAULTS.cdpPort})
  --max <n>          cap targets processed (default 20)
  --parallel <n>     targets in flight at once, each in its own tab (default 1)
  --keep-tabs        leave chat tabs open for inspection
  --help, -h         show this help and exit

The --check selector self-test verifies ChatGPT's UI still exposes the elements
the automation depends on. On mismatch it prints an actionable message pointing
at SELECTORS.md (repo root), which documents every selector and how to patch it.`;

if (flag("--help") || flag("-h")) {
  console.log(HELP);
  process.exit(0);
}

const SERVER = (option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217")).replace(/\/$/, "");
const CDP_PORT = Number(option("--cdp-port", DEFAULTS.cdpPort));
const MAX_TARGETS = Number(option("--max", "20"));
const RETRIES_PER_TARGET = 3;
// How many targets run at once, each in its own chat tab (--parallel <n>).
const PARALLEL = Math.max(1, Number(option("--parallel", process.env.IMAGE_ARRANGER_PARALLEL ?? "1")) || 1);

async function api(path, body = null) {
  const response = await fetch(`${SERVER}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  return payload;
}

function slugify(value, fallback = "output") {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || fallback;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

async function main() {
  const queue = await api("/api/requests");
  const projectRoot = queue.projectRoot;
  const runLog = new RunLog(join(projectRoot, "agent-logs"), `run-${timestamp()}`);
  runLog.log(`server ${SERVER}, projectRoot ${projectRoot}`);
  runLog.log(`run log: ${runLog.dir}`);

  const all = queue.requests ?? [];
  const wanted = all
    .filter((row) => option("--request") ? row.requestId === option("--request") : true)
    .filter((row) => row.action === "generate" && (row.service === "chatgpt" || !row.service))
    .slice(0, MAX_TARGETS);
  const skipped = all.filter((row) => !wanted.includes(row));
  for (const row of skipped) {
    runLog.log(`skipping ${row.requestId}[${row.targetIndex}] (action=${row.action}, service=${row.service}) — handled by an agent, not this script`, "warn");
  }
  runLog.log(`${wanted.length} chatgpt generate target(s) to process`);
  if (flag("--dry-run")) {
    runLog.attachJson("dry-run targets", wanted);
    console.log(JSON.stringify(wanted.map((row) => ({ requestId: row.requestId, targetIndex: row.targetIndex, entryId: row.entryId, overview: row.overview })), null, 2));
    return;
  }

  const chrome = await ensureChrome({ cdpPort: CDP_PORT, log: (message) => runLog.log(message) });
  runLog.log(`automation Chrome ready (${chrome.alreadyRunning ? "already running" : "launched"}): ${chrome.version?.Browser ?? ""}`);

  // Login probe + selector self-test (also used by --check).
  {
    const page = await openChat({ cdpPort: CDP_PORT });
    const login = await checkLogin(page);
    await runLog.shot(page, "login-check");
    if (login !== "ok") {
      runLog.log(`ChatGPT is not logged in (state: ${login}). Sign in once in the automation Chrome window, then rerun.`, "error");
      console.error("\n>>> Sign in to ChatGPT in the automation Chrome window that just opened, then rerun this script. <<<\n");
      process.exitCode = 2;
      return;
    }
    runLog.log("ChatGPT login OK");

    // Selector self-test: verify the core elements the automation depends on
    // still exist on the live page. Never throws — reports what is missing so
    // breakage is announced clearly instead of failing deep in the pipeline.
    const selfTest = await selectorSelfTest(page);
    runLog.attachJson("selector self-test", selfTest);
    for (const check of selfTest.checks ?? []) {
      runLog.log(`selector ${check.name}: ${check.ok ? `OK (${check.matched})` : "NOT FOUND"}`, check.ok ? "info" : "warn");
    }
    if (!selfTest.ok) {
      const detail = selfTest.pageError
        ? `self-test could not run (${selfTest.pageError})`
        : `missing selectors: ${selfTest.missing.join(", ")}`;
      runLog.log(
        `ChatGPT changed its UI — image-arranger's selectors need updating; see SELECTORS.md (${detail})`,
        "error",
      );
      console.error(
        "\n>>> ChatGPT changed its UI — image-arranger's selectors need updating; see SELECTORS.md <<<\n" +
        `    ${detail}\n` +
        "    The image-generation pipeline cannot run until the centralized selectors in\n" +
        "    scripts/agent-browser.mjs are patched. The queue and the manual workflow are unaffected.\n",
      );
      await closePage(page);
      process.exitCode = 3;
      return;
    }
    runLog.log("selector self-test passed: all core elements present");
    await closePage(page);
  }
  if (flag("--check")) {
    runLog.log("--check finished: Chrome + login + selectors are ready");
    return;
  }

  const summary = [];

  async function processTarget(row) {
    const tag = row.entryId;
    runLog.section(`${row.requestId}[${row.targetIndex}] ${row.overview ?? row.entryId}`);
    runLog.attachJson(`target ${tag}`, row);
    const refImages = (row.inputs?.refImages ?? []).map((file) => isAbsolute(file) ? file : resolve(projectRoot, file));
    const outputDir = resolve(projectRoot, row.outputDir || "outputs");
    mkdirSync(outputDir, { recursive: true });
    const fileBase = `${slugify(row.entryId.replace(/^image-/, ""), row.entryId)}-${timestamp()}`;

    let outcome = null;
    for (let attempt = 1; attempt <= RETRIES_PER_TARGET && !outcome; attempt += 1) {
      const page = await openChat({ cdpPort: CDP_PORT });
      try {
        runLog.log(`[${tag}] attempt ${attempt}/${RETRIES_PER_TARGET}: new chat opened`);
        const attached = await attachImages(page, refImages);
        runLog.log(`[${tag}] attached ${attached} reference image(s)`);
        await runLog.shot(page, `attached-${row.entryId}`);
        await setPrompt(page, row.prompt);
        runLog.log(`[${tag}] prompt inserted and verified`);
        await runLog.shot(page, `before-send-${row.entryId}`);
        await sendMessage(page);
        runLog.log(`[${tag}] message sent; waiting for the image (polling every 5s)`);
        const reply = await waitForImageReply(page, {
          onTick: (elapsed, state) => runLog.log(
            `[${tag}] waiting ${elapsed}s — ${state.streaming ? "model is responding" : "no completed image detected yet"} (turns:${state.turns} imgs:${state.images.length}${state.overlay ? " overlay" : ""})`,
          ),
        });
        await runLog.shot(page, `reply-${row.entryId}`);
        if (reply.status === "image") {
          const destination = join(outputDir, `${fileBase}.png`);
          const saved = await downloadImage(page, reply.src, destination);
          runLog.log(`[${tag}] image saved via ${saved.method}: ${destination} (${Math.round(saved.bytes / 1024)} KB)`);
          outcome = { status: "completed", file: destination };
        } else if (reply.status === "error") {
          runLog.log(`[${tag}] generation refused/errored: ${reply.text.slice(0, 200)}`, "warn");
          if (attempt === RETRIES_PER_TARGET) outcome = { status: "error", message: `generation failed after ${attempt} attempts: ${reply.text.slice(0, 300)}` };
          else runLog.log(`[${tag}] retrying in a fresh chat (same prompt, per AGENTS.md retry rule)`);
        } else {
          runLog.log(`[${tag}] timed out waiting for the image`, "warn");
          if (attempt === RETRIES_PER_TARGET) outcome = { status: "error", message: "generation timed out" };
        }
      } catch (error) {
        await runLog.shot(page, `failure-${row.entryId}`);
        runLog.log(`[${tag}] attempt ${attempt} failed: ${error.message}`, "error");
        if (attempt === RETRIES_PER_TARGET) outcome = { status: "error", message: error.message };
      } finally {
        if (!flag("--keep-tabs") && (outcome?.status !== "error")) await closePage(page);
      }
    }

    if (outcome.status === "completed") {
      const relFile = outcome.file.startsWith(projectRoot) ? outcome.file.slice(projectRoot.length + 1) : outcome.file;
      const registered = await api("/api/assets", {
        characterId: row.characterId,
        entryId: row.entryId,
        sourceFile: relFile,
        name: basename(outcome.file, ".png"),
        prompt: row.prompt,
        aiGenerated: true,
        humanReviewed: false,
        adopted: false,
      });
      runLog.log(`[${tag}] registered as asset candidate: ${registered.asset?.id} -> ${registered.asset?.file}`);
      await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        results: [{ file: relFile, prompt: row.prompt }],
      });
      runLog.log(`[${tag}] reported completed via /api/requests/complete`);
      return { requestId: row.requestId, targetIndex: row.targetIndex, entryId: row.entryId, status: "completed", file: relFile, asset: registered.asset?.id };
    }
    await api("/api/requests/complete", {
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      error: outcome.message,
    });
    runLog.log(`[${tag}] reported error via /api/requests/complete: ${outcome.message}`, "error");
    return { requestId: row.requestId, targetIndex: row.targetIndex, entryId: row.entryId, status: "error", message: outcome.message };
  }

  // Worker pool: PARALLEL targets in flight, each in its own chat tab.
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(PARALLEL, wanted.length));
  if (wanted.length) runLog.log(`processing with parallelism ${workerCount}`);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < wanted.length) {
      const row = wanted[cursor++];
      summary.push(await processTarget(row));
    }
  }));

  runLog.section("Summary");
  runLog.attachJson("summary", summary);
  for (const item of summary) {
    runLog.log(`${item.status === "completed" ? "✅" : "❌"} ${item.requestId}[${item.targetIndex}] ${item.entryId} ${item.file ?? item.message ?? ""}`);
  }
  console.log(`\nRun log: ${runLog.dir}/log.md`);
  if (summary.some((item) => item.status === "error")) process.exitCode = 1;
}

main().then(() => {
  // WebSocket connections keep the event loop alive after we are done.
  setTimeout(() => process.exit(process.exitCode ?? 0), 200);
}).catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});
