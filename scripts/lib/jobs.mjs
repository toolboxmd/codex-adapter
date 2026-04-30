import fs from "node:fs";
import path from "node:path";
import { artifactsDir, jobsDir, nowStamp } from "./paths.mjs";

export function listJobs(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dir = jobsDir(cwd, options.env ?? process.env);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(path.join(dir, name)))
    .filter(Boolean)
    .map((job) => reconcileJob(job, options))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function readJob(id, options = {}) {
  if (!id) return null;
  const cwd = options.cwd ?? process.cwd();
  const job = readJson(path.join(jobsDir(cwd, options.env ?? process.env), `${id}.json`));
  return job ? reconcileJob(job, options) : null;
}

export function createJob(data, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dir = jobsDir(cwd, options.env ?? process.env);
  fs.mkdirSync(dir, { recursive: true });
  const id = data.id ?? `job-${nowStamp()}-${Math.random().toString(16).slice(2, 8)}`;
  const now = new Date().toISOString();
  const job = {
    ...data,
    id,
    intent: data.intent ?? "unknown",
    mode: data.mode ?? "default",
    status: data.status ?? "queued",
    phase: data.phase ?? "created",
    workspaceRoot: cwd,
    createdAt: now,
    updatedAt: now
  };
  writeJob(job, options);
  return job;
}

export function jobArtifactDir(job, options = {}) {
  const cwd = options.cwd ?? job.workspaceRoot ?? process.cwd();
  const dir = path.join(artifactsDir(cwd, options.env ?? process.env), job.id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJob(job, options = {}) {
  const cwd = options.cwd ?? job.workspaceRoot ?? process.cwd();
  const dir = jobsDir(cwd, options.env ?? process.env);
  fs.mkdirSync(dir, { recursive: true });
  const next = { ...job, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, `${next.id}.json`), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function cancelJob(id, options = {}) {
  const job = readJob(id, options);
  if (!job || ["completed", "failed", "cancelled"].includes(job.status)) {
    return { cancelled: false, job };
  }
  if (job.pid) {
    try {
      process.kill(job.pid, "SIGTERM");
    } catch {
      // The process may have already exited; the durable state still records cancellation.
    }
  }
  const next = writeJob(
    {
      ...job,
      status: "cancelled",
      phase: "cancelled",
      cancelRequestedAt: new Date().toISOString(),
      cancelResult: "marked cancelled by codex-adapter MVP"
    },
    options
  );
  return { cancelled: true, job: next };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function reconcileJob(job, options = {}) {
  if (!["queued", "running", "pending_approval"].includes(job.status) || !job.pid) {
    return job;
  }
  if (isProcessAlive(job.pid)) {
    return job;
  }
  return writeJob(
    {
      ...job,
      status: "failed",
      phase: "stale-process",
      error: "Recorded process is no longer running and no final result was persisted."
    },
    options
  );
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
