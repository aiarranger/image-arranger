---
name: image-arranger-queue-processing
description: Use when processing image-arranger queued ChatGPT image-generation or Vidu image-to-video requests, especially when service browser drivers must attach inputs and register results back into image-arranger.
---

# Image Arranger Queue Processing

This repository has exactly one approved entrypoint for ChatGPT image generation
and Vidu image-to-video queue processing in this operator environment.

## First Command

Start every queued ChatGPT/Vidu generation run with this script. Do not decide
between processors manually:

```bash
node scripts/process-service-queue.mjs --setup-profile --service chatgpt
node scripts/process-service-queue.mjs --setup-profile --service vidu
node scripts/process-service-queue.mjs --check --service chatgpt --ensure-tab --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --check --service vidu --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --dry-run --server http://127.0.0.1:4217
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217
```

`scripts/process-service-queue.mjs` is the common entrypoint. It reads the queue
and delegates each target to the ChatGPT or Vidu service driver. The ChatGPT
driver is the codified version of the successful 2026-06-27 route. The common
entrypoint and drivers:

- lists Chrome profile candidates and saves the operator-selected profile in
  `workspace/.local/chatgpt-profile.json` when
  `--setup-profile --service chatgpt` is used
- lists Chrome profile candidates and saves the operator-selected Vidu profile
  configuration in `workspace/.local/vidu-profile.json` when
  `--setup-profile --service vidu` is used
- use `scripts/service-browser-profile.mjs` as the single shared implementation
  for candidate listing, setup config writing, stale-config detection, signed-in
  email validation, and rejected automation-profile detection
- use `scripts/service-browser-route.mjs` as the single shared tab-control
  boundary; macOS AppleScript behavior lives in `scripts/chrome-route-macos.mjs`
  and Windows Chrome bridge behavior lives in `scripts/chrome-route-windows.mjs`
- keep ChatGPT OS-specific attach/send behavior split between
  `scripts/chatgpt-route-macos.mjs` and `scripts/chatgpt-route-windows.mjs`;
  do not add macOS and Windows fixes back into one mixed driver function
- on Windows ChatGPT and Vidu runs, use the repository Chrome bridge host/client plus the unpacked
  `extensions/chrome-bridge` extension installed in the selected normal Chrome
  profile; the bridge is the only approved non-macOS tab-control route, and the
  first successful `--check` binds `bridgeClientId` / `bridgeExtensionId` into
  `workspace/.local/<service>-profile.json` so later runs cannot drift to another
  profile extension
- routes `service: "chatgpt"` image targets to
  `scripts/process-chatgpt-profile-queue.mjs`
- routes `service: "vidu"` video targets to `scripts/process-vidu-queue.mjs`
- for ChatGPT, refuses to run if Google Chrome is not already running
- for Vidu, refuses to run unless the normal Chrome profile has been selected,
  saved locally, and is already running
- refuses the rejected `~/.image-arranger/agent-chrome` automation profile
- verifies the saved Chrome profile directory, display name, and email against
  Chrome `Local State` before touching ChatGPT
- uses exactly one ChatGPT marker tab whose URL includes
  `agent-work=image-arranger`, `profile-directory`, and `profile-email` for the
  saved profile
- uses exactly one Vidu marker tab whose URL includes
  `agent-work=image-arranger-vidu`, `profile-directory`, and `profile-email` for
  the saved profile
- refuses generated automation profiles and unspecified default profiles during
  normal queue processing; marker tab creation or activation is a scripted
  profile-safe setup/repair step, not a service/profile switch
- if the Vidu marker tab is missing, stale, logged out, or unusable, the Vidu
  driver must stop before upload/prompt/create after the common profile-safe
  marker setup route fails. It must not invoke the Google Chrome executable with
  `--profile-directory`, probe other signed-in Chrome profiles, or rewrite
  `workspace/.local/vidu-profile.json` to a different profile during normal
  processing.
- attaches ChatGPT references through the OS-specific approved route: real macOS
  PNG clipboard on macOS, with one same-marker-tab browser file-input fallback
  if the attachment chip does not appear; browser `File` injection through the
  bound Chrome bridge tab on Windows
- inserts and verifies the queue prompt before sending
- waits for the visible ChatGPT send button to become enabled after the
  reference upload finishes
- treats ChatGPT `リクエストが多すぎます`, `Too many requests`, or other visible
  rate-limit wording as not ready even when the composer exists. A preflight
  check must inspect the full visible page text, not only the first body lines,
  and must stop before attachment or prompt insertion while the rate-limit
  message is visible.
  After a rate-limit stop, do not poll in a tight loop and do not retry
  generation manually. Recheck only with the preflight route every 30 minutes:
  `node scripts/watch-chatgpt-rate-limit.mjs --server http://127.0.0.1:4217`.
  This watcher runs `--check --service chatgpt --ensure-tab` only; it must not
  attach references, insert prompts, or send requests. When it exits 0, resume
  the same pending queue target through the common entrypoint.
- optionally selects a non-Pro ChatGPT model before generation when
  `--image-model <pattern>` or `IMAGE_ARRANGER_IMAGE_MODEL` is set; this is an
  advisory guard, so picker failures are logged and generation continues with
  the active model
- waits for the ChatGPT-generated image
- opens the generated image and clicks the normal ChatGPT `保存` button
- copies the downloaded file into the target `outputDir`
- reports completion through `POST /api/requests/complete`
- if ChatGPT refuses image generation with policy wording and no image was
  saved, the target is still incomplete. Keep the same queue target pending,
  repair the prompt, and retry that same target after preflight. For MV
  keyframes, the first repair should simplify the prompt: make the scene/action
  the subject, keep Aichan as a small or shoulder-up figure if possible, and
  remove unnecessary full-outfit, body-proportion, anatomy-negative, or
  fanservice-avoidance wording that can itself cause policy friction. Do not
  create a new replacement request unless the current request has a saved
  rejected asset or the operator explicitly asks.
- for Vidu, injects `inputs.startFrame` and, when present, `inputs.endFrame`
  into the selected normal-profile Vidu page. Start-only Vidu targets are valid;
  `inputs.startFrame` is required, `inputs.endFrame` is optional. The driver
  must choose the upload behavior from the request data: when only
  `inputs.startFrame` exists, upload exactly one file into the first image input
  and leave the second/start-end frame input empty; when both frames exist,
  upload the two files separately into the first and second frame inputs. Do not
  put the same start file into both Vidu frame slots for start-only mode. The
  driver submits through the visible Vidu UI, saves the MP4 from Vidu's direct
  result URL or normal download button, and reports completion through
  `POST /api/requests/complete`
- for Vidu, must stop before upload, prompt insert, or create submit if the
  selected Vidu page already shows an active upload/generation state such as
  `アップロード中`, `処理中`, `作成中`, `生成中`, `Uploading`, `Processing`,
  `Generating`, or `In progress`. A local timeout or request `error` does not
  prove the Vidu-side job has stopped. Do not submit a replacement while a
  visible Vidu task is still running; wait for that task to finish/fail, then
  inspect whether it produced the requested clip before creating another
  request.
  Do not treat old history items as an active task just because the page body
  still contains `処理中` or an older prompt. The stop condition must be tied to
  the current create/upload form or an explicit currently running task indicator:
  disabled create button plus visible upload/generation status in the create
  area, active upload preview, or an unmistakable current task panel. History text
  alone is evidence to inspect, not a blocker.
- for Vidu, always record the start-frame continuity RMSE after saving a result
  when `inputs.startFrame` is available. By default this check is warning-only
  for test runs and should not block progress; it becomes a rejection gate only
  when `IMAGE_ARRANGER_VIDU_STRICT_START_FRAME=1` is set. Separately, exact
  SHA-256 duplication with an older registered clip is still treated as stale
  history pickup.

Implementation guardrails for the common entrypoint and ChatGPT driver:

- When AppleScript executes browser JavaScript that was base64-encoded by Node,
  decode it with `TextDecoder`. `atob()` alone corrupts non-ASCII literals such
  as `保存`, which makes the save-button detection fail even though the visible
  button exists.
- After sending the prompt, follow only the same active tab that held the
  `?agent-work=image-arranger` marker. Do not scan all ChatGPT tabs for matching
  prompt text, because old conversations can contain similar prompts or images.
- Treat `hasStopButton: true` on the marker URL as "send accepted but URL not
  settled yet"; keep waiting until the same tab becomes a `/c/...` conversation
  URL before watching for the generated image.

If the common entrypoint or a service driver fails, do not switch routes. Read
the failure and either fix the script/skill, then rerun from the beginning, or
leave the request pending/error with the real reason.

## Profile Route Regression Tests

After changing ChatGPT/Vidu Chrome startup, marker-tab repair, profile proof,
or Vidu upload behavior, run the small checks first:

```bash
npm run check
npm test
```

For the real macOS browser route, use the explicit test-only command:

```bash
npm run test:real-browser-route
```

This command is not part of normal queue processing. It may open temporary
Google Chrome windows only under a disposable test `--user-data-dir`, and must
refuse to run if a normal operator Chrome is already running. It covers
multi-profile/multi-window cases, wrong-profile marker URLs, marker tabs closed
during operation, and page-JavaScript execution against the wrong profile.
Because the macOS route proves the active Chrome profile by executing JavaScript
on `chrome://version`, remember that
`表示 > 開発 / 管理 > Apple Events からの JavaScript を許可` is stored per Chrome
profile as `browser.allow_javascript_apple_events`. The real-browser test seeds
that preference into its disposable `Default` and `Profile 1` profiles before
launch. If Chrome still refuses Apple Events JavaScript, the test must perform
one probe, close Chrome, and stop with the permission error. It must not keep
opening `chrome://version` tabs.

For live ChatGPT/Vidu service checks, remember that the service drivers still
must not launch Chrome by themselves. If Chrome is closed and the operator
explicitly asks for live service checks, prepare the test precondition only after
confirming no Chrome process is running:

```bash
open -na "Google Chrome" --args --profile-directory=Default --no-first-run --no-default-browser-check --new-window about:blank
```

This is a test precondition for the saved normal profile, not a queue-processing
startup route. Do not use it while any Chrome profile is already running. After
the live checks, close the Chrome instance opened for the test and verify no
`Google Chrome`, `ia-real-browser`, `agent-chrome`, or `vidu-chrome` process
remains.

## Shared Startup Contract for All Services

ChatGPT, Vidu, and any future browser-based generation service must use the same
startup/profile contract. Do not add a service-specific startup path.
They must also use the same browser route split: profile/config logic remains in
`scripts/service-browser-profile.mjs`, tab discovery and page JavaScript go
through `scripts/service-browser-route.mjs`, and operating-system behavior stays
inside `*-route-macos.mjs` or `*-route-windows.mjs` files.

1. `--list-profiles` prints Chrome profile candidates from Chrome `Local State`.
2. `--setup-profile --service <service> --profile-choice <n>` saves the selected
   signed-in normal Chrome profile under `workspace/.local/<service>-profile.json`.
3. Normal `--check` and processing runs read that saved config before focusing or
   inspecting any generation-service tab.
4. If the config is missing, stale, unsigned, belongs to a different service, or
   contains `automationChrome` / `viduAutomationChrome`, the driver must print
   candidates and stop before opening Chrome.
5. During normal service processing, the driver may only use a marker tab in the
   saved normal Chrome profile. It must never create or use
   `~/.image-arranger/<service>-chrome`,
   `~/.image-arranger/<service>-profiles/*`, temporary `--user-data-dir`, a CDP
   automation profile, an unspecified default Chrome profile, or Codex image
   generation.
   This restriction is for browser/profile startup, not for tabs inside the
   selected normal profile. ChatGPT and Vidu must both use the common
   `scripts/service-browser-route.mjs` profile-safe marker setup route. If that
   route cannot use the already-running selected profile, stop and report the
   exact saved profile instead of probing or opening other profiles.
6. A new service driver may add page-specific upload, submit, download, and
   registration logic only after this shared profile guard has passed.
   If any of that page logic must differ by operating system, create separate
   macOS and Windows route files first and keep the service driver as the
   coordinator.
7. On Windows ChatGPT and Vidu runs, the shared profile guard must use
   `extensions/chrome-bridge` plus `scripts/chrome-bridge-host.mjs`; if the
   bridge extension is not connected from the saved profile, stop before service
   work begins. The first successful check binds the extension client id and
   extension id into the saved profile config; after that, commands must go only
   to that bound extension client. Before the first bind, the selected email
   must be unique in Chrome `Local State`; if multiple profiles use the same
   email, stop instead of guessing. ChatGPT attach/send/save on Windows must use
   that same bound bridge tab.

The old Vidu generated-profile startup and the old ChatGPT CDP automation
startup are rejected routes, not templates. Do not copy them into new services.
The `open -a "Google Chrome" ... --profile-directory=...` pattern is also a
rejected startup route because a running multi-profile Chrome can open the URL in
the wrong profile.

## Approved Route

Common route:

1. Use the Codex in-app browser only for the local image-arranger app:
   `http://127.0.0.1:4217/`.
2. Run `node scripts/process-service-queue.mjs --dry-run --server
   http://127.0.0.1:4217` to see which service driver will handle each target.
3. Run `node scripts/process-service-queue.mjs --server
   http://127.0.0.1:4217` to process supported targets. Do not call the
   ChatGPT or Vidu driver directly unless you are debugging that driver.

ChatGPT route:

1. Use external Chrome only for ChatGPT generation and download.
2. The external Chrome profile must be selected with
   `node scripts/process-service-queue.mjs --setup-profile --service chatgpt`
   before ChatGPT queue processing. The selection is local-only and saved under
   `workspace/.local/chatgpt-profile.json`, which is ignored by git.
3. If that Chrome profile is already running, do not launch another Chrome or
   Chromium instance for the same profile.
4. When using Codex browser tools directly, select the Chrome extension backend
   explicitly with `agent.browsers.list()`. Use the backend whose
   `metadata.profileName` matches the saved profile. Do not use the default
   `extension` backend blindly. The ChatGPT driver performs the equivalent local
   profile check from Chrome `Local State` and does not launch Chrome.
5. Use one ChatGPT work tab with a marker URL that includes
   `agent-work=image-arranger`, `profile-directory`, and `profile-email` for the
   saved profile. Reuse that tab for the whole queue attempt. The marker URL is
   only a locator; it is not proof that the tab belongs to the selected Chrome
   profile. Before attaching files, inserting prompts, sending, or saving, the
   script must activate the tab, open `chrome://version` in the same Chrome
   window, and verify the reported Profile Path ends with the saved
   `profile-directory`. A window name may be recorded as extra diagnostics, but
   it is not the primary proof. If a matching marker URL exists in a non-matching
   Chrome profile, treat it as wrong-profile and refuse to operate it. If the
   marker is missing, prepare it through a profile-safe setup/repair route in the
   already-running selected profile, then rerun the check. Do not repair by
   typing or opening the marker URL in the current/front Chrome window, and do
   not launch a second browser instance for the same profile.
6. Attach each reference image through the approved route for the current OS:
   - on macOS, set the system clipboard to the PNG file with `osascript` as
     `«class PNGf»`, activate the marked ChatGPT tab, focus the composer, and
     send a real `Cmd+V` through System Events
   - if that macOS PNG paste does not produce the expected ChatGPT attachment
     chip/thumbnail, retry once by script in the same marker tab by passing the
     exact local file into ChatGPT's existing browser `input[type=file]` and
     dispatching normal `input`/`change` events. This is a same-profile
     file-input fallback, not a CDP `fileChooser.setFiles` route and not a manual
     operator step.
   - on Windows, use the Chrome bridge to inject the image as a browser `File`
     into the prepared bound marker tab
   - wait until ChatGPT shows the uploaded image chip/thumbnail
7. Insert the prompt with page-context `document.execCommand("insertText", false,
   prompt)` or another verified normal text-entry path. Verify the full prompt is
   present, then wait for the visible send button to become enabled before
   sending. A verified prompt with a disabled send button usually means the
   reference image is still being accepted by ChatGPT.
8. If the active ChatGPT Pro-mode model is failing image generation, run the
   common entrypoint with `--image-model 高` or set
   `IMAGE_ARRANGER_IMAGE_MODEL=高`. The driver attempts to select the matching
   model before sending each target. If the model picker cannot be used, this is
   reported as a warning and the driver continues with the current model; do not
   treat picker failure as permission to switch browser profiles or services.
9. Send through the visible ChatGPT composer, wait for generation to finish, save
   the result through the normal ChatGPT image UI, then report completion through
   `POST /api/requests/complete`.
   If ChatGPT stays on `思考中` / `より詳細な画像を生成中です` until the local
   timeout, with no generated image, no policy refusal, and no saved output, treat
   that target as not completed. Confirm the request is still pending, restore or
   recreate the marker tab in the same approved profile, rerun `--check`, and
   retry the same target from the queue. Do not advance to the paired target or
   to Vidu until the first target has a saved ChatGPT image registered.
10. On Windows, process ChatGPT image queues through the same bound Chrome bridge
   route used by preflight. Do not switch to `Start-Process chrome`, a generated
   profile, Codex image generation, file chooser fallback, or virtual clipboard.

Vidu route:

1. Use Vidu only for video `generate` targets whose service is `vidu`, mode is
   `video`, or `inputs.startFrame` / `inputs.endFrame` is present.
2. Run `node scripts/process-service-queue.mjs --check --service vidu --server
   http://127.0.0.1:4217` before processing Vidu targets. This delegates to the
   Vidu driver and checks that the Vidu create page is usable.
3. Before any Vidu check or processing run, configure the Vidu profile with
   `node scripts/process-service-queue.mjs --setup-profile --service vidu`.
   The local selection is saved under `workspace/.local/vidu-profile.json`, which
   is ignored by git. If this file is missing or no longer matches Chrome `Local
   State`, the Vidu driver must list candidates and stop before opening Chrome.
4. Vidu uses only the selected normal Chrome profile recorded in that config.
   Do not use an unspecified default profile, a generated
   `~/.image-arranger/vidu-*` profile, or the rejected
   `~/.image-arranger/agent-chrome` profile. The check must use a Vidu marker
   tab in the selected profile, such as `kaminokuresse@gmail.com` / `ユーザー 1`;
   if the marker is missing, stale, logged out, or unusable, use the common
   profile-safe marker setup route in the already-running selected profile. If
   that route fails, stop. Do not use the Google Chrome executable with
   `--profile-directory=<dir>`, `open -a "Google Chrome" ... --profile-directory=...`,
   or any equivalent profile-switching startup path, and do not choose another
   Vidu profile as routine recovery. The Vidu marker URL must include
   `profile-email`; a `profile-directory=Default` marker without email is not
   enough.
5. Provide `inputs.startFrame`; `inputs.endFrame` may be omitted for start-only
   Vidu generation. Vidu processing does not use the ChatGPT reference-image
   paste route.
6. The Vidu driver injects one start file or two start/end files into the
   existing Vidu marker tab as real browser `File` objects. For one-frame
   requests, it uploads only the start file to the first image input. For
   two-frame requests, it uploads start and end files to separate first/second
   frame inputs. It must not duplicate one start image into both frame slots.
   Then it sets the target prompt, optionally sets
   `inputs.durationSec`, submits through the visible Vidu create button, waits
   for one generated result, saves the MP4 into `outputDir`, and reports
   completion through `POST /api/requests/complete`.
7. If Vidu visibly shows an active upload or generation task in the current
   create/upload area, the driver stops before submitting anything. Treat
   `アップロード中`, disabled create controls with generation wording, active
   upload previews, or an unmistakable current task panel as "work is already in
   flight". Do not stop only because an older history item or the full page body
   contains `処理中` from a previous prompt; inspect the current form state before
   blocking. Do not start the same cut again until a true current task has
   finished or failed.
8. If Vidu visibly shows a non-zero credit cost, the driver stops unless the
   operator intentionally reruns with `--allow-paid`. Do not bypass this by
   switching service, browser profile, or generation tool.

## macOS Successful Route Evidence

The successful 2026-06-27 ChatGPT run used this macOS-specific flow. Keep these
details for macOS regressions, but do not treat them as a Windows fallback. On
Windows, ChatGPT must use the bound Chrome bridge route described above.

1. `curl -s http://127.0.0.1:4217/api/requests` found
   `req_20260627103340_379d378d` / `targetIndex: 0`.
2. The required Chrome profile was the locally selected profile from
   `workspace/.local/chatgpt-profile.json`.
3. The reference image was pasted with real macOS clipboard as PNG and verified
   in ChatGPT as `ファイル 1 を削除：image(109).png`.
4. The prompt was inserted with page-context `document.execCommand`. `innerText`
   included extra visual paragraph breaks, so verification used normalized
   `innerText` plus start/end checks before sending.
5. The prompt was sent with the visible composer focused and a real Return key.
6. ChatGPT created the conversation
   `https://chatgpt.com/c/6a3faf23-2bec-83e8-8af6-f2fc559843f8`.
7. The generated image was identified by a generated-image alt text, not by the
   uploaded `image(109).png` reference image.
8. The generated image was opened, the full-screen top `保存` button was clicked,
   and Chrome downloaded:
   `/Users/kiyogon/Downloads/ChatGPT Image 2026年6月27日 20_16_21.png`.
9. The file was copied to the target output directory and completed through
   `/api/requests/complete`; the API response registered:
   - source asset `asset-image-fishing_kiyogon-01f45d9a`
   - transparent asset `asset-image-fishing_kiyogon-307f847b`
10. A later hardening pass confirmed two script requirements: browser-side code
    must be UTF-8 decoded before `eval`, and send tracking must stay on the
    marker tab until it becomes the new conversation URL.

These details are not optional alternatives for the macOS route. They are not a
replacement for the Windows bridge route.

## Rejected Routes

These routes were tested on 2026-06-27 and must not be used for this operator's
image-arranger queues:

- `scripts/process-queue.mjs` / CDP automation Chrome. It uses the dedicated
  `~/.image-arranger/agent-chrome` profile rather than the locally selected
  Chrome profile, and it failed login in this environment. The script is
  disabled and must not be re-enabled for queue processing.
- `open -a "Google Chrome" ... --profile-directory=...` service startup. In a
  running multi-profile Chrome, it can place the URL in the wrong profile.
- Windows `start chrome`, PowerShell `Start-Process chrome`, or any equivalent
  profile-directory launch. It has the same wrong-profile failure mode.
- Vidu's old implicit `~/.image-arranger/vidu-chrome` or generated
  `~/.image-arranger/vidu-profiles/*` startup. It launches a browser that was not
  the selected normal Chrome profile. Vidu must use the profile saved by
  `--setup-profile --service vidu` or stop before opening Chrome.
- Chrome/CDP file chooser / `fileChooser.setFiles`. It failed with
  `Not allowed`. This does not prohibit the macOS same-profile browser
  file-input fallback described above.
- Browser tab virtual clipboard PNG paste via `tab.clipboard.write`. It dropped
  the Chrome extension pipe with `native pipe closed before response`.
- Codex built-in image generation, screenshots, placeholder files, direct blob
  extraction, browser cache extraction, or any non-ChatGPT substitute.

## Stop Conditions

Stop and leave the request pending, or mark it `error` with the real failure
reason, when any of these happens:

- the saved Chrome profile is unavailable or cannot be confirmed
- the ChatGPT tab redirects to `/auth/login`
- the OS-specific ChatGPT reference attach step does not show an uploaded image
  chip/thumbnail
- the full prompt cannot be verified in the composer before sending
- the visible ChatGPT UI refuses, errors, or never produces a downloadable result
- the Vidu create page is logged out or not usable
- a Vidu target is missing `inputs.startFrame`
- Vidu does not expose a downloadable MP4 result

Do not switch routes after a stop condition.
