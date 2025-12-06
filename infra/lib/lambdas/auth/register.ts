import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;
const USER_POOL_ID = process.env.USER_POOL_ID!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
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

// Type guard for RegisterRequest
function isRegisterRequest(data: unknown): data is RegisterRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'email' in data &&
    'password' in data &&
    'name' in data &&
    typeof (data as RegisterRequest).email === 'string' &&
    typeof (data as RegisterRequest).password === 'string' &&
    typeof (data as RegisterRequest).name === 'string'
  );
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
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
    
    if (!isRegisterRequest(parsedBody)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request must include email, password, and name fields',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const { email, password, name } = parsedBody;

    if (!validateEmail(email)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_EMAIL',
            message: 'Invalid email format',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password does not meet strength requirements',
            details: passwordValidation.errors.map(err => ({ field: 'password', issue: err })),
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

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

    if (queryResult.Items && queryResult.Items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email already exists',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const signUpCommand = new SignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'name',
          Value: name,
        },
      ],
    });

    const signUpResult = await cognitoClient.send(signUpCommand);
    const userId = signUpResult.UserSub!; // Use Cognito's sub as the userId

    // Auto-confirm the user for development/testing
    // In production, you might want to remove this and require email verification
    await cognitoClient.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      })
    );

    const now = new Date().toISOString();

    await dynamoClient.send(
      new PutCommand({
        TableName: USERS_TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
          userId,
          email,
          name,
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        userId,
        email,
        name,
        message: 'User registered successfully. Please check your email to verify your account.',
      }),
    };
  } catch (error: unknown) {
    console.error('Registration error:', error);

    if (isErrorWithName(error)) {
      if (error.name === 'UsernameExistsException') {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'DUPLICATE_EMAIL',
              message: 'An account with this email already exists',
              requestId: event.requestContext.requestId,
            },
          }),
        };
      }

      if (error.name === 'InvalidPasswordException') {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'INVALID_PASSWORD',
              message: error.message ?? 'Password does not meet requirements',
              requestId: event.requestContext.requestId,
            },
          }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during registration',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
