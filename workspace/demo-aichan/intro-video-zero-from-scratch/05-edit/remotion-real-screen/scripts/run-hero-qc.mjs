#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const manifest = JSON.parse(readFileSync(join(projectDir, "src/video-hero-2min.manifest.json"), "utf-8"));
const audioManifestPath = resolve(projectDir, "../audio/hero-2min-narration-manifest.json");
const audioManifest = JSON.parse(readFileSync(audioManifestPath, "utf-8"));
const defaultVideo = resolve(projectDir, "../../06-final/hero-2min/image-arranger-hero-2min-v1.mp4");
const video = resolve(process.argv[2] ?? defaultVideo);
const outDir = resolve(projectDir, "../../06-final/hero-2min/qc");
const ffmpeg = process.env.FFMPEG || "/opt/homebrew/bin/ffmpeg";
const ffprobe = process.env.FFPROBE || ffmpeg.replace(/ffmpeg$/, "ffprobe");

if (!existsSync(video)) {
  throw new Error(`Hero QC source MP4 is missing: ${video}`);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const videoSha256 = sha256File(video);
run("node", ["scripts/validate-hero-public-copy-lock.mjs", "--report", join(outDir, "public-copy-lock-report.txt")], {
  cwd: projectDir,
});
run("node", ["scripts/render-hero-review-stills.mjs", video], { cwd: projectDir });
const reviewManifest = JSON.parse(
  readFileSync(resolve(projectDir, "../../06-final/hero-2min/review-stills/manifest.json"), "utf-8"),
);
if (reviewManifest.review_stills_video_sha256 !== videoSha256) {
  throw new Error(`Review stills SHA mismatch: ${reviewManifest.review_stills_video_sha256} !== ${videoSha256}`);
}

sheet("hero-1s-contact-sheet.jpg", [], "fps=1,scale=320:-1,tile=12x10:padding=6:margin=6:color=white");
sheet("hero-4s-contact-sheet.jpg", [], "fps=1/4,scale=480:-1,tile=6x5:padding=8:margin=8:color=white");
sheet("hero-url-flow-1s-contact-sheet.jpg", ["-ss", "72", "-t", "36"], "fps=1,scale=480:-1,tile=6x6:padding=8:margin=8:color=white");

capture("ffprobe-video.json", [
  ffprobe,
  "-v",
  "error",
  "-show_entries",
  "format=duration:stream=width,height,avg_frame_rate,nb_frames",
  "-of",
  "json",
  video,
]);
capture("volumedetect.txt", [ffmpeg, "-hide_banner", "-y", "-i", video, "-af", "volumedetect", "-f", "null", "-"]);
capture("silencedetect-35db.txt", [
  ffmpeg,
  "-hide_banner",
  "-y",
  "-i",
  video,
  "-af",
  "silencedetect=noise=-35dB:d=0.7",
  "-f",
  "null",
  "-",
]);
capture("silencedetect-45db.txt", [
  ffmpeg,
  "-hide_banner",
  "-y",
  "-i",
  video,
  "-af",
  "silencedetect=noise=-45dB:d=0.7",
  "-f",
  "null",
  "-",
]);
capture("freezedetect.txt", [
  ffmpeg,
  "-hide_banner",
  "-i",
  video,
  "-vf",
  "freezedetect=n=-60dB:d=1",
  "-map",
  "0:v:0",
  "-f",
  "null",
  "-",
]);

const probe = JSON.parse(readFileSync(join(outDir, "ffprobe-video.json"), "utf-8"));
const copyScan = writePublicLayerScan();
const audioQa = writeAudioQa();
const freezeQa = writeFreezeMap();

writeFileSync(resolve(projectDir, "../../06-final/hero-2min/image-arranger-hero-2min-v1.sha256"), `${videoSha256}  ${video}\n`, "utf-8");
writeFileSync(
  join(outDir, "hero-qc-manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      video,
      videoSha256,
      outputDir: outDir,
      reviewStills: "../../06-final/hero-2min/review-stills",
      reviewStillsManifest: "../../06-final/hero-2min/review-stills/manifest.json",
      reviewStillsVideoSha256: reviewManifest.review_stills_video_sha256,
      reviewStillsGeneratedFrom: reviewManifest.generatedFrom,
      probe,
      copyScan,
      audioQa,
      freezeQa,
      checks: [
        "public-copy-lock-report.txt",
        "hero-1s-contact-sheet.jpg",
        "hero-4s-contact-sheet.jpg",
        "hero-url-flow-1s-contact-sheet.jpg",
        "ffprobe-video.json",
        "volumedetect.txt",
        "silencedetect-35db.txt",
        "silencedetect-45db.txt",
        "freezedetect.txt",
        "freeze-qa-map.md",
        "public-layer-internal-text-scan.txt",
        "audio-timing-qc.md",
      ],
    },
    null,
    2,
  ) + "\n",
  "utf-8",
);

console.log(`Wrote Hero QC evidence to ${outDir}`);

function sheet(filename, preInputArgs, vf) {
  run(ffmpeg, [
    "-hide_banner",
    "-y",
    ...preInputArgs,
    "-i",
    video,
    "-vf",
    vf,
    "-frames:v",
    "1",
    "-update",
    "1",
    join(outDir, filename),
  ]);
}

function capture(filename, args) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf-8" });
  writeFileSync(join(outDir, filename), `${result.stdout}${result.stderr}`, "utf-8");
  if (result.status !== 0) {
    throw new Error(`${args.join(" ")} failed with ${result.status}`);
  }
}

function writePublicLayerScan() {
  const bannedPattern = "4190|requestId|/Users|workspace|agent-logs|review|Gate|JSON|debug|public-demo-chaos|which URL did I use";
  const regex = new RegExp(bannedPattern, "i");
  const texts = [
    ...manifest.copyLock.publicCaptions.map((text) => `copyLock.publicCaptions: ${text}`),
    ...manifest.captions.flatMap((caption) => [
      `caption.text: ${caption.text}`,
      caption.sub ? `caption.sub: ${caption.sub}` : null,
    ]).filter(Boolean),
    `repo: ${manifest.copyLock.repo}`,
  ];
  const matches = texts.filter((text) => regex.test(text));
  const result = matches.length ? "FAIL" : "PASS";
  writeFileSync(
    join(outDir, "public-layer-internal-text-scan.txt"),
    [
      "Hero public layer internal-text scan",
      `Generated: ${new Date().toISOString()}`,
      `Banned pattern: ${bannedPattern}`,
      `Result: ${result}${matches.length ? " - matches found" : " - no banned public-layer terms found"}`,
      "",
      matches.length ? "Matches:" : "Matches: none",
      ...matches,
      "",
    ].join("\n"),
    "utf-8",
  );
  return { result, matches };
}

function writeAudioQa() {
  const failures = [];
  const warnings = [];
  const gaps = audioManifest.gapQa?.gaps ?? [];
  if ((audioManifest.cues?.[0]?.startSec ?? 999) > 0.3) {
    failures.push(`Narration starts too late: ${audioManifest.cues[0].startSec}s`);
  }
  for (const gap of gaps) {
    const previousCue = audioManifest.cues.find((cue) => cue.id === gap.previous);
    const boundary = previousCue?.endSec ?? 0;
    const limit = boundary < 30 ? 0.81 : 1.21;
    if (gap.gapSec > limit) {
      failures.push(`Gap ${gap.previous}->${gap.current} is ${gap.gapSec.toFixed(3)}s, limit ${limit.toFixed(2)}s`);
    }
  }
  const lastCue = audioManifest.cues[audioManifest.cues.length - 1];
  if (lastCue.endSec > manifest.durationSec) {
    failures.push(`Narration overruns video: ${lastCue.endSec}s > ${manifest.durationSec}s`);
  }
  if (!audioManifest.voice?.sourceZipExists) {
    warnings.push(`downer.zip was not found at ${audioManifest.voice?.sourceZip}; Style-Bert model '${audioManifest.voice?.model}' was used from ${audioManifest.voice?.engine}.`);
  }
  const result = failures.length ? "FAIL" : "PASS";
  writeFileSync(
    join(outDir, "audio-timing-qc.md"),
    [
      "# Hero Audio Timing QC",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Result: ${result}`,
      `Duration: ${audioManifest.durationSec}s`,
      `Max gap: ${audioManifest.gapQa?.maxGapSec}s`,
      `Voice engine: ${audioManifest.voice?.engine}`,
      `Voice model: ${audioManifest.voice?.model}`,
      `Source zip: ${audioManifest.voice?.sourceZip}`,
      `Source zip exists: ${audioManifest.voice?.sourceZipExists}`,
      "",
      "Warnings:",
      ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- none"]),
      "",
      "Failures:",
      ...(failures.length ? failures.map((failure) => `- ${failure}`) : ["- none"]),
      "",
    ].join("\n"),
    "utf-8",
  );
  return { result, failures, warnings };
}

function writeFreezeMap() {
  const raw = readFileSync(join(outDir, "freezedetect.txt"), "utf-8");
  const starts = [...raw.matchAll(/freeze_start: ([0-9.]+)/g)].map((match) => Number(match[1]));
  const durations = [...raw.matchAll(/freeze_duration: ([0-9.]+)/g)].map((match) => Number(match[1]));
  const ends = [...raw.matchAll(/freeze_end: ([0-9.]+)/g)].map((match) => Number(match[1]));
  const rows = starts.map((start, index) => {
    const duration = durations[index] ?? 0;
    const end = ends[index] ?? start + duration;
    const beat = beatFor(start);
    const assessment = duration >= 2.5 ? "review required" : "short real-screen hold / acceptable if contact sheet confirms movement around it";
    return `| ${start.toFixed(2)} | ${end.toFixed(2)} | ${duration.toFixed(2)} | ${beat?.id ?? "unknown"} | ${assessment} |`;
  });
  const result = rows.some((row) => row.includes("review required")) ? "REVIEW" : "PASS";
  writeFileSync(
    join(outDir, "freeze-qa-map.md"),
    [
      "# Hero Freeze QA Map",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Result: ${result}`,
      "",
      "| start sec | end sec | duration sec | visual beat | producer assessment |",
      "|---:|---:|---:|---|---|",
      ...(rows.length ? rows : ["| none | none | none | none | PASS - no freeze events detected |"]),
      "",
    ].join("\n"),
    "utf-8",
  );
  return { result, freezeCount: rows.length };
}

function beatFor(second) {
  return manifest.visualBeats.find((beat) => second >= beat.startSec && second < beat.endSec);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
