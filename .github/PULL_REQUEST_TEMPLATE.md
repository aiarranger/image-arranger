<!--
Thanks for contributing! Please keep changes dependency-free, keep sample data
public-safe, and keep generation services external to the server. See CONTRIBUTING.md.
-->

## What changed

<!-- A short summary of the change. -->

## Why it is needed

<!-- The problem this solves or the motivation. -->

## How it was verified

<!-- The checks you ran. At minimum: -->

```bash
node --check server.mjs
node --check public/app.js
node --check scripts/process-queue.mjs
node --check scripts/agent-browser.mjs
node --test server.test.mjs
node server.mjs --workspace ./workspace/demo --init sample --doctor
```

## Sample data / provenance

<!-- State whether any sample data, generated assets, or provenance metadata changed. -->

---

- [ ] No runtime npm dependencies were added; no build step was introduced.
- [ ] Generation stays external to the server (`server.mjs` does not call or automate any service).
- [ ] No generated images/videos, request files, outputs, secrets, cookies, or personal paths were committed.
