# Security Policy

image-arranger is intended to run on localhost and manage local files. Treat uploaded or registered assets, prompts, and request files as untrusted input.

## Threat Model

The server binds to `127.0.0.1` only, but **any web page you browse while the server is running can still attempt requests against it** (DNS rebinding, CSRF onto localhost). The server mitigates this:

- Requests whose `Host` header is not a loopback name (`127.0.0.1`, `localhost`, `[::1]`) are rejected with 403.
- State-changing requests (non-GET) that carry a non-loopback `Origin` header are rejected with 403. Requests without an `Origin` (curl, scripts) are allowed.
- API bodies must be `application/json` (415 otherwise).
- `/asset` serves only files inside the workspace `assets/` and `outputs/` directories — never source code, configuration, or `deck.json` — and sends no CORS headers.
- File paths are confined to the project root, including after symlink resolution; `sourceFile` registration accepts project-relative paths only.

## Reporting Vulnerabilities

Please report vulnerabilities privately through GitHub Security Advisories on the
[aiarranger/image-arranger](https://github.com/aiarranger/image-arranger/security/advisories/new)
repository ("Report a vulnerability"). Do not open a public issue for security reports.

Do not disclose exploitable details publicly until the maintainer has had time to respond.

## Local Safety Expectations

- Do not expose image-arranger to the public internet.
- Do not commit workspaces that contain private prompts, generated assets, browser downloads, secrets, or absolute local paths.
- Run `node server.mjs --workspace ./workspace/sample --init sample --doctor` before publishing a repository snapshot.
- Keep generated assets and their usage rights documented with `sourceLicense`, `aiGenerated`, `humanReviewed`, and `usageNotes`.
