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
- routes `service: "chatgpt"` image targets to
  `scripts/process-chatgpt-profile-queue.mjs`
- routes `service: "vidu"` video targets to `scripts/process-vidu-queue.mjs`
- for ChatGPT, refuses to run if Google Chrome is not already running
- for Vidu, refuses to open Chrome until the normal Chrome profile has been
  selected and saved locally
- refuses the rejected `~/.image-arranger/agent-chrome` automation profile
- verifies the saved Chrome profile directory, display name, and email against
  Chrome `Local State` before touching ChatGPT
- reuses exactly one already-open ChatGPT marker tab whose URL includes
  `agent-work=image-arranger`, `profile-directory`, and `profile-email` for the
  saved profile
- refuses to create service tabs itself; if the marker tab is missing, it prints
  the exact URL that must be opened in the saved Chrome profile and stops
- attaches references with the real macOS PNG clipboard and real `Cmd+V`
- inserts and verifies the queue prompt before sending
- waits for the visible ChatGPT send button to become enabled after the
  reference upload finishes
- waits for the ChatGPT-generated image
- opens the generated image and clicks the normal ChatGPT `保存` button
- copies the downloaded file into the target `outputDir`
- reports completion through `POST /api/requests/complete`
- for Vidu, injects `inputs.startFrame` and `inputs.endFrame` into the selected
  normal-profile Vidu page, submits through the visible Vidu UI, saves the MP4
  from Vidu's direct result URL or normal download button, and reports completion
  through `POST /api/requests/complete`

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

## Shared Startup Contract for All Services

ChatGPT, Vidu, and any future browser-based generation service must use the same
startup/profile contract. Do not add a service-specific startup path.

1. `--list-profiles` prints Chrome profile candidates from Chrome `Local State`.
2. `--setup-profile --service <service> --profile-choice <n>` saves the selected
   signed-in normal Chrome profile under `workspace/.local/<service>-profile.json`.
3. Normal `--check` and processing runs read that saved config before focusing or
   inspecting any generation-service tab.
4. If the config is missing, stale, unsigned, belongs to a different service, or
   contains `automationChrome` / `viduAutomationChrome`, the driver must print
   candidates and stop before opening Chrome.
5. The driver may only reuse a marker tab that is already open in the saved
   normal Chrome profile. It must never open Chrome, create a new tab, create or
   use `~/.image-arranger/<service>-chrome`,
   `~/.image-arranger/<service>-profiles/*`, temporary `--user-data-dir`, a CDP
   automation profile, an unspecified default Chrome profile, or Codex image
   generation.
6. A new service driver may add page-specific upload, submit, download, and
   registration logic only after this shared profile guard has passed.

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
   saved profile. Reuse that tab for the whole queue attempt. The script must
   not create this tab; if it is missing, it stops and prints the exact URL to
   open in the saved profile.
6. Attach each reference image with the real macOS clipboard route:
   - set the system clipboard to the PNG file with `osascript` as `«class PNGf»`
   - activate the marked ChatGPT tab
   - focus the composer
   - send a real `Cmd+V` through System Events
   - wait until ChatGPT shows the uploaded image chip/thumbnail
7. Insert the prompt with page-context `document.execCommand("insertText", false,
   prompt)` or another verified normal text-entry path. Verify the full prompt is
   present, then wait for the visible send button to become enabled before
   sending. A verified prompt with a disabled send button usually means the
   reference image is still being accepted by ChatGPT.
8. Send through the visible ChatGPT composer, wait for generation to finish, save
   the result through the normal ChatGPT image UI, then report completion through
   `POST /api/requests/complete`.

Vidu route:

1. Use Vidu only for video `generate` targets whose service is `vidu`, mode is
   `video`, or `inputs.endFrame` is present.
2. Run `node scripts/process-service-queue.mjs --check --service vidu --server
   http://127.0.0.1:4217` before processing Vidu targets. This delegates to the
   Vidu driver and checks that the Vidu create page is usable.
3. Before any Vidu check or processing run, configure the Vidu profile with
   `node scripts/process-service-queue.mjs --setup-profile --service vidu`.
   The local selection is saved under `workspace/.local/vidu-profile.json`, which
   is ignored by git. If this file is missing or no longer matches Chrome `Local
   State`, the Vidu driver must list candidates and stop before opening Chrome.
4. Vidu uses the selected normal Chrome profile recorded in that config. Do not
   use an unspecified default profile, a generated
   `~/.image-arranger/vidu-*` profile, or the rejected
   `~/.image-arranger/agent-chrome` profile. The check must reuse a Vidu marker
   tab that is already open in the selected profile, such as
   `kaminokuresse@gmail.com` / `ユーザー 1`; it must not launch Chrome or create
   the tab itself.
5. Provide exactly `inputs.startFrame` and `inputs.endFrame`; Vidu processing
   does not use the ChatGPT reference-image paste route.
6. The Vidu driver injects those two files into the existing Vidu marker tab as
   real browser `File` objects, sets the target prompt, optionally sets
   `inputs.durationSec`, submits through the visible Vidu create button, waits
   for one generated result, saves the MP4 into `outputDir`, and reports
   completion through `POST /api/requests/complete`.
7. If Vidu visibly shows a non-zero credit cost, the driver stops unless the
   operator intentionally reruns with `--allow-paid`. Do not bypass this by
   switching service, browser profile, or generation tool.

## Successful Route Evidence

The successful 2026-06-27 run used this exact flow:

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

These details are not optional alternatives. They are the known-good path to
reproduce.

## Rejected Routes

These routes were tested on 2026-06-27 and must not be used for this operator's
image-arranger queues:

- `scripts/process-queue.mjs` / CDP automation Chrome. It uses the dedicated
  `~/.image-arranger/agent-chrome` profile rather than the locally selected
  Chrome profile, and it failed login in this environment. The script is
  disabled and must not be re-enabled for queue processing.
- `open -a "Google Chrome" ... --profile-directory=...` service startup. In a
  running multi-profile Chrome, it can place the URL in the wrong profile.
- Vidu's old implicit `~/.image-arranger/vidu-chrome` or generated
  `~/.image-arranger/vidu-profiles/*` startup. It launches a browser that was not
  the selected normal Chrome profile. Vidu must use the profile saved by
  `--setup-profile --service vidu` or stop before opening Chrome.
- Chrome file chooser / `fileChooser.setFiles`. It failed with `Not allowed`.
- Browser tab virtual clipboard PNG paste via `tab.clipboard.write`. It dropped
  the Chrome extension pipe with `native pipe closed before response`.
- Codex built-in image generation, screenshots, placeholder files, direct blob
  extraction, browser cache extraction, or any non-ChatGPT substitute.

## Stop Conditions

Stop and leave the request pending, or mark it `error` with the real failure
reason, when any of these happens:

- the saved Chrome profile is unavailable or cannot be confirmed
- the ChatGPT tab redirects to `/auth/login`
- the real clipboard paste does not show an uploaded image chip/thumbnail
- the full prompt cannot be verified in the composer before sending
- the visible ChatGPT UI refuses, errors, or never produces a downloadable result
- the Vidu create page is logged out or not usable
- a Vidu target is missing either `inputs.startFrame` or `inputs.endFrame`
- Vidu does not expose a downloadable MP4 result

Do not switch routes after a stop condition.
