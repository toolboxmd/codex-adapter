---
description: Ask Codex for a source-oriented web/search pass when diagnostics show search is advertised by the installed Codex
argument-hint: '[--background] [--mode facts|sources|recency] [--prompt-file <file>] [question]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `search` intent. It must fail closed when Codex search is unavailable and should return dated findings with sources when available.

Use `--prompt-file <file>` for longer source requirements or citation rubrics.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" search $ARGUMENTS`
