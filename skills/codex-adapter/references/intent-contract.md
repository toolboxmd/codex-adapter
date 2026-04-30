# Codex Adapter Intent Contract

Commands:

- `/codex-adapter:execute [--background] --mode chat|exec [task]`
- `/codex-adapter:execute [--background] --mode structured --schema <json-schema-file> [task]`
- `/codex-adapter:review [--background] --mode code|plan|adversarial [focus]`
- `/codex-adapter:rescue [--background] --mode diagnose|fix [problem]`
- `/codex-adapter:search [--background] --mode facts|sources|recency [question]`
- `/codex-adapter:compare [--background] --mode parallel-review --count 2|3 [rubric]`

Controls:

- `/codex-adapter:setup`
- `/codex-adapter:diagnostics`
- `/codex-adapter:context-preview --intent <intent> --mode <mode> [task]`
- `/codex-adapter:status`
- `/codex-adapter:result <job-id>`
- `/codex-adapter:cancel <job-id>`

MVP safety boundary:

- `compare` is read-only and does not create worktrees.
- `search` is enabled only if diagnostics show the installed Codex advertises search; the first search run is the live capability check.
- `rescue --mode fix` requires explicit write profile selection.
- Public MCP calls, terminal controls, direct filesystem actions, cloud tasks, and write-capable parallel agents are post-MVP.
