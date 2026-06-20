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
import videoManifest from "./video.manifest.json";

type MediaType = "image" | "video";
type Fit = "cover" | "contain";
type Placement = "top" | "bottom" | "cta";
type StepPlacement = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type Beat = {
  id: string;
  at: number;
  dur: number;
  src: string;
  type?: MediaType;
  fit?: Fit;
  scaleFrom?: number;
  scaleTo?: number;
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
  dim?: number;
  objectPosition?: string;
  cropTopPx?: number;
  cleanChromeWarning?: boolean;
  trimBeforeSec?: number;
  label?: string;
  labelPlacement?: StepPlacement;
};

type Presenter = {
  id: string;
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
  placement: Placement;
  beats: Beat[];
  presenters?: Presenter[];
};

type VideoManifest = {
  copyLock: {
    publicCaptions: Record<string, string[]>;
  };
};

const manifest = videoManifest as VideoManifest;

const publicCaptionFor = (sceneId: string) => {
  const lines = manifest.copyLock.publicCaptions[sceneId];
  if (!lines?.length) {
    throw new Error(`Missing locked public caption for scene: ${sceneId}`);
  }
  return lines;
};

const cap = (name: string) => `assets/captures/${name}`;
const focus = (name: string) => cap(`focus-preflight/${name}`);
const aichan = (name: string) => `assets/presenter/${name}`;

const scenes: Scene[] = [
  {
    id: "s01-source",
    start: 0,
    end: 12,
    placement: "bottom",
    beats: [
      {
        id: "source-url",
        at: 0,
        dur: 2.4,
        src: cap("x-v6-final-source-page.png"),
        scaleFrom: 1.0,
        scaleTo: 1.03,
        objectPosition: "center top",
        label: "1. 参考投稿を見る",
        labelPlacement: "top-left",
      },
      {
        id: "source-copy-exact",
        at: 2.4,
        dur: 2.0,
        src: cap("x-addressbar-exact-url-selected-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        label: "2. URLを確認",
        labelPlacement: "top-right",
      },
      {
        id: "source-copy-menu",
        at: 4.4,
        dur: 2.0,
        src: cap("x-copy-menu-open.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.01,
        dim: 0.02,
        cropTopPx: 0,
        label: "3. リンクをコピー",
        labelPlacement: "top-right",
      },
      {
        id: "product-create",
        at: 6.4,
        dur: 2.3,
        src: cap("4217-create-open-empty-public-crop.png"),
        scaleFrom: 1.03,
        scaleTo: 1.09,
        xFrom: -18,
        xTo: 18,
        label: "4. 新規画像生成を開く",
        labelPlacement: "top-left",
      },
      {
        id: "source-handoff",
        at: 8.7,
        dur: 3.3,
        src: focus("url-input-scroll-proof-clean.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "5. URLを貼り付ける",
        labelPlacement: "top-left",
      },
    ],
    presenters: [
      {
        id: "source-pull",
        at: 0.7,
        dur: 5.8,
        src: aichan("aichan-v6-x-peek-pull.png"),
        width: 260,
        xFrom: -136,
        xTo: 72,
        yFrom: 626,
        yTo: 590,
        opacity: 0.94,
      },
    ],
  },
  {
    id: "s02-url-queue",
    start: 12,
    end: 34,
    placement: "top",
    beats: [
      {
        id: "url-field",
        at: 0,
        dur: 5.2,
        src: focus("url-input-scroll-proof-clean.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "6. URLを貼り付ける",
        labelPlacement: "bottom-left",
      },
      {
        id: "queue-row",
        at: 5.2,
        dur: 4.8,
        src: focus("queue-row-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "7. キューに登録",
        labelPlacement: "bottom-left",
      },
      {
        id: "draft-row",
        at: 10.0,
        dur: 5.0,
        src: cap("4217-draft-request-row-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0.04,
        label: "8. 依頼行を確認",
        labelPlacement: "bottom-left",
      },
      {
        id: "agent-work",
        at: 15.0,
        dur: 7.0,
        src: cap("4217-v6-post-draft-generation-agent-copied.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.05,
        yFrom: 0,
        yTo: -12,
        dim: 0.04,
        label: "9. コーデックスへ作業依頼",
        labelPlacement: "bottom-left",
      },
    ],
    presenters: [
      {
        id: "url-point",
        at: 0.6,
        dur: 4.2,
        src: aichan("aichan-v6-point-url-field.png"),
        width: 190,
        xFrom: 1778,
        xTo: 1698,
        yFrom: 432,
        yTo: 394,
        opacity: 0.9,
      },
    ],
  },
  {
    id: "s03-prompt",
    start: 34,
    end: 70,
    placement: "top",
    beats: [
      {
        id: "prompt-drafted",
        at: 0,
        dur: 8.2,
        src: focus("prompt-drafted-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "10. 投稿をプロンプト化",
        labelPlacement: "bottom-left",
      },
      {
        id: "generation-detail",
        at: 8.2,
        dur: 8.4,
        src: cap("4217-v6-post-draft-generation-detail-open.png"),
        scaleFrom: 1.0,
        scaleTo: 1.07,
        yFrom: -16,
        yTo: 24,
        dim: 0.06,
        label: "11. 生成依頼を整える",
        labelPlacement: "bottom-left",
      },
      {
        id: "chatgpt-prompt",
        at: 16.6,
        dur: 9.2,
        src: cap("chatgpt-v6-before-send-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0.02,
        label: "12. チャットジーピーティーへ依頼",
        labelPlacement: "bottom-left",
      },
      {
        id: "chatgpt-result",
        at: 25.8,
        dur: 10.2,
        src: cap("chatgpt-v6-reply-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.05,
        dim: 0.02,
        label: "13. 画像が生成される",
        labelPlacement: "bottom-left",
      },
    ],
  },
  {
    id: "s04-return",
    start: 70,
    end: 102,
    placement: "bottom",
    beats: [
      {
        id: "registered-modal",
        at: 0,
        dur: 8.2,
        src: focus("registered-url-scroll-proof-clean.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        cropTopPx: 0,
        dim: 0.02,
      },
      {
        id: "registered-result",
        at: 8.2,
        dur: 7.8,
        src: focus("registered-result-image-public-clean.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
      },
      {
        id: "registered-source",
        at: 16.0,
        dur: 8.0,
        src: focus("registered-prompt-source-public-clean.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
      },
      {
        id: "adopted-card",
        at: 24.0,
        dur: 8.0,
        src: cap("4217-v6-generated-alpha-card-filtered-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0.05,
      },
    ],
    presenters: [
      {
        id: "return-pull",
        at: 8.5,
        dur: 5.0,
        src: aichan("aichan-v6-pull-returned-result.png"),
        width: 220,
        xFrom: -130,
        xTo: -48,
        yFrom: 804,
        yTo: 786,
        opacity: 0.9,
      },
    ],
  },
  {
    id: "s05-base",
    start: 102,
    end: 134,
    placement: "top",
    beats: [
      { id: "base-overview", at: 0, dur: 5.6, src: cap("4217-base-overview.png"), scaleFrom: 1.0, scaleTo: 1.05, dim: 0.05 },
      { id: "base-face", at: 5.6, dur: 6.2, src: cap("4217-base-face.png"), scaleFrom: 1.0, scaleTo: 1.06, dim: 0.05 },
      { id: "base-outfit", at: 11.8, dur: 6.2, src: cap("4217-base-outfit.png"), scaleFrom: 1.0, scaleTo: 1.06, dim: 0.05 },
      { id: "base-expression", at: 18.0, dur: 6.8, src: cap("4217-base-expression.png"), scaleFrom: 1.0, scaleTo: 1.06, dim: 0.05 },
      { id: "base-parts", at: 24.8, dur: 7.2, src: cap("4217-base-parts.png"), scaleFrom: 1.0, scaleTo: 1.07, dim: 0.05 },
    ],
  },
  {
    id: "s06-retry",
    start: 134,
    end: 165,
    placement: "top",
    beats: [
      { id: "reject", at: 0, dur: 6.0, src: cap("4217-retry-reject.png"), scaleFrom: 1.0, scaleTo: 1.06, dim: 0.05 },
      { id: "improve", at: 6.0, dur: 6.2, src: focus("retry-improve-action.png"), scaleFrom: 1.0, scaleTo: 1.02, dim: 0.02 },
      { id: "queued", at: 12.2, dur: 5.4, src: cap("4217-retry-queued-detail.png"), scaleFrom: 1.0, scaleTo: 1.06, dim: 0.06 },
      {
        id: "corrected",
        at: 17.6,
        dur: 6.8,
        src: cap("4217-retry-corrected-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.05,
        dim: 0.03,
      },
      { id: "adopted", at: 24.4, dur: 6.6, src: focus("retry-adopted-state.png"), scaleFrom: 1.0, scaleTo: 1.02, dim: 0.02 },
    ],
  },
  {
    id: "s07-video",
    start: 165,
    end: 204,
    placement: "top",
    beats: [
      { id: "video-start", at: 0, dur: 4.8, src: focus("video-start-frame.png"), scaleFrom: 1.0, scaleTo: 1.02, dim: 0.02 },
      { id: "video-end", at: 4.8, dur: 4.8, src: focus("video-end-frame.png"), scaleFrom: 1.0, scaleTo: 1.02, dim: 0.02 },
      { id: "video-queue", at: 9.6, dur: 5.4, src: cap("4217-video-queued-detail.png"), scaleFrom: 1.0, scaleTo: 1.06, dim: 0.06 },
      {
        id: "vidu-form",
        at: 15.0,
        dur: 5.2,
        src: cap("vidu-submitted-form-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.02,
        dim: 0,
      },
      { id: "vidu-prompt", at: 20.2, dur: 4.2, src: focus("vidu-submitted-prompt-field.png"), scaleFrom: 1.0, scaleTo: 1.04, dim: 0 },
      { id: "vidu-create", at: 24.4, dur: 3.6, src: focus("vidu-create-submit-button.png"), scaleFrom: 1.0, scaleTo: 1.04, dim: 0 },
      {
        id: "vidu-result",
        at: 28.0,
        dur: 4.4,
        src: cap("vidu-result-player-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.06,
        dim: 0,
      },
      {
        id: "product-player",
        at: 32.4,
        dur: 4.0,
        src: cap("4217-video-returned-player-motion.mp4"),
        type: "video",
        scaleFrom: 1.0,
        scaleTo: 1.06,
        dim: 0.02,
      },
      {
        id: "managed-video",
        at: 36.4,
        dur: 2.6,
        src: cap("4217-video-managed-detail-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.06,
        dim: 0.01,
      },
    ],
    presenters: [
      {
        id: "video-frame-point",
        at: 0.8,
        dur: 6.6,
        src: aichan("aichan-v6-video-frame-point.png"),
        width: 205,
        xFrom: 1542,
        xTo: 1490,
        yFrom: 574,
        yTo: 552,
        opacity: 0.86,
      },
    ],
  },
  {
    id: "s08-speedrun",
    start: 204,
    end: 235,
    placement: "bottom",
    beats: [
      {
        id: "speed-source",
        at: 0,
        dur: 2.0,
        src: cap("x-v6-final-source-page.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        objectPosition: "center top",
        dim: 0.02,
        label: "1. 投稿を見る",
        labelPlacement: "top-left",
      },
      {
        id: "speed-handoff",
        at: 2.0,
        dur: 2.0,
        src: cap("x-addressbar-exact-url-selected-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        dim: 0.02,
        label: "2. URLを確認",
        labelPlacement: "top-right",
      },
      {
        id: "speed-copy-menu",
        at: 4.0,
        dur: 2.0,
        src: cap("x-copy-menu-open.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.01,
        dim: 0.02,
        cropTopPx: 0,
        label: "3. リンクをコピー",
        labelPlacement: "top-right",
      },
      {
        id: "speed-create",
        at: 6.0,
        dur: 1.7,
        src: cap("4217-create-open-empty-public-crop.png"),
        scaleFrom: 1.02,
        scaleTo: 1.06,
        dim: 0.04,
        label: "4. 新規画像生成",
        labelPlacement: "top-left",
      },
      {
        id: "speed-url",
        at: 7.7,
        dur: 1.9,
        src: focus("url-input-scroll-proof-clean.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "5. URLを貼り付ける",
        labelPlacement: "top-left",
      },
      {
        id: "speed-queue",
        at: 9.6,
        dur: 1.9,
        src: focus("queue-row-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "6. キューに入れる",
        labelPlacement: "top-left",
      },
      {
        id: "speed-agent",
        at: 11.5,
        dur: 1.9,
        src: cap("4217-v6-post-draft-generation-agent-copied.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0.04,
        label: "7. コーデックスへ作業依頼",
        labelPlacement: "top-left",
      },
      {
        id: "speed-prompt",
        at: 13.4,
        dur: 2.0,
        src: focus("prompt-drafted-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.02,
        cropTopPx: 0,
        dim: 0.02,
        label: "8. プロンプト作成",
        labelPlacement: "top-left",
      },
      {
        id: "speed-chatgpt-prompt",
        at: 15.4,
        dur: 2.1,
        src: cap("chatgpt-v6-before-send-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0.02,
        label: "9. チャットジーピーティーへ依頼",
        labelPlacement: "top-left",
      },
      {
        id: "speed-chatgpt-result",
        at: 17.5,
        dur: 2.1,
        src: cap("chatgpt-v6-reply-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0.02,
        label: "10. 画像生成",
        labelPlacement: "top-left",
      },
      {
        id: "speed-registration",
        at: 19.6,
        dur: 2.1,
        src: focus("registered-url-scroll-proof-clean.mp4"),
        type: "video",
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        cropTopPx: 0,
        dim: 0.02,
        label: "11. 本システムへ登録",
        labelPlacement: "top-left",
      },
      {
        id: "speed-adoption",
        at: 21.7,
        dur: 1.8,
        src: cap("4217-v6-generated-alpha-card-filtered-public-clean.png"),
        scaleFrom: 1.0,
        scaleTo: 1.03,
        dim: 0.05,
        label: "12. 採用を決める",
        labelPlacement: "top-left",
      },
      {
        id: "speed-video-start",
        at: 23.5,
        dur: 0.9,
        src: focus("video-start-frame.png"),
        scaleFrom: 1.0,
        scaleTo: 1.01,
        dim: 0.02,
        label: "13. 開始フレーム",
        labelPlacement: "top-left",
      },
      {
        id: "speed-video-end",
        at: 24.4,
        dur: 0.9,
        src: focus("video-end-frame.png"),
        scaleFrom: 1.0,
        scaleTo: 1.01,
        dim: 0.02,
        label: "14. 終了フレーム",
        labelPlacement: "top-left",
      },
      {
        id: "speed-vidu-form",
        at: 25.3,
        dur: 1.2,
        src: cap("vidu-submitted-form-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.03,
        dim: 0,
        label: "15. ヴィドゥに送る",
        labelPlacement: "top-left",
      },
      {
        id: "speed-vidu-result",
        at: 26.5,
        dur: 1.2,
        src: cap("vidu-result-player-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.04,
        dim: 0,
        label: "16. 動画生成",
        labelPlacement: "top-left",
      },
      {
        id: "speed-player",
        at: 27.7,
        dur: 1.8,
        src: cap("4217-video-returned-player-motion.mp4"),
        type: "video",
        scaleFrom: 1.0,
        scaleTo: 1.05,
        dim: 0.02,
        label: "17. 結果が戻る",
        labelPlacement: "top-left",
      },
      {
        id: "speed-managed",
        at: 29.5,
        dur: 1.5,
        src: cap("4217-video-managed-detail-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.05,
        dim: 0.01,
        label: "18. 管理画面で見返す",
        labelPlacement: "top-left",
      },
    ],
  },
  {
    id: "s09-cta",
    start: 235,
    end: 251,
    placement: "cta",
    beats: [
      {
        id: "cta-base",
        at: 0,
        dur: 7.0,
        src: cap("4217-base-overview.png"),
        scaleFrom: 1.0,
        scaleTo: 1.04,
        xFrom: 170,
        xTo: 210,
        dim: 0.14,
      },
      {
        id: "cta-managed-video",
        at: 7.0,
        dur: 9.0,
        src: cap("4217-video-managed-detail-public-crop.png"),
        fit: "contain",
        scaleFrom: 1.0,
        scaleTo: 1.03,
        xFrom: 210,
        xTo: 250,
        dim: 0.08,
      },
    ],
    presenters: [
      {
        id: "cta-wave",
        at: 6.4,
        dur: 8.0,
        src: aichan("aichan-v6-wave-cta.png"),
        width: 220,
        xFrom: 1740,
        xTo: 1688,
        yFrom: 720,
        yTo: 696,
        opacity: 0.9,
      },
    ],
  },
];

export const ImageArrangerIntroV6 = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#101217", color: "white", fontFamily }}>
      <Audio src={staticFile("assets/audio/v6-narration-timed.wav")} volume={1} />
      <Audio src={staticFile("assets/audio/continuity-bed.wav")} volume={0.06} />
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={sec(scene.start)} durationInFrames={sec(scene.end - scene.start)}>
          <SceneLayer scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SceneLayer: React.FC<{ scene: Scene }> = ({ scene }) => {
  const speed = scene.id === "s08-speedrun";
  return (
    <AbsoluteFill>
      <div
        style={
          speed
            ? {
                position: "absolute",
                left: 0,
                top: 74,
                width: "100%",
                height: "100%",
                transform: "scale(0.93)",
                transformOrigin: "top center",
              }
            : {
                position: "absolute",
                inset: 0,
              }
        }
      >
        {scene.beats.map((beat) => (
          <Sequence key={beat.id} from={sec(beat.at)} durationInFrames={sec(beat.dur)}>
            <BeatLayer beat={beat} />
          </Sequence>
        ))}
      </div>
      <SceneVignette />
      {scene.presenters?.map((item) => (
        <Sequence key={item.id} from={sec(item.at)} durationInFrames={sec(item.dur)}>
          <PresenterLayer item={item} />
        </Sequence>
      ))}
      <Caption lines={publicCaptionFor(scene.id)} placement={scene.placement} sceneId={scene.id} />
    </AbsoluteFill>
  );
};

const BeatLayer: React.FC<{ beat: Beat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const durationFrames = Math.max(1, sec(beat.dur));
  const p = smooth(frame / durationFrames);
  const scale = interpolate(p, [0, 1], [beat.scaleFrom ?? 1, beat.scaleTo ?? beat.scaleFrom ?? 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(p, [0, 1], [beat.xFrom ?? 0, beat.xTo ?? beat.xFrom ?? 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(p, [0, 1], [beat.yFrom ?? 0, beat.yTo ?? beat.yFrom ?? 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fit = beat.fit ?? "cover";
  const cropTopPx = cropTopFor(beat);
  const mediaStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: cropTopPx ? -cropTopPx : 0,
    width: "100%",
    height: cropTopPx ? `calc(100% + ${cropTopPx}px)` : "100%",
    objectFit: fit,
    objectPosition: beat.objectPosition ?? "center",
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
    filter: mediaFilterFor(beat),
  };
  const src = staticFile(beat.src);
  return (
    <AbsoluteFill style={{ backgroundColor: "#101217", overflow: "hidden" }}>
      {fit === "contain" ? <Backplate src={beat.src} type={beat.type} /> : null}
      {beat.type === "video" ? (
        <OffthreadVideo key={beat.id} src={src} muted style={mediaStyle} trimBefore={sec(beat.trimBeforeSec ?? 0)} />
      ) : (
        <Img key={beat.id} src={src} style={mediaStyle} />
      )}
      {chromeWarningCleanerFor(beat) ? <ChromeWarningCleaner /> : null}
      <AbsoluteFill style={{ background: `rgba(8,10,14,${beat.dim ?? 0.08})` }} />
      {beat.label ? <StepLabel text={beat.label} placement={beat.labelPlacement ?? "top-left"} /> : null}
    </AbsoluteFill>
  );
};

const StepLabel: React.FC<{ text: string; placement: StepPlacement }> = ({ text, placement }) => {
  const top = placement.startsWith("top") ? 84 : undefined;
  const bottom = placement.startsWith("bottom") ? 64 : undefined;
  const left = placement.endsWith("left") ? 90 : undefined;
  const right = placement.endsWith("right") ? 90 : undefined;
  return (
    <div
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        maxWidth: 760,
        padding: "14px 24px",
        borderRadius: 999,
        background: "rgba(12,15,21,0.86)",
        color: "white",
        fontSize: 32,
        lineHeight: 1.16,
        fontWeight: 850,
        letterSpacing: 0,
        boxShadow: "0 14px 36px rgba(0,0,0,0.26)",
        textShadow: "0 2px 10px rgba(0,0,0,0.34)",
        zIndex: 18,
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
};

const cropTopFor = (beat: Beat) => {
  if (typeof beat.cropTopPx === "number") {
    return beat.cropTopPx;
  }
  if (beat.src.includes("focus-preflight/")) {
    return 74;
  }
  return 0;
};

const chromeWarningCleanerFor = (beat: Beat) => {
  return beat.cleanChromeWarning ?? beat.src.includes("x-link-copy-handoff-visible");
};

const mediaFilterFor = (beat: Beat) => {
  if (beat.src.includes("vidu-")) {
    return "brightness(1.14) contrast(1.08)";
  }
  if (beat.src.includes("4217-video-returned-player") || beat.src.includes("4217-video-managed")) {
    return "brightness(1.06) contrast(1.03)";
  }
  return undefined;
};

const ChromeWarningCleaner = () => (
  <div
    style={{
      position: "absolute",
      left: 260,
      right: 260,
      top: 128,
      height: 58,
      background: "#f5f5f5",
      zIndex: 4,
      pointerEvents: "none",
    }}
  />
);

const Backplate: React.FC<{ src: string; type?: MediaType }> = ({ src, type }) => {
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "blur(26px)",
    transform: "scale(1.08)",
    opacity: 0.32,
  };
  return (
    <AbsoluteFill>
      {type === "video" ? <OffthreadVideo src={staticFile(src)} muted style={style} /> : <Img src={staticFile(src)} style={style} />}
    </AbsoluteFill>
  );
};

const PresenterLayer: React.FC<{ item: Presenter }> = ({ item }) => {
  const frame = useCurrentFrame();
  const durationFrames = Math.max(1, sec(item.dur));
  const p = smooth(frame / durationFrames);
  const intro = Math.min(1, frame / 12);
  const outro = Math.min(1, (durationFrames - frame) / 12);
  const opacity = Math.max(0, Math.min(intro, outro)) * (item.opacity ?? 1);
  const x = interpolate(p, [0, 1], [item.xFrom, item.xTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(p, [0, 1], [item.yFrom, item.yTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bob = Math.sin(p * Math.PI * 2) * 5;
  const lean = interpolate(p, [0, 0.5, 1], [-2.5, 2.5, -1], {
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
        top: y + bob,
        opacity,
        transform: `rotate(${lean}deg)`,
        filter: "drop-shadow(0 18px 34px rgba(0,0,0,0.3))",
        zIndex: 8,
      }}
    />
  );
};

const Caption: React.FC<{ lines: string[]; placement: Placement; sceneId: string }> = ({ lines, placement, sceneId }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, 22], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const cta = placement === "cta";
  const speed = sceneId === "s08-speedrun";
  const speedProofRail = false;
  const videoProof = sceneId === "s07-video";
  const fontSize = cta ? 34 : speedProofRail ? 28 : speed ? 30 : videoProof ? 42 : 52;
  return (
    <div
      style={{
        position: "absolute",
        left: cta ? 48 : speedProofRail ? 48 : speed ? 460 : 150,
        right: cta || speed ? undefined : 150,
        width: cta ? 620 : speedProofRail ? 380 : speed ? 1000 : undefined,
        top: placement === "top" ? 28 : cta ? 58 : speedProofRail ? 166 : speed ? 12 : undefined,
        bottom: placement === "bottom" && !speed ? 54 : undefined,
        minHeight: cta ? 172 : speedProofRail ? 122 : speed ? 56 : videoProof ? 82 : 118,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: cta || speedProofRail ? "flex-start" : "center",
        padding: cta ? "18px 28px" : speedProofRail ? "16px 20px" : speed ? "8px 22px" : videoProof ? "12px 36px" : "18px 42px",
        borderRadius: 10,
        background: cta ? "rgba(11,14,19,0.64)" : speed ? "rgba(11,14,19,0.8)" : "rgba(11,14,19,0.82)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.26)",
        opacity,
        zIndex: 20,
      }}
    >
      {lines.map((line, index) => (
        <div
          key={`${line}-${index}`}
          style={{
            width: "100%",
            fontSize: index === 2 && cta ? 30 : fontSize,
            lineHeight: cta ? 1.16 : speedProofRail ? 1.18 : speed ? 1.1 : 1.14,
            fontWeight: index === 2 && cta ? 900 : 800,
            letterSpacing: 0,
            textAlign: cta || speedProofRail ? "left" : "center",
            whiteSpace: cta || speedProofRail ? "normal" : "nowrap",
            wordBreak: speedProofRail ? "keep-all" : "normal",
            overflowWrap: speedProofRail ? "normal" : "anywhere",
            textShadow: "0 3px 16px rgba(0,0,0,0.38)",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

const SceneVignette = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(90deg, rgba(0,0,0,0.2), transparent 22%, transparent 78%, rgba(0,0,0,0.2))",
      pointerEvents: "none",
      zIndex: 6,
    }}
  />
);

const sec = (value: number) => Math.round(value * FPS);
const smooth = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const fontFamily = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", sans-serif';

export const V6_SCENES_FOR_QA = scenes;
export const V6_WIDTH = WIDTH;
export const V6_HEIGHT = HEIGHT;
