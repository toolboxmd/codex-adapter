import fs from "node:fs";
import path from "node:path";
import { run } from "./command.mjs";
import { buildContextPackage } from "./context-package.mjs";
import { collectDiagnostics } from "./diagnostics.mjs";
import { createJob, jobArtifactDir, writeJob } from "./jobs.mjs";
import { normalizeIntent } from "./intent-router.mjs";
import { validateJsonOutput } from "./schema-validation.mjs";

export function runIntent(command, options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const flags = options.flags ?? {};
  const positional = options.positional ?? [];
  const mode = flags.mode;
  const { intent, mode: normalizedMode } = normalizeIntent(command, mode);
  const userRequest = positional.join(" ").trim();
  const diagnostics = collectDiagnostics({ cwd, env: options.env ?? process.env });
  if (!diagnostics.codex.available) {
    throw new Error("Codex binary is unavailable. Run setup for recovery instructions.");
  }

  if (intent === "search" && !diagnostics.gates.search.available) {
    return gatedUnavailable(intent, normalizedMode, diagnostics.gates.search.reason);
  }

  const contextPackage = buildContextPackage({
    cwd,
    env: options.env ?? process.env,
    intent,
    mode: normalizedMode,
    userRequest,
    diagnostics,
    profile: flags.profile
  });
  validateProfile({ intent, mode: normalizedMode, profile: contextPackage.profile });
  const job = createJob(
    {
      id: flags["job-id"],
      intent,
      mode: normalizedMode,
      status: "running",
      phase: "codex-cli",
      pid: process.pid,
      profile: contextPackage.profile,
      model: flags.model ?? null,
      effort: flags.effort ?? null,
      sandbox: sandboxFor(contextPackage.profile),
      approvalPolicy: "never"
    },
    { cwd, env: options.env ?? process.env }
  );
  const artifactDir = jobArtifactDir(job, { cwd, env: options.env ?? process.env });
  const contextPath = path.join(artifactDir, "context-package.json");
  const stdoutPath = path.join(artifactDir, "stdout.txt");
  const stderrPath = path.join(artifactDir, "stderr.txt");
  const lastMessagePath = path.join(artifactDir, "last-message.md");
  const resultPath = path.join(artifactDir, "result.json");
  fs.writeFileSync(contextPath, `${JSON.stringify(contextPackage, null, 2)}\n`);

  const codexRun = runCodexCli({
    codexPath: diagnostics.codex.path,
    cwd,
    intent,
    mode: normalizedMode,
    userRequest,
    contextPackage,
    flags,
    lastMessagePath
  });

  fs.writeFileSync(stdoutPath, codexRun.stdout);
  fs.writeFileSync(stderrPath, codexRun.stderr);
  if (!fs.existsSync(lastMessagePath)) {
    fs.writeFileSync(lastMessagePath, codexRun.stdout || codexRun.stderr || codexRun.error || "");
  }

  const output = safeRead(lastMessagePath) || codexRun.stdout || codexRun.stderr || codexRun.error || "";
  const structuredValidation = mode === "structured" ? validateJsonOutput(output, flags.schema) : null;
  const completed = codexRun.status === 0 && !codexRun.error && (!structuredValidation || structuredValidation.valid);
  const result = {
    type: "intent-result",
    jobId: job.id,
    intent,
    mode: normalizedMode,
    status: completed ? "completed" : "failed",
    summary: completed ? "Codex run completed." : "Codex run failed.",
    exitStatus: codexRun.status,
    signal: codexRun.signal,
    error: codexRun.error,
    output,
    structuredValidation,
    artifacts: {
      contextPackage: contextPath,
      stdout: stdoutPath,
      stderr: stderrPath,
      lastMessage: lastMessagePath,
      result: resultPath
    }
  };
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  writeJob(
    {
      ...job,
      status: result.status,
      phase: "finished",
      completedAt: new Date().toISOString(),
      resultJsonPath: resultPath,
      resultMarkdownPath: lastMessagePath,
      contextPackagePath: contextPath,
      stdoutPath,
      stderrPath
    },
    { cwd, env: options.env ?? process.env }
  );
  return result;
}

function runCodexCli({ codexPath, cwd, intent, mode, userRequest, contextPackage, flags, lastMessagePath }) {
  if (intent === "review" && mode === "code") {
    const args = ["review"];
    if (flags.base) {
      args.push("--base", flags.base);
    } else if (flags.commit) {
      args.push("--commit", flags.commit);
    } else {
      args.push("--uncommitted");
    }
    const prompt = userRequest || "Review the current local changes. Return findings first.";
    args.push(prompt);
    return run(codexPath, args, { cwd, timeoutMs: timeoutMs(flags) });
  }

  if (intent === "compare") {
    return runCompare({ codexPath, cwd, mode, userRequest, contextPackage, flags, lastMessagePath });
  }

  const args = [];
  if (intent === "search") {
    args.push("--search");
  }
  args.push("exec", "--skip-git-repo-check", "--sandbox", sandboxFor(contextPackage.profile), "-C", cwd, "-o", lastMessagePath);
  if (flags.model) args.push("--model", flags.model);
  if (flags.profile && flags.profile !== contextPackage.profile) args.push("--profile", flags.profile);
  if (mode === "structured") {
    if (!flags.schema) {
      throw new Error("execute mode=structured requires --schema <json-schema-file>.");
    }
    args.push("--output-schema", flags.schema);
  }
  args.push(promptFor(intent, mode, userRequest, contextPackage));
  return run(codexPath, args, { cwd, timeoutMs: timeoutMs(flags) });
}

function runCompare({ codexPath, cwd, userRequest, flags, lastMessagePath }) {
  const count = Math.min(Math.max(Number(flags.count ?? 2), 2), 3);
  const deadline = Date.now() + timeoutMs(flags);
  const outputs = [];
  for (let index = 0; index < count; index += 1) {
    const remaining = remainingTimeout(deadline);
    if (remaining <= 0) return timeoutResult(codexPath, cwd, outputs);
    const prompt = [
      `You are Codex reviewer ${index + 1} of ${count}.`,
      "Run a read-only independent review. Do not edit files.",
      userRequest || "Review the current local changes.",
      "Return findings first with severity and file references where possible."
    ].join("\n\n");
    const result = run(
      codexPath,
      ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-C", cwd, prompt],
      { cwd, timeoutMs: remaining }
    );
    outputs.push(`## Reviewer ${index + 1}\n\n${result.stdout || result.stderr || result.error || ""}`);
    if (result.status !== 0) {
      return {
        ...result,
        stdout: outputs.join("\n\n"),
        stderr: result.stderr
      };
    }
  }
  const synthesisPrompt = [
    "Merge these independent read-only Codex review outputs for Claude Code.",
    "Return a concise comparison report with sections: consensus, disagreements, deduped findings, and raw reviewer notes.",
    "Do not invent findings that are not present in the reviewer outputs.",
    "",
    outputs.join("\n\n")
  ].join("\n");
  const synthesis = run(
    codexPath,
    ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-C", cwd, "-o", lastMessagePath, synthesisPrompt],
    { cwd, timeoutMs: Math.max(1, remainingTimeout(deadline)) }
  );
  if (synthesis.status !== 0) {
    return {
      ...synthesis,
      stdout: `${outputs.join("\n\n")}\n\n## Synthesis failed\n\n${synthesis.stdout || synthesis.stderr || synthesis.error || ""}`
    };
  }
  return {
    command: codexPath,
    args: ["compare"],
    cwd,
    status: 0,
    signal: null,
    error: null,
    stdout: safeRead(lastMessagePath) || synthesis.stdout || outputs.join("\n\n"),
    stderr: ""
  };
}

function promptFor(intent, mode, userRequest, contextPackage) {
  const request = userRequest || "No explicit task text was provided.";
  if (intent === "search") {
    return [
      "Perform a source-oriented search pass for Claude Code.",
      `Mode: ${mode}`,
      `Question: ${request}`,
      "Return dated findings with source URLs. If sources are unavailable, say so explicitly."
    ].join("\n\n");
  }
  if (intent === "review") {
    return [
      `Perform a ${mode} review for Claude Code.`,
      "Read-only. Do not edit files.",
      `Focus: ${request}`,
      contextPackage.outputContract
    ].join("\n\n");
  }
  if (intent === "rescue") {
    return [
      `Perform a scoped rescue task in ${mode} mode.`,
      mode === "fix" ? "Only edit if the provided profile authorizes writes." : "Diagnose only. Do not edit files.",
      `Problem: ${request}`,
      contextPackage.stopCondition
    ].join("\n\n");
  }
  if (intent === "execute" && mode === "chat") {
    return [
      "Answer this as a single-turn Codex chat response for Claude Code.",
      "Use read-only reasoning unless the prompt explicitly asks for code or command execution through another mode.",
      `Request: ${request}`
    ].join("\n\n");
  }
  if (intent === "execute" && mode === "structured") {
    return [
      "Complete this Codex task and return a final response matching the provided output schema.",
      `Request: ${request}`
    ].join("\n\n");
  }
  return request;
}

function sandboxFor(profile) {
  if (profile === "rescue-workspace") return "workspace-write";
  return "read-only";
}

function validateProfile({ intent, mode, profile }) {
  if (profile === "danger-unrestricted") {
    throw new Error("danger-unrestricted is post-MVP and cannot be used by codex-adapter intents.");
  }
  if (intent === "rescue" && mode === "fix" && profile !== "rescue-workspace") {
    throw new Error("rescue mode=fix requires --profile rescue-workspace.");
  }
  if (intent === "compare" && profile !== "review-readonly") {
    throw new Error("compare is read-only in MVP and requires review-readonly.");
  }
  if (intent === "search" && profile !== "search-readonly") {
    throw new Error("search requires search-readonly in MVP.");
  }
}

function timeoutMs(flags) {
  return Number(flags["timeout-ms"] ?? 1000 * 60 * 20);
}

function remainingTimeout(deadline) {
  return Math.max(0, deadline - Date.now());
}

function timeoutResult(codexPath, cwd, outputs) {
  return {
    command: codexPath,
    args: ["compare"],
    cwd,
    status: 124,
    signal: null,
    error: "compare timeout budget exhausted",
    stdout: outputs.join("\n\n"),
    stderr: "compare timeout budget exhausted"
  };
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function gatedUnavailable(intent, mode, reason) {
  return {
    type: "intent-result",
    jobId: null,
    intent,
    mode,
    status: "gated-unavailable",
    summary: reason,
    output: `Codex Adapter ${intent} is unavailable: ${reason}`,
    artifacts: {}
  };
}
