#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const manifestPath = join(projectDir, "src/video-hero-2min.manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const outputRoot = resolve(projectDir, "../../06-final/hero-2min/review-stills");
const defaultVideo = resolve(projectDir, "../../06-final/hero-2min/image-arranger-hero-2min-v1.mp4");
const video = resolve(process.argv[2] ?? defaultVideo);
const ffmpeg = process.env.FFMPEG || "/opt/homebrew/bin/ffmpeg";
const ffprobe = process.env.FFPROBE || ffmpeg.replace(/ffmpeg$/, "ffprobe");
const fps = manifest.fps;

if (!existsSync(video)) {
  throw new Error(`Review still source MP4 is missing: ${video}`);
}

const videoSha256 = sha256File(video);
const probe = probeVideo(video);
const records = [];

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(join(outputRoot, "scene"), { recursive: true });
mkdirSync(join(outputRoot, "operation-flow"), { recursive: true });
mkdirSync(join(outputRoot, "aichan-no-cover"), { recursive: true });

renderTargetGroup(
  "scene",
  manifest.reviewTargets.sceneSeconds.map((second) => [`${beatFor(second)?.id ?? "scene"}-${second.toFixed(1)}s`, second]),
  "scene",
);
renderTargetGroup(
  "operation-flow",
  manifest.reviewTargets.operationSeconds.map((second) => [`${beatFor(second)?.id ?? "operation"}-${second.toFixed(1)}s`, second]),
  "operation-flow",
);
renderTargetGroup(
  "aichan-no-cover",
  manifest.reviewTargets.aichanNoCoverSeconds.map((second) => [`aichan-${second.toFixed(1)}s`, second]),
  "aichan-no-cover",
);

buildSheet(join(outputRoot, "scene"), join(outputRoot, "scene-contact-sheet.png"), 4);
buildSheet(join(outputRoot, "operation-flow"), join(outputRoot, "operation-flow-contact-sheet.png"), 4);
buildSheet(join(outputRoot, "aichan-no-cover"), join(outputRoot, "aichan-no-cover-contact-sheet.png"), 4, { allowEmpty: true });

const sourceHash = sha256Text(
  [
    readFileSync(join(projectDir, "src/ImageArrangerHero2Min.tsx"), "utf-8"),
    readFileSync(manifestPath, "utf-8"),
    readFileSync(join(projectDir, "scripts/render-hero-review-stills.mjs"), "utf-8"),
  ].join("\n---source-boundary---\n"),
);

writeFileSync(
  join(outputRoot, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      generatedFrom: "mp4",
      sourceVideo: relative(outputRoot, video),
      sourceVideoBasename: basename(video),
      video_sha256: videoSha256,
      review_stills_video_sha256: videoSha256,
      source_commit_or_tree_hash: sourceHash,
      ffmpeg,
      ffprobe,
      probe,
      fps,
      frameCount: probe.frameCount,
      durationSec: probe.durationSec,
      stills: records,
    },
    null,
    2,
  ) + "\n",
  "utf-8",
);

console.log(`Wrote Hero MP4-derived review stills to ${outputRoot}`);
console.log(`video_sha256=${videoSha256}`);

function renderTargetGroup(category, targets, dirName) {
  targets.forEach(([label, second], index) => {
    const frame = Math.round(second * fps);
    const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "-");
    const output = join(outputRoot, dirName, `${String(index + 1).padStart(3, "0")}-${safeLabel}-f${frame}.png`);
    renderStillFromMp4(second, output);
    records.push({
      category,
      label,
      second,
      frame,
      file: relative(outputRoot, output),
      sourceVideoFrame: frame,
      extractionMethod: "ffmpeg-fast-seek-mp4-timestamp",
      generatedFrom: "mp4",
      videoSha256,
    });
  });
}

function renderStillFromMp4(second, output) {
  execFileSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", "-ss", second.toFixed(3), "-i", video, "-frames:v", "1", output],
    { cwd: projectDir, stdio: "inherit" },
  );
}

function buildSheet(inputDir, output, columns, options = {}) {
  const count = readdirSync(inputDir).filter((name) => name.endsWith(".png")).length;
  if (count === 0 && options.allowEmpty) {
    writeFileSync(output.replace(/\.png$/, ".txt"), "No stills in this category for the current rough.\n", "utf-8");
    return;
  }
  if (count === 0) {
    throw new Error(`No PNG stills found in: ${inputDir}`);
  }
  const rows = Math.ceil(count / columns);
  execFileSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-pattern_type",
      "glob",
      "-i",
      join(inputDir, "*.png"),
      "-vf",
      `scale=480:-1,tile=${columns}x${rows}:padding=8:margin=8:color=white`,
      "-frames:v",
      "1",
      output,
    ],
    { cwd: projectDir, stdio: "inherit" },
  );
}

function beatFor(second) {
  return manifest.visualBeats.find((beat) => second >= beat.startSec && second < beat.endSec);
}

function probeVideo(input) {
  const result = spawnSync(
    ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-count_frames",
      "-show_entries",
      "stream=width,height,r_frame_rate,avg_frame_rate,duration,nb_frames,nb_read_frames",
      "-of",
      "json",
      input,
    ],
    { encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(`${ffprobe} failed: ${result.stderr}`);
  }
  const stream = JSON.parse(result.stdout).streams?.[0] ?? {};
  const durationSec = Number(stream.duration) || manifest.durationSec;
  const frameCount = Number(stream.nb_read_frames || stream.nb_frames) || Math.round(durationSec * fps);
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    durationSec,
    rFrameRate: stream.r_frame_rate,
    avgFrameRate: stream.avg_frame_rate,
    frameCount,
  };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}
