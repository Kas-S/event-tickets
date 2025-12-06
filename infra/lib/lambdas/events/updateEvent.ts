import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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

interface UpdateEventRequest {
  title?: string;
  description?: string;
  coverPhotoUrl?: string;
  eventDate?: string;
  venue?: VenueInfo;
  contactInfo?: ContactInfo;
  capacity?: number;
  status?: 'draft' | 'published' | 'cancelled';
}

function validateEventUpdate(data: UpdateEventRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.title !== undefined && data.title.trim().length === 0) {
    errors.push('Title cannot be empty');
  }
  
  if (data.description !== undefined && data.description.trim().length === 0) {
    errors.push('Description cannot be empty');
  }
  
  if (data.eventDate !== undefined) {
    const eventDate = new Date(data.eventDate);
    if (isNaN(eventDate.getTime())) {
      errors.push('Invalid event date format');
    } else if (eventDate < new Date()) {
      errors.push('Event date must be in the future');
    }
  }
  
  if (data.capacity !== undefined) {
    if (data.capacity <= 0) {
      errors.push('Capacity must be a positive integer');
    }
    if (!Number.isInteger(data.capacity)) {
      errors.push('Capacity must be an integer');
    }
  }
  
  if (data.contactInfo?.email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.contactInfo.email)) {
      errors.push('Invalid contact email format');
    }
  }
  
  if (data.status !== undefined) {
    if (!['draft', 'published', 'cancelled'].includes(data.status)) {
      errors.push('Status must be draft, published, or cancelled');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

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
            message: 'You do not have permission to update this event',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const updateData: UpdateEventRequest = JSON.parse(event.body);
    
    const validation = validateEventUpdate(updateData);
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
            message: 'Event update validation failed',
            details: validation.errors.map(err => ({ field: 'event', issue: err })),
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    if (updateData.capacity !== undefined && updateData.capacity < existingEvent.Item.registeredCount) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_CAPACITY',
            message: `Cannot reduce capacity below current registration count (${existingEvent.Item.registeredCount})`,
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const updateExpressionParts: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    if (updateData.title !== undefined) {
      updateExpressionParts.push('#title = :title');
      expressionAttributeNames['#title'] = 'title';
      expressionAttributeValues[':title'] = updateData.title;
    }

    if (updateData.description !== undefined) {
      updateExpressionParts.push('#description = :description');
      expressionAttributeNames['#description'] = 'description';
      expressionAttributeValues[':description'] = updateData.description;
    }

    if (updateData.coverPhotoUrl !== undefined) {
      updateExpressionParts.push('#coverPhotoUrl = :coverPhotoUrl');
      expressionAttributeNames['#coverPhotoUrl'] = 'coverPhotoUrl';
      expressionAttributeValues[':coverPhotoUrl'] = updateData.coverPhotoUrl;
    }

    if (updateData.eventDate !== undefined) {
      updateExpressionParts.push('#eventDate = :eventDate');
      expressionAttributeNames['#eventDate'] = 'eventDate';
      expressionAttributeValues[':eventDate'] = updateData.eventDate;
    }

    if (updateData.venue !== undefined) {
      updateExpressionParts.push('#venue = :venue');
      expressionAttributeNames['#venue'] = 'venue';
      expressionAttributeValues[':venue'] = updateData.venue;
    }

    if (updateData.contactInfo !== undefined) {
      updateExpressionParts.push('#contactInfo = :contactInfo');
      expressionAttributeNames['#contactInfo'] = 'contactInfo';
      expressionAttributeValues[':contactInfo'] = updateData.contactInfo;
    }

    if (updateData.capacity !== undefined) {
      updateExpressionParts.push('#capacity = :capacity');
      expressionAttributeNames['#capacity'] = 'capacity';
      expressionAttributeValues[':capacity'] = updateData.capacity;
    }

    if (updateData.status !== undefined) {
      updateExpressionParts.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updateData.status;
    }

    updateExpressionParts.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const updateExpression = 'SET ' + updateExpressionParts.join(', ');

    const result = await dynamoClient.send(
      new UpdateCommand({
        TableName: EVENTS_TABLE_NAME,
        Key: {
          PK: `EVENT#${eventId}`,
          SK: 'METADATA',
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    const updatedEvent = result.Attributes!;
    const availableSpots = updatedEvent.capacity - updatedEvent.registeredCount;
    const isFull = updatedEvent.registeredCount >= updatedEvent.capacity;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        eventId: updatedEvent.eventId,
        organizerId: updatedEvent.organizerId,
        title: updatedEvent.title,
        description: updatedEvent.description,
        coverPhotoUrl: updatedEvent.coverPhotoUrl,
        eventDate: updatedEvent.eventDate,
        venue: updatedEvent.venue,
        contactInfo: updatedEvent.contactInfo,
        capacity: updatedEvent.capacity,
        registeredCount: updatedEvent.registeredCount,
        availableSpots,
        isFull,
        status: updatedEvent.status,
        createdAt: updatedEvent.createdAt,
        updatedAt: updatedEvent.updatedAt,
      }),
    };
  } catch (error: unknown) {
    console.error('Update event error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while updating the event',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
