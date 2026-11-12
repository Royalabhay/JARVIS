import { AGENTS } from "./contracts.js";

export class AgentRegistry {
  constructor() {
    this.handlers = new Map();
  }

  register(name, handler) {
    if (!AGENTS.includes(name)) throw new Error(`Unknown agent: ${name}`);
    if (typeof handler !== "function") throw new Error("Agent handler must be a function");
    this.handlers.set(name, handler);
  }

  has(name) {
    return this.handlers.has(name);
  }

  async invoke(name, task) {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`Agent not registered: ${name}`);
    return handler(task);
  }
}
