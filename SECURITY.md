# Security Policy

image-arranger is intended to run on localhost and manage local files. Treat uploaded or registered assets, prompts, and request files as untrusted input.

## Reporting Vulnerabilities

Please report vulnerabilities privately through GitHub Security Advisories on the
[aiarranger/image-arranger](https://github.com/aiarranger/image-arranger/security/advisories/new)
repository ("Report a vulnerability"). Do not open a public issue for security reports.

Do not disclose exploitable details publicly until the maintainer has had time to respond.

## Local Safety Expectations

- Do not expose image-arranger to the public internet.
- Do not commit workspaces that contain private prompts, generated assets, browser downloads, secrets, or absolute local paths.
- Run `node server.mjs --workspace ./workspace/demo --init sample --doctor` before publishing a repository snapshot.
- Keep generated assets and their usage rights documented with `sourceLicense`, `aiGenerated`, `humanReviewed`, and `usageNotes`.
