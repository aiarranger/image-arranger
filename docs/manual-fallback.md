# Manual Browser Fallback — Field-Tested Techniques

This document holds the deep, field-tested browser-automation techniques an agent needs
**only when the scripted processor (`scripts/process-queue.mjs`) cannot be repaired**
and you must drive the generation service's web UI by hand.

It is referenced from [AGENTS.md](../AGENTS.md). Prefer the scripted processor; this is a
last resort, and the truly stable interface is the
[request-file contract](request-spec.md). When you fall back here, still write your own
steps and screenshots into an `agent-logs/run-*/` folder so the operator gets the same
audit record the script would have produced.

> **Platform note:** these keystroke techniques are **macOS-only** (they use
> `osascript` / `pbcopy` / `pbpaste`). Windows / Linux equivalents are not established
> yet. See the [one-time macOS setup](../AGENTS.md#one-time-macos-setup-for-real-os-keystrokes)
> in AGENTS.md for the required Automation and Accessibility permissions.

## Browser Technique for Analysis / Generation Tasks (field-tested)

1. **Attaching the image** — never open the native file picker (it blocks automation).
   In-page `fetch` of local files is blocked by the service's CSP, and virtual-clipboard
   paste fails. The reliable route is **real clipboard + real keystroke** (field-tested
   2026-06-10):
   1. `osascript -e 'set the clipboard to (read (POSIX file "<absolute path>") as «class PNGf»)'`
   2. Navigate your working tab to a unique URL first (e.g.
      `https://chatgpt.com/?agent-work=1`), then use AppleScript to activate exactly that
      tab (scan windows/tabs for the URL marker) — otherwise the keystroke can land in
      another tab of the same site.
   3. Click the composer with your browser tool to focus it.
   4. `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
   5. Wait for the thumbnail spinner to finish before continuing. Repeat per image for
      multiple references.

   If your environment can set `input[type=file]` directly (Playwright etc.), that also
   works (it does not open the native dialog).

2. **Entering the prompt** — try in this order, and ALWAYS verify the full text appears in
   the composer before sending (never send empty); if one tier fails, move to the next:
   1. Your browser tool's native text-input API (type/fill), if available.
   2. In-page JS (only in environments with real page-context JS; some agents' JS
      sandboxes cannot see `document.execCommand`):

      ```js
      const ed = document.querySelector('div[contenteditable="true"]');
      ed.focus();
      document.execCommand("insertText", false, "<full prompt>");
      ```

   3. Real text clipboard (deterministic last resort): set it via argv-style osascript
      (piped `pbcopy` can silently produce an empty clipboard), verify with `pbpaste`,
      then click the composer and send a real Cmd+V. Do this only AFTER all image
      attachments are done (it overwrites the clipboard).

      ```bash
      osascript -e 'on run argv' -e 'set the clipboard to item 1 of argv' -e 'end run' "$(cat /tmp/prompt.txt)"
      pbpaste | head -c 80
      ```

   On start/resume, if the composer still holds unsent attachments from a previous
   interrupted run, remove them (×) before starting.

3. **Tempo** — once the attachment spinner finishes, insert the prompt and send
   immediately in one go; verify with at most one screenshot before and after sending.

4. **Waiting** — extended-thinking models can take 5–15 minutes. Poll with light text
   reads every 30–60 s; do not reload or resend.

5. **Collecting the JSON** (analysis tasks) — click the code block's built-in copy button
   and read the system clipboard (`pbpaste`), or read the `pre code` textContent from the
   DOM. `navigator.clipboard.writeText` from injected JS can fail due to focus
   constraints. Validate the JSON locally before posting it to the complete API.

## Reporting back

Whichever path you use, report completion through the
[request-file contract](request-spec.md) — preferably `POST /api/requests/complete`, or by
editing the request JSON directly when the server is unreachable.
