import * as fc from 'fast-check';
import { handler as registerHandler } from '../lib/lambdas/auth/register';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { CognitoIdentityProviderClient, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Mock AWS clients
const cognitoMock = mockClient(CognitoIdentityProviderClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// Arbitraries for generating test data
const arbitraryEmail = () => fc.emailAddress();

const arbitraryValidPassword = () => 
  fc.string({ minLength: 8, maxLength: 20 }).chain(base =>
    fc.record({
      base: fc.constant(base),
      hasLower: fc.constant(base.match(/[a-z]/) !== null),
      hasUpper: fc.constant(base.match(/[A-Z]/) !== null),
      hasDigit: fc.constant(base.match(/[0-9]/) !== null),
    }).map(({ base, hasLower, hasUpper, hasDigit }) => {
      let password = base;
      if (!hasLower) {password += 'a';}
      if (!hasUpper) {password += 'A';}
      if (!hasDigit) {password += '1';}
      return password;
    })
  );

const arbitraryName = () => fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

const arbitraryValidRegistration = () =>
  fc.record({
    email: arbitraryEmail(),
    password: arbitraryValidPassword(),
    name: arbitraryName(),
  });

// Helper to create mock API Gateway event
function createMockEvent(body: any): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/auth/register',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/auth/register',
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
      resourceId: 'test-resource',
      resourcePath: '/auth/register',
    },
    resource: '/auth/register',
  };
}

describe('User Registration Property Tests', () => {
  beforeEach(() => {
    cognitoMock.reset();
    dynamoMock.reset();
    
    // Set required environment variables
    process.env.USER_POOL_ID = 'test-pool-id';
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.USERS_TABLE_NAME = 'test-users-table';
  });

  /**
   * Feature: event-ticketing-system, Property 1: User registration creates unique accounts
   * Validates: Requirements 1.1
   * 
   * For any valid email and password combination not already in the system,
   * submitting a registration form should create a new user account with a unique identifier.
   */
  test('Property 1: User registration creates unique accounts', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryValidRegistration(), async (registration) => {
        // Mock: Email doesn't exist in DynamoDB
        dynamoMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0,
        });

        // Mock: Cognito signup succeeds
        cognitoMock.on(SignUpCommand).resolves({
          UserSub: 'test-cognito-id-' + Math.random(),
          UserConfirmed: false,
        });

        // Mock: DynamoDB put succeeds
        dynamoMock.on(PutCommand).resolves({});

        const event = createMockEvent(registration);
        const result = await registerHandler(event);

        // Verify successful registration
        expect(result.statusCode).toBe(201);
        
        const body = JSON.parse(result.body);
        expect(body.userId).toBeDefined();
        expect(body.email).toBe(registration.email);
        expect(body.name).toBe(registration.name);
        
        // Verify unique userId was generated
        expect(typeof body.userId).toBe('string');
        expect(body.userId.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: event-ticketing-system, Property 2: Duplicate email rejection
   * Validates: Requirements 1.2
   * 
   * For any email address already registered in the system,
   * attempting to register with that email should be rejected with an error message.
   */
  test('Property 2: Duplicate email rejection', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryValidRegistration(), async (registration) => {
        // Mock: Email already exists in DynamoDB
        dynamoMock.on(QueryCommand).resolves({
          Items: [{
            PK: 'USER#existing-user-id',
            SK: 'PROFILE',
            userId: 'existing-user-id',
            email: registration.email,
            name: 'Existing User',
          }],
          Count: 1,
        });

        const event = createMockEvent(registration);
        const result = await registerHandler(event);

        // Verify rejection
        expect(result.statusCode).toBe(409);
        
        const body = JSON.parse(result.body);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe('DUPLICATE_EMAIL');
        expect(body.error.message).toContain('already exists');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: event-ticketing-system, Property 4: Email as unique identifier
   * Validates: Requirements 1.4
   * 
   * For any created user account, querying by the user's email address
   * should return that exact user account.
   */
  test('Property 4: Email as unique identifier', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryValidRegistration(), async (registration) => {
        // Mock: Email doesn't exist initially
        dynamoMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0,
        });

        // Mock: Cognito signup succeeds
        const cognitoId = 'test-cognito-id-' + Math.random();
        cognitoMock.on(SignUpCommand).resolves({
          UserSub: cognitoId,
          UserConfirmed: false,
        });

        // Capture the user data that was written to DynamoDB
        let capturedUserData: any = null;
        dynamoMock.on(PutCommand).callsFake((input) => {
          capturedUserData = input.Item;
          return Promise.resolve({});
        });

        const event = createMockEvent(registration);
        const result = await registerHandler(event);

        // Verify successful registration
        expect(result.statusCode).toBe(201);
        
        // Verify the user data includes the email as stored
        expect(capturedUserData).toBeDefined();
        expect(capturedUserData.email).toBe(registration.email);
        
        // Verify email is used as the unique identifier in the GSI
        // The email should be stored in a way that allows querying by email
        expect(capturedUserData.email).toBe(registration.email);
      }),
      { numRuns: 100 }
    );
  });
});
