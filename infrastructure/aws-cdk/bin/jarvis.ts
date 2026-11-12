import * as cdk from "aws-cdk-lib";
import { JarvisFoundationStack } from "../lib/jarvis-foundation-stack";

const app = new cdk.App();

new JarvisFoundationStack(app, "JarvisFoundationStack", {
  description: "JARVIS OS Phase 2 AWS foundation",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1"
  }
});
