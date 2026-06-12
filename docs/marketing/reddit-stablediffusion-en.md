# Reddit Draft (r/StableDiffusion, EN)

Target: r/StableDiffusion
Primary link: https://github.com/aiarranger/image-arranger
Media slot: attach demo GIF/video if subreddit rules and flair allow it.

## Suggested Title

I made a local-first tool for managing references, candidates, and generation request files

## Post Body

Hi everyone. I built a small OSS tool called **image-arranger** for the workflow around image/video generation.

It is not a generator and it does not call any model API. The idea is to manage the parts that usually end up in folders and spreadsheets:

- which character/reference image is canonical
- which generated candidates were adopted
- what prompt produced which asset
- what is still queued
- which reference images should be attached to the next request
- start/end frames for image-to-video requests

The app writes request JSON files. A human can process them manually in whatever service they already use, or a coding agent/custom driver can process them and report completion. Results come back as candidate assets; you adopt only the ones you want to keep using as references.

For character workflows, the Create kit tab can queue a canonical reference sheet from adopted images, then decompose a sheet into per-part references like face, outfit, accessories, and palette when present.

It is local-first, zero runtime dependencies, and runs with Node.js 20+. The repo includes a sample deck and a demo agent that creates local placeholder images, so you can try the loop without any external accounts.

GitHub:
https://github.com/aiarranger/image-arranger

I am especially interested in feedback from people who already have serious reference-image workflows. If you use ComfyUI or local models, this is meant to sit beside that, not replace it.

## Community Fit Notes

- Keep the tone as "I made a tool, feedback welcome", not a launch ad.
- Mention that it does not generate, so expectations are clear.
- If comments ask "why not ComfyUI?", answer that ComfyUI is for generation graphs; image-arranger is for request/reference/candidate lifecycle around any generator.
- Do not overstate Windows/Linux scripted-driver support. Server is cross-platform; optional scripted processor is macOS-tested.
