# Codex Adapter Intent Contract

Commands:

- `/codex-adapter:execute [--background] --mode chat|exec [--prompt-file <file>] [--resume <session-id>|--resume-last] [task]`
- `/codex-adapter:execute [--background] --mode structured --schema <json-schema-file> [--prompt-file <file>] [--resume <session-id>|--resume-last] [task]`
- `/codex-adapter:review [--background] --mode code|plan|adversarial [--prompt-file <file>] [focus]`
- `/codex-adapter:rescue [--background] --mode diagnose|fix [--prompt-file <file>] [--resume <session-id>|--resume-last] [problem]`
- `/codex-adapter:search [--background] --mode facts|sources|recency [--prompt-file <file>] [question]`
- `/codex-adapter:compare [--background] --mode parallel-review --count 2|3 [--prompt-file <file>] [rubric]`

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
- `--prompt-file` is explicit prompt inclusion and is streamed to Codex over stdin instead of shell argv.
- Resume is limited to `execute` and `rescue` and requires installed Codex support for `codex exec resume`.
- Public MCP calls, terminal controls, direct filesystem actions, cloud tasks, and write-capable parallel agents are post-MVP.
