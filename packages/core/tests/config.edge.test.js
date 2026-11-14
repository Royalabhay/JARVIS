import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("allows explicit staging configuration", () => {
  const config = loadConfig({
    NODE_ENV: "development",
    JARVIS_ENV: "staging",
    AWS_REGION: "us-east-1",
    JARVIS_MODEL_PROVIDER: "bedrock"
  });

  assert.equal(config.environment, "staging");
  assert.equal(config.awsRegion, "us-east-1");
});

test("returns an immutable configuration object", () => {
  const config = loadConfig({});
  assert.throws(() => {
    config.awsRegion = "invalid";
  }, TypeError);
});

test("uses defaults when optional values are empty", () => {
  const config = loadConfig({
    JARVIS_EVENT_BUS_NAME: "",
    JARVIS_LOG_LEVEL: "",
    JARVIS_MODEL_PROVIDER: ""
  });

  assert.equal(config.eventBusName, "jarvis-os");
  assert.equal(config.logLevel, "info");
  assert.equal(config.modelProvider, "bedrock");
});
