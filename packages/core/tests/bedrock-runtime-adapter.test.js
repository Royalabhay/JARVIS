import test from "node:test";
import assert from "node:assert/strict";
import { BedrockRuntimeAdapter } from "../src/ai/bedrock-runtime-adapter.js";

test("BedrockRuntimeAdapter converts Bedrock response to JARVIS response", async () => {
  const adapter = new BedrockRuntimeAdapter({
    client: {
      async send() {
        return {
          output: { message: { content: [{ text: "Hello " }, { text: "JARVIS" }] } },
          usage: { inputTokens: 1 },
          stopReason: "end_turn"
        };
      }
    }
  });

  const response = await adapter.send({
    modelId: "test-model",
    messages: [{ role: "user", content: [{ text: "hi" }] }]
  });

  assert.equal(response.text, "Hello JARVIS");
  assert.equal(response.stopReason, "end_turn");
});
