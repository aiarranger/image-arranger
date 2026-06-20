import React from "react";
import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import manifest from "./video-hero-2min.manifest.json";

type VisualBeat = {
  id: string;
  startSec: number;
  endSec: number;
  kind: "image" | "video" | "montage" | "cta";
  variant?: string;
  asset?: string;
  assets?: string[];
  fit?: "cover" | "contain";
  sourceSize?: SourceSize;
  focusBoxes?: FocusBox[];
};

type Caption = {
  startSec: number;
  endSec: number;
  text: string;
  sub?: string;
};

type SourceSize = {
  width: number;
  height: number;
};

type FocusBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  startSec?: number;
  endSec?: number;
};

const FPS = manifest.fps;
const SCREEN_SHELL_WIDTH = manifest.width - 128;
const SCREEN_SHELL_HEIGHT = manifest.height - 226;
const capture = (name: string) => staticFile(`assets/captures/${name}`);
const audio = (name: string) => staticFile(`assets/audio/${name}`);

export const ImageArrangerHero2Min: React.FC = () => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const activeBeat = (manifest.visualBeats as VisualBeat[]).find(
    (beat) => sec >= beat.startSec && sec < beat.endSec,
  );
  const caption = (manifest.captions as Caption[]).find(
    (item) => sec >= item.startSec && sec < item.endSec,
  );

  return (
    <AbsoluteFill style={{ background: "#080910", color: "white", fontFamily: "Hiragino Sans, Yu Gothic, system-ui, sans-serif" }}>
      <Audio src={audio("hero-2min-narration-timed.wav")} />
      <Audio src={audio("continuity-bed.wav")} volume={0.055} />
      <BackgroundPulse />
      {(manifest.visualBeats as VisualBeat[]).map((beat) => {
        const from = Math.round(beat.startSec * FPS);
        const duration = Math.round((beat.endSec - beat.startSec) * FPS);
        return (
          <Sequence key={beat.id} from={from} durationInFrames={duration}>
            <BeatLayer beat={beat} duration={duration} />
          </Sequence>
        );
      })}
      {caption && activeBeat?.kind !== "cta" ? <CaptionBand caption={caption} /> : null}
      <ProgressRail />
    </AbsoluteFill>
  );
};

const BeatLayer: React.FC<{ beat: VisualBeat; duration: number }> = ({ beat, duration }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame);
  const fadeIn = 1;
  const fadeOut = interpolate(local, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {beat.kind === "image" && beat.asset ? (
        <ScreenImage beat={beat} asset={beat.asset} fit={beat.fit ?? "contain"} duration={duration} />
      ) : null}
      {beat.kind === "video" && beat.asset ? (
        <ScreenVideo asset={beat.asset} fit={beat.fit ?? "contain"} duration={duration} />
      ) : null}
      {beat.kind === "montage" && beat.assets ? <Montage assets={beat.assets} duration={duration} /> : null}
      {beat.kind === "cta" ? <Cta /> : null}
    </AbsoluteFill>
  );
};

const ScreenImage: React.FC<{ beat: VisualBeat; asset: string; fit: "cover" | "contain"; duration: number }> = ({ beat, asset, fit, duration }) => {
  const frame = useCurrentFrame();
  const local = frame % Math.max(1, duration);
  const scale = interpolate(local, [0, duration], fit === "cover" ? [1.05, 1.15] : [0.86, 0.92]);
  const y = interpolate(local, [0, duration], fit === "cover" ? [18, -24] : [18, -8]);
  const x = interpolate(local, [0, duration], [-12, 12]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "60px 64px 166px" }}>
      <div style={screenShell}>
        <Img
          src={capture(asset)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            transform: `translate(${x}px, ${y}px) scale(${scale})`,
            filter: "saturate(1.06) contrast(1.02)",
          }}
        />
        {beat.sourceSize && beat.focusBoxes ? (
          <FocusBoxes
            boxes={beat.focusBoxes}
            sourceSize={beat.sourceSize}
            motion={{ x, y, scale }}
            localFrame={local}
          />
        ) : null}
      </div>
      <ScanLight />
    </AbsoluteFill>
  );
};

const FocusBoxes: React.FC<{
  boxes: FocusBox[];
  sourceSize: SourceSize;
  motion: { x: number; y: number; scale: number };
  localFrame: number;
}> = ({ boxes, sourceSize, motion, localFrame }) => {
  const containScale = Math.min(SCREEN_SHELL_WIDTH / sourceSize.width, SCREEN_SHELL_HEIGHT / sourceSize.height);
  const displayWidth = sourceSize.width * containScale;
  const displayHeight = sourceSize.height * containScale;
  const offsetX = (SCREEN_SHELL_WIDTH - displayWidth) / 2;
  const offsetY = (SCREEN_SHELL_HEIGHT - displayHeight) / 2;
  const localSec = localFrame / FPS;

  return (
    <>
      {boxes.map((box, index) => {
        const start = box.startSec ?? 0;
        const end = box.endSec ?? Number.POSITIVE_INFINITY;
        if (localSec < start || localSec > end) {
          return null;
        }
        const sinceStart = Math.max(0, localSec - start);
        const alpha = Math.min(1, sinceStart / 0.25);
        const pulse = 1 + Math.sin(localFrame / 5) * 0.012;
        const left = offsetX + box.x * containScale;
        const top = offsetY + box.y * containScale;
        const width = box.width * containScale;
        const height = box.height * containScale;
        return (
          <div key={`${box.x}-${box.y}-${index}`}>
            <div
              style={{
                position: "absolute",
                left,
                top,
                width,
                height,
                border: "8px solid #ff315c",
                borderRadius: 24,
                boxShadow: "0 0 0 5px rgba(255,255,255,0.96), 0 18px 44px rgba(255,49,92,0.34)",
                opacity: alpha,
                transform: `translate(${motion.x}px, ${motion.y}px) scale(${motion.scale * pulse})`,
                transformOrigin: `${SCREEN_SHELL_WIDTH / 2 - left}px ${SCREEN_SHELL_HEIGHT / 2 - top}px`,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: left + width * 0.78,
                top: top + height * 0.35,
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "6px solid rgba(255,49,92,0.95)",
                background: "rgba(255,255,255,0.45)",
                opacity: alpha,
                transform: `translate(${motion.x}px, ${motion.y}px) scale(${motion.scale * (1.1 + Math.sin(localFrame / 4) * 0.16)})`,
                transformOrigin: `${SCREEN_SHELL_WIDTH / 2 - (left + width * 0.78)}px ${SCREEN_SHELL_HEIGHT / 2 - (top + height * 0.35)}px`,
                pointerEvents: "none",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

const ScreenVideo: React.FC<{ asset: string; fit: "cover" | "contain"; duration: number }> = ({ asset, fit, duration }) => {
  const frame = useCurrentFrame();
  const local = frame % Math.max(1, duration);
  const scale = interpolate(local, [0, duration], fit === "cover" ? [1.08, 1.18] : [0.88, 0.94]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "60px 64px 166px" }}>
      <div style={screenShell}>
        <Video
          src={capture(asset)}
          muted
          loop
          objectFit={fit}
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${scale})`,
          }}
        />
      </div>
      <ScanLight />
    </AbsoluteFill>
  );
};

const Montage: React.FC<{ assets: string[]; duration: number }> = ({ assets, duration }) => {
  const frame = useCurrentFrame();
  const local = frame % Math.max(1, duration);
  const active = Math.min(assets.length - 1, Math.floor((local / duration) * assets.length));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "76px 92px 176px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(assets.length, 2)}, minmax(0, 1fr))`,
          gap: 24,
          width: "100%",
          height: "100%",
        }}
      >
        {assets.map((asset, index) => {
          const isActive = index === active;
          return (
            <div
              key={asset}
              style={{
                ...screenShell,
                width: "100%",
                height: "100%",
                transform: `scale(${isActive ? 1.03 : 0.97})`,
                opacity: isActive ? 1 : 0.72,
              }}
            >
              <Img src={capture(asset)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          );
        })}
      </div>
      <ScanLight />
    </AbsoluteFill>
  );
};

const CaptionBand: React.FC<{ caption: Caption }> = ({ caption }) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const start = caption.startSec;
  const end = caption.endSec;
  const alpha = Math.min(
    interpolate(sec, [start, start + 0.01], [1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(sec, [end - 0.25, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 130,
        right: 130,
        bottom: 48,
        minHeight: caption.sub ? 118 : 88,
        borderRadius: 12,
        background: "rgba(7, 9, 14, 0.84)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: alpha,
        padding: "12px 28px",
      }}
    >
      <div style={{ fontSize: caption.text.length > 28 ? 44 : 52, fontWeight: 800, lineHeight: 1.12, letterSpacing: 0 }}>
        {caption.text}
      </div>
      {caption.sub ? <div style={{ fontSize: 30, marginTop: 8, color: "#d7e3ff", fontWeight: 700 }}>{caption.sub}</div> : null}
    </div>
  );
};

const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 20], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const publicCaptions = manifest.copyLock.publicCaptions;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #10131f, #14251f 58%, #251a22)" }}>
      <div style={{ transform: `scale(${pop})`, textAlign: "center" }}>
        <div style={{ fontSize: 52, fontWeight: 850, marginBottom: 18 }}>{publicCaptions[14]}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: "#d7e3ff", marginBottom: 28 }}>{publicCaptions[15]}</div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 900,
            background: "white",
            color: "#0c1020",
            borderRadius: 16,
            padding: "26px 46px",
            boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
          }}
        >
          {manifest.copyLock.repo}
        </div>
        <div style={{ fontSize: 46, fontWeight: 850, color: "#ffe082", marginTop: 28 }}>{publicCaptions[17]}</div>
      </div>
    </AbsoluteFill>
  );
};

const ProgressRail: React.FC = () => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, manifest.durationSec * FPS], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: "rgba(255,255,255,0.08)" }}>
      <div style={{ width: `${width}%`, height: "100%", background: "linear-gradient(90deg, #36d399, #8b5cf6, #f43f5e)" }} />
    </div>
  );
};

const BackgroundPulse: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame % 180, [0, 180], [0, 1]);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + shift * 20}deg, #090a12 0%, #151c23 43%, #221521 100%)`,
      }}
    />
  );
};

const ScanLight: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame % 90, [0, 90], [-20, 120]);
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        bottom: 110,
        left: `${x}%`,
        width: 120,
        transform: "skewX(-14deg)",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
        pointerEvents: "none",
      }}
    />
  );
};

const screenShell: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 12,
  overflow: "hidden",
  background: "#f7f8fb",
  boxShadow: "0 28px 90px rgba(0,0,0,0.46)",
};
