import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { collectDiagnostics } from "../scripts/lib/diagnostics.mjs";

describe("diagnostics", () => {
  it("detects a fake authenticated codex binary and search gate", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-test-"));
    const fake = path.join(dir, "codex");
    fs.writeFileSync(
      fake,
      [
        "#!/bin/sh",
        "if [ \"$1\" = \"--version\" ]; then echo 'codex-cli 0.125.0'; exit 0; fi",
        "if [ \"$1\" = \"login\" ] && [ \"$2\" = \"status\" ]; then echo 'Logged in'; exit 0; fi",
        "if [ \"$1\" = \"app-server\" ] && [ \"$2\" = \"--help\" ]; then echo 'app-server help'; exit 0; fi",
        "if [ \"$1\" = \"--help\" ]; then echo 'Usage: codex --search'; exit 0; fi",
        "exit 1"
      ].join("\n")
    );
    fs.chmodSync(fake, 0o755);

    const diagnostics = collectDiagnostics({
      cwd: dir,
      env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") }
    });

    assert.equal(diagnostics.codex.available, true);
    assert.equal(diagnostics.codex.version, "0.125.0");
    assert.equal(diagnostics.auth.status, "authenticated");
    assert.equal(diagnostics.appServer.available, true);
    assert.equal(diagnostics.gates.search.available, true);
  });

  it("warns when codex is older than the MVP baseline", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-old-"));
    const fake = path.join(dir, "codex");
    fs.writeFileSync(
      fake,
      [
        "#!/bin/sh",
        "if [ \"$1\" = \"--version\" ]; then echo 'codex-cli 0.120.0'; exit 0; fi",
        "if [ \"$1\" = \"login\" ] && [ \"$2\" = \"status\" ]; then echo 'Logged in'; exit 0; fi",
        "if [ \"$1\" = \"app-server\" ] && [ \"$2\" = \"--help\" ]; then echo 'app-server help'; exit 0; fi",
        "if [ \"$1\" = \"--help\" ]; then echo 'Usage: codex'; exit 0; fi",
        "exit 1"
      ].join("\n")
    );
    fs.chmodSync(fake, 0o755);

    const diagnostics = collectDiagnostics({
      cwd: dir,
      env: { ...process.env, CODEX_ADAPTER_CODEX_BIN: fake, CODEX_ADAPTER_STATE_DIR: path.join(dir, "state") }
    });

    assert.ok(diagnostics.warnings.some((warning) => warning.includes("older than MVP baseline")));
  });
});
