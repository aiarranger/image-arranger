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
- `skills/image-arranger-queue-processing` - the only approved browser route for
  processing image-arranger generation queues in this operator environment.

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

## Absolute Pre-Push Garbage Gate

Before any commit or push, remove and verify the absence of garbage data. This is
a hard rule, not a best-effort cleanup.

- Do not push sample rows, request files, output files, history snapshots, or
  candidates that only exist to make the UI look busy.
- The bundled sample deck must not contain empty Image or Video entries that
  display the no-generated-image label (`画像` + `未生成` /
  `Not generated yet`) on a fresh clone. If an image or video entry is included
  in sample data, it must have a real bundled asset and a clear reason to appear.
- Remove obsolete local/generated concepts before push, especially old
  demonstration-agent remnants, placeholder outputs, cached screenshots, old
  review artifacts, old sample-game asset rows, old base-sample-game rows,
  rejected non-Aichan character-name variants, and any generated image/video
  that was not intentionally adopted as public sample data.
- Never create demonstration-only images, mock generated images, screenshots, or
  placeholder media to make the app, README, landing page, queue, sample deck, or
  tests look more complete. If an image or video is not a real operator-provided
  reference, a real generated service export, or an intentionally adopted public
  sample asset with provenance, it must not be created, committed, registered as
  a candidate, or used to complete a request.
- Never replace missing assets with decorative stand-ins: abstract cards,
  gradient-only thumbnails, blurred blobs, CSS-only proxy visuals, invented
  adoption states, synthetic request panels, or status art that suggests an asset
  exists. If the real file does not exist, show honest text/data or remove that
  visual section.
- Check both tracked and untracked files. If an HTML/JS/CSS file references an
  untracked asset, either track that asset or remove the reference before commit.
- Check ignored local workspaces separately. `workspace/sample`, `.history`,
  `deck.json.bak`, `requests/`, `outputs/`, and `agent-logs/` are not pushed, but
  they can still mislead local verification. Clean or regenerate them before
  reporting the screen as verified.
- The final pre-push step must explicitly confirm that no demonstration-only,
  mock, screenshot-derived, cache-derived, or placeholder image/video remains in
  tracked files, untracked files, ignored local workspaces, request results,
  output folders, README/LP assets, or sample deck asset lists.
- The same final check must cover HTML/CSS/JS that fabricates missing images,
  videos, parts, candidates, or queue states with decorative panels instead of
  real files and real state.
- Run the CI deny-list scan before push. The exact removed-processing terms and
  rejected non-Aichan character-name variants are encoded in
  `.github/workflows/ci.yml`; do not reintroduce those terms in tracked source,
  sample data, docs, or filenames.
- Run the relevant tests/checks after cleanup. Do not describe the repo as clean
  until the current app state and the committed sample seed both show no garbage
  rows.

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

## Queue Processing Browser Route

For this operator environment, there is exactly one approved entrypoint for
queued ChatGPT image generation and Vidu image-to-video processing:

```bash
node scripts/process-service-queue.mjs --setup-profile --service chatgpt
node scripts/process-service-queue.mjs --setup-profile --service vidu
node scripts/process-service-queue.mjs --check --service chatgpt --ensure-tab --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --check --service vidu --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --dry-run --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217
```

Use `skills/image-arranger-queue-processing` as the canonical step-by-step
procedure. The script above is the first-choice executor for this operator
environment; it delegates to the ChatGPT or Vidu driver based on each queued
target's `service`. Use manual browser operations only to repair that same
route, then rerun from the beginning.

1. Keep image-arranger itself in the Codex in-app browser at
   `http://127.0.0.1:4217/` for local app inspection and queue state.
2. Operate ChatGPT only in the already-running external Chrome profile selected
   by `node scripts/process-service-queue.mjs --setup-profile --service chatgpt`.
   The local selection is saved in `workspace/.local/chatgpt-profile.json`,
   which is ignored by git. This selection is written and verified only through
   `scripts/service-browser-profile.mjs`.
   Browser tab control is routed through `scripts/service-browser-route.mjs`;
   macOS-specific AppleScript code lives in `scripts/chrome-route-macos.mjs`,
   and Windows Chrome bridge code lives in `scripts/chrome-route-windows.mjs`.
   Do not add OS-specific browser control back into service drivers or
   `scripts/service-browser-profile.mjs`.
3. Do not operate the service Chrome profile through ad-hoc Browser Use backend
   selection during normal queue processing. The scripts perform tab discovery
   through `scripts/service-browser-route.mjs`. If a human debugging step
   explicitly requires Browser Use, select the backend by saved profile name and
   never use the default `extension` backend blindly.
4. Use one ChatGPT work tab with a marker URL that includes
   `agent-work=image-arranger`, `profile-directory`, and `profile-email` for the
   saved profile. Reuse that tab for the whole queue attempt. The script must
   not create this tab; if it is missing, it stops and prints the exact URL to
   open in the saved Chrome profile.
5. Attach reference images through the approved route for the current OS. On
   macOS, `osascript` sets the clipboard to the PNG as `«class PNGf»`, the
   marked ChatGPT tab is brought to the front, the composer is focused, and
   System Events sends a real `Cmd+V`. On Windows, the Chrome bridge injects the
   reference as a browser `File` into the already-open bound marker tab; it does
   not use Codex image generation, a file chooser fallback, or a generated
   browser profile. ChatGPT-specific macOS attach/send code lives in
   `scripts/chatgpt-route-macos.mjs`; ChatGPT-specific Windows attach/send code
   lives in `scripts/chatgpt-route-windows.mjs`.
6. Insert the prompt into the composer with page-context
   `document.execCommand("insertText", false, prompt)` or an equally verified
   normal text-entry path, then verify the full prompt is visible and the send
   button is enabled before sending.
7. Send through the visible ChatGPT composer, wait for completion, save through
   the normal ChatGPT image UI, then register the downloaded/exported file through
   the image-arranger request completion API.
8. Vidu targets are routed by the same common entrypoint to the Vidu driver. Vidu
   must first be configured with
   `node scripts/process-service-queue.mjs --setup-profile --service vidu`.
   The local selection is saved in `workspace/.local/vidu-profile.json`; without
   that file the Vidu driver must print candidates and stop before opening
   Chrome. This selection is written and verified only through
   `scripts/service-browser-profile.mjs`. Vidu must open in the selected normal
   Chrome profile, for example `kaminokuresse@gmail.com` / `ユーザー 1`, not in
   a generated `~/.image-arranger/vidu-*` profile. Do not use the rejected
   `~/.image-arranger/agent-chrome` profile for ChatGPT or Vidu. The Vidu driver
   must not launch Chrome or create a tab; it may only reuse a Vidu marker URL
   that is already open in the saved profile. The Vidu marker URL must include
   both `profile-directory` and `profile-email`; `profile-directory=Default`
   alone is not a safe profile proof.

### Common Service Browser Profile Contract

Every browser-based generation service driver must use
`scripts/service-browser-profile.mjs` for the startup/profile phase. This is the
only approved startup contract for ChatGPT, Vidu, and future service drivers.
It must also use `scripts/service-browser-route.mjs` for tab discovery and page
JavaScript execution. Mac-only changes belong in `scripts/chrome-route-macos.mjs`
or a service-specific `*-route-macos.mjs`; Windows-only changes belong in
`scripts/chrome-route-windows.mjs` or a service-specific
`*-route-windows.mjs`. Do not mix both operating systems in one service driver
when a route file can isolate the behavior.

Required flow:

1. `--list-profiles` lists candidates from Chrome `Local State`.
2. `--setup-profile --service <service> --profile-choice <n>` saves the chosen
   signed-in normal Chrome profile under `workspace/.local/<service>-profile.json`.
3. Normal `--check` and processing runs read that saved config before touching
   any service page.
4. If the config is missing, stale, unsigned, or contains any `automationChrome`
   / `viduAutomationChrome` style field, the driver must print candidates and
   stop before opening Chrome.
5. The service driver may only reuse a marker tab that is already open in the
   saved normal Chrome profile. It must not open Chrome, create a new tab, create
   a service-specific `~/.image-arranger/<service>-chrome`,
   `~/.image-arranger/<service>-profiles/*`, temporary `--user-data-dir`, CDP
   automation profile, unspecified default Chrome profile, or Codex-local
   generation fallback.
6. A new service may add only the service-specific page logic after this common
   profile guard. It must not copy back the removed Vidu generated-profile
   startup or the old ChatGPT CDP automation startup.
   If the service needs OS-specific attach, upload, send, save, or download
   behavior, add separate macOS and Windows route files first, then call them
   from the service driver through the common route boundary.
7. On Windows ChatGPT and Vidu runs, tab control must go through the local Chrome bridge:
   `scripts/chrome-bridge-host.mjs` plus the unpacked extension in
   `extensions/chrome-bridge`, installed in the selected normal Chrome profile.
   The first successful `--check` binds that extension's `bridgeClientId` and
   `bridgeExtensionId` into `workspace/.local/<service>-profile.json`; later runs
   must send commands only to that bound extension client. Before the first
   bind, the selected email must be unique in Chrome `Local State`; if multiple
   profiles use the same email, stop instead of guessing. If that extension is
   not connected from the selected profile, the service driver must stop. Do not
   replace it with `Start-Process chrome`, `--profile-directory`, a new
   `--user-data-dir`, or Codex image generation. ChatGPT attach/send/save on
   Windows must stay on the same bound bridge tab until the generated image has
   been saved and registered.

When maintaining `scripts/process-service-queue.mjs` or the delegated ChatGPT
driver, preserve these implementation constraints:

- Browser JavaScript encoded by Node and executed through AppleScript must be
  decoded with `TextDecoder`; `atob()` alone corrupts Japanese labels such as
  `保存` and breaks the normal ChatGPT save flow.
- After sending, track only the same active marker tab until it becomes a
  `/c/...` conversation URL. Do not scan all ChatGPT tabs for matching prompt
  text or generated images.
- `hasStopButton: true` on the marker URL means ChatGPT accepted the send but
  the URL has not settled yet. Keep waiting for the conversation URL.
- On Windows, ChatGPT image queues use the same bound Chrome bridge route as
  preflight. Reference images are injected as browser `File` objects, sending is
  done through the visible ChatGPT send button, and saving is done through the
  normal ChatGPT image UI into the configured download directory.

Rejected routes from the 2026-06-27 audit:

- `scripts/process-queue.mjs` / CDP automation Chrome: launches or reuses the
  dedicated `~/.image-arranger/agent-chrome` profile, not the locally selected
  Chrome profile, and failed login in this environment. The script is disabled
  and must not be re-enabled for queue processing.
- `open -a "Google Chrome" ... --profile-directory=...` service startup:
  already-running multi-profile Chrome can place the URL in the wrong profile.
  Service drivers must not use it to open ChatGPT, Vidu, or future services.
- Windows `Start-Process chrome`, `start chrome`, or equivalent
  `--profile-directory` launch paths: they can reproduce the same wrong-profile
  failure. Use the Chrome bridge extension in the selected profile instead.
- Chrome file chooser / `fileChooser.setFiles`: failed with `Not allowed`.
- Browser tab virtual clipboard for PNG via `tab.clipboard.write`: dropped the
  Chrome extension pipe (`native pipe closed before response`).
- Codex built-in image generation, screenshots, placeholder files, blob/cache
  extraction, or any non-ChatGPT substitute.

If the approved route fails, stop with the request still pending or mark it
`error` with the real failure reason. Do not switch routes.

## Scripted Processing (optional, not the approved local route)

> Disclaimer: the bundled automation driver operates your browser with your
> account at your responsibility, and may conflict with a generation service's
> terms of service. Review those terms before use. The stable interface is the
> request-file contract; the driver is an optional, replaceable convenience.

The scripted ChatGPT image processor carries queued `generate` targets through a
dedicated automation Chrome profile. In this operator environment it is not the
approved queue route because it does not use the locally selected Chrome
profile. Keep the script for OSS reference and development only; do not use it
to process this user's image-arranger queues unless the operator explicitly
changes the profile contract.

### Chrome Profile and Browser Instance Rules

For browser-based processors, one browser profile must have at most one running
browser instance.

- For image-arranger ChatGPT queue processing and browser operation, use only the
  Chrome profile selected by
  `scripts/process-service-queue.mjs --setup-profile --service chatgpt`.
- For Vidu queue processing, use the normal Chrome profile configured by the
  Vidu driver through
  `scripts/process-service-queue.mjs --setup-profile --service vidu`.
  The Vidu driver must not launch an unspecified default profile or a generated
  `~/.image-arranger/vidu-*` profile. If `workspace/.local/vidu-profile.json` is
  missing or stale, list candidates and stop before opening Chrome.
- If that profile is already running, do not launch another Chrome/Chromium
  instance for the same profile. Reuse the running browser when the driver can do
  so safely. If it cannot be reused safely, stop and report the profile conflict.
- Do not process image-arranger queues from any other Google/ChatGPT profile,
  including the default automation profile, an unsigned profile, or a newly
  created temporary profile that was not created from the saved ChatGPT/Vidu
  profile configuration.
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
- On Windows, ChatGPT and Vidu profile startup and tab-control failures must use
  the documented Chrome bridge setup in
  [docs/windows-chrome-bridge.md](docs/windows-chrome-bridge.md). If the bridge
  is not connected from the selected profile or still cannot operate the service
  page, leave the request uncompleted and report the browser failure. Do not
  substitute another generation path.

Do not run `scripts/process-queue.mjs` for this operator's ChatGPT image queues.
Use `scripts/process-service-queue.mjs` via `skills/image-arranger-queue-processing`
instead.

Vidu/image-to-video targets can be processed with the optional Vidu driver when
you have a suitable account and the service UI is available:

```bash
node scripts/process-service-queue.mjs --setup-profile --service vidu
node scripts/process-service-queue.mjs --check --service vidu --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --service vidu --server http://127.0.0.1:4217
```

The Vidu script reuses the selected normal Chrome profile's already-open marker
tab, injects exactly `inputs.startFrame` and `inputs.endFrame` into the Vidu UI,
submits through Vidu's visible create button, saves the MP4 into `outputDir`, and
reports completion through `POST /api/requests/complete`. It must not launch
Chrome, create tabs, use CDP file chooser upload, or switch back to any generated
automation profile. If Vidu visibly shows a non-zero credit cost, stop unless
the operator intentionally reruns with `--allow-paid`.

Division of labour:

- The common service script routes ChatGPT image `generate` and `improve` targets
  whose
  `service` is `chatgpt` or omitted.
- The common service script routes Vidu video `generate` targets with
  `inputs.startFrame` and `inputs.endFrame`.
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

1. Use ChatGPT image generation for image `generate` targets through the single
   approved queue-processing browser route above.
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

Detailed attach/prompt/wait/collect guidance for the macOS keystroke fallback
lives in [docs/manual-fallback.md](docs/manual-fallback.md). It applies only to
macOS runs. Windows ChatGPT runs use the bound Chrome bridge route above.

### One-time macOS Setup for Real-OS Keystrokes

The manual fallback in `docs/manual-fallback.md` uses `osascript`, `pbcopy`, and
`pbpaste` to paste images or text into a browser when the macOS scripted path
needs real OS keystrokes. On macOS, grant Automation and Accessibility
permission to the terminal app or agent runner that executes those commands.
This macOS-only route keeps the work inside the locally selected Chrome profile
and avoids the rejected CDP automation profile, file chooser, and
virtual-clipboard paths. It is not the Windows route.

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
