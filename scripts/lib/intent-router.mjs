const INTENTS = new Map([
  ["execute", new Set(["chat", "exec", "structured"])],
  ["review", new Set(["code", "plan", "adversarial"])],
  ["rescue", new Set(["diagnose", "fix"])],
  ["search", new Set(["facts", "sources", "recency"])],
  ["compare", new Set(["parallel-review", "rubric"])]
]);

export function normalizeIntent(intent, mode) {
  const normalizedIntent = intent || "execute";
  const modes = INTENTS.get(normalizedIntent);
  if (!modes) {
    throw new Error(`Unknown intent: ${normalizedIntent}`);
  }
  const normalizedMode = mode || defaultMode(normalizedIntent);
  if (!modes.has(normalizedMode)) {
    throw new Error(`Invalid mode for ${normalizedIntent}: ${normalizedMode}`);
  }
  return { intent: normalizedIntent, mode: normalizedMode };
}

export function intentSummary() {
  return Array.from(INTENTS.entries()).map(([intent, modes]) => ({
    intent,
    modes: Array.from(modes)
  }));
}

function defaultMode(intent) {
  switch (intent) {
    case "execute":
      return "chat";
    case "review":
      return "code";
    case "rescue":
      return "diagnose";
    case "search":
      return "sources";
    case "compare":
      return "parallel-review";
    default:
      return "default";
  }
}
