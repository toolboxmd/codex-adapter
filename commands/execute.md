---
description: Ask Codex to execute a semantic task in chat, exec, or structured-output mode
argument-hint: '[--background] [--mode chat|exec|structured] [--prompt-file <file>] [--resume <session-id>|--resume-last] [--schema <json-schema-file>] [--profile <profile>] [task text]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `execute` intent through Codex Adapter. Prefer this when Claude wants Codex to answer, investigate, or run a non-review task.

Mode rules:
- `chat`: single-turn Codex chat-style response.
- `exec`: non-interactive Codex task execution.
- `structured`: non-interactive execution with `--schema <json-schema-file>` required.

Use `--prompt-file <file>` for long structured prompts. Use `--resume <session-id>` or `--resume-last` only when intentionally continuing an existing Codex exec session.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" execute $ARGUMENTS`
