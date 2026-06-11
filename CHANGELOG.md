# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial public release candidate: local-first prompt/asset manager with base (per-part canonical references), image, video, queue, and gallery tabs.
- Request-file contract (`image-arranger-request.v1`) for human or agent processors, with `draft-prompt`, `analyze`, `generate`, and `improve` actions.
- Optional CDP automation driver (`scripts/process-queue.mjs`) that processes queued ChatGPT image targets end to end with reviewable run logs.
- Bulk ZIP export of selected entries (`GET /api/export`).
- Visual start/end frame pickers and per-clip duration for video entries.

### Security

- Loopback-only Host/Origin policy, JSON Content-Type enforcement, `/asset` scoped to workspace assets/outputs, symlink-safe path resolution, and project-relative `sourceFile` registration.
