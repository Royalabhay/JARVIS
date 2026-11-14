import test from "node:test";
import assert from "node:assert/strict";
import { validateAgentOutput } from "../src/ai/structured-output.js";

test("validates CEO structured output", () => {
  const output = validateAgentOutput("ceo", {
    summary: "Plan",
    priorities: [],
    recommendedActions: []
  });
  assert.ok(Object.isFrozen(output));
});

test("rejects incomplete agent output", () => {
  assert.throws(
    () => validateAgentOutput("cfo", { summary: "Missing fields" }),
    /financialImpact/
  );
});
