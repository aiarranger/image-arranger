#!/usr/bin/env node
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const packageRoot = resolve(projectDir, "../..");
const publicDir = join(projectDir, "public/assets");
const captureDir = join(packageRoot, "04-captures/real-screen-v6");
const presenterDir = join(packageRoot, "03-assets/images/presenter-v6");
const audioDir = join(packageRoot, "05-edit/audio");

const captures = [
  "x-v6-final-source-page.png",
  "x-addressbar-exact-url-selected-public-clean.png",
  "x-copy-menu-open.png",
  "x-link-copy-handoff-clean.mp4",
  "4217-create-open-empty-public-crop.png",
  "4217-draft-request-row-public-crop.png",
  "4217-v6-post-draft-generation-agent-copied.png",
  "4217-v6-post-draft-generation-detail-open.png",
  "4217-v6-final-image-tab-before-new.png",
  "chatgpt-v6-before-send-public-crop.png",
  "chatgpt-v6-reply-public-crop.png",
  "4217-v6-generated-alpha-card-filtered-public-clean.png",
  "4217-registered-modal-public-crop.png",
  "4217-base-overview.png",
  "4217-base-face.png",
  "4217-base-outfit.png",
  "4217-base-expression.png",
  "4217-base-parts.png",
  "4217-retry-reject.png",
  "4217-retry-queued-detail.png",
  "4217-retry-adopted-public-crop.png",
  "4217-retry-corrected-public-crop.png",
  "4217-video-queued-detail.png",
  "vidu-submitted-form-public-crop.png",
  "vidu-result-player-public-crop.png",
  "4217-video-returned-player-motion.mp4",
  "4217-video-managed-detail-public-crop.png",
  "focus-preflight/url-input-scroll-proof-clean.mp4",
  "focus-preflight/url-input-exact-value.png",
  "focus-preflight/x-link-copy-menu-item.png",
  "focus-preflight/queue-row-public-clean.png",
  "focus-preflight/prompt-drafted-public-clean.png",
  "focus-preflight/registered-url-scroll-proof-clean.mp4",
  "focus-preflight/registered-result-image-public-clean.png",
  "focus-preflight/registered-prompt-source-public-clean.png",
  "focus-preflight/retry-improve-action.png",
  "focus-preflight/retry-adopted-state.png",
  "focus-preflight/video-start-frame.png",
  "focus-preflight/video-end-frame.png",
  "focus-preflight/vidu-submitted-prompt-field.png",
  "focus-preflight/vidu-create-submit-button.png"
];

const presenters = [
  "aichan-v6-part-point-left.png",
  "aichan-v6-part-point-right.png",
  "aichan-v6-point-prompt.png",
  "aichan-v6-point-url-field.png",
  "aichan-v6-pull-returned-result.png",
  "aichan-v6-retry-reaction.png",
  "aichan-v6-retry-success-point.png",
  "aichan-v6-video-frame-point.png",
  "aichan-v6-wave-cta.png",
  "aichan-v6-x-peek-pull.png"
];

const audios = ["v6-narration-timed.wav", "hero-2min-narration-timed.wav", "continuity-bed.wav"];

rmSync(publicDir, { recursive: true, force: true });
mkdirSync(join(publicDir, "captures"), { recursive: true });
mkdirSync(join(publicDir, "presenter"), { recursive: true });
mkdirSync(join(publicDir, "audio"), { recursive: true });

const copied = [];
for (const file of captures) {
  copy(join(captureDir, file), join(publicDir, "captures", file));
}
for (const file of presenters) {
  copy(join(presenterDir, file), join(publicDir, "presenter", file));
}
for (const file of audios) {
  copy(join(audioDir, file), join(publicDir, "audio", file));
}

writeFileSync(
  join(publicDir, "asset-copy-manifest.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    rule: "Only approved v6 real-screen captures, presenter-v6 PNGs, v6/hero narration WAVs, and continuity-bed.wav are copied for Remotion.",
    copied
  }, null, 2) + "\n"
);

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied.push({
    from: from.replace(packageRoot + "/", ""),
    to: to.replace(projectDir + "/", ""),
    basename: basename(to)
  });
}
