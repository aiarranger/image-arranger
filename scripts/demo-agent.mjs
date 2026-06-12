#!/usr/bin/env node
// Demo / filming agent: completes queued image-arranger requests with locally
// generated placeholder art so the full request loop — queue → agent →
// complete → adopt — is experiential without any real generation service.
//
// It is a tiny processor for the documented `image-arranger-request.v1`
// contract (docs/request-spec.md): it polls GET /api/requests on a running
// server, waits ~--delay ms per target ("generation"), writes a tasteful
// gradient PNG (prompt excerpt + request id baked into the image) into the
// target's outputDir, registers it as a candidate via POST /api/assets, and
// reports POST /api/requests/complete — exactly the same payload shapes as
// the real ChatGPT driver (scripts/process-queue.mjs), minus the AI.
//
//   node scripts/demo-agent.mjs --workspace workspace/demo              keep polling until Ctrl+C
//   node scripts/demo-agent.mjs --workspace workspace/demo --once      one deterministic pass (filming)
//
// Options: --server http://127.0.0.1:4217  --delay 3000  --max <n>  --once
//
// Zero dependencies. Needs Node 20+ (global fetch).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import {
  PALETTES,
  clipLine,
  drawText,
  encodePng,
  fillRect,
  hash32,
  makeCanvas,
  mix,
  mulberry32,
  paintBackdrop,
  sanitizeText,
  textWidth,
  wrapLines,
} from "../placeholder-art.mjs";

if (typeof fetch === "undefined") {
  console.error("scripts/demo-agent.mjs needs Node 20+ (global fetch).");
  process.exit(1);
}

const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function option(name, fallback = null) {
  const index = args.lastIndexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const HELP = `Demo / filming agent — completes queued image-arranger requests with locally
generated placeholder images so the full loop (queue -> agent -> result -> adopt)
works with zero accounts, zero services, zero network.

Usage:
  node scripts/demo-agent.mjs --workspace <dir>          poll until Ctrl+C, ~3s per result
  node scripts/demo-agent.mjs --workspace <dir> --once   process the current queue once and exit
                                                         (deterministic filming takes)

Options:
  --workspace <dir>  the server's workspace directory (required; used for
                     diagnostics when the server is unreachable)
  --server <url>     image-arranger server (default http://127.0.0.1:4217, $IMAGE_ARRANGER_SERVER)
  --delay <ms>       simulated generation time per target (default 3000)
  --max <n>          cap targets per pass (default 20)
  --once             single pass instead of polling forever
  --help, -h         show this help and exit

What it handles:
  generate / improve (image)  placeholder PNG -> candidate asset -> completed
  draft-prompt                writes a demo prompt; the server auto-queues generation
  analyze                     reports demo base-kit parts JSON
  video targets               skipped politely (still images only)`;

if (flag("--help") || flag("-h")) {
  console.log(HELP);
  process.exit(0);
}

const SERVER = (option("--server", process.env.IMAGE_ARRANGER_SERVER ?? "http://127.0.0.1:4217")).replace(/\/$/, "");
const WORKSPACE_ARG = option("--workspace");
if (!WORKSPACE_ARG) {
  console.error("[error] --workspace <dir> is required (the directory the server was started with).\n");
  console.error(HELP);
  process.exit(1);
}
const WORKSPACE = resolve(WORKSPACE_ARG);
const DELAY = Math.max(0, Number(option("--delay", "3000")) || 0);
const MAX_TARGETS = Math.max(1, Number(option("--max", "20")) || 20);
const ONCE = flag("--once");
const POLL_MS = 3000;

// --- logging (console flavor of process-queue.mjs's RunLog) -----------------

function log(message, level = "info") {
  const line = `[${level}] ${message}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// --- small utils -------------------------------------------------------------

let stopRequested = false;
function requestStop(signal) {
  if (stopRequested) {
    log(`second ${signal} — exiting immediately`, "warn");
    process.exit(130);
  }
  stopRequested = true;
  log(`${signal} received — finishing the current target, then exiting (repeat to force quit)`, "warn");
}
process.on("SIGINT", () => requestStop("SIGINT"));
process.on("SIGTERM", () => requestStop("SIGTERM"));

// Interruptible sleep: wakes early when a stop was requested.
async function sleep(ms) {
  const end = Date.now() + ms;
  while (!stopRequested && Date.now() < end) {
    await new Promise((r) => setTimeout(r, Math.min(200, Math.max(1, end - Date.now()))));
  }
}

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

function toPosixPath(value) {
  return String(value).split(sep).join("/");
}

// --- placeholder art ----------------------------------------------------------
// Deterministic per requestId+targetIndex (stable across reruns for filming),
// varied across requests: curated gradient duos, soft bokeh circles, vignette,
// and the request's own words rendered with a tiny built-in 5x7 pixel font.
// The rendering primitives live in placeholder-art.mjs (shared with the
// server's `--init sample` seeding).

function makeDemoPng(row) {
  const seed = hash32(`${row.requestId}:${row.targetIndex}`);
  const rng = mulberry32(seed);
  const palette = PALETTES[seed % PALETTES.length];
  const W = 1024;
  const H = 640;
  const canvas = makeCanvas(W, H);

  // Diagonal gradient + vignette + soft bokeh circles.
  const glow = paintBackdrop(canvas, palette, rng);

  const white = [246, 248, 252];
  const soft = [224, 228, 238];
  const ink = mix(palette.from, [0, 0, 0], 0.62);

  // Badge (top-left): what produced this image.
  const badge = sanitizeText(`DEMO AGENT / ${(row.action || "generate")}`) || "DEMO AGENT";
  fillRect(canvas, 36, 34, textWidth(badge, 2) + 28, 34, ink, 0.5);
  drawText(canvas, 50, 44, badge, 2, white, 0.95);
  fillRect(canvas, 36, 84, 132, 5, glow, 0.9);

  // Bottom panel with the request's own words.
  const panelX = 48;
  const panelW = W - panelX * 2;
  fillRect(canvas, panelX, 412, panelW, 188, ink, 0.55);

  const title = sanitizeText(row.overview || row.entryId) || "DEMO RESULT";
  const titleScale = title.length <= Math.floor((panelW - 48) / 30) ? 5 : 4;
  const titleLine = clipLine(title, Math.floor((panelW - 48) / (6 * titleScale)));
  drawText(canvas, panelX + 25, 437, titleLine, titleScale, [0, 0, 0], 0.3);
  drawText(canvas, panelX + 24, 436, titleLine, titleScale, white, 0.98);

  const promptText = sanitizeText(row.improvementPrompt || row.prompt);
  const promptLines = wrapLines(promptText, Math.floor((panelW - 48) / 12), 2);
  promptLines.forEach((line, index) => {
    drawText(canvas, panelX + 24, 494 + index * 22, line, 2, soft, 0.92);
  });

  const footer = clipLine(sanitizeText(`${row.requestId} [${row.targetIndex}] / ${palette.name}`), Math.floor((panelW - 48) / 12));
  drawText(canvas, panelX + 24, 562, footer, 2, soft, 0.6);

  return encodePng(canvas);
}

// --- target handling ----------------------------------------------------------

// Which targets this demo can play back. Video targets need a real clip file,
// so they stay queued for a real driver.
function classify(row) {
  const action = row.action || "generate";
  if (action === "analyze") return "analyze";
  if (action === "draft-prompt") return "draft";
  if (action !== "generate" && action !== "improve") return "unsupported";
  const isVideo = row.mode === "video" || row.service === "vidu" || Boolean(row.inputs?.endFrame);
  return isVideo ? "video" : "image";
}

const DEMO_DRAFT_PROMPT = [
  "Cinematic three-quarter portrait of the character, soft golden studio light,",
  "shallow depth of field, gentle confident smile, clean pastel gradient background,",
  "high-detail illustration, no text, no watermark.",
].join(" ");

const DEMO_KIT_PARTS = [
  {
    key: "expression-smile-demo",
    label: "Smile (demo)",
    category: "expression",
    prompt: "Isolated reference of the character's smiling face only, faithful to the existing design, flat neutral background, clean cel-style rendering, no text, no logo. (Demo agent placeholder analysis.)",
  },
  {
    key: "clothing-main-demo",
    label: "Main outfit (demo)",
    category: "clothing",
    prompt: "Isolated reference of the character's main outfit on a mannequin pose, faithful colors and trims, flat neutral background, clean cel-style rendering, no text. (Demo agent placeholder analysis.)",
  },
  {
    key: "accessory-signature-demo",
    label: "Signature accessory (demo)",
    category: "accessory",
    prompt: "Isolated reference of the character's signature accessory only, faithful materials and proportions, flat neutral background, clean cel-style rendering, no text. (Demo agent placeholder analysis.)",
  },
];

async function processTarget(row, kind, projectRoot) {
  const tag = `${row.requestId}[${row.targetIndex}]`;
  section(`${tag} ${row.action} "${row.overview || row.entryId}"`);
  try {
    log(`[${row.entryId}] simulating generation (${DELAY} ms)`);
    await sleep(DELAY);

    if (kind === "draft") {
      const reference = row.referenceUrl ? ` (Drafted by the demo agent from ${row.referenceUrl}.)` : " (Drafted by the demo agent.)";
      const completed = await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        overview: row.overview && row.overview !== row.entryId ? row.overview : "Golden-hour studio portrait",
        prompt: `${DEMO_DRAFT_PROMPT}${reference}`,
      });
      const queued = completed.draftQueued ?? [];
      log(`[${row.entryId}] drafted prompt reported; server auto-queued generation: ${queued.join(", ") || "(none)"}`);
      return { tag, status: "completed", detail: `drafted prompt${queued.length ? ` -> ${queued.join(", ")}` : ""}` };
    }

    if (kind === "analyze") {
      await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        parts: { character: row.characterName || row.characterId, parts: DEMO_KIT_PARTS },
      });
      log(`[${row.entryId}] demo analysis parts reported (${DEMO_KIT_PARTS.length} parts) — visible in the Kit tab's import list`);
      return { tag, status: "completed", detail: `${DEMO_KIT_PARTS.length} demo analysis parts` };
    }

    // generate / improve: placeholder PNG -> candidate asset -> completed.
    const outputDir = resolve(projectRoot, row.outputDir || "outputs");
    mkdirSync(outputDir, { recursive: true });
    const fileBase = `${slugify(row.entryId.replace(/^image-/, ""), row.entryId)}-demo-${timestamp()}`;
    const destination = join(outputDir, `${fileBase}.png`);
    const png = makeDemoPng(row);
    writeFileSync(destination, png);
    const relFile = toPosixPath(relative(projectRoot, destination));
    log(`[${row.entryId}] placeholder saved: ${destination} (${Math.round(png.length / 1024)} KB)`);

    let assetId = null;
    if (relFile.startsWith("..")) {
      log(`[${row.entryId}] output sits outside the server's project root — completing without candidate registration (start the server with --project-root <workspace parent> to enable it)`, "warn");
    } else if (row.existsInDeck === false) {
      log(`[${row.entryId}] entry no longer exists in the deck — completing without candidate registration`, "warn");
    } else {
      const registered = await api("/api/assets", {
        characterId: row.characterId,
        entryId: row.entryId,
        sourceFile: relFile,
        name: fileBase,
        prompt: row.prompt,
        aiGenerated: true,
        humanReviewed: false,
        adopted: false,
      });
      assetId = registered.asset?.id ?? null;
      log(`[${row.entryId}] registered as asset candidate: ${assetId} -> ${registered.asset?.file}`);
    }

    await api("/api/requests/complete", {
      requestId: row.requestId,
      targetIndex: row.targetIndex,
      results: [{ file: relFile, prompt: row.prompt, demoAgent: true }],
    });
    log(`[${row.entryId}] reported completed via /api/requests/complete`);
    return { tag, status: "completed", detail: relFile };
  } catch (error) {
    log(`[${row.entryId}] failed: ${error.message}`, "error");
    try {
      await api("/api/requests/complete", {
        requestId: row.requestId,
        targetIndex: row.targetIndex,
        error: `demo agent failed: ${error.message}`,
      });
      log(`[${row.entryId}] reported error via /api/requests/complete`, "warn");
    } catch (reportError) {
      log(`[${row.entryId}] could not report the error either: ${reportError.message}`, "error");
    }
    return { tag, status: "error", detail: error.message };
  }
}

// --- diagnostics ----------------------------------------------------------------

function countPendingInWorkspace() {
  const requestDir = join(WORKSPACE, "requests");
  if (!existsSync(requestDir)) return 0;
  let pending = 0;
  for (const file of readdirSync(requestDir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const payload = JSON.parse(readFileSync(join(requestDir, file), "utf8"));
      pending += (payload.targets ?? []).filter((target) => target.status === "requested").length;
    } catch {
      // unreadable request file — skip
    }
  }
  return pending;
}

let crossChecked = false;
function workspaceCrossCheck(projectRoot, rows) {
  if (crossChecked) return;
  if (!existsSync(join(WORKSPACE, "deck.json"))) {
    log(`workspace ${WORKSPACE} has no deck.json (is --workspace pointing at the server's workspace?)`, "warn");
  }
  const sample = (rows ?? []).find((row) => row.outputDir);
  if (sample) {
    const resolved = resolve(projectRoot, sample.outputDir);
    if (!(resolved === WORKSPACE || resolved.startsWith(WORKSPACE + sep))) {
      log(`server at ${SERVER} writes outputs to ${resolved}, which is outside --workspace ${WORKSPACE} — double-check both flags`, "warn");
    }
    crossChecked = true;
  } else if (existsSync(join(WORKSPACE, "deck.json"))) {
    crossChecked = true;
  }
}

// --- main loop -------------------------------------------------------------------

async function main() {
  log(`demo agent starting — server ${SERVER}, workspace ${WORKSPACE}, delay ${DELAY} ms, ${ONCE ? "single pass (--once)" : `polling every ${POLL_MS / 1000}s`}`);
  let serverDownLogged = false;
  let idleAnnounced = false;
  const skipNoted = new Set();

  while (!stopRequested) {
    let queue = null;
    try {
      queue = await api("/api/requests");
      if (serverDownLogged) {
        log("server is reachable again");
        serverDownLogged = false;
      }
    } catch (error) {
      const pending = countPendingInWorkspace();
      const message = `cannot reach the image-arranger server at ${SERVER} (${error.cause?.code ?? error.message}). `
        + `${pending} pending target(s) wait in ${join(WORKSPACE, "requests")} — start the server with: node server.mjs --workspace ${WORKSPACE}`;
      if (ONCE) {
        log(message, "error");
        process.exitCode = 2;
        return;
      }
      if (!serverDownLogged) {
        log(`${message} (retrying every ${POLL_MS / 1000}s)`, "warn");
        serverDownLogged = true;
      }
      await sleep(POLL_MS);
      continue;
    }

    const projectRoot = queue.projectRoot;
    workspaceCrossCheck(projectRoot, queue.requests);

    const playable = [];
    for (const row of queue.requests ?? []) {
      const kind = classify(row);
      if (kind === "image" || kind === "draft" || kind === "analyze") {
        playable.push({ row, kind });
        continue;
      }
      const key = `${row.requestId}[${row.targetIndex}]`;
      if (!skipNoted.has(key)) {
        skipNoted.add(key);
        log(`skipping ${key} (action=${row.action}, service=${row.service}) — the demo agent simulates still images only; a real driver can pick it up`, "warn");
      }
    }
    const batch = playable.slice(0, MAX_TARGETS);

    if (!batch.length) {
      const waiting = (queue.requests ?? []).length;
      const idleNote = waiting
        ? `no targets the demo agent can complete (${waiting} waiting for a real driver)`
        : "queue is empty";
      if (ONCE) {
        log(`${idleNote} — nothing to do. Done.`);
        return;
      }
      if (!idleAnnounced) {
        log(`${idleNote} — waiting for requests (queue something in the app; Ctrl+C to stop)`);
        idleAnnounced = true;
      }
      await sleep(POLL_MS);
      continue;
    }

    idleAnnounced = false;
    log(`${batch.length} target(s) to demo-complete`);
    const summary = [];
    for (const item of batch) {
      if (stopRequested) break;
      summary.push(await processTarget(item.row, item.kind, projectRoot));
    }

    section("Summary");
    for (const item of summary) {
      log(`${item.status === "completed" ? "✅" : "❌"} ${item.tag} ${item.detail}`);
    }
    if (ONCE) {
      if (summary.some((item) => item.status === "error")) process.exitCode = 1;
      return;
    }
  }
  log("stopped cleanly");
}

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});
