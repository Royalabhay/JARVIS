export const AGENTS = Object.freeze([
  "ceo","cfo","cto","marketing","sales","hr","legal","research",
  "personal-assistant","ecommerce","saas-builder"
]);

export function createTask({ id, goal, requestedBy = "user", context = {} }) {
  if (!id || !goal) throw new Error("Task requires id and goal");
  return Object.freeze({
    id,
    goal,
    requestedBy,
    context,
    status: "queued",
    createdAt: new Date().toISOString()
  });
}
