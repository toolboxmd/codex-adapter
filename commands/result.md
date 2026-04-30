---
description: Show the persisted result for a Codex Adapter job
argument-hint: '[job-id] [--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" result $ARGUMENTS`
