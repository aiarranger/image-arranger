# dev.to / Show HN Draft (EN)

Target: dev.to article; can be shortened into a Show HN post.
Primary link: https://github.com/aiarranger/image-arranger?utm_source=devto&utm_medium=article&utm_campaign=launch-en
LP link: https://aiarranger.jp/image-arranger/?utm_source=devto&utm_medium=article&utm_campaign=launch-en
Media slots:
- Hero: Aichan base references from `docs/assets/base/aichan_design.png`
- Inline: workflow diagram from `docs/assets/readme/workflow.svg`
- Inline: Queue result candidate screenshot

## Title

I built image-arranger, a local-first request manager for AI image/video generation

## Article

AI image workflows tend to outgrow the generator UI.

At first, the history panel is enough. Then you start caring about which face is canonical, which outfit candidate was approved, which prompt created a useful variant, which image should be used as the start frame for a video, and what is still waiting to be generated.

That layer is usually a spreadsheet plus folders of PNGs.

I built **image-arranger** for that layer.

It is a local-first prompt and asset request manager for AI image and video generation. The important bit: it deliberately **does not generate**. It writes request files. You, or a coding agent, process those requests in the normal UI of the generation service you already use.

So the tool is not a model wrapper. It is an outbox and reference manager.

## What it manages

The tab order is the workflow:

- Create kit: queue a request for a canonical character sheet from adopted references, or decompose an existing sheet into per-part references.
- Base: manage canonical face / outfit / accessory / background references.
- Image: queue one image deliverable per prompt.
- Video: queue image-to-video requests with start and end frames.
- Queue: review pending request JSON, copy agent instructions, cancel, edit, or complete requests.
- Gallery: see adopted images across the deck.

Every generated result comes back as a candidate asset. You adopt only the ones that pass review. Adopted assets become the references for future requests.

## Why not generate directly?

Because people already have generation tools they like: ChatGPT, Midjourney, Vidu, ComfyUI, local models, and whatever comes next.

image-arranger keeps the stable part stable: the request contract.

A queued request is just JSON with a prompt, reference image paths, output directory, service, and target action. A human can process it by hand. A coding agent can process it. A custom driver can process it. The app itself never needs your generator credentials and never calls a generation API.

## Try it locally

```bash
git clone https://github.com/aiarranger/image-arranger.git
cd image-arranger
npm start
```

Open `http://127.0.0.1:4217/` and inspect the sample deck. The Queue starts empty; it contains work only after you explicitly queue a request. To complete a request, process it in your real generation service or with a real service driver, then register the resulting file.

## Design constraints

- Local-first: workspaces live on disk.
- Zero runtime dependencies.
- Node.js 20+ for the server.
- Stable request-file contract: `image-arranger-request.v1`.
- Strictly one deliverable per queue target.
- Generation services remain external.

The optional scripted processor can drive ChatGPT image generation through a dedicated automation Chrome profile. It requires Node.js 22+ and Chrome/Chromium; it is macOS-tested, with Windows/Linux intended but needing more real-world feedback. It is optional, replaceable, layered on top of the request contract, and comes with the usual "review the service terms first" warning.

## Who it is for

It may help if your workflow currently involves folders named `final_final_3`, a spreadsheet of prompts, and manual notes about which character reference is still valid.

It is probably not for you if you want one-click API generation inside the tool. That is intentionally outside the product.

GitHub:
https://github.com/aiarranger/image-arranger?utm_source=devto&utm_medium=article&utm_campaign=launch-en

Landing page:
https://aiarranger.jp/image-arranger/?utm_source=devto&utm_medium=article&utm_campaign=launch-en

## Show HN Variant

> HN convention: clean URLs, no UTM parameters.

Title: Show HN: image-arranger, a local-first request manager for AI image generation

Body:

I built image-arranger for the management layer around AI image/video generation: canonical references, candidate assets, adopted images, queued request JSON, and provenance.

It deliberately does not generate. You keep using ChatGPT, Midjourney, Vidu, ComfyUI, etc. image-arranger writes request files that a human, coding agent, or custom driver can process, then registers results as candidates for review/adoption.

It is local-first, zero runtime dependencies, Node.js 20+, MIT licensed, and ships with a sample deck whose queue starts empty until you explicitly create work.

GitHub: https://github.com/aiarranger/image-arranger
