import { spawnSync } from "node:child_process";

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeoutMs ?? 10000,
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 8
  });

  return {
    command,
    args,
    cwd: options.cwd ?? process.cwd(),
    status: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export function runOk(command, args = [], options = {}) {
  const result = run(command, args, options);
  return result.status === 0 && !result.error;
}
