# Processing image-arranger Requests

This guide is for a human operator or a coding agent (Claude Code, Codex, etc.) that processes the `requests/*.json` files written by image-arranger.

image-arranger never operates ChatGPT, Vidu, or any generation service directly. The processor reads a request file, performs the work in the generation service's normal UI (or via its own tooling), saves the results, and reports completion back.

The stable, supported interface is the request-file contract — see [docs/request-spec.md](docs/request-spec.md) for every field, the completion-API payload shapes, the compatibility promise, and how to write a driver for another service. A non-agent operator can also process a request entirely by hand: see [Process a request by hand](README.md#process-a-request-by-hand-no-agent-needed) in the README. Scripted processing is **macOS-tested** (cross-platform by design); the keystroke fallback is **macOS-only**.

## Quick bootstrap

```bash
node --version          # Node 20+ for the app; scripted ChatGPT driver needs Node 22+
npm start              # terminal 1: http://127.0.0.1:4217 with ./workspace/demo
open http://127.0.0.1:4217/
npm run demo-agent     # terminal 2, optional: processes image/analyze/draft demo requests
npm test
```

`npm run demo-agent` is a local placeholder processor for trying the queue loop. It handles image, analyze, draft-prompt, and improve targets; the sample workspace's pre-seeded pending video request is intentionally skipped because video requires a real driver.

For a different port or workspace, run the underlying commands directly instead of appending extra arguments to `npm start`:

```bash
node server.mjs --workspace ./workspace/demo --init sample --port 4321
node scripts/demo-agent.mjs --workspace ./workspace/demo --server http://127.0.0.1:4321
```

## Scripted Processing (preferred)

> **Disclaimer**: the bundled automation driver operates **your** browser with **your** account at **your** responsibility, and may conflict with a generation service's terms of service — review them before use. The stable, supported interface is the request-file contract described in this document; the driver is an optional, replaceable convenience.

Do not drive the generation service's browser UI by hand. The repository ships a deterministic processor that carries every queued ChatGPT image-generation target through the whole pipeline — fresh chat, attach references, insert and verify the prompt, send, wait, save into `outputDir`, register the result as an asset candidate, report completion — and records everything it does (steps + screenshots) into `agent-logs/run-*/` for the operator to review.

```bash
# one-time setup / health check: launches a dedicated automation Chrome
# (its own profile + CDP port; it never touches the user's main browser).
# Sign in to ChatGPT once in the window it opens.
node scripts/process-queue.mjs --check --server http://127.0.0.1:4217

# process every queued chatgpt generate target end to end
node scripts/process-queue.mjs --server http://127.0.0.1:4217

# useful variants
node scripts/process-queue.mjs --dry-run            # list what would run
node scripts/process-queue.mjs --request <id>       # one request only
node scripts/process-queue.mjs --parallel 3         # N targets at once, each in its own chat tab (default 1)
node scripts/process-queue.mjs --keep-tabs          # leave chats open to inspect
```

Division of labour:

- **The script handles** `generate` targets for images (service `chatgpt`). It retries a refused/failed generation in a fresh chat up to 3 attempts total, then reports `error` via the complete API and moves on.
- If a `generate` target has `qualityGate.enabled`, the script treats it as an important generation: after each generated candidate it asks ChatGPT to compare the candidate with the listed base/part references, retrying up to `qualityGate.maxAttempts`. This is a **compare-if-visible** check: hidden, absent, cropped-out, or too-small parts are not failures; a failure means a visible matching part is materially different from the canonical reference.
- **You handle** `draft-prompt` (read the reference URL, write the prompt — see below) and `analyze` (image analysis JSON). Both are reported via the complete API with `curl`; no browser automation needed. After completing a `draft-prompt`, rerun the script to process the auto-queued generation.
- Video targets (Vidu) are processed per the Video section below.
- **Reference driver**: [`scripts/demo-agent.mjs`](scripts/demo-agent.mjs) (`npm run demo-agent`) is the smallest complete processor of this contract — it polls `GET /api/requests`, "generates" locally rendered placeholder PNGs, registers them via `POST /api/assets`, and reports `POST /api/requests/complete` with the same payload shapes as the real driver. Read it before writing your own.
- If the script exits with an error, read `agent-logs/run-*/log.md` first; fix the cause (for example reword a refused prompt via `POST /api/requests/update`) and rerun. Fall back to the manual browser procedure at the bottom of this file only when the script itself cannot be repaired, and when you do, write your own steps and screenshots into an `agent-logs/run-*/` folder so the operator gets the same record.

## Request Files

Default location:

```text
<workspace>/requests/*.json
```

Process a target when:

- the request `status` is `requested`, and
- the target `status` is `requested`.

Target actions:

- `action` missing or `generate` — create a new image or video.
- `action: "improve"` — regenerate based on an existing asset.
- `action: "analyze"` — image analysis for the base kit. **No image is generated.**

Never process targets or requests whose `status` is `cancelled`.

## Image Generation (`generate`)

Prefer the scripted processor above — the steps below define the contract it implements (and the manual fallback).

1. Use the target `prompt` as-is.
2. If `inputs.refImages` is present, attach only those files. They contain assets the user explicitly adopted (or the improvement source). Do not add other candidates on your own.
3. Treat **1 queue target = 1 deliverable**. Do not produce grids, contact sheets, A/B comparisons, or multiple candidates for a single target.
4. If `qualityGate.enabled` is present, check the candidate against `qualityGate.requiredParts` before completion. Compare only parts/features that are actually visible in the candidate; do not fail missing/hidden/occluded parts. If a visible part differs, regenerate with the correct part reference plus the previous attempt as composition reference, up to `qualityGate.maxAttempts`.
5. Save the passing result into the target `outputDir`.
6. Register the file as an asset candidate on the matching entry (via the UI or `POST /api/assets`), marking `adopted` only if the user asked for auto-adoption.
7. Mark the target completed (see Reporting below), including `qualityReport` when a quality gate was evaluated.

## Prompt Drafting (`draft-prompt`)

The user supplies only a reference URL (an X post, an article, a gallery page) and delegates prompt writing to you. This is the most common flow: URL in, finished image out.

1. Open the target's `referenceUrl` and study what makes the referenced content appealing: composition, pose, art style, palette, props, mood.
2. Review the identity references in `inputs.refImages` — they are the ground truth for the character's face, hair, colors, and attached parts. The reference URL must never override identity.
3. Write ONE English generation prompt that recreates the appeal of the referenced content with this character: be concrete about scene, composition, and lighting; require exactly one image; no text, no logo, no watermark. Also write a short descriptive title in the deck's display language.
4. Report both back (escape them as JSON strings):

   ```bash
   curl -X POST http://127.0.0.1:4217/api/requests/complete \
     -H "Content-Type: application/json" \
     -d '{"requestId": "<requestId>", "targetIndex": 0, "overview": "<short title>", "prompt": "<your prompt>"}'
   ```

   The server imports the title and prompt into the entry and automatically queues a normal generation request for it (the response lists the new request id in `draftQueued`).
5. Re-fetch `/api/requests` and process the auto-queued generation request as a regular Image Generation task.

## Image Improvement (`improve`)

Same as generation, but treat `inputs.sourceAsset` / `assetFile` as the primary reference and follow `improvementPrompt` as the improvement intent.

## Video Generation (`generate` with frames)

1. Pass `inputs.startFrame` and `inputs.endFrame` to the image-to-video service.
2. Use the target `prompt` as the motion prompt, and `inputs.durationSec` as the clip length when the service lets you choose one. Long clips need the motion choreographed second-by-second in the prompt; if the prompt has no timeline, prefer the shortest duration that fits the action.
3. Generate one video first; check frame fidelity, locked camera, single action, and no extra objects before retrying.
4. Save into `outputDir` and register the asset.

## Manual Browser Fallback (only when the script cannot be repaired)

Use this only when the scripted processor itself cannot be repaired and you must drive the generation service's web UI by hand. The keystroke techniques below are **macOS-only**. The deep, field-tested browser steps live in [docs/manual-fallback.md](docs/manual-fallback.md) to keep this file scannable; this section covers only the one-time setup.

### One-time macOS Setup for Real-OS Keystrokes

Agents whose browser tools use a *virtual* clipboard (paste fails with "virtual clipboard has no data") must fall back to real-OS automation, which needs two macOS permissions for the agent's host app (Cursor, Terminal, ...):

1. **Automation**: approve the "wants to control Google Chrome / use AppleScript" dialog on first run.
2. **Accessibility**: System Settings → Privacy & Security → Accessibility → enable the host app (otherwise keystrokes fail with error 1002).

Windows / Linux equivalents are not established yet.

### Field-Tested Browser Techniques

The detailed attach/prompt/wait/collect procedure (real clipboard + real keystroke, prompt-insertion tiers, JSON collection) has moved to **[docs/manual-fallback.md](docs/manual-fallback.md)**. Follow it when you fall back here, and write your own steps and screenshots into an `agent-logs/run-*/` folder so the operator gets the same record.

## Base Kit Analysis (`analyze`)

1. The deliverable is JSON, not an image.
2. Attach the single image in `inputs.refImages` and send the target `prompt` to the analysis service.
3. Extract the JSON code block from the reply. Shape:

   ```json
   { "character": "...", "parts": [{ "key": "...", "label": "...", "category": "...", "prompt": "..." }] }
   ```

4. Return it to the running server:

   ```bash
   curl -X POST http://127.0.0.1:4217/api/requests/complete \
     -H "Content-Type: application/json" \
     -d '{"requestId": "<requestId>", "targetIndex": 0, "parts": <the JSON>}'
   ```

   The server marks the target completed and materializes one base entry per part, with the source image attached as an adopted `source-reference`.
5. If you cannot reach the server, report the JSON verbatim; the user can paste it into the "Create kit" tab.
6. If a part `prompt` is missing the single-deliverable / no-redesign / isolated-part rules, fix the JSON before returning it.

## Reporting Completion

Preferred — call the API while the server is running:

```bash
curl -X POST http://127.0.0.1:4217/api/requests/complete \
  -H "Content-Type: application/json" \
  -d '{"requestId": "<requestId>", "targetIndex": 0, "results": [{"file": "<saved path>"}]}'
```

Fallback — edit the request JSON directly: set the target `status` to `completed` (the same value the complete API writes), fill `results`, and update the request `status` when no `requested` targets remain.

## On Failure

- Do not silently retry the same request, and do not substitute screenshots, cached files, or internal blob URLs for a real export.
- Exception: if the generation service reports a terms-of-service, policy, moderation, refusal, or safety violation, retry in a fresh chat up to 3 attempts total before marking the target `error`. Keep the same deliverable intent and required references, but reword the prompt conservatively to remove likely trigger wording; record each attempt in the run log.
- Set the target `status` to `error` with an `errorMessage` explaining what failed in the normal procedure.
- Report what user action or prompt change is needed next.
