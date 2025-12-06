import * as fc from 'fast-check';
import { handler as loginHandler } from '../lib/lambdas/auth/login';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Mock AWS clients
const cognitoMock = mockClient(CognitoIdentityProviderClient);
const dynamoMock = mockClient(DynamoDBDocumentClient);

// Arbitraries for generating test data
const arbitraryEmail = () => fc.emailAddress();
const arbitraryPassword = () => fc.string({ minLength: 8, maxLength: 20 });

const arbitraryLoginCredentials = () =>
  fc.record({
    email: arbitraryEmail(),
    password: arbitraryPassword(),
  });

// Helper to create mock API Gateway event
function createMockEvent(body: any): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/auth/login',
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
      path: '/auth/login',
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
      resourceId: 'test-resource',
      resourcePath: '/auth/login',
    },
    resource: '/auth/login',
  };
}

describe('User Authentication Property Tests', () => {
  beforeEach(() => {
    cognitoMock.reset();
    dynamoMock.reset();
    
    // Set required environment variables
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.USERS_TABLE_NAME = 'test-users-table';
  });

  /**
   * Feature: event-ticketing-system, Property 3: Valid credentials grant access
   * Validates: Requirements 1.3
   * 
   * For any registered user with correct credentials,
   * submitting login credentials should authenticate successfully and grant platform access.
   */
  test('Property 3: Valid credentials grant access', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryLoginCredentials(), async (credentials) => {
        // Mock: Cognito authentication succeeds
        cognitoMock.on(InitiateAuthCommand).resolves({
          AuthenticationResult: {
            AccessToken: 'mock-access-token-' + Math.random(),
            IdToken: 'mock-id-token-' + Math.random(),
            RefreshToken: 'mock-refresh-token-' + Math.random(),
            ExpiresIn: 3600,
            TokenType: 'Bearer',
          },
        });

        // Mock: User exists in DynamoDB
        const userId = 'test-user-id-' + Math.random();
        dynamoMock.on(QueryCommand).resolves({
          Items: [{
            PK: `USER#${userId}`,
            SK: 'PROFILE',
            userId,
            email: credentials.email,
            name: 'Test User',
            cognitoId: 'test-cognito-id',
          }],
          Count: 1,
        });

        const event = createMockEvent(credentials);
        const result = await loginHandler(event);

        // Verify successful authentication
        expect(result.statusCode).toBe(200);
        
        const body = JSON.parse(result.body);
        
        // Verify access is granted (tokens are returned)
        expect(body.accessToken).toBeDefined();
        expect(body.idToken).toBeDefined();
        expect(body.refreshToken).toBeDefined();
        expect(body.expiresIn).toBe(3600);
        expect(body.tokenType).toBe('Bearer');
        
        // Verify user information is returned
        expect(body.user).toBeDefined();
        expect(body.user.email).toBe(credentials.email);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: event-ticketing-system, Property 5: Authentication token issuance
   * Validates: Requirements 1.5
   * 
   * For any successful login, the system should issue a valid authentication token
   * that can be used for subsequent authenticated requests.
   */
  test('Property 5: Authentication token issuance', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryLoginCredentials(), async (credentials) => {
        // Mock: Cognito authentication succeeds
        const mockAccessToken = 'mock-access-token-' + Math.random();
        const mockIdToken = 'mock-id-token-' + Math.random();
        const mockRefreshToken = 'mock-refresh-token-' + Math.random();
        
        cognitoMock.on(InitiateAuthCommand).resolves({
          AuthenticationResult: {
            AccessToken: mockAccessToken,
            IdToken: mockIdToken,
            RefreshToken: mockRefreshToken,
            ExpiresIn: 3600,
            TokenType: 'Bearer',
          },
        });

        // Mock: User exists in DynamoDB
        const userId = 'test-user-id-' + Math.random();
        dynamoMock.on(QueryCommand).resolves({
          Items: [{
            PK: `USER#${userId}`,
            SK: 'PROFILE',
            userId,
            email: credentials.email,
            name: 'Test User',
            cognitoId: 'test-cognito-id',
          }],
          Count: 1,
        });

        const event = createMockEvent(credentials);
        const result = await loginHandler(event);

        // Verify successful login
        expect(result.statusCode).toBe(200);
        
        const body = JSON.parse(result.body);
        
        // Verify authentication tokens are issued
        expect(body.accessToken).toBe(mockAccessToken);
        expect(body.idToken).toBe(mockIdToken);
        expect(body.refreshToken).toBe(mockRefreshToken);
        
        // Verify tokens are non-empty strings
        expect(typeof body.accessToken).toBe('string');
        expect(body.accessToken.length).toBeGreaterThan(0);
        expect(typeof body.idToken).toBe('string');
        expect(body.idToken.length).toBeGreaterThan(0);
        expect(typeof body.refreshToken).toBe('string');
        expect(body.refreshToken.length).toBeGreaterThan(0);
        
        // Verify token expiration is set
        expect(body.expiresIn).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Invalid credentials should be rejected
   * This ensures the authentication system properly validates credentials
   */
  test('Invalid credentials are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryLoginCredentials(), async (credentials) => {
        // Mock: Cognito authentication fails
        cognitoMock.on(InitiateAuthCommand).rejects({
          name: 'NotAuthorizedException',
          message: 'Incorrect username or password',
        });

        const event = createMockEvent(credentials);
        const result = await loginHandler(event);

        // Verify authentication failure
        expect(result.statusCode).toBe(401);
        
        const body = JSON.parse(result.body);
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe('INVALID_CREDENTIALS');
      }),
      { numRuns: 100 }
    );
  });
});
