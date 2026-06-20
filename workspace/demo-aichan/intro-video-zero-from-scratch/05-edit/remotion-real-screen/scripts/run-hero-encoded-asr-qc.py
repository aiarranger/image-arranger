#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from faster_whisper import WhisperModel


PROJECT_DIR = Path(__file__).resolve().parents[1]
VIDEO = (PROJECT_DIR / "../../06-final/hero-2min/image-arranger-hero-2min-v1.mp4").resolve()
AUDIO_MANIFEST = (PROJECT_DIR / "../audio/hero-2min-narration-manifest.json").resolve()
QC_DIR = (PROJECT_DIR / "../../06-final/hero-2min/qc").resolve()
OUT_DIR = QC_DIR / "audio-asr"
TRANSCRIPT = OUT_DIR / "faster-whisper-small-ja-encoded-hero.txt"
SUMMARY = OUT_DIR / "pronunciation-summary-hero.md"
QC_MANIFEST = QC_DIR / "hero-qc-manifest.json"


TERMS = {
    "image-arranger": ["イメージアレンジャー"],
    "URL": ["ユーアールエル", "ユーアルエル", "URL"],
    "Codex": ["コーデックス", "コデックス", "Codex"],
    "queue": ["キュー", "キュウ", "Q"],
    "prompt": ["プロンプト", "プロンプト文"],
    "adopted-mark": ["採用済みマーク", "採用のマーク"],
}

FORBIDDEN_ENGLISH_READINGS = {
    "image-arranger": ["image arranger", "image-arranger"],
}

FORBIDDEN_MEANING_BREAKS = [
    "急で",
    "急に入り",
    "急画面",
    "旧画面",
    "9画面",
    "依頼値覧",
    "紙自分",
    "市自分",
    "クロンプ",
    "クロンク",
    "プロンプトップ",
    "プロンプトプン",
    "トロンプ",
    "プロンク",
    "プロンプト分",
    "時間は解け",
    "時間まとけ",
    "ターツ",
    "修行画像",
    "最余",
    "サイオマーク",
]


def normalize(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()


def main() -> None:
    video = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else VIDEO
    if not video.exists():
        raise FileNotFoundError(video)
    if not AUDIO_MANIFEST.exists():
        raise FileNotFoundError(AUDIO_MANIFEST)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _info = model.transcribe(str(video), language="ja", vad_filter=True)
    lines = [f"[{segment.start:.2f}-{segment.end:.2f}] {segment.text}" for segment in segments]
    transcript_text = "\n".join(lines) + "\n"
    normalized_transcript = normalize(transcript_text)
    TRANSCRIPT.write_text(transcript_text, encoding="utf-8")

    audio_manifest = json.loads(AUDIO_MANIFEST.read_text(encoding="utf-8"))
    expected_text = " ".join(cue["text"] for cue in audio_manifest["cues"])

    rows = []
    failures = []
    for term, variants in TERMS.items():
        hits = [variant for variant in variants if normalize(variant) in normalized_transcript]
        status = "PASS" if hits else "NEEDS LISTENING REVIEW"
        if not hits:
            failures.append(f"{term} was not confidently detected by ASR")
        rows.append((term, ", ".join(hits) if hits else "not found in encoded ASR", status))

    forbidden_hits = []
    for term, variants in FORBIDDEN_ENGLISH_READINGS.items():
        hits = [variant for variant in variants if variant in transcript_text.lower()]
        if hits:
            forbidden_hits.append(f"{term}: {', '.join(hits)}")

    meaning_break_hits = [
        pattern for pattern in FORBIDDEN_MEANING_BREAKS if normalize(pattern) in normalized_transcript
    ]

    summary_lines = [
        "# Hero Pronunciation Summary",
        "",
        f"Video: {video}",
        f"ASR transcript: {TRANSCRIPT}",
        f"Audio manifest: {AUDIO_MANIFEST}",
        "",
        "| term | ASR evidence | status |",
        "|---|---|---|",
    ]
    for term, evidence, status in rows:
        summary_lines.append(f"| {term} | {evidence} | {status} |")

    summary_lines.extend(
        [
            "",
            "Expected narration source:",
            expected_text,
            "",
            "Forbidden English-reading scan:",
            "PASS - no forbidden English readings detected by ASR" if not forbidden_hits else "FAIL - " + "; ".join(forbidden_hits),
            "",
            "Forbidden meaning-break scan:",
            "PASS - no review-blocking Japanese ASR meaning breaks detected"
            if not meaning_break_hits
            else "FAIL - " + ", ".join(meaning_break_hits),
            "",
            "ASR notes:",
            "- ASR is a gate for pronunciation risk, not the only source of truth; ambiguous missing terms require listening review.",
            "- Faster Whisper may spell Japanese-pronounced service names as Latin text, such as Codex for コーデックス.",
            "- Queue may appear as `Q` or `キュウ` in ASR; this is acceptable evidence for the Japanese reading `キュー`.",
            "- The public CTA intentionally displays aiarranger/image-arranger as screen text; that display is not narration.",
        ]
    )
    SUMMARY.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")

    asr_result = "PASS" if not failures and not forbidden_hits and not meaning_break_hits else "NEEDS_LISTENING_REVIEW"
    if QC_MANIFEST.exists():
        manifest = json.loads(QC_MANIFEST.read_text(encoding="utf-8"))
        checks = manifest.setdefault("checks", [])
        for item in [
            "audio-asr/faster-whisper-small-ja-encoded-hero.txt",
            "audio-asr/pronunciation-summary-hero.md",
        ]:
            if item not in checks:
                checks.append(item)
        manifest["asrQa"] = {
            "result": asr_result,
            "failures": failures,
            "forbiddenEnglishReadingHits": forbidden_hits,
            "forbiddenMeaningBreakHits": meaning_break_hits,
            "transcript": "audio-asr/faster-whisper-small-ja-encoded-hero.txt",
            "summary": "audio-asr/pronunciation-summary-hero.md",
        }
        QC_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(TRANSCRIPT)
    print(SUMMARY)
    print(f"ASR result: {asr_result}")


if __name__ == "__main__":
    main()
