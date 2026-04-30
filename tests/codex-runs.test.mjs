import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runIntent } from "../scripts/lib/codex-runs.mjs";
import { createJob, readJob } from "../scripts/lib/jobs.mjs";

describe("codex intent runner", () => {
  it("runs execute through a fake codex binary and persists artifacts", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-run-"));
    const fake = makeFakeCodex(dir);

    const result = runIntent("execute", {
      cwd: dir,
      env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") },
      flags: { mode: "exec" },
      positional: ["return", "ok"]
    });

    assert.equal(result.status, "completed");
    assert.equal(result.output, "fake final answer\n");
    assert.ok(fs.existsSync(result.artifacts.contextPackage));
    assert.ok(fs.existsSync(result.artifacts.result));
  });

  it("rejects post-MVP danger profile", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-run-"));
    const fake = makeFakeCodex(dir);

    assert.throws(
      () =>
        runIntent("execute", {
          cwd: dir,
          env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") },
          flags: { mode: "exec", profile: "danger-unrestricted" },
          positional: ["return", "ok"]
        }),
      /danger-unrestricted/
    );
  });

  it("requires a schema for structured execute", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-structured-"));
    const fake = makeFakeCodex(dir);

    assert.throws(
      () =>
        runIntent("execute", {
          cwd: dir,
          env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") },
          flags: { mode: "structured" },
          positional: ["return", "ok"]
        }),
      /requires --schema/
    );
  });

  it("fails structured execute when fake output violates schema", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-structured-invalid-"));
    const fake = makeFakeCodex(dir);
    const schema = path.join(dir, "schema.json");
    fs.writeFileSync(
      schema,
      JSON.stringify({
        type: "object",
        additionalProperties: false,
        required: ["expected"],
        properties: { expected: { type: "string" } }
      })
    );

    const result = runIntent("execute", {
      cwd: dir,
      env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") },
      flags: { mode: "structured", schema },
      positional: ["return", "ok"]
    });

    assert.equal(result.status, "failed");
    assert.equal(result.structuredValidation.valid, false);
  });

  it("marks timed out codex runs as failed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-timeout-"));
    const fake = path.join(dir, "slow-codex");
    fs.writeFileSync(
      fake,
      [
        "#!/bin/sh",
        "if [ \"$1\" = \"--version\" ]; then echo 'codex-cli 0.125.0'; exit 0; fi",
        "if [ \"$1\" = \"login\" ] && [ \"$2\" = \"status\" ]; then echo 'Logged in'; exit 0; fi",
        "if [ \"$1\" = \"app-server\" ] && [ \"$2\" = \"--help\" ]; then echo 'app-server help'; exit 0; fi",
        "if [ \"$1\" = \"--help\" ]; then echo 'Usage: codex --search'; exit 0; fi",
        "sleep 2",
        "echo too-late"
      ].join("\n")
    );
    fs.chmodSync(fake, 0o755);

    const result = runIntent("execute", {
      cwd: dir,
      env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") },
      flags: { mode: "exec", "timeout-ms": "10" },
      positional: ["timeout"]
    });

    assert.equal(result.status, "failed");
    assert.match(result.error, /ETIMEDOUT/);
  });

  it("runs compare synthesis through fake codex", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-compare-"));
    const fake = makeFakeCodex(dir);
    const result = runIntent("compare", {
      cwd: dir,
      env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") },
      flags: { mode: "parallel-review", count: "2" },
      positional: ["compare", "this"]
    });

    assert.equal(result.status, "completed");
    assert.equal(result.output, "fake final answer\n");
  });

  it("marks stale active jobs as failed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-stale-"));
    const env = { ...process.env, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") };
    const job = createJob(
      {
        id: "stale-job",
        intent: "execute",
        status: "running",
        phase: "test",
        pid: 99999999
      },
      { cwd: dir, env }
    );
    assert.equal(job.status, "running");
    const reconciled = readJob("stale-job", { cwd: dir, env });
    assert.equal(reconciled.status, "failed");
    assert.equal(reconciled.phase, "stale-process");
  });
});

function makeFakeCodex(dir) {
  const fake = path.join(dir, "codex-fake.mjs");
  fs.writeFileSync(
    fake,
    [
      "#!/usr/bin/env node",
      "import fs from 'node:fs';",
      "const args = process.argv.slice(2);",
      "if (args[0] === '--version') { console.log('codex-cli 0.125.0'); process.exit(0); }",
      "if (args[0] === 'login' && args[1] === 'status') { console.log('Logged in'); process.exit(0); }",
      "if (args[0] === 'app-server' && args[1] === '--help') { console.log('app-server help'); process.exit(0); }",
      "if (args[0] === '--help') { console.log('Usage: codex --search'); process.exit(0); }",
      "const outIndex = args.indexOf('-o');",
      "if (outIndex !== -1) fs.writeFileSync(args[outIndex + 1], 'fake final answer\\n');",
      "console.log('fake stdout');"
    ].join("\n")
  );
  fs.chmodSync(fake, 0o755);
  return fake;
}
