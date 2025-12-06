import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { buildDigitalTicket, EventInfo, AttendeeInfo, VenueInfo, ContactInfo } from '../shared/ticketUtils';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const REGISTRATIONS_TABLE_NAME = process.env.REGISTRATIONS_TABLE_NAME!;
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
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

    const registrationsResult = await dynamoClient.send(
      new QueryCommand({
        TableName: REGISTRATIONS_TABLE_NAME,
        IndexName: 'UserRegistrationIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Sort by createdAt descending (newest first)
      })
    );

    if (!registrationsResult.Items || registrationsResult.Items.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          registrations: [],
          count: 0,
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

    const tickets = await Promise.all(
      registrationsResult.Items.map(async (registration) => {
        try {
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
            console.error(`Event not found for registration ${registration.registrationId}`);
            return null;
          }

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

          return buildDigitalTicket(
            registration.registrationId as string,
            eventInfo,
            attendeeInfo,
            registration.qrCode as string,
            registration.status as string,
            registration.createdAt as string,
            registration.checkedInAt as string | undefined
          );
        } catch (error) {
          console.error(`Error fetching event for registration ${registration.registrationId}:`, error);
          return null;
        }
      })
    );

    const validTickets = tickets.filter(ticket => ticket !== null);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        registrations: validTickets,
        count: validTickets.length,
      }),
    };
  } catch (error: unknown) {
    console.error('Get user registrations error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching registrations',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
