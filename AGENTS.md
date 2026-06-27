# Processing image-arranger Requests

This guide is for a human operator or coding agent that processes the
`requests/*.json` files written by image-arranger.

image-arranger itself never calls a generation API. It writes request files. A
processor reads those files, uses the user's chosen generation service in its
normal UI or with its own tooling, saves the result, registers it back with
image-arranger, and reports completion.

The stable interface is the request-file contract in
[docs/request-spec.md](docs/request-spec.md). A non-agent operator can also
process a request entirely by hand; see
[Process a request by hand](README.md#process-a-request-by-hand-no-agent-needed)
in the README.

## User Intent

Review feedback, automated QA, or an agent's preferred approach must not rewrite
the operator's explicit request. If a suggested change would alter the requested
goal, audience, storyboard, timing, copy, source requirements, assets, or
deliverable shape, stop and ask the operator before implementing it.

Reviewer comments are bug reports inside the approved specification. When review
feedback conflicts with the operator's stated intent, the operator's intent wins.

## Bundled Codex Skills

This repository includes the repository-local Codex skill that is directly useful
for maintaining the OSS app:

- `skills/gui-ux-verification` - real UI verification rules for frontend fixes
  and scroll/click operability bugs.

If your agent runtime does not auto-discover repository-local skills, install or
copy that folder into the runtime's skill search path before doing GUI QA on
image-arranger.

## Quick Bootstrap

```bash
node --version          # Node 20+ for the app; scripted ChatGPT driver needs Node 22+
npm start              # terminal 1: http://127.0.0.1:4217 with ./workspace/sample
open http://127.0.0.1:4217/
npm test
```

The sample workspace starts with no queued requests. Queue files are created
only when the operator explicitly queues work in the UI.

For a different port or workspace, run the underlying commands directly:

```bash
node server.mjs --workspace ./workspace/sample --init sample --port 4321
```

## Workspace and Test-Data Safety

- Treat any workspace under `workspace/` that you did not create yourself as
  production data. Do not read, modify, serve, or test with it unless the
  operator explicitly authorizes that workspace for the task.
- `workspace/sample` is the bundled public-safe sample deck. `npm start` and CI can
  regenerate it.
- For automated tests that do not need an operator-provided live workspace, use a
  throwaway workspace under `/tmp` and clean it up when finished.
- If `workspace/_LOCAL_RULES.md` exists, read it first. It is gitignored and may
  contain local operator-specific rules that override the generic rules above.

## GUI/UX Verification

For frontend changes or user-reported UI bugs, verify the actual screen as a user.
DOM metrics, source reading, and shortcut API calls are supporting evidence only.

- Use the exact URL or workspace the operator gives you. If none is given, start a
  local sample server and report the URL you verified.
- Keep checks read-only unless mutation is required to verify or fix the issue.
- Test the user-visible path first. Do not rely on hidden controls or developer
  knowledge unless the screen itself points the user there.
- Check at least a normal desktop viewport and a short or narrow viewport for
  screens touched by the change.
- For scroll-heavy flows, confirm that natural scrolling reaches the expected
  action and that controls are not clipped at the apparent stopping point.
- For buttons, details summaries, tabs, route selectors, and accordions touched by
  the work, click them and record the visible result.
- Report concrete evidence: URL, viewport size, starting screen, actions, what was
  visible, what changed, and any remaining skipped checks.

## Scripted Processing (optional)

> Disclaimer: the bundled automation driver operates your browser with your
> account at your responsibility, and may conflict with a generation service's
> terms of service. Review those terms before use. The stable interface is the
> request-file contract; the driver is an optional, replaceable convenience.

The scripted ChatGPT image processor carries queued `generate` targets through a
dedicated automation Chrome profile: fresh chat, attach references, insert and
verify the prompt, send, wait, save into `outputDir`, register the result as an
asset candidate, report completion, and write a reviewable log under
`agent-logs/run-*/`.

### Chrome Profile and Browser Instance Rules

For browser-based processors, one browser profile must have at most one running
browser instance.

- Before launching Chrome/Chromium for a dedicated profile, check whether that
  profile is already running.
- If the intended profile is already running, reuse that running browser when the
  driver supports it. If it cannot be reused safely, stop and report the exact
  profile and process conflict. Do not launch a second browser with the same
  profile.
- Do not run both a normal Chrome window and an automation Chrome window against
  the same profile.
- Do not work around a profile conflict by switching to Codex image generation,
  screenshots, placeholder output, or any non-service-generated image.
- On Windows, if Chrome upload, clipboard paste, profile startup, login, or
  remote-control attachment fails, leave the request uncompleted and report the
  browser failure. Do not substitute another generation path.

```bash
# one-time setup / health check: opens a dedicated automation Chrome profile
node scripts/process-queue.mjs --check --server http://127.0.0.1:4217

# process queued ChatGPT image targets
node scripts/process-queue.mjs --server http://127.0.0.1:4217

# useful variants
node scripts/process-queue.mjs --dry-run
node scripts/process-queue.mjs --request <id>
node scripts/process-queue.mjs --parallel 3
node scripts/process-queue.mjs --keep-tabs
```

Vidu/image-to-video targets can be processed with the optional Vidu driver when
you have a suitable account and the service UI is available:

```bash
node scripts/process-vidu-queue.mjs --check --server http://127.0.0.1:4217
node scripts/process-vidu-queue.mjs --server http://127.0.0.1:4217
```

Division of labour:

- The ChatGPT script handles image `generate` and `improve` targets whose
  `service` is `chatgpt` or omitted.
- The Vidu script handles video `generate` targets with `inputs.startFrame` and
  `inputs.endFrame`.
- You handle `draft-prompt` and `analyze` targets. Both are reported via
  `POST /api/requests/complete`; the scripted browser drivers do not process
  them.
If a script exits with an error, read `agent-logs/run-*/log.md` first. Fix the
cause when possible, then rerun. Fall back to manual processing when the script
itself cannot be repaired or when the target service is unsupported.

## Request Files

Default location:

```text
<workspace>/requests/*.json
```

Process a target when:

- the request `status` is `requested`, and
- the target `status` is `requested`.

Never process requests or targets whose `status` is `cancelled`.

Common target actions:

- missing `action` or `action: "generate"` - create a new image or video.
- `action: "improve"` - regenerate based on an existing asset.
- `action: "analyze"` - return JSON analysis for the base kit. No image is
  generated.
- `action: "draft-prompt"` - write a generation prompt from a reference URL.

## Image Generation (`generate`)

1. Use ChatGPT image generation for image `generate` targets by default: prefer
   `scripts/process-queue.mjs`, or manually operate ChatGPT when the script is not
   suitable.
   Never use Codex's built-in `image_gen` tool for queued image-arranger work.
   This is a hard prohibition: browser trouble, Chrome upload failure, clipboard
   failure, login failure, profile conflict, Windows-specific failure, or service
   refusal does not make Codex image generation acceptable. A Codex-local
   preview/mock may be created only when the operator explicitly asks for a
   preview/mock, and it must never be registered as a candidate or used to
   complete a queued request.
2. Use the target `prompt` as-is.
3. If `inputs.refImages` is present, attach only those files. They contain assets
   the user explicitly adopted or the source asset for an improvement. For
   character image generation, prefer one reference image. Two reference images
   are the practical maximum when the request truly needs a second anchor; three
   or more references are discouraged because they often dilute identity,
   direction, outfit, or pose constraints. If a queued target has more than two
   references, ask the operator to reduce the set or revise the request before
   generation unless the operator explicitly approves the larger set.
4. Treat one queue target as one deliverable. Do not produce grids, contact
   sheets, A/B comparisons, or multiple candidates for a single target.
5. If `qualityGate.enabled` is present, compare the candidate against
   `qualityGate.requiredParts` before completion. Compare only visible matching
   parts; do not fail missing, hidden, cropped-out, or occluded parts.
6. Save the passing result into the target `outputDir`.
7. For ordinary image creation, including "basic image" requests and generated
   character sheets, route the target to the character's `images` entries. Use
   `base.*` entries only when the operator explicitly says the asset should be a
   base/reference/master asset. If a queued target points at `base.*` without
   that explicit instruction, create or use an appropriate `images` entry before
   completing the target so the result does not appear under Base.
8. Register the file as an asset candidate on the matching entry, marking it
   adopted only if the user asked for auto-adoption.
9. Mark the target completed, including `qualityReport` when a quality gate was
   evaluated.

If a queued target was accidentally generated with any non-ChatGPT path, treat
that output as a diagnostic only. Do not complete the request with it without
operator approval; remove or keep it unadopted as directed, return the request to
`requested`, and process it through ChatGPT.

## Prompt Drafting (`draft-prompt`)

The operator supplies a reference URL and delegates prompt writing.

1. Open the target's `referenceUrl` and study the appeal of the reference:
   composition, pose, style, palette, props, and mood.
2. Review `inputs.refImages`. They are the ground truth for the character's
   identity and parts; the reference URL must not override identity.
3. Write one English generation prompt that recreates the appeal of the reference
   with this character. Require exactly one image, no text, no logo, no watermark.
   Also write a short display title.
4. Report the draft:

   ```bash
   curl -X POST http://127.0.0.1:4217/api/requests/complete \
     -H "Content-Type: application/json" \
     -d '{"requestId": "<requestId>", "targetIndex": 0, "overview": "<short title>", "prompt": "<your prompt>"}'
   ```

The server imports the title and prompt into the entry and queues a normal
generation request.

## Image Improvement (`improve`)

Treat `inputs.sourceAsset` / `assetFile` as the primary reference and follow
`improvementPrompt` as the improvement intent. Otherwise, use the same contract as
image generation.

## Video Generation (`generate` with frames)

1. Pass `inputs.startFrame` and `inputs.endFrame` to the image-to-video service.
2. Use the target `prompt` as the motion prompt, and use `inputs.durationSec` when
   the service lets you choose duration.
3. Generate one video first. Check frame fidelity, locked camera, single action,
   and no unexpected objects before retrying.
4. Save into `outputDir`, register the asset, and complete the target.

## Manual Browser Fallback

Use this only when the scripted processor cannot be repaired or when no scripted
processor exists for the target service.

1. Read the request JSON.
2. Generate exactly one deliverable in the generation service's normal UI.
3. Save the output somewhere accessible.
4. Register the output in image-arranger as a candidate asset, or report it with
   `POST /api/requests/complete`.
5. Record enough notes for the operator to understand what was done and why.

Manual fallback is still a real-service workflow. If the normal UI cannot be
operated because upload, clipboard, login, browser profile, or automation control
fails, stop with the request still pending or mark it `error` with the real
failure reason. Do not use Codex image generation, placeholder files,
screenshots, or cached/internal browser blobs as substitutes for the service
export.

Detailed attach/prompt/wait/collect guidance for macOS keystroke fallback lives in
[docs/manual-fallback.md](docs/manual-fallback.md).

### One-time macOS Setup for Real-OS Keystrokes

The manual fallback in `docs/manual-fallback.md` uses `osascript`, `pbcopy`, and
`pbpaste` to paste images or text into a browser when no CDP/scripted path is
available. On macOS, grant Automation and Accessibility permission to the
terminal app or agent runner that executes those commands. Prefer
`scripts/process-queue.mjs`/`scripts/process-vidu-queue.mjs` whenever they work;
this setup is only for the documented last-resort fallback.

## Base Kit Analysis (`analyze`)

The deliverable is JSON, not an image. Shape:

```json
{ "character": "...", "parts": [{ "key": "...", "label": "...", "category": "...", "prompt": "..." }] }
```

Return it to the running server:

```bash
curl -X POST http://127.0.0.1:4217/api/requests/complete \
  -H "Content-Type: application/json" \
  -d '{"requestId": "<requestId>", "targetIndex": 0, "parts": <the JSON>}'
```

If a part prompt is missing the single-deliverable, no-redesign, or isolated-part
rules, fix the JSON before returning it.

## Reporting Completion

Preferred:

```bash
curl -X POST http://127.0.0.1:4217/api/requests/complete \
  -H "Content-Type: application/json" \
  -d '{"requestId": "<requestId>", "targetIndex": 0, "results": [{"file": "<saved path>"}]}'
```

Fallback: edit the request JSON directly, set the target `status` to `completed`,
fill `results`, and update the request status when no `requested` targets remain.

## On Failure

- Do not silently retry the same request.
- Do not substitute screenshots, cached files, or internal blob URLs for a real
  export.
- For terms-of-service, moderation, refusal, or safety failures, retry in a fresh
  chat up to three attempts total. Keep the deliverable intent and required
  references, but conservatively reword likely trigger wording.
- Set the target `status` to `error` with an `errorMessage` explaining what failed.
- Report what user action or prompt change is needed next.
