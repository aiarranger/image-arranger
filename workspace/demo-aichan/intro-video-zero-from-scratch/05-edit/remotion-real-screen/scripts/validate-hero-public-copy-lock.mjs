#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const reportArgIndex = process.argv.indexOf("--report");
const reportPath =
  reportArgIndex >= 0 && process.argv[reportArgIndex + 1]
    ? resolve(projectDir, process.argv[reportArgIndex + 1])
    : resolve(projectDir, "../../06-final/hero-2min/qc/public-copy-lock-report.txt");

const manifestPath = join(projectDir, "src/video-hero-2min.manifest.json");
const tsxPath = join(projectDir, "src/ImageArrangerHero2Min.tsx");
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const tsx = readFileSync(tsxPath, "utf-8");

const requiredUrl = "https://x.com/fishing_kiyogon/status/2065218662689349934?s=20";
const requiredProductUrl = "http://127.0.0.1:4217/";
const rejectedPublicCaptionLiterals = ["Gallery → Queue → Detail"];
const failures = [];
const warnings = [];

if (manifest.copyLock.externalReferenceUrl !== requiredUrl) {
  failures.push(`external URL lock mismatch: ${manifest.copyLock.externalReferenceUrl}`);
}
if (manifest.copyLock.productUrl !== requiredProductUrl) {
  failures.push(`product URL lock mismatch: ${manifest.copyLock.productUrl}`);
}
if (manifest.copyLock.repo !== "aiarranger/image-arranger") {
  failures.push(`repo lock mismatch: ${manifest.copyLock.repo}`);
}
if (manifest.durationSec !== 120 || manifest.fps !== 30) {
  failures.push(`Hero timing lock mismatch: duration=${manifest.durationSec}, fps=${manifest.fps}`);
}

const publicTexts = [
  ...manifest.copyLock.publicCaptions,
  ...manifest.captions.flatMap((caption) => [caption.text, caption.sub].filter(Boolean)),
  manifest.copyLock.repo,
];
const publicTextSet = new Set(publicTexts);
for (const caption of manifest.captions) {
  if (!publicTextSet.has(caption.text)) {
    failures.push(`caption is not in public copy allowlist: ${caption.text}`);
  }
  if (caption.sub && !publicTextSet.has(caption.sub)) {
    failures.push(`caption sub is not in public copy allowlist: ${caption.sub}`);
  }
}
for (const literal of rejectedPublicCaptionLiterals) {
  if (publicTexts.includes(literal) || JSON.stringify(manifest).includes(literal)) {
    failures.push(`rejected public caption remains after Japanese copy review: ${literal}`);
  }
}

for (const banned of manifest.copyLock.bannedPublicPatterns ?? []) {
  const publicMatches = publicTexts.filter((text) => new RegExp(banned, "i").test(text));
  if (publicMatches.length) {
    failures.push(`banned public text pattern ${banned} appears in public copy: ${publicMatches.join(" | ")}`);
  }
  if (tsx.includes(banned)) {
    failures.push(`Remotion source contains banned public/internal pattern: ${banned}`);
  }
}

for (const literal of manifest.copyLock.publicCaptions) {
  if (tsx.includes(literal)) {
    failures.push(`Remotion source hand-writes public caption instead of reading manifest: ${literal}`);
  }
}
if (tsx.includes("public-demo-chaos") || tsx.includes("same character, transparent background") || tsx.includes("which URL did I use")) {
  failures.push("Hero source still contains the rejected mock/chaos board strings");
}
if (JSON.stringify(manifest.visualBeats).includes('"kind":"chaos"') || JSON.stringify(manifest.visualBeats).includes('"kind": "chaos"')) {
  failures.push("Hero manifest still uses synthetic chaos beats instead of real screens");
}
if (!tsx.includes("./video-hero-2min.manifest.json")) {
  failures.push("Hero Remotion source does not import the Hero manifest");
}
if (!tsx.includes("manifest.copyLock.publicCaptions") || !tsx.includes("manifest.copyLock.repo")) {
  failures.push("CTA/captions are not clearly sourced from the Hero manifest");
}
if (manifest.reviewTargets.aichanNoCoverSeconds.length !== 0) {
  warnings.push("Hero rough has no composited Aichan; aichanNoCoverSeconds should normally be empty.");
}

const report = [
  "Hero Public Copy Lock Report",
  `Generated: ${new Date().toISOString()}`,
  `Verdict: ${failures.length ? "FAIL" : "PASS"}`,
  "",
  "Locked sources:",
  `- product URL: ${manifest.copyLock.productUrl}`,
  `- external URL: ${manifest.copyLock.externalReferenceUrl}`,
  `- repo: ${manifest.copyLock.repo}`,
  "",
  "Checked:",
  `- ${manifestPath}`,
  `- ${tsxPath}`,
  "- manifest copyLock.publicCaptions",
  "- manifest captions",
  "- rejected mock/chaos strings",
  "- exact operator URL and 4217 product URL",
  "",
  warnings.length ? "Warnings:" : "Warnings: none",
  ...warnings.map((warning) => `- ${warning}`),
  "",
  failures.length ? "Failures:" : "Failures: none",
  ...failures.map((failure) => `- ${failure}`),
  "",
].join("\n");

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, report, "utf-8");
console.log(report);

if (failures.length) {
  process.exit(1);
}
