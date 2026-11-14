import { ModelProvider } from "./model-provider.js";
import {
  validateInferenceRequest,
  validateInferenceResponse
} from "./contracts.js";

export class BedrockProvider extends ModelProvider {
  constructor({ client, modelId }) {
    super();
    if (!client || typeof client.send !== "function") {
      throw new Error("BedrockProvider requires a client with send()");
    }
    if (!modelId) throw new Error("BedrockProvider requires modelId");
    this.client = client;
    this.modelId = modelId;
  }

  async infer(request) {
    validateInferenceRequest(request);

    // The SDK command is injected by the runtime adapter so core logic remains testable
    // and does not embed credentials.
    const command = {
      modelId: this.modelId,
      taskId: request.taskId,
      messages: request.messages,
      system: request.system ?? ""
    };

    const result = await this.client.send(command);
    return validateInferenceResponse({
      text: String(result?.text ?? ""),
      modelId: this.modelId,
      usage: result?.usage ?? null,
      stopReason: result?.stopReason ?? "unknown"
    });
  }
}
