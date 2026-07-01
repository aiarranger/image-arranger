import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertNoUserDataDirProcesses,
  assertUniqueProfileWindowLabel,
} from "./scripts/service-browser-profile.mjs";

test("assertNoUserDataDirProcesses stops when a rejected generated Chrome profile is still running", () => {
  assert.throws(
    () => assertNoUserDataDirProcesses({
      label: "Vidu automation Chrome",
      rejectedPaths: ["/Users/operator/.image-arranger/vidu-chrome"],
      commandLines: [
        "101 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/Users/operator/.image-arranger/vidu-chrome --profile-directory=Default",
        "202 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      ],
    }),
    /Vidu automation Chrome is still running/,
  );
});

test("assertNoUserDataDirProcesses ignores normal Chrome and unrelated user-data-dir processes", () => {
  assert.doesNotThrow(() => assertNoUserDataDirProcesses({
    label: "Vidu automation Chrome",
    rejectedPaths: ["/Users/operator/.image-arranger/vidu-chrome"],
    commandLines: [
      "202 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "303 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/Users/operator/tmp/other-profile",
    ],
  }));
});

test("assertUniqueProfileWindowLabel stops when another Chrome profile has the same visible name", () => {
  assert.throws(
    () => assertUniqueProfileWindowLabel(
      { profileDir: "Profile 1", profileName: "Work", email: "selected@example.com" },
      [
        { profileDir: "Default", profileName: "Personal", email: "personal@example.com" },
        { profileDir: "Profile 1", profileName: "Work", email: "selected@example.com" },
        { profileDir: "Profile 2", profileName: "Work", email: "other@example.com" },
      ],
    ),
    /Multiple Chrome profiles share the visible profile name "Work"/,
  );
});

test("assertUniqueProfileWindowLabel accepts a uniquely named Chrome profile", () => {
  assert.doesNotThrow(() => assertUniqueProfileWindowLabel(
    { profileDir: "Profile 1", profileName: "Work", email: "selected@example.com" },
    [
      { profileDir: "Default", profileName: "Personal", email: "personal@example.com" },
      { profileDir: "Profile 1", profileName: "Work", email: "selected@example.com" },
      { profileDir: "Profile 2", profileName: "Side", email: "other@example.com" },
    ],
  ));
});
