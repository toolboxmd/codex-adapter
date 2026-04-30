#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_COMMANDS = [
  "setup",
  "diagnostics",
  "context-preview",
  "execute",
  "review",
  "rescue",
  "search",
  "compare",
  "status",
  "result",
  "cancel"
];
const POST_MVP_COMMANDS = ["models", "permissions", "config-debug", "upgrade-check", "mcp", "plugins", "skills", "resume", "fork"];

function main() {
  const manifest = readJson(path.join(ROOT, ".claude-plugin", "plugin.json"));
  assert(manifest.name === "codex-adapter", "manifest name must be codex-adapter");
  assert(typeof manifest.version === "string" && manifest.version, "manifest version is required");
  for (const command of REQUIRED_COMMANDS) {
    const commandPath = path.join(ROOT, "commands", `${command}.md`);
    assert(fs.existsSync(commandPath), `missing command ${command}`);
    const content = fs.readFileSync(commandPath, "utf8");
    assert(content.startsWith("---\n"), `${command} is missing frontmatter`);
    assert(content.includes("description:"), `${command} is missing description`);
  }
  for (const command of POST_MVP_COMMANDS) {
    assert(!fs.existsSync(path.join(ROOT, "commands", `${command}.md`)), `post-MVP command exposed: ${command}`);
  }
  assert(fs.existsSync(path.join(ROOT, "skills", "codex-adapter", "SKILL.md")), "missing bundled skill");
  assert(fs.existsSync(path.join(ROOT, "scripts", "codexctl.mjs")), "missing runtime entrypoint");
  process.stdout.write("codex-adapter plugin layout valid\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main();
