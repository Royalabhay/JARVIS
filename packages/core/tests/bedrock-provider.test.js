import test from "node:test";
import assert from "node:assert/strict";
import { BedrockProvider } from "../src/ai/bedrock-provider.js";

test("BedrockProvider validates configuration", () => {
  assert.throws(() => new BedrockProvider({ client: {}, modelId: "model" }), /send/);
  assert.throws(() => new BedrockProvider({ client: { send() {} } }), /modelId/);
});

test("BedrockProvider sends a structured request and validates response", async () => {
  const received = [];
  const provider = new BedrockProvider({
    modelId: "test-model",
    client: {
      async send(command) {
        received.push(command);
        return { text: "hello", usage: { inputTokens: 2 }, stopReason: "end_turn" };
      }
    }
  });

  const response = await provider.infer({
    taskId: "task-1",
    messages: [{ role: "user", content: "Hello JARVIS" }]
  });

  assert.equal(received[0].modelId, "test-model");
  assert.equal(response.text, "hello");
  assert.equal(response.modelId, "test-model");
  assert.ok(Object.isFrozen(response));
});

test("BedrockProvider rejects malformed requests", async () => {
  const provider = new BedrockProvider({
    modelId: "test-model",
    client: { async send() { return { text: "unused" }; } }
  });

  await assert.rejects(() => provider.infer({ taskId: "x", messages: [] }), /requires messages/);
});
