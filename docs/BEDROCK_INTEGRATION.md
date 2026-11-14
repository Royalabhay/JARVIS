# AWS Bedrock Intelligence

## Architecture

JARVIS Orchestrator -> AI Service -> Model Provider -> AWS Bedrock runtime adapter -> Selected Model

## Design principles

- Provider abstraction prevents application logic from depending directly on one model.
- AWS credentials are supplied by the runtime environment or IAM roles, never source code.
- Requests and responses are validated at the provider boundary.
- Model output is treated as untrusted data until validated by downstream contracts.
- Production model IDs are configured through environment settings.

## Current Phase 3 foundation

Implemented:
- Inference request and response contracts
- Model provider abstraction
- Bedrock provider adapter
- AI service facade
- Unit tests using a mocked runtime client

Pending before production deployment:
- AWS SDK runtime adapter
- Bedrock model selection policy
- Retry and timeout policy
- Structured-output schema enforcement for agent-specific tasks
- Live integration tests against an explicitly configured AWS environment
