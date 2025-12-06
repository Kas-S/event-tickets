import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { buildDigitalTicket, EventInfo, AttendeeInfo, VenueInfo, ContactInfo } from '../shared/ticketUtils';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const REGISTRATIONS_TABLE_NAME = process.env.REGISTRATIONS_TABLE_NAME!;
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const registrationId = event.pathParameters?.registrationId;
    
    if (!registrationId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'MISSING_REGISTRATION_ID',
            message: 'Registration ID is required',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

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

    // Get the registration
    const registrationResult = await dynamoClient.send(
      new GetCommand({
        TableName: REGISTRATIONS_TABLE_NAME,
        Key: {
          PK: `REG#${registrationId}`,
          SK: 'DETAILS',
        },
      })
    );

    if (!registrationResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'REGISTRATION_NOT_FOUND',
            message: 'Registration not found',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const registration = registrationResult.Item;

    if (registration.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this registration',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Fetch event details
    const eventResult = await dynamoClient.send(
      new GetCommand({
        TableName: EVENTS_TABLE_NAME,
        Key: {
          PK: `EVENT#${registration.eventId}`,
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
            message: 'Associated event not found',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Fetch user details
    const userResult = await dynamoClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      })
    );

    const userEmail = (userResult.Item?.email as string | undefined) ?? '';
    const userName = (userResult.Item?.name as string | undefined) ?? userEmail;

    const eventItem = eventResult.Item;
    const eventInfo: EventInfo = {
      eventId: eventItem.eventId as string,
      title: eventItem.title as string,
      description: eventItem.description as string,
      eventDate: eventItem.eventDate as string,
      venue: eventItem.venue as VenueInfo,
      contactInfo: eventItem.contactInfo as ContactInfo,
      organizerId: eventItem.organizerId as string,
    };

    const attendeeInfo: AttendeeInfo = {
      userId,
      name: userName,
      email: userEmail,
    };

    const ticket = buildDigitalTicket(
      registration.registrationId as string,
      eventInfo,
      attendeeInfo,
      registration.qrCode as string,
      registration.status as string,
      registration.createdAt as string,
      registration.checkedInAt as string | undefined
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(ticket),
    };
  } catch (error: unknown) {
    console.error('Get registration error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching registration',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
