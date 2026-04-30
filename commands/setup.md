---
description: Check local Codex Adapter readiness: Codex install, auth, app-server support, and state path
argument-hint: '[--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" setup $ARGUMENTS`
