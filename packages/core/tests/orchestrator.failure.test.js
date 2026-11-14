import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry } from "../src/agent-registry.js";
import { JarvisOrchestrator } from "../src/orchestrator.js";

test("propagates agent failure and does not emit completion", async () => {
  const registry = new AgentRegistry();
  registry.register("ceo", async () => {
    throw new Error("agent unavailable");
  });

  const events = [];
  const jarvis = new JarvisOrchestrator({
    registry,
    eventSink: async event => events.push(event)
  });

  await assert.rejects(
    () => jarvis.run({ id: "failure-1", goal: "General strategy" }),
    /agent unavailable/
  );

  assert.deepEqual(events.map(event => event.type), ["jarvis.task.started"]);
});

test("rejects invalid tasks before agent invocation", async () => {
  const registry = new AgentRegistry();
  let called = false;
  registry.register("ceo", async () => {
    called = true;
    return {};
  });

  const jarvis = new JarvisOrchestrator({ registry });

  await assert.rejects(() => jarvis.run({ id: "", goal: "" }), /Task requires id and goal/);
  assert.equal(called, false);
});
