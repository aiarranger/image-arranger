export function buildViduMarkerUrl({ viduUrl, profile, runId = "" }) {
  const url = new URL(viduUrl);
  url.searchParams.set("agent-work", "image-arranger-vidu");
  url.searchParams.set("profile-directory", profile.profileDir);
  url.searchParams.set("profile-email", profile.email);
  if (runId) url.searchParams.set("run", runId);
  return url.toString();
}

export function markerPartForViduProfile(profile) {
  const profileMarker = new URLSearchParams({
    "profile-directory": profile.profileDir,
    "profile-email": profile.email,
  }).toString();
  return `agent-work=image-arranger-vidu&${profileMarker}`;
}

export function legacyMarkerPartForViduProfile(profile) {
  return `agent-work=image-arranger-vidu&${new URLSearchParams({ "profile-directory": profile.profileDir }).toString()}`;
}

export function isViduLoggedOutPageState({ pathname = "", body = "", visibleActionTexts = [] } = {}) {
  const hasSignedInSignal = /\b(Premium|Credits?)\b|プレミアム|クレジットを得る/i.test(body);
  const hasLoginAction = visibleActionTexts.some((text) => /^(ログイン|Sign in|Log in|Login)(\s|$)/i.test(text));
  return /\/login\b|\/signin\b|\/auth\b/i.test(pathname) || (hasLoginAction && !hasSignedInSignal);
}
