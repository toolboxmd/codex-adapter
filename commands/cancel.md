---
description: Cancel a running Codex Adapter job and deny any pending approval
argument-hint: '<job-id> [--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" cancel $ARGUMENTS`
