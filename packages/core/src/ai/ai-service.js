export class AiService {
  constructor({ provider }) {
    if (!provider || typeof provider.infer !== "function") {
      throw new Error("AiService requires an inference provider");
    }
    this.provider = provider;
  }

  async run(request) {
    return this.provider.infer(request);
  }
}
