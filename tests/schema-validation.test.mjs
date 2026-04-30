import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { validateJsonOutput } from "../scripts/lib/schema-validation.mjs";

describe("schema validation", () => {
  it("validates simple structured output", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-schema-"));
    const schema = path.join(dir, "schema.json");
    fs.writeFileSync(
      schema,
      JSON.stringify({
        type: "object",
        additionalProperties: false,
        required: ["status"],
        properties: {
          status: { type: "string" }
        }
      })
    );

    assert.equal(validateJsonOutput('{"status":"ok"}', schema).valid, true);
    const invalid = validateJsonOutput('{"status":"ok","extra":true}', schema);
    assert.equal(invalid.valid, false);
    assert.ok(invalid.errors.some((error) => error.includes("not allowed")));
  });
});
