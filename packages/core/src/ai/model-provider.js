export class ModelProvider {
  async infer(_request) {
    throw new Error("ModelProvider.infer must be implemented");
  }
}
