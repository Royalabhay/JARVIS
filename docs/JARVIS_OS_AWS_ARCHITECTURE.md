# JARVIS OS AWS Architecture

## Control plane
Next.js Command Center -> API -> JARVIS Orchestrator -> Agent Router

## Intelligence
AWS Bedrock provides model inference behind provider interfaces so models can be changed without rewriting business logic.

## Eventing
EventBridge carries task lifecycle events. Durable task records and memory metadata are stored separately from ephemeral model context.

## Memory
Memory ingestion -> embedding provider -> vector index -> retrieval -> orchestrator context assembly.

## Agents
- CEO: strategy and prioritization
- CFO: financial analysis
- CTO: technical architecture
- Marketing
- Sales
- HR
- Legal
- Research
- Personal Assistant
- E-commerce
- SaaS Builder

Agents return structured proposals; the orchestrator controls delegation and approval.

## Security
- Least-privilege IAM
- Secrets outside source control
- Explicit tool allowlists
- Human approval for consequential external actions
- Audit events for agent decisions and tool calls

## Deployment
AWS CDK provisions the initial event bus, API/control-plane resources and observability components. Environment-specific values are supplied through AWS configuration, not committed secrets.
