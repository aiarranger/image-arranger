# Claude Code Bootstrap

`AGENTS.md` is the canonical operator guide for this repository. Start with its
**Quick bootstrap** section, then use the sections below only as a short index.

## Normal Loop

- Start the sample app with `npm start`, then open `http://127.0.0.1:4217/`.
- Try the local placeholder processor with `npm run demo-agent`.
- Run `npm test` before handing work back.

The demo agent processes image/analyze/draft/improve requests. It skips the sample
workspace's pre-seeded video request by design; queue an image request from the UI if
you want to see a result registered as a candidate.

## Validation

- Syntax and script checks: `npm run check`
- Unit tests: `npm test`
- Publish/doctor checks: `npm run doctor`

## Real Queue Processing

For the full request-file contract, scripted ChatGPT driver, manual fallback,
analysis, draft-prompt, and video procedures, follow `AGENTS.md`. Avoid keeping a
second copy of those instructions here.
