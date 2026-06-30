import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureChromeMarkerTabProfileSafeWithRoute } from "./scripts/service-browser-route.mjs";

const profile = {
  profileDir: "Default",
  profileName: "ユーザー 1",
  email: "operator@example.com",
};

function fakeRoute({ findResults = [], openImpl = () => ({ opened: true }) } = {}) {
  const calls = [];
  return {
    calls,
    findChromeTabByUrlPart(markerPart, options) {
      calls.push({ fn: "find", markerPart, options });
      const next = findResults.shift();
      if (next instanceof Error) throw next;
      return next ?? null;
    },
    openChromeTabProfileSafe(markerUrl, options) {
      calls.push({ fn: "open", markerUrl, options });
      return openImpl(markerUrl, options);
    },
  };
}

test("ensureChromeMarkerTabProfileSafeWithRoute reuses an existing marker tab without opening another tab", async () => {
  const route = fakeRoute({
    findResults: [{ url: "https://service.example/create?agent-work=image-arranger", title: "ready" }],
  });
  const result = await ensureChromeMarkerTabProfileSafeWithRoute(route, {
    markerPart: "agent-work=image-arranger",
    markerUrl: "https://service.example/create?agent-work=image-arranger",
    profile,
    profileConfigPath: "workspace/.local/chatgpt-profile.json",
  });
  assert.equal(result.markerTab.title, "ready");
  assert.deepEqual(route.calls.map((call) => call.fn), ["find"]);
});

test("ensureChromeMarkerTabProfileSafeWithRoute repairs a missing marker only through the supplied profile-safe route", async () => {
  const route = fakeRoute({
    findResults: [null, { url: "https://service.example/create?agent-work=image-arranger", title: "repaired" }],
  });
  const result = await ensureChromeMarkerTabProfileSafeWithRoute(route, {
    markerPart: "agent-work=image-arranger",
    markerUrl: "https://service.example/create?agent-work=image-arranger",
    profile,
    profileConfigPath: "workspace/.local/chatgpt-profile.json",
    activate: false,
    repairWaitMs: 0,
  });
  assert.equal(result.markerTab.title, "repaired");
  assert.deepEqual(route.calls.map((call) => call.fn), ["find", "open", "find"]);
  assert.equal(route.calls[1].options.profile, profile);
  assert.equal(route.calls[1].options.activate, false);
  assert.equal(route.calls[1].options.profileConfigPath, "workspace/.local/chatgpt-profile.json");
});

test("ensureChromeMarkerTabProfileSafeWithRoute keeps initial find errors and succeeds after profile-safe repair", async () => {
  const route = fakeRoute({
    findResults: [new Error("AppleScript transient tab index error"), { url: "https://service.example/create?agent-work=image-arranger" }],
  });
  const result = await ensureChromeMarkerTabProfileSafeWithRoute(route, {
    markerPart: "agent-work=image-arranger",
    markerUrl: "https://service.example/create?agent-work=image-arranger",
    profile,
    repairWaitMs: 0,
  });
  assert.match(result.initialFindError.message, /transient/);
  assert.equal(result.markerTab.url.includes("agent-work=image-arranger"), true);
});

test("ensureChromeMarkerTabProfileSafeWithRoute ignores a wrong-profile marker and repairs only in the selected profile", async () => {
  const wrongProfile = new Error("target tab matched URL part but the active Chrome window profile did not match.");
  const route = fakeRoute({
    findResults: [
      wrongProfile,
      { url: "https://service.example/create?agent-work=image-arranger", title: "selected-profile marker" },
    ],
  });
  const result = await ensureChromeMarkerTabProfileSafeWithRoute(route, {
    markerPart: "agent-work=image-arranger",
    markerUrl: "https://service.example/create?agent-work=image-arranger&profile-directory=Default&profile-email=operator%40example.com",
    profile,
    profileConfigPath: "workspace/.local/chatgpt-profile.json",
    repairWaitMs: 0,
  });
  assert.equal(result.markerTab.title, "selected-profile marker");
  assert.equal(result.initialFindError, wrongProfile);
  assert.deepEqual(route.calls.map((call) => call.fn), ["find", "open", "find"]);
  assert.equal(route.calls[1].options.profile, profile);
  assert.equal(route.calls[1].options.profileConfigPath, "workspace/.local/chatgpt-profile.json");
});

test("ensureChromeMarkerTabProfileSafeWithRoute stops when only a wrong-profile Chrome window is available", async () => {
  const route = fakeRoute({
    findResults: [new Error("target tab matched URL part but the active Chrome window profile did not match.")],
    openImpl: () => {
      throw new Error("No Chrome window matched the selected profile; last inspected windowName=仕事用 profilePath=/Users/me/Library/Application Support/Google/Chrome/Profile 3");
    },
  });
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafeWithRoute(route, {
      markerPart: "agent-work=image-arranger-vidu",
      markerUrl: "https://www.vidu.com/ja/create/img2video?agent-work=image-arranger-vidu&profile-directory=Default&profile-email=operator%40example.com",
      profile,
      repairWaitMs: 0,
    }),
    /Do not launch another Chrome profile or probe other profiles/,
  );
  assert.deepEqual(route.calls.map((call) => call.fn), ["find", "open"]);
});

test("ensureChromeMarkerTabProfileSafeWithRoute reports profile-safe repair failure without probing other profiles", async () => {
  const route = fakeRoute({
    findResults: [null],
    openImpl: () => {
      throw new Error("No Chrome window matched the selected profile");
    },
  });
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafeWithRoute(route, {
      markerPart: "agent-work=image-arranger-vidu",
      markerUrl: "https://www.vidu.com/ja/create/img2video?agent-work=image-arranger-vidu",
      profile,
      repairWaitMs: 0,
    }),
    /Do not launch another Chrome profile or probe other profiles/,
  );
  assert.deepEqual(route.calls.map((call) => call.fn), ["find", "open"]);
});

test("ensureChromeMarkerTabProfileSafeWithRoute reports when repair opens but marker is still absent", async () => {
  const route = fakeRoute({ findResults: [null, null] });
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafeWithRoute(route, {
      markerPart: "agent-work=image-arranger-vidu",
      markerUrl: "https://www.vidu.com/ja/create/img2video?agent-work=image-arranger-vidu",
      profile,
      repairWaitMs: 0,
    }),
    /marker tab was still not found/,
  );
  assert.deepEqual(route.calls.map((call) => call.fn), ["find", "open", "find"]);
});

test("ensureChromeMarkerTabProfileSafeWithRoute stops if a human closes the marker during repair", async () => {
  const route = fakeRoute({ findResults: [null, null] });
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafeWithRoute(route, {
      markerPart: "agent-work=image-arranger",
      markerUrl: "https://service.example/create?agent-work=image-arranger&profile-directory=Default&profile-email=operator%40example.com",
      profile,
      repairWaitMs: 0,
    }),
    /marker tab was still not found/,
  );
  assert.deepEqual(route.calls.map((call) => call.fn), ["find", "open", "find"]);
});

test("ensureChromeMarkerTabProfileSafeWithRoute supports service-specific failure text", async () => {
  const route = fakeRoute({
    findResults: [new Error("wrong profile"), null],
    openImpl: () => {
      throw new Error("selected profile missing");
    },
  });
  await assert.rejects(
    () => ensureChromeMarkerTabProfileSafeWithRoute(route, {
      markerPart: "agent-work=image-arranger-vidu",
      markerUrl: "https://www.vidu.com/ja/create/img2video?agent-work=image-arranger-vidu",
      profile,
      repairWaitMs: 0,
      missingMessage: ({ initialFindError, repairError }) => `Vidu custom stop: ${initialFindError.message}; ${repairError.message}`,
    }),
    /Vidu custom stop: wrong profile; selected profile missing/,
  );
});
