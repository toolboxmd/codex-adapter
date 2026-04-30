# Publish Codex Adapter Plan

Date: 2026-04-30

Goal: move the finished `codex-adapter` MVP into a standalone repository at `/Users/lukaszmaj/dev/toolboxmd/codex-adapter`, include the research and planning files, initialize git, and publish it to GitHub as a public repository.

Steps:

1. Create the standalone target directory if it does not exist.
2. Copy `plugins/codex-adapter/` contents into the target root.
3. Copy research/planning files into `docs/research/`.
4. Add a repo-level README note or keep the plugin README as root README.
5. Run tests, validation, diagnostics smoke, and package dry run from the new location.
6. Initialize git, commit the standalone repo, create a public GitHub repository, and push.
7. Report the final GitHub URL and verification results.

Exclusions:

- Do not copy the old `codex-plugin-cc/` clone.
- Do not copy unrelated `task-plan-remove-infakt.md`.
- Do not copy local state artifacts from `~/.local/state/codex-adapter`.
