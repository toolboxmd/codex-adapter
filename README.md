# Codex Adapter

Local Claude Code plugin that exposes Codex through semantic agent intents.

MVP public controls:

- `/codex-adapter:setup`
- `/codex-adapter:diagnostics`
- `/codex-adapter:context-preview`
- `/codex-adapter:status`
- `/codex-adapter:result`
- `/codex-adapter:cancel`

MVP semantic intents:

- `/codex-adapter:execute`
- `/codex-adapter:review`
- `/codex-adapter:rescue`
- `/codex-adapter:search`
- `/codex-adapter:compare`

The adapter is local-only in the host sense: it runs the local `codex` binary and local app-server/CLI surfaces. Codex may still send prompts and selected context to the configured model provider. Use `context-preview` to inspect selected context and egress implications before launching a job.

## Local Development

```bash
cd codex-adapter
npm test
node scripts/codexctl.mjs diagnostics
node scripts/codexctl.mjs context-preview --intent review --mode code
```

If more than one `codex` binary exists on `PATH`, diagnostics selects the newest version and reports the mismatch. Set `CODEX_ADAPTER_CODEX_BIN=/absolute/path/to/codex` to force a specific binary.

## Semantic Usage

```bash
node scripts/codexctl.mjs execute --mode exec "Return exactly: ok"
node scripts/codexctl.mjs execute --mode structured --schema schemas/structured-output.example.schema.json "Return status ok"
node scripts/codexctl.mjs review --mode plan "Review this plan"
node scripts/codexctl.mjs search --mode sources "Find current sources for ..."
node scripts/codexctl.mjs compare --mode parallel-review --count 2 "Compare this diff"
```

Longer jobs can be started with `--background`, then inspected with `status` and `result`:

```bash
node scripts/codexctl.mjs review --background --mode plan "Review this plan"
node scripts/codexctl.mjs status
node scripts/codexctl.mjs result <job-id>
```

Research, scope, and implementation notes are kept in `docs/research/`.
