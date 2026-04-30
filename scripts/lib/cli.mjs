import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, boolFlag } from "./args.mjs";
import { buildContextPackage } from "./context-package.mjs";
import { runIntent } from "./codex-runs.mjs";
import { collectDiagnostics, collectSetup } from "./diagnostics.mjs";
import { cancelJob, createJob, listJobs, readJob } from "./jobs.mjs";
import { normalizeIntent, intentSummary } from "./intent-router.mjs";
import { resolveTaskInput, taskInputContext } from "./prompt-input.mjs";
import { emit } from "./render.mjs";

const COMMANDS = new Set([
  "setup",
  "diagnostics",
  "context-preview",
  "status",
  "result",
  "cancel",
  "execute",
  "review",
  "rescue",
  "search",
  "compare",
  "help"
]);

export async function main(argv) {
  const [command = "help", ...rest] = argv;
  if (!COMMANDS.has(command)) {
    throw new Error(`Unknown command: ${command}. Run codexctl help.`);
  }

  const parsed = parseArgs(rest);
  const options = {
    json: boolFlag(parsed.flags, "json"),
    cwd: parsed.flags.cwd || process.cwd(),
    flags: parsed.flags,
    positional: parsed.positional
  };

  switch (command) {
    case "help":
      emit(helpPayload(), options);
      return;
    case "setup":
      emit(collectSetup({ cwd: options.cwd }), options);
      return;
    case "diagnostics":
      emit(collectDiagnostics({ cwd: options.cwd }), options);
      return;
    case "context-preview":
      emit(contextPreviewPayload(options), options);
      return;
    case "status":
      emit({ type: "status", jobs: listJobs({ cwd: options.cwd }) }, options);
      return;
    case "result":
      emit(resultPayload(options), options);
      return;
    case "cancel": {
      const id = options.positional[0] ?? options.flags.id;
      if (!id) throw new Error("cancel requires a job id");
      const result = cancelJob(id, { cwd: options.cwd });
      emit({ type: "cancel", id, cancelled: result.cancelled, job: result.job }, options);
      return;
    }
    case "execute":
    case "review":
    case "rescue":
    case "search":
    case "compare":
      if (boolFlag(options.flags, "background")) {
        emit(startBackgroundIntent(command, rest, options), options);
        return;
      }
      emit(runIntent(command, options), options);
      return;
    default:
      throw new Error(`Unhandled command: ${command}`);
  }
}

function resultPayload(options) {
  const id = options.positional[0] ?? options.flags.id ?? null;
  const job = readJob(id, { cwd: options.cwd });
  let result = null;
  if (job?.resultJsonPath) {
    try {
      result = JSON.parse(fs.readFileSync(job.resultJsonPath, "utf8"));
    } catch {
      result = null;
    }
  }
  return { type: "result", id, job, result };
}

function startBackgroundIntent(command, rawArgs, options) {
  const id = `job-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(16).slice(2, 8)}`;
  const childArgs = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "codexctl.mjs"),
    command,
    ...removeFlag(rawArgs, "--background"),
    "--job-id",
    id,
    "--cwd",
    options.cwd,
    "--json"
  ];
  const child = spawn(process.execPath, childArgs, {
    cwd: options.cwd,
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
  createJob(
    {
      id,
      intent: command,
      mode: options.flags.mode ?? null,
      status: "queued",
      phase: "background-started",
      pid: child.pid
    },
    { cwd: options.cwd }
  );
  return {
    type: "intent-result",
    jobId: id,
    intent: command,
    mode: options.flags.mode ?? "default",
    status: "queued",
    summary: "Codex Adapter job started in the background.",
    output: `Check status with /codex-adapter:status or result with /codex-adapter:result ${id}.`,
    artifacts: {}
  };
}

function removeFlag(args, flagName) {
  const next = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flagName || arg === flagName.slice(2)) continue;
    if (arg === `${flagName}=true`) continue;
    next.push(arg);
  }
  return next;
}

function contextPreviewPayload(options) {
  const intent = options.flags.intent ?? options.positional[0] ?? "review";
  const mode = options.flags.mode;
  const normalized = normalizeIntent(intent, mode);
  const taskInput = resolveTaskInput({
    cwd: options.cwd,
    flags: options.flags,
    positional: options.positional.slice(options.positional[0] === intent ? 1 : 0)
  });
  return {
    type: "context-preview",
    package: buildContextPackage({
      cwd: options.cwd,
      intent: normalized.intent,
      mode: normalized.mode,
      userRequest: taskInput.text,
      input: taskInputContext(taskInput)
    })
  };
}

function helpPayload() {
  return {
    type: "help",
    usage: "codexctl <setup|diagnostics|context-preview|status|result|cancel|execute|review|rescue|search|compare> [options]",
    controls: ["setup", "diagnostics", "context-preview", "status", "result", "cancel"],
    intents: intentSummary()
  };
}
