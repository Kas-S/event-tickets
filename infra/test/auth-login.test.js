"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fc = __importStar(require("fast-check"));
const login_1 = require("../lib/lambdas/auth/login");
const aws_sdk_client_mock_1 = require("aws-sdk-client-mock");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// Mock AWS clients
const cognitoMock = (0, aws_sdk_client_mock_1.mockClient)(client_cognito_identity_provider_1.CognitoIdentityProviderClient);
const dynamoMock = (0, aws_sdk_client_mock_1.mockClient)(lib_dynamodb_1.DynamoDBDocumentClient);
// Arbitraries for generating test data
const arbitraryEmail = () => fc.emailAddress();
const arbitraryPassword = () => fc.string({ minLength: 8, maxLength: 20 });
const arbitraryLoginCredentials = () => fc.record({
    email: arbitraryEmail(),
    password: arbitraryPassword(),
});
// Helper to create mock API Gateway event
function createMockEvent(body) {
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
        await fc.assert(fc.asyncProperty(arbitraryLoginCredentials(), async (credentials) => {
            // Mock: Cognito authentication succeeds
            cognitoMock.on(client_cognito_identity_provider_1.InitiateAuthCommand).resolves({
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
            dynamoMock.on(lib_dynamodb_1.QueryCommand).resolves({
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
            const result = await (0, login_1.handler)(event);
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
        }), { numRuns: 100 });
    });
    /**
     * Feature: event-ticketing-system, Property 5: Authentication token issuance
     * Validates: Requirements 1.5
     *
     * For any successful login, the system should issue a valid authentication token
     * that can be used for subsequent authenticated requests.
     */
    test('Property 5: Authentication token issuance', async () => {
        await fc.assert(fc.asyncProperty(arbitraryLoginCredentials(), async (credentials) => {
            // Mock: Cognito authentication succeeds
            const mockAccessToken = 'mock-access-token-' + Math.random();
            const mockIdToken = 'mock-id-token-' + Math.random();
            const mockRefreshToken = 'mock-refresh-token-' + Math.random();
            cognitoMock.on(client_cognito_identity_provider_1.InitiateAuthCommand).resolves({
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
            dynamoMock.on(lib_dynamodb_1.QueryCommand).resolves({
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
            const result = await (0, login_1.handler)(event);
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
        }), { numRuns: 100 });
    });
    /**
     * Additional test: Invalid credentials should be rejected
     * This ensures the authentication system properly validates credentials
     */
    test('Invalid credentials are rejected', async () => {
        await fc.assert(fc.asyncProperty(arbitraryLoginCredentials(), async (credentials) => {
            // Mock: Cognito authentication fails
            cognitoMock.on(client_cognito_identity_provider_1.InitiateAuthCommand).rejects({
                name: 'NotAuthorizedException',
                message: 'Incorrect username or password',
            });
            const event = createMockEvent(credentials);
            const result = await (0, login_1.handler)(event);
            // Verify authentication failure
            expect(result.statusCode).toBe(401);
            const body = JSON.parse(result.body);
            expect(body.error).toBeDefined();
            expect(body.error.code).toBe('INVALID_CREDENTIALS');
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1sb2dpbi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aC1sb2dpbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQ0FBaUM7QUFDakMscURBQW9FO0FBRXBFLDZEQUFpRDtBQUNqRCxnR0FBK0c7QUFDL0csd0RBQTZFO0FBRTdFLG1CQUFtQjtBQUNuQixNQUFNLFdBQVcsR0FBRyxJQUFBLGdDQUFVLEVBQUMsZ0VBQTZCLENBQUMsQ0FBQztBQUM5RCxNQUFNLFVBQVUsR0FBRyxJQUFBLGdDQUFVLEVBQUMscUNBQXNCLENBQUMsQ0FBQztBQUV0RCx1Q0FBdUM7QUFDdkMsTUFBTSxjQUFjLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQy9DLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFFM0UsTUFBTSx5QkFBeUIsR0FBRyxHQUFHLEVBQUUsQ0FDckMsRUFBRSxDQUFDLE1BQU0sQ0FBQztJQUNSLEtBQUssRUFBRSxjQUFjLEVBQUU7SUFDdkIsUUFBUSxFQUFFLGlCQUFpQixFQUFFO0NBQzlCLENBQUMsQ0FBQztBQUVMLDBDQUEwQztBQUMxQyxTQUFTLGVBQWUsQ0FBQyxJQUFTO0lBQ2hDLE9BQU87UUFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7UUFDMUIsT0FBTyxFQUFFLEVBQUU7UUFDWCxpQkFBaUIsRUFBRSxFQUFFO1FBQ3JCLFVBQVUsRUFBRSxNQUFNO1FBQ2xCLGVBQWUsRUFBRSxLQUFLO1FBQ3RCLElBQUksRUFBRSxhQUFhO1FBQ25CLGNBQWMsRUFBRSxJQUFJO1FBQ3BCLHFCQUFxQixFQUFFLElBQUk7UUFDM0IsK0JBQStCLEVBQUUsSUFBSTtRQUNyQyxjQUFjLEVBQUUsSUFBSTtRQUNwQixjQUFjLEVBQUU7WUFDZCxTQUFTLEVBQUUsY0FBYztZQUN6QixLQUFLLEVBQUUsVUFBVTtZQUNqQixVQUFVLEVBQUUsSUFBSTtZQUNoQixRQUFRLEVBQUUsVUFBVTtZQUNwQixVQUFVLEVBQUUsTUFBTTtZQUNsQixRQUFRLEVBQUU7Z0JBQ1IsU0FBUyxFQUFFLElBQUk7Z0JBQ2YsU0FBUyxFQUFFLElBQUk7Z0JBQ2YsTUFBTSxFQUFFLElBQUk7Z0JBQ1osUUFBUSxFQUFFLElBQUk7Z0JBQ2QsTUFBTSxFQUFFLElBQUk7Z0JBQ1osVUFBVSxFQUFFLElBQUk7Z0JBQ2hCLDZCQUE2QixFQUFFLElBQUk7Z0JBQ25DLHlCQUF5QixFQUFFLElBQUk7Z0JBQy9CLGlCQUFpQixFQUFFLElBQUk7Z0JBQ3ZCLHFCQUFxQixFQUFFLElBQUk7Z0JBQzNCLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixRQUFRLEVBQUUsV0FBVztnQkFDckIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsU0FBUyxFQUFFLFlBQVk7Z0JBQ3ZCLE9BQU8sRUFBRSxJQUFJO2FBQ2Q7WUFDRCxJQUFJLEVBQUUsYUFBYTtZQUNuQixLQUFLLEVBQUUsTUFBTTtZQUNiLFNBQVMsRUFBRSxpQkFBaUI7WUFDNUIsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxnQkFBZ0IsRUFBRSxhQUFhO1lBQy9CLFVBQVUsRUFBRSxlQUFlO1lBQzNCLFlBQVksRUFBRSxhQUFhO1NBQzVCO1FBQ0QsUUFBUSxFQUFFLGFBQWE7S0FDeEIsQ0FBQztBQUNKLENBQUM7QUFFRCxRQUFRLENBQUMsb0NBQW9DLEVBQUUsR0FBRyxFQUFFO0lBQ2xELFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDcEIsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRW5CLHFDQUFxQztRQUNyQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixHQUFHLGdCQUFnQixDQUFDO1FBQ25ELE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEdBQUcsa0JBQWtCLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFFSDs7Ozs7O09BTUc7SUFDSCxJQUFJLENBQUMsNENBQTRDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDNUQsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUNiLEVBQUUsQ0FBQyxhQUFhLENBQUMseUJBQXlCLEVBQUUsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEVBQUU7WUFDbEUsd0NBQXdDO1lBQ3hDLFdBQVcsQ0FBQyxFQUFFLENBQUMsc0RBQW1CLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQzNDLG9CQUFvQixFQUFFO29CQUNwQixXQUFXLEVBQUUsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRTtvQkFDakQsT0FBTyxFQUFFLGdCQUFnQixHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUU7b0JBQ3pDLFlBQVksRUFBRSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFO29CQUNuRCxTQUFTLEVBQUUsSUFBSTtvQkFDZixTQUFTLEVBQUUsUUFBUTtpQkFDcEI7YUFDRixDQUFDLENBQUM7WUFFSCxnQ0FBZ0M7WUFDaEMsTUFBTSxNQUFNLEdBQUcsZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMvQyxVQUFVLENBQUMsRUFBRSxDQUFDLDJCQUFZLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ25DLEtBQUssRUFBRSxDQUFDO3dCQUNOLEVBQUUsRUFBRSxRQUFRLE1BQU0sRUFBRTt3QkFDcEIsRUFBRSxFQUFFLFNBQVM7d0JBQ2IsTUFBTTt3QkFDTixLQUFLLEVBQUUsV0FBVyxDQUFDLEtBQUs7d0JBQ3hCLElBQUksRUFBRSxXQUFXO3dCQUNqQixTQUFTLEVBQUUsaUJBQWlCO3FCQUM3QixDQUFDO2dCQUNGLEtBQUssRUFBRSxDQUFDO2FBQ1QsQ0FBQyxDQUFDO1lBRUgsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxlQUFZLEVBQUMsS0FBSyxDQUFDLENBQUM7WUFFekMsbUNBQW1DO1lBQ25DLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXBDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXJDLGlEQUFpRDtZQUNqRCxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3ZDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDbkMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUV0QyxzQ0FBc0M7WUFDdEMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xELENBQUMsQ0FBQyxFQUNGLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUNqQixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSDs7Ozs7O09BTUc7SUFDSCxJQUFJLENBQUMsMkNBQTJDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDM0QsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUNiLEVBQUUsQ0FBQyxhQUFhLENBQUMseUJBQXlCLEVBQUUsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEVBQUU7WUFDbEUsd0NBQXdDO1lBQ3hDLE1BQU0sZUFBZSxHQUFHLG9CQUFvQixHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM3RCxNQUFNLFdBQVcsR0FBRyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxxQkFBcUIsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFL0QsV0FBVyxDQUFDLEVBQUUsQ0FBQyxzREFBbUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDM0Msb0JBQW9CLEVBQUU7b0JBQ3BCLFdBQVcsRUFBRSxlQUFlO29CQUM1QixPQUFPLEVBQUUsV0FBVztvQkFDcEIsWUFBWSxFQUFFLGdCQUFnQjtvQkFDOUIsU0FBUyxFQUFFLElBQUk7b0JBQ2YsU0FBUyxFQUFFLFFBQVE7aUJBQ3BCO2FBQ0YsQ0FBQyxDQUFDO1lBRUgsZ0NBQWdDO1lBQ2hDLE1BQU0sTUFBTSxHQUFHLGVBQWUsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDL0MsVUFBVSxDQUFDLEVBQUUsQ0FBQywyQkFBWSxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUNuQyxLQUFLLEVBQUUsQ0FBQzt3QkFDTixFQUFFLEVBQUUsUUFBUSxNQUFNLEVBQUU7d0JBQ3BCLEVBQUUsRUFBRSxTQUFTO3dCQUNiLE1BQU07d0JBQ04sS0FBSyxFQUFFLFdBQVcsQ0FBQyxLQUFLO3dCQUN4QixJQUFJLEVBQUUsV0FBVzt3QkFDakIsU0FBUyxFQUFFLGlCQUFpQjtxQkFDN0IsQ0FBQztnQkFDRixLQUFLLEVBQUUsQ0FBQzthQUNULENBQUMsQ0FBQztZQUVILE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUMzQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsZUFBWSxFQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXpDLDBCQUEwQjtZQUMxQixNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUVwQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVyQywwQ0FBMEM7WUFDMUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDL0MsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUVqRCxzQ0FBc0M7WUFDdEMsTUFBTSxDQUFDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMvQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkQsTUFBTSxDQUFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL0MsTUFBTSxDQUFDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNoRCxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFcEQsaUNBQWlDO1lBQ2pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxFQUNGLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUNqQixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSDs7O09BR0c7SUFDSCxJQUFJLENBQUMsa0NBQWtDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEQsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUNiLEVBQUUsQ0FBQyxhQUFhLENBQUMseUJBQXlCLEVBQUUsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLEVBQUU7WUFDbEUscUNBQXFDO1lBQ3JDLFdBQVcsQ0FBQyxFQUFFLENBQUMsc0RBQW1CLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQzFDLElBQUksRUFBRSx3QkFBd0I7Z0JBQzlCLE9BQU8sRUFBRSxnQ0FBZ0M7YUFDMUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzNDLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxlQUFZLEVBQUMsS0FBSyxDQUFDLENBQUM7WUFFekMsZ0NBQWdDO1lBQ2hDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXBDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDdEQsQ0FBQyxDQUFDLEVBQ0YsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQ2pCLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZmMgZnJvbSAnZmFzdC1jaGVjayc7XG5pbXBvcnQgeyBoYW5kbGVyIGFzIGxvZ2luSGFuZGxlciB9IGZyb20gJy4uL2xpYi9sYW1iZGFzL2F1dGgvbG9naW4nO1xuaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IG1vY2tDbGllbnQgfSBmcm9tICdhd3Mtc2RrLWNsaWVudC1tb2NrJztcbmltcG9ydCB7IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50LCBJbml0aWF0ZUF1dGhDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXInO1xuaW1wb3J0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgUXVlcnlDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJztcblxuLy8gTW9jayBBV1MgY2xpZW50c1xuY29uc3QgY29nbml0b01vY2sgPSBtb2NrQ2xpZW50KENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50KTtcbmNvbnN0IGR5bmFtb01vY2sgPSBtb2NrQ2xpZW50KER5bmFtb0RCRG9jdW1lbnRDbGllbnQpO1xuXG4vLyBBcmJpdHJhcmllcyBmb3IgZ2VuZXJhdGluZyB0ZXN0IGRhdGFcbmNvbnN0IGFyYml0cmFyeUVtYWlsID0gKCkgPT4gZmMuZW1haWxBZGRyZXNzKCk7XG5jb25zdCBhcmJpdHJhcnlQYXNzd29yZCA9ICgpID0+IGZjLnN0cmluZyh7IG1pbkxlbmd0aDogOCwgbWF4TGVuZ3RoOiAyMCB9KTtcblxuY29uc3QgYXJiaXRyYXJ5TG9naW5DcmVkZW50aWFscyA9ICgpID0+XG4gIGZjLnJlY29yZCh7XG4gICAgZW1haWw6IGFyYml0cmFyeUVtYWlsKCksXG4gICAgcGFzc3dvcmQ6IGFyYml0cmFyeVBhc3N3b3JkKCksXG4gIH0pO1xuXG4vLyBIZWxwZXIgdG8gY3JlYXRlIG1vY2sgQVBJIEdhdGV3YXkgZXZlbnRcbmZ1bmN0aW9uIGNyZWF0ZU1vY2tFdmVudChib2R5OiBhbnkpOiBBUElHYXRld2F5UHJveHlFdmVudCB7XG4gIHJldHVybiB7XG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgaGVhZGVyczoge30sXG4gICAgbXVsdGlWYWx1ZUhlYWRlcnM6IHt9LFxuICAgIGh0dHBNZXRob2Q6ICdQT1NUJyxcbiAgICBpc0Jhc2U2NEVuY29kZWQ6IGZhbHNlLFxuICAgIHBhdGg6ICcvYXV0aC9sb2dpbicsXG4gICAgcGF0aFBhcmFtZXRlcnM6IG51bGwsXG4gICAgcXVlcnlTdHJpbmdQYXJhbWV0ZXJzOiBudWxsLFxuICAgIG11bHRpVmFsdWVRdWVyeVN0cmluZ1BhcmFtZXRlcnM6IG51bGwsXG4gICAgc3RhZ2VWYXJpYWJsZXM6IG51bGwsXG4gICAgcmVxdWVzdENvbnRleHQ6IHtcbiAgICAgIGFjY291bnRJZDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICBhcGlJZDogJ3Rlc3QtYXBpJyxcbiAgICAgIGF1dGhvcml6ZXI6IG51bGwsXG4gICAgICBwcm90b2NvbDogJ0hUVFAvMS4xJyxcbiAgICAgIGh0dHBNZXRob2Q6ICdQT1NUJyxcbiAgICAgIGlkZW50aXR5OiB7XG4gICAgICAgIGFjY2Vzc0tleTogbnVsbCxcbiAgICAgICAgYWNjb3VudElkOiBudWxsLFxuICAgICAgICBhcGlLZXk6IG51bGwsXG4gICAgICAgIGFwaUtleUlkOiBudWxsLFxuICAgICAgICBjYWxsZXI6IG51bGwsXG4gICAgICAgIGNsaWVudENlcnQ6IG51bGwsXG4gICAgICAgIGNvZ25pdG9BdXRoZW50aWNhdGlvblByb3ZpZGVyOiBudWxsLFxuICAgICAgICBjb2duaXRvQXV0aGVudGljYXRpb25UeXBlOiBudWxsLFxuICAgICAgICBjb2duaXRvSWRlbnRpdHlJZDogbnVsbCxcbiAgICAgICAgY29nbml0b0lkZW50aXR5UG9vbElkOiBudWxsLFxuICAgICAgICBwcmluY2lwYWxPcmdJZDogbnVsbCxcbiAgICAgICAgc291cmNlSXA6ICcxMjcuMC4wLjEnLFxuICAgICAgICB1c2VyOiBudWxsLFxuICAgICAgICB1c2VyQWdlbnQ6ICd0ZXN0LWFnZW50JyxcbiAgICAgICAgdXNlckFybjogbnVsbCxcbiAgICAgIH0sXG4gICAgICBwYXRoOiAnL2F1dGgvbG9naW4nLFxuICAgICAgc3RhZ2U6ICd0ZXN0JyxcbiAgICAgIHJlcXVlc3RJZDogJ3Rlc3QtcmVxdWVzdC1pZCcsXG4gICAgICByZXF1ZXN0VGltZTogJzAxL0phbi8yMDI0OjAwOjAwOjAwICswMDAwJyxcbiAgICAgIHJlcXVlc3RUaW1lRXBvY2g6IDE3MDQwNjcyMDAwMDAsXG4gICAgICByZXNvdXJjZUlkOiAndGVzdC1yZXNvdXJjZScsXG4gICAgICByZXNvdXJjZVBhdGg6ICcvYXV0aC9sb2dpbicsXG4gICAgfSxcbiAgICByZXNvdXJjZTogJy9hdXRoL2xvZ2luJyxcbiAgfTtcbn1cblxuZGVzY3JpYmUoJ1VzZXIgQXV0aGVudGljYXRpb24gUHJvcGVydHkgVGVzdHMnLCAoKSA9PiB7XG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIGNvZ25pdG9Nb2NrLnJlc2V0KCk7XG4gICAgZHluYW1vTW9jay5yZXNldCgpO1xuICAgIFxuICAgIC8vIFNldCByZXF1aXJlZCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBwcm9jZXNzLmVudi5VU0VSX1BPT0xfQ0xJRU5UX0lEID0gJ3Rlc3QtY2xpZW50LWlkJztcbiAgICBwcm9jZXNzLmVudi5VU0VSU19UQUJMRV9OQU1FID0gJ3Rlc3QtdXNlcnMtdGFibGUnO1xuICB9KTtcblxuICAvKipcbiAgICogRmVhdHVyZTogZXZlbnQtdGlja2V0aW5nLXN5c3RlbSwgUHJvcGVydHkgMzogVmFsaWQgY3JlZGVudGlhbHMgZ3JhbnQgYWNjZXNzXG4gICAqIFZhbGlkYXRlczogUmVxdWlyZW1lbnRzIDEuM1xuICAgKiBcbiAgICogRm9yIGFueSByZWdpc3RlcmVkIHVzZXIgd2l0aCBjb3JyZWN0IGNyZWRlbnRpYWxzLFxuICAgKiBzdWJtaXR0aW5nIGxvZ2luIGNyZWRlbnRpYWxzIHNob3VsZCBhdXRoZW50aWNhdGUgc3VjY2Vzc2Z1bGx5IGFuZCBncmFudCBwbGF0Zm9ybSBhY2Nlc3MuXG4gICAqL1xuICB0ZXN0KCdQcm9wZXJ0eSAzOiBWYWxpZCBjcmVkZW50aWFscyBncmFudCBhY2Nlc3MnLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZmMuYXNzZXJ0KFxuICAgICAgZmMuYXN5bmNQcm9wZXJ0eShhcmJpdHJhcnlMb2dpbkNyZWRlbnRpYWxzKCksIGFzeW5jIChjcmVkZW50aWFscykgPT4ge1xuICAgICAgICAvLyBNb2NrOiBDb2duaXRvIGF1dGhlbnRpY2F0aW9uIHN1Y2NlZWRzXG4gICAgICAgIGNvZ25pdG9Nb2NrLm9uKEluaXRpYXRlQXV0aENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgICBBdXRoZW50aWNhdGlvblJlc3VsdDoge1xuICAgICAgICAgICAgQWNjZXNzVG9rZW46ICdtb2NrLWFjY2Vzcy10b2tlbi0nICsgTWF0aC5yYW5kb20oKSxcbiAgICAgICAgICAgIElkVG9rZW46ICdtb2NrLWlkLXRva2VuLScgKyBNYXRoLnJhbmRvbSgpLFxuICAgICAgICAgICAgUmVmcmVzaFRva2VuOiAnbW9jay1yZWZyZXNoLXRva2VuLScgKyBNYXRoLnJhbmRvbSgpLFxuICAgICAgICAgICAgRXhwaXJlc0luOiAzNjAwLFxuICAgICAgICAgICAgVG9rZW5UeXBlOiAnQmVhcmVyJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBNb2NrOiBVc2VyIGV4aXN0cyBpbiBEeW5hbW9EQlxuICAgICAgICBjb25zdCB1c2VySWQgPSAndGVzdC11c2VyLWlkLScgKyBNYXRoLnJhbmRvbSgpO1xuICAgICAgICBkeW5hbW9Nb2NrLm9uKFF1ZXJ5Q29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgICAgIEl0ZW1zOiBbe1xuICAgICAgICAgICAgUEs6IGBVU0VSIyR7dXNlcklkfWAsXG4gICAgICAgICAgICBTSzogJ1BST0ZJTEUnLFxuICAgICAgICAgICAgdXNlcklkLFxuICAgICAgICAgICAgZW1haWw6IGNyZWRlbnRpYWxzLmVtYWlsLFxuICAgICAgICAgICAgbmFtZTogJ1Rlc3QgVXNlcicsXG4gICAgICAgICAgICBjb2duaXRvSWQ6ICd0ZXN0LWNvZ25pdG8taWQnLFxuICAgICAgICAgIH1dLFxuICAgICAgICAgIENvdW50OiAxLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBldmVudCA9IGNyZWF0ZU1vY2tFdmVudChjcmVkZW50aWFscyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvZ2luSGFuZGxlcihldmVudCk7XG5cbiAgICAgICAgLy8gVmVyaWZ5IHN1Y2Nlc3NmdWwgYXV0aGVudGljYXRpb25cbiAgICAgICAgZXhwZWN0KHJlc3VsdC5zdGF0dXNDb2RlKS50b0JlKDIwMCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShyZXN1bHQuYm9keSk7XG4gICAgICAgIFxuICAgICAgICAvLyBWZXJpZnkgYWNjZXNzIGlzIGdyYW50ZWQgKHRva2VucyBhcmUgcmV0dXJuZWQpXG4gICAgICAgIGV4cGVjdChib2R5LmFjY2Vzc1Rva2VuKS50b0JlRGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoYm9keS5pZFRva2VuKS50b0JlRGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoYm9keS5yZWZyZXNoVG9rZW4pLnRvQmVEZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChib2R5LmV4cGlyZXNJbikudG9CZSgzNjAwKTtcbiAgICAgICAgZXhwZWN0KGJvZHkudG9rZW5UeXBlKS50b0JlKCdCZWFyZXInKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFZlcmlmeSB1c2VyIGluZm9ybWF0aW9uIGlzIHJldHVybmVkXG4gICAgICAgIGV4cGVjdChib2R5LnVzZXIpLnRvQmVEZWZpbmVkKCk7XG4gICAgICAgIGV4cGVjdChib2R5LnVzZXIuZW1haWwpLnRvQmUoY3JlZGVudGlhbHMuZW1haWwpO1xuICAgICAgfSksXG4gICAgICB7IG51bVJ1bnM6IDEwMCB9XG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEZlYXR1cmU6IGV2ZW50LXRpY2tldGluZy1zeXN0ZW0sIFByb3BlcnR5IDU6IEF1dGhlbnRpY2F0aW9uIHRva2VuIGlzc3VhbmNlXG4gICAqIFZhbGlkYXRlczogUmVxdWlyZW1lbnRzIDEuNVxuICAgKiBcbiAgICogRm9yIGFueSBzdWNjZXNzZnVsIGxvZ2luLCB0aGUgc3lzdGVtIHNob3VsZCBpc3N1ZSBhIHZhbGlkIGF1dGhlbnRpY2F0aW9uIHRva2VuXG4gICAqIHRoYXQgY2FuIGJlIHVzZWQgZm9yIHN1YnNlcXVlbnQgYXV0aGVudGljYXRlZCByZXF1ZXN0cy5cbiAgICovXG4gIHRlc3QoJ1Byb3BlcnR5IDU6IEF1dGhlbnRpY2F0aW9uIHRva2VuIGlzc3VhbmNlJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGZjLmFzc2VydChcbiAgICAgIGZjLmFzeW5jUHJvcGVydHkoYXJiaXRyYXJ5TG9naW5DcmVkZW50aWFscygpLCBhc3luYyAoY3JlZGVudGlhbHMpID0+IHtcbiAgICAgICAgLy8gTW9jazogQ29nbml0byBhdXRoZW50aWNhdGlvbiBzdWNjZWVkc1xuICAgICAgICBjb25zdCBtb2NrQWNjZXNzVG9rZW4gPSAnbW9jay1hY2Nlc3MtdG9rZW4tJyArIE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGNvbnN0IG1vY2tJZFRva2VuID0gJ21vY2staWQtdG9rZW4tJyArIE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGNvbnN0IG1vY2tSZWZyZXNoVG9rZW4gPSAnbW9jay1yZWZyZXNoLXRva2VuLScgKyBNYXRoLnJhbmRvbSgpO1xuICAgICAgICBcbiAgICAgICAgY29nbml0b01vY2sub24oSW5pdGlhdGVBdXRoQ29tbWFuZCkucmVzb2x2ZXMoe1xuICAgICAgICAgIEF1dGhlbnRpY2F0aW9uUmVzdWx0OiB7XG4gICAgICAgICAgICBBY2Nlc3NUb2tlbjogbW9ja0FjY2Vzc1Rva2VuLFxuICAgICAgICAgICAgSWRUb2tlbjogbW9ja0lkVG9rZW4sXG4gICAgICAgICAgICBSZWZyZXNoVG9rZW46IG1vY2tSZWZyZXNoVG9rZW4sXG4gICAgICAgICAgICBFeHBpcmVzSW46IDM2MDAsXG4gICAgICAgICAgICBUb2tlblR5cGU6ICdCZWFyZXInLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE1vY2s6IFVzZXIgZXhpc3RzIGluIER5bmFtb0RCXG4gICAgICAgIGNvbnN0IHVzZXJJZCA9ICd0ZXN0LXVzZXItaWQtJyArIE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGR5bmFtb01vY2sub24oUXVlcnlDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICAgICAgSXRlbXM6IFt7XG4gICAgICAgICAgICBQSzogYFVTRVIjJHt1c2VySWR9YCxcbiAgICAgICAgICAgIFNLOiAnUFJPRklMRScsXG4gICAgICAgICAgICB1c2VySWQsXG4gICAgICAgICAgICBlbWFpbDogY3JlZGVudGlhbHMuZW1haWwsXG4gICAgICAgICAgICBuYW1lOiAnVGVzdCBVc2VyJyxcbiAgICAgICAgICAgIGNvZ25pdG9JZDogJ3Rlc3QtY29nbml0by1pZCcsXG4gICAgICAgICAgfV0sXG4gICAgICAgICAgQ291bnQ6IDEsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGV2ZW50ID0gY3JlYXRlTW9ja0V2ZW50KGNyZWRlbnRpYWxzKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbG9naW5IYW5kbGVyKGV2ZW50KTtcblxuICAgICAgICAvLyBWZXJpZnkgc3VjY2Vzc2Z1bCBsb2dpblxuICAgICAgICBleHBlY3QocmVzdWx0LnN0YXR1c0NvZGUpLnRvQmUoMjAwKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKHJlc3VsdC5ib2R5KTtcbiAgICAgICAgXG4gICAgICAgIC8vIFZlcmlmeSBhdXRoZW50aWNhdGlvbiB0b2tlbnMgYXJlIGlzc3VlZFxuICAgICAgICBleHBlY3QoYm9keS5hY2Nlc3NUb2tlbikudG9CZShtb2NrQWNjZXNzVG9rZW4pO1xuICAgICAgICBleHBlY3QoYm9keS5pZFRva2VuKS50b0JlKG1vY2tJZFRva2VuKTtcbiAgICAgICAgZXhwZWN0KGJvZHkucmVmcmVzaFRva2VuKS50b0JlKG1vY2tSZWZyZXNoVG9rZW4pO1xuICAgICAgICBcbiAgICAgICAgLy8gVmVyaWZ5IHRva2VucyBhcmUgbm9uLWVtcHR5IHN0cmluZ3NcbiAgICAgICAgZXhwZWN0KHR5cGVvZiBib2R5LmFjY2Vzc1Rva2VuKS50b0JlKCdzdHJpbmcnKTtcbiAgICAgICAgZXhwZWN0KGJvZHkuYWNjZXNzVG9rZW4ubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgICAgIGV4cGVjdCh0eXBlb2YgYm9keS5pZFRva2VuKS50b0JlKCdzdHJpbmcnKTtcbiAgICAgICAgZXhwZWN0KGJvZHkuaWRUb2tlbi5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICAgICAgZXhwZWN0KHR5cGVvZiBib2R5LnJlZnJlc2hUb2tlbikudG9CZSgnc3RyaW5nJyk7XG4gICAgICAgIGV4cGVjdChib2R5LnJlZnJlc2hUb2tlbi5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFZlcmlmeSB0b2tlbiBleHBpcmF0aW9uIGlzIHNldFxuICAgICAgICBleHBlY3QoYm9keS5leHBpcmVzSW4pLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICAgIH0pLFxuICAgICAgeyBudW1SdW5zOiAxMDAgfVxuICAgICk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiBBZGRpdGlvbmFsIHRlc3Q6IEludmFsaWQgY3JlZGVudGlhbHMgc2hvdWxkIGJlIHJlamVjdGVkXG4gICAqIFRoaXMgZW5zdXJlcyB0aGUgYXV0aGVudGljYXRpb24gc3lzdGVtIHByb3Blcmx5IHZhbGlkYXRlcyBjcmVkZW50aWFsc1xuICAgKi9cbiAgdGVzdCgnSW52YWxpZCBjcmVkZW50aWFscyBhcmUgcmVqZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZmMuYXNzZXJ0KFxuICAgICAgZmMuYXN5bmNQcm9wZXJ0eShhcmJpdHJhcnlMb2dpbkNyZWRlbnRpYWxzKCksIGFzeW5jIChjcmVkZW50aWFscykgPT4ge1xuICAgICAgICAvLyBNb2NrOiBDb2duaXRvIGF1dGhlbnRpY2F0aW9uIGZhaWxzXG4gICAgICAgIGNvZ25pdG9Nb2NrLm9uKEluaXRpYXRlQXV0aENvbW1hbmQpLnJlamVjdHMoe1xuICAgICAgICAgIG5hbWU6ICdOb3RBdXRob3JpemVkRXhjZXB0aW9uJyxcbiAgICAgICAgICBtZXNzYWdlOiAnSW5jb3JyZWN0IHVzZXJuYW1lIG9yIHBhc3N3b3JkJyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZXZlbnQgPSBjcmVhdGVNb2NrRXZlbnQoY3JlZGVudGlhbHMpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsb2dpbkhhbmRsZXIoZXZlbnQpO1xuXG4gICAgICAgIC8vIFZlcmlmeSBhdXRoZW50aWNhdGlvbiBmYWlsdXJlXG4gICAgICAgIGV4cGVjdChyZXN1bHQuc3RhdHVzQ29kZSkudG9CZSg0MDEpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UocmVzdWx0LmJvZHkpO1xuICAgICAgICBleHBlY3QoYm9keS5lcnJvcikudG9CZURlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KGJvZHkuZXJyb3IuY29kZSkudG9CZSgnSU5WQUxJRF9DUkVERU5USUFMUycpO1xuICAgICAgfSksXG4gICAgICB7IG51bVJ1bnM6IDEwMCB9XG4gICAgKTtcbiAgfSk7XG59KTtcbiJdfQ==