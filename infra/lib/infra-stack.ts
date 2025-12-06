import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
import { AuthStack } from './auth-stack';
import { FrontendStack } from './frontend-stack';
import { ApiStack } from './api-stack';
import { ApiDocsStack } from './api-docs-stack';

export type InfraStackProps = cdk.StackProps

export class InfraStack extends cdk.Stack {
  public readonly databaseStack: DatabaseStack;
  public readonly authStack: AuthStack;
  public readonly frontendStack: FrontendStack;
  public readonly apiStack: ApiStack;
  public readonly apiDocsStack: ApiDocsStack;

  constructor(scope: Construct, id: string, props?: InfraStackProps) {
    super(scope, id, props);

    const verifiedSenderEmail = this.node.tryGetContext('verifiedSenderEmail') || 'noreply@example.com';

    this.databaseStack = new DatabaseStack(this, 'DatabaseStack', {
      env: props?.env,
    });

    this.authStack = new AuthStack(this, 'AuthStack', {
      env: props?.env,
    });

    this.frontendStack = new FrontendStack(this, 'FrontendStack', {
      env: props?.env,
    });

    this.apiStack = new ApiStack(this, 'ApiStack', {
      userPoolId: this.authStack.userPool.userPoolId,
      userPoolArn: this.authStack.userPool.userPoolArn,
      userPoolClientId: this.authStack.userPoolClient.userPoolClientId,
      usersTableName: this.databaseStack.usersTable.tableName,
      usersTableArn: this.databaseStack.usersTable.tableArn,
      eventsTableName: this.databaseStack.eventsTable.tableName,
      eventsTableArn: this.databaseStack.eventsTable.tableArn,
      registrationsTableName: this.databaseStack.registrationsTable.tableName,
      registrationsTableArn: this.databaseStack.registrationsTable.tableArn,
      coverPhotoBucket: this.frontendStack.coverPhotoBucket.bucketName,
      verifiedSenderEmail: verifiedSenderEmail,
      env: props?.env,
    });

    this.apiDocsStack = new ApiDocsStack(this, 'ApiDocsStack', {
      restApiId: this.apiStack.api.restApiId,
      stageName: this.apiStack.api.deploymentStage.stageName,
      websiteBucketName: this.frontendStack.websiteBucket.bucketName,
      env: props?.env,
    });

    new cdk.CfnOutput(this, 'StackSummary', {
      value: 'Event Ticketing System Infrastructure Deployed',
      description: 'Infrastructure deployment status',
    });
  }
}
