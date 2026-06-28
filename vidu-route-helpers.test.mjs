import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildViduMarkerUrl,
  isViduLoggedOutPageState,
  legacyMarkerPartForViduProfile,
  markerPartForViduProfile,
} from "./scripts/vidu-route-helpers.mjs";

const profile = {
  profileDir: "Default",
  profileName: "ユーザー 1",
  email: "kaminokuresse@gmail.com",
};

test("Vidu marker URL and marker part include profile-email", () => {
  const markerUrl = buildViduMarkerUrl({
    viduUrl: "https://www.vidu.com/ja/create/img2video",
    profile,
  });
  const parsed = new URL(markerUrl);
  assert.equal(parsed.searchParams.get("agent-work"), "image-arranger-vidu");
  assert.equal(parsed.searchParams.get("profile-directory"), "Default");
  assert.equal(parsed.searchParams.get("profile-email"), "kaminokuresse@gmail.com");
  assert.equal(
    markerPartForViduProfile(profile),
    "agent-work=image-arranger-vidu&profile-directory=Default&profile-email=kaminokuresse%40gmail.com",
  );
  assert.equal(
    legacyMarkerPartForViduProfile(profile),
    "agent-work=image-arranger-vidu&profile-directory=Default",
  );
});

test("Vidu loggedOut detection ignores signed-in bonus text but catches real login actions", () => {
  assert.equal(
    isViduLoggedOutPageState({
      pathname: "/ja/create/img2video",
      body: "毎日のログインボーナス クレジットを得る 3596 プレミアム 作成する",
      visibleActionTexts: ["作成する"],
    }),
    false,
  );
  assert.equal(
    isViduLoggedOutPageState({
      pathname: "/ja/create/img2video",
      body: "Sign in to continue",
      visibleActionTexts: ["Sign in"],
    }),
    true,
  );
  assert.equal(
    isViduLoggedOutPageState({
      pathname: "/auth/login",
      body: "Premium",
      visibleActionTexts: [],
    }),
    true,
  );
});
