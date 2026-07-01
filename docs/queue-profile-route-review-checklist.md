# Queue Profile Route Review Checklist

Use this checklist when changing or validating ChatGPT/Vidu queue browser
routing. The goal is to prove that the implementation uses the saved normal
Chrome profile, not a generated profile, a wrong profile, or a service-specific
shortcut.

## Review Scope

Review these areas together:

- `scripts/service-browser-profile.mjs`
- `scripts/service-browser-route.mjs`
- `scripts/chrome-route-macos.mjs`
- `scripts/chrome-route-windows.mjs`
- `scripts/chatgpt-route-macos.mjs`
- `scripts/chatgpt-route-windows.mjs`
- `scripts/process-chatgpt-profile-queue.mjs`
- `scripts/process-vidu-queue.mjs`
- `scripts/real-browser-profile-route-test.mjs`
- `docs/queue-profile-route-test-plan.md`
- `skills/image-arranger-queue-processing/SKILL.md`

## Strictness Checklist

| Area | PASS condition |
| --- | --- |
| Shared startup | ChatGPT and Vidu enter through `scripts/process-service-queue.mjs`; service drivers do not add their own Chrome startup route. |
| Saved profile | Drivers read `workspace/.local/<service>-profile.json`, verify `profileDir`, `profileName`, and `email` against Chrome `Local State`, and stop on stale or duplicate visible profile names. |
| No generated profile | Drivers refuse `~/.image-arranger/agent-chrome`, old Vidu generated profiles, temporary `--user-data-dir`, CDP automation profiles, and unspecified default Chrome profiles. |
| macOS proof | macOS route does not open `chrome://version`; it uses the marker URL plus Chrome window profile label. |
| Marker repair | Missing marker repair creates/refinds only inside the already-running saved profile; it stops if refind fails or the marker is closed during repair. |
| Wrong profile | A matching marker URL in a non-matching profile is a mismatch, not a usable tab. |
| ChatGPT attach/send | macOS ChatGPT attach/send goes through `runChromeTabJsByUrlPart(..., profile)` and must not scan all Chrome windows with only `URL contains markerPart`. |
| ChatGPT attachments | The expected attachment count must match exactly; delayed paste plus fallback must not silently produce duplicate attachments. |
| ChatGPT old history | Generated-image save uses a pre-send baseline and must not choose an old conversation image. |
| ChatGPT completion | Completion is accepted only after a non-empty output file is copied and the completed target is no longer queued. |
| Rate limit | Visible ChatGPT rate-limit wording stops preflight before attach/send unless a dismiss button is clicked and the wording disappears; retry checks are 30-minute watcher checks. |
| Vidu start-only | One-image Vidu requests upload exactly one file into the first image input and leave the second frame slot empty. |
| Vidu start/end | Two-image Vidu requests require distinct files/content; same path or same SHA-256 is rejected before paid submit. |
| Vidu active task | Visible current upload/generation in the create area blocks submit; old history text alone does not. |
| Vidu stale history | Visible old result videos are recorded as baseline and excluded from current result detection. |
| Vidu paid cost | Raw create-button numbers are treated as paid cost; submit requires `--allow-paid`, env approval, or local `"allowPaid": true`. |
| Vidu result | Saved MP4 is large enough, checked for duplicate SHA, records start-frame RMSE, and completes only after save/validation. |
| Real browser | `npm run test:real-browser-route` operates on the already-running saved normal Chrome profile and does not launch a temporary Chrome while normal Chrome is open. |
| Live service | ChatGPT/Vidu live `--check` pass against the saved normal profile without submitting generation. |
| Real generation | At least one ChatGPT image smoke and one Vidu start-only video smoke complete through the queue and register results. |
| Cleanup | No `ia-real-browser`, `agent-chrome`, `vidu-chrome`, or rejected `.image-arranger` user-data-dir process remains. |

## 2026-07-01 Review Outcome

Four independent review passes were used before the final retest:

| Reviewer focus | Initial verdict | Required fix |
| --- | --- | --- |
| Browser/profile route | FAIL | Real browser test was title-dependent; ChatGPT attach/send bypassed shared route. |
| ChatGPT queue behavior | FAIL | Attachment count, old generated-image baseline, save/download, and completion checks were too weak. |
| Vidu queue behavior | FAIL | Start-only/start-end validation, paid-cost helper tests, stale URL keying, and duplicate start/end rejection were missing. |
| End-to-end procedure | FAIL | Docs had `Default`-fixed live-check startup and no persistent strictness review artifact. |

All four findings were addressed before the final validation run.

## Final Validation Evidence

Commands that must pass after any future route change:

```bash
npm run check
npm test
npm run test:real-browser-route
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217 --service chatgpt --check --ensure-tab
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217 --service vidu --check
```

The 2026-07-01 smoke generation evidence:

| Service | Request | Output | Verification |
| --- | --- | --- | --- |
| ChatGPT | `req_20260630154750_2aa50e2d` | `workspace/sample/outputs/service-smoke/image-arranger-route-smoke-keyframe-after-profile-route-fix-chatgpt-20260701-005006.png` | `1672x941`, SHA-256 `1ceef55d87850bb345e5e44af2a2883c8dc2317a80d38273b312d40d0b2a3e03`, target completed and registered |
| Vidu | `req_20260630155040_2366dc73` | `workspace/sample/outputs/service-smoke/ia-smoke-vidu-20260630150215-20260630-155049.mp4` | `1920x1080`, `24fps`, `4.041667s`, SHA-256 `b9f23b29ba5ae90bf7265fd074799f99699c159b7a3391692abeb95579af27e7`, `blackdetect` no output, RMSE `0.107872`, target completed and registered |

Queue and cleanup evidence for the same run:

- `GET /api/requests` returned `requestCount: 0`.
- Residue scan returned `residueCount: 0` for `ia-real-browser`, `agent-chrome`, `vidu-chrome`, and rejected `.image-arranger` user-data-dir processes.
