# image-arranger Hero 2min workflow and review gates

Generated: 2026-06-20

## Operator-locked intent

- Produce a short, always-moving Hero demo based on `/Users/macstudio/Downloads/image_arranger_2min_hero_video_detailed_plan.md`.
- Product proof must use real `http://127.0.0.1:4217/` image-arranger screens.
- Use the required reference URL exactly: `https://x.com/fishing_kiyogon/status/2065218662689349934?s=20`.
- Do not use mock product UI, recreated product UI, rejected/old composites, or synthetic product screens.
- `Aichanなし` means no separately composited presenter Aichan. Aichan that naturally appears inside the 4217 product screen as the scrollbar/edge guide is product UI and is allowed unless it covers the proof target.
- AI reviews are bug reports inside the operator-approved plan. They must not rewrite duration, CTA, scene order, or required sources without operator approval.

## Production workflow

1. Story/source lock
   - `src/video-hero-2min.manifest.json` is the shot-source map for timing, captions, narration text, real screen/video assets, allowed public text, product URL, repo, and required X URL.
   - Public captions are whitelist-only through `copyLock.publicCaptions`.

2. Real-screen asset lock
   - Product UI layers are copied into `public/assets/captures/` by `scripts/prepare-assets.mjs`.
   - `s01` was changed away from a synthetic chaos board; it now uses real 4217 screens only.
   - `s04-source-copy` uses the real X page capture and a manifest-driven focus box for the "リンクをコピー" menu item.

3. Audio generation
   - `../audio/generate_hero_2min_downer_audio.py` generates `hero-2min-narration-timed.wav`.
   - Voice engine: `/Users/macstudio/Developer/Style-Bert-VITS2-Mac`.
   - Voice model: `downer`.
   - Pronunciation-risk cues are locked as reviewed WAV files under `../audio/locked-cues/`; the generator copies those files instead of regenerating them nondeterministically.
   - `downer.zip` is recorded as the requested source but is not currently present at `/Users/macstudio/Downloads/downer.zip`; the installed Style-Bert model is used.

4. Render
   - `npm run render-hero`
   - Output: `../../06-final/hero-2min/image-arranger-hero-2min-v1.mp4`
   - Current SHA-256: `65ae98cd774c2a9cf6f0d72fb0ac61f4cc86b0d4799355e59f9067bcc7409fdf`

## Review gates

1. Copy/source lock
   - Command: `npm run validate-hero-copy-lock`
   - Fails on missing exact X URL, missing 4217 product URL, unapproved public captions, rejected chaos/mock strings, or CTA hard-coding that bypasses the manifest.

2. Type/render smoke
   - Command: `npx tsc --noEmit`
   - Key stills are generated with `npx remotion still src/index.ts ImageArrangerHero2Min ...`.
   - Red/focus boxes must be checked as stills before full render.

3. MP4-derived review stills
   - Command: `npm run hero-review-stills`
   - Review sheets:
     - `../../06-final/hero-2min/review-stills/scene-contact-sheet.png`
     - `../../06-final/hero-2min/review-stills/operation-flow-contact-sheet.png`
   - Stills must be generated from the encoded MP4, not directly from Remotion frames, so the reviewed proof matches the deliverable.

4. Hero QC
   - Command: `npm run qc-hero`
   - Produces:
     - `../../06-final/hero-2min/qc/hero-qc-manifest.json`
     - `../../06-final/hero-2min/qc/hero-1s-contact-sheet.jpg`
     - `../../06-final/hero-2min/qc/hero-url-flow-1s-contact-sheet.jpg`
     - `../../06-final/hero-2min/qc/public-layer-internal-text-scan.txt`
     - `../../06-final/hero-2min/qc/freeze-qa-map.md`
   - Current result: copy scan PASS, internal-text scan PASS, audio timing PASS, freeze QA PASS.

5. Hero ASR pronunciation gate
   - Command: `npm run qc-hero-asr`
   - Produces:
     - `../../06-final/hero-2min/qc/audio-asr/faster-whisper-small-ja-encoded-hero.txt`
     - `../../06-final/hero-2min/qc/audio-asr/pronunciation-summary-hero.md`
   - Current result: PASS.
   - `image-arranger` must be represented by `イメージアレンジャー` in the narration source.
   - `URL` and `Codex` may appear in ASR output as Latin text when the source narration is `ユーアールエル` / `コーデックス`; the ASR summary records this as an orthography note, not an automatic pronunciation failure.
   - The ASR gate must fail review-blocking meaning breaks such as `急に入り`, `クロンプ`, `プロンプトプン`, `最余マーク`, and `修行画像`.

6. Independent professional review
   - Run contextless reviewers for:
     - producer/pacing/story impact;
     - real-screen authenticity, red-frame alignment, URL proof, internal text;
     - Japanese copy/audio pronunciation.
   - Reviewer PASS does not override operator intent. Reviewer changes that alter approved duration, CTA, source requirements, or storyboard require operator approval.

## Current manual visual review notes

- The real product edge Aichan visible in some 4217 captures is accepted as product UI.
- `Aichanなし rough` means no separately composited presenter Aichan; the 4217 scrollbar/edge guide Aichan is allowed when it is part of the captured product UI and does not cover the proof target.
- The URL flow now shows the real X post, link-copy focus, URL pasted into image-arranger, queue row, prompt/result storage, and improvement flow.
- The product input may normalize the URL display to `x.com/...`, but the current MP4 also shows the exact locked URL with `https://` and `?s=20` in the real product prompt/detail proof.
- The red focus box on `s04-source-copy` was corrected after still review because the first coordinate included character art; it now targets the "リンクをコピー" menu item only.
- The old public caption `Gallery → Queue → Detail` was removed; the current manifest uses `ギャラリー → キュー → 詳細`.
- Narration was regenerated after Japanese/audio review so `image-arranger` is read as `イメージアレンジャー`, `Codex` as `コーデックス`, and the improvement line avoids the previous ASR close miss around `再生成`.
- Final encoded-video ASR now passes required terms: `イメージアレンジャー`, `URL`, `コーデックス`, `キュー`, `プロンプト`, and `採用済みマーク`.
- Final CTA uses manifest-sourced copy and repo text.
