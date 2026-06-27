# Launch FAQ Draft

## Does image-arranger generate images?

No. That is intentional. image-arranger manages references, prompts, candidates, adopted assets, and queued request files. Actual generation happens in the service or tool you already use.

## Why not call a generation API directly?

Keeping generation external makes the tool service-agnostic and local-first. The stable interface is the request file: a human, coding agent, or custom driver can process it.

## How is this different from ComfyUI?

ComfyUI is a generation graph/tool. image-arranger is the workflow layer around generation: canonical references, candidate review, adoption state, request queue, and provenance. They can be used together.

## How is this different from a spreadsheet and folders?

A spreadsheet can describe state, but it does not enforce it. image-arranger stores candidates on entries, tracks which asset is adopted, resolves linked references at queue time, and keeps request/result lifecycle in one place.

## How is this different from Eagle or a DAM?

Digital asset managers organize files. image-arranger is built around generation prompts, queued requests, reference links, adopted candidates, and one-deliverable target processing.

## Can I use Midjourney / ChatGPT / Vidu / local models?

Yes. The app writes request files and stores reference paths. You can process the request wherever you generate. The optional scripted processor currently targets ChatGPT image generation, but the request contract is service-neutral.

## Is my data sent anywhere?

The server and UI are local. Workspace data lives on disk. The app itself does not call generation services. If you use an external generation service or optional automation driver, that service sees whatever you provide to it.

## What OSes are supported?

The server runs anywhere Node.js 20+ runs. The optional scripted processor uses Node.js 22+ and Chrome/Chromium; it is macOS-tested and designed to be cross-platform, but Windows/Linux need more real-world feedback. The manual keystroke fallback is macOS-only.

## Why Node.js 20+?

The app is a small local server and static UI. Node.js 20+ gives a modern baseline while keeping runtime dependencies at zero.

## Can I use it without a coding agent?

Yes. Queue a request, generate manually in your preferred UI, save the result, and register it as a candidate asset in image-arranger. The matching pending request is completed automatically for normal generate targets.

## What does "adopted" mean?

A candidate is an asset attached to an entry. Adopted means "this is the approved/current reference." Future requests resolve linked references to the adopted asset.

## What is Create kit?

Create kit helps build a reusable character identity kit. Route A queues a canonical reference sheet from adopted images. Route B analyzes a sheet/image into per-part references, then imports selected parts into Base.

## Why include a color palette?

Optional palette references can help reduce color drift in character sheets. When adopted, a palette can be attached alongside normal image references as color guidance.

## Is this production-ready?

It is an early OSS release. The request-file contract is intended to be stable, but broader scripted-driver platform coverage and community workflows need feedback.

## Can I contribute a driver for another service?

Yes. Start with `docs/request-spec.md`. A useful driver should read queued request files, produce exactly one real deliverable per target in the intended service, register assets, and report completion.
