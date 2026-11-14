# JARVIS OS AWS Foundation

Phase 2 provisions the initial control-plane resources:

- Custom Amazon EventBridge bus for JARVIS task events
- DynamoDB task-state table with on-demand billing and point-in-time recovery
- SQS worker queue and dead-letter queue
- CloudWatch alarm for DLQ visibility
- CloudWatch Logs group for audit logging
- Least-privilege execution role for future orchestrator compute

## Prerequisites

- AWS account
- AWS CLI credentials configured
- Node.js
- AWS CDK bootstrap completed for the target account and Region

## Commands

```bash
cd infrastructure/aws-cdk
npm install
npm run build
npx cdk synth
npx cdk deploy
```

No AWS credentials or secrets are committed to this repository. Deployment requires explicit credentials configured in the deployer's environment.
