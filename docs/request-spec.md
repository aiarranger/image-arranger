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
- A typical `outputDir` therefore looks like `workspace/sample/outputs/<characterId>`.
- `GET /api/requests` returns the absolute `projectRoot` so a processor can resolve these
  relative paths to absolute ones on disk.

A processor should resolve every relative path against `projectRoot` before reading or
writing files.

## Headless request-file drop

The server and processors discover work from the request directory. A human, script, or
headless integration may create a spec-compliant JSON file directly at
`<workspace>/requests/<requestId>.json`; the Queue view and `GET /api/requests` will pick
it up as long as the request and target statuses are `"requested"` and the referenced
character/entry still exists in the deck.

When writing files directly, follow the single-writer rule: do not edit the same
workspace concurrently from multiple processes. Prefer `POST /api/requests` while the
server is running; use direct file drop for simple integrations, tests, or offline
handoff.

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
| `mode` | string | `"image"`, `"video"`, `"kit"`, or `"base"` — the tab/workflow the request came from. Analyze requests are normally `"kit"`; per-part base generation can be `"base"`. |
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
  "inputs": { "startFrame": null, "endFrame": null, "refImages": ["workspace/sample/assets/face.png"] },
  "outputDir": "workspace/sample/outputs/sample-character",
  "service": "chatgpt",
  "qualityGate": {
    "enabled": true,
    "mode": "compare-if-visible",
    "maxAttempts": 3,
    "requiredParts": [
      {
        "entryId": "base-accessory-horns",
        "category": "accessory",
        "overview": "Horns",
        "prompt": "canonical horn description",
        "file": "workspace/sample/assets/horns.png",
        "visibilityRule": "compare-if-visible"
      }
    ]
  },
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
| `service` | string | Target service (`"chatgpt"`, `"vidu"`, …). Optional on older/custom request files; processors should fall back to the request-level `service` when absent. |
| `qualityGate` | object \| null | Optional important-generation check. When enabled, processors should inspect the generated candidate before completion and compare only visible matching parts against `requiredParts`. Missing/hidden/cropped-out parts are not failures. See below. |
| `status` | string | `"requested"`, `"completed"`, `"error"`, or `"cancelled"`. |
| `results` | array | Filled on completion: `[{ "file": "<relative path>", ... }]`. |
| `completedAt` / `erroredAt` / `cancelledAt` | string | Set by the server when the status changes. |
| `errorMessage` | string | Present when `status` is `"error"`. |
| `qualityReport` | object | Optional completion record written by a processor when `qualityGate` was evaluated. |
| `draftedPrompt` / `draftedOverview` | string | Stored on a completed `draft-prompt` target. |
| `analysisParts` | array | Stored on a completed `analyze` target (parsed part prompts). |

> **Status value:** the canonical completed value written by the server is
> `"completed"`. If you hand-edit a file as a fallback, prefer `"completed"`; the
> server also stops treating a target as pending once it is no longer `"requested"`.

### `inputs` sub-object

| Field | Type | Meaning |
|-------|------|---------|
| `refImages` | string[] | Files to attach to the generation/analysis. These are the user's adopted identity references (or, for improve, the source plus references). Attach **only** these; do not add other candidates. |
| `startFrame` | string \| null | Video: the required start-frame image path. |
| `endFrame` | string \| null | Video: the optional end-frame image path. Leave null for start-only image-to-video generation. |
| `durationSec` | number | Video: requested clip length in seconds. |
| `sourceAsset` | string \| null | Improve: the primary asset being improved. |

### `qualityGate` sub-object

`qualityGate` is optional and additive. Processors that do not support it may ignore
it; supported processors should apply it before reporting completion.

| Field | Type | Meaning |
|-------|------|---------|
| `enabled` | boolean | `true` means this target should be checked before completion. |
| `mode` | string | Currently `"compare-if-visible"`. |
| `maxAttempts` | number | Maximum total generation attempts for this quality loop. Default UI value is `3`; the server and bundled processors clamp to `1`-`10`. |
| `requiredParts` | array | Canonical base/part references to compare against. Each item carries `entryId`, `category`, `overview`, `prompt`, `file`, and `visibilityRule`. |

Important: this check is **not** a required-presence test. A part is allowed to be
absent, hidden, cropped out, or too small to identify. It fails only when the candidate
visibly contains the same kind of part/feature and that visible part is materially
different from the canonical reference.

### `qualityReport` completion object

When a processor evaluates `qualityGate`, include a `qualityReport` beside `results` or
`error` in `POST /api/requests/complete`. The server stores it on the target without
interpreting the shape, but processors should prefer this schema for interoperability:

```jsonc
{
  "enabled": true,
  "mode": "compare-if-visible",
  "maxAttempts": 3,
  "passed": true,
  "skipped": false,
  "summary": "Passed on attempt 2",
  "parts": [
    {
      "entryId": "base-accessory-horns",
      "category": "accessory",
      "overview": "Horns",
      "prompt": "canonical horn description",
      "file": "workspace/sample/assets/horns.png",
      "visibilityRule": "compare-if-visible"
    }
  ],
  "attempts": [
    {
      "attempt": 1,
      "file": "workspace/sample/outputs/sample-character/attempt-1.png",
      "ok": false,
      "summary": "Visible horn silhouette drifted",
      "parts": [],
      "issues": [
        { "entryId": "base-accessory-horns", "summary": "Horns are rounded instead of sharp" }
      ]
    },
    {
      "attempt": 2,
      "file": "workspace/sample/outputs/sample-character/attempt-2.png",
      "ok": true,
      "summary": "Visible parts match"
    }
  ]
}
```

If no comparable parts were present, set `skipped: true` and explain that in `summary`.
If generation fails or the quality gate exhausts attempts, send the completion payload
with `error` plus `qualityReport.passed: false` and, if useful, `qualityReport.error`.

## Actions

Process a target only when both the request `status` and the target `status` are
`"requested"`. Never process a `"cancelled"` target.

- **`generate`** (or missing `action`) — produce one new image or video. Attach
  `inputs.refImages`, save into `outputDir`, optionally run `qualityGate` if present,
  register the passing result as a candidate asset, then report completion. For video,
  also pass `inputs.startFrame`, optional `inputs.endFrame`, and `inputs.durationSec`.
- **`improve`** — regenerate from an existing asset. Treat `inputs.sourceAsset` /
  `assetFile` as the primary reference and follow `improvementPrompt`.
- **`analyze`** — base-kit analysis. **No image is generated.** The deliverable is JSON
  (`{ "character": "...", "parts": [{ "key", "label", "category", "prompt" }] }`);
  report it via the `parts` payload below. The server stores the parsed parts on the
  completed target and exposes them as Create kit import results; the operator chooses
  which parts become base entries.
- **`draft-prompt`** — the user supplies only `referenceUrl` and delegates prompt
  writing. Write one prompt (and a short title), report it via the `prompt`/`overview`
  payload below. The server imports the prompt into the entry and **auto-queues a normal
  `generate` request** for it (the new id is returned in `draftQueued`).

## Read APIs

- `GET /api/state` returns the bare deck state object, not an `{ ok, ... }` envelope.
  This is the fastest inspection endpoint for tests, agents, and UI bootstrapping.
- `GET /api/requests` returns `{ ok, projectRoot, requests }`, where `requests` is the
  flattened list of request targets whose request and target status are both
  `"requested"`. Rows include `existsInDeck`; processors should normally handle rows
  with `existsInDeck: true` and surface or skip stale rows where the source entry no
  longer exists.
- `GET /api/quality-reports` returns `{ ok, qualityReports }`, a flattened read model
  of completed/error targets that carry `target.qualityReport`. This is additive UI
  state for timelines and repair suggestions; it does not change the request-file
  schema or processor completion payload.

## Asset registration API — `POST /api/assets`

Registers a generated file as a candidate asset on an existing entry. The file must
already exist under the server's `projectRoot`; the server copies it into the workspace
asset directory and returns the new deck asset.

```bash
curl -X POST http://127.0.0.1:4217/api/assets \
  -H "Content-Type: application/json" \
  -d '{
    "characterId": "<character id>",
    "entryId": "<entry id>",
    "sourceFile": "workspace/sample/outputs/sample-character/result.png",
    "name": "result",
    "prompt": "<prompt that produced the file>",
    "adopted": false,
    "aiGenerated": true,
    "humanReviewed": false,
    "sourceLicense": "",
    "usageNotes": ""
  }'
```

| Field | Type | Meaning |
|-------|------|---------|
| `characterId` | string | Owning character id. |
| `entryId` | string | Existing base/image/video entry to receive the candidate. |
| `sourceFile` | string | Project-root-relative path to an existing `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.mp4`, or `.webm` file. Absolute paths are rejected. Current max size is 80 MiB. |
| `name` | string | Display name and destination filename stem. The server de-duplicates on copy. |
| `prompt` | string | Prompt/provenance text to store on the asset. |
| `adopted` | boolean | Whether to mark the candidate adopted immediately. Processors should use `false` unless the user explicitly asked for auto-adoption. |
| `aiGenerated` | boolean | Provenance flag for publish/doctor checks. |
| `humanReviewed` | boolean | `true` only after a human has reviewed the asset. |
| `sourceLicense` | string | Optional license/source note. |
| `usageNotes` | string | Optional review or processing note. |
| `reference` | boolean | Optional; when `true`, the asset is tagged `source-reference`. Normal generated candidates should omit this. |

Response shape:

```jsonc
{ "ok": true, "asset": { "id": "asset-...", "file": "workspace/sample/assets/..." }, "state": { /* deck */ } }
```

The usual generate/improve flow is: save one file into `outputDir`, then call
`POST /api/requests/complete` with `results: [{ "file": "<same relative path>" }]`.
On completion, the server registers the original result as a candidate asset if it
is not already registered. For PNG image results, it also creates a second
transparent candidate tagged `background-removed`, stores a review composite, and
adds `assetId`, `transparentAssetId`, `transparentFile`, and
`backgroundRemovalReviewFile` back onto `results[]`.

Processors may still call `POST /api/assets` first when they want immediate
candidate registration or custom provenance. In that case, include the returned
`asset.id` as `results[].assetId` when reporting completion; the completion API will
reuse the existing original asset and only add the transparent derivative.

## Asset background removal API — `POST /api/assets/remove-background`

Creates a transparent PNG candidate from an existing PNG asset without modifying the
source asset. The endpoint is intended for local quality-controlled cutouts: it writes
both the transparent candidate and a review composite that places the result over
multiple backgrounds for visual inspection before adoption.

The source asset file must be an existing registered PNG inside the workspace
`assets/` or `outputs/` directory. Request bodies cannot override the `rembg`
binary path or execution timeout; use `IMAGE_ARRANGER_REMBG_BIN` for a trusted local
binary outside the default lookup path.

The same background-removal pipeline is also used automatically for PNG generation
results reported through `POST /api/requests/complete`. With `engine: "auto"`,
green chroma-key sheets use the built-in YUV soft matte, while white/light-gray or
natural backgrounds switch to `rembg` (`isnet-anime` by default) when the optional
CLI is available. All engines then remove detached speckles, thin line artifacts,
green/yellow-green edge spill, and white/light-gray edge contamination, then
lightly smooth alpha edges.

```bash
curl -X POST http://127.0.0.1:4217/api/assets/remove-background \
  -H "Content-Type: application/json" \
  -d '{
    "characterId": "<character id>",
    "entryId": "<entry id>",
    "assetId": "<source PNG asset id>",
    "options": { "engine": "auto", "mode": "auto" }
  }'
```

| Field | Type | Meaning |
|-------|------|---------|
| `characterId` | string | Owning character id. |
| `entryId` | string | Existing entry that owns the source asset. |
| `assetId` | string | Existing PNG asset to process. JPEG, WebP, GIF, and video assets are rejected. |
| `options.engine` | string | Optional; `local` uses the built-in color/flood pipeline, `rembg` forces the optional AI matte CLI, and `auto` uses chroma-key locally but tries `rembg` for non-chroma backgrounds. |
| `options.mode` | string | Optional; `auto` detects chroma-key sheets and falls back to edge background removal. `chroma` forces chroma-key removal. |
| `options.rembgModel` | string | Optional; rembg model name. Defaults to `isnet-anime`; `birefnet-general-lite` is a useful fallback for non-anime or mixed images. |

Response shape:

```jsonc
{
  "ok": true,
  "asset": {
    "id": "asset-...",
    "file": "workspace/sample/assets/.../source-transparent.png",
    "adopted": false,
    "humanReviewed": false,
    "tags": ["background-removed"],
    "backgroundRemoval": {
      "sourceAssetId": "<source asset id>",
      "sourceFile": "workspace/sample/assets/.../source.png",
      "reviewFile": "workspace/sample/assets/.../source-transparent-review.png",
      "report": {
        "mode": "chroma-green",
        "engine": "local",
        "removedPixels": 12345,
        "softenedPixels": 234,
        "decontaminatedPixels": 345,
        "fragments": { "removedFragments": 1, "removedPixels": 25 },
        "lineArtifacts": { "removedFragments": 1, "removedPixels": 81 },
        "lightComponents": { "removedFragments": 1, "removedPixels": 35 },
        "residuePixels": 45,
        "rgbBleedPixels": 456,
        "edgeSmoothing": { "adjustedPixels": 789, "expandedPixels": 123, "strength": 0.42 },
        "lightResidue": { "adjustedPixels": 234, "removedPixels": 12 },
        "postSmoothResiduePixels": 34,
        "postSmoothRgbBleedPixels": 456
      }
    }
  },
  "reviewFile": "workspace/sample/assets/.../source-transparent-review.png",
  "report": {
    "mode": "chroma-green",
    "engine": "local",
    "removedPixels": 12345,
    "softenedPixels": 234,
    "decontaminatedPixels": 345,
    "fragments": { "removedFragments": 1, "removedPixels": 25 },
    "lineArtifacts": { "removedFragments": 1, "removedPixels": 81 },
    "lightComponents": { "removedFragments": 1, "removedPixels": 35 },
    "residuePixels": 45,
    "rgbBleedPixels": 456,
    "edgeSmoothing": { "adjustedPixels": 789, "expandedPixels": 123, "strength": 0.42 },
    "lightResidue": { "adjustedPixels": 234, "removedPixels": 12 },
    "postSmoothResiduePixels": 34,
    "postSmoothRgbBleedPixels": 456
  },
  "state": { /* deck */ }
}
```

Generated candidates are intentionally left unadopted and `humanReviewed: false`.
Review the saved composite, then adopt the candidate only if the foreground details
survived the transparency pass.

When background removal is run as automatic post-processing during completion,
each response row includes a `backgroundRemoval` object. If post-processing fails,
`backgroundRemoval.error` contains the reason while the original result asset can
still be registered.

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
  `assetId`) are preserved. For generate/improve targets, the server registers the
  original file as a candidate asset when needed and creates a transparent PNG
  derivative for PNG image results. Set `results[].removeBackground` to `false` to
  skip the transparent derivative for a specific result. A processor may also include
  `qualityReport` alongside `results`; it is stored on the target.

- **`parts`** — analysis result (analyze). `parts` is the analysis JSON (or its `parts`
  array). The response's `kitResultsStored`/`kitResults` fields confirm that the
  parsed parts were stored for Create kit review/import:

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

  A quality-gate failure should be reported as `error` with `qualityReport` describing
  the attempts and visible mismatches.

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

Browser-based service drivers should start from the common queue entrypoint and
shared profile guard:

- [`scripts/process-service-queue.mjs`](../scripts/process-service-queue.mjs)
  dispatches queued targets to supported service drivers.
- [`scripts/service-browser-profile.mjs`](../scripts/service-browser-profile.mjs)
  lists Chrome profile candidates, saves the selected signed-in normal profile,
  verifies saved configs against Chrome `Local State`, and rejects old
  automation-profile configs before any service page is opened.
- [`scripts/service-browser-route.mjs`](../scripts/service-browser-route.mjs)
  is the single tab-control boundary. macOS behavior belongs in
  [`scripts/chrome-route-macos.mjs`](../scripts/chrome-route-macos.mjs) or a
  service-specific `*-route-macos.mjs`; Windows behavior belongs in
  [`scripts/chrome-route-windows.mjs`](../scripts/chrome-route-windows.mjs) or a
  service-specific `*-route-windows.mjs`.
- [`extensions/chrome-bridge`](../extensions/chrome-bridge) plus
  [`scripts/chrome-bridge-host.mjs`](../scripts/chrome-bridge-host.mjs) provide
  the Windows tab-control route. The extension must be installed in the selected
  signed-in Chrome profile and connected to the local host before service work
  begins.

Do not add a new browser driver that silently launches an unspecified default
profile, a generated `~/.image-arranger/<service>-chrome` profile, a generated
`~/.image-arranger/<service>-profiles/*` profile, or a temporary
`--user-data-dir`. Do not launch Chrome with `--profile-directory` from a service
driver; a running multi-profile Chrome can place the URL in the wrong profile.
If the profile is not configured, the driver must stop before touching the
service page. If the required service marker tab is missing, prepare it through a
profile-safe setup/repair route in the already-running selected profile, then
rerun the check; do not launch a second browser instance or switch profiles.
Marker URLs must include `agent-work`, `profile-directory`, and `profile-email`;
service drivers must reject marker commands that omit any of those fields. A
directory name alone is not a sufficient profile proof when multiple Chrome
profiles can each have a `Default` directory.

To drive a new service, fetch `GET /api/requests`, filter targets you can handle, and for
each one reproduce the request contract: attach `inputs.refImages` for image
targets or `inputs.startFrame` plus optional `inputs.endFrame` for image-to-video targets, set
`prompt`, send, wait for exactly one result, save into `outputDir`, then POST the
completion. Add only the service-specific page actions after the shared profile guard.
The Vidu driver follows this normal-profile route end to end for MP4 results.
The legacy CDP queue driver
(`scripts/process-queue.mjs`) is disabled and is not a template for new browser
drivers. Because the driver is optional, you can always process
requests by hand (see [manual-fallback.md](manual-fallback.md)) or with your own
tooling against this contract.
