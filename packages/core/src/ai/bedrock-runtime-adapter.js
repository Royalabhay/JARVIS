import {
  BedrockRuntimeClient,
  ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";

export class BedrockRuntimeAdapter {
  constructor({ region, client } = {}) {
    this.client = client ?? new BedrockRuntimeClient({ region });
  }

  async send({ modelId, messages, system, inferenceConfig, abortSignal }) {
    const command = new ConverseCommand({
      modelId,
      system: system ? [{ text: system }] : undefined,
      messages,
      inferenceConfig
    });

    const response = await this.client.send(command, { abortSignal });
    return {
      text: response.output?.message?.content
        ?.filter(part => typeof part.text === "string")
        .map(part => part.text)
        .join("") ?? "",
      usage: response.usage ?? null,
      stopReason: response.stopReason ?? "unknown"
    };
  }
}
