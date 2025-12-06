import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 20;
    const lastEvaluatedKey = event.queryStringParameters?.lastKey 
      ? JSON.parse(decodeURIComponent(event.queryStringParameters.lastKey))
      : undefined;
    const searchQuery = event.queryStringParameters?.q?.toLowerCase().trim();

    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: EVENTS_TABLE_NAME,
        IndexName: 'StatusDateIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'published',
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: true,
      })
    );

    // Map and filter events
    let events = (result.Items ?? []).map(item => {
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

    // Apply search filter if query provided
    if (searchQuery) {
      events = events.filter(event => {
        const titleMatch = event.title.toLowerCase().includes(searchQuery);
        const descriptionMatch = event.description.toLowerCase().includes(searchQuery);
        return titleMatch ?? descriptionMatch;
      });
    }

    const response: {
      items: typeof events;
      nextToken?: string;
    } = {
      items: events,
    };

    if (result.LastEvaluatedKey) {
      response.nextToken = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));
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
    console.error('List events error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while listing events',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
