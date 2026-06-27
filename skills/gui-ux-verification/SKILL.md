---
name: gui-ux-verification
description: Use when verifying frontend UI/UX behavior, especially scroll-driven screens, wizard-like flows, long forms, route cards, details/accordion toggles, or reports that a screen looks scrollable but cannot reach the expected action. Focuses on user-perceived operability, not just DOM metrics.
---

# GUI UX Verification

Use this skill when checking whether a UI is actually usable from the user's point of view.

## Core Rule

Do not mark a GUI issue fixed only because DOM metrics or an alternate implementation path works. A flow passes only when the user's natural visible path reaches the expected action without hidden assumptions.

For image-arranger work, use the operator-approved GUI/UX verification URL. In this repository's default workflow that URL is `http://127.0.0.1:4217/` unless the operator gives a newer URL. Saves and data changes are allowed only when the operator or repo-local rules allow them and they are needed to verify or fix the user-visible issue; record any mutation in the evidence.

For image-arranger browser operation that touches generation queues, ChatGPT, or
service-driver flows, use `skills/image-arranger-queue-processing`. That skill is
the canonical route and `scripts/process-service-queue.mjs` is the first-choice
executor. In short: let the common entrypoint route ChatGPT and Vidu targets to
their drivers, use only the locally selected existing Chrome profile for
ChatGPT, never launch a second browser for that profile, and never fall back to
Codex image generation, screenshots, placeholder files, a temporary Chrome
profile, or any other Google/ChatGPT profile.

For any frontend fix or user-reported UI bug, run a second check with a context-less sub-agent when the agent platform supports it. Start it with no conversation history (`fork_context: false` or equivalent), give only the running URL, user-visible task, user screenshot, and whether mutation is allowed for that check. The independent report must pass before saying "confirmed fixed"; otherwise document the remaining failure or limitation.

Close every sub-agent as soon as its assigned UI QA task is complete, cancelled, no longer needed, or superseded by a newer user request. A sub-agent is a per-task resource, not a standing reviewer; do not leave completed, failed, interrupted, or stale sub-agents open between tasks.

## Scroll And Continuation Checks

When a screen looks like it continues downward, verify the no-click scroll path:

1. Start from the same URL, data, tab, route, and viewport the user reported.
2. Use ordinary wheel/trackpad-like scrolling from visible content. Avoid `scrollTo`, direct DOM state changes, or jumping to controls for the primary proof.
3. If the bottom of the viewport shows cut-off text, partial cards, or content that visually implies more below, attempt another natural scroll from that area.
4. Record whether `window.scrollY` changed, what element is under the lower viewport, and whether the expected next action became visible and clickable.
5. If the screen appears continuous but the next step requires clicking a card/tile/route selector first, treat that as a UX/spec finding unless the UI clearly communicates the click requirement.

Treat a "false continuation" as a failure: text or cards appear at the bottom and make the screen look scrollable, additional text may partially come into view, but natural scrolling stops before the user can reach the actual processing controls. This is both a visual affordance problem and a flow/spec problem.

## Bottom Reachability Regression Checks

For any reported "cannot scroll to the bottom" issue, explicitly check the final content edge, not just whether the last item appears somewhere on screen.

- At the natural scroll stopping point, the last visible row/card/control must be fully visible and the lower viewport must no longer show clipped actionable content. Prefer seeing page padding/blank space below the final content; if the final content bottom sits inside the lower 80px, continue natural scrolling once more and record whether it moves.
- While not at the document bottom, perform at least two ordinary downward wheel/trackpad gestures from the lower visible content area. If `window.scrollY` does not change, inspect whether an inner scrollable ancestor legitimately consumed the gesture. If no inner scroller can still scroll, fail the screen as a stuck-wheel regression.
- If a fix claims to repair stuck wheel behavior, verify the rescue path in addition to the normal path when practical: in a temporary test session only, block the browser's default wheel scroll or reproduce the stuck state, then confirm another ordinary wheel gesture still makes progress or visibly removes the blocker. Do not mutate app data for this fault injection.
- Record the last content bounding box, `scrollY`, max scroll, the element under the lower viewport, and whether an extra natural wheel gesture after the apparent stopping point changed anything.

## Disclosure And Button Visibility Checks

Clicks must create visible feedback in the user's current path.

- For each visible details summary, accordion, route card, tab, toolbar button, and action button touched by the change, click it from a realistic scroll position.
- After the click, verify that new content, focus, selection, toast, navigation, disabled/enabled state, or the next actionable control is visible in the current viewport.
- Treat "the DOM opened below the fold" as a failure. If the user must perform a second manual scroll to discover that the click worked, the UI needs automatic scroll/focus or a different layout.
- For details/accordion controls near the bottom of the viewport, capture the before/after viewport state. The expanded content must be visible immediately after the click.
- Do not accept a test that only clicks a developer-known alternate route. If the screen reads as a continuous form, the continuous scroll path is the primary proof.

## Hit Target Checks

Clickable affordances must match their visible shape, not just their text.

- If a row, bordered field, card, chip, or toolbar item visually reads as one clickable control, click the empty area, right side, left side, and label/text area. All points inside the visible control should trigger the same action unless the UI clearly separates sub-actions.
- Treat "only the text is clickable" as a failure when the surrounding row/border/background implies a larger target.
- Details/accordion summaries should provide a full-row target at least 44px high on desktop and mobile. Verify by clicking away from the label text, especially near the far right edge of the row.
- Hover/focus feedback should cover the same area that is clickable. If hover lights up only a small text fragment inside a large visible control, report the mismatch.
- Record hit-target evidence with bounding boxes and click coordinates: visible control rect, actual clickable element rect, clicked point, and whether state changed.

## Viewport Bottom Checks

The bottom edge of the viewport is part of the UI, not disposable space.

- Test at least one normal desktop viewport and one short desktop viewport; use the reported viewport when known.
- Inspect the lower 80px of the viewport after scrolling and after every disclosure click.
- Fail the screen if text, buttons, summaries, cards, or form fields are clipped by a panel edge or the browser viewport in a way that suggests more content but natural scrolling cannot reveal it.
- Fail the screen if the final row is only barely visible at the viewport edge and an extra natural wheel gesture cannot create comfortable bottom clearance.
- Scroll naturally from the visible lower area before using programmatic `scrollTo`, search, or element focusing.
- When automatic scroll/focus is part of the fix, verify it by clicking from a position where the expanded content would otherwise land below the fold.

## Route Cards And Wizard-Like Screens

Do not assume a card must be clicked just because it has a click handler. First decide what the visible UI is telling the user:

- If the layout reads as a continuous form, scrolling should reveal the next controls.
- If the layout reads as route selection, the selected state and click requirement must be visually explicit.
- If both interpretations are plausible, test both and report the ambiguity as part of the bug.

For a reported "cannot scroll to the bottom" issue, the primary scenario is the user's path, not the developer shortcut. Do not click route cards, tabs, accordions, or hidden expanders unless the user-visible affordance makes that step obvious.

## Evidence To Capture

For each GUI verification, report the exact scenario:

- viewport size and URL
- starting screen/tab and data set
- actions performed in order, using user-level terms
- what was visible at the apparent stopping point
- whether further scroll changed the page
- the expected control or content that remained unreachable

Useful technical evidence includes bounding boxes, `scrollY` before/after a real scroll gesture, `scrollHeight`, and `elementFromPoint` near the bottom of the viewport. These support the conclusion; they do not replace the visible-path test.

## Regression From This Incident

Wrong verification pattern:

- Open the material creation screen.
- Click "A. Create sheet".
- Measure that the expanded Route A page can reach the queue button.
- Conclude the original screen scroll issue is fixed.

Correct verification pattern:

- Open the material creation screen at the top with real data.
- Scroll naturally through the adopted image list.
- When the route cards and lower text appear cut off, do not click a route card yet.
- Continue scrolling from the lower part of the viewport.
- If more text appears but scrolling then stops before the processing controls are reachable, the GUI is still broken.
- If a card click is required to reveal the processing controls, the UI must make that requirement explicit; otherwise the flow is still ambiguous.

Never report "confirmed fixed" until the correct verification pattern passes.
