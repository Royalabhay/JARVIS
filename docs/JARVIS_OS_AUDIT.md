# JARVIS OS Preservation & Audit

## Baseline
This branch was created from `codex/sara-voice-assistant-mvp` to preserve the existing Chrome/Windows voice assistant before the JARVIS OS upgrade.

## Preserved components
- Chrome Manifest V3 extension
- Voice/text command UI
- Deterministic command planner
- Shared action schema
- Windows companion agent
- Application and file operations
- Window/UI automation helpers
- Existing JavaScript and Python tests

## Audit findings
### Implemented
The baseline provides a local voice-first assistant for approved browser and Windows actions.

### Missing for complete JARVIS OS
- Cloud control plane
- Master AI orchestrator
- Department/executive agents
- Durable task state
- Shared RAG memory
- AWS Bedrock runtime integration
- Event-driven agent bus
- Worker execution model
- Web command center
- CI/CD and infrastructure deployment

## Safety decision
The legacy local desktop assistant remains isolated behind explicit action validation. Cloud orchestration must not gain arbitrary shell or unrestricted desktop execution.

## Upgrade strategy
1. Preserve baseline.
2. Add AWS control plane.
3. Add typed orchestrator and agent contracts.
4. Add memory and event interfaces.
5. Add infrastructure as code.
6. Add tests and CI.
7. Integrate dashboard and approved business tools.
