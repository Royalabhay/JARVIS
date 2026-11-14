const SCHEMAS = {
  ceo: ["summary", "priorities", "recommendedActions"],
  cfo: ["summary", "financialImpact", "risks"],
  cto: ["summary", "architecture", "risks"],
  marketing: ["summary", "campaigns", "metrics"],
  sales: ["summary", "opportunities", "nextActions"]
};

export function validateAgentOutput(agent, output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("Agent output must be an object");
  }
  const required = SCHEMAS[agent] ?? ["summary"];
  const missing = required.filter(key => !(key in output));
  if (missing.length) throw new Error(`Invalid ${agent} output: missing ${missing.join(", ")}`);
  return Object.freeze(output);
}
