---
name: codex-adapter
description: Use when Claude Code should delegate to local Codex through the codex-adapter plugin: source-oriented search, code/plan/adversarial review, scoped bug rescue, non-review Codex execution, or 2-3 read-only parallel review comparison. Do not use for trivial local edits, direct shell commands Claude can run itself, or when the user has prohibited external/model egress.
---

# Codex Adapter

Use this skill to choose a semantic Codex Adapter intent. Claude should not reason about Codex app-server methods directly.

## Intent Choice

| Need | Intent | Default mode | Notes |
|---|---|---|---|
| Ask Codex to answer or investigate | `execute` | `chat` | Use `exec` for non-interactive task execution; use `structured` only with `--schema`. |
| Review code or a diff | `review` | `code` | Read-only; findings first. |
| Review a plan/spec | `review` | `plan` | Use before implementation when design uncertainty is high. |
| Challenge architecture or assumptions | `review` | `adversarial` | Use for risk, tradeoff, and failure-mode critique. |
| Diagnose or fix one stuck bug | `rescue` | `diagnose` | Escalate to `fix` only when writes are explicitly allowed. |
| Search external facts | `search` | `sources` | Requires diagnostics to show search is advertised; cite sources or fail closed. |
| Compare multiple independent opinions | `compare` | `parallel-review` | Read-only, count 2-3, no worktrees in MVP. |

## Operating Rules

1. Run `/codex-adapter:diagnostics` first if Codex availability, auth, search, or sandbox state is uncertain.
2. Run `/codex-adapter:context-preview` before sending broad, sensitive, or ambiguous context.
3. Prefer semantic commands over internal Codex concepts: `review mode=plan`, not "thread start with plan prompt".
4. Use `--prompt-file <file>` for large structured prompts, contracts, rubrics, or asset-list schemas.
5. Use `--resume <session-id>` or `--resume-last` only for `execute` and `rescue` when intentionally continuing a previous Codex exec session.
6. Never approve write, network, MCP, or sandbox escalation unless the active profile explicitly allows it.
7. After write-capable rescue, inspect the diff and run verification before accepting the result.

## Result Handling

- For `review`, preserve findings with severity and file references.
- For `search`, preserve source URLs and dates; if unavailable, report the gate reason.
- For `compare`, report consensus, disagreements, and deduped findings.
- For `rescue`, report diagnosis, attempted actions, touched files, and verification status.
- For `execute`, report final answer and artifact paths.

See `references/intent-contract.md` for the full command contract.
