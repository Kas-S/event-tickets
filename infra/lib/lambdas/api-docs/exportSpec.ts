import { APIGatewayClient, GetExportCommand } from '@aws-sdk/client-api-gateway';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse } from 'aws-lambda';

const apiGateway = new APIGatewayClient({});
const s3 = new S3Client({});

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: {
    [path: string]: {
      [method: string]: {
        tags?: string[];
        [key: string]: unknown;
      };
    };
  };
  tags?: Array<{
    name: string;
    description: string;
  }>;
  [key: string]: unknown;
}

function addTagsToSpec(specContent: Uint8Array): string {
  const specString = new TextDecoder().decode(specContent);
  const spec: OpenAPISpec = JSON.parse(specString);

  // Define tag metadata
  spec.tags = [
    {
      name: 'Authentication',
      description: 'User registration and login endpoints',
    },
    {
      name: 'Events',
      description: 'Event creation, management, and discovery',
    },
    {
      name: 'Registrations',
      description: 'Event registration and ticket management',
    },
    {
      name: 'Attendees',
      description: 'Attendee management for event organizers',
    },
    {
      name: 'Uploads',
      description: 'File upload utilities for cover photos',
    },
  ];

  // Add tags to each endpoint based on path
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation === 'object' && operation !== null) {
        // Authentication endpoints
        if (path.startsWith('/auth/')) {
          operation.tags = ['Authentication'];
        }
        // Attendee management endpoints
        else if (path.includes('/attendees')) {
          operation.tags = ['Attendees'];
        }
        // Registration endpoints
        else if (path.startsWith('/registrations/') || path.endsWith('/register')) {
          operation.tags = ['Registrations'];
        }
        // Upload endpoints
        else if (path.startsWith('/uploads/')) {
          operation.tags = ['Uploads'];
        }
        // Event endpoints (default for /events paths)
        else if (path.startsWith('/events')) {
          operation.tags = ['Events'];
        }
      }
    }
  }

  return JSON.stringify(spec, null, 2);
}

interface ResourceProperties {
  RestApiId: string;
  StageName: string;
  BucketName: string;
  SpecKey: string;
}

export const handler = async (event: CloudFormationCustomResourceEvent): Promise<CloudFormationCustomResourceResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const props = event.ResourceProperties as unknown as ResourceProperties;
  const { RestApiId, StageName, BucketName, SpecKey } = props;
  
  const physicalResourceId = event.RequestType === 'Create' 
    ? 'api-spec-exporter' 
    : event.PhysicalResourceId;

  try {
    if (event.RequestType === 'Delete') {
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
      };
    }

    // Export OpenAPI spec from API Gateway
    const exportCommand = new GetExportCommand({
      restApiId: RestApiId,
      stageName: StageName,
      exportType: 'oas30',
      accepts: 'application/json',
    });

    const exportResponse = await apiGateway.send(exportCommand);
    const specContent = exportResponse.body;

    if (!specContent) {
      throw new Error('Failed to export OpenAPI spec');
    }

    // Add tags to the spec
    const enhancedSpec = addTagsToSpec(specContent);

    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: BucketName,
      Key: SpecKey,
      Body: enhancedSpec,
      ContentType: 'application/json',
      CacheControl: 'no-cache',
    });

    await s3.send(putCommand);

    console.log(`Successfully exported OpenAPI spec to s3://${BucketName}/${SpecKey}`);

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        SpecUrl: `https://${BucketName}.s3.amazonaws.com/${SpecKey}`,
      },
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    };
  }
};
