import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { buildDigitalTicket, formatTicketForEmail, EventInfo, AttendeeInfo } from '../shared/ticketUtils';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sesClient = new SESClient({});
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME!;
const REGISTRATIONS_TABLE_NAME = process.env.REGISTRATIONS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const SENDER_EMAIL = process.env.SENDER_EMAIL!;

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

    // Get the event to check capacity
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

    const eventItem = eventResult.Item;

    if (eventItem.status !== 'published') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'EVENT_NOT_PUBLISHED',
            message: 'Cannot register for unpublished events',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Check if already at capacity
    if (eventItem.registeredCount >= eventItem.capacity) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'EVENT_AT_CAPACITY',
            message: 'Event has reached maximum capacity',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const registrationId = randomUUID();
    const now = new Date().toISOString();

    const qrCodeData = registrationId;
    let qrCodeBase64: string;
    try {
      qrCodeBase64 = await QRCode.toDataURL(qrCodeData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
      });
    } catch (qrError) {
      console.error('QR code generation error:', qrError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'QR_GENERATION_ERROR',
            message: 'Failed to generate QR code',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    // Use a transaction to atomically:
    // 1. Create the registration
    // 2. Increment the event's registeredCount (with capacity check)
    try {
      await dynamoClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: REGISTRATIONS_TABLE_NAME,
                Item: {
                  PK: `REG#${registrationId}`,
                  SK: 'DETAILS',
                  registrationId,
                  eventId,
                  userId,
                  qrCode: qrCodeBase64,
                  qrCodeData: qrCodeData,
                  status: 'active',
                  createdAt: now,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Update: {
                TableName: EVENTS_TABLE_NAME,
                Key: {
                  PK: `EVENT#${eventId}`,
                  SK: 'METADATA',
                },
                UpdateExpression: 'SET registeredCount = registeredCount + :inc',
                ConditionExpression: 'registeredCount < #capacity',
                ExpressionAttributeNames: {
                  '#capacity': 'capacity',
                },
                ExpressionAttributeValues: {
                  ':inc': 1,
                },
              },
            },
          ],
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TransactionCanceledException') {
        return {
          statusCode: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              code: 'EVENT_AT_CAPACITY',
              message: 'Event has reached maximum capacity',
              requestId: event.requestContext.requestId,
            },
          }),
        };
      }
      throw error;
    }

    let userEmail = '';
    let userName = '';
    try {
      const userResult = await dynamoClient.send(
        new GetCommand({
          TableName: USERS_TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
          },
        })
      );

      if (userResult.Item) {
        userEmail = (userResult.Item.email as string | undefined) ?? '';
        userName = (userResult.Item.name as string | undefined) ?? userEmail;
      }
    } catch (userError) {
      console.error('Error fetching user details:', userError);
    }

    if (userEmail) {
      const eventInfo: EventInfo = {
        eventId: eventItem.eventId,
        title: eventItem.title,
        description: eventItem.description,
        eventDate: eventItem.eventDate,
        venue: eventItem.venue,
        contactInfo: eventItem.contactInfo,
        organizerId: eventItem.organizerId,
      };

      const attendeeInfo: AttendeeInfo = {
        userId,
        name: userName,
        email: userEmail,
      };

      const ticket = buildDigitalTicket(
        registrationId,
        eventInfo,
        attendeeInfo,
        qrCodeBase64,
        'active',
        now
      );

      const emailHtml = formatTicketForEmail(ticket);

      let emailSent = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!emailSent && retryCount < maxRetries) {
        try {
          await sesClient.send(
            new SendEmailCommand({
              Source: SENDER_EMAIL,
              Destination: {
                ToAddresses: [userEmail],
              },
              Message: {
                Subject: {
                  Data: `Your Ticket for ${eventItem.title}`,
                  Charset: 'UTF-8',
                },
                Body: {
                  Html: {
                    Data: emailHtml,
                    Charset: 'UTF-8',
                  },
                },
              },
            })
          );
          emailSent = true;
          console.log(`Ticket email sent successfully to ${userEmail}`);
        } catch (emailError) {
          retryCount++;
          console.error(`Email send attempt ${retryCount} failed:`, emailError);
          
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
          } else {
            console.error('Failed to send ticket email after all retries');
          }
        }
      }
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        registrationId,
        eventId,
        userId,
        qrCode: qrCodeBase64,
        status: 'active',
        createdAt: now,
        message: 'Successfully registered for event',
      }),
    };
  } catch (error: unknown) {
    console.error('Registration error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing registration',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
