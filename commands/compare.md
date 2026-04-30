---
description: Ask 2-3 read-only Codex reviewers to compare a target and return consensus, disagreements, and deduped findings
argument-hint: '[--background] [--count 2|3] [--mode parallel-review] [--prompt-file <file>] [rubric]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run the semantic `compare` intent. MVP compare is read-only, bounded to 2-3 passes, and must not create worktrees or apply patches.

Use `--prompt-file <file>` for larger comparison rubrics. Resume flags are intentionally unsupported for compare.

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/codexctl.mjs" compare $ARGUMENTS`
