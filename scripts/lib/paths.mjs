import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function pluginRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function workspaceKey(workspaceRoot) {
  return crypto.createHash("sha256").update(path.resolve(workspaceRoot)).digest("hex").slice(0, 16);
}

export function stateRoot(env = process.env) {
  if (env.CODEX_ADAPTER_STATE_DIR) {
    return path.resolve(env.CODEX_ADAPTER_STATE_DIR);
  }
  const xdgState = env.XDG_STATE_HOME;
  if (xdgState) {
    return path.join(xdgState, "codex-adapter");
  }
  return path.join(os.homedir(), ".local", "state", "codex-adapter");
}

export function workspaceStateDir(workspaceRoot, env = process.env) {
  return path.join(stateRoot(env), workspaceKey(workspaceRoot));
}

export function jobsDir(workspaceRoot, env = process.env) {
  return path.join(workspaceStateDir(workspaceRoot, env), "jobs");
}

export function artifactsDir(workspaceRoot, env = process.env) {
  return path.join(workspaceStateDir(workspaceRoot, env), "artifacts");
}

export function nowStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}
