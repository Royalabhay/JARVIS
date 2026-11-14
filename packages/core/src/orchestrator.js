import { createTask } from "./contracts.js";

const DEFAULT_ROUTING = [
  { pattern: /revenue|profit|budget|finance|cost/i, agent: "cfo" },
  { pattern: /architecture|code|aws|system|technical/i, agent: "cto" },
  { pattern: /marketing|campaign|ads|seo|brand/i, agent: "marketing" },
  { pattern: /sales|lead|pipeline|conversion/i, agent: "sales" },
  { pattern: /research|analyse|analyze|compare/i, agent: "research" }
];

export class JarvisOrchestrator {
  constructor({ registry, eventSink = async () => {}, routing = DEFAULT_ROUTING } = {}) {
    if (!registry) throw new Error("registry is required");
    this.registry = registry;
    this.eventSink = eventSink;
    this.routing = routing;
  }

  selectAgent(goal) {
    return this.routing.find(rule => rule.pattern.test(goal))?.agent ?? "ceo";
  }

  async run(input) {
    const task = createTask(input);
    const agent = this.selectAgent(task.goal);

    await this.eventSink({ type: "jarvis.task.started", taskId: task.id, agent });
    const result = await this.registry.invoke(agent, task);
    await this.eventSink({ type: "jarvis.task.completed", taskId: task.id, agent });

    return { task, agent, result };
  }
}
