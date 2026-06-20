import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FPS, HEIGHT, WIDTH } from "./Root";

type MediaType = "image" | "video";

type Beat = {
  at: number;
  dur: number;
  src: string;
  type?: MediaType;
  fit?: "cover" | "contain";
  scaleFrom?: number;
  scaleTo?: number;
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
  dim?: number;
  focus?: Focus[];
};

type Presenter = {
  at: number;
  dur: number;
  src: string;
  width: number;
  xFrom: number;
  xTo: number;
  yFrom: number;
  yTo: number;
  opacity?: number;
};

type Scene = {
  id: string;
  start: number;
  end: number;
  telop: string[];
  beats: Beat[];
  presenters?: Presenter[];
  captionVariant?: "default" | "proof";
  captionPlacement?: "bottom" | "top" | "leftRail";
  captionWindows?: { at: number; dur: number }[];
  mediaTop?: number;
  mediaFit?: "cover" | "contain";
};

type Focus = {
  x: number;
  y: number;
  w: number;
  h: number;
  at?: number;
  dur?: number;
  radius?: number;
};

const capture = (name: string) => `assets/captures/${name}`;
const presenter = (name: string) => `assets/presenter/${name}`;

const scenes: Scene[] = [
  {
    id: "s01",
    start: 0,
    end: 5,
    telop: ["AI画像生成を", "らくちん自動管理！"],
    beats: [
      { at: 0, dur: 2.2, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.04, scaleTo: 1.13, xFrom: -20, xTo: 10 },
      { at: 2.2, dur: 2.8, src: capture("4217-image-detail-url.png"), scaleFrom: 1.02, scaleTo: 1.08, xFrom: 20, xTo: -20 },
    ],
    presenters: [
      { at: 0.2, dur: 2.6, src: presenter("presenter-pull-screen.png"), width: 450, xFrom: -210, xTo: -40, yFrom: 205, yTo: 205, opacity: 0.94 },
    ],
  },
  {
    id: "s02",
    start: 5,
    end: 23,
    telop: ["作りすぎて、迷子。", "キャラが毎回ちがう。", "失敗すると、また最初から。"],
    beats: [
      { at: 0, dur: 3.5, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.08, scaleTo: 1.2, xFrom: -80, xTo: 80 },
      { at: 3.5, dur: 4.2, src: capture("4217-retry-reject-detail.png"), scaleFrom: 1.02, scaleTo: 1.13, xFrom: 40, xTo: -40 },
      { at: 7.7, dur: 3.7, src: capture("4217-retry-request-row.png"), scaleFrom: 1.08, scaleTo: 1.2, yFrom: -20, yTo: 30 },
      { at: 11.4, dur: 4.1, src: capture("4217-retry-improve-detail.png"), scaleFrom: 1.04, scaleTo: 1.12, xFrom: -30, xTo: 30 },
      { at: 15.5, dur: 2.5, src: capture("4217-retry-corrected-result.png"), scaleFrom: 1.0, scaleTo: 1.06 },
    ],
    presenters: [
      { at: 3.7, dur: 4.2, src: presenter("presenter-surprised-retry.png"), width: 250, xFrom: 1550, xTo: 1500, yFrom: 240, yTo: 240, opacity: 0.9 },
      { at: 11.8, dur: 3.2, src: presenter("presenter-point-left.png"), width: 300, xFrom: 1500, xTo: 1460, yFrom: 230, yTo: 230, opacity: 0.9 },
    ],
  },
  {
    id: "s03",
    start: 23,
    end: 32,
    telop: ["イメージアレンジャーなら", "ぜんぶまとめて管理！"],
    beats: [
      { at: 0, dur: 2.4, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.02, scaleTo: 1.1, xFrom: -40, xTo: 30 },
      { at: 2.4, dur: 3.2, src: capture("4217-image-detail-url.png"), scaleFrom: 1.0, scaleTo: 1.08, xFrom: 35, xTo: -30 },
      { at: 5.6, dur: 3.4, src: capture("4217-after-chatgpt-registration.png"), scaleFrom: 1.0, scaleTo: 1.06 },
    ],
    presenters: [
      { at: 0.4, dur: 3.5, src: presenter("presenter-pull-screen.png"), width: 350, xFrom: -160, xTo: -20, yFrom: 260, yTo: 250, opacity: 0.9 },
    ],
  },
  {
    id: "s04",
    start: 32,
    end: 58,
    captionVariant: "proof",
    telop: ["URLを入れるだけ。", "プロンプトも画像も自動で！"],
    beats: [
      { at: 0, dur: 2.4, src: capture("x-source-view.png"), fit: "contain", scaleFrom: 1.0, scaleTo: 1.03 },
      {
        at: 2.4,
        dur: 2.2,
        src: capture("x-link-copy.mp4"),
        type: "video",
        fit: "contain",
        focus: [{ x: 620, y: 940, w: 450, h: 112, radius: 12 }],
      },
      {
        at: 4.6,
        dur: 2.6,
        src: capture("4217-url-form-open-empty.png"),
        scaleFrom: 1.1,
        scaleTo: 1.22,
        focus: [{ x: 706, y: 336, w: 520, h: 96 }],
      },
      {
        at: 7.2,
        dur: 2.8,
        src: capture("4217-url-form-pasted.png"),
        scaleFrom: 1.16,
        scaleTo: 1.3,
        xFrom: 20,
        xTo: -28,
        focus: [{ x: 654, y: 474, w: 610, h: 88 }],
      },
      {
        at: 10.0,
        dur: 2.6,
        src: capture("4217-queue-url-draft-row.png"),
        scaleFrom: 1.28,
        scaleTo: 1.42,
        yFrom: -54,
        yTo: -18,
        dim: 0.08,
        focus: [{ x: 500, y: 306, w: 924, h: 110 }],
      },
      {
        at: 12.6,
        dur: 2.4,
        src: capture("4217-agent-work-instruction.png"),
        scaleFrom: 1.24,
        scaleTo: 1.36,
        xFrom: -74,
        xTo: -150,
        yFrom: -72,
        yTo: -110,
        dim: 0.06,
        focus: [{ x: 550, y: 282, w: 770, h: 420 }],
      },
      {
        at: 15.0,
        dur: 1.9,
        src: capture("4217-queue-url-generate-row.png"),
        scaleFrom: 1.28,
        scaleTo: 1.42,
        yFrom: -54,
        yTo: -18,
        dim: 0.08,
        focus: [{ x: 500, y: 306, w: 924, h: 110 }],
      },
      {
        at: 16.9,
        dur: 2.0,
        src: capture("4217-queue-url-generate-detail.png"),
        scaleFrom: 1.22,
        scaleTo: 1.34,
        yFrom: -54,
        yTo: -12,
        dim: 0.08,
        focus: [
          { x: 710, y: 392, w: 770, h: 68, radius: 18 },
          { x: 262, y: 640, w: 1398, h: 180, radius: 14 },
        ],
      },
      {
        at: 18.9,
        dur: 2.5,
        src: capture("chatgpt-prompt-submit.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.14,
        scaleTo: 1.24,
        dim: 0.04,
        focus: [{ x: 724, y: 226, w: 472, h: 508 }],
      },
      {
        at: 21.4,
        dur: 2.3,
        src: capture("chatgpt-generated-result.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.12,
        scaleTo: 1.22,
        dim: 0.04,
        focus: [{ x: 500, y: 400, w: 540, h: 660, radius: 24 }],
      },
      {
        at: 23.7,
        dur: 2.3,
        src: capture("4217-after-chatgpt-registration.png"),
        scaleFrom: 1.08,
        scaleTo: 1.18,
        focus: [{ x: 576, y: 226, w: 768, h: 610 }],
      },
    ],
    presenters: [
      { at: 4.8, dur: 4.4, src: presenter("presenter-point-left.png"), width: 290, xFrom: 1510, xTo: 1455, yFrom: 230, yTo: 230, opacity: 0.88 },
    ],
  },
  {
    id: "s05",
    start: 58,
    end: 82,
    captionVariant: "proof",
    telop: ["作った画像が", "自動でまとまる！"],
    beats: [
      { at: 0, dur: 4, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.04, scaleTo: 1.14, xFrom: -80, xTo: 70 },
      { at: 4, dur: 5, src: capture("4217-after-chatgpt-registration.png"), scaleFrom: 1.0, scaleTo: 1.07 },
      { at: 9, dur: 5, src: capture("4217-url-result-adopt-action.mp4"), type: "video", scaleFrom: 1.18, scaleTo: 1.3, xFrom: -130, xTo: -220, yFrom: -38, yTo: -88, dim: 0.08 },
      { at: 14, dur: 5, src: capture("4217-url-result-adopted.png"), scaleFrom: 1.1, scaleTo: 1.18, xFrom: -80, xTo: -150, yFrom: -24, yTo: -64, dim: 0.08 },
      { at: 19, dur: 5, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.12, scaleTo: 1.02, xFrom: 60, xTo: -30 },
    ],
    presenters: [
      { at: 0.8, dur: 4.2, src: presenter("presenter-point-left.png"), width: 290, xFrom: 1520, xTo: 1470, yFrom: 260, yTo: 250, opacity: 0.88 },
    ],
  },
  {
    id: "s06",
    start: 82,
    end: 102,
    captionPlacement: "top",
    telop: ["あの画像、", "どう作ったっけ？がなくなる。"],
    beats: [
      { at: 0, dur: 5, src: capture("4217-image-detail-url.png"), scaleFrom: 1.04, scaleTo: 1.14, xFrom: 40, xTo: -30 },
      { at: 5, dur: 5, src: capture("4217-queue-url-generate-detail.png"), scaleFrom: 1.02, scaleTo: 1.09, yFrom: -20, yTo: 20 },
      { at: 10, dur: 5, src: capture("4217-after-chatgpt-registration.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 15, dur: 5, src: capture("4217-image-detail-url.png"), scaleFrom: 1.12, scaleTo: 1.04 },
    ],
    presenters: [
      { at: 0.4, dur: 4.6, src: presenter("presenter-point-right.png"), width: 270, xFrom: 25, xTo: 60, yFrom: 270, yTo: 270, opacity: 0.86 },
    ],
  },
  {
    id: "s07",
    start: 102,
    end: 133,
    captionPlacement: "top",
    telop: ["キャラがブレない。", "顔・服・表情もまとめて管理！"],
    beats: [
      { at: 0, dur: 4.4, src: capture("4217-base-grid.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 4.4, dur: 5.2, src: capture("4217-base-detail-face.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 9.6, dur: 5.2, src: capture("4217-base-detail-outfit.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 14.8, dur: 5.2, src: capture("4217-base-detail-expression.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 20.0, dur: 5.5, src: capture("4217-base-detail-parts.png"), scaleFrom: 1.0, scaleTo: 1.1 },
      { at: 25.5, dur: 5.5, src: capture("4217-base-grid.png"), scaleFrom: 1.08, scaleTo: 1.0 },
    ],
    presenters: [
      { at: 0.8, dur: 3.8, src: presenter("presenter-point-left.png"), width: 260, xFrom: 1510, xTo: 1460, yFrom: 245, yTo: 245, opacity: 0.86 },
    ],
  },
  {
    id: "s08",
    start: 133,
    end: 155,
    captionVariant: "proof",
    captionPlacement: "top",
    telop: ["失敗しても、", "止まらない。"],
    beats: [
      { at: 0, dur: 4.2, src: capture("4217-retry-reject-detail.png"), scaleFrom: 1.0, scaleTo: 1.1 },
      { at: 4.2, dur: 4.0, src: capture("4217-retry-improve-detail.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 8.2, dur: 3.5, src: capture("4217-retry-request-row.png"), scaleFrom: 1.08, scaleTo: 1.18 },
      { at: 11.7, dur: 5.0, src: capture("4217-retry-corrected-result.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 16.7, dur: 5.3, src: capture("4217-retry-adopted-state.png"), scaleFrom: 1.0, scaleTo: 1.06 },
    ],
    presenters: [
      { at: 0.4, dur: 4.0, src: presenter("presenter-surprised-retry.png"), width: 260, xFrom: 1510, xTo: 1480, yFrom: 250, yTo: 250, opacity: 0.86 },
      { at: 9.2, dur: 4.0, src: presenter("presenter-point-right.png"), width: 235, xFrom: -86, xTo: -38, yFrom: 275, yTo: 268, opacity: 0.86 },
    ],
  },
  {
    id: "s09",
    start: 155,
    end: 180,
    captionVariant: "proof",
    captionPlacement: "leftRail",
    captionWindows: [{ at: 0, dur: 5.8 }],
    telop: ["画像だけじゃない。", "動画もまとめて管理！"],
    beats: [
      { at: 0, dur: 3, src: capture("4217-video-returned-player-motion.mp4"), type: "video", scaleFrom: 1.0, scaleTo: 1.02, dim: 0.08 },
      { at: 3, dur: 3, src: capture("4217-video-end-frame-selected.png"), scaleFrom: 1.0, scaleTo: 1.02 },
      {
        at: 6,
        dur: 3.2,
        src: capture("4217-video-request-row.png"),
        fit: "contain",
        scaleFrom: 1.08,
        scaleTo: 1.14,
        dim: 0.05,
        focus: [{ x: 520, y: 336, w: 884, h: 110 }],
      },
      {
        at: 9.2,
        dur: 3.2,
        src: capture("4217-video-request-detail.png"),
        fit: "contain",
        scaleFrom: 1.08,
        scaleTo: 1.14,
        dim: 0.05,
        focus: [{ x: 524, y: 340, w: 872, h: 406 }],
      },
      {
        at: 12.4,
        dur: 2.5,
        src: capture("vidu-upload-form-start-end-zoom-top.png"),
        scaleFrom: 1.0,
        scaleTo: 1.0,
        dim: 0.03,
        focus: [
          { x: 510, y: 150, w: 468, h: 230 },
          { x: 520, y: 410, w: 875, h: 330 },
        ],
      },
      {
        at: 14.9,
        dur: 2.7,
        src: capture("vidu-generation-submit-focused-zoom-bottom.mp4"),
        type: "video",
        scaleFrom: 1.0,
        scaleTo: 1.0,
        dim: 0.02,
        focus: [{ x: 620, y: 928, w: 642, h: 84, radius: 16 }],
      },
      {
        at: 17.6,
        dur: 2.7,
        src: capture("vidu-result.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.04,
        scaleTo: 1.06,
        dim: 0.03,
        focus: [{ x: 538, y: 142, w: 844, h: 530 }],
      },
      {
        at: 20.3,
        dur: 3.0,
        src: capture("4217-video-returned-player-motion.mp4"),
        type: "video",
        scaleFrom: 1.08,
        scaleTo: 1.14,
        dim: 0.06,
        focus: [{ x: 438, y: 102, w: 850, h: 470 }],
      },
      {
        at: 23.3,
        dur: 1.7,
        src: capture("4217-video-managed-detail.png"),
        fit: "contain",
        scaleFrom: 1.08,
        scaleTo: 1.12,
        dim: 0.05,
        focus: [{ x: 520, y: 178, w: 880, h: 650 }],
      },
    ],
    presenters: [
      { at: 0.4, dur: 3.0, src: presenter("presenter-point-left.png"), width: 230, xFrom: 1600, xTo: 1545, yFrom: 270, yTo: 270, opacity: 0.82 },
    ],
  },
  {
    id: "s10",
    start: 180,
    end: 187,
    captionPlacement: "top",
    telop: ["じゃあ、最初から", "流れを見てみよう！"],
    beats: [
      { at: 0, dur: 1.8, src: capture("4217-url-form-open-empty.png"), scaleFrom: 1.04, scaleTo: 1.12 },
      { at: 1.8, dur: 1.7, src: capture("4217-agent-work-instruction.png"), scaleFrom: 1.04, scaleTo: 1.12 },
      { at: 3.5, dur: 1.8, src: capture("4217-after-chatgpt-registration.png"), scaleFrom: 1.02, scaleTo: 1.1 },
      { at: 5.3, dur: 1.7, src: capture("4217-video-managed-detail.png"), scaleFrom: 1.02, scaleTo: 1.1 },
    ],
    presenters: [
      { at: 0.2, dur: 4.0, src: presenter("presenter-peek-right.png"), width: 330, xFrom: 1460, xTo: 1430, yFrom: -20, yTo: -5, opacity: 0.9 },
    ],
  },
  {
    id: "s11",
    start: 187,
    end: 237,
    captionVariant: "proof",
    mediaTop: 148,
    mediaFit: "contain",
    telop: ["URLを入れる → プロンプト化 → 生成", "戻ってくる → 採用する"],
    beats: [
      { at: 0, dur: 2.7, src: capture("x-source-view.png"), fit: "contain" },
      {
        at: 2.7,
        dur: 2.6,
        src: capture("x-link-copy.mp4"),
        type: "video",
        fit: "contain",
        focus: [{ x: 670, y: 960, w: 395, h: 100, radius: 12 }],
      },
      {
        at: 5.3,
        dur: 2.6,
        src: capture("4217-url-form-open-empty.png"),
        scaleFrom: 1.1,
        scaleTo: 1.22,
        focus: [{ x: 704, y: 344, w: 520, h: 92 }],
      },
      {
        at: 7.9,
        dur: 2.8,
        src: capture("4217-url-form-pasted.png"),
        scaleFrom: 1.16,
        scaleTo: 1.3,
        focus: [{ x: 650, y: 486, w: 620, h: 82 }],
      },
      {
        at: 10.7,
        dur: 2.6,
        src: capture("4217-queue-url-draft-row.png"),
        scaleFrom: 1.28,
        scaleTo: 1.42,
        yFrom: -54,
        yTo: -18,
        dim: 0.08,
        focus: [{ x: 500, y: 332, w: 924, h: 110 }],
      },
      {
        at: 13.3,
        dur: 2.4,
        src: capture("4217-agent-work-instruction.png"),
        scaleFrom: 1.24,
        scaleTo: 1.36,
        xFrom: -74,
        xTo: -150,
        yFrom: -72,
        yTo: -110,
        dim: 0.06,
        focus: [{ x: 550, y: 312, w: 770, h: 420 }],
      },
      {
        at: 15.7,
        dur: 1.8,
        src: capture("4217-queue-url-generate-row.png"),
        scaleFrom: 1.28,
        scaleTo: 1.42,
        yFrom: -54,
        yTo: -18,
        dim: 0.08,
        focus: [{ x: 500, y: 332, w: 924, h: 110 }],
      },
      {
        at: 17.5,
        dur: 2.0,
        src: capture("4217-queue-url-generate-detail.png"),
        scaleFrom: 1.22,
        scaleTo: 1.34,
        yFrom: -54,
        yTo: -12,
        dim: 0.08,
        focus: [
          { x: 710, y: 392, w: 770, h: 68, radius: 18 },
          { x: 262, y: 640, w: 1398, h: 180, radius: 14 },
        ],
      },
      {
        at: 19.5,
        dur: 3.0,
        src: capture("chatgpt-prompt-submit.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.14,
        scaleTo: 1.24,
        dim: 0.04,
        focus: [{ x: 724, y: 238, w: 472, h: 508 }],
      },
      {
        at: 22.5,
        dur: 3.0,
        src: capture("chatgpt-generated-result.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.12,
        scaleTo: 1.22,
        dim: 0.04,
        focus: [{ x: 535, y: 430, w: 500, h: 610, radius: 24 }],
      },
      {
        at: 25.5,
        dur: 3.0,
        src: capture("4217-after-chatgpt-registration.png"),
        scaleFrom: 1.08,
        scaleTo: 1.18,
        focus: [{ x: 576, y: 256, w: 768, h: 610 }],
      },
      {
        at: 28.5,
        dur: 3.0,
        src: capture("4217-url-result-adopt-action.mp4"),
        type: "video",
        scaleFrom: 1.24,
        scaleTo: 1.36,
        xFrom: -160,
        xTo: -248,
        yFrom: -62,
        yTo: -114,
        dim: 0.06,
        focus: [{ x: 946, y: 468, w: 250, h: 86, radius: 14 }],
      },
      {
        at: 31.5,
        dur: 2.7,
        src: capture("4217-video-start-frame-selected.png"),
        scaleFrom: 1.08,
        scaleTo: 1.16,
        focus: [{ x: 530, y: 250, w: 440, h: 280 }],
      },
      {
        at: 34.2,
        dur: 2.7,
        src: capture("4217-video-end-frame-selected.png"),
        scaleFrom: 1.08,
        scaleTo: 1.16,
        focus: [{ x: 952, y: 250, w: 440, h: 280 }],
      },
      {
        at: 36.9,
        dur: 2.8,
        src: capture("4217-video-request-detail.png"),
        scaleFrom: 1.08,
        scaleTo: 1.16,
        focus: [{ x: 530, y: 340, w: 860, h: 390 }],
      },
      {
        at: 39.7,
        dur: 2.3,
        src: capture("vidu-upload-form-start-end-zoom-top.png"),
        scaleFrom: 1.0,
        scaleTo: 1.0,
        dim: 0.03,
        focus: [
          { x: 510, y: 242, w: 468, h: 230 },
          { x: 520, y: 484, w: 875, h: 330 },
        ],
      },
      {
        at: 42.0,
        dur: 2.3,
        src: capture("vidu-generation-submit-focused-zoom-bottom.mp4"),
        type: "video",
        scaleFrom: 1.0,
        scaleTo: 1.0,
        dim: 0.02,
        focus: [{ x: 620, y: 944, w: 642, h: 86, radius: 16 }],
      },
      {
        at: 44.3,
        dur: 2.9,
        src: capture("vidu-result.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.04,
        scaleTo: 1.06,
        dim: 0.03,
        focus: [{ x: 538, y: 198, w: 844, h: 530 }],
      },
      {
        at: 47.2,
        dur: 1.8,
        src: capture("4217-video-returned-player-motion.mp4"),
        type: "video",
        scaleFrom: 1.1,
        scaleTo: 1.18,
        dim: 0.06,
        focus: [{ x: 420, y: 176, w: 884, h: 490 }],
      },
      {
        at: 49.0,
        dur: 1.0,
        src: capture("4217-video-managed-detail.png"),
        scaleFrom: 1.08,
        scaleTo: 1.12,
        focus: [{ x: 520, y: 198, w: 880, h: 650 }],
      },
    ],
  },
  {
    id: "s12",
    start: 237,
    end: 251,
    telop: ["GitHubからダウンロード", "Codex", "Claude Codeに頼むだけ", "aiarranger/image-arranger"],
    beats: [
      { at: 0, dur: 4.5, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.0, scaleTo: 1.08 },
      { at: 4.5, dur: 4.5, src: capture("4217-video-managed-detail.png"), scaleFrom: 1.0, scaleTo: 1.05 },
      { at: 9.0, dur: 5.0, src: capture("4217-image-grid-fresh.png"), scaleFrom: 1.08, scaleTo: 1.0 },
    ],
    presenters: [
      { at: 2.0, dur: 8.0, src: presenter("presenter-wave-cta.png"), width: 330, xFrom: 1510, xTo: 1455, yFrom: 170, yTo: 170, opacity: 0.86 },
    ],
  },
];

export const ImageArrangerIntro = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#111318", color: "white", fontFamily }}>
      <Audio src={staticFile("assets/audio/narration-timed.wav")} volume={0.94} />
      <Audio src={staticFile("assets/audio/continuity-bed.wav")} volume={0.32} />
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={seconds(scene.start)} durationInFrames={seconds(scene.end - scene.start)}>
          <SceneLayer scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SceneLayer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const local = frame / FPS;
  const beat = activeBeat(scene.beats, local);
  const captionVisible =
    !scene.captionWindows || scene.captionWindows.some((window) => local >= window.at && local < window.at + window.dur);
  return (
    <AbsoluteFill>
      <ProofMedia beat={beat} local={local} scene={scene} />
      <SubtleSceneGradient />
      {scene.presenters?.map((item) => (
        <PresenterLayer key={`${item.src}-${item.at}`} item={item} local={local} />
      ))}
      {captionVisible ? (
        <Caption
          lines={scene.telop}
          sceneId={scene.id}
          variant={scene.captionVariant ?? "default"}
          placement={scene.captionPlacement ?? (scene.captionVariant === "proof" ? "top" : "bottom")}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const ProofMedia: React.FC<{ beat: Beat; local: number; scene: Scene }> = ({ beat, local, scene }) => {
  const progress = eased((local - beat.at) / beat.dur);
  const baseScale = beat.scaleFrom ?? 1;
  const baseX = beat.xFrom ?? 0;
  const baseY = beat.yFrom ?? 0;
  const hasVisibleMotion =
    (beat.scaleTo ?? baseScale) !== baseScale ||
    (beat.xTo ?? baseX) !== baseX ||
    (beat.yTo ?? baseY) !== baseY;
  const fallbackXTo = hasVisibleMotion ? (beat.xTo ?? baseX) : baseX + 8;
  const fallbackYTo = hasVisibleMotion ? (beat.yTo ?? baseY) : baseY + 2;
  const scale = interpolate(progress, [0, 1], [baseScale, beat.scaleTo ?? baseScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(progress, [0, 1], [baseX, fallbackXTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(progress, [0, 1], [baseY, fallbackYTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: beat.fit ?? scene.mediaFit ?? "cover",
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
  };
  const dim = beat.dim ?? 0.14;
  const frameStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    top: scene.mediaTop ?? 0,
    overflow: "hidden",
    backgroundColor: "#0f1218",
  };
  return (
    <div style={frameStyle}>
      {(beat.fit ?? scene.mediaFit) === "contain" && beat.type !== "video" ? <BlurredBackplate beat={beat} /> : null}
      {beat.type === "video" ? (
        <OffthreadVideo src={staticFile(beat.src)} muted style={mediaStyle} />
      ) : (
        <Img src={staticFile(beat.src)} style={mediaStyle} />
      )}
      <AbsoluteFill style={{ background: `rgba(10,12,16,${dim})` }} />
      <FocusOverlays beat={beat} local={local} mediaTop={scene.mediaTop ?? 0} />
    </div>
  );
};

const FocusOverlays: React.FC<{ beat: Beat; local: number; mediaTop: number }> = ({ beat, local, mediaTop }) => {
  if (!beat.focus?.length) return null;
  const beatLocal = local - beat.at;
  return (
    <>
      {beat.focus.map((focus, index) => {
        const start = focus.at ?? 0.1;
        const dur = focus.dur ?? Math.max(0.8, beat.dur - 0.2);
        if (beatLocal < start || beatLocal > start + dur) return null;
        const life = Math.max(0, Math.min(1, (beatLocal - start) / dur));
        const intro = Math.min(1, (beatLocal - start) / 0.22);
        const outro = Math.min(1, (start + dur - beatLocal) / 0.22);
        const pulse = 0.58 + 0.42 * Math.sin(life * Math.PI * 4);
        const opacity = Math.max(0, Math.min(intro, outro)) * (0.72 + pulse * 0.18);
        return (
          <div
            key={`${focus.x}-${focus.y}-${index}`}
            style={{
              position: "absolute",
              left: focus.x,
              top: focus.y - mediaTop,
              width: focus.w,
              height: focus.h,
              borderRadius: focus.radius ?? 18,
              border: "4px solid rgba(255, 72, 142, 0.92)",
              boxShadow:
                "0 0 0 2px rgba(255,255,255,0.55), 0 0 22px rgba(255,72,142,0.5), inset 0 0 18px rgba(255,72,142,0.16)",
              opacity,
              zIndex: 15,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};

const BlurredBackplate: React.FC<{ beat: Beat }> = ({ beat }) => {
  const src = staticFile(beat.src);
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "blur(28px)",
    transform: "scale(1.08)",
    opacity: 0.38,
  };
  return (
    <AbsoluteFill>
      {beat.type === "video" ? <OffthreadVideo src={src} muted style={style} /> : <Img src={src} style={style} />}
    </AbsoluteFill>
  );
};

const PresenterLayer: React.FC<{ item: Presenter; local: number }> = ({ item, local }) => {
  const inWindow = local >= item.at && local < item.at + item.dur;
  if (!inWindow) return null;
  const p = eased((local - item.at) / item.dur);
  const entrance = Math.min(1, (local - item.at) / 0.4);
  const exit = Math.min(1, (item.at + item.dur - local) / 0.45);
  const opacity = Math.max(0, Math.min(entrance, exit)) * (item.opacity ?? 1);
  const x = interpolate(p, [0, 1], [item.xFrom, item.xTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(p, [0, 1], [item.yFrom, item.yTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Img
      src={staticFile(item.src)}
      style={{
        position: "absolute",
        width: item.width,
        left: x,
        top: y,
        opacity,
        filter: "drop-shadow(0 18px 34px rgba(0,0,0,0.32))",
        zIndex: 8,
      }}
    />
  );
};

const Caption: React.FC<{
  lines: string[];
  sceneId: string;
  variant: "default" | "proof";
  placement: "bottom" | "top" | "leftRail";
}> = ({
  lines,
  sceneId,
  variant,
  placement,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, 24], [0, 1, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const isProof = variant === "proof";
  const isLeftRail = placement === "leftRail";
  const fontSize = isLeftRail
    ? 30
    : isProof
      ? 32
      : sceneId === "s12"
        ? 46
        : sceneId === "s02"
          ? 54
          : 62;
  return (
    <div
      style={{
        position: "absolute",
        left: isLeftRail ? 34 : isProof ? 260 : 110,
        right: isLeftRail ? undefined : isProof ? 260 : 110,
        top: isLeftRail ? 142 : placement === "top" ? 18 : undefined,
        bottom: placement === "bottom" ? (sceneId === "s12" ? 46 : 74) : undefined,
        width: isLeftRail ? 380 : undefined,
        minHeight: isLeftRail ? 124 : isProof ? 72 : sceneId === "s12" ? 232 : sceneId === "s02" ? 190 : 154,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: isLeftRail ? "flex-start" : "center",
        padding: isLeftRail ? "18px 24px" : isProof ? "10px 28px" : sceneId === "s12" ? "22px 44px" : "28px 64px",
        borderRadius: isProof ? 12 : 18,
        background: isLeftRail
          ? "rgba(12, 15, 20, 0.66)"
          : isProof
            ? "rgb(12, 15, 20)"
            : sceneId === "s12"
              ? "rgba(12, 15, 20, 0.7)"
              : "rgba(12, 15, 20, 0.78)",
        boxShadow: isProof ? "0 10px 26px rgba(0,0,0,0.18)" : "0 20px 60px rgba(0,0,0,0.34)",
        opacity,
        zIndex: 20,
      }}
    >
      {lines.map((line) => (
        <div
          key={line}
          style={{
            fontSize,
            lineHeight: isLeftRail ? 1.18 : isProof ? 1.08 : sceneId === "s12" ? 1.12 : 1.18,
            fontWeight: 800,
            letterSpacing: 0,
            textAlign: isLeftRail ? "left" : "center",
            whiteSpace: "nowrap",
            textShadow: "0 3px 16px rgba(0,0,0,0.38)",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

const SubtleSceneGradient = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(90deg, rgba(0,0,0,0.24), transparent 22%, transparent 78%, rgba(0,0,0,0.22))",
      pointerEvents: "none",
    }}
  />
);

const activeBeat = (beats: Beat[], local: number) => {
  return beats.find((beat) => local >= beat.at && local < beat.at + beat.dur) ?? beats[beats.length - 1];
};

const seconds = (value: number) => Math.round(value * FPS);
const eased = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return Easing.bezier(0.16, 1, 0.3, 1)(clamped);
};

const fontFamily = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", sans-serif';
