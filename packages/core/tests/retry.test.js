import test from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/ai/retry.js";

test("retries transient failures", async () => {
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts += 1;
    if (attempts < 2) throw new Error("temporary");
    return "ok";
  }, { retries: 2, delayMs: 1 });

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});
