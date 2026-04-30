import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { run } from "../scripts/lib/command.mjs";
import { buildContextPackage } from "../scripts/lib/context-package.mjs";

describe("context package", () => {
  it("uses intent-specific package classes and redacts sensitive files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-context-"));
    run("git", ["init"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".env"), "SECRET=1\n");
    fs.writeFileSync(path.join(dir, "app.js"), "console.log('ok');\n");
    run("git", ["add", "app.js"], { cwd: dir });
    run("git", ["commit", "-m", "init"], { cwd: dir, env: { ...process.env, GIT_AUTHOR_NAME: "A", GIT_AUTHOR_EMAIL: "a@example.com", GIT_COMMITTER_NAME: "A", GIT_COMMITTER_EMAIL: "a@example.com" } });

    const pkg = buildContextPackage({
      cwd: dir,
      intent: "search",
      mode: "sources",
      diagnostics: {
        auth: { status: "authenticated" },
        gates: { search: { available: true } }
      }
    });

    assert.equal(pkg.packageClass, "search-package");
    assert.equal(pkg.profile, "search-readonly");
    assert.ok(pkg.redaction.omitted.some((entry) => entry.path === ".env"));
  });
});
