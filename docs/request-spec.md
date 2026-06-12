# Request File Specification — `image-arranger-request.v1`

This is the stable, supported contract of image-arranger. The server never calls a
generation service; it only writes request files and reads completion reports.
Everything else — the bundled ChatGPT driver in `scripts/`, the manual browser
procedure, your own service driver — is a replaceable processor that sits on top of
this contract.

If you build a processor, target **this document**, not any particular script.

- **Schema id:** `image-arranger-request.v1`
- **Written by:** `server.mjs` (`buildRequest`, the analyze builder, and the
  auto-queued generation after a `draft-prompt`).
- **Location:** `<workspace>/requests/<requestId>.json`, one file per request.
- **Read/updated by:** the completion API (`POST /api/requests/complete`),
  `cancel`, and `update`, or by editing the file directly while the server is
  stopped.

## Path conventions

All file paths inside a request (`outputDir`, `inputs.refImages`, `inputs.startFrame`,
`inputs.endFrame`, `inputs.sourceAsset`, and `results[].file`) are **POSIX-style paths
relative to the server's project root**, not the workspace.

- The project root defaults to the image-arranger install directory (the folder that
  contains `server.mjs`). It can be overridden with `--project-root`.
- A typical `outputDir` therefore looks like `workspace/demo/outputs/<characterId>`.
- `GET /api/requests` returns the absolute `projectRoot` so a processor can resolve these
  relative paths to absolute ones on disk.

A processor should resolve every relative path against `projectRoot` before reading or
writing files.

## Request object

```jsonc
{
  "schema": "image-arranger-request.v1",
  "requestId": "req_20260611T120000_a1b2c3d4",
  "status": "requested",
  "character": "sample-character",
  "characterName": "Sample Character",
  "mode": "image",
  "service": "chatgpt",
  "targets": [ /* see Target object */ ],
  "requestedAt": "2026-06-11T12:00:00.000Z",
  "completedAt": null,
  "note": "image-arranger writes this request only. ..."
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `schema` | string | Always `"image-arranger-request.v1"`. |
| `requestId` | string | Unique id, e.g. `req_<UTC-compact>_<8 hex>`. Stable; use it (plus `targetIndex`) to address a target. |
| `status` | string | Request-level rollup: `"requested"`, `"completed"`, `"error"`, or `"cancelled"`. Recomputed from target statuses by the server. |
| `character` | string | Owning character id. |
| `characterName` | string | Display name of the character at request time. |
| `mode` | string | `"image"`, `"video"`, or `"kit"` (analyze requests) — the tab/workflow the request came from. |
| `service` | string | The single service shared by all targets (`"chatgpt"`, `"vidu"`, …), or `"mixed"` if targets differ. |
| `targets` | array | One entry per deliverable (see below). |
| `requestedAt` | string | ISO 8601 timestamp when the request was written. |
| `completedAt` | string \| null | ISO 8601 timestamp set when no `requested` targets remain; otherwise `null`. |
| `note` | string | Human-readable reminder that the server only writes the request. Informational. |
| `updatedAt` | string | ISO 8601 timestamp of the last completion or update write. Added on the first completion/update mutation (not set by cancel-only). |

## Target object

A target is one deliverable. **One target = one deliverable** — never produce grids,
contact sheets, or A/B variants for a single target.

```jsonc
{
  "action": "generate",
  "entryId": "img-portrait",
  "assetId": null,
  "assetName": null,
  "assetFile": null,
  "overview": "Portrait, front view",
  "prompt": "full body character design sheet, ...",
  "referenceUrl": null,
  "basePrompt": "",
  "improvementPrompt": "",
  "inputs": { "startFrame": null, "endFrame": null, "refImages": ["workspace/demo/assets/face.png"] },
  "outputDir": "workspace/demo/outputs/sample-character",
  "service": "chatgpt",
  "status": "requested",
  "results": []
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `action` | string | `"generate"` (default), `"improve"`, `"analyze"`, or `"draft-prompt"`. See actions below. |
| `entryId` | string | The base/image/video entry this target belongs to. |
| `assetId` | string \| null | For `improve`/`analyze`: the source asset's id. |
| `assetName` | string \| null | Display name of the source asset (improve). |
| `assetFile` | string \| null | Source asset's stored file path (improve). |
| `overview` | string | Short human title for the deliverable. |
| `prompt` | string | The generation/analysis prompt. Use it **as-is**. |
| `referenceUrl` | string \| null | For `draft-prompt`: the external reference (X post, article, gallery) the prompt should be written from. |
| `basePrompt` | string | The entry's original prompt, carried for context (improve). |
| `improvementPrompt` | string | The improvement intent (improve). |
| `inputs` | object | Input files to attach (see below). |
| `outputDir` | string \| null | Where to save results, relative to `projectRoot`. `null` for `analyze` targets (they produce JSON, not a file). |
| `service` | string | Target service (`"chatgpt"`, `"vidu"`, …). |
| `status` | string | `"requested"`, `"completed"`, `"error"`, or `"cancelled"`. |
| `results` | array | Filled on completion: `[{ "file": "<relative path>", ... }]`. |
| `completedAt` / `erroredAt` / `cancelledAt` | string | Set by the server when the status changes. |
| `errorMessage` | string | Present when `status` is `"error"`. |
| `draftedPrompt` / `draftedOverview` | string | Stored on a completed `draft-prompt` target. |
| `analysisParts` | array | Stored on a completed `analyze` target (parsed part prompts). |

> **Status value:** the canonical completed value written by the server is
> `"completed"`. If you hand-edit a file as a fallback, prefer `"completed"`; the
> server also stops treating a target as pending once it is no longer `"requested"`.

### `inputs` sub-object

| Field | Type | Meaning |
|-------|------|---------|
| `refImages` | string[] | Files to attach to the generation/analysis. These are the user's adopted identity references (or, for improve, the source plus references). Attach **only** these; do not add other candidates. |
| `startFrame` | string \| null | Video: the start-frame image path. |
| `endFrame` | string \| null | Video: the end-frame image path. |
| `durationSec` | number | Video: requested clip length in seconds. |
| `sourceAsset` | string \| null | Improve: the primary asset being improved. |

## Actions

Process a target only when both the request `status` and the target `status` are
`"requested"`. Never process a `"cancelled"` target.

- **`generate`** (or missing `action`) — produce one new image or video. Attach
  `inputs.refImages`, save into `outputDir`, register the result as a candidate asset,
  then report completion. For video, also pass `inputs.startFrame` / `inputs.endFrame`
  / `inputs.durationSec`.
- **`improve`** — regenerate from an existing asset. Treat `inputs.sourceAsset` /
  `assetFile` as the primary reference and follow `improvementPrompt`.
- **`analyze`** — base-kit analysis. **No image is generated.** The deliverable is JSON
  (`{ "character": "...", "parts": [{ "key", "label", "category", "prompt" }] }`);
  report it via the `parts` payload below. The server materializes one base entry per
  part.
- **`draft-prompt`** — the user supplies only `referenceUrl` and delegates prompt
  writing. Write one prompt (and a short title), report it via the `prompt`/`overview`
  payload below. The server imports the prompt into the entry and **auto-queues a normal
  `generate` request** for it (the new id is returned in `draftQueued`).

## Completion API — `POST /api/requests/complete`

Reports one or more target completions while the server is running. The body may be a
single target (top-level fields) or `{ "targets": [ ... ] }` for a batch. A target is
addressed either by `requestId` + `targetIndex`, or by `entryId` (+ `assetId` for
improve/analyze).

Common envelope:

```jsonc
{ "requestId": "<id>", "targetIndex": 0, /* one of the payloads below */ }
```

### Payload by deliverable

- **`results`** — generated/improved files (generate, improve, video):

  ```bash
  curl -X POST http://127.0.0.1:4217/api/requests/complete \
    -H "Content-Type: application/json" \
    -d '{"requestId": "<id>", "targetIndex": 0, "results": [{"file": "<saved path>"}]}'
  ```

  Each result is `{ "file": "<path relative to projectRoot>", ... }`. Extra keys (e.g.
  `assetId`) are preserved.

- **`parts`** — analysis result (analyze). `parts` is the analysis JSON (or its `parts`
  array):

  ```bash
  curl -X POST http://127.0.0.1:4217/api/requests/complete \
    -H "Content-Type: application/json" \
    -d '{"requestId": "<id>", "targetIndex": 0, "parts": <analysis JSON>}'
  ```

- **`prompt`** (+ optional `overview`) — drafted prompt (draft-prompt). The server
  imports the title/prompt and returns the auto-queued generation id in `draftQueued`:

  ```bash
  curl -X POST http://127.0.0.1:4217/api/requests/complete \
    -H "Content-Type: application/json" \
    -d '{"requestId": "<id>", "targetIndex": 0, "overview": "<short title>", "prompt": "<prompt>"}'
  ```

- **`error`** — report a failure instead of a result. The target becomes `"error"`:

  ```bash
  curl -X POST http://127.0.0.1:4217/api/requests/complete \
    -H "Content-Type: application/json" \
    -d '{"requestId": "<id>", "targetIndex": 0, "error": "<what failed>"}'
  ```

The response includes `{ ok, completed, errored, kitResultsStored, draftQueued,
kitResults, requests, state }`.

### Cancel and update

- `POST /api/requests/cancel` — body `{ "targets": [{ requestId, targetIndex }] }` (or
  by `entryId`); sets matching `requested` targets to `"cancelled"`.
- `POST /api/requests/update` — body `{ requestId, targetIndex, prompt?,
  improvementPrompt? }`; rewrites a target's prompt before it is processed (e.g. to
  reword a refused prompt) and mirrors the change into the deck where applicable.

### Offline fallback

If you cannot reach the server, edit `requests/<id>.json` directly: set the target
`status` to `"completed"`, fill `results` (or `analysisParts` / `draftedPrompt`), and
update the request `status` when no `"requested"` targets remain. (Single-writer rule:
do not edit a workspace from two processes at once.)

## Compatibility promise

- The meaning of existing **`image-arranger-request.v1`** fields will not change.
- Changes are **additive only**: new optional fields may appear; a processor must
  ignore unknown fields and tolerate absent optional fields.
- A breaking change would ship under a new schema id (`...request.v2`), and the old
  schema would keep working for already-written files.

Write processors defensively: read by `schema`, default missing optional fields, and
never assume a field that this document marks as conditional.

## Writing a service driver

The bundled ChatGPT driver is the reference implementation. Its reusable primitives are
exported from [`scripts/agent-browser.mjs`](../scripts/agent-browser.mjs); the orchestration
that ties them to the request contract lives in
[`scripts/process-queue.mjs`](../scripts/process-queue.mjs).

For the smallest end-to-end example, read [`scripts/demo-agent.mjs`](../scripts/demo-agent.mjs)
(`npm run demo-agent`): a zero-dependency driver that exercises the whole contract without any
browser automation — poll `GET /api/requests`, produce a deliverable (here: a locally rendered
placeholder PNG), register it via `POST /api/assets`, report `POST /api/requests/complete`.
Replace the placeholder step with real generation and you have a new service driver.

To drive a new service, fetch `GET /api/requests`, filter targets you can handle, and for
each one reproduce: attach `inputs.refImages`, set `prompt`, send, wait for the result,
save into `outputDir`, then POST the completion. The exported primitives you can reuse or
mirror:

| Export | Purpose |
|--------|---------|
| `DEFAULTS` | CDP port (`9377`), automation Chrome profile dir, chat URL. |
| `ensureChrome({ cdpPort, profileDir, log })` | Launch (or reuse) the dedicated automation Chrome with its own profile + CDP port — it never touches the user's main browser. |
| `openChat({ cdpPort, chatUrl })` / `openPage(url)` / `closePage(page)` | Open/close a tab driven over CDP. |
| `checkLogin(page)` | Detect logged-in vs logged-out state from the header. |
| `attachImages(page, files)` | Set the page's `input[type=file]` to the reference files and wait for thumbnails. |
| `setPrompt(page, prompt)` | Insert the prompt into the composer and verify the text landed. |
| `sendMessage(page)` | Click send and wait for the composer to clear. |
| `waitForImageReply(page, { onTick })` | Poll until a finished image (or an error) appears. |
| `downloadImage(page, src, destination)` | Save the result bytes to disk (fetch → canvas tiers). |
| `evaluate(page, expr)` / `waitFor(page, expr)` | Low-level page evaluation helpers. |
| `RunLog` | Writes `log.md` + `events.jsonl` + numbered screenshots into one `agent-logs/run-*/` folder per run. |

A complete driver for a new service is typically a couple hundred lines on top of these
primitives — selectors and result detection are the only service-specific parts. Because
the driver is optional, you can always process requests by hand (see
[manual-fallback.md](manual-fallback.md)) or with your own tooling against this contract.
