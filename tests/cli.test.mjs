import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "codexctl.mjs");

describe("codexctl CLI", () => {
  it("prints JSON help", () => {
    const result = spawnSync(process.execPath, [BIN, "help", "--json"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.type, "help");
    assert.deepEqual(payload.controls, ["setup", "diagnostics", "context-preview", "status", "result", "cancel"]);
  });

  it("builds context-preview JSON for review plan", () => {
    const result = spawnSync(process.execPath, [BIN, "context-preview", "--json", "--intent", "review", "--mode", "plan", "check this plan"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.type, "context-preview");
    assert.equal(payload.package.intent, "review");
    assert.equal(payload.package.mode, "plan");
  });

  it("does not let boolean flags swallow task text", () => {
    const result = spawnSync(process.execPath, [BIN, "context-preview", "--json", "--intent", "search", "find sources"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.package.intent, "search");
    assert.equal(payload.package.userRequest, "find sources");
  });
});
