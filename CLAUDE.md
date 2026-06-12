# Claude Code Bootstrap

`AGENTS.md` is the canonical operator guide for this repository. Start with its
**Quick bootstrap** section. Keep this file as an index, not a second command table.

## Claude Code Notes

- **Data safety first**: read the "Workspace & test-data safety" section of `AGENTS.md`,
  and `workspace/_LOCAL_RULES.md` if it exists (operator-specific; overrides defaults).
  Tests run only in `/tmp` workspaces on ports 4901-4999; close any browser tab you open.
- Use `AGENTS.md` for the current start/test/demo commands, including non-default
  port or workspace examples.
- If a local server is already on the default port, follow the direct
  `node server.mjs --workspace ... --port ...` pattern from `AGENTS.md`; do not
  duplicate or improvise npm-script argument recipes here.
- Run the validation commands named in `AGENTS.md` before handing work back.

## Real Queue Processing

For the full request-file contract, scripted ChatGPT driver, manual fallback,
analysis, draft-prompt, and video procedures, follow `AGENTS.md`. Avoid keeping a
second copy of those instructions here.
