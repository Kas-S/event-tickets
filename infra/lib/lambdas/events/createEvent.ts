import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;

interface VenueInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

interface ContactInfo {
  email: string;
  phone?: string;
}

interface CreateEventRequest {
  title: string;
  description: string;
  coverPhotoUrl: string;
  eventDate: string;
  venue: VenueInfo;
  contactInfo: ContactInfo;
  capacity: number;
}

function isCreateEventRequest(data: unknown): data is CreateEventRequest {
  if (typeof data !== 'object' || data === null) return false;
  
  const req = data as Partial<CreateEventRequest>;
  
  return (
    typeof req.title === 'string' &&
    typeof req.description === 'string' &&
    typeof req.coverPhotoUrl === 'string' &&
    typeof req.eventDate === 'string' &&
    typeof req.venue === 'object' &&
    req.venue !== null &&
    typeof req.venue.name === 'string' &&
    typeof req.venue.address === 'string' &&
    typeof req.venue.city === 'string' &&
    typeof req.venue.state === 'string' &&
    typeof req.venue.zipCode === 'string' &&
    typeof req.contactInfo === 'object' &&
    req.contactInfo !== null &&
    typeof req.contactInfo.email === 'string' &&
    typeof req.capacity === 'number'
  );
}

function validateEventData(data: CreateEventRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  }
  
  if (!data.description || data.description.trim().length === 0) {
    errors.push('Description is required');
  }
  
  if (!data.coverPhotoUrl || data.coverPhotoUrl.trim().length === 0) {
    errors.push('Cover photo URL is required');
  }
  
  const eventDate = new Date(data.eventDate);
  if (isNaN(eventDate.getTime())) {
    errors.push('Invalid event date format');
  } else if (eventDate < new Date()) {
    errors.push('Event date must be in the future');
  }
  
  if (data.capacity <= 0) {
    errors.push('Capacity must be a positive integer');
  }
  
  if (!Number.isInteger(data.capacity)) {
    errors.push('Capacity must be an integer');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.contactInfo.email)) {
    errors.push('Invalid contact email format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
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
    
    if (!isCreateEventRequest(parsedBody)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request must include all required event fields',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const validation = validateEventData(parsedBody);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Event data validation failed',
            details: validation.errors.map(err => ({ field: 'event', issue: err })),
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

    const eventId = randomUUID();
    const now = new Date().toISOString();

    const eventItem = {
      PK: `EVENT#${eventId}`,
      SK: 'METADATA',
      eventId,
      organizerId,
      title: parsedBody.title,
      description: parsedBody.description,
      coverPhotoUrl: parsedBody.coverPhotoUrl,
      eventDate: parsedBody.eventDate,
      venue: parsedBody.venue,
      contactInfo: parsedBody.contactInfo,
      capacity: parsedBody.capacity,
      registeredCount: 0,
      status: 'published',
      createdAt: now,
      updatedAt: now,
    };

    await dynamoClient.send(
      new PutCommand({
        TableName: EVENTS_TABLE_NAME,
        Item: eventItem,
      })
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        eventId,
        organizerId,
        title: parsedBody.title,
        description: parsedBody.description,
        coverPhotoUrl: parsedBody.coverPhotoUrl,
        eventDate: parsedBody.eventDate,
        venue: parsedBody.venue,
        contactInfo: parsedBody.contactInfo,
        capacity: parsedBody.capacity,
        registeredCount: 0,
        availableSpots: parsedBody.capacity,
        isFull: false,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      }),
    };
  } catch (error: unknown) {
    console.error('Create event error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while creating the event',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
