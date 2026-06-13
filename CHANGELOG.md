# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cmd+K / Ctrl+K command palette: fuzzy search across commands and every entry in every character (overview + prompt), with match highlighting and keyboard navigation.
- First-run guided tour: five coach-mark steps over the live UI, replayable from the "?" header button, with Back/Next/Skip and full keyboard support.
- Quality gate for important generations: entries can require an automated check of each generated candidate against their base references, with prompt-repair retries up to a per-entry attempt budget.
- Initial public release candidate: local-first prompt/asset manager with base (per-part canonical references), image, video, queue, and gallery tabs.
- Request-file contract (`image-arranger-request.v1`) for human or agent processors, with `draft-prompt`, `analyze`, `generate`, and `improve` actions.
- Optional CDP automation driver (`scripts/process-queue.mjs`) that processes queued ChatGPT image targets end to end with reviewable run logs.
- Bulk ZIP export of selected entries (`GET /api/export`).
- Visual start/end frame pickers and per-clip duration for video entries.
- Deck backup and export: every save writes `deck.json.bak` plus a rotating `workspace/.history/` snapshot; `GET /api/deck/export` and `POST /api/deck/import` provide a portable round-trip.
- Documented request-file spec (`docs/request-spec.md`) including the complete-API payload shapes and a "writing a service driver" guide.
- Manual, no-agent processing path documented in the README (register an asset to auto-complete the pending queue target).
- Japanese README parity (`README.ja.md`), a glossary, an alternatives/positioning section, and an OS-support matrix.
- GitHub issue templates (bug, feature, ChatGPT-UI-breakage, new-service) and a pull-request template.
- Scripted driver resilience: a `--check` selector self-test that reports when ChatGPT's UI has drifted, documented in `SELECTORS.md`.
- Demo agent (`scripts/demo-agent.mjs`, `npm run demo-agent`): completes queued requests with locally generated placeholder art, so the full queue → agent → result → adopt loop runs with zero accounts, services, or network.
- PNG metadata auto-import: prompts embedded by A1111, NovelAI, or ComfyUI auto-fill the prompt fields when you upload the PNG.
- App motion & UX system: animated view transitions, color-coded status badges, delete with Undo toast, adopt pop and fly-to-queue animations, busy/empty states, drag-drop and paste upload, and keyboard shortcuts (`/`, `1`–`5`, `n`, `g`) — all gated on `prefers-reduced-motion`.
- README workflow diagrams (EN/JA SVG), a conversion-focused README restructure, and a "Try the full loop in 60 seconds" guide.
- Agent bootstrap docs for Codex/Claude Code, including `CLAUDE.md`, a Quick bootstrap in `AGENTS.md`, and a CI boot-smoke check that starts the app and runs the demo agent.
- Create kit route cards, inline queue guidance, integrated analysis-result import flow, empty-source CTA, and selected-source count in JA/EN.
- Color-palette kit support: palette part keys are persisted, palette generation can be queued from adopted references, and adopted palettes can be attached to sheet requests as color authority references.
- Phase 5 UX assists: queue flow diagrams, prompt insertion chips, sheet request previews, pending return slots, qualityReport timelines, and quality-gate issue chips that queue targeted improve requests.
- Launch marketing drafts for X, note, dev.to, Reddit, plus posting checklist and FAQ under `docs/marketing/`.
- Create kit image upload: upload, drop, or paste a core image directly from the Create kit screen, with "Save as Master" enabled by default.

### Changed

- Default UI language is now detected from the browser (English unless the locale is Japanese); the sample deck and agent-handoff prompts have English versions. An explicit `deck.settings.lang` still wins.
- Font Awesome is vendored as inline SVG instead of loaded from a CDN — the app now works fully offline with zero third-party requests.
- `serveFile` supports HTTP Range/`206` and streams large assets, so video can be scrubbed without buffering the whole file.
- Scripted ChatGPT detection is locale-neutral and structural (assistant-turn first), reducing wrong-deliverable and false-refusal cases.
- Mutating API endpoints are serialized through a single-writer mutex to prevent lost updates.
- Internal: extracted `http-util.mjs` (path safety, Range serving, Host/Origin policy) and `prompts.mjs` (base-kit vocabulary) from `server.mjs` as a first step toward a modular layout.
- Landing page redesigned: problem-first hero with a copyable run command, self-playing demo loop, workflow scrollytelling, before/after, and FAQ — fully offline-safe and reduced-motion friendly.
- Sample deck v2 (courier-girl Aoi): every tab is populated on first run with locally generated art, and the queue is pre-seeded with one pending and one completed request.
- Startup now reports a self-solving command when the requested port is already in use.
- `npm run demo-agent -- --workspace ...` now honors the last repeated option, allowing npm-script defaults to be overridden cleanly.
- Gallery scope contract: the gallery shows every adopted still image across Base and Image entries (`source-reference` assets excluded).
- Create kit is now a continuous 1→2→3 flow: pick or upload a core image, create a character setup sheet, then optionally decompose into parts. Route cards, selected-count text, kit palette controls, and kit-level sheet quality gates were removed.
- Queue and Create kit copy now avoid implementation terms such as request files, commands, and agent handoff language in user-facing UI.
- Agent instructions now require real-screen GUI verification for frontend changes, including a context-less sub-agent check and visible after-click evidence for details/accordion/button flows.

### Fixed

- Accessibility: modals close on Escape, trap and restore focus, and expose `role="dialog"`/`aria-modal`.
- Remaining hardcoded Japanese UI strings now render in English when the UI language is English.
- Gallery works again under the strict CSP: its inline rendering engine (blocked by `default-src 'self'`) is extracted to `public/gallery.js`.
- Gallery favorite ids saved before entry-qualified gallery ids are migrated on load, so existing favorites remain selected.
- Create kit scrolling no longer depends on route-card expansion, and long scrollable views skip View Transitions to avoid frozen snapshot overlays.
- Create kit details controls now scroll newly revealed settings into view, so clicking "Details" near the viewport bottom no longer appears to do nothing.
- Create kit details rows now use full-width 44px click targets, so the empty area inside the visible row opens the settings too.

### Security

- Loopback-only Host/Origin policy, JSON Content-Type enforcement, `/asset` scoped to workspace assets/outputs, symlink-safe path resolution, and project-relative `sourceFile` registration.
- A strict `Content-Security-Policy` (`default-src 'self'`) and `X-Content-Type-Options: nosniff` are sent on served HTML.
- Schema-version guard: a deck written by a newer server is backed up and refused rather than silently mutated.
