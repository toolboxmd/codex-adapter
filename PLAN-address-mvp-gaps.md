# Plan: Address MVP Gaps

Date: 2026-04-30

## Goals

- Verify the current CLI wrapper, slash command, and agent wiring.
- Add large-prompt support if missing, preferably through `--prompt-file`.
- Add resume support if the installed Codex CLI exposes a usable resume flag.
- Make delegated-agent behavior explicit and wired to the adapter commands.
- Preserve the existing safety model: profile gates, read-only compare, and structured output validation.
- Update tests and documentation for any changed command surface.

## Steps

1. Inspect the repository structure, command definitions, tests, and existing docs.
2. Confirm how `codexctl.mjs` and `codex-runs.mjs` build and execute Codex CLI argv.
3. Implement scoped CLI changes for prompt-file/resume/agent wiring.
4. Add or update tests around argv construction, validation, and delegated command behavior.
5. Run the relevant test suite and diagnostics locally where possible.
6. Update project wiki/docs only if the code changes are structural enough to warrant it.
