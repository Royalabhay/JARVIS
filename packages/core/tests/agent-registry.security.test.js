import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry } from "../src/agent-registry.js";

test("rejects registration of unknown agents", () => {
  const registry = new AgentRegistry();
  assert.throws(() => registry.register("rogue-agent", async () => ({})), /Unknown agent/);
});

test("rejects non-function handlers", () => {
  const registry = new AgentRegistry();
  assert.throws(() => registry.register("ceo", "not-a-function"), /handler must be a function/);
});

test("rejects invocation of unregistered agents", async () => {
  const registry = new AgentRegistry();
  await assert.rejects(() => registry.invoke("ceo", {}), /Agent not registered/);
});
