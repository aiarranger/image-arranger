# Processing image-arranger Requests

This guide is for a human operator or a coding agent (Claude Code, Codex, etc.) that processes the `requests/*.json` files written by image-arranger.

image-arranger never operates ChatGPT, Vidu, or any generation service directly. The processor reads a request file, performs the work in the generation service's normal UI (or via its own tooling), saves the results, and reports completion back.

## Scripted Processing (preferred)

Do not drive the generation service's browser UI by hand. The repository ships a deterministic processor that carries every queued ChatGPT image-generation target through the whole pipeline — fresh chat, attach references, insert and verify the prompt, send, wait, save into `outputDir`, register the result as an asset candidate, report completion — and records everything it does (steps + screenshots) into `agent-logs/run-*/` for the operator to review.

```bash
# one-time setup / health check: launches a dedicated automation Chrome
# (its own profile + CDP port; it never touches the user's main browser).
# Sign in to ChatGPT once in the window it opens.
node scripts/process-queue.mjs --check --server http://127.0.0.1:4310

# process every queued chatgpt generate target end to end
node scripts/process-queue.mjs --server http://127.0.0.1:4310

# useful variants
node scripts/process-queue.mjs --dry-run            # list what would run
node scripts/process-queue.mjs --request <id>       # one request only
node scripts/process-queue.mjs --keep-tabs          # leave chats open to inspect
```

Division of labour:

- **The script handles** `generate` targets for images (service `chatgpt`). It retries a refused/failed generation in a fresh chat up to 3 attempts total, then reports `error` via the complete API and moves on.
- **You handle** `draft-prompt` (read the reference URL, write the prompt — see below) and `analyze` (image analysis JSON). Both are reported via the complete API with `curl`; no browser automation needed. After completing a `draft-prompt`, rerun the script to process the auto-queued generation.
- Video targets (Vidu) are processed per the Video section below.
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
4. Save the result into the target `outputDir`.
5. Register the file as an asset candidate on the matching entry (via the UI or `POST /api/assets`), marking `adopted` only if the user asked for auto-adoption.
6. Mark the target completed (see Reporting below).

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
2. Use the target `prompt` as the motion prompt.
3. Generate one video first; check frame fidelity, locked camera, single action, and no extra objects before retrying.
4. Save into `outputDir` and register the asset.

## Manual Browser Fallback (only when the script cannot be repaired)

## One-time macOS Setup for Real-OS Keystrokes

Agents whose browser tools use a *virtual* clipboard (paste fails with "virtual clipboard has no data") must fall back to real-OS automation, which needs two macOS permissions for the agent's host app (Cursor, Terminal, ...):

1. **Automation**: approve the "wants to control Google Chrome / use AppleScript" dialog on first run.
2. **Accessibility**: System Settings → Privacy & Security → Accessibility → enable the host app (otherwise keystrokes fail with error 1002).

Windows / Linux equivalents are not established yet.

## Browser Technique for Analysis Tasks (field-tested)

1. **Attaching the image**: never open the native file picker (it blocks automation). In-page `fetch` of local files is blocked by the service's CSP, and virtual-clipboard paste fails. The reliable route is **real clipboard + real keystroke** (field-tested 2026-06-10):
   1. `osascript -e 'set the clipboard to (read (POSIX file "<absolute path>") as «class PNGf»)'`
   2. Navigate your working tab to a unique URL first (e.g. `https://chatgpt.com/?agent-work=1`), then use AppleScript to activate exactly that tab (scan windows/tabs for the URL marker) — otherwise the keystroke can land in another tab of the same site.
   3. Click the composer with your browser tool to focus it.
   4. `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
   5. Wait for the thumbnail spinner to finish before continuing. Repeat per image for multiple references.
   If your environment can set `input[type=file]` directly (Playwright etc.), that also works (it does not open the native dialog).
2. **Entering the prompt** — try in this order, and ALWAYS verify the full text appears in the composer before sending (never send empty); if one tier fails, move to the next:
   1. Your browser tool's native text-input API (type/fill), if available.
   2. In-page JS (only in environments with real page-context JS; some agents' JS sandboxes cannot see `document.execCommand`):

      ```js
      const ed = document.querySelector('div[contenteditable="true"]');
      ed.focus();
      document.execCommand("insertText", false, "<full prompt>");
      ```

   3. Real text clipboard (deterministic last resort): set it via argv-style osascript (piped `pbcopy` can silently produce an empty clipboard), verify with `pbpaste`, then click the composer and send a real Cmd+V. Do this only AFTER all image attachments are done (it overwrites the clipboard).

      ```bash
      osascript -e 'on run argv' -e 'set the clipboard to item 1 of argv' -e 'end run' "$(cat /tmp/prompt.txt)"
      pbpaste | head -c 80
      ```

   On start/resume, if the composer still holds unsent attachments from a previous interrupted run, remove them (×) before starting.
3. **Tempo**: once the attachment spinner finishes, insert the prompt and send immediately in one go; verify with at most one screenshot before and after sending.
4. **Waiting**: extended-thinking models can take 5–15 minutes. Poll with light text reads every 30–60 s; do not reload or resend.
4. **Collecting the JSON**: click the code block's built-in copy button and read the system clipboard (`pbpaste`), or read the `pre code` textContent from the DOM. `navigator.clipboard.writeText` from injected JS can fail due to focus constraints.
5. Validate the JSON locally before posting it to the complete API.

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

Fallback — edit the request JSON directly: set the target `status` to `done`, fill `results`, and update the request `status` when no `requested` targets remain.

## On Failure

- Do not silently retry the same request, and do not substitute screenshots, cached files, or internal blob URLs for a real export.
- Set the target `status` to `error` with an `errorMessage` explaining what failed in the normal procedure.
- Report what user action or prompt change is needed next.
