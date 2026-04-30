import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("plugin layout", () => {
  it("contains the Claude plugin manifest and semantic command files", () => {
    assert.ok(fs.existsSync(path.join(ROOT, ".claude-plugin", "plugin.json")));
    for (const command of ["setup", "diagnostics", "context-preview", "execute", "review", "rescue", "search", "compare", "status", "result", "cancel"]) {
      assert.ok(fs.existsSync(path.join(ROOT, "commands", `${command}.md`)), command);
    }
  });

  it("does not expose post-MVP admin commands as public command files", () => {
    for (const command of ["models", "permissions", "config-debug", "upgrade-check", "mcp", "plugins", "skills", "resume", "fork"]) {
      assert.equal(fs.existsSync(path.join(ROOT, "commands", `${command}.md`)), false, command);
    }
  });
});
