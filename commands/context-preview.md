---
description: Preview exactly what context Codex Adapter would send for a semantic intent, including redactions and egress implications
argument-hint: '[--intent execute|review|rescue|search|compare] [--mode <mode>] [task text]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" context-preview $ARGUMENTS`
