#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import sys
import wave
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy.io import wavfile

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
ENGINE_ROOT = Path("/Users/macstudio/Developer/Style-Bert-VITS2-Mac")
MODEL_ROOT = ENGINE_ROOT / "model_assets/downer"
MODEL_PATH = MODEL_ROOT / "downer_e100_s7000.safetensors"
CONFIG_PATH = MODEL_ROOT / "config.json"
STYLE_PATH = MODEL_ROOT / "style_vectors.npy"
SOURCE_ZIP = Path("/Users/macstudio/Downloads/downer.zip")
OUT_DIR = PACKAGE_ROOT / "05-edit/audio"
MANIFEST_PATH = OUT_DIR / "hero-2min-narration-manifest.json"
TIMED_WAV = OUT_DIR / "hero-2min-narration-timed.wav"
TOTAL_DURATION_SEC = 120.0
TIMELINE_GAIN = 0.76

DEFAULT_TTS = {
    "sdp_ratio": 0.2,
    "noise": 0.6,
    "noise_w": 0.8,
    "length": 0.84,
    "split_interval": 0.12,
}

sys.path.insert(0, str(ENGINE_ROOT))
os.chdir(ENGINE_ROOT)

from style_bert_vits2.constants import Languages  # noqa: E402
from style_bert_vits2.nlp import bert_models  # noqa: E402
from style_bert_vits2.nlp.japanese import pyopenjtalk_worker as pyopenjtalk  # noqa: E402
from style_bert_vits2.tts_model import TTSModel  # noqa: E402


CUES = [
    {
        "id": "h01",
        "plannedStartSec": 0.0,
        "text": "画像生成を試しているうちに、ファイルやプロンプトが散らかっていませんか。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h01.wav",
        "tts": {"sdp_ratio": 0.18, "noise": 0.48, "noise_w": 0.62, "length": 0.9, "split_interval": 0.18},
    },
    {
        "id": "h02",
        "plannedStartSec": 6.5,
        "text": "気に入った一枚があっても、元の参考リンクや設定を探すだけで時間がかかります。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h02.wav",
    },
    {"id": "h03", "plannedStartSec": 13.0, "text": "その整理を、生成の流れごと残せるようにします。"},
    {
        "id": "h04",
        "plannedStartSec": 18.0,
        "text": "イメージアレンジャーなら、画像、動画、テキスト、参照元をひとつの画面で管理できます。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h04.wav",
        "tts": {"sdp_ratio": 0.18, "noise": 0.48, "noise_w": 0.62, "length": 1.0, "split_interval": 0.18},
    },
    {
        "id": "h05",
        "plannedStartSec": 25.5,
        "text": "ギャラリー、キュー、詳細画面。採用状態まで確認できます。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h05.wav",
        "tts": {"sdp_ratio": 0.16, "noise": 0.42, "noise_w": 0.55, "length": 0.95, "split_interval": 0.22},
    },
    {"id": "h06", "plannedStartSec": 32.0, "text": "生成結果だけでなく、作った理由も一緒に残せるのが特徴です。"},
    {
        "id": "h07",
        "plannedStartSec": 38.0,
        "text": "キャラクター設定を残しておけば、顔、服、表情をあとから見返せます。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h07.wav",
    },
    {
        "id": "h08",
        "plannedStartSec": 47.5,
        "text": "生成結果は並べて比較。良かったものには採用済みマーク。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h08.wav",
        "tts": {"sdp_ratio": 0.18, "noise": 0.48, "noise_w": 0.62, "length": 0.9, "split_interval": 0.18},
    },
    {
        "id": "h09",
        "plannedStartSec": 56.0,
        "text": "画像だけでなく、動画の最初と最後の画像も、同じ流れで扱えます。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h09.wav",
    },
    {"id": "h10", "plannedStartSec": 65.0, "text": "あとから再現したり、改善したりしやすくなります。"},
    {"id": "h11", "plannedStartSec": 72.0, "text": "参考にしたい投稿やページを見つけたら、ユーアールエルをコピーします。"},
    {
        "id": "h12",
        "plannedStartSec": 78.5,
        "text": "参考リンクを貼るだけで、次の生成作業へ進みます。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h12.wav",
        "tts": {"sdp_ratio": 0.16, "noise": 0.42, "noise_w": 0.55, "length": 0.95, "split_interval": 0.22},
    },
    {
        "id": "h13",
        "plannedStartSec": 86.5,
        "text": "できたテキストも、生成画像も、同じ場所に戻ります。",
        "lockedFile": "05-edit/audio/locked-cues/hero-2min-h13.wav",
        "tts": {"sdp_ratio": 0.16, "noise": 0.42, "noise_w": 0.55, "length": 1.0, "split_interval": 0.22},
    },
    {"id": "h14", "plannedStartSec": 95.0, "text": "気になるところは、元の依頼を見ながら、もう一度生成。改善の履歴を残せます。"},
    {"id": "h15", "plannedStartSec": 103.0, "text": "一度きりの生成で終わらず、育てていけます。"},
    {"id": "h16", "plannedStartSec": 108.0, "text": "無料でダウンロードして、コーデックスから起動。"},
    {"id": "h17", "plannedStartSec": 112.5, "text": "自分の画像を入れて、すぐ試せます。"},
    {"id": "h18", "plannedStartSec": 116.5, "text": "名前は、画面どおりです。"},
]


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / float(wav.getframerate())


def main() -> None:
    for path in [MODEL_PATH, CONFIG_PATH, STYLE_PATH]:
        if not path.exists():
            raise FileNotFoundError(path)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pyopenjtalk.initialize_worker()
    bert_models.load_model(Languages.JP)
    bert_models.load_tokenizer(Languages.JP)

    model = TTSModel(
        model_path=MODEL_PATH,
        config_path=CONFIG_PATH,
        style_vec_path=STYLE_PATH,
        device="cpu",
    )
    model.load()

    generated = []
    sample_rate = 44100
    previous_end = 0.0

    for index, cue in enumerate(CUES):
        out_path = OUT_DIR / f"hero-2min-{cue['id']}.wav"
        locked_file = cue.get("lockedFile")
        if locked_file:
            locked_path = PACKAGE_ROOT / locked_file
            if not locked_path.exists():
                raise FileNotFoundError(locked_path)
            shutil.copyfile(locked_path, out_path)
            with wave.open(str(out_path), "rb") as wav:
                sr = wav.getframerate()
        else:
            tts = {**DEFAULT_TTS, **cue.get("tts", {})}
            sr, audio = model.infer(
                text=cue["text"],
                language=Languages.JP,
                speaker_id=0,
                sdp_ratio=tts["sdp_ratio"],
                noise=tts["noise"],
                noise_w=tts["noise_w"],
                length=tts["length"],
                line_split=False,
                split_interval=tts["split_interval"],
                style="neutral",
                style_weight=1.0,
            )
            wavfile.write(str(out_path), sr, audio)
        if sr != sample_rate:
            sample_rate = sr
        duration_sec = wav_duration(out_path)
        if index == 0:
            start_sec = cue["plannedStartSec"]
        else:
            min_gap = 0.1 if cue["id"] == "h18" else 0.25
            max_gap = 0.8 if cue["plannedStartSec"] < 30 else 1.2
            start_sec = max(previous_end + min_gap, min(cue["plannedStartSec"], previous_end + max_gap))
        end_sec = start_sec + duration_sec
        previous_end = end_sec
        generated.append(
            {
                **cue,
                "startSec": start_sec,
                "endSec": end_sec,
                "file": str(out_path.relative_to(PACKAGE_ROOT)),
                "sampleRate": sr,
                "durationSec": duration_sec,
            }
        )

    total_samples = int(round(TOTAL_DURATION_SEC * sample_rate))
    timeline = np.zeros(total_samples, dtype=np.int32)
    for cue in generated:
        sr, audio_data = wavfile.read(str(PACKAGE_ROOT / cue["file"]))
        if sr != sample_rate:
            raise ValueError(f"Unexpected sample rate for {cue['file']}: {sr}")
        if audio_data.ndim > 1:
            audio_data = audio_data.mean(axis=1).astype(np.int16)
        start = int(round(cue["startSec"] * sample_rate))
        end = min(total_samples, start + len(audio_data))
        if end <= start:
            continue
        segment = audio_data[: end - start].astype(np.int32)
        timeline[start:end] += segment

    timeline = np.clip(timeline * TIMELINE_GAIN, -32768, 32767).astype(np.int16)
    wavfile.write(str(TIMED_WAV), sample_rate, timeline)

    gaps = []
    for previous, current in zip(generated, generated[1:]):
        gaps.append(
            {
                "previous": previous["id"],
                "current": current["id"],
                "gapSec": max(0.0, current["startSec"] - previous["endSec"]),
            }
        )

    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now().isoformat(),
                "voice": {
                    "sourceZip": str(SOURCE_ZIP),
                    "sourceZipExists": SOURCE_ZIP.exists(),
                    "engine": str(ENGINE_ROOT),
                    "model": "downer",
                    "style": "neutral",
                    "language": "JP",
                },
                "timedWav": str(TIMED_WAV.relative_to(PACKAGE_ROOT)),
                "durationSec": wav_duration(TIMED_WAV),
                "timelineGain": TIMELINE_GAIN,
                "cues": generated,
                "gapQa": {
                    "maxGapSec": max((gap["gapSec"] for gap in gaps), default=0.0),
                    "gaps": gaps,
                    "rule": "0:00-0:30 <= 0.8s target; after 0:30 <= 1.2s target",
                },
                "copyLock": "Hero 2min narration uses Japanese readings: イメージアレンジャー, ユーアールエル, コーデックス.",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {TIMED_WAV}")
    print(f"Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
