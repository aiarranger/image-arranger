# X Thread Draft (EN)

Target: X / English launch thread
Primary link: https://github.com/aiarranger/image-arranger?utm_source=x&utm_medium=social&utm_campaign=launch-en
LP link: https://aiarranger.jp/image-arranger/?utm_source=x&utm_medium=social&utm_campaign=launch-en
Media slot: attach the Aichan overview GIF from `docs/assets/marketing/image-arranger-overview-en.gif` to post 1.

## Thread

1. I built a tool for the part of AI image generation that generators do not manage: references, candidates, adopted assets, and queued requests.  
   It is called image-arranger.  
   [video]

2. It deliberately does not generate.  
   You keep using ChatGPT, Midjourney, Vidu, ComfyUI, or whatever you already like. image-arranger writes request files; a human or coding agent processes them in the normal service UI.

3. The core flow is: Create kit -> Base -> Image -> Video -> Queue.  
   Pick adopted references, queue one deliverable per request, register the result as a candidate, then adopt only the assets that pass your review.

4. For character work, Create kit can queue a request for a canonical reference sheet from adopted images, then decompose a sheet into face / outfit / accessory references for part-level fixes. It is a workflow manager, not another model wrapper.

5. The app itself is local-first, zero runtime dependencies, Node.js 20+.  
   The sample deck and demo agent let you run the full loop without external accounts. Use two terminals:
   Terminal 1: `npm start`
   Terminal 2: `npm run demo-agent`

6. OSS, MIT licensed. If your generation workflow has outgrown folders of PNGs and a spreadsheet, I would love feedback.  
   GitHub: https://github.com/aiarranger/image-arranger?utm_source=x&utm_medium=social&utm_campaign=launch-en

## Notes

- Post 1 is the hook; attach the Aichan overview GIF there.
- Use the LP link when replying to non-technical readers.
- Avoid claiming Windows/Linux scripted processing is fully tested; README says the server is cross-platform, the scripted processor is macOS-tested with Windows/Linux paths present but untested.
