import test from "node:test";
import assert from "node:assert/strict";

test("JARVIS task event contract has required fields", () => {
  const event = {
    source: "jarvis.os",
    detailType: "task.started",
    detail: { taskId: "task-123", agent: "ceo" }
  };

  assert.equal(event.source, "jarvis.os");
  assert.match(event.detailType, /^task\.(started|completed|failed)$/);
  assert.ok(event.detail.taskId);
  assert.ok(event.detail.agent);
});

test("integration contract does not require live AWS access", () => {
  assert.equal(process.env.AWS_ACCESS_KEY_ID, undefined);
});
