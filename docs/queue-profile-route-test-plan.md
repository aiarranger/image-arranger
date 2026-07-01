# Queue Profile Route Test Plan

Scope: ChatGPT/Vidu queue drivers must use one shared, profile-safe Chrome
marker-tab route and must not open or probe other Chrome profiles.

## Automated Unit / Regression Cases

| ID | Pattern | Expected result | Covered by |
| --- | --- | --- | --- |
| ROUTE-01 | Marker tab already exists | Reuse it; do not open another tab | `service-browser-route.test.mjs` |
| ROUTE-02 | Marker tab missing | Use only the shared profile-safe open route, then refind | `service-browser-route.test.mjs` |
| ROUTE-03 | Initial find throws transient AppleScript/bridge error | Try shared profile-safe repair once and keep the initial error for diagnostics | `service-browser-route.test.mjs` |
| ROUTE-04 | Profile-safe repair throws | Stop with a message that forbids launching/probing other profiles | `service-browser-route.test.mjs` |
| ROUTE-05 | Repair opens but marker still absent | Stop; do not continue to service upload/send | `service-browser-route.test.mjs` |
| ROUTE-06 | Service-specific failure message | Preserve custom Vidu/ChatGPT failure detail | `service-browser-route.test.mjs` |
| ROUTE-07 | ChatGPT driver marker setup | Driver imports and uses shared marker route, not service-owned open logic | `queue-profile-route-regression.test.mjs` |
| ROUTE-08 | Vidu driver marker setup | Driver imports and uses shared marker route, not service-owned open logic | `queue-profile-route-regression.test.mjs` |
| ROUTE-09 | Vidu direct Chrome executable launch returns | Test fails if `/Applications/Google Chrome...` or `spawn(...Google Chrome...)` returns | `queue-profile-route-regression.test.mjs` |
| ROUTE-10 | Vidu profile probing returns | Test fails if `detectLoggedInViduProfile`, `probeViduProfile`, or auto profile rewrite returns | `queue-profile-route-regression.test.mjs` |
| ROUTE-11 | Common entrypoint exposes probe escape flags | Test fails if `--allow-profile-probe` or `--allow-marker-launch` returns | `queue-profile-route-regression.test.mjs` |
| ROUTE-12 | Docs contradict the route rule | Test fails if docs say the driver must automatically probe signed-in profiles | `queue-profile-route-regression.test.mjs` |
| MULTI-01 | Matching marker URL exists in a wrong Chrome profile, and the selected profile window also exists | Ignore the wrong-profile marker, create/refind the marker only in the selected profile | `service-browser-route.test.mjs`, `npm run test:real-browser-route` |
| MULTI-02 | Matching marker URL exists in a wrong Chrome profile, and no selected-profile window can be proven | Stop; do not open another Chrome profile and do not probe profiles | `service-browser-route.test.mjs`, `npm run test:real-browser-route` |
| MULTI-03 | Rejected generated/automation Chrome `--user-data-dir` process is still running | Stop before using the normal-profile route | `service-browser-profile.test.mjs` |
| MULTI-04 | macOS route sees multiple Chrome windows/tabs | Use the same ChatGPT/Vidu marker route and Chrome window profile label; never open `chrome://version` | `queue-profile-route-regression.test.mjs`, `npm run test:real-browser-route` |
| HUMAN-01 | Human closes the marker tab during profile-safe repair | Stop after refind fails; do not continue to upload/send/create | `service-browser-route.test.mjs`, `npm run test:real-browser-route` |
| HUMAN-02 | Human switches/moves the target so page JavaScript would run against a wrong-profile marker | Stop with profile-mismatch before executing page JavaScript | `queue-profile-route-regression.test.mjs`, `npm run test:real-browser-route` |
| HUMAN-03 | Human opens extra Vidu/ChatGPT profile while AI is operating | Ignore extra profile/window unless it matches the saved selected profile proof | `service-browser-route.test.mjs`, `npm run test:real-browser-route` |
| HUMAN-04 | Vidu marker tab disappears during processing | Stop and require rerun of common marker setup/check; do not auto-reopen or resubmit | `queue-profile-route-regression.test.mjs` |
| HUMAN-05 | Human manually starts an active Vidu task before AI submits | Active Vidu task check stops before create submit | `process-vidu-queue.mjs` guard; confirm during Vidu service check when present |
| HUMAN-06 | Vidu create page shows a selected old history/result video before current upload | `--check` logs the old visible result as preexisting; processing records visible video/direct MP4 URLs as the baseline, verifies the current upload and prompt, then ignores baseline URLs while waiting for the new result | `queue-profile-route-regression.test.mjs`, live Vidu check when present |
| HUMAN-07 | macOS ChatGPT/Vidu processing opens `chrome://version`, `about:blank`, or repeated marker tabs during one operation | Stop the run, cancel the queued test target if needed, and fix the shared route. Vidu may use `run=...` only as the current marker URL, not as a separate profile-proof path | `queue-profile-route-regression.test.mjs`, live service observation |
| VIDU-UP-01 | Vidu start-only request, one input | Upload exactly one file into first image input | `vidu-upload-plan.test.mjs` |
| VIDU-UP-02 | Vidu start-only request, two inputs visible | Still upload exactly one file into first image input; leave second empty | `vidu-upload-plan.test.mjs` |
| VIDU-UP-03 | Vidu start/end request, two inputs visible | Upload start to first input and end to second input | `vidu-upload-plan.test.mjs` |
| VIDU-UP-04 | Vidu start/end request, one multiple-file input | Upload both files into first input and fire the drop fallback | `vidu-upload-plan.test.mjs` |
| VIDU-UP-05 | No Vidu image input | Report `file input not found`; do not submit | `vidu-upload-plan.test.mjs` |
| VIDU-UP-06 | Invalid frame count | Reject 0 or 3+ files before upload | `vidu-upload-plan.test.mjs` |
| VIDU-UP-07 | Browser-injected planner source | The same planner source is executable in page context | `vidu-upload-plan.test.mjs` |
| BRIDGE-01 | Windows bridge duplicate email before binding | Stop instead of guessing profile | `chrome-bridge.test.mjs` |
| BRIDGE-02 | Windows bridge command dispatch | Commands go to selected profile email/client | `chrome-bridge.test.mjs` |
| BRIDGE-03 | Windows bridge tab miss | Requeue only to another matching profile client | `chrome-bridge.test.mjs` |
| MARKER-01 | Vidu marker URL | Marker contains `profile-directory` and `profile-email` | `vidu-route-helpers.test.mjs` |
| MARKER-02 | Vidu logged-out detection | Login actions are detected; daily login bonus text is ignored | `vidu-route-helpers.test.mjs` |

## Real Browser Profile Route Cases

Routine validation uses the operator's already-running saved normal Chrome
profile from `workspace/.local/chatgpt-profile.json`. It does not launch a
temporary `--user-data-dir` Chrome while normal Chrome is open, because macOS
AppleScript addresses the running `Google Chrome` application and can otherwise
inspect the wrong browser instance. Test actions are restricted to unique local
marker URLs and are cleaned up by marker id.
On macOS, the route must not use `chrome://version` for profile proof. The
real-browser test confirms the shared marker/window-label route works against
the saved profile, stops when a human closes the marker during repair, and
executes ChatGPT send through the same profile-safe route.

| ID | Pattern | Expected result |
| --- | --- | --- |
| REAL-NORMAL-01 | Saved normal Chrome profile is already running and marker is missing | The shared route creates/refinds the marker in the saved selected profile only |
| REAL-NORMAL-02 | Page JavaScript runs through the marker route | JavaScript executes only after the saved profile window label is verified |
| REAL-NORMAL-03 | Marker tab is closed immediately after repair | The shared route stops after refind, matching a human closing the tab during AI operation |
| REAL-NORMAL-04 | Fake ChatGPT page uses the same macOS send route | Send operates through the saved selected profile, not a service-specific tab scan |

Command:

```bash
npm run test:real-browser-route
```

The underlying script still accepts direct strict mode without
`--allow-existing-chrome`; that mode intentionally refuses to run while any
normal Chrome process is open and is reserved for disposable isolated route
debugging. Use the npm script for routine validation because it covers the real
operator condition where ChatGPT/Vidu Chrome is already open.

## Live No-Browser Stop Cases

These are verified with Chrome closed. They intentionally do not open browser
windows.

| ID | Command | Expected result |
| --- | --- | --- |
| LIVE-01 | `node scripts/process-service-queue.mjs --service vidu --check` | exits non-zero, says Chrome is not running, and does not start Chrome |
| LIVE-02 | `node scripts/process-service-queue.mjs --service chatgpt --check --ensure-tab` | exits non-zero, says Chrome is not running, and does not start Chrome |
| LIVE-03 | `pgrep -x "Google Chrome"` after LIVE-01/02 | no process |

## Live Service Check Cases

These cases check the real saved ChatGPT/Vidu normal Chrome profile without
submitting generation requests. They are separate from normal queue processing:
the service drivers still must not launch Chrome by themselves. The saved normal
Chrome profile must already be running. Do not prepare live checks with
`open -na "Google Chrome" --args --profile-directory=...`; that can route into
the wrong profile when Chrome is already open. After checks, verify no
`ia-real-browser`, `agent-chrome`, or `vidu-chrome` process is left.

| ID | Command | Expected result |
| --- | --- | --- |
| LIVE-SVC-01 | `node scripts/process-service-queue.mjs --service chatgpt --check --ensure-tab --server http://127.0.0.1:4217` | exits 0; selected marker tab is in the saved profile window, ChatGPT is signed in, not rate-limited, and composer exists |
| LIVE-SVC-02 | `node scripts/process-service-queue.mjs --service vidu --check --server http://127.0.0.1:4217` | exits 0 only when selected-profile Vidu marker tab is reused or repaired, the create form is ready, and no active task blocks create. If an old selected history/result video is visible, the check logs it as preexisting baseline evidence instead of treating it as current work |

## Full Validation Commands

```bash
npm run check
npm test
npm run test:real-browser-route
curl -fsS http://127.0.0.1:4217/api/state >/dev/null
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217 --service vidu --check # with Chrome closed, expected non-zero
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217 --service chatgpt --check --ensure-tab # with Chrome closed, expected non-zero
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217 --service vidu --check
node scripts/process-service-queue.mjs --server http://127.0.0.1:4217 --service chatgpt --check --ensure-tab
ps -ax -o pid=,command= | rg '[i]a-real-browser|[a]gent-chrome|[v]idu-chrome' # expected no output
```
