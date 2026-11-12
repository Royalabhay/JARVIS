import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry } from "../src/agent-registry.js";
import { JarvisOrchestrator } from "../src/orchestrator.js";

test("routes a marketing task to the marketing agent", async () => {
  const registry = new AgentRegistry();
  registry.register("marketing", async task => ({ owner: "marketing", goal: task.goal }));
  const events = [];
  const jarvis = new JarvisOrchestrator({
    registry,
    eventSink: async event => events.push(event)
  });

  const output = await jarvis.run({
    id: "task-1",
    goal: "Create a Meta Ads marketing campaign"
  });

  assert.equal(output.agent, "marketing");
  assert.equal(output.result.owner, "marketing");
  assert.deepEqual(events.map(x => x.type), ["jarvis.task.started", "jarvis.task.completed"]);
});

test("falls back to CEO for general strategy", async () => {
  const registry = new AgentRegistry();
  registry.register("ceo", async () => ({ owner: "ceo" }));
  const jarvis = new JarvisOrchestrator({ registry });

  const output = await jarvis.run({ id: "task-2", goal: "Prioritize our next quarter strategy" });
  assert.equal(output.agent, "ceo");
});
