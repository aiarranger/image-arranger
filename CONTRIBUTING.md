# Contributing

Thank you for considering a contribution to image-arranger.

## Local Checks

Run these before sending a pull request:

```bash
node --check server.mjs
node --check public/app.js
node --test server.test.mjs
node server.mjs --workspace ./workspace/demo --init sample --doctor
```

## Scope

image-arranger is a local-first prompt and asset request manager. It should not depend on a specific project, paid generation service, browser profile, or private asset library.

When adding features:

- Keep the default sample data public and project-neutral.
- Do not commit generated images, videos, request files, outputs, secrets, cookies, or personal paths.
- Prefer small dependency-free changes unless a dependency is clearly necessary.
- Keep ChatGPT, Vidu, and other generation services as external tools. image-arranger writes request files; it does not automate accounts or bypass service UIs.

## Pull Requests

Please include:

- What changed.
- Why it is needed.
- How it was verified.
- Whether any sample data, generated assets, or provenance metadata changed.
