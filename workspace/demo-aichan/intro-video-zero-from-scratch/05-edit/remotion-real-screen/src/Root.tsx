import { Composition } from "remotion";
import { ImageArrangerIntroV6 } from "./ImageArrangerIntroV6";
import { ImageArrangerHero2Min } from "./ImageArrangerHero2Min";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_FRAMES = 251 * FPS;
export const HERO_DURATION_FRAMES = 120 * FPS;

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ImageArrangerIntro"
        component={ImageArrangerIntroV6}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ImageArrangerHero2Min"
        component={ImageArrangerHero2Min}
        durationInFrames={HERO_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
