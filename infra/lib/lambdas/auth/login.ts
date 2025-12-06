import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface LoginRequest {
  email: string;
  password: string;
}

interface UserRecord {
  userId: string;
  email: string;
  name: string;
  cognitoId: string;
}

// Type guard for error objects
function isErrorWithName(error: unknown): error is { name: string; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  );
}

// Type guard for LoginRequest
function isLoginRequest(data: unknown): data is LoginRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'email' in data &&
    'password' in data &&
    typeof (data as LoginRequest).email === 'string' &&
    typeof (data as LoginRequest).password === 'string'
  );
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'MISSING_BODY',
            message: 'Request body is required',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const parsedBody: unknown = JSON.parse(event.body);
    
    if (!isLoginRequest(parsedBody)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request must include email and password fields',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const { email, password } = parsedBody;

    // Authenticate with Cognito using USER_PASSWORD_AUTH flow
    const authCommand = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const authResult = await cognitoClient.send(authCommand);

    if (!authResult.AuthenticationResult) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Get user details from DynamoDB
    const queryResult = await dynamoClient.send(
      new QueryCommand({
        TableName: USERS_TABLE_NAME,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
        Limit: 1,
      })
    );

    let user: UserRecord | null = null;
    if (queryResult.Items && queryResult.Items.length > 0) {
      user = queryResult.Items[0] as UserRecord;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        accessToken: authResult.AuthenticationResult.AccessToken,
        idToken: authResult.AuthenticationResult.IdToken,
        refreshToken: authResult.AuthenticationResult.RefreshToken,
        expiresIn: authResult.AuthenticationResult.ExpiresIn,
        tokenType: authResult.AuthenticationResult.TokenType,
        user: user ? {
          userId: user.userId,
          email: user.email,
          name: user.name,
        } : null,
      }),
    };
  } catch (error: unknown) {
    console.error('Login error:', error);

    // Handle Cognito-specific errors
    if (isErrorWithName(error)) {
      if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
              requestId: event.requestContext.requestId,
            },
          }),
        };
      }

      if (error.name === 'UserNotConfirmedException') {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'EMAIL_NOT_VERIFIED',
              message: 'Please verify your email address before logging in',
              requestId: event.requestContext.requestId,
            },
          }),
        };
      }

        if (error.name === 'PasswordResetRequiredException') {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'PASSWORD_RESET_REQUIRED',
              message: 'Password reset is required',
              requestId: event.requestContext.requestId,
            },
          }),
        };
      }
    }

    // Generic error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during login',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
