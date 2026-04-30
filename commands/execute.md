---
description: Ask Codex to execute a semantic task in chat, exec, or structured-output mode
argument-hint: '[--background] [--mode chat|exec|structured] [--schema <json-schema-file>] [--profile <profile>] [task text]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `execute` intent through Codex Adapter. Prefer this when Claude wants Codex to answer, investigate, or run a non-review task.

Mode rules:
- `chat`: single-turn Codex chat-style response.
- `exec`: non-interactive Codex task execution.
- `structured`: non-interactive execution with `--schema <json-schema-file>` required.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" execute $ARGUMENTS`
