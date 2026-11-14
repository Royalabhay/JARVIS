# JARVIS Orchestrator

The orchestrator receives a task, selects an allowed agent, emits lifecycle events, invokes the agent, and records the outcome.

## Rules
- Agents must be explicitly registered.
- Unknown agents cannot be invoked.
- External consequential actions require an approval boundary.
- Model output is data, not executable instructions.
