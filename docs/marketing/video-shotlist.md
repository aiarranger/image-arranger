# Demo-Video Shot List (45s)

Origin: Round 2 research (2026-06-12), every shot verified against actual code paths
(app.js / server.mjs). Record at 1080p, cursor-led, one beat per shot; JA UI with EN
captions (or two renders — the header language toggle makes a second-language take cheap).

> Status update (2026-06-13): the five capability gaps the original research flagged
> (G1 no live refresh / G2 no arrival celebration / G3 no before-after compare /
> G4 sample deck can't film / G5 weak terminal beat) are **all resolved** — live queue
> polling with arrival toast + "new" ring, A/B compare slider in the entry modal,
> sample deck v2 (Aoi, all tabs alive, pre-seeded queue), `npm run demo-agent`
> for deterministic 3-second turnarounds, and Phase 5 queue/quality UX assists.
> Every shot below is now filmable as written.
> Line references are as of 2026-06-12 and may have drifted; treat them as starting points.

| # | t | Shot | Real flow (code confirmation) |
|---|---|------|-------------------------------|
| 1 | 0:00–0:03 | Cold open: app boots, skeleton → grid fades in; title card "Your AI asset pipeline, local-first" | `node server.mjs` → `loadDeck()`; first-paint skeleton in index.html |
| 2 | 0:03–0:09 | Create kit: click 2 source images (selection rings), Route A "シート生成を依頼" → fly-to-queue, queue pill bumps | `[data-kit-source-asset]` toggle, `#sheetQueueBtn` → `requestSheetGeneration()` → `enqueueTargets` |
| 3 | 0:09–0:14 | Queue tab: purple pulsing "キュー登録済み" card → click "依頼文コピー" (button morphs ✓) → paste into a terminal running Claude Code/Codex (split screen) | queue render, `[data-copy-agent]` → `agentPromptFor` |
| 4 | 0:14–0:20 | Time-lapse beat: Queue card explains the wait with "依頼作成済み → 処理待ち → 候補登録 → 採用判断" and the request-file → agent → candidate mini diagram; **app updates by itself** — badge flips to done, arrival toast, thumbnail lands with a "new" ring | queue flow panel in `renderQueue()` / `pendingQueueRow()`; agent → `POST /api/requests/complete`; livePoll picks it up within 5s. For deterministic takes use `npm run demo-agent` |
| 5 | 0:20–0:27 | Image tab: open entry modal, flip between candidates, check 採用 → heart pop, ADOPTED chip transfers from old candidate | `openEntryModal` thumbs `data-show-asset`, `#entryModalAdoptShown` → `setAdopted` |
| 6 | 0:27–0:33 | Improve loop: click "この画像を改善", tap a quality-gate issue chip or direction chip, queue → fly-to-queue again. Payoff: quality issue becomes a targeted improve prompt, then A/B compare slider on the improved result | `[data-edit-improve-asset]` → `openAsset`, `renderImproveChips()` issue buttons, `#queueImproveAsset` / issue chip → `improveTarget`; Compare control in the entry modal |
| 7 | 0:33–0:38 | Video tab: sample video entry already has start/end frames wired (sample deck v2); show frame pickers, duration 8s, queue | entry form `formFramePicker`, `requestTarget` video branch |
| 8 | 0:38–0:43 | Gallery: cascade entrance, pan, click-burst on the hero image | `#galleryBtn` → gallery.html cascade |
| 9 | 0:43–0:45 | End card over LP: repo URL + `node server.mjs` one-liner | docs/index.html hero |

Optional inserts if a longer cut is wanted: Cmd+K palette jump (Raycast-style beat),
first-run tour coach marks, drag-drop / Cmd+V paste registration, PNG metadata
auto-import filling a prompt on upload.
