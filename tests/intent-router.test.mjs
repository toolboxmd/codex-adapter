import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intentSummary, normalizeIntent } from "../scripts/lib/intent-router.mjs";

describe("intent router", () => {
  it("normalizes supported semantic intents", () => {
    assert.deepEqual(normalizeIntent("review", "plan"), { intent: "review", mode: "plan" });
    assert.deepEqual(normalizeIntent("search"), { intent: "search", mode: "sources" });
  });

  it("rejects unknown intents and invalid modes", () => {
    assert.throws(() => normalizeIntent("models"), /Unknown intent/);
    assert.throws(() => normalizeIntent("review", "fork"), /Invalid mode/);
  });

  it("summarizes the MVP public intent surface", () => {
    assert.deepEqual(
      intentSummary().map((entry) => entry.intent),
      ["execute", "review", "rescue", "search", "compare"]
    );
  });
});
