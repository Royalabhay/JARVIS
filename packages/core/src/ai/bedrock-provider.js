import { ModelProvider } from "./model-provider.js";
import { validateInferenceRequest, validateInferenceResponse } from "./contracts.js";
import { withRetry, withTimeout } from "./retry.js";

export class BedrockProvider extends ModelProvider {
  constructor({ client, modelId, maxTokens = 1024, temperature = 0.2, timeoutMs = 30000, maxRetries = 2 }) {
    super();
    if (!client || typeof client.send !== "function") throw new Error("BedrockProvider requires a client with send()");
    if (!modelId) throw new Error("BedrockProvider requires modelId");
    this.client = client;
    this.modelId = modelId;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  async infer(request) {
    validateInferenceRequest(request);
    const result = await withRetry(
      () => withTimeout(
        signal => this.client.send({
          modelId: this.modelId,
          messages: request.messages,
          system: request.system ?? "",
          inferenceConfig: { maxTokens: this.maxTokens, temperature: this.temperature },
          abortSignal: signal
        }),
        this.timeoutMs
      ),
      { retries: this.maxRetries }
    );

    return validateInferenceResponse({
      text: String(result?.text ?? ""),
      modelId: this.modelId,
      usage: result?.usage ?? null,
      stopReason: result?.stopReason ?? "unknown"
    });
  }
}
