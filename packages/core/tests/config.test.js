import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("loads safe defaults for local development", () => {
  const config = loadConfig({});
  assert.equal(config.environment, "local");
  assert.equal(config.awsRegion, "ap-south-1");
  assert.equal(config.modelProvider, "bedrock");
});

test("validates required production configuration", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", JARVIS_ENV: "production" }),
    /Missing required configuration: AWS_REGION/
  );
});
