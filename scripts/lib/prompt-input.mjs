import fs from "node:fs";
import path from "node:path";

const MAX_PROMPT_FILE_BYTES = 1024 * 1024;

export function resolveTaskInput(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const flags = options.flags ?? {};
  const positional = options.positional ?? [];
  const inlineText = positional.join(" ").trim();
  const promptFileFlag = flags["prompt-file"];

  if (!promptFileFlag) {
    return {
      text: inlineText,
      source: inlineText ? "positional" : "empty",
      promptFile: null
    };
  }

  if (promptFileFlag === true) {
    throw new Error("--prompt-file requires a file path.");
  }

  const promptFilePath = path.resolve(cwd, String(promptFileFlag));
  let stat;
  try {
    stat = fs.statSync(promptFilePath);
  } catch {
    throw new Error(`--prompt-file not found: ${promptFileFlag}`);
  }
  if (!stat.isFile()) {
    throw new Error(`--prompt-file must reference a file: ${promptFileFlag}`);
  }
  if (stat.size > MAX_PROMPT_FILE_BYTES) {
    throw new Error(`--prompt-file is too large (${stat.size} bytes); max is ${MAX_PROMPT_FILE_BYTES} bytes.`);
  }

  const fileText = fs.readFileSync(promptFilePath, "utf8");
  return {
    text: inlineText ? `${fileText.trimEnd()}\n\n${inlineText}` : fileText,
    source: inlineText ? "prompt-file+positional" : "prompt-file",
    promptFile: {
      path: path.relative(cwd, promptFilePath) || path.basename(promptFilePath),
      absolutePath: promptFilePath,
      sizeBytes: stat.size
    }
  };
}

export function taskInputContext(taskInput) {
  return {
    source: taskInput.source,
    promptFile: taskInput.promptFile
      ? {
          path: taskInput.promptFile.path,
          sizeBytes: taskInput.promptFile.sizeBytes
        }
      : null
  };
}
