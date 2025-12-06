import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  userPoolId: string;
  userPoolArn: string;
  userPoolClientId: string;
  usersTableName: string;
  usersTableArn: string;
  eventsTableName: string;
  eventsTableArn: string;
  registrationsTableName: string;
  registrationsTableArn: string;
  coverPhotoBucket: string;
  verifiedSenderEmail: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly registerFunction: NodejsFunction;
  public readonly loginFunction: NodejsFunction;
  public readonly createEventFunction: NodejsFunction;
  public readonly getEventFunction: NodejsFunction;
  public readonly updateEventFunction: NodejsFunction;
  public readonly listEventsFunction: NodejsFunction;
  public readonly deleteEventFunction: NodejsFunction;
  public readonly generatePresignedUrlFunction: NodejsFunction;
  public readonly registerForEventFunction: NodejsFunction;
  public readonly getUserRegistrationsFunction: NodejsFunction;
  public readonly getRegistrationFunction: NodejsFunction;
  public readonly getOrganizerEventsFunction: NodejsFunction;
  public readonly getEventAttendeesFunction: NodejsFunction;
  public readonly exportEventAttendeesFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.api = new apigateway.RestApi(this, 'EventTicketingApi', {
      restApiName: 'EventTicketing-API',
      description: 'Event Ticketing System API',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    this.registerFunction = new NodejsFunction(this, 'RegisterFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/auth/register.ts'),
      environment: {
        USER_POOL_ID: props.userPoolId,
        USER_POOL_CLIENT_ID: props.userPoolClientId,
        USERS_TABLE_NAME: props.usersTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.loginFunction = new NodejsFunction(this, 'LoginFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/auth/login.ts'),
      environment: {
        USER_POOL_CLIENT_ID: props.userPoolClientId,
        USERS_TABLE_NAME: props.usersTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.registerFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: [props.usersTableArn, `${props.usersTableArn}/index/*`],
      })
    );

    this.loginFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Query'],
        resources: [props.usersTableArn, `${props.usersTableArn}/index/*`],
      })
    );

    this.registerFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:SignUp', 'cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminConfirmSignUp'],
        resources: [props.userPoolArn],
      })
    );

    this.loginFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['cognito-idp:InitiateAuth', 'cognito-idp:AdminInitiateAuth'],
        resources: [props.userPoolArn],
      })
    );

    this.createEventFunction = new NodejsFunction(this, 'CreateEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/createEvent.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.getEventFunction = new NodejsFunction(this, 'GetEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/getEvent.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.updateEventFunction = new NodejsFunction(this, 'UpdateEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/updateEvent.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.listEventsFunction = new NodejsFunction(this, 'ListEventsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/listEvents.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.deleteEventFunction = new NodejsFunction(this, 'DeleteEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/deleteEvent.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.generatePresignedUrlFunction = new NodejsFunction(this, 'GeneratePresignedUrlFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/uploads/generatePresignedUrl.ts'),
      environment: {
        COVER_PHOTO_BUCKET: props.coverPhotoBucket,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.registerForEventFunction = new NodejsFunction(this, 'RegisterForEventFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/registrations/registerForEvent.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
        REGISTRATIONS_TABLE_NAME: props.registrationsTableName,
        USERS_TABLE_NAME: props.usersTableName,
        SENDER_EMAIL: props.verifiedSenderEmail,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.getUserRegistrationsFunction = new NodejsFunction(this, 'GetUserRegistrationsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/registrations/getUserRegistrations.ts'),
      environment: {
        REGISTRATIONS_TABLE_NAME: props.registrationsTableName,
        EVENTS_TABLE_NAME: props.eventsTableName,
        USERS_TABLE_NAME: props.usersTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.getRegistrationFunction = new NodejsFunction(this, 'GetRegistrationFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/registrations/getRegistration.ts'),
      environment: {
        REGISTRATIONS_TABLE_NAME: props.registrationsTableName,
        EVENTS_TABLE_NAME: props.eventsTableName,
        USERS_TABLE_NAME: props.usersTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.getOrganizerEventsFunction = new NodejsFunction(this, 'GetOrganizerEventsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/getOrganizerEvents.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.getEventAttendeesFunction = new NodejsFunction(this, 'GetEventAttendeesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/getEventAttendees.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
        REGISTRATIONS_TABLE_NAME: props.registrationsTableName,
        USERS_TABLE_NAME: props.usersTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.exportEventAttendeesFunction = new NodejsFunction(this, 'ExportEventAttendeesFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/events/exportEventAttendees.ts'),
      environment: {
        EVENTS_TABLE_NAME: props.eventsTableName,
        REGISTRATIONS_TABLE_NAME: props.registrationsTableName,
        USERS_TABLE_NAME: props.usersTableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    const eventsTablePermissions = new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan'],
      resources: [props.eventsTableArn, `${props.eventsTableArn}/index/*`],
    });

    this.createEventFunction.addToRolePolicy(eventsTablePermissions);
    this.getEventFunction.addToRolePolicy(eventsTablePermissions);
    this.updateEventFunction.addToRolePolicy(eventsTablePermissions);
    this.listEventsFunction.addToRolePolicy(eventsTablePermissions);
    this.deleteEventFunction.addToRolePolicy(eventsTablePermissions);

    this.generatePresignedUrlFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [`arn:aws:s3:::${props.coverPhotoBucket}/*`],
      })
    );

    this.registerForEventFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [props.eventsTableArn, props.registrationsTableArn, props.usersTableArn],
      })
    );

    this.registerForEventFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'ses:FromAddress': props.verifiedSenderEmail,
          },
        },
      })
    );

    this.getUserRegistrationsFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [
          props.registrationsTableArn,
          `${props.registrationsTableArn}/index/*`,
          props.eventsTableArn,
          props.usersTableArn,
        ],
      })
    );

    this.getRegistrationFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:GetItem'],
        resources: [props.registrationsTableArn, props.eventsTableArn, props.usersTableArn],
      })
    );

    this.getOrganizerEventsFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [props.eventsTableArn, `${props.eventsTableArn}/index/*`],
      })
    );

    this.getEventAttendeesFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [
          props.eventsTableArn,
          props.registrationsTableArn,
          `${props.registrationsTableArn}/index/*`,
          props.usersTableArn,
        ],
      })
    );

    this.exportEventAttendeesFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [
          props.eventsTableArn,
          props.registrationsTableArn,
          `${props.registrationsTableArn}/index/*`,
          props.usersTableArn,
        ],
      })
    );

    const authResource = this.api.root.addResource('auth');
    const eventsResource = this.api.root.addResource('events');
    const registrationsResource = this.api.root.addResource('registrations');
    const uploadsResource = this.api.root.addResource('uploads');

    const registerResource = authResource.addResource('register');
    registerResource.addMethod('POST', new apigateway.LambdaIntegration(this.registerFunction));

    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', new apigateway.LambdaIntegration(this.loginFunction));

    const userPool = cognito.UserPool.fromUserPoolArn(this, 'ImportedUserPool', props.userPoolArn);

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'EventTicketingAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    eventsResource.addMethod('POST', new apigateway.LambdaIntegration(this.createEventFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    eventsResource.addMethod('GET', new apigateway.LambdaIntegration(this.listEventsFunction));

    const eventIdResource = eventsResource.addResource('{eventId}');
    eventIdResource.addMethod('GET', new apigateway.LambdaIntegration(this.getEventFunction));
    
    eventIdResource.addMethod('PUT', new apigateway.LambdaIntegration(this.updateEventFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    eventIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.deleteEventFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const eventRegisterResource = eventIdResource.addResource('register');
    eventRegisterResource.addMethod('POST', new apigateway.LambdaIntegration(this.registerForEventFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const presignedUrlResource = uploadsResource.addResource('presigned-url');
    presignedUrlResource.addMethod('POST', new apigateway.LambdaIntegration(this.generatePresignedUrlFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const meRegistrationsResource = registrationsResource.addResource('me');
    meRegistrationsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getUserRegistrationsFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const registrationIdResource = registrationsResource.addResource('{registrationId}');
    registrationIdResource.addMethod('GET', new apigateway.LambdaIntegration(this.getRegistrationFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const myEventsResource = eventsResource.addResource('my-events');
    myEventsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getOrganizerEventsFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const attendeesResource = eventIdResource.addResource('attendees');
    attendeesResource.addMethod('GET', new apigateway.LambdaIntegration(this.getEventAttendeesFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const exportAttendeesResource = attendeesResource.addResource('export');
    exportAttendeesResource.addMethod('GET', new apigateway.LambdaIntegration(this.exportEventAttendeesFunction), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
    });

    new cdk.CfnOutput(this, 'ApiStage', {
      value: this.api.deploymentStage.stageName,
      description: 'API Gateway Stage',
    });
  }
}
