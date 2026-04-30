export function emit(payload, options = {}) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${renderMarkdown(payload)}\n`);
}

export function renderMarkdown(payload) {
  switch (payload.type) {
    case "setup":
      return renderSetup(payload);
    case "diagnostics":
      return renderDiagnostics(payload);
    case "context-preview":
      return renderContextPreview(payload);
    case "status":
      return renderStatus(payload);
    case "result":
      return renderResult(payload);
    case "cancel":
      return renderCancel(payload);
    case "intent-result":
      return renderIntentResult(payload);
    default:
      return `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
  }
}

function mark(ok) {
  return ok ? "ok" : "fail";
}

function renderSetup(payload) {
  const lines = [
    "# Codex Adapter Setup",
    "",
    `- Codex binary: ${payload.codex.path ?? "not found"} (${mark(payload.codex.available)})`,
    `- Codex version: ${payload.codex.version ?? "unknown"}`,
    `- Auth status: ${payload.auth.status}`,
    `- App-server help: ${mark(payload.appServer.available)}`,
    `- State directory: ${payload.stateDir}`
  ];
  if (payload.nextSteps.length) {
    lines.push("", "Next steps:", ...payload.nextSteps.map((step) => `- ${step}`));
  }
  return lines.join("\n");
}

function renderDiagnostics(payload) {
  const lines = [
    "# Codex Adapter Diagnostics",
    "",
    `- Workspace: ${payload.workspaceRoot}`,
    `- State directory: ${payload.stateDir}`,
    `- Codex binary: ${payload.codex.path ?? "not found"} (${mark(payload.codex.available)})`,
    `- Codex version: ${payload.codex.version ?? "unknown"}`,
    `- Auth status: ${payload.auth.status}`,
    `- App-server: ${mark(payload.appServer.available)}`,
    `- Search gate: ${payload.gates.search.available ? "available" : "unavailable"} (${payload.gates.search.reason})`,
    `- Git repository: ${mark(payload.git.isRepo)}`
  ];
  if (payload.warnings.length) {
    lines.push("", "Warnings:", ...payload.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
}

function renderContextPreview(payload) {
  const pkg = payload.package;
  const lines = [
    "# Codex Context Preview",
    "",
    `- Intent: ${pkg.intent}`,
    `- Mode: ${pkg.mode}`,
    `- Package class: ${pkg.packageClass}`,
    `- Workspace: ${pkg.workspaceRoot}`,
    `- Egress: ${pkg.egress.providerMode}`,
    `- Selected files: ${pkg.files.included.length}`,
    `- Omitted sensitive paths: ${pkg.redaction.omitted.length}`
  ];
  if (pkg.git.statusShort.length) {
    lines.push("", "Git status:", "```text", pkg.git.statusShort.join("\n"), "```");
  }
  if (pkg.redaction.omitted.length) {
    lines.push("", "Redaction report:", ...pkg.redaction.omitted.map((entry) => `- ${entry.path}: ${entry.reason}`));
  }
  return lines.join("\n");
}

function renderStatus(payload) {
  if (!payload.jobs.length) {
    return "No Codex Adapter jobs found for this workspace.";
  }
  const rows = payload.jobs.map((job) => `| ${job.id} | ${job.intent} | ${job.status} | ${job.phase} | ${job.updatedAt} |`);
  return ["| Job | Intent | Status | Phase | Updated |", "|---|---|---|---|---|", ...rows].join("\n");
}

function renderResult(payload) {
  if (!payload.job) {
    return `No job found: ${payload.id}`;
  }
  return `# Codex Adapter Result\n\n\`\`\`json\n${JSON.stringify(payload.result ?? payload.job, null, 2)}\n\`\`\``;
}

function renderCancel(payload) {
  return payload.cancelled ? `Cancelled job ${payload.id}.` : `No cancellable job found: ${payload.id}`;
}

function renderIntentResult(payload) {
  const lines = [
    `# Codex Adapter ${payload.intent}`,
    "",
    `- Status: ${payload.status}`,
    `- Mode: ${payload.mode}`,
    `- Job: ${payload.jobId ?? "none"}`,
    `- Summary: ${payload.summary}`
  ];
  if (payload.output) {
    lines.push("", payload.output.trim());
  }
  if (payload.artifacts && Object.keys(payload.artifacts).length) {
    lines.push("", "Artifacts:", ...Object.entries(payload.artifacts).map(([name, value]) => `- ${name}: ${value}`));
  }
  return lines.join("\n");
}
