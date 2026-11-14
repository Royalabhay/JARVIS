# Testing Strategy

## Test layers
- Unit: contracts, routing, agents, configuration
- Integration contracts: provider and infrastructure adapter boundaries without requiring live cloud access
- Live integration: explicitly configured AWS environments only
- End-to-end: approved user workflows
- Security: authorization and trust-boundary tests
- Failure: timeouts, retries, fallback behavior

## Current automated coverage
- Task validation
- Agent allowlist enforcement
- Agent handler validation
- Unregistered agent rejection
- Orchestrator routing
- Orchestrator agent-failure propagation
- Lifecycle event behavior
- Configuration defaults and production validation
- Configuration edge cases and immutability
- Event contract validation

Every completed phase must have repeatable verification before production deployment.
