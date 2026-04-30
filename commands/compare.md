---
description: Ask 2-3 read-only Codex reviewers to compare a target and return consensus, disagreements, and deduped findings
argument-hint: '[--background] [--count 2|3] [--mode parallel-review] [rubric]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `compare` intent. MVP compare is read-only, bounded to 2-3 passes, and must not create worktrees or apply patches.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" compare $ARGUMENTS`
