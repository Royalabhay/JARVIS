export const MODEL_PROVIDERS = Object.freeze({
  BEDROCK: "bedrock"
});

export function validateInferenceRequest(request) {
  if (!request || typeof request !== "object") throw new Error("Inference request must be an object");
  if (!request.taskId || typeof request.taskId !== "string") throw new Error("Inference request requires taskId");
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new Error("Inference request requires messages");
  }
}

export function validateInferenceResponse(response) {
  if (!response || typeof response !== "object") throw new Error("Inference response must be an object");
  if (typeof response.text !== "string") throw new Error("Inference response requires text");
  if (!response.modelId || typeof response.modelId !== "string") {
    throw new Error("Inference response requires modelId");
  }
  return Object.freeze(response);
}
