import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;
const REGISTRATIONS_TABLE_NAME = process.env.REGISTRATIONS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract userId from Cognito authorizer context
    const userId = event.requestContext.authorizer?.claims?.sub;
    const eventId = event.pathParameters?.eventId;

    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    if (!eventId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Event ID is required',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Verify the event exists and the user is the organizer
    const eventResult = await dynamoClient.send(
      new GetCommand({
        TableName: EVENTS_TABLE_NAME,
        Key: {
          PK: `EVENT#${eventId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!eventResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'EVENT_NOT_FOUND',
            message: 'Event not found',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Check if the user is the organizer
    if (eventResult.Item.organizerId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'Only the event organizer can view attendees',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Query registrations by eventId using EventRegistrationIndex GSI
    const registrationsResult = await dynamoClient.send(
      new QueryCommand({
        TableName: REGISTRATIONS_TABLE_NAME,
        IndexName: 'EventRegistrationIndex',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': eventId,
        },
        ScanIndexForward: true, // Sort by createdAt ascending
      })
    );

    // Fetch user details for each registration
    const attendees = await Promise.all(
      (registrationsResult.Items ?? []).map(async (registration) => {
        const userResult = await dynamoClient.send(
          new GetCommand({
            TableName: USERS_TABLE_NAME,
            Key: {
              PK: `USER#${registration.userId}`,
              SK: 'PROFILE',
            },
          })
        );

        return {
          registrationId: registration.registrationId,
          userId: registration.userId,
          name: userResult.Item?.name ?? 'Unknown',
          email: userResult.Item?.email ?? 'Unknown',
          status: registration.status,
          registeredAt: registration.createdAt,
          checkedInAt: registration.checkedInAt,
        };
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        eventId,
        attendees,
        totalCount: attendees.length,
      }),
    };
  } catch (error: unknown) {
    console.error('Get event attendees error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while retrieving event attendees',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
