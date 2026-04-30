---
description: Show durable Codex Adapter jobs and pending approvals for this workspace
argument-hint: '[--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" status $ARGUMENTS`
