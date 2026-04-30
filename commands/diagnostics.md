---
description: Show Codex Adapter compatibility diagnostics, including Codex version, auth, app-server, search gate, sandbox, and MCP visibility
argument-hint: '[--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" diagnostics $ARGUMENTS`
