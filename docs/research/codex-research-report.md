# OpenAI Codex Research Report

Date: 2026-04-24

Repository under review: [`openai/codex`](https://github.com/openai/codex) at commit `a3cccbd8ed7b92dbdf76f85210e17d569e6102ff` (`a3cccbd`, 2026-04-24 12:31:13 -0700).

Local plugin context: [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) clone at `807e03a` (`v1.0.4`, 2026-04-18).

## Executive Summary

Codex is no longer just a CLI. The open-source repository is a Rust workspace that powers a local terminal agent, non-interactive automation, an app-server protocol for external clients, MCP server/client integration, plugin and skill loading, cloud-task bridging, sandboxing, state/session storage, and model-provider management.

For a CloudCode rewrite, the most important conclusion is that the plugin should not be a thin `codex exec` wrapper. The strongest integration seam is `codex app-server`, because it exposes thread lifecycle, turns, review mode, approvals, auth/account state, progress notifications, and structured final outputs over JSON-RPC.

The best-supported user workflow is "Codex as a second agent": Claude/CloudCode plans or implements, Codex reviews, challenges assumptions, investigates a scoped issue, or runs a background rescue pass. GitHub issues and community posts both point to the same guardrail needs: explicit context handoff, budget/rate-limit awareness, sandbox profile clarity, loop controls, MCP diagnostics, and structured observability.

The biggest current risk is churn. As of 2026-04-24, `openai/codex` had release [`0.125.0`](https://github.com/openai/codex/releases/tag/rust-v0.125.0) published the same day, with active changes in permission profiles, app-server APIs, model catalog handling, MCP/plugins, and Windows/app-server behavior. A rewrite should pin tested Codex versions and feature-detect capabilities at runtime.

## Source Index

Primary sources:

- [`openai/codex`](https://github.com/openai/codex), latest inspected commit `a3cccbd8ed7b92dbdf76f85210e17d569e6102ff`.
- [`openai/codex` release `rust-v0.125.0`](https://github.com/openai/codex/releases/tag/rust-v0.125.0), published 2026-04-24.
- [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc), local clone at `807e03a`, release [`v1.0.4`](https://github.com/openai/codex-plugin-cc/releases/tag/v1.0.4).
- Official Codex docs: [CLI](https://developers.openai.com/codex/cli), [CLI features](https://developers.openai.com/codex/cli/features), [CLI command options](https://developers.openai.com/codex/cli/reference), [App Server](https://developers.openai.com/codex/app-server), [MCP](https://developers.openai.com/codex/mcp), [Build plugins](https://developers.openai.com/codex/plugins/build), [AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Sandboxing](https://developers.openai.com/codex/concepts/sandboxing), [Cloud environments](https://developers.openai.com/codex/cloud/environments).
- OpenAI Help Center: [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-codex-in-chatgpt).
- OpenAI product posts: [Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/), [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/).

Community and market sources:

- Reddit: [Claude Code + Codex is really good](https://www.reddit.com/r/ClaudeCode/comments/1qfu7ga/claude_code_codex_is_really_good/), [GPT 5.4 reviewing Claude code](https://www.reddit.com/r/claude/comments/1sflxbs/i_set_up_gpt_54_to_review_claudes_code_inside/), [Hybrid Claude Code / Codex](https://www.reddit.com/r/ClaudeCode/comments/1rrp17j/hybrid_claude_code_codex/), [approval friction](https://www.reddit.com/r/OpenAI/comments/1nm3s04/codex_cli_i_have_to_approve_every_single/).
- X/Twitter indexed posts: [AlphaSignal AI plugin walkthrough](https://x.com/AlphaSignalAI/status/2041171552377725049), [Haider workflow comparison](https://x.com/slow_developer/status/2033204072761712875), [Kyle Boddy agentic coding workflow](https://x.com/drivelinekyle/status/2006843857820844430), [Vaibhav plugin post](https://x.com/reach_vb/status/2039251986357338257).
- Hacker News discussion on agent context packaging: [HN item 43708025](https://news.ycombinator.com/item?id=43708025).

Evidence weighting:

- Repository source, releases, and official docs are treated as factual.
- GitHub issues are factual evidence of reported problems, not proof all users are affected.
- Reddit/X/HN are treated as anecdotal signals. Repeated patterns across multiple sources are used as product-design evidence, not benchmark truth.

## Current Product Shape

Codex has several surfaces that share concepts but differ in trust boundaries and execution environment.

| Surface | What it is | Rewrite relevance |
|---|---|---|
| CLI/TUI | `codex` interactive terminal agent. | Useful for user parity and slash-command semantics, but hard to embed cleanly. |
| Non-interactive CLI | `codex exec`, `codex review`, JSONL events. | Good for simple automation and CI-like wrappers. |
| App Server | `codex app-server`, JSON-RPC over stdio/WebSocket/Unix socket. | Best integration target for a rich CloudCode plugin. |
| Desktop app | App UI over the same underlying agent/app-server concepts. | Shows where OpenAI is pushing UX: multi-agent, worktrees, threads, app/browser/computer use. |
| IDE extension | Local editor integration using shared config. | Relevant for config compatibility and project trust. |
| Cloud Codex | Tasks run in OpenAI-managed containers with GitHub-connected repos. | Important for future delegation, but not equivalent to local CLI. |
| MCP server | `codex mcp-server`, exposes Codex to MCP clients. | Possible alternative integration route, but app-server is richer for thread control. |

Official docs state local CLI/IDE/app command execution is sandboxed by default, while cloud tasks run in containers where setup has internet access and the agent phase is offline by default unless configured. Secrets in cloud are available to setup scripts, then removed before the agent phase.

## Repository Architecture

Top-level layout:

- `codex-cli`: npm package shim for `@openai/codex`; selects platform binary and spawns native `codex`.
- `codex-rs`: main Rust workspace.
- `docs`: repo docs, mostly pointers to official docs.
- `sdk/python`, `sdk/python-runtime`, `sdk/typescript`: SDK/runtime packages.
- `.codex/skills`: bundled skills.
- `third_party`, `patches`, `tools`, `scripts`: build and platform support.

Important Rust crates in `codex-rs`:

| Area | Crates |
|---|---|
| CLI and UI | `cli`, `tui`, `exec`, `arg0`, `terminal-detection` |
| Core agent | `core`, `protocol`, `thread-store`, `state`, `rollout`, `rollout-trace` |
| App integration | `app-server`, `app-server-protocol`, `app-server-client`, `exec-server` |
| Auth and account | `login`, `chatgpt`, `device-key`, `keyring-store`, `backend-client` |
| Models/providers | `model-provider`, `model-provider-info`, `models-manager`, `ollama`, `lmstudio`, `aws-auth` |
| Tools | `tools`, `apply-patch`, `shell-command`, `file-search`, `js_repl` under tools |
| Security/runtime | `sandboxing`, `linux-sandbox`, `windows-sandbox-rs`, `execpolicy`, `process-hardening`, `network-proxy` |
| Extensibility | `codex-mcp`, `mcp-server`, `rmcp-client`, `plugin`, `core-plugins`, `skills`, `core-skills`, `connectors`, `hooks` |
| Cloud | `cloud-tasks`, `cloud-tasks-client`, `cloud-requirements` |

Architecture inference from source:

- The CLI is a dispatcher. The real value lives in shared core, app-server protocol, config, auth, and execution crates.
- `app-server-protocol` is an intentionally generated/bindable contract. The existing `codex-plugin-cc` already generates TypeScript bindings with `codex app-server generate-ts`.
- Permission/sandbox behavior is becoming a first-class cross-surface concept. Release `0.125.0` explicitly mentions permission profiles round-tripping through TUI sessions, user turns, MCP sandbox state, shell escalation, and app-server APIs.

## Command Surface

Defined primarily in [`codex-rs/cli/src/main.rs`](https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs).

| Command | Purpose | Integration notes |
|---|---|---|
| `codex [OPTIONS] [PROMPT]` | Interactive TUI or one-shot prompt. | Good for parity, not ideal for programmatic embedding. |
| `codex exec` / `codex e` | Non-interactive agent run. | Supports `--json`, `--output-last-message`, `--output-schema`, `--ephemeral`. |
| `codex exec resume` | Resume non-interactive session. | Useful for background job continuation. |
| `codex exec review` | Non-interactive review. | Programmatic alternative to `/review`. |
| `codex review` | Top-level code review wrapper. | Useful for read-only review workflows. |
| `codex login`, `codex login status` | Auth management. | Supports ChatGPT login, device auth, API key via stdin. |
| `codex logout` | Remove credentials. | Plugin should expose setup/status, not hide auth failures. |
| `codex mcp` | Manage MCP servers. | Subcommands: `list`, `get`, `add`, `remove`, `login`, `logout`. |
| `codex plugin marketplace` | Manage plugin marketplaces. | Subcommands include `add`, `upgrade`, `remove`. |
| `codex mcp-server` | Start Codex as MCP stdio server. | Possible but less complete than app-server for UI orchestration. |
| `codex app-server` | Start JSON-RPC server. | Strongest route for CloudCode plugin. |
| `codex app` | Launch desktop app on macOS/Windows. | Useful setup command only. |
| `codex completion` | Shell completions. | Low rewrite relevance. |
| `codex sandbox macos/linux/windows` | Run commands under platform sandbox. | Useful for diagnostics and sandbox parity. |
| `codex debug models` | Dump model catalog. | Useful for model-picker/runtime diagnostics. |
| `codex debug prompt-input` | Inspect model-visible prompt input. | Useful for context handoff debugging. |
| `codex apply` / `codex a` | Apply latest Codex diff to local tree. | Useful if CloudCode delegates separate work then lets user apply. |
| `codex resume` | Resume previous TUI session. | Existing plugin returns session IDs for this. |
| `codex fork` | Fork previous session. | Important for branching investigation flows. |
| `codex cloud` | Browse/apply cloud tasks locally. | Experimental, relevant for future cloud delegation. |
| `codex exec-server` | Standalone exec-server service. | Experimental. |
| `codex features` | Inspect/toggle feature flags. | Useful for troubleshooting. |

Shared flags from [`codex-rs/utils/cli/src/shared_options.rs`](https://github.com/openai/codex/blob/main/codex-rs/utils/cli/src/shared_options.rs):

- `--model`, `-m`: model override.
- `--oss`: use open-source provider.
- `--local-provider`: `lmstudio` or `ollama`.
- `--profile`, `-p`: config profile.
- `--sandbox`, `-s`: `read-only`, `workspace-write`, `danger-full-access`.
- `--full-auto`: low-friction local automation preset.
- `--dangerously-bypass-approvals-and-sandbox`, alias `--yolo`: disables approval and sandbox boundaries.
- `--cd`, `-C`: working root.
- `--add-dir`: additional writable roots.
- `--image`, `-i`: image attachments.

Important safety mapping:

- Official CLI docs say `--full-auto` maps to workspace-write sandbox plus on-request approvals.
- `--yolo`/danger bypass should only be used inside an externally isolated runner.
- For plugin defaults, use read-only for review, workspace-write for scoped rescue, and never silently use danger-full-access.

## Interactive Slash Commands

Defined in [`codex-rs/tui/src/slash_command.rs`](https://github.com/openai/codex/blob/main/codex-rs/tui/src/slash_command.rs).

High-value slash commands:

| Slash command | Purpose |
|---|---|
| `/model` | Choose model and reasoning effort. |
| `/fast` | Toggle Fast mode. |
| `/approvals`, `/permissions` | Choose what Codex can do. |
| `/setup-default-sandbox` | Set up elevated agent sandbox. |
| `/sandbox-add-read-dir` | Let sandbox read an absolute directory on Windows. |
| `/experimental` | Toggle experimental features. |
| `/memories` | Configure memory use and generation. |
| `/skills` | Use skills. |
| `/review` | Review current changes. |
| `/rename` | Rename thread. |
| `/new` | New chat. |
| `/resume` | Resume saved chat. |
| `/fork` | Fork current chat. |
| `/init` | Create `AGENTS.md`. |
| `/compact` | Summarize conversation to avoid context limit. |
| `/plan` | Switch to Plan mode. |
| `/collab` | Collaboration mode. |
| `/agent`, `/subagents` | Switch active agent thread. |
| `/side` | Start side conversation in ephemeral fork. |
| `/copy` | Copy last response as Markdown. |
| `/diff` | Show git diff including untracked files. |
| `/mention` | Mention file. |
| `/status` | Current config and token usage. |
| `/debug-config` | Show config layers and requirement sources. |
| `/mcp` | List MCP tools, supports verbose details. |
| `/apps` | Manage apps/connectors. |
| `/plugins` | Browse plugins. |
| `/ps`, `/stop` | List or stop background terminals. |
| `/logout`, `/quit`, `/exit`, `/feedback` | Account/session utilities. |

CloudCode rewrite implication:

- Users expect a command grammar that feels like Codex/Claude slash commands, but the plugin should avoid exposing every Codex command 1:1.
- First-class commands should be review, adversarial review, scoped rescue, status/result/cancel, setup/diagnostics, model/profile selection, sandbox/profile selection, and context preview.

## Configuration And Auth

Important configuration facts:

- Default Codex home is `~/.codex` unless `CODEX_HOME` is set.
- User config is `~/.codex/config.toml`.
- Project config can live in `.codex/config.toml`, but trusted-project rules matter.
- Generated schema lives at `codex-rs/core/config.schema.json`.
- `AGENTS.md` discovery layers global and project instructions. The official docs say Codex loads global `AGENTS.override.md` or `AGENTS.md`, then walks from project root to current directory, with closer files overriding earlier guidance. Default combined size cap is 32 KiB.

Auth facts:

- Codex supports ChatGPT sign-in and API-key auth.
- API-key login can be read from stdin via `codex login --with-api-key`.
- Credential storage modes include file, keyring, auto, and ephemeral.
- OpenAI Help Center states Codex is included with Plus, Pro, Business, Enterprise/Edu, and temporarily Free/Go. It also states local Codex usage is not available in the Compliance API, while web/cloud delegated usage is.

Rewrite implications:

- The plugin should expose setup diagnostics that check binary availability, `codex --version`, login status, model availability, config layers, project trust, and app-server protocol compatibility.
- Avoid copying or reimplementing Codex auth. Use Codex auth through app-server or CLI.
- If CloudCode has its own project rules, generate or summarize them into a Codex-compatible `AGENTS.md`/prompt handoff rather than assuming Codex can read CloudCode conversation state.

## Sandboxing And Approvals

Official sandbox model:

- `read-only`: Codex can inspect files but needs approval for edits or commands.
- `workspace-write`: Codex can read, edit within the workspace, and run routine local commands inside the sandbox.
- `danger-full-access`: no sandbox restrictions.
- Approval policies include `untrusted`, `on-request`, and `never`; source also preserves older `on-failure`.
- `--full-auto` is the safer automation preset: `workspace-write` plus `on-request`.
- Full access means `danger-full-access` plus `never`.

Platform enforcement:

- macOS: Seatbelt.
- Linux/WSL2: bubblewrap/Landlock path depending on platform/runtime.
- Windows: restricted token/elevated Windows sandbox path.

Current problem pattern:

- GitHub issues show recurring confusion where UI says Full Access but runtime stays sandboxed, repeated approvals for MCP/tool calls, and platform-specific Windows sandbox failures.
- Release `0.125.0` contains major permission-profile refactors, which means this area is active and should not be hardcoded.

Rewrite implications:

- Treat permission mode as a visible job attribute.
- Prefer named profiles such as `review-readonly`, `rescue-workspace`, `expanded-read`, `api-enabled`, and `danger-unrestricted`.
- Never hide sandbox escalation behind a generic "run Codex" button.
- Record when a job used broader access, which files/directories were writable, and whether network was available.

## App Server Integration

Official docs describe `codex app-server` as JSON-RPC 2.0 without the `jsonrpc` header on the wire. Transports:

- `stdio://` default, newline-delimited JSON.
- `ws://IP:PORT`, experimental/unsupported.
- `unix://`, active in recent release notes.
- `off`, no local transport.

Important app-server behavior:

- Bidirectional messages: client requests, server responses, server notifications, and server-initiated approval requests.
- App-server can expose auth/account state and usage-limit signals.
- App-server approval requests include command execution and file change decisions.
- WebSocket overload can return JSON-RPC error `-32001`, which clients should retry with backoff.

Existing `codex-plugin-cc` behavior:

- Spawns `codex app-server`.
- Uses generated TypeScript protocol types.
- Starts threads with `cwd`, `model`, `approvalPolicy`, `sandbox`, `serviceName`, `ephemeral`.
- Uses read-only plus approval `never` for review-like operations.
- Tracks background jobs, progress, final answers, file changes, command executions, subagent/collaboration notifications, and session IDs.

Rewrite recommendation:

- Keep app-server as the primary control plane.
- Add robust app-server lifecycle management: direct spawn, broker reuse, busy retry, backoff, protocol version detection, stderr surfacing, and graceful kill.
- Persist CloudCode-visible job records independent of Codex session storage so users can recover status even when app-server exits.

## MCP, Plugins, Skills

MCP:

- Official docs state CLI and IDE share MCP config in `config.toml`.
- Servers can be stdio or streamable HTTP.
- Project-scoped `.codex/config.toml` works only in trusted projects.
- Config supports env forwarding, OAuth callback controls, enabled/disabled tools, startup and tool timeouts, and required servers.

Plugins:

- Official plugin structure requires `.codex-plugin/plugin.json`.
- Optional root-level entries include `skills/`, `.app.json`, `.mcp.json`, and `assets/`.
- Plugin marketplace can be managed through `codex plugin marketplace add/upgrade/remove`.

Skills:

- Skills are `SKILL.md` instructions with metadata.
- Codex supports plugin-contributed and curated skills.

Important warning for this repository:

- `codex-plugin-cc` currently uses Claude plugin packaging: `.claude-plugin/plugin.json`, `commands/`, `agents/`, `hooks/`, `skills/`.
- A CloudCode rewrite should decide whether it is targeting CloudCode's plugin format, Codex's plugin format, or a bridge. Do not assume `.claude-plugin` conventions will be future-compatible with Codex plugin packaging.

## Models And Performance Signals

Official model guidance from the docs track:

- Current Codex docs point users toward `gpt-5.5` where available, `gpt-5.4` during rollout, and smaller models such as `gpt-5.4-mini` for lighter work/subagents.
- API-key auth may not expose the same models as ChatGPT sign-in.

Official performance/adoption signals:

- OpenAI's April 16, 2026 Codex post says Codex had more than 3 million weekly developers and expanded into desktop app, computer use, images, memory, recurring work, PR review, multiple files/terminals, SSH devboxes, and in-app browser.
- OpenAI's April 21, 2026 enterprise post says the number had grown to more than 4 million weekly developers.
- The February 2026 GPT-5.3-Codex post claimed a 25% speed improvement for Codex users versus earlier infrastructure/model behavior.

Observed issue signals:

- Users report rate-limit opacity, high token burn, context compaction failures, and model catalog mismatch during GPT-5.5 rollout.
- `codex exec --json` gained reasoning-token usage reporting in PR [`#19308`](https://github.com/openai/codex/pull/19308), indicating usage observability is actively improving.

Rewrite implications:

- Build model defaults as config, not constants.
- Record model, effort, service tier/Fast mode where exposed, prompt size/context package, runtime, and final token usage if available.
- Provide "cheap pass" and "deep pass" shortcuts, but leave defaults to Codex unless user sets them.

## What Works Well

High-confidence strengths:

- Codex has strong local-first ergonomics: terminal, IDE, app, and CLI share config concepts.
- `codex app-server` makes it embeddable without terminal scraping.
- Native review mode is a strong integration primitive.
- Session resume/fork and app-server thread APIs support long-running, interruptible workflows.
- Sandboxing/approval profiles are explicit and increasingly unified across surfaces.
- MCP/plugins/skills create an extensibility path beyond raw shell commands.
- Existing `codex-plugin-cc` demonstrates that cross-agent orchestration inside another coding agent is viable.

Community-perceived strengths:

- Codex is often used as a fast second opinion or adversarial reviewer.
- Users value it for catching edge cases, security concerns, and design flaws missed by a first model.
- Hybrid workflows reduce model monoculture: one agent implements, another critiques.

## What Breaks Or Frustrates Users

Recurring GitHub issue clusters:

| Cluster | Examples | Rewrite risk |
|---|---|---|
| Install/updater | [`#19419`](https://github.com/openai/codex/issues/19419), [`#19421`](https://github.com/openai/codex/issues/19421), [`#17432`](https://github.com/openai/codex/issues/17432) | Setup must detect broken installs, not just `which codex`. |
| Auth/session | [`#16052`](https://github.com/openai/codex/issues/16052), [`#19284`](https://github.com/openai/codex/issues/19284), [`#19075`](https://github.com/openai/codex/issues/19075) | Surface login/account failures clearly. |
| Model/catalog/context | [`#19404`](https://github.com/openai/codex/issues/19404), [`#19409`](https://github.com/openai/codex/issues/19409), [`#19386`](https://github.com/openai/codex/issues/19386), [`#19400`](https://github.com/openai/codex/issues/19400) | Feature-detect model availability and context limits. |
| Sandbox/permissions | [`#19196`](https://github.com/openai/codex/issues/19196), [`#19356`](https://github.com/openai/codex/issues/19356), [`#17623`](https://github.com/openai/codex/issues/17623), [`#19430`](https://github.com/openai/codex/issues/19430) | Make permission state visible and auditable. |
| MCP/tools | [`#19425`](https://github.com/openai/codex/issues/19425), [`#16911`](https://github.com/openai/codex/issues/16911), [`#18527`](https://github.com/openai/codex/issues/18527), [`#19363`](https://github.com/openai/codex/issues/19363) | Include MCP preflight and tool exposure diagnostics. |
| TUI/app UX | [`#19312`](https://github.com/openai/codex/issues/19312), [`#19318`](https://github.com/openai/codex/issues/19318), [`#19331`](https://github.com/openai/codex/issues/19331), [`#19415`](https://github.com/openai/codex/issues/19415) | Avoid depending on TUI behavior. |
| Editing/apply_patch | [`#17517`](https://github.com/openai/codex/issues/17517), [`#17899`](https://github.com/openai/codex/issues/17899), [`#19416`](https://github.com/openai/codex/pull/19416) | Prefer app-server structured file-change events where possible. |
| Performance/cost | [`#14593`](https://github.com/openai/codex/issues/14593), [`#19361`](https://github.com/openai/codex/issues/19361), [`#19417`](https://github.com/openai/codex/issues/19417), [`#18692`](https://github.com/openai/codex/issues/18692) | Add budgets, max runtime, and stop conditions. |
| Windows/WSL | [`#19271`](https://github.com/openai/codex/issues/19271), [`#19277`](https://github.com/openai/codex/issues/19277), [`#19365`](https://github.com/openai/codex/issues/19365), [`#19423`](https://github.com/openai/codex/issues/19423) | Test Windows separately; helper binary resolution is fragile. |
| Review/auto-review | [`#19420`](https://github.com/openai/codex/issues/19420), [`#19309`](https://github.com/openai/codex/issues/19309), [`#15477`](https://github.com/openai/codex/issues/15477) | Avoid assuming auto-review model availability. |

Recent resolved/active fixes:

- [`#19231`](https://github.com/openai/codex/pull/19231): permission profiles represent enforcement.
- [`#19308`](https://github.com/openai/codex/pull/19308): reasoning tokens in exec JSON usage.
- [`#19323`](https://github.com/openai/codex/pull/19323): model catalog and fixtures updated.
- [`#19294`](https://github.com/openai/codex/pull/19294): unsupported MCP bearer token schema hidden.
- [`#19247`](https://github.com/openai/codex/pull/19247): truncation policy applied to unified exec.
- [`#19163`](https://github.com/openai/codex/pull/19163): package-manager install policy hardened.
- [`#19206`](https://github.com/openai/codex/pull/19206): device key bindings persisted in SQLite.
- [`#19416`](https://github.com/openai/codex/pull/19416): Bedrock apply_patch tool shape fix.

## Popular User Pipelines

Repeated community patterns:

1. Claude/CloudCode implements, Codex reviews.
   - Seen repeatedly on Reddit and X.
   - Codex is treated as an independent reviewer rather than a replacement.
   - Strong plugin fit: `/review`, `/adversarial-review`, review gate.

2. Claude/CloudCode plans, Codex challenges the plan before implementation.
   - Users report running high-complexity plans through Codex before committing effort.
   - Strong plugin fit: "plan review" should be first-class, not forced through code review.

3. Scoped bug rescue.
   - User delegates one concrete issue to Codex, often with a smaller/faster model.
   - Strong plugin fit: `rescue` should be constrained to one issue and one branch/thread.

4. Background long-running jobs.
   - Codex is used when the user wants to let an agent run while they keep working.
   - Strong plugin fit: status/result/cancel, persistent logs, resumable thread IDs.

5. Multi-agent debate or adversarial loops.
   - Useful when controlled, expensive and noisy when unbounded.
   - Strong plugin fit: max iterations, max spend/time, findings-only mode.

6. Context packaging.
   - HN and Reddit emphasize that quality depends on explicit context selection.
   - Strong plugin fit: show what files/diffs/prompts are handed to Codex.

## Existing `codex-plugin-cc` Assessment

What it already does well:

- Exposes the right product surface: review, adversarial review, rescue, status, result, cancel, setup.
- Uses Codex app-server rather than terminal scraping.
- Generates app-server TypeScript types in `prebuild`.
- Tracks background jobs and final outputs.
- Defaults review-like tasks to read-only.
- Provides a review gate warning about long loops and usage limits.
- Returns Codex session IDs so users can resume in native Codex.

Limitations/opportunities for rewrite:

- It is packaged for Claude Code, not Codex's official `.codex-plugin` structure.
- The review gate is useful but high-risk without stronger loop guards and budgets.
- Context handoff is mostly prompt/script mediated; a CloudCode rewrite should make it explicit and inspectable.
- App-server lifecycle and protocol versioning should be hardened for rapid Codex releases.
- MCP diagnostics should be built in, given recurring MCP exposure/persistence issues.
- Model/context/catalog diagnostics should be explicit, especially during GPT-5.5 rollout.
- Observability should become a core UX surface, not just stored stdout.

## Recommended CloudCode Rewrite Shape

Primary design: controlled second-agent orchestration.

First-class commands:

- `codex.setup`: install/auth/config/app-server health check.
- `codex.review`: read-only review of current diff, branch, commit, or explicit file set.
- `codex.adversarialReview`: challenge assumptions, architecture, security, reliability, rollback, and edge cases.
- `codex.planReview`: review a CloudCode plan/spec before implementation.
- `codex.rescue`: delegate one scoped investigation/fix.
- `codex.status`, `codex.result`, `codex.cancel`: background job control.
- `codex.resume`, `codex.fork`: resume/fork Codex thread from CloudCode.
- `codex.contextPreview`: show exact context package before launch.
- `codex.diagnostics`: app-server, MCP, model, auth, sandbox, project trust, and version report.

Default job profiles:

| Profile | Sandbox | Approval | Use case |
|---|---|---|---|
| `review-readonly` | `read-only` | `never` or no mutation path | Diff/code review. |
| `plan-readonly` | `read-only` | `never` | Plan/spec review. |
| `rescue-workspace` | `workspace-write` | `on-request` | Scoped bug fix with local validation. |
| `expanded-read` | `read-only` plus extra readable roots | `on-request` | Monorepo or external docs inspection. |
| `api-enabled` | workspace write plus restricted network/MCP | `on-request` | Tasks requiring package/docs/API access. |
| `danger-unrestricted` | `danger-full-access` | `never` | Only explicit isolated runner use. |

Context handoff should include:

- User task.
- CloudCode plan/current intent.
- Git status and target diff.
- Relevant files or file mentions.
- Prior CloudCode findings or failed attempts.
- Explicit exclusions.
- Sandbox/network/model/profile choices.
- Stop condition and output contract.

Loop guards:

- Max runtime.
- Max turn count.
- Max review iterations.
- Max token/cost/usage signal where available.
- Stop on no actionable findings.
- Stop on repeated same finding.
- Findings-only mode for review gates.
- Human approval before Codex writes or before Claude/CloudCode attempts a fix loop.

Observability:

- Persist prompt package.
- Persist app-server notifications/events.
- Persist model/effort/sandbox/approval settings.
- Persist thread ID, turn ID, root thread ID, subagent threads.
- Persist touched files, commands run, verification commands, final answer.
- Capture token usage and reasoning tokens when available.
- Provide machine-readable JSON result and Markdown summary.

## Recommended Experiments Before Rewrite

1. App-server compatibility matrix.
   - Test `codex app-server` for `0.124.x`, `0.125.0`, and current latest.
   - Validate `thread/start`, `turn/run`, review start, approval requests, final output, and error handling.

2. Review quality harness.
   - Run Codex review on known seeded bugs and compare with current plugin output.
   - Measure false positives, runtime, and token usage.

3. Context package A/B.
   - Compare minimal diff-only context vs CloudCode plan + diff + changed files + recent failures.
   - Track whether Codex gives more actionable results.

4. Loop guard simulation.
   - Simulate Claude/CloudCode fix loop with Codex review gate.
   - Verify max iterations and stop-on-repeat work.

5. MCP diagnostics.
   - Test stdio and HTTP MCP with tool discovery, approvals, disabled tools, OAuth, required servers, and project config trust.

6. Windows/WSL smoke tests.
   - App-server spawn, Node helper path, Browser/JS REPL if used, path canonicalization, sandbox mode changes.

7. Auth/model matrix.
   - ChatGPT sign-in vs API key.
   - Model picker/model catalog differences.
   - GPT-5.5 availability and context limits.

8. Failure UX.
   - Broken install.
   - Expired auth.
   - app-server busy `-32001`.
   - out-of-usage.
   - sandbox denial.
   - MCP unavailable.
   - malformed final JSON.

## Bottom Line

For the rewrite, preserve the current plugin's core thesis but make it more explicit and controllable:

- Codex is the second agent, not a hidden subprocess.
- App-server is the control plane.
- Review, adversarial review, plan review, and scoped rescue are the product.
- Context packaging, sandbox profiles, budgets, loop guards, and diagnostics are not extras. They are what make cross-agent workflows safe and usable.

