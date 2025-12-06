import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({}) as S3Client;
const COVER_PHOTO_BUCKET = process.env.COVER_PHOTO_BUCKET!;

interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
}

function isPresignedUrlRequest(data: unknown): data is PresignedUrlRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'fileName' in data &&
    'fileType' in data &&
    typeof (data as PresignedUrlRequest).fileName === 'string' &&
    typeof (data as PresignedUrlRequest).fileType === 'string'
  );
}

function validateFileType(fileType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  return allowedTypes.includes(fileType.toLowerCase());
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const organizerId = event.requestContext.authorizer?.claims?.sub as string | undefined;
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
    
    if (!isPresignedUrlRequest(parsedBody)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request must include fileName and fileType',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    if (!validateFileType(parsedBody.fileType)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'File type must be a valid image format (jpeg, jpg, png, gif, webp)',
            requestId: event.requestContext.requestId,
          },
        }),
      };
    }

    const fileExtension = parsedBody.fileName.split('.').pop() ?? 'jpg';
    const uniqueFileName = `${organizerId}/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: COVER_PHOTO_BUCKET,
      Key: uniqueFileName,
      ContentType: parsedBody.fileType,
    }) as PutObjectCommand;

    const presignedUrl = (await getSignedUrl(s3Client, command, {
      expiresIn: 900,
    })) as string;

    const publicUrl = `https://${COVER_PHOTO_BUCKET}.s3.amazonaws.com/${uniqueFileName}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        publicUrl: publicUrl,
        fileKey: uniqueFileName,
        expiresIn: 900,
      }),
    };
  } catch (error: unknown) {
    console.error('Generate presigned URL error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while generating the upload URL',
          requestId: event.requestContext.requestId,
        },
      }),
    };
  }
};
