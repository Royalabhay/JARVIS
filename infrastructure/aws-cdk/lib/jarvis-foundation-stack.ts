import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export class JarvisFoundationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const eventBus = new events.EventBus(this, "JarvisEventBus", {
      eventBusName: "jarvis-os"
    });

    const taskTable = new dynamodb.Table(this, "JarvisTasks", {
      partitionKey: { name: "taskId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const auditLogGroup = new logs.LogGroup(this, "JarvisAuditLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const deadLetterQueue = new sqs.Queue(this, "JarvisEventsDLQ", {
      retentionPeriod: cdk.Duration.days(14)
    });

    const workerQueue = new sqs.Queue(this, "JarvisWorkerQueue", {
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3
      }
    });

    const taskEvents = new events.Rule(this, "JarvisTaskEvents", {
      eventBus,
      eventPattern: {
        source: ["jarvis.os"],
        detailType: ["task.started", "task.completed", "task.failed"]
      }
    });
    taskEvents.addTarget(new (require("aws-cdk-lib/aws-events-targets").SqsQueue)(workerQueue));

    const orchestratorRole = new iam.Role(this, "JarvisOrchestratorRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Least-privilege execution role for future JARVIS orchestrator compute"
    });
    orchestratorRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    );
    eventBus.grantPutEventsTo(orchestratorRole);
    taskTable.grantReadWriteData(orchestratorRole);
    workerQueue.grantSendMessages(orchestratorRole);

    new cloudwatch.Alarm(this, "JarvisWorkerDLQAlarm", {
      metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cdk.CfnOutput(this, "EventBusName", { value: eventBus.eventBusName });
    new cdk.CfnOutput(this, "TaskTableName", { value: taskTable.tableName });
    new cdk.CfnOutput(this, "WorkerQueueUrl", { value: workerQueue.queueUrl });
    new cdk.CfnOutput(this, "AuditLogGroup", { value: auditLogGroup.logGroupName });
  }
}
