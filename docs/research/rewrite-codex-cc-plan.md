# Codex Adapter Plugin Plan

Date: 2026-04-29

## Goal

Design a from-scratch local Claude Code plugin named `codex-adapter` that exposes Codex capabilities to Claude Code agents through `codex app-server`, with feature parity to the Codex CLI experience where feasible.

This plan exists before implementation, per project instruction.

## Current Inputs

- Local workspace: `/Users/lukaszmaj/dev/toolboxmd/codex-plugin-cc-enhanced`.
- Existing plugin clone: `codex-plugin-cc/`, upstream `openai/codex-plugin-cc` `v1.0.4` at commit `807e03a`. This clone is reference material only and should be removed from the implementation path once `codex-adapter` is scaffolded.
- Existing research: `codex-research-report.md`, written 2026-04-24.
- Upstream Codex checked by background research on 2026-04-29: `openai/codex` `main` at `70ac0f1`; GitHub release page still showed `0.125.0` as latest from 2026-04-24.
- Upstream `openai/codex-plugin-cc` checked on 2026-04-29: `807e03a`; GitHub release page still showed `v1.0.4` as latest from 2026-04-18.
- Local skill/plugin guidance read from `~/wiki` and `~/dev/toolboxmd/building-agentskills`.

## Decision

Build a new local-only Claude Code plugin adapter named `codex-adapter` around `codex app-server`. Do not rewrite the Codex engine.

Rationale:

- `openai/codex` is a large Rust workspace with auth, config, sandboxing, model/provider management, MCP, plugins, skills, thread storage, cloud tasks, app-server, CLI, TUI, and SDK surfaces. Reimplementing that would duplicate the actual product.
- `codex app-server` is the supported rich integration seam. It exposes thread/turn lifecycle, review mode, approvals, auth/account state, rate-limit state, models, config, MCP, plugins, skills, and structured notifications over JSON-RPC.
- The current `codex-plugin-cc` already proves the bridge works, but its implementation is an initial wrapper with a monolithic companion script, prompt-heavy commands, limited protocol/version hardening, and implicit context handoff.
- The rewrite should own the host-adapter layer: Claude Code commands, skills, agents, hooks, background jobs, state, context packaging, rendering, diagnostics, and safety/loop guards.

Settled scope:

- v0 supports local Claude Code only.
- v0 uses the local `codex` binary and local `codex app-server` only.
- v0 does not support Claude Code on the web, remote Cloud Code, Codex cloud-task bridging, or remote app-server relays.
- v0 ships only a Claude plugin manifest (`.claude-plugin/plugin.json`).
- `.codex-plugin`, OpenCode, Cursor, Gemini, and other coding-tool adapters are future distribution targets built around the same runtime core.
- v0 supports the current Codex release first. Older Codex versions are supported only when simple capability shims cover them. When a new Codex version drops, run the upgrade loop and move the compatibility target forward.
- v0 core is intentionally smaller than Codex's full app-server surface. A capability is MVP only if it appears in the semantic intent matrix or operational controls with a runtime handler, permission profile, capability gate, and test coverage.
- Gated MVP intents may be present in the bundle but fail closed when diagnostics show that the local Codex/auth/model/profile cannot support them.

Primary user model:

- The main users are Claude Code agents, not humans manually operating Claude Code.
- Humans must still be able to invoke every action manually for debugging and control.
- Agentic instructions must be good enough that Claude agents can express semantic intents without extra user prompting: `execute`, `review`, `rescue`, `search`, and `compare`.

## Reliability Contract

The plugin should be as reliable as Codex itself. That means the adapter must be thin, observable, version-aware, and easy to update when Codex changes.

Reliability requirements:

- Treat `codex app-server` as the source of truth for Codex behavior. Do not emulate Codex internals in plugin code when the app-server or CLI exposes the behavior.
- Keep host-specific code at the edges: Claude command parsing, job state, context packaging, rendering, and hooks.
- Feature-detect app-server capabilities at runtime and fail with actionable diagnostics when a method is missing or incompatible.
- Pin the tested Codex version range in docs and CI, but allow newer versions when capability checks pass.
- Store the Codex binary path, `codex --version`, app-server capability summary, auth mode, model, sandbox, approval policy, and runtime profile on every job.
- Prefer structured app-server events over terminal scraping.
- Maintain a fake app-server harness for deterministic regression tests and a live smoke suite for real Codex compatibility.
- Every user-visible failure must include enough detail for recovery: install/auth/config issue, app-server crash, protocol mismatch, sandbox denial, rate limit, MCP unavailable, or job interruption.
- Never silently downgrade safety. If the desired sandbox/profile is unavailable, stop and report it.

Data egress and privacy requirements:

- `local-only` means no remote adapter relay and no remote Claude Code dependency. It does not mean offline inference; Codex may still send prompts, file context, and tool results to the configured OpenAI/Codex provider.
- `context-preview` must show the provider/auth mode, model, network/MCP availability, and whether any selected context can leave the machine.
- Secrets, `.env` files, gitignored files, binary files, large files, symlinks outside the workspace, and outside-workspace roots require explicit inclusion.
- Context packages must include a redaction report and a list of omitted sensitive paths/patterns.
- The adapter must never copy secrets from Claude context into Codex context implicitly.

Upgrade requirements:

- Codex upgrades should require updating generated protocol bindings, capability fixtures, compatibility matrix, and live smoke expectations in one documented workflow.
- The v0 baseline Codex version, generated bindings, and capability snapshot must be committed or otherwise reproducible. New Codex releases are admitted only after the baseline/latest matrix is updated.
- Protocol changes should land behind adapter methods, not spread across commands.
- Deprecated Codex methods should have compatibility shims only inside `lib/protocol-capabilities.mjs` and `lib/codex-runs.mjs`.
- The plugin should support current Codex first, then older versions only when shims remain simple and tested.
- Compatibility should move forward after new Codex releases. The project should not accumulate broad historical compatibility unless there is a concrete user need and test coverage.

## Reuse Strategy

Use the existing implementation as reference material only. Do not build `codex-adapter` by mutating the upstream clone.

Keep conceptually:

- App-server as primary control plane.
- Existing product workflows: setup, review, adversarial review, rescue/task, status, result, cancel, optional review gate.
- Generated app-server TypeScript protocol bindings.
- Shared app-server broker idea for long-lived sessions.
- Persistent job state with logs and resumable thread/session IDs.
- Read-only defaults for review and explicit write profiles for rescue.

Rewrite:

- Runtime structure: split the current `codex-companion.mjs` into small modules with typed contracts.
- Command bodies: keep slash commands thin; move logic into scripts and skills/references.
- Context packaging: make exact handoff visible, saved, and previewable.
- Diagnostics: treat setup/auth/config/MCP/models/sandbox/app-server compatibility as first-class commands.
- Review gate: rebuild with budgets, loop guards, duplicate-finding detection, and explicit opt-in.
- Protocol compatibility: detect Codex version and app-server capabilities at runtime; do not assume one schema forever.
- Tests: build a fake app-server harness and golden event transcripts before adding full workflows.

Drop:

- The upstream `codex-plugin-cc` clone as implementation base.
- Any assumption that Claude plugin manifests and Codex plugin manifests are interchangeable.
- Hidden or prose-only invariants for safety-critical behavior.
- Background behavior that relies only on Claude command prose instead of durable process/job supervision.

## Target Plugin Shape

Primary target is Claude Code plugin packaging:

```text
plugins/codex-adapter/
|-- .claude-plugin/plugin.json
|-- README.md
|-- CHANGELOG.md
|-- LICENSE
|-- commands/
|   |-- setup.md
|   |-- diagnostics.md
|   |-- context-preview.md
|   |-- execute.md
|   |-- review.md
|   |-- rescue.md
|   |-- search.md
|   |-- compare.md
|   |-- status.md
|   |-- result.md
|   `-- cancel.md
|-- agents/
|   `-- codex-delegate.md
|-- skills/
|   `-- codex-adapter/
|       |-- SKILL.md
|       `-- references/
|-- scripts/
|   |-- codexctl.mjs
|   `-- lib/
`-- schemas/
```

Future distribution targets:

- Add `.codex-plugin/plugin.json` only if we want this package to be installable by Codex itself.
- Add OpenCode, Cursor, Gemini, or other harness adapters by keeping the runtime core independent from Claude-specific command markdown and hooks.
- Do not let future multi-harness support pollute v0. The v0 product is local Claude Code.

Claude plugin packaging contract:

- Command namespace should be `/codex-adapter:<intent-or-control>`.
- Local state should live under a plugin-owned data directory, with the exact path shown by `diagnostics`.
- The package must declare the required Node version and validate script executability during setup.
- Local install, update, uninstall, and clean-profile load instructions are part of v0 docs.
- A plugin layout smoke test must verify that Claude Code can load the manifest, commands, agents, skills, and script entrypoint. Hooks are post-v0 unless review gate automation is explicitly pulled forward.
- Slash commands must use one sanctioned path mechanism: a manifest/config-time resolved absolute script path or an installed `codex-adapter` wrapper. Do not rely on Claude interpolating `${CLAUDE_PLUGIN_ROOT}` inside Bash-tool instructions.
- MVP commands are semantic host intents. Advanced Codex controls may exist as internal runtime operations, but they should not be separate public commands unless agents need to select them directly.

## Runtime Architecture

The runtime should be a Node ESM command-line adapter called by Claude Code commands.

Core modules:

- `lib/app-server-client.mjs`: JSON-RPC transport over direct stdio or Unix socket. Handles initialize/initialized, request IDs, server requests, notifications, backoff on busy errors, stderr capture, and shutdown.
- `lib/protocol-capabilities.mjs`: reads generated protocol types or app-server introspection output, checks minimum supported methods, and reports version/capability mismatches.
- `lib/jobs.mjs`: durable job model with status, phase, pid, thread IDs, turn IDs, profile, model, effort, sandbox, approval policy, started/completed timestamps, prompt package path, event log path, result path, and error state.
- `lib/context-package.mjs`: builds explicit context packages from user request, current plan, git status, diffs, changed files, file mentions, previous failures, constraints, exclusions, sandbox/profile choices, and expected output contract.
- `lib/codex-runs.mjs`: starts threads, starts turns, starts native reviews, captures events, maps approvals, and returns structured results.
- `lib/render.mjs`: renders concise Markdown for humans plus JSON for `--json`.
- `lib/diagnostics.mjs`: checks `codex` binary, version, app-server launch, auth/account, rate limits, models, config layers, trusted project state, MCP servers, plugins, skills, sandbox support, writable roots, Node version, and Claude plugin data paths.
- `lib/safety.mjs`: named permission profiles, runtime/token/turn budgets, duplicate-finding detection, and explicit danger-mode confirmation checks.
- `lib/compatibility.mjs`: checks installed Codex version and app-server capability snapshot against the MVP baseline for diagnostics.
- `lib/intent-router.mjs`: maps agent-facing semantic intents to app-server/CLI operations, context package type, permission profile, job mode, and output contract.
- `lib/cli.mjs`: argument parser and command dispatch for `codexctl`.

Post-v0 modules:

- `lib/broker.mjs`: shared app-server process per Claude session/workspace, multiplexed clients, and advanced process reuse.
- `lib/worktrees.mjs`: temporary git worktrees for write-capable parallel Codex agents.
- `lib/upgrade.mjs` write-capable operations and upgrade plans. MVP may include only a lightweight internal compatibility check used by `diagnostics`.

Command implementation rule:

- Slash-command markdown should mostly parse intent and invoke the resolved `codexctl.mjs` entrypoint through the packaging contract's sanctioned path mechanism.
- All durable behavior must live in scripts/tests, not in prose.

Agent-instruction rule:

- Every public intent must have clear agent-facing instructions that state when to use it, when not to use it, required context, default permission profile, background behavior, stop condition, and result handling.
- These instructions should be optimized for autonomous Claude agents first and human slash-command usage second.
- If an action is dangerous, the runtime must enforce the guard. The instruction text is not the guard.

## Agent-First Action Surface

MVP should expose semantic intents, not Codex internals. Claude should be able to decide "I need search", "I need a review", "I need rescue", or "I need comparison", and the plugin should choose the Codex operation, context package class, permission profile, foreground/background behavior, and result contract.

Operational controls:

| Control | Command | Purpose | Status |
|---|---|---|---|
| `setup` | `/codex-adapter:setup` | install/auth/app-server smoke check | MVP core |
| `diagnostics` | `/codex-adapter:diagnostics` | compatibility, auth, model, search, sandbox, MCP visibility summary | MVP core |
| `context-preview` | `/codex-adapter:context-preview` | show selected package, redactions, and egress before launch | MVP core |
| `status` | `/codex-adapter:status` | inspect durable background jobs and pending approvals | MVP core |
| `result` | `/codex-adapter:result` | read persisted result artifacts | MVP core |
| `cancel` | `/codex-adapter:cancel` | interrupt job, deny pending approvals, clean process state | MVP core |

Semantic intent matrix:

| Intent | Command | Modes | Runtime choice | Default profile | Status |
|---|---|---|---|---|---|
| `execute` | `/codex-adapter:execute` | `chat`, `exec`, `structured` | app-server turn for chat; `codex exec` or app-server turn for exec; schema validation for structured | explicit profile | MVP core for chat/exec, gated for structured |
| `review` | `/codex-adapter:review` | `code`, `plan`, `adversarial` | native `review/start` when possible; review turn fallback | `review-readonly` or `plan-readonly` | MVP core |
| `rescue` | `/codex-adapter:rescue` | `diagnose`, `fix` | diagnostic turn first; write-capable turn only after explicit profile | `review-readonly` unless write requested | MVP core |
| `search` | `/codex-adapter:search` | `facts`, `sources`, `recency` | Codex search-capable turn only after capability probe | `search-readonly` | MVP gated |
| `compare` | `/codex-adapter:compare` | `parallel-review`, `rubric` | fan out 2-3 read-only review jobs, dedupe/merge results | `review-readonly` | MVP gated |

Post-v0 parity commands:

- `resume`, `fork`, public model/permission/config commands, `upgrade-check`, and admin commands for MCP/plugins/skills/features/apps.
- `parallel-agents`, `codex-subagents`, and write-capable worktree fan-out.
- Public `terminal-*` and direct public `fs-*` actions. App-server command/fs methods may be used internally for event capture, approvals, and result rendering.
- `mcp-call`, `mcp-resource-read`, MCP OAuth, plugin/marketplace mutation, skill mutation, and app/connectors operation.
- `apply`, `cloud`, browser use, computer use, realtime/audio, app UI helpers, automations, and review gate automation.
- Multi-harness adapters for OpenCode, Cursor, Gemini, and generic CLI hosts.

Agentic usage examples:

- If Claude finishes a non-trivial patch, it should express `review mode=code` before declaring completion.
- If Claude is uncertain about a design plan, it should express `review mode=plan`.
- If Claude needs adversarial critique, it should express `review mode=adversarial`.
- If Claude needs external facts and diagnostics prove Codex search is available, it should express `search` with a source requirement.
- If Claude is stuck on a bug, it should express `rescue` with one scoped target and a clear stop condition.
- If Claude wants independent read-only opinions, it should express `compare mode=parallel-review` with a rubric and count 2-3.
- If any Codex task writes files, Claude must inspect the diff and run verification before accepting it.

## Codex Capability Parity Inventory

This inventory is based on local `codex-cli 0.125.0`, `codex --help`, subcommand help, official Codex docs, and `codex app-server generate-ts --experimental`. The generated app-server protocol exposed 89 client request methods at inspection time.

Parity rule:

- Every Codex capability gets one of five statuses: `MVP public intent`, `MVP internal`, `MVP diagnostic`, `post-v0`, or `not-v0`.
- `MVP public intent` means Claude agents can request it semantically through `execute`, `review`, `rescue`, `search`, or `compare`.
- `MVP internal` means the runtime may use it to implement a public intent, but Claude should not select it directly.
- `MVP diagnostic` means the plugin should inspect/report it, but not necessarily operate it.
- `post-v0` means it is real Codex functionality but outside the shippable MVP.
- `not-v0` means intentionally excluded from v0 unless a concrete use case appears.

CLI command groups:

| Codex surface | Current Codex support | Adapter status |
|---|---|---|
| Interactive `codex` TUI | Prompt/image start, local/remote app-server, model/profile/sandbox/search flags | `post-v0`; adapter uses app-server, not TUI embedding |
| `codex exec` | Non-interactive runs, JSONL events, output schema, output-last-message, images, stdin, resume | MVP intent: `execute`; structured output gated |
| `codex review` / `codex exec review` | Uncommitted, base branch, commit, custom prompt, title | MVP intent: `review mode=code|plan|adversarial` |
| `codex login/logout` | OAuth, device auth, API key, status, logout | MVP diagnostic plus guarded manual setup |
| `codex mcp` | list/get/add/remove/login/logout for MCP servers | MVP diagnostic; mutation post-v0 |
| `codex plugin marketplace` | add/upgrade/remove marketplaces | MVP diagnostic; mutation post-v0 |
| `codex mcp-server` | Run Codex as an MCP server | `post-v0`; useful for OpenCode/other harnesses |
| `codex app-server` | stdio/unix/ws transport, proxy, TS/schema generation | MVP internal control plane; diagnostics use capability snapshot |
| `codex app` | Launch desktop app | `not-v0` except diagnostic/deep-link helper |
| `codex completion` | shell completions | `not-v0` for agent actions |
| `codex sandbox` | macOS/Linux/Windows sandbox command runner | MVP diagnostic; direct sandbox-run post-v0 |
| `codex debug models` | model catalog JSON | MVP diagnostics only; public model command post-v0 |
| `codex debug prompt-input` | model-visible prompt input JSON | MVP diagnostics/context-preview helper; public debug command post-v0 |
| `codex debug app-server` | send v2 app-server messages | MVP diagnostic only when needed; useful in upgrade tests |
| `codex apply` | apply latest Cloud task diff locally | `post-v0`; cloud is out of MVP |
| `codex resume/fork` | resume/fork interactive sessions | post-v0 public commands; MVP may persist IDs for native Codex resume |
| `codex cloud` | exec/status/list/apply/diff Cloud tasks | `post-v0`; MVP is local-only |
| `codex exec-server` | standalone exec-server service | `post-v0`; likely useful for remote/other harnesses |
| `codex features` | list/enable/disable feature flags | diagnostics only; public command post-v0 |
| `codex execpolicy` | check execpolicy rules against a command | internal safety/diagnostics; public policy command post-v0 |

App-server method families:

| Method family | Representative methods | Adapter status |
|---|---|---|
| Thread lifecycle | `thread/start`, `thread/resume`, `thread/fork`, `thread/list`, `thread/read`, `thread/archive`, `thread/unarchive`, `thread/rollback`, `thread/name/set` | MVP uses start/list/read internally; public resume/fork/archive/rollback post-v0 |
| Turn lifecycle | `turn/start`, `turn/steer`, `turn/interrupt`, `thread/turns/list` | MVP internal for public intents and job control |
| Context controls | `thread/compact/start`, `thread/inject_items`, `memory/reset`, `thread/memoryMode/set` | MVP internal/context diagnostics; public compact/inject post-v0 |
| Review | `review/start` | MVP internal for `review mode=code` |
| Command terminals | `command/exec`, `command/exec/write`, `command/exec/terminate`, `command/exec/resize`, `thread/backgroundTerminals/clean` | MVP internal event/approval/result support; public terminal actions post-v0 |
| File system | `fs/readFile`, `fs/writeFile`, `fs/readDirectory`, `fs/getMetadata`, `fs/createDirectory`, `fs/remove`, `fs/copy`, `fs/watch`, `fs/unwatch` | MVP internal context/result support; public fs actions post-v0 |
| File changes/patches | file-change approval requests and patch notifications | MVP internal result capture and approval routing |
| Models | `model/list`, model reroute/verification notifications | MVP diagnostics only; public model command post-v0 |
| Account/auth/rate limits | `account/login/start`, `account/logout`, `account/read`, `account/rateLimits/read`, login/rate-limit notifications | MVP diagnostic; guarded manual auth setup |
| Config | `config/read`, `config/value/write`, `config/batchWrite`, `configRequirements/read` | MVP diagnostic read; mutation post-v0 except plugin-owned settings |
| Permissions/approvals | command/file/permissions approval server requests, guardian warnings | MVP internal safety surface |
| MCP | `mcpServerStatus/list`, `mcpServer/tool/call`, `mcpServer/resource/read`, OAuth login, elicitation requests | MVP diagnostic; call/read/OAuth post-v0 unless promoted by tests |
| Apps/connectors | `app/list`, app list updates, app tool approval types | `post-v0`; inspect in diagnostics only if exposed locally |
| Plugins/marketplaces | `plugin/list`, `plugin/read`, `plugin/install`, `plugin/uninstall`, `marketplace/add/remove/upgrade` | MVP diagnostic read; mutation post-v0 |
| Skills | `skills/list`, `skills/config/write`, skill changed notifications | MVP diagnostic read; mutation post-v0 |
| Collaboration/subagents | `collaborationMode/list`, collab agent item/status types | MVP `compare` can fan out read-only jobs; write-capable subagents post-v0 |
| Realtime/audio | `thread/realtime/start`, append audio/text, stop, list voices | `post-v0`; not core to coding-agent MVP |
| Fuzzy file search/mention | `fuzzyFileSearch`, session start/update/stop | MVP internal context builder; public mention action post-v0 |
| Git metadata | `gitDiffToRemote` | MVP diagnostic/context metadata; public diff action post-v0 |
| Windows sandbox setup | `windowsSandbox/setupStart` and setup notifications | MVP diagnostic; Windows support later |
| External agent config | detect/import external agent config | `post-v0`; useful for migration to OpenCode/Cursor later |
| Device keys | create/public/sign | `post-v0`; unless required by auth/app integration |
| Feedback/upload | `feedback/upload` | `not-v0` unless user asks for support workflow |

Built-in CLI slash/session controls:

| Codex slash control | Adapter equivalent |
|---|---|
| `/model`, `/fast`, model/reasoning selection | MVP diagnostics and per-intent options; public model command post-v0 |
| `/permissions`, `/approvals`, `/sandbox-add-read-dir` | MVP named profiles inside intents; public permissions command post-v0 |
| `/agent`, Codex subagents | MVP `compare` only; write-capable subagents post-v0 |
| `/apps`, `/plugins`, `/mcp`, `/skills` | diagnostics and post-v0 admin actions |
| `/plan`, `/review`, `/diff`, `/mention` | MVP `review` modes and `context-preview`; public diff/mention post-v0 |
| `/compact`, `/new`, `/resume`, `/fork`, `/clear` | MVP `execute mode=chat`; compact/resume/fork public commands post-v0 |
| `/status`, `/debug-config` | MVP `status`, `diagnostics`; public debug command post-v0 |
| `/ps`, `/stop` | background terminal/job status and cancel |
| `/init` | post-v0 `agents-init` for `AGENTS.md` generation |
| `/copy`, `/logout`, `/feedback`, `/quit`, `/statusline`, `/title` | mostly human UI; `not-v0` or diagnostics only |

Codex app / product features:

| Product feature | Adapter status |
|---|---|
| Local threads | MVP internal for semantic intents |
| Worktree threads | post-v0; MVP `compare` is read-only and uses no worktrees |
| Cloud threads/tasks | `post-v0`; MVP local-only |
| Built-in Git diff/stage/revert/commit/push/PR | `post-v0`; MVP captures diffs and leaves apply/merge explicit |
| Integrated terminal | internal event/result capture only; public terminal controls post-v0 |
| Local environment actions | `post-v0`; likely map to project commands later |
| Automations | post-v0; review gate automation is post-v0 |
| In-app browser/browser use | `post-v0`; local Claude can use other browser tools, but Codex app browser is not MVP |
| Computer use | `post-v0`; app/macOS-permission specific and high-risk |
| Non-code artifact previews | `post-v0`; only result file capture in MVP |
| Notifications/prevent sleep/pop-out UI/statusline/title | `not-v0` for agent adapter |

New action names implied by the full inventory, with MVP status controlled by the semantic intent matrix above:

- `exec` maps to MVP `execute`; `structured-exec` is gated under `execute mode=structured`; `exec-resume` is post-v0.
- `codex-subagents`, `codex-subagent-status`, `codex-subagent-steer` are post-v0.
- `compact`, `rollback`, `archive`, `unarchive`, `inject-context` are post-v0 public actions unless needed internally.
- `mention`, `fuzzy-file-search`, `diff`, `git-diff-remote` are internal/context diagnostics in MVP and post-v0 public actions.
- `policy-check`, `sandbox-check` are internal MVP diagnostics; public `sandbox-run` is post-v0.
- `mcp-call`, `mcp-resource-read`, `mcp-oauth-login` are post-v0.
- `apps-list`, `plugins-list`, `skills-list`, `features-list`, `config-debug` are post-v0 public commands, with limited data folded into MVP diagnostics.
- `terminal-exec`, `terminal-write`, `terminal-stop`, `terminal-resize`, `background-terminals-clean` are post-v0 public actions and internal event support in MVP.
- `prompt-preview` maps to MVP `context-preview`; public debug output is post-v0.
- `cloud-list`, `cloud-status`, `cloud-diff`, `cloud-apply`, `cloud-exec` later.
- `browser-use`, `computer-use`, `realtime-session` later.

## Permission Profiles

Named profiles are mandatory because cross-agent delegation is risky when access is ambiguous.

```text
review-readonly:
  sandbox: read-only
  approval: never
  writes: false

plan-readonly:
  sandbox: read-only
  approval: never
  writes: false

search-readonly:
  sandbox: read-only
  approval: never
  writes: false
  requires: codex_search_available

rescue-workspace:
  sandbox: workspace-write
  approval: on-request
  writes: true

expanded-read:
  sandbox: read-only
  approval: on-request
  extra_read_roots: explicit only

api-enabled:
  sandbox: workspace-write
  approval: on-request
  network/mcp: explicit only

danger-unrestricted:
  sandbox: danger-full-access
  approval: never
  requires explicit isolated-runner confirmation
```

Never silently map a user task to `danger-full-access`.

Approval state machine:

- Jobs that need command/file/tool/permission approval enter `pending_approval` and persist the approval request as a durable artifact.
- `status` must show pending approval type, requested command/path/tool, risk summary, timeout, and how to approve or deny.
- `cancel` must deny pending approvals before interrupting the turn.
- Approval timeouts must fail closed and preserve the Codex thread/session ID for recovery.
- Autonomous Claude agents cannot approve their own write, network, MCP, or sandbox-escalation requests unless a profile explicitly allows that exact class of action.
- Approval decisions must be recorded with actor, timestamp, requested action, decision, and resulting Codex response.

## Parallel Agent And Worktree Contract

Parallel Codex agents are a first-class capability, but they must be isolated and accountable.

V0 boundary:

- Write-capable `parallel-agents` is post-v0.
- MVP `compare mode=parallel-review` is read-only only, default count 2, hard maximum 3, and no automatic patch application.
- MVP `compare` does not create worktrees or accept file writes, so it only needs result comparison, runtime/cost limits, cancellation, and duplicate-finding handling.
- Promotion of write-capable `parallel-agents` requires crash cleanup tests, dirty-tree handling, branch naming, dependency-install policy, submodule/LFS handling, and patch/result comparison tests.

Default behavior:

- Parallel write-capable jobs run in temporary git worktrees, not the user's main checkout.
- Each worktree gets a unique branch name, state directory, prompt package, log, result JSON, and result Markdown.
- Each agent receives the same base task plus its assigned variant or focus area.
- The coordinator action gathers all results and produces a comparison report.
- No parallel agent result is applied to the main checkout automatically.

Required controls:

- `--count` must have a default cap and a hard maximum.
- Worktree creation and cleanup must be stateful and recoverable.
- Every result must record changed files, commands run, verification status, final answer, and patch/diff location.
- Merge/apply is a separate explicit action after human or Claude review.

This is one of the main differentiators of `codex-adapter`: Claude agents can use Codex as a scalable local agent pool without hand-written instructions each time.

## Context Handoff Contract

Every Codex run should persist a context package before the turn starts.

MVP package classes:

- `task-package` for `execute`: user request, selected files, explicit profile, output contract, and any prior command output.
- `review-package` for `review` and `compare`: target diff/files/plan, rubric, active instructions, changed-file manifest, and findings-first output schema.
- `rescue-package` for `rescue`: failure target, reproduction steps, prior failures, relevant files, stop condition, and verification expectations.
- `search-package` for `search`: question, recency/source requirements, minimal local context, and citation output contract. It should not include broad workspace files unless explicitly requested.

Minimum fields:

- Schema version.
- User request.
- Claude current plan or intent, when available.
- Latest user constraints and active instruction layers, including relevant `AGENTS.md`/Claude/plugin instructions.
- Workspace root and cwd.
- Git status.
- Dirty worktree ownership assumptions.
- Target diff or review target.
- Explicit files/dirs included.
- Explicit exclusions.
- File manifest with path, hash, size, truncation state, symlink state, gitignored state, and binary/text classification.
- Prior failures or verification output.
- Model/effort/profile/sandbox/approval choices.
- Auth/provider/network/MCP/tool visibility.
- Data egress/redaction report.
- Stop condition.
- Output contract.

This package should be available through `context-preview` and attached to job results. This is the biggest quality improvement over the current plugin.

## Background Job Contract

Background jobs must be durable and inspectable.

State per job:

- `id`, `class`, `status`, `phase`.
- `workspaceRoot`, `cwd`, `sessionId`.
- `pid` or broker/client handle.
- `profile`, `sandbox`, `approvalPolicy`, `model`, `effort`.
- `threadId`, `turnId`, `rootThreadId`, child/subagent thread IDs.
- `promptPackagePath`.
- `eventLogPath`, `stdoutPath`, `stderrPath`, `resultJsonPath`, `resultMarkdownPath`.
- `startedAt`, `updatedAt`, `completedAt`.
- `cancelRequestedAt`, `cancelResult`.

Mechanisms:

- Job files update on every phase/thread/turn transition.
- `cancel` sends app-server interrupt first, then process-tree termination if needed.
- `status` reads persisted state only; it must work after the original Claude command turn is gone.
- `result` is available after app-server exits.
- Stale running jobs are reconciled by checking pid/socket/broker health.

## Review Gate Contract

The stop-time review gate is useful but dangerous. Rebuild it as opt-in and guarded.

Review gate automation is post-v0. MVP may run manual review intents, but it must not install an automatic stop hook that blocks Claude completion until the guard implementation and tests exist.

Required guards:

- Max gate runs per Claude session.
- Max repeated same finding count.
- Max wall-clock runtime.
- Max Codex turn count.
- Findings-only mode by default.
- Stop when Codex returns no actionable findings.
- Human approval before Claude auto-fixes after a blocked stop.
- Persist every gate prompt, finding, and decision.

This cannot be a prose-only command instruction. The hook script must enforce the counters and exit behavior.

## Skill/Instruction Design

Apply the local `building-agentskills` guidance:

- Keep each `SKILL.md` under ~500 lines / ~5k tokens.
- Use descriptions as activation contracts, not workflow summaries.
- Push detail into `references/`.
- Put executable behavior in `scripts/`.
- For any `must`, `always`, `never`, or numeric threshold, define what fires: script, validator, hook, or captured artifact.
- Avoid SessionStart injection except for tiny bootstrap context. Prefer description-triggered skills.
- Do not rely on `${CLAUDE_PLUGIN_ROOT}` inside Bash-tool instructions. Use Claude plugin config-time paths in hooks, and script-relative resolution inside runtime code.
- Write action descriptions for Claude agents, not for marketing copy. Each description should say exactly when an agent should choose that action.
- Add SKIP clauses where over-triggering would waste quota or create unsafe edits.
- Provide result-handling instructions per action so Claude knows whether to quote Codex verbatim, summarize findings, inspect diffs, run tests, or launch a follow-up action.

## Testing Plan

Before implementation:

- Add fake app-server fixtures that emit JSON-RPC responses/notifications for review, normal turn, file changes, command execution, errors, busy server, auth failure, and rate-limit depletion.
- Add golden context-package tests.
- Add job-state lifecycle tests: queued, running, completed, failed, canceled, stale pid, pending approval, denied approval.
- Add protocol compatibility tests for missing methods and unsupported versions.
- Add diagnostics compatibility tests: capability snapshot diff, Codex version matrix parsing, and "missing required method" failure.
- Add agent intent selection pressure tests: review, search, rescue, compare, execute, and "do not use Codex" negative cases.
- Add read-only compare tests: 2-3 fan-out jobs, runtime cap, cancellation, deduped findings, and no write/worktree creation.
- Add render snapshot tests for human Markdown and JSON output.
- Move hook guard tests and worktree lifecycle tests to post-v0 with review gate/write-capable parallel agents.
- Add CLI argument parser tests for all MVP commands and intent modes.
- Add plugin layout validation.
- Add failure-path tests for broken install, expired auth, app-server busy/crash, missing method, rate-limit depletion, approval denied/timeout, sandbox denial, MCP unavailable, malformed events, cancellation races, and stale process recovery.
- Add context redaction tests for secrets, `.env`, gitignored files, binary files, symlink escape, large-file truncation, and outside-workspace roots.
- Add clean Claude profile load test for manifest, command namespace, skills, and script entrypoint resolution.

Regression tests from the current plugin should be used as a seed, not blindly copied.

## Codex-Assisted Upgrade Loop

We should dogfood Codex on this plugin. When Codex releases or app-server behavior changes, run Codex over the plugin specifically to adapt it for Claude Code usage.

MVP boundary:

- MVP includes only diagnostics-time compatibility checks against the pinned Codex baseline and required method list.
- Public `/codex-adapter:upgrade-check`, `/codex-adapter:upgrade-plan`, and `/codex-adapter:upgrade-apply` are post-v0.

Upgrade workflow:

1. Compare the installed Codex version against the committed v0 baseline and latest-known compatibility snapshot.
2. Run `codexctl diagnostics --json` to capture current Codex version, app-server capabilities, model/auth state, MCP/plugin visibility, and sandbox support.
3. Run `npm run protocol:generate` or equivalent to regenerate app-server TypeScript bindings from the installed Codex into a reviewable output path.
4. Diff generated bindings and capability snapshots against committed baseline fixtures.
5. Run the fake app-server suite and plugin unit tests.
6. Run live smoke tests against local `codex app-server` when auth is available.
7. Run Codex read-only over this plugin with a pinned upgrade prompt:
   - Compare old and new app-server bindings.
   - Identify changed methods, notification shapes, auth/model/config surfaces, sandbox behavior, and review/task flows.
   - Propose adapter changes for Claude Code usage only.
   - Do not edit until the plan is reviewed.
8. Run Codex write-capable only after the upgrade plan is accepted, preferably in a temporary worktree.
9. Run Claude Code review and Codex review against the upgrade diff before merging.
10. Update the compatibility matrix and release notes.

Mechanisms:

- Add `/codex-adapter:upgrade-check` after MVP for read-only version/capability drift detection.
- Add `/codex-adapter:upgrade-plan` after MVP core to create a saved upgrade plan from current Codex docs/source/bindings.
- Add `/codex-adapter:upgrade-apply` only after v0 is stable; it must require an explicit temporary-worktree or isolated-runner confirmation.
- Store upgrade reports under plugin state and optionally commit them under `docs/upgrades/`.

This makes Codex a maintainer of the bridge, while Claude Code remains the host orchestrator and reviewer.

## Implementation Phases

Phase 0: finalize architecture and repo shape.

- This document is the first artifact.
- Target name is `codex-adapter`.
- The upstream `codex-plugin-cc/` clone is not the implementation base and should be removed after scaffold/reference extraction.
- v0 scope is local Claude Code only.

Phase 1: scaffold clean plugin package.

- Create `plugins/codex-adapter/` with `.claude-plugin/plugin.json`, semantic commands, one agent-facing skill, scripts, schemas, and tests.
- Add package scripts for test/build/protocol generation.
- Add fake app-server test harness.

Phase 2: intent router and app-server core.

- Implement `intent-router` before workflow code so the MVP is semantic from the start.
- Implement `app-server-client`, protocol capability detection, direct stdio transport, stderr capture, and generated type workflow.
- Add setup/diagnostics commands.

Phase 3: job manager.

- Implement durable state, logs, status/result/cancel, pending approvals, and stale process reconciliation.
- Verify jobs survive Claude turn boundaries.

Phase 4: core workflows.

- Implement `context-preview`.
- Implement `execute mode=chat|exec`.
- Implement `review mode=code|plan|adversarial`.
- Implement `rescue mode=diagnose|fix` with read-only default and explicit write profile.

Phase 5: high-value gated MVP intents.

- Implement `search` capability gate and source-result contract.
- Implement `compare mode=parallel-review` with read-only fan-out count 2-3.
- Implement `execute mode=structured` after basic execute is stable.
- Add pressure tests for autonomous Claude agent action choice.
- Do not implement write-capable `parallel-agents` until post-v0 worktree safety is complete.

Phase 6: MVP packaging and release.

- Manifest validation and clean Claude profile load test.
- Install/upgrade docs.
- Migration notes from `openai/codex-plugin-cc`, not a fork history.
- Compatibility matrix for the current Codex baseline.
- CI that installs Codex, generates/checks protocol types, runs fake-server tests, then runs a minimal live smoke test when auth is available.

Post-v0 phases:

- Codex administration surfaces: public models, permissions, config-debug, MCP, plugins, skills, features, apps.
- Upgrade automation: public upgrade-check, upgrade-plan, and guarded upgrade-apply.
- Guarded automation: review gate and optional monitors.
- Write-capable parallel agents and worktree orchestration.
- Marketplace/multi-harness distribution.

## Open Questions

- Should write-capable Codex rescue run in the same workspace or a temporary worktree by default?
- What should the post-v0 default and hard maximum be for write-capable `parallel-agents --count`? V0 gated `parallel-review` is default 2 and hard max 3.
- What result format is best for MVP `compare`: ranked summary, matrix, raw outputs, or all three?
- Which future harness should be next after Claude Code: OpenCode, Cursor, Gemini, or a generic CLI adapter?
- Should Codex-assisted upgrade reports be committed under `docs/upgrades/`, stored only in plugin state, or both?

## Main Risks

- App-server protocol churn.
- Auth and model availability differ between ChatGPT login and API-key auth.
- Sandbox/permission state can be misunderstood if not rendered clearly.
- Background jobs can be orphaned if tied to a Claude turn instead of durable supervision.
- Review gates can burn quota or create loops without hard budgets.
- MCP/plugin/tool visibility differs between Codex and Claude Code.
- Context handoff quality will dominate output quality; an implicit prompt is not enough.
- `local-only` can be misread as offline/no-egress unless context-preview and diagnostics make provider/network behavior explicit.
- Background approvals can deadlock or become unsafe unless pending approval state is durable and agents cannot self-approve escalations.
- Codex-assisted upgrades can overfit to the newest Codex release if compatibility shims and tests do not constrain them.
- Agent-first auto-use can over-trigger Codex and waste quota if descriptions and SKIP clauses are weak.
- Parallel worktree fan-out can leave stale branches/worktrees unless cleanup and recovery are mechanism-backed.

## Definition Of Done For v0

- A user can install the plugin locally and run setup/diagnostics.
- A Claude Code agent can autonomously choose semantic intents without knowing Codex internals: `execute`, `review`, `rescue`, `search`, and `compare`.
- The plugin maps each intent to the right Codex operation, package class, permission profile, background behavior, and result contract.
- A user can preview the selected package, redaction report, and data-egress implications before sending it to Codex.
- A user can run `review mode=code|plan|adversarial`.
- A user can run `execute mode=chat|exec` and one scoped `rescue` task with explicit read-only/write profile.
- Background status/result/cancel works after the initiating command turn ends.
- Pending approvals are durable, visible in status, deny by default on timeout, and cannot be self-approved by autonomous agents unless the profile explicitly permits it.
- `search` works when Codex diagnostics prove the current auth/model/profile supports search; otherwise it fails closed with an actionable unavailable reason.
- `compare mode=parallel-review` can run 2-3 bounded review passes without writes or worktrees, then produce a comparison report.
- Results include Codex thread/session IDs for native resume.
- Permission profile, model, effort, prompt package, touched files, commands, and final output are persisted.
- Diagnostics report Codex version, app-server capability status, and tested compatibility range.
- Tests cover fake app-server workflows, job state, package classes, intent routing, command parsing, renderers, protocol compatibility, failure paths, redaction, approval timeouts, packaging load, search gating, compare fan-out, and structured-output failures.
- Gated `search`, `execute mode=structured`, and `compare mode=parallel-review` may ship only if their capability gates and tests pass.
