# Codex Adapter MVP Implementation Checklist

Date: 2026-04-29

This checklist implements the finalized semantic MVP from `rewrite-codex-cc-plan.md`.

## MVP Product Contract

Build a local Claude Code plugin at `plugins/codex-adapter/` that lets Claude agents use Codex through semantic intents instead of Codex internals.

Public controls:

- `setup`
- `diagnostics`
- `context-preview`
- `status`
- `result`
- `cancel`

Public intents:

- `execute` with modes `chat`, `exec`, `structured`
- `review` with modes `code`, `plan`, `adversarial`
- `rescue` with modes `diagnose`, `fix`
- `search` gated by Codex search availability
- `compare` gated read-only fan-out, count 2-3

Post-MVP:

- Public `resume`, `fork`, model/admin/config/MCP/plugin/skill commands
- Write-capable `parallel-agents`
- Worktree orchestration
- Review gate automation
- Cloud/browser/computer/realtime features
- Multi-harness distribution

## Phase 1: Scaffold

- Create `plugins/codex-adapter/.claude-plugin/plugin.json`.
- Create semantic command markdown files only.
- Create one agent-facing skill under `skills/codex-adapter/SKILL.md`.
- Create `scripts/codexctl.mjs` plus `scripts/lib/`.
- Create `schemas/` for job, result, and context-package schemas.
- Add package metadata and test runner inside plugin.

## Phase 2: Runtime Skeleton

- Implement CLI parsing in `lib/cli.mjs`.
- Implement renderer in `lib/render.mjs`.
- Implement state directory discovery in `lib/paths.mjs`.
- Implement durable jobs in `lib/jobs.mjs`.
- Implement diagnostics in `lib/diagnostics.mjs`.
- Implement Codex binary detection and version checks.
- Implement context package builder with redaction report.

## Phase 3: App-Server And Codex Calls

- Implement minimal app-server client for initialize, thread start, turn start, review start, interrupt, and event capture.
- Add CLI fallback for `codex exec` and `codex review` where app-server support is incomplete.
- Persist stdout, stderr, event log, result JSON, result Markdown, and context package per job.

## Phase 4: MVP Controls

- Implement `setup`.
- Implement `diagnostics`.
- Implement `context-preview`.
- Implement `status`.
- Implement `result`.
- Implement `cancel`.

## Phase 5: MVP Intents

- Implement `execute mode=chat|exec`.
- Implement `review mode=code|plan|adversarial`.
- Implement `rescue mode=diagnose|fix`.
- Implement gated `search`.
- Implement gated `compare mode=parallel-review`.
- Implement gated `execute mode=structured`.

## Phase 6: Tests And Smoke

- Add command layout test.
- Add CLI parser tests.
- Add diagnostics tests with fake Codex binaries.
- Add context package and redaction tests.
- Add job lifecycle tests.
- Add intent routing tests.
- Add renderer snapshot tests.
- Add live smoke scripts that can be skipped when Codex auth/search is unavailable.

## Current Work Slice

Start with scaffold plus the first reliable vertical slice:

1. Plugin layout.
2. Semantic commands and bundled skill.
3. `codexctl setup`.
4. `codexctl diagnostics`.
5. `codexctl context-preview`.
6. Basic tests for layout, CLI parsing, diagnostics, and context package output.

## Progress Log

2026-04-29:

- Created `plugins/codex-adapter/` MVP scaffold.
- Added Claude plugin manifest, semantic command files, one bundled agent-facing skill, runtime skeleton, schemas, and tests.
- Implemented first vertical slice: `setup`, `diagnostics`, `context-preview`, `status`, `result`, and `cancel`.
- Added diagnostics selection for multiple Codex binaries on `PATH`; newest version is selected and mismatched versions are warned.
- Added context package generation with intent-specific package classes and redaction reporting.
- Added passing tests for layout, intent routing, diagnostics, context package, and CLI.
- Implemented CLI-backed semantic intent runner for `execute`, `review`, `rescue`, `search`, and `compare`.
- Added persisted artifacts per intent run: context package, stdout, stderr, final message, and result JSON.
- Added `--background` launch support with durable status/result tracking and cancellation state.
- Tightened MVP safety: `danger-unrestricted` is rejected, `rescue mode=fix` requires `rescue-workspace`, `search` requires `search-readonly`, and `compare` remains read-only.
- Implemented compare synthesis instead of raw concatenation.
- Verified live Codex `execute` and `review mode=plan` smokes; verified background behavior with a fake Codex binary.
- Added repo-local Claude plugin marketplace metadata pointing to `./plugins/codex-adapter`.
- Added plugin layout validator and dry-run package validation.
- Added baseline Codex version warning for versions older than `0.125.0`.
- Added stale background job reconciliation.
- Added overall compare timeout budgeting.
- Added structured-output example schema and adapter-side JSON/schema validation.
- Fixed timeout/error handling so `ETIMEDOUT` and other spawn errors mark jobs failed.
- Verified live `search`, `compare`, and `execute mode=structured` smokes.
