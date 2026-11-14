const REQUIRED_BY_ENV = {
  production: ["AWS_REGION", "JARVIS_ENV"]
};

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const required = REQUIRED_BY_ENV[nodeEnv] ?? [];

  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  }

  return Object.freeze({
    nodeEnv,
    environment: env.JARVIS_ENV ?? "local",
    awsRegion: env.AWS_REGION ?? "ap-south-1",
    eventBusName: env.JARVIS_EVENT_BUS_NAME ?? "jarvis-os",
    taskTableName: env.JARVIS_TASK_TABLE_NAME ?? "",
    workerQueueUrl: env.JARVIS_WORKER_QUEUE_URL ?? "",
    logLevel: env.JARVIS_LOG_LEVEL ?? "info",
    modelProvider: env.JARVIS_MODEL_PROVIDER ?? "bedrock",
    modelId: env.JARVIS_MODEL_ID ?? ""
  });
}
