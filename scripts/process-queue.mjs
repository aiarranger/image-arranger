#!/usr/bin/env node
// Legacy CDP queue processor. It is disabled because it launches a
// dedicated automation Chrome profile. Use scripts/process-service-queue.mjs for
// normal queue processing with a saved normal Chrome profile.

if (typeof WebSocket === "undefined") {
  console.error("scripts/process-queue.mjs needs Node 22+ (global WebSocket). The server itself runs on Node 20+.");
  process.exit(1);
}

import { mkdirSync } from "node:fs";
import { isAbsolute, join, resolve, basename } from "node:path";
import {
  DEFAULTS, RunLog, ensureChrome, openChat, closePage, checkLogin, ensureModel,
  attachImages, setPrompt, sendMessage, waitForImageReply, waitForTextReply, downloadImage, sleep,
  selectorSelfTest,
} from "./agent-browser.mjs";
import {
  composeQualityCheckPrompt,
  composeQualityRepairPrompt,
  parseQualityCheckResult,
} from "../prompts.mjs";

const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

console.error("scripts/process-queue.mjs is disabled because it launches a dedicated CDP automation Chrome profile. Use scripts/process-service-queue.mjs with an explicit saved normal Chrome profile.");
process.exit(2);

const HELP = `Legacy CDP queue processor — disabled.

This script launches a dedicated automation Chrome profile and must not be used
for normal image-arranger queue processing. Use:

  node scripts/process-service-queue.mjs --setup-profile --service chatgpt
  node scripts/process-service-queue.mjs --check --service chatgpt --ensure-tab
  node scripts/process-service-queue.mjs --server http://127.0.0.1:4217

This legacy route is not available.`;

if (flag("--help") || flag("-h")) {
  console.log(HELP);
  process.exit(0);
}

const SERVER = (option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217")).replace(/\/$/, "");
const CDP_PORT = Number(option("--cdp-port", DEFAULTS.cdpPort));
const MAX_TARGETS = Number(option("--max", "20"));
const CHECK_ONLY = flag("--check");
const RETRIES_PER_TARGET = 3;
const QUALITY_CHECK_RETRIES = 2;
// How many targets run at once, each in its own chat tab (--parallel <n>).
const PARALLEL = Math.max(1, Number(option("--parallel", process.env.IMAGE_ARRANGER_PARALLEL ?? "1")) || 1);
// Force the ChatGPT model before each image generation (--image-model <pattern>,
// e.g. "thinking"). Advisory: when switching fails the driver logs a warning
// and generates with whatever model is active. Workaround for Pro-mode image
// generation outages.
const IMAGE_MODEL = option("--image-model", process.env.IMAGE_ARRANGER_IMAGE_MODEL ?? null);

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
  const queue = CHECK_ONLY ? { projectRoot: process.cwd(), requests: [] } : await api("/api/requests");
  const projectRoot = queue.projectRoot;
  const runLog = new RunLog(join(projectRoot, "agent-logs"), `run-${timestamp()}`);
  runLog.log(`${CHECK_ONLY ? "check-only" : `server ${SERVER}`}, projectRoot ${projectRoot}`);
  runLog.log(`run log: ${runLog.dir}`);

  const all = queue.requests ?? [];
  const isChatGptImageTarget = (row) => ["generate", "improve"].includes(row.action)
    && (row.service === "chatgpt" || !row.service);
  const wanted = all
    .filter((row) => option("--request") ? row.requestId === option("--request") : true)
    .filter(isChatGptImageTarget)
    .slice(0, MAX_TARGETS);
  const skipped = all.filter((row) => !wanted.includes(row));
  for (const row of skipped) {
    runLog.log(`skipping ${row.requestId}[${row.targetIndex}] (action=${row.action}, service=${row.service}) — handled by an agent, not this script`, "warn");
  }
  runLog.log(`${wanted.length} chatgpt image target(s) to process`);
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
    // Monitored signals are WARN-ONLY: reported when absent but they never fail
    // the gate (only load-bearing core selectors do). They flag a UI drift that
    // detection can still tolerate via its fallbacks.
    for (const signal of selfTest.warnings ?? []) {
      runLog.log(
        `monitored signal ${signal.name}: ${signal.present ? "present" : "ABSENT (warn-only — detection has a fallback; see SELECTORS.md)"}`,
        signal.present ? "info" : "warn",
      );
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
  if (CHECK_ONLY) {
    runLog.log("--check finished: Chrome + login + selectors are ready");
    return;
  }

  const summary = [];

  function relPath(file) {
    return file.startsWith(projectRoot) ? file.slice(projectRoot.length + 1) : file;
  }

  function uniqueFiles(files) {
    return [...new Set((files ?? []).filter(Boolean))];
  }

  function qualityParts(row) {
    return (row.qualityGate?.requiredParts ?? [])
      .map((part) => ({
        ...part,
        file: part.file ? (isAbsolute(part.file) ? part.file : resolve(projectRoot, part.file)) : "",
      }))
      .filter((part) => part.file);
  }

  async function generateImage({ row, tag, prompt, files, outputDir, fileBase, qualityAttempt }) {
    let outcome = null;
    const suffix = qualityAttempt > 1 ? `-repair${qualityAttempt}` : "";
    for (let attempt = 1; attempt <= RETRIES_PER_TARGET && !outcome; attempt += 1) {
      const page = await openChat({ cdpPort: CDP_PORT });
      try {
        runLog.log(`[${tag}] generation ${qualityAttempt}, service attempt ${attempt}/${RETRIES_PER_TARGET}: new chat opened`);
        if (IMAGE_MODEL) {
          const model = await ensureModel(page, IMAGE_MODEL);
          if (model.status === "ok") runLog.log(`[${tag}] model: ${model.model}${model.changed ? " (switched)" : ""}`);
          else runLog.log(`[${tag}] could not switch the model to "${IMAGE_MODEL}": ${model.reason} — generating with the current model`, "warn");
        }
        const attached = await attachImages(page, files);
        runLog.log(`[${tag}] attached ${attached} reference image(s)`);
        await runLog.shot(page, `attached-${row.entryId}-q${qualityAttempt}`);
        await setPrompt(page, prompt);
        runLog.log(`[${tag}] prompt inserted and verified`);
        await runLog.shot(page, `before-send-${row.entryId}-q${qualityAttempt}`);
        await sendMessage(page);
        runLog.log(`[${tag}] message sent; waiting for the image (polling every 5s)`);
        const reply = await waitForImageReply(page, {
          onTick: (elapsed, state) => runLog.log(
            `[${tag}] waiting ${elapsed}s — ${state.streaming ? "model is responding" : "no completed image detected yet"} (turns:${state.turns} imgs:${state.images.length}${state.overlay ? " overlay" : ""})`,
          ),
        });
        await runLog.shot(page, `reply-${row.entryId}-q${qualityAttempt}`);
        if (reply.status === "image") {
          const destination = join(outputDir, `${fileBase}${suffix}.png`);
          const saved = await downloadImage(page, reply.src, destination);
          runLog.log(`[${tag}] image saved via ${saved.method}: ${destination} (${Math.round(saved.bytes / 1024)} KB)`);
          outcome = { status: "completed", file: destination, prompt };
        } else if (reply.status === "error") {
          runLog.log(`[${tag}] generation refused/errored: ${reply.text.slice(0, 200)}`, "warn");
          if (attempt === RETRIES_PER_TARGET) outcome = { status: "error", message: `generation failed after ${attempt} attempts: ${reply.text.slice(0, 300)}` };
          else runLog.log(`[${tag}] retrying in a fresh chat (same prompt, per AGENTS.md retry rule)`);
        } else {
          runLog.log(`[${tag}] timed out waiting for the image`, "warn");
          if (attempt === RETRIES_PER_TARGET) outcome = { status: "error", message: "generation timed out" };
        }
      } catch (error) {
        await runLog.shot(page, `failure-${row.entryId}-q${qualityAttempt}`);
        runLog.log(`[${tag}] generation ${qualityAttempt}, service attempt ${attempt} failed: ${error.message}`, "error");
        if (attempt === RETRIES_PER_TARGET) outcome = { status: "error", message: error.message };
      } finally {
        if (!flag("--keep-tabs")) await closePage(page);
      }
    }
    return outcome;
  }

  async function runQualityCheck({ row, tag, candidateFile, parts, qualityAttempt }) {
    const attachedFiles = [candidateFile, ...parts.map((part) => part.file)];
    for (let checkAttempt = 1; checkAttempt <= QUALITY_CHECK_RETRIES; checkAttempt += 1) {
      const page = await openChat({ cdpPort: CDP_PORT });
      try {
        runLog.log(`[${tag}] quality check ${qualityAttempt}.${checkAttempt}: new chat opened`);
        const attached = await attachImages(page, attachedFiles);
        runLog.log(`[${tag}] quality check attached ${attached} image(s) (candidate + ${parts.length} reference part(s))`);
        await runLog.shot(page, `quality-attached-${row.entryId}-q${qualityAttempt}`);
        const prompt = composeQualityCheckPrompt({
          characterName: row.characterName || row.characterId,
          overview: row.overview || row.entryId,
          prompt: row.prompt,
          parts,
        });
        await setPrompt(page, prompt);
        await runLog.shot(page, `quality-before-send-${row.entryId}-q${qualityAttempt}`);
        await sendMessage(page);
        runLog.log(`[${tag}] quality check sent; waiting for JSON`);
        const reply = await waitForTextReply(page, {
          onTick: (elapsed, state) => runLog.log(
            `[${tag}] quality check waiting ${elapsed}s — ${state.streaming ? "model is responding" : "no final text yet"} (turns:${state.turns} assistant:${state.assistantTurns})`,
          ),
        });
        await runLog.shot(page, `quality-reply-${row.entryId}-q${qualityAttempt}`);
        if (reply.status === "text") {
          const parsed = parseQualityCheckResult(reply.text);
          runLog.attachJson(`quality check ${tag} attempt ${qualityAttempt}`, parsed);
          runLog.log(`[${tag}] quality check result: ${parsed.ok ? "pass" : "repair needed"} — ${parsed.summary || `${parsed.issues.length} issue(s)`}`);
          return { status: "completed", report: parsed };
        }
        if (reply.status === "error") {
          runLog.log(`[${tag}] quality check refused/errored: ${reply.text.slice(0, 200)}`, "warn");
        } else {
          runLog.log(`[${tag}] quality check timed out`, "warn");
        }
      } catch (error) {
        await runLog.shot(page, `quality-failure-${row.entryId}-q${qualityAttempt}`);
        runLog.log(`[${tag}] quality check ${qualityAttempt}.${checkAttempt} failed: ${error.message}`, "error");
        if (checkAttempt === QUALITY_CHECK_RETRIES) {
          return { status: "error", message: `quality check failed: ${error.message}` };
        }
      } finally {
        if (!flag("--keep-tabs")) await closePage(page);
      }
    }
    return { status: "error", message: "quality check failed or timed out" };
  }

  function repairReferenceFiles({ originalRefs, parts, issues, previousFile }) {
    const issueIds = new Set((issues ?? []).map((issue) => issue.entryId).filter(Boolean));
    const issueLabels = new Set((issues ?? []).map((issue) => issue.label).filter(Boolean));
    const issuePartFiles = parts
      .filter((part) => issueIds.has(part.entryId) || issueLabels.has(part.overview))
      .map((part) => part.file);
    return [...uniqueFiles([...originalRefs, ...issuePartFiles]), previousFile];
  }

  async function processTarget(row) {
    const tag = row.entryId;
    runLog.section(`${row.requestId}[${row.targetIndex}] ${row.overview ?? row.entryId}`);
    runLog.attachJson(`target ${tag}`, row);
    const refImages = (row.inputs?.refImages ?? []).map((file) => isAbsolute(file) ? file : resolve(projectRoot, file));
    const outputDir = resolve(projectRoot, row.outputDir || "outputs");
    mkdirSync(outputDir, { recursive: true });
    const fileBase = `${slugify(row.entryId.replace(/^image-/, ""), row.entryId)}-${timestamp()}`;

    const gateEnabled = Boolean(row.qualityGate?.enabled);
    const parts = gateEnabled ? qualityParts(row) : [];
    const maxQualityAttempts = gateEnabled ? Math.max(1, Math.min(10, Number(row.qualityGate?.maxAttempts) || 3)) : 1;
    const qualityReport = gateEnabled
      ? { enabled: true, mode: "compare-if-visible", maxAttempts: maxQualityAttempts, parts: parts.map((part) => ({ ...part, file: relPath(part.file) })), attempts: [] }
      : null;
    if (gateEnabled && !parts.length) {
      qualityReport.skipped = true;
      qualityReport.summary = "No comparable base part references were present in the request.";
      runLog.log(`[${tag}] quality gate enabled but no comparable base part references were supplied; generating normally`, "warn");
    } else if (gateEnabled) {
      runLog.log(`[${tag}] quality gate enabled: compare-if-visible, ${parts.length} part reference(s), max ${maxQualityAttempts} generation attempt(s)`);
    }

    let outcome = null;
    let prompt = row.prompt;
    let generationFiles = refImages;
    for (let qualityAttempt = 1; qualityAttempt <= maxQualityAttempts; qualityAttempt += 1) {
      outcome = await generateImage({
        row,
        tag,
        prompt,
        files: generationFiles,
        outputDir,
        fileBase,
        qualityAttempt,
      });
      if (outcome.status !== "completed") break;
      if (!gateEnabled || !parts.length) {
        if (qualityReport) {
          qualityReport.passed = true;
          qualityReport.attempts.push({ attempt: qualityAttempt, file: relPath(outcome.file), ok: true, skipped: true });
        }
        break;
      }

      const check = await runQualityCheck({ row, tag, candidateFile: outcome.file, parts, qualityAttempt });
      if (check.status === "error") {
        outcome = { status: "error", message: check.message };
        qualityReport.passed = false;
        qualityReport.error = check.message;
        break;
      }
      const attemptReport = {
        attempt: qualityAttempt,
        file: relPath(outcome.file),
        ok: check.report.ok,
        summary: check.report.summary,
        parts: check.report.parts,
        issues: check.report.issues,
      };
      qualityReport.attempts.push(attemptReport);
      if (check.report.ok) {
        qualityReport.passed = true;
        qualityReport.summary = check.report.summary || `Passed on attempt ${qualityAttempt}`;
        break;
      }
      qualityReport.passed = false;
      qualityReport.summary = check.report.summary || `${check.report.issues.length} visible mismatch(es)`;
      if (qualityAttempt === maxQualityAttempts) {
        outcome = {
          status: "error",
          message: `quality gate failed after ${maxQualityAttempts} attempt(s): ${qualityReport.summary}`,
        };
        break;
      }
      generationFiles = repairReferenceFiles({
        originalRefs: refImages,
        parts,
        issues: check.report.issues,
        previousFile: outcome.file,
      });
      prompt = composeQualityRepairPrompt({
        originalPrompt: row.prompt,
        issues: check.report.issues,
        attempt: qualityAttempt + 1,
        maxAttempts: maxQualityAttempts,
      });
      runLog.log(`[${tag}] quality repair queued for attempt ${qualityAttempt + 1}/${maxQualityAttempts}; attaching ${generationFiles.length} image(s)`);
    }

    if (outcome.status === "completed") {
      const relFile = relPath(outcome.file);
      const registered = await api("/api/assets", {
        characterId: row.characterId,
        entryId: row.entryId,
        sourceFile: relFile,
        name: basename(outcome.file, ".png"),
        prompt: outcome.prompt ?? row.prompt,
        aiGenerated: true,
        humanReviewed: false,
        adopted: false,
        usageNotes: qualityReport?.passed ? `Quality gate passed (${qualityReport.attempts.length} attempt(s), compare-if-visible).` : "",
      });
      runLog.log(`[${tag}] registered as asset candidate: ${registered.asset?.id} -> ${registered.asset?.file}`);
      await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        results: [{ file: relFile, prompt: outcome.prompt ?? row.prompt }],
        ...(qualityReport ? { qualityReport } : {}),
      });
      runLog.log(`[${tag}] reported completed via /api/requests/complete`);
      return { requestId: row.requestId, targetIndex: row.targetIndex, entryId: row.entryId, status: "completed", file: relFile, asset: registered.asset?.id, quality: qualityReport?.passed ? "passed" : "" };
    }
    await api("/api/requests/complete", {
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      error: outcome.message,
      ...(qualityReport ? { qualityReport } : {}),
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
