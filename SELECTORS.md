# SELECTORS.md — ChatGPT UI dependencies of the automation driver

The scripted queue processor (`scripts/process-queue.mjs`) drives ChatGPT's web
UI over the Chrome DevTools Protocol via `scripts/agent-browser.mjs`. Because it
talks to a **live third-party UI we don't control**, every CSS selector, regex,
and structural signal the automation depends on is **centralized** in
`scripts/agent-browser.mjs` so a ChatGPT redesign is a one-place fix.

This document lists every dependency, what it's for, where it lives, and how to
patch it when ChatGPT changes its UI.

> The driver is **best-effort**. When ChatGPT changes its UI, only the scripted
> ChatGPT pipeline is affected — the image-arranger **queue and the manual
> workflow always keep working**.

## How to know it broke

Run the self-test:

```
node scripts/process-queue.mjs --check
```

It opens the automation Chrome, confirms login, then probes the core selectors
against the live page. On a mismatch it prints:

```
>>> ChatGPT changed its UI — image-arranger's selectors need updating; see SELECTORS.md <<<
    missing selectors: composer, sendButton
```

and exits non-zero (exit code `3`). The self-test never crashes on a missing
element — it reports exactly which entries failed. Full results (matched
selector per entry) are saved to the run log under `agent-logs/`.

## Where the selectors live

| Symbol | File | Purpose |
| --- | --- | --- |
| `SELECTORS` | `scripts/agent-browser.mjs` | Core elements (probed by the self-test). Each entry is an **ordered candidate list**; the first selector that matches wins. |
| `SIGNALS` | `scripts/agent-browser.mjs` | Structural state signals used by reply / error / login detection (not probed as "must exist"). |
| `ERROR_TEXT` | `scripts/agent-browser.mjs` | Locale-neutral refusal/error copy regex (fast-path only). |
| `REPLY_STATE` | `scripts/agent-browser.mjs` | In-page snapshot: streaming?, overlay?, turn count, last-turn text, deliverable image srcs. |

---

## Core selectors (`SELECTORS`, self-tested)

Each is an ordered list of CSS candidates. The self-test reports an entry as OK
if **any** candidate matches a live element. `conversationTurn` is deferred on an
empty new chat, because no transcript turn exists until after the first message.

### `composer`
- **What:** the contenteditable box where the prompt is typed.
- **Candidates:** `#prompt-textarea`, `main div[contenteditable="true"]`
- **Used by:** `setPrompt`, `sendMessage` (composer-cleared check), `checkLogin`.

### `fileInput`
- **What:** the hidden `<input type=file>` that `DOM.setFileInputFiles` targets
  to attach reference images (no clipboard, no keystrokes).
- **Candidates:** `input[type="file"]`
- **Used by:** `attachImages` (first candidate is passed to `DOM.querySelector`).

### `sendButton`
- **What:** the "send message" button.
- **Candidates:** `[data-testid="send-button"]`, `button[aria-label*="Send"]`,
  `button[aria-label*="送信"]`
- **Used by:** `sendMessage`. The `data-testid` is the stable signal; the
  aria-label fallbacks cover EN and JP labels.

### `conversationTurn`
- **What:** one container per message turn in the transcript.
- **Candidates:** `[data-testid^="conversation-turn-"]`, `article`
- **Used by:** `REPLY_STATE` to scope the last turn and to decide whether an
  image sits in an assistant turn (deliverable) or the user's turn (reference).
- **Self-test note:** OK is reported as deferred when the check runs on an empty
  chat with no turns yet; the selector is exercised after a message is sent.

---

## Structural state signals (`SIGNALS`)

These are presence/structure checks, not "always on the page", so they are not
in the self-test's core set. They are what makes detection **locale-neutral**.

### `stopButton` — `[data-testid="stop-button"]`
Present while the assistant is streaming. Used to know generation is in flight.

### `imageGenOverlay` — `[data-testid^="image-gen-overlay"]`
The image-generation action overlay that marks a **finished** render. When
present, the driver returns the image immediately; when absent it requires two
stable polls so a progressive preview is not grabbed mid-generation.

### `modelSwitcher` — `[data-testid="model-switcher-dropdown-button"]`
The model / thinking-effort picker. Older ChatGPT builds expose a header
dropdown with this testid; current builds (2026-06) expose a composer button
labeled with the active tier (JP: 最速/標準/高/最高/Pro 拡張) whose menu uses
`[role="menuitemradio"]` items. `ensureModel()` (driven by
`--image-model <pattern>`) handles both: it finds the trigger via the testid or
a structural scan of `header/main/form button[aria-haspopup="menu"]` with a
model-ish label, opens it with a full pointer-event sequence (Radix menus open
on pointerdown), clicks the menuitem/menuitemradio matching the pattern, and
verifies the trigger label changed. Advisory: every failure path logs a warning
and the generation proceeds with the active tier. Verified live 2026-06-13
(高→標準→高 round-trip).

### `userMessage` — `[data-testid*="user-message"]`
Marks a turn as the user's. Locale-independent. Images inside a user turn are
reference attachments and are **never** treated as deliverables. **Monitored
signal** (see below): WARN-ONLY in the self-test.

### `assistantMessage` — `[data-message-author-role="assistant"], [data-testid*="assistant"]`
Positively marks a turn as the assistant's. **Preferred** over the negative
`userMessage` rule for deliverable detection: when this signal exists anywhere
in the conversation, a generated image is accepted **only** if it sits in an
assistant turn — so a user-uploaded reference image on a matching content host
can never be mistaken for the result, even if `userMessage` is dropped/renamed.
When ChatGPT exposes no assistant signal at all, detection falls back to the
looser "image in a non-`userMessage` turn" rule.

### `imageSrc` — regex `backend-api|estuary|oaiusercontent|files\.openai|^blob:`
Image hosts that serve real generated/uploaded bytes (vs. UI sprites/icons).
A deliverable image's `src` must match this. (The dot in `files\.openai` is
escaped in the code; keep this doc identical to the regex in `SIGNALS`.)

### `uploadThumb` — `form img`
Attachment thumbnails inside the composer. `attachImages` measures the count
before/after `DOM.setFileInputFiles` to confirm every reference image landed.

### `uploadSpinner` — `form [role="progressbar"], form svg.animate-spin, form circle[stroke-dashoffset]`
Any match means an attachment is still uploading. `attachImages` waits until the
thumbnail count is reached **and** no spinner remains.

---

## Monitored signals (WARN-ONLY in `--check`)

Three `SIGNALS` entries — `userMessage`, `imageGenOverlay`, and `modelSwitcher` — are probed by the
self-test as **monitored signals**. They are reported by `--check` when absent
(`monitored signal <name>: ABSENT`) but they are **never** load-bearing: a
missing monitored signal does **not** fail the self-test and does **not** cause
exit code `3`. Only the core `SELECTORS` are load-bearing — they alone fail the
gate. Monitored signals flag a UI drift that detection can still tolerate
because it has a fallback (e.g. `assistantMessage`-based detection, or the
two-stable-poll wait when no `imageGenOverlay` is present).

The self-test result therefore carries a `warnings: [{ name, selector, present }]`
array alongside the load-bearing `checks` / `missing`.

---

## Locale-neutral detection (the point of P2-SEL-2)

Detection must **not** assume the UI is in Japanese (or any language).

### Finished-image detection (`REPLY_STATE`)
Decided **structurally**, in priority order:
1. The image's `src` matches `SIGNALS.imageSrc` (real content host).
2. It is **not** inside a `<form>` (excludes the composer's own attachment row).
3. Turn-scope, **assistant-signal-first**:
   - If an `assistantMessage` signal exists **anywhere** in the conversation,
     the image is accepted **only** when its `conversationTurn` is an assistant
     turn. A reference image uploaded by the user (matching content host, not in
     a `<form>`) is therefore rejected even if `userMessage` was dropped/renamed.
   - **Fallback** (no `assistantMessage` signal anywhere): the legacy negative
     rule — accept an image in a `conversationTurn` that is **not** a
     `userMessage` turn.
   When the structure resolves either way, **alt text and image size are
   ignored**.
4. **Fallback only** when no turn container resolves (markup drift): a localized
   "generated image" alt prefix (a list covering JA/EN/ES/FR/DE/PT/IT/KO/ZH),
   then `naturalWidth > 600` as the last-resort heuristic.

`SIGNALS.imageGenOverlay` is the positive "render finished" signal used to skip
the stabilization wait.

### Error / refusal detection (`ERROR_TEXT`)
A regex covering refusal/policy copy across common locales
(EN, JA, ES, FR, DE, PT, IT, KO, ZH). It is a **fast-path only** — the real
safety net is structural (the image never lands, no overlay) plus the pipeline's
built-in retries, so an occasional false positive merely costs one retry.
Direct refusals ("can't create that image", "no puedo generar") match
standalone; **generic policy/guideline words** (policy / guideline /
`Richtlinien`) only match when a **refusal/violation cue is nearby**
(`violat…`, `against …polic`, `gegen …Richtlinien`, etc.), so benign assistant
prose that merely mentions guidelines is not treated as a refusal.

### Login detection (`checkLogin`)
A logged-out chatgpt.com still shows a composer, so logout is detected
**structurally and locale-agnostically**, in order:
1. Auth elements: `a[href*="/auth/login"]`, `a[href*="/auth/signup"]`,
   `[data-testid="login-button"]`, `[data-testid*="signup"]`.
2. URL: `location.pathname` matches `/auth/(login|signup)`.
3. Header text fallback only if the above are inconclusive (broadened well
   beyond JP/EN).
Login is confirmed "ok" only when the composer is present and no logout signal
fired.

---

## How to patch when ChatGPT changes its UI

1. **Reproduce:** `node scripts/process-queue.mjs --check`. Note which entries
   the self-test reports as `NOT FOUND`.
2. **Inspect the live page:** open the automation Chrome window (it stays open),
   open DevTools, and find the new element for the failing entry. Prefer a
   **stable `data-testid`** over a class name or DOM path — testids survive
   restyles; classes are hashed and churn.
3. **Edit one place:** update the candidate list for that entry in `SELECTORS`
   (or `SIGNALS`) in `scripts/agent-browser.mjs`. **Prepend** the new selector
   and keep the old one as a fallback so both UI versions work during rollout.
4. **Stay locale-neutral:** never rely on UI-language text as the *primary*
   signal. Use `data-testid` / structure first; if you must match text, add it
   to the locale list rather than replacing it.
5. **Re-run the self-test** until it passes, then run one real target
   (`--max 1`) and review the screenshots in `agent-logs/<run>/shots/`.
6. **Update this file** if you add a new selector or signal.

When reporting breakage upstream, include: the failing entry name, the
self-test output, and a screenshot from the run log.
