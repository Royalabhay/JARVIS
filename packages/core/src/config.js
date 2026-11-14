const REQUIRED_BY_ENV = {
  production: ["AWS_REGION", "JARVIS_ENV", "JARVIS_MODEL_ID"]
};

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const required = REQUIRED_BY_ENV[nodeEnv] ?? [];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);

  return Object.freeze({
    nodeEnv,
    environment: env.JARVIS_ENV || "local",
    awsRegion: env.AWS_REGION || "ap-south-1",
    eventBusName: env.JARVIS_EVENT_BUS_NAME || "jarvis-os",
    taskTableName: env.JARVIS_TASK_TABLE_NAME || "",
    workerQueueUrl: env.JARVIS_WORKER_QUEUE_URL || "",
    logLevel: env.JARVIS_LOG_LEVEL || "info",
    modelProvider: env.JARVIS_MODEL_PROVIDER || "bedrock",
    modelId: env.JARVIS_MODEL_ID || "",
    modelMaxTokens: positiveInt(env.JARVIS_MODEL_MAX_TOKENS, 1024, "JARVIS_MODEL_MAX_TOKENS"),
    modelTimeoutMs: positiveInt(env.JARVIS_MODEL_TIMEOUT_MS, 30000, "JARVIS_MODEL_TIMEOUT_MS"),
    modelMaxRetries: positiveInt(env.JARVIS_MODEL_MAX_RETRIES, 2, "JARVIS_MODEL_MAX_RETRIES"),
    modelTemperature: Number(env.JARVIS_MODEL_TEMPERATURE || 0.2)
  });
}
