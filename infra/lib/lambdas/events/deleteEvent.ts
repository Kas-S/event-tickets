import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const eventId = event.pathParameters?.eventId;
    
    if (!eventId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'MISSING_EVENT_ID',
            message: 'Event ID is required',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const organizerId = event.requestContext.authorizer?.claims?.sub;
    if (!organizerId) {
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

    const existingEvent = await dynamoClient.send(
      new GetCommand({
        TableName: EVENTS_TABLE_NAME,
        Key: {
          PK: `EVENT#${eventId}`,
          SK: 'METADATA',
        },
      })
    );

    if (!existingEvent.Item) {
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

    if (existingEvent.Item.organizerId !== organizerId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to delete this event',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    await dynamoClient.send(
      new DeleteCommand({
        TableName: EVENTS_TABLE_NAME,
        Key: {
          PK: `EVENT#${eventId}`,
          SK: 'METADATA',
        },
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Event deleted successfully',
        eventId,
      }),
    };
  } catch (error: unknown) {
    console.error('Delete event error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while deleting the event',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
