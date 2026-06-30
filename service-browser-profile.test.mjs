import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoUserDataDirProcesses } from "./scripts/service-browser-profile.mjs";

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
