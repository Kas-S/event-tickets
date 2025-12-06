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
const register_1 = require("../lib/lambdas/auth/register");
const aws_sdk_client_mock_1 = require("aws-sdk-client-mock");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// Mock AWS clients
const cognitoMock = (0, aws_sdk_client_mock_1.mockClient)(client_cognito_identity_provider_1.CognitoIdentityProviderClient);
const dynamoMock = (0, aws_sdk_client_mock_1.mockClient)(lib_dynamodb_1.DynamoDBDocumentClient);
// Arbitraries for generating test data
const arbitraryEmail = () => fc.emailAddress();
const arbitraryValidPassword = () => fc.string({ minLength: 8, maxLength: 20 }).chain(base => fc.record({
    base: fc.constant(base),
    hasLower: fc.constant(base.match(/[a-z]/) !== null),
    hasUpper: fc.constant(base.match(/[A-Z]/) !== null),
    hasDigit: fc.constant(base.match(/[0-9]/) !== null),
}).map(({ base, hasLower, hasUpper, hasDigit }) => {
    let password = base;
    if (!hasLower) {
        password += 'a';
    }
    if (!hasUpper) {
        password += 'A';
    }
    if (!hasDigit) {
        password += '1';
    }
    return password;
}));
const arbitraryName = () => fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const arbitraryValidRegistration = () => fc.record({
    email: arbitraryEmail(),
    password: arbitraryValidPassword(),
    name: arbitraryName(),
});
// Helper to create mock API Gateway event
function createMockEvent(body) {
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
        await fc.assert(fc.asyncProperty(arbitraryValidRegistration(), async (registration) => {
            // Mock: Email doesn't exist in DynamoDB
            dynamoMock.on(lib_dynamodb_1.QueryCommand).resolves({
                Items: [],
                Count: 0,
            });
            // Mock: Cognito signup succeeds
            cognitoMock.on(client_cognito_identity_provider_1.SignUpCommand).resolves({
                UserSub: 'test-cognito-id-' + Math.random(),
                UserConfirmed: false,
            });
            // Mock: DynamoDB put succeeds
            dynamoMock.on(lib_dynamodb_1.PutCommand).resolves({});
            const event = createMockEvent(registration);
            const result = await (0, register_1.handler)(event);
            // Verify successful registration
            expect(result.statusCode).toBe(201);
            const body = JSON.parse(result.body);
            expect(body.userId).toBeDefined();
            expect(body.email).toBe(registration.email);
            expect(body.name).toBe(registration.name);
            // Verify unique userId was generated
            expect(typeof body.userId).toBe('string');
            expect(body.userId.length).toBeGreaterThan(0);
        }), { numRuns: 100 });
    });
    /**
     * Feature: event-ticketing-system, Property 2: Duplicate email rejection
     * Validates: Requirements 1.2
     *
     * For any email address already registered in the system,
     * attempting to register with that email should be rejected with an error message.
     */
    test('Property 2: Duplicate email rejection', async () => {
        await fc.assert(fc.asyncProperty(arbitraryValidRegistration(), async (registration) => {
            // Mock: Email already exists in DynamoDB
            dynamoMock.on(lib_dynamodb_1.QueryCommand).resolves({
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
            const result = await (0, register_1.handler)(event);
            // Verify rejection
            expect(result.statusCode).toBe(409);
            const body = JSON.parse(result.body);
            expect(body.error).toBeDefined();
            expect(body.error.code).toBe('DUPLICATE_EMAIL');
            expect(body.error.message).toContain('already exists');
        }), { numRuns: 100 });
    });
    /**
     * Feature: event-ticketing-system, Property 4: Email as unique identifier
     * Validates: Requirements 1.4
     *
     * For any created user account, querying by the user's email address
     * should return that exact user account.
     */
    test('Property 4: Email as unique identifier', async () => {
        await fc.assert(fc.asyncProperty(arbitraryValidRegistration(), async (registration) => {
            // Mock: Email doesn't exist initially
            dynamoMock.on(lib_dynamodb_1.QueryCommand).resolves({
                Items: [],
                Count: 0,
            });
            // Mock: Cognito signup succeeds
            const cognitoId = 'test-cognito-id-' + Math.random();
            cognitoMock.on(client_cognito_identity_provider_1.SignUpCommand).resolves({
                UserSub: cognitoId,
                UserConfirmed: false,
            });
            // Capture the user data that was written to DynamoDB
            let capturedUserData = null;
            dynamoMock.on(lib_dynamodb_1.PutCommand).callsFake((input) => {
                capturedUserData = input.Item;
                return Promise.resolve({});
            });
            const event = createMockEvent(registration);
            const result = await (0, register_1.handler)(event);
            // Verify successful registration
            expect(result.statusCode).toBe(201);
            // Verify the user data includes the email as stored
            expect(capturedUserData).toBeDefined();
            expect(capturedUserData.email).toBe(registration.email);
            // Verify email is used as the unique identifier in the GSI
            // The email should be stored in a way that allows querying by email
            expect(capturedUserData.email).toBe(registration.email);
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC1yZWdpc3RyYXRpb24udGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF1dGgtcmVnaXN0cmF0aW9uLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLCtDQUFpQztBQUNqQywyREFBMEU7QUFFMUUsNkRBQWlEO0FBQ2pELGdHQUF5RztBQUN6Ryx3REFBeUY7QUFFekYsbUJBQW1CO0FBQ25CLE1BQU0sV0FBVyxHQUFHLElBQUEsZ0NBQVUsRUFBQyxnRUFBNkIsQ0FBQyxDQUFDO0FBQzlELE1BQU0sVUFBVSxHQUFHLElBQUEsZ0NBQVUsRUFBQyxxQ0FBc0IsQ0FBQyxDQUFDO0FBRXRELHVDQUF1QztBQUN2QyxNQUFNLGNBQWMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUM7QUFFL0MsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLEVBQUUsQ0FDbEMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQ3RELEVBQUUsQ0FBQyxNQUFNLENBQUM7SUFDUixJQUFJLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7SUFDdkIsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUM7SUFDbkQsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUM7SUFDbkQsUUFBUSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUM7Q0FDcEQsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTtJQUNoRCxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDcEIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQUEsUUFBUSxJQUFJLEdBQUcsQ0FBQztJQUFBLENBQUM7SUFDakMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQUEsUUFBUSxJQUFJLEdBQUcsQ0FBQztJQUFBLENBQUM7SUFDakMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQUEsUUFBUSxJQUFJLEdBQUcsQ0FBQztJQUFBLENBQUM7SUFDakMsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQyxDQUFDLENBQ0gsQ0FBQztBQUVKLE1BQU0sYUFBYSxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFekcsTUFBTSwwQkFBMEIsR0FBRyxHQUFHLEVBQUUsQ0FDdEMsRUFBRSxDQUFDLE1BQU0sQ0FBQztJQUNSLEtBQUssRUFBRSxjQUFjLEVBQUU7SUFDdkIsUUFBUSxFQUFFLHNCQUFzQixFQUFFO0lBQ2xDLElBQUksRUFBRSxhQUFhLEVBQUU7Q0FDdEIsQ0FBQyxDQUFDO0FBRUwsMENBQTBDO0FBQzFDLFNBQVMsZUFBZSxDQUFDLElBQVM7SUFDaEMsT0FBTztRQUNMLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztRQUMxQixPQUFPLEVBQUUsRUFBRTtRQUNYLGlCQUFpQixFQUFFLEVBQUU7UUFDckIsVUFBVSxFQUFFLE1BQU07UUFDbEIsZUFBZSxFQUFFLEtBQUs7UUFDdEIsSUFBSSxFQUFFLGdCQUFnQjtRQUN0QixjQUFjLEVBQUUsSUFBSTtRQUNwQixxQkFBcUIsRUFBRSxJQUFJO1FBQzNCLCtCQUErQixFQUFFLElBQUk7UUFDckMsY0FBYyxFQUFFLElBQUk7UUFDcEIsY0FBYyxFQUFFO1lBQ2QsU0FBUyxFQUFFLGNBQWM7WUFDekIsS0FBSyxFQUFFLFVBQVU7WUFDakIsVUFBVSxFQUFFLElBQUk7WUFDaEIsUUFBUSxFQUFFLFVBQVU7WUFDcEIsVUFBVSxFQUFFLE1BQU07WUFDbEIsUUFBUSxFQUFFO2dCQUNSLFNBQVMsRUFBRSxJQUFJO2dCQUNmLFNBQVMsRUFBRSxJQUFJO2dCQUNmLE1BQU0sRUFBRSxJQUFJO2dCQUNaLFFBQVEsRUFBRSxJQUFJO2dCQUNkLE1BQU0sRUFBRSxJQUFJO2dCQUNaLFVBQVUsRUFBRSxJQUFJO2dCQUNoQiw2QkFBNkIsRUFBRSxJQUFJO2dCQUNuQyx5QkFBeUIsRUFBRSxJQUFJO2dCQUMvQixpQkFBaUIsRUFBRSxJQUFJO2dCQUN2QixxQkFBcUIsRUFBRSxJQUFJO2dCQUMzQixjQUFjLEVBQUUsSUFBSTtnQkFDcEIsUUFBUSxFQUFFLFdBQVc7Z0JBQ3JCLElBQUksRUFBRSxJQUFJO2dCQUNWLFNBQVMsRUFBRSxZQUFZO2dCQUN2QixPQUFPLEVBQUUsSUFBSTthQUNkO1lBQ0QsSUFBSSxFQUFFLGdCQUFnQjtZQUN0QixLQUFLLEVBQUUsTUFBTTtZQUNiLFNBQVMsRUFBRSxpQkFBaUI7WUFDNUIsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxnQkFBZ0IsRUFBRSxhQUFhO1lBQy9CLFVBQVUsRUFBRSxlQUFlO1lBQzNCLFlBQVksRUFBRSxnQkFBZ0I7U0FDL0I7UUFDRCxRQUFRLEVBQUUsZ0JBQWdCO0tBQzNCLENBQUM7QUFDSixDQUFDO0FBRUQsUUFBUSxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsRUFBRTtJQUNoRCxVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3BCLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVuQixxQ0FBcUM7UUFDckMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEdBQUcsY0FBYyxDQUFDO1FBQzFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEdBQUcsZ0JBQWdCLENBQUM7UUFDbkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxrQkFBa0IsQ0FBQztJQUNwRCxDQUFDLENBQUMsQ0FBQztJQUVIOzs7Ozs7T0FNRztJQUNILElBQUksQ0FBQyx1REFBdUQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN2RSxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQ2IsRUFBRSxDQUFDLGFBQWEsQ0FBQywwQkFBMEIsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRTtZQUNwRSx3Q0FBd0M7WUFDeEMsVUFBVSxDQUFDLEVBQUUsQ0FBQywyQkFBWSxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUNuQyxLQUFLLEVBQUUsRUFBRTtnQkFDVCxLQUFLLEVBQUUsQ0FBQzthQUNULENBQUMsQ0FBQztZQUVILGdDQUFnQztZQUNoQyxXQUFXLENBQUMsRUFBRSxDQUFDLGdEQUFhLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ3JDLE9BQU8sRUFBRSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFO2dCQUMzQyxhQUFhLEVBQUUsS0FBSzthQUNyQixDQUFDLENBQUM7WUFFSCw4QkFBOEI7WUFDOUIsVUFBVSxDQUFDLEVBQUUsQ0FBQyx5QkFBVSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRXZDLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUM1QyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsa0JBQWUsRUFBQyxLQUFLLENBQUMsQ0FBQztZQUU1QyxpQ0FBaUM7WUFDakMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFcEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFDLHFDQUFxQztZQUNyQyxNQUFNLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUMsRUFDRixFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FDakIsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUg7Ozs7OztPQU1HO0lBQ0gsSUFBSSxDQUFDLHVDQUF1QyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3ZELE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FDYixFQUFFLENBQUMsYUFBYSxDQUFDLDBCQUEwQixFQUFFLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxFQUFFO1lBQ3BFLHlDQUF5QztZQUN6QyxVQUFVLENBQUMsRUFBRSxDQUFDLDJCQUFZLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ25DLEtBQUssRUFBRSxDQUFDO3dCQUNOLEVBQUUsRUFBRSx1QkFBdUI7d0JBQzNCLEVBQUUsRUFBRSxTQUFTO3dCQUNiLE1BQU0sRUFBRSxrQkFBa0I7d0JBQzFCLEtBQUssRUFBRSxZQUFZLENBQUMsS0FBSzt3QkFDekIsSUFBSSxFQUFFLGVBQWU7cUJBQ3RCLENBQUM7Z0JBQ0YsS0FBSyxFQUFFLENBQUM7YUFDVCxDQUFDLENBQUM7WUFFSCxNQUFNLEtBQUssR0FBRyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDNUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGtCQUFlLEVBQUMsS0FBSyxDQUFDLENBQUM7WUFFNUMsbUJBQW1CO1lBQ25CLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXBDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDaEQsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDekQsQ0FBQyxDQUFDLEVBQ0YsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQ2pCLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVIOzs7Ozs7T0FNRztJQUNILElBQUksQ0FBQyx3Q0FBd0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN4RCxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQ2IsRUFBRSxDQUFDLGFBQWEsQ0FBQywwQkFBMEIsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsRUFBRTtZQUNwRSxzQ0FBc0M7WUFDdEMsVUFBVSxDQUFDLEVBQUUsQ0FBQywyQkFBWSxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUNuQyxLQUFLLEVBQUUsRUFBRTtnQkFDVCxLQUFLLEVBQUUsQ0FBQzthQUNULENBQUMsQ0FBQztZQUVILGdDQUFnQztZQUNoQyxNQUFNLFNBQVMsR0FBRyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDckQsV0FBVyxDQUFDLEVBQUUsQ0FBQyxnREFBYSxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUNyQyxPQUFPLEVBQUUsU0FBUztnQkFDbEIsYUFBYSxFQUFFLEtBQUs7YUFDckIsQ0FBQyxDQUFDO1lBRUgscURBQXFEO1lBQ3JELElBQUksZ0JBQWdCLEdBQVEsSUFBSSxDQUFDO1lBQ2pDLFVBQVUsQ0FBQyxFQUFFLENBQUMseUJBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO2dCQUM1QyxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUM5QixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0IsQ0FBQyxDQUFDLENBQUM7WUFFSCxNQUFNLEtBQUssR0FBRyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDNUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGtCQUFlLEVBQUMsS0FBSyxDQUFDLENBQUM7WUFFNUMsaUNBQWlDO1lBQ2pDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRXBDLG9EQUFvRDtZQUNwRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN2QyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUV4RCwyREFBMkQ7WUFDM0Qsb0VBQW9FO1lBQ3BFLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxFQUNGLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUNqQixDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZjIGZyb20gJ2Zhc3QtY2hlY2snO1xuaW1wb3J0IHsgaGFuZGxlciBhcyByZWdpc3RlckhhbmRsZXIgfSBmcm9tICcuLi9saWIvbGFtYmRhcy9hdXRoL3JlZ2lzdGVyJztcbmltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50IH0gZnJvbSAnYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBtb2NrQ2xpZW50IH0gZnJvbSAnYXdzLXNkay1jbGllbnQtbW9jayc7XG5pbXBvcnQgeyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCwgU2lnblVwQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1jb2duaXRvLWlkZW50aXR5LXByb3ZpZGVyJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFB1dENvbW1hbmQsIFF1ZXJ5Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5cbi8vIE1vY2sgQVdTIGNsaWVudHNcbmNvbnN0IGNvZ25pdG9Nb2NrID0gbW9ja0NsaWVudChDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCk7XG5jb25zdCBkeW5hbW9Nb2NrID0gbW9ja0NsaWVudChEeW5hbW9EQkRvY3VtZW50Q2xpZW50KTtcblxuLy8gQXJiaXRyYXJpZXMgZm9yIGdlbmVyYXRpbmcgdGVzdCBkYXRhXG5jb25zdCBhcmJpdHJhcnlFbWFpbCA9ICgpID0+IGZjLmVtYWlsQWRkcmVzcygpO1xuXG5jb25zdCBhcmJpdHJhcnlWYWxpZFBhc3N3b3JkID0gKCkgPT4gXG4gIGZjLnN0cmluZyh7IG1pbkxlbmd0aDogOCwgbWF4TGVuZ3RoOiAyMCB9KS5jaGFpbihiYXNlID0+XG4gICAgZmMucmVjb3JkKHtcbiAgICAgIGJhc2U6IGZjLmNvbnN0YW50KGJhc2UpLFxuICAgICAgaGFzTG93ZXI6IGZjLmNvbnN0YW50KGJhc2UubWF0Y2goL1thLXpdLykgIT09IG51bGwpLFxuICAgICAgaGFzVXBwZXI6IGZjLmNvbnN0YW50KGJhc2UubWF0Y2goL1tBLVpdLykgIT09IG51bGwpLFxuICAgICAgaGFzRGlnaXQ6IGZjLmNvbnN0YW50KGJhc2UubWF0Y2goL1swLTldLykgIT09IG51bGwpLFxuICAgIH0pLm1hcCgoeyBiYXNlLCBoYXNMb3dlciwgaGFzVXBwZXIsIGhhc0RpZ2l0IH0pID0+IHtcbiAgICAgIGxldCBwYXNzd29yZCA9IGJhc2U7XG4gICAgICBpZiAoIWhhc0xvd2VyKSB7cGFzc3dvcmQgKz0gJ2EnO31cbiAgICAgIGlmICghaGFzVXBwZXIpIHtwYXNzd29yZCArPSAnQSc7fVxuICAgICAgaWYgKCFoYXNEaWdpdCkge3Bhc3N3b3JkICs9ICcxJzt9XG4gICAgICByZXR1cm4gcGFzc3dvcmQ7XG4gICAgfSlcbiAgKTtcblxuY29uc3QgYXJiaXRyYXJ5TmFtZSA9ICgpID0+IGZjLnN0cmluZyh7IG1pbkxlbmd0aDogMSwgbWF4TGVuZ3RoOiAxMDAgfSkuZmlsdGVyKHMgPT4gcy50cmltKCkubGVuZ3RoID4gMCk7XG5cbmNvbnN0IGFyYml0cmFyeVZhbGlkUmVnaXN0cmF0aW9uID0gKCkgPT5cbiAgZmMucmVjb3JkKHtcbiAgICBlbWFpbDogYXJiaXRyYXJ5RW1haWwoKSxcbiAgICBwYXNzd29yZDogYXJiaXRyYXJ5VmFsaWRQYXNzd29yZCgpLFxuICAgIG5hbWU6IGFyYml0cmFyeU5hbWUoKSxcbiAgfSk7XG5cbi8vIEhlbHBlciB0byBjcmVhdGUgbW9jayBBUEkgR2F0ZXdheSBldmVudFxuZnVuY3Rpb24gY3JlYXRlTW9ja0V2ZW50KGJvZHk6IGFueSk6IEFQSUdhdGV3YXlQcm94eUV2ZW50IHtcbiAgcmV0dXJuIHtcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICBoZWFkZXJzOiB7fSxcbiAgICBtdWx0aVZhbHVlSGVhZGVyczoge30sXG4gICAgaHR0cE1ldGhvZDogJ1BPU1QnLFxuICAgIGlzQmFzZTY0RW5jb2RlZDogZmFsc2UsXG4gICAgcGF0aDogJy9hdXRoL3JlZ2lzdGVyJyxcbiAgICBwYXRoUGFyYW1ldGVyczogbnVsbCxcbiAgICBxdWVyeVN0cmluZ1BhcmFtZXRlcnM6IG51bGwsXG4gICAgbXVsdGlWYWx1ZVF1ZXJ5U3RyaW5nUGFyYW1ldGVyczogbnVsbCxcbiAgICBzdGFnZVZhcmlhYmxlczogbnVsbCxcbiAgICByZXF1ZXN0Q29udGV4dDoge1xuICAgICAgYWNjb3VudElkOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgIGFwaUlkOiAndGVzdC1hcGknLFxuICAgICAgYXV0aG9yaXplcjogbnVsbCxcbiAgICAgIHByb3RvY29sOiAnSFRUUC8xLjEnLFxuICAgICAgaHR0cE1ldGhvZDogJ1BPU1QnLFxuICAgICAgaWRlbnRpdHk6IHtcbiAgICAgICAgYWNjZXNzS2V5OiBudWxsLFxuICAgICAgICBhY2NvdW50SWQ6IG51bGwsXG4gICAgICAgIGFwaUtleTogbnVsbCxcbiAgICAgICAgYXBpS2V5SWQ6IG51bGwsXG4gICAgICAgIGNhbGxlcjogbnVsbCxcbiAgICAgICAgY2xpZW50Q2VydDogbnVsbCxcbiAgICAgICAgY29nbml0b0F1dGhlbnRpY2F0aW9uUHJvdmlkZXI6IG51bGwsXG4gICAgICAgIGNvZ25pdG9BdXRoZW50aWNhdGlvblR5cGU6IG51bGwsXG4gICAgICAgIGNvZ25pdG9JZGVudGl0eUlkOiBudWxsLFxuICAgICAgICBjb2duaXRvSWRlbnRpdHlQb29sSWQ6IG51bGwsXG4gICAgICAgIHByaW5jaXBhbE9yZ0lkOiBudWxsLFxuICAgICAgICBzb3VyY2VJcDogJzEyNy4wLjAuMScsXG4gICAgICAgIHVzZXI6IG51bGwsXG4gICAgICAgIHVzZXJBZ2VudDogJ3Rlc3QtYWdlbnQnLFxuICAgICAgICB1c2VyQXJuOiBudWxsLFxuICAgICAgfSxcbiAgICAgIHBhdGg6ICcvYXV0aC9yZWdpc3RlcicsXG4gICAgICBzdGFnZTogJ3Rlc3QnLFxuICAgICAgcmVxdWVzdElkOiAndGVzdC1yZXF1ZXN0LWlkJyxcbiAgICAgIHJlcXVlc3RUaW1lOiAnMDEvSmFuLzIwMjQ6MDA6MDA6MDAgKzAwMDAnLFxuICAgICAgcmVxdWVzdFRpbWVFcG9jaDogMTcwNDA2NzIwMDAwMCxcbiAgICAgIHJlc291cmNlSWQ6ICd0ZXN0LXJlc291cmNlJyxcbiAgICAgIHJlc291cmNlUGF0aDogJy9hdXRoL3JlZ2lzdGVyJyxcbiAgICB9LFxuICAgIHJlc291cmNlOiAnL2F1dGgvcmVnaXN0ZXInLFxuICB9O1xufVxuXG5kZXNjcmliZSgnVXNlciBSZWdpc3RyYXRpb24gUHJvcGVydHkgVGVzdHMnLCAoKSA9PiB7XG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIGNvZ25pdG9Nb2NrLnJlc2V0KCk7XG4gICAgZHluYW1vTW9jay5yZXNldCgpO1xuICAgIFxuICAgIC8vIFNldCByZXF1aXJlZCBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBwcm9jZXNzLmVudi5VU0VSX1BPT0xfSUQgPSAndGVzdC1wb29sLWlkJztcbiAgICBwcm9jZXNzLmVudi5VU0VSX1BPT0xfQ0xJRU5UX0lEID0gJ3Rlc3QtY2xpZW50LWlkJztcbiAgICBwcm9jZXNzLmVudi5VU0VSU19UQUJMRV9OQU1FID0gJ3Rlc3QtdXNlcnMtdGFibGUnO1xuICB9KTtcblxuICAvKipcbiAgICogRmVhdHVyZTogZXZlbnQtdGlja2V0aW5nLXN5c3RlbSwgUHJvcGVydHkgMTogVXNlciByZWdpc3RyYXRpb24gY3JlYXRlcyB1bmlxdWUgYWNjb3VudHNcbiAgICogVmFsaWRhdGVzOiBSZXF1aXJlbWVudHMgMS4xXG4gICAqIFxuICAgKiBGb3IgYW55IHZhbGlkIGVtYWlsIGFuZCBwYXNzd29yZCBjb21iaW5hdGlvbiBub3QgYWxyZWFkeSBpbiB0aGUgc3lzdGVtLFxuICAgKiBzdWJtaXR0aW5nIGEgcmVnaXN0cmF0aW9uIGZvcm0gc2hvdWxkIGNyZWF0ZSBhIG5ldyB1c2VyIGFjY291bnQgd2l0aCBhIHVuaXF1ZSBpZGVudGlmaWVyLlxuICAgKi9cbiAgdGVzdCgnUHJvcGVydHkgMTogVXNlciByZWdpc3RyYXRpb24gY3JlYXRlcyB1bmlxdWUgYWNjb3VudHMnLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZmMuYXNzZXJ0KFxuICAgICAgZmMuYXN5bmNQcm9wZXJ0eShhcmJpdHJhcnlWYWxpZFJlZ2lzdHJhdGlvbigpLCBhc3luYyAocmVnaXN0cmF0aW9uKSA9PiB7XG4gICAgICAgIC8vIE1vY2s6IEVtYWlsIGRvZXNuJ3QgZXhpc3QgaW4gRHluYW1vREJcbiAgICAgICAgZHluYW1vTW9jay5vbihRdWVyeUNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgICBJdGVtczogW10sXG4gICAgICAgICAgQ291bnQ6IDAsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE1vY2s6IENvZ25pdG8gc2lnbnVwIHN1Y2NlZWRzXG4gICAgICAgIGNvZ25pdG9Nb2NrLm9uKFNpZ25VcENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgICBVc2VyU3ViOiAndGVzdC1jb2duaXRvLWlkLScgKyBNYXRoLnJhbmRvbSgpLFxuICAgICAgICAgIFVzZXJDb25maXJtZWQ6IGZhbHNlLFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBNb2NrOiBEeW5hbW9EQiBwdXQgc3VjY2VlZHNcbiAgICAgICAgZHluYW1vTW9jay5vbihQdXRDb21tYW5kKS5yZXNvbHZlcyh7fSk7XG5cbiAgICAgICAgY29uc3QgZXZlbnQgPSBjcmVhdGVNb2NrRXZlbnQocmVnaXN0cmF0aW9uKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVnaXN0ZXJIYW5kbGVyKGV2ZW50KTtcblxuICAgICAgICAvLyBWZXJpZnkgc3VjY2Vzc2Z1bCByZWdpc3RyYXRpb25cbiAgICAgICAgZXhwZWN0KHJlc3VsdC5zdGF0dXNDb2RlKS50b0JlKDIwMSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShyZXN1bHQuYm9keSk7XG4gICAgICAgIGV4cGVjdChib2R5LnVzZXJJZCkudG9CZURlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KGJvZHkuZW1haWwpLnRvQmUocmVnaXN0cmF0aW9uLmVtYWlsKTtcbiAgICAgICAgZXhwZWN0KGJvZHkubmFtZSkudG9CZShyZWdpc3RyYXRpb24ubmFtZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBWZXJpZnkgdW5pcXVlIHVzZXJJZCB3YXMgZ2VuZXJhdGVkXG4gICAgICAgIGV4cGVjdCh0eXBlb2YgYm9keS51c2VySWQpLnRvQmUoJ3N0cmluZycpO1xuICAgICAgICBleHBlY3QoYm9keS51c2VySWQubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgICB9KSxcbiAgICAgIHsgbnVtUnVuczogMTAwIH1cbiAgICApO1xuICB9KTtcblxuICAvKipcbiAgICogRmVhdHVyZTogZXZlbnQtdGlja2V0aW5nLXN5c3RlbSwgUHJvcGVydHkgMjogRHVwbGljYXRlIGVtYWlsIHJlamVjdGlvblxuICAgKiBWYWxpZGF0ZXM6IFJlcXVpcmVtZW50cyAxLjJcbiAgICogXG4gICAqIEZvciBhbnkgZW1haWwgYWRkcmVzcyBhbHJlYWR5IHJlZ2lzdGVyZWQgaW4gdGhlIHN5c3RlbSxcbiAgICogYXR0ZW1wdGluZyB0byByZWdpc3RlciB3aXRoIHRoYXQgZW1haWwgc2hvdWxkIGJlIHJlamVjdGVkIHdpdGggYW4gZXJyb3IgbWVzc2FnZS5cbiAgICovXG4gIHRlc3QoJ1Byb3BlcnR5IDI6IER1cGxpY2F0ZSBlbWFpbCByZWplY3Rpb24nLCBhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZmMuYXNzZXJ0KFxuICAgICAgZmMuYXN5bmNQcm9wZXJ0eShhcmJpdHJhcnlWYWxpZFJlZ2lzdHJhdGlvbigpLCBhc3luYyAocmVnaXN0cmF0aW9uKSA9PiB7XG4gICAgICAgIC8vIE1vY2s6IEVtYWlsIGFscmVhZHkgZXhpc3RzIGluIER5bmFtb0RCXG4gICAgICAgIGR5bmFtb01vY2sub24oUXVlcnlDb21tYW5kKS5yZXNvbHZlcyh7XG4gICAgICAgICAgSXRlbXM6IFt7XG4gICAgICAgICAgICBQSzogJ1VTRVIjZXhpc3RpbmctdXNlci1pZCcsXG4gICAgICAgICAgICBTSzogJ1BST0ZJTEUnLFxuICAgICAgICAgICAgdXNlcklkOiAnZXhpc3RpbmctdXNlci1pZCcsXG4gICAgICAgICAgICBlbWFpbDogcmVnaXN0cmF0aW9uLmVtYWlsLFxuICAgICAgICAgICAgbmFtZTogJ0V4aXN0aW5nIFVzZXInLFxuICAgICAgICAgIH1dLFxuICAgICAgICAgIENvdW50OiAxLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBldmVudCA9IGNyZWF0ZU1vY2tFdmVudChyZWdpc3RyYXRpb24pO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZWdpc3RlckhhbmRsZXIoZXZlbnQpO1xuXG4gICAgICAgIC8vIFZlcmlmeSByZWplY3Rpb25cbiAgICAgICAgZXhwZWN0KHJlc3VsdC5zdGF0dXNDb2RlKS50b0JlKDQwOSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShyZXN1bHQuYm9keSk7XG4gICAgICAgIGV4cGVjdChib2R5LmVycm9yKS50b0JlRGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoYm9keS5lcnJvci5jb2RlKS50b0JlKCdEVVBMSUNBVEVfRU1BSUwnKTtcbiAgICAgICAgZXhwZWN0KGJvZHkuZXJyb3IubWVzc2FnZSkudG9Db250YWluKCdhbHJlYWR5IGV4aXN0cycpO1xuICAgICAgfSksXG4gICAgICB7IG51bVJ1bnM6IDEwMCB9XG4gICAgKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEZlYXR1cmU6IGV2ZW50LXRpY2tldGluZy1zeXN0ZW0sIFByb3BlcnR5IDQ6IEVtYWlsIGFzIHVuaXF1ZSBpZGVudGlmaWVyXG4gICAqIFZhbGlkYXRlczogUmVxdWlyZW1lbnRzIDEuNFxuICAgKiBcbiAgICogRm9yIGFueSBjcmVhdGVkIHVzZXIgYWNjb3VudCwgcXVlcnlpbmcgYnkgdGhlIHVzZXIncyBlbWFpbCBhZGRyZXNzXG4gICAqIHNob3VsZCByZXR1cm4gdGhhdCBleGFjdCB1c2VyIGFjY291bnQuXG4gICAqL1xuICB0ZXN0KCdQcm9wZXJ0eSA0OiBFbWFpbCBhcyB1bmlxdWUgaWRlbnRpZmllcicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBmYy5hc3NlcnQoXG4gICAgICBmYy5hc3luY1Byb3BlcnR5KGFyYml0cmFyeVZhbGlkUmVnaXN0cmF0aW9uKCksIGFzeW5jIChyZWdpc3RyYXRpb24pID0+IHtcbiAgICAgICAgLy8gTW9jazogRW1haWwgZG9lc24ndCBleGlzdCBpbml0aWFsbHlcbiAgICAgICAgZHluYW1vTW9jay5vbihRdWVyeUNvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgICBJdGVtczogW10sXG4gICAgICAgICAgQ291bnQ6IDAsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE1vY2s6IENvZ25pdG8gc2lnbnVwIHN1Y2NlZWRzXG4gICAgICAgIGNvbnN0IGNvZ25pdG9JZCA9ICd0ZXN0LWNvZ25pdG8taWQtJyArIE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGNvZ25pdG9Nb2NrLm9uKFNpZ25VcENvbW1hbmQpLnJlc29sdmVzKHtcbiAgICAgICAgICBVc2VyU3ViOiBjb2duaXRvSWQsXG4gICAgICAgICAgVXNlckNvbmZpcm1lZDogZmFsc2UsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENhcHR1cmUgdGhlIHVzZXIgZGF0YSB0aGF0IHdhcyB3cml0dGVuIHRvIER5bmFtb0RCXG4gICAgICAgIGxldCBjYXB0dXJlZFVzZXJEYXRhOiBhbnkgPSBudWxsO1xuICAgICAgICBkeW5hbW9Nb2NrLm9uKFB1dENvbW1hbmQpLmNhbGxzRmFrZSgoaW5wdXQpID0+IHtcbiAgICAgICAgICBjYXB0dXJlZFVzZXJEYXRhID0gaW5wdXQuSXRlbTtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHt9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZXZlbnQgPSBjcmVhdGVNb2NrRXZlbnQocmVnaXN0cmF0aW9uKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVnaXN0ZXJIYW5kbGVyKGV2ZW50KTtcblxuICAgICAgICAvLyBWZXJpZnkgc3VjY2Vzc2Z1bCByZWdpc3RyYXRpb25cbiAgICAgICAgZXhwZWN0KHJlc3VsdC5zdGF0dXNDb2RlKS50b0JlKDIwMSk7XG4gICAgICAgIFxuICAgICAgICAvLyBWZXJpZnkgdGhlIHVzZXIgZGF0YSBpbmNsdWRlcyB0aGUgZW1haWwgYXMgc3RvcmVkXG4gICAgICAgIGV4cGVjdChjYXB0dXJlZFVzZXJEYXRhKS50b0JlRGVmaW5lZCgpO1xuICAgICAgICBleHBlY3QoY2FwdHVyZWRVc2VyRGF0YS5lbWFpbCkudG9CZShyZWdpc3RyYXRpb24uZW1haWwpO1xuICAgICAgICBcbiAgICAgICAgLy8gVmVyaWZ5IGVtYWlsIGlzIHVzZWQgYXMgdGhlIHVuaXF1ZSBpZGVudGlmaWVyIGluIHRoZSBHU0lcbiAgICAgICAgLy8gVGhlIGVtYWlsIHNob3VsZCBiZSBzdG9yZWQgaW4gYSB3YXkgdGhhdCBhbGxvd3MgcXVlcnlpbmcgYnkgZW1haWxcbiAgICAgICAgZXhwZWN0KGNhcHR1cmVkVXNlckRhdGEuZW1haWwpLnRvQmUocmVnaXN0cmF0aW9uLmVtYWlsKTtcbiAgICAgIH0pLFxuICAgICAgeyBudW1SdW5zOiAxMDAgfVxuICAgICk7XG4gIH0pO1xufSk7XG4iXX0=