
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { ApiStack } from '../lib/api-stack';
import { ApiDocsStack } from '../lib/api-docs-stack';

const app = new cdk.App();

const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
};

const databaseStack = new DatabaseStack(app, 'EventTicketingStackDatabaseStack8C978210', { env });
const authStack = new AuthStack(app, 'EventTicketingStackAuthStack8C9D77AA', { env });
const frontendStack = new FrontendStack(app, 'EventTicketingStackFrontendStack8E3A3C69', { env });

const verifiedSenderEmail = app.node.tryGetContext('verifiedSenderEmail') || 'noreply@example.com';

const apiStack = new ApiStack(app, 'EventTicketingStackApiStackD88CF0AB', {
  userPoolId: authStack.userPool.userPoolId,
  userPoolArn: authStack.userPool.userPoolArn,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
  usersTableName: databaseStack.usersTable.tableName,
  usersTableArn: databaseStack.usersTable.tableArn,
  eventsTableName: databaseStack.eventsTable.tableName,
  eventsTableArn: databaseStack.eventsTable.tableArn,
  registrationsTableName: databaseStack.registrationsTable.tableName,
  registrationsTableArn: databaseStack.registrationsTable.tableArn,
  coverPhotoBucket: frontendStack.coverPhotoBucket.bucketName,
  verifiedSenderEmail: verifiedSenderEmail,
  env,
});

const apiDocsStack = new ApiDocsStack(app, 'EventTicketingStackApiDocsStack', {
  restApiId: apiStack.api.restApiId,
  stageName: apiStack.api.deploymentStage.stageName,
  websiteBucketName: frontendStack.websiteBucket.bucketName,
  env,
});

apiStack.addDependency(databaseStack);
apiStack.addDependency(authStack);
apiStack.addDependency(frontendStack);
apiDocsStack.addDependency(apiStack);
apiDocsStack.addDependency(frontendStack);