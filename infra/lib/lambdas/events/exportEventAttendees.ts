import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;
const REGISTRATIONS_TABLE_NAME = process.env.REGISTRATIONS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data: Array<Record<string, string>>): string {
  if (data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');

  // Convert each row to CSV
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escape values that contain commas, quotes, or newlines
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

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
            message: 'Only the event organizer can export attendees',
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

    // Fetch user details for each registration and prepare export data
    const attendeeData = await Promise.all(
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
          'Registration ID': registration.registrationId,
          'Name': userResult.Item?.name ?? 'Unknown',
          'Email': userResult.Item?.email ?? 'Unknown',
          'Status': registration.status,
          'Registered At': registration.createdAt,
          'Checked In At': registration.checkedInAt ?? 'Not checked in',
        };
      })
    );

    // Convert to CSV
    const csvContent = convertToCSV(attendeeData);

    // Generate filename with event title and date
    const eventTitle = eventResult.Item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${eventTitle}_attendees_${timestamp}.csv`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
      body: csvContent,
    };
  } catch (error: unknown) {
    console.error('Export event attendees error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while exporting event attendees',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
