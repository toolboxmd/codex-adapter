---
description: Ask Codex to diagnose or fix one scoped bug or stuck task with an explicit stop condition
argument-hint: '[--background] [--mode diagnose|fix] [--profile review-readonly|rescue-workspace] [problem statement]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `rescue` intent. Default to diagnosis. Use a write-capable profile only when the user or current task explicitly authorizes edits.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" rescue $ARGUMENTS`
