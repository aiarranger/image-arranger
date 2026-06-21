# Contributing

Thank you for considering a contribution to image-arranger.

## Local Checks

Run these before sending a pull request:

```bash
npm run check
npm test
npm run doctor
```

## Scope

image-arranger is a local-first prompt and asset request manager. It should not depend on a specific project, paid generation service, browser profile, or private asset library.

When adding features:

- Keep the default sample data public and project-neutral.
- Do not commit generated images, videos, request files, outputs, secrets, cookies, or personal paths.
- Prefer small dependency-free changes unless a dependency is clearly necessary.
- Keep generation services external to the **server**: `server.mjs` never calls or automates ChatGPT, Vidu, or any other service — it only writes request files. Automation drivers live under `scripts/` as optional, user-operated tools with an explicit disclaimer; the stable interface for processors is the request-file contract, not any particular driver.

## Pull Requests

Please include:

- What changed.
- Why it is needed.
- How it was verified.
- Whether any sample data, generated assets, or provenance metadata changed.
