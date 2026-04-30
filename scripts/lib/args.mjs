export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  const booleanFlags = new Set(["json", "background", "resume-last", "wait", "all", "help"]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith("--") || arg === "-") {
      positional.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf("=");
    if (eqIndex !== -1) {
      flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const name = arg.slice(2);
    if (booleanFlags.has(name)) {
      flags[name] = true;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[name] = next;
      index += 1;
    } else {
      flags[name] = true;
    }
  }

  return { flags, positional };
}

export function boolFlag(flags, name) {
  return flags[name] === true || flags[name] === "true" || flags[name] === "1";
}
