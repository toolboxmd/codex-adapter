---
description: Ask Codex to review code, a plan, or architecture adversarially through one semantic review intent
argument-hint: '[--background] [--mode code|plan|adversarial] [--base <ref>] [review focus]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `review` intent. Use `--mode code` for code/diff review, `--mode plan` for plan review, and `--mode adversarial` for design/risk challenge.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" review $ARGUMENTS`
