import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("plugin validator", () => {
  it("validates the bundled plugin layout", () => {
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate-plugin.mjs")], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /layout valid/);
  });
});
