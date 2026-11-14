# Security

## Principles
- Least-privilege IAM
- Explicit tool allowlists
- Secrets outside source control
- Human approval for consequential actions
- Audit events for agent and tool activity
- Input and output validation at trust boundaries

The local Windows companion must never accept arbitrary shell commands from natural-language or model output.
