import fs from "node:fs";
import path from "node:path";
import { run } from "./command.mjs";
import { collectDiagnostics } from "./diagnostics.mjs";

const SENSITIVE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".npmrc",
  ".pypirc"
]);

export function buildContextPackage(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const intent = options.intent ?? "review";
  const mode = options.mode ?? defaultMode(intent);
  const diagnostics = options.diagnostics ?? collectDiagnostics({ cwd, env: options.env ?? process.env });
  const packageClass = packageClassFor(intent);
  const git = collectGit(cwd, options.env ?? process.env);
  const files = collectFiles(cwd, git.statusShort);
  const redaction = buildRedaction(files.candidates);

  return {
    schemaVersion: 1,
    type: "context-package",
    generatedAt: new Date().toISOString(),
    intent,
    mode,
    packageClass,
    workspaceRoot: cwd,
    userRequest: options.userRequest ?? "",
    constraints: options.constraints ?? [],
    git,
    files: {
      included: files.included,
      candidates: files.candidates
    },
    redaction,
    profile: options.profile ?? defaultProfile(intent, mode),
    egress: {
      localOnlyMeaning: "local adapter and local Codex process; selected context may be sent to configured Codex/OpenAI provider",
      providerMode: diagnostics.auth.status === "authenticated" ? "codex-provider-authenticated" : "codex-provider-unconfirmed",
      searchAvailable: diagnostics.gates.search.available
    },
    outputContract: outputContractFor(intent, mode),
    stopCondition: options.stopCondition ?? defaultStopCondition(intent)
  };
}

function defaultMode(intent) {
  if (intent === "review") return "code";
  if (intent === "execute") return "chat";
  if (intent === "rescue") return "diagnose";
  if (intent === "compare") return "parallel-review";
  if (intent === "search") return "sources";
  return "default";
}

function packageClassFor(intent) {
  if (intent === "review" || intent === "compare") return "review-package";
  if (intent === "rescue") return "rescue-package";
  if (intent === "search") return "search-package";
  return "task-package";
}

function defaultProfile(intent, mode) {
  if (intent === "search") return "search-readonly";
  if (intent === "review" || intent === "compare") return mode === "plan" ? "plan-readonly" : "review-readonly";
  if (intent === "rescue") return "review-readonly";
  return "explicit";
}

function defaultStopCondition(intent) {
  if (intent === "search") return "Return sourced findings or a gated-unavailable result.";
  if (intent === "compare") return "Return consensus, disagreements, and deduped findings after bounded read-only passes.";
  if (intent === "review") return "Return findings first, with file references where applicable.";
  if (intent === "rescue") return "Stop after diagnosis or one explicitly authorized fix attempt.";
  return "Return a final answer and persisted artifacts.";
}

function outputContractFor(intent, mode) {
  if (intent === "search") {
    return "Dated findings with source URLs, or explicit unavailable reason.";
  }
  if (intent === "compare") {
    return "Comparison report with consensus, disagreements, merged findings, and raw result paths.";
  }
  if (intent === "review") {
    return `Findings-first ${mode} review with severity, file/line refs, and suggested next action.`;
  }
  if (intent === "rescue") {
    return "Diagnosis, attempted actions, touched files, verification status, and next step.";
  }
  return "Final answer plus commands/files/result artifact paths.";
}

function collectGit(cwd, env) {
  const root = run("git", ["rev-parse", "--show-toplevel"], { cwd, env, timeoutMs: 5000 });
  const branch = run("git", ["branch", "--show-current"], { cwd, env, timeoutMs: 5000 });
  const status = run("git", ["status", "--short", "--untracked-files=all"], { cwd, env, timeoutMs: 5000 });
  const diff = run("git", ["diff", "--shortstat"], { cwd, env, timeoutMs: 5000 });
  const staged = run("git", ["diff", "--shortstat", "--cached"], { cwd, env, timeoutMs: 5000 });
  return {
    isRepo: root.status === 0,
    root: root.status === 0 ? root.stdout.trim() : null,
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    statusShort: status.status === 0 ? status.stdout.trim().split("\n").filter(Boolean) : [],
    diffShortstat: diff.status === 0 ? diff.stdout.trim() : "",
    stagedShortstat: staged.status === 0 ? staged.stdout.trim() : ""
  };
}

function collectFiles(cwd, statusShort) {
  const candidates = statusShort.map((line) => {
    const filePath = line.slice(3).trim();
    const abs = path.resolve(cwd, filePath);
    return fileInfo(cwd, filePath, abs);
  });
  return {
    candidates,
    included: candidates.filter((entry) => !isSensitive(entry)).map((entry) => entry.path)
  };
}

function fileInfo(cwd, relativePath, abs) {
  let stat = null;
  try {
    stat = fs.lstatSync(abs);
  } catch {
    return {
      path: relativePath,
      exists: false,
      size: null,
      symlink: false,
      binary: false,
      outsideWorkspace: !abs.startsWith(cwd)
    };
  }
  return {
    path: relativePath,
    exists: true,
    size: stat.size,
    symlink: stat.isSymbolicLink(),
    binary: isLikelyBinary(abs),
    outsideWorkspace: !abs.startsWith(cwd)
  };
}

function buildRedaction(candidates) {
  const omitted = candidates
    .filter(isSensitive)
    .map((entry) => ({ path: entry.path, reason: redactionReason(entry) }));
  return {
    omitted,
    policy: "Sensitive, binary, large, symlink-escape, and outside-workspace files require explicit inclusion."
  };
}

function isSensitive(entry) {
  const base = path.basename(entry.path);
  return (
    SENSITIVE_NAMES.has(base) ||
    entry.binary ||
    entry.symlink ||
    entry.outsideWorkspace ||
    (typeof entry.size === "number" && entry.size > 512_000)
  );
}

function redactionReason(entry) {
  const base = path.basename(entry.path);
  if (SENSITIVE_NAMES.has(base)) return "sensitive filename";
  if (entry.binary) return "binary file";
  if (entry.symlink) return "symlink requires explicit inclusion";
  if (entry.outsideWorkspace) return "outside workspace";
  if (typeof entry.size === "number" && entry.size > 512_000) return "large file";
  return "redacted by policy";
}

function isLikelyBinary(abs) {
  try {
    const buf = fs.readFileSync(abs, { flag: "r" }).subarray(0, 4096);
    return buf.includes(0);
  } catch {
    return false;
  }
}
