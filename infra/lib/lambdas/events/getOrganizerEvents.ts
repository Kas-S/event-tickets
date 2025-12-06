import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract userId from Cognito authorizer context
    const userId = event.requestContext.authorizer?.claims?.sub;

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

    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
    const lastEvaluatedKey = event.queryStringParameters?.lastKey 
      ? JSON.parse(decodeURIComponent(event.queryStringParameters.lastKey))
      : undefined;

    // Query events by organizerId using OrganizerIndex GSI
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: EVENTS_TABLE_NAME,
        IndexName: 'OrganizerIndex',
        KeyConditionExpression: 'organizerId = :organizerId',
        ExpressionAttributeValues: {
          ':organizerId': userId,
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: true, // Sort by eventDate ascending
      })
    );

    // Map events with calculated fields
    const events = (result.Items ?? []).map(item => {
      const availableSpots = item.capacity - item.registeredCount;
      const isFull = item.registeredCount >= item.capacity;

      return {
        eventId: item.eventId,
        organizerId: item.organizerId,
        title: item.title,
        description: item.description,
        coverPhotoUrl: item.coverPhotoUrl,
        eventDate: item.eventDate,
        venue: item.venue,
        contactInfo: item.contactInfo,
        capacity: item.capacity,
        registeredCount: item.registeredCount,
        availableSpots,
        isFull,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    const response: {
      events: typeof events;
      lastEvaluatedKey?: string;
      hasMore: boolean;
    } = {
      events,
      hasMore: !!result.LastEvaluatedKey,
    };

    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    console.error('Get organizer events error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while retrieving organizer events',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
