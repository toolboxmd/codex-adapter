import fs from "node:fs";
import path from "node:path";
import { run } from "./command.mjs";
import { stateRoot } from "./paths.mjs";

export const BASELINE_CODEX_VERSION = "0.125.0";

export function findCodex(env = process.env) {
  return selectCodex(env).path;
}

export function selectCodex(env = process.env) {
  if (env.CODEX_ADAPTER_CODEX_BIN) {
    if (!fs.existsSync(env.CODEX_ADAPTER_CODEX_BIN)) {
      return { path: null, candidates: [] };
    }
    const candidate = codexCandidate(env.CODEX_ADAPTER_CODEX_BIN, env);
    return { path: candidate.path, candidates: [candidate] };
  }
  const which = run("which", ["-a", "codex"], { env, timeoutMs: 3000 });
  if (which.status === 0) {
    const paths = Array.from(new Set(which.stdout.trim().split("\n").filter(Boolean)));
    const candidates = paths.map((candidatePath) => codexCandidate(candidatePath, env));
    const selected = candidates
      .filter((candidate) => candidate.version)
      .sort((a, b) => compareSemver(b.version, a.version))[0] ?? candidates[0];
    return { path: selected?.path ?? null, candidates };
  }
  return { path: null, candidates: [] };
}

export function collectDiagnostics(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const selectedCodex = selectCodex(env);
  const codexPath = selectedCodex.path;
  const codex = {
    available: Boolean(codexPath),
    path: codexPath,
    version: null,
    rawVersion: null,
    features: {},
    candidates: selectedCodex.candidates
  };
  const warnings = [];

  if (codexPath) {
    const version = run(codexPath, ["--version"], { cwd, env, timeoutMs: 5000 });
    codex.rawVersion = clean(version.stdout || version.stderr);
    codex.version = parseVersion(codex.rawVersion);
    if (version.status !== 0) {
      warnings.push(`codex --version failed: ${clean(version.stderr || version.error || "unknown error")}`);
    }
    if (codex.version && compareSemver(codex.version, BASELINE_CODEX_VERSION) < 0) {
      warnings.push(`Codex ${codex.version} is older than MVP baseline ${BASELINE_CODEX_VERSION}; compatibility is not guaranteed.`);
    }
    const uniqueVersions = new Set(selectedCodex.candidates.map((candidate) => candidate.version).filter(Boolean));
    if (selectedCodex.candidates.length > 1) {
      warnings.push(`Multiple Codex binaries found; selected newest ${codexPath} (${codex.version ?? "unknown"}).`);
      if (uniqueVersions.size > 1) {
        warnings.push(`Codex versions on PATH differ: ${Array.from(uniqueVersions).join(", ")}.`);
      }
    }
  } else {
    warnings.push("Codex binary not found. Install @openai/codex or set CODEX_ADAPTER_CODEX_BIN.");
  }

  const auth = getAuthStatus(codexPath, cwd, env);
  const appServer = getAppServerStatus(codexPath, cwd, env);
  const help = getHelp(codexPath, cwd, env);
  const execHelp = getHelp(codexPath, cwd, env, ["exec", "--help"]);
  const execResumeHelp = getHelp(codexPath, cwd, env, ["exec", "resume", "--help"]);
  const reviewHelp = getHelp(codexPath, cwd, env, ["review", "--help"]);
  codex.features = {
    execStdinPrompt: /read from stdin|instructions are read from stdin/i.test(execHelp),
    execResume: /resume\s+Resume a previous session|Resume a previous session/i.test(`${execHelp}\n${execResumeHelp}`),
    reviewStdinPrompt: /read from stdin/i.test(reviewHelp)
  };
  const git = getGitStatus(cwd, env);
  const gates = {
    search: searchGate({ codex, auth, help })
  };

  return {
    type: "diagnostics",
    generatedAt: new Date().toISOString(),
    workspaceRoot: cwd,
    stateDir: stateRoot(env),
    codex,
    auth,
    appServer,
    git,
    gates,
    warnings
  };
}

export function collectSetup(options = {}) {
  const diagnostics = collectDiagnostics(options);
  const nextSteps = [];
  if (!diagnostics.codex.available) {
    nextSteps.push("Install Codex with `npm install -g @openai/codex` or configure CODEX_ADAPTER_CODEX_BIN.");
  }
  if (diagnostics.codex.available && diagnostics.auth.status !== "authenticated") {
    nextSteps.push("Authenticate Codex with `codex login`.");
  }
  if (!diagnostics.appServer.available) {
    nextSteps.push("Verify that the installed Codex version supports `codex app-server`.");
  }
  return {
    type: "setup",
    generatedAt: diagnostics.generatedAt,
    codex: diagnostics.codex,
    auth: diagnostics.auth,
    appServer: diagnostics.appServer,
    stateDir: diagnostics.stateDir,
    nextSteps
  };
}

function getAuthStatus(codexPath, cwd, env) {
  if (!codexPath) {
    return { status: "unavailable", detail: "codex binary not found" };
  }
  const result = run(codexPath, ["login", "status"], { cwd, env, timeoutMs: 10000 });
  const output = clean(`${result.stdout}\n${result.stderr}`);
  if (result.status === 0) {
    return { status: "authenticated", detail: output || "codex login status succeeded" };
  }
  if (/not logged in|unauthenticated|login/i.test(output)) {
    return { status: "not-authenticated", detail: output };
  }
  return { status: "unknown", detail: output || result.error || "codex login status failed" };
}

function getAppServerStatus(codexPath, cwd, env) {
  if (!codexPath) {
    return { available: false, detail: "codex binary not found" };
  }
  const result = run(codexPath, ["app-server", "--help"], { cwd, env, timeoutMs: 10000 });
  return {
    available: result.status === 0,
    detail: clean(result.stdout || result.stderr || result.error || "")
  };
}

function getHelp(codexPath, cwd, env, args = ["--help"]) {
  if (!codexPath) {
    return "";
  }
  const result = run(codexPath, args, { cwd, env, timeoutMs: 10000 });
  return clean(`${result.stdout}\n${result.stderr}`);
}

function getGitStatus(cwd, env) {
  const isRepo = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd, env, timeoutMs: 5000 });
  const root = run("git", ["rev-parse", "--show-toplevel"], { cwd, env, timeoutMs: 5000 });
  const status = run("git", ["status", "--short", "--untracked-files=all"], { cwd, env, timeoutMs: 5000 });
  return {
    isRepo: isRepo.status === 0 && isRepo.stdout.trim() === "true",
    root: root.status === 0 ? root.stdout.trim() : null,
    statusShort: status.status === 0 ? statusLines(status.stdout) : []
  };
}

function statusLines(stdout) {
  return String(stdout ?? "").trimEnd().split("\n").filter(Boolean);
}

function searchGate({ codex, auth, help }) {
  if (!codex.available) {
    return { available: false, reason: "codex binary unavailable" };
  }
  if (auth.status !== "authenticated") {
    return { available: false, reason: "codex auth is not confirmed" };
  }
  if (/--search|\bweb search\b|\bsearch\b/i.test(help)) {
    return { available: true, reason: "codex help advertises search controls; first search run remains the live capability check" };
  }
  return { available: false, reason: "installed codex help does not expose search controls" };
}

function parseVersion(raw) {
  const match = raw.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function codexCandidate(candidatePath, env) {
  const version = run(candidatePath, ["--version"], { env, timeoutMs: 5000 });
  const rawVersion = clean(version.stdout || version.stderr);
  return {
    path: candidatePath,
    version: parseVersion(rawVersion),
    rawVersion,
    available: version.status === 0 && !version.error
  };
}

function compareSemver(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function clean(value) {
  return String(value ?? "").trim();
}
