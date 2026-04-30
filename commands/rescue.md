---
description: Ask Codex to diagnose or fix one scoped bug or stuck task with an explicit stop condition
argument-hint: '[--background] [--mode diagnose|fix] [--prompt-file <file>] [--resume <session-id>|--resume-last] [--profile review-readonly|rescue-workspace] [problem statement]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `rescue` intent. Default to diagnosis. Use a write-capable profile only when the user or current task explicitly authorizes edits.

Use `--prompt-file <file>` for long failure reports or implementation contracts. Use resume flags only for continuing an existing Codex exec session.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" rescue $ARGUMENTS`
