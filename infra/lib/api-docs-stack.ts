import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiDocsStackProps extends cdk.StackProps {
  restApiId: string;
  stageName: string;
  websiteBucketName: string;
}

export class ApiDocsStack extends cdk.Stack {
  public readonly specKey: string = 'swagger/openapi.json';

  constructor(scope: Construct, id: string, props: ApiDocsStackProps) {
    super(scope, id, props);

    const exportSpecFunction = new NodejsFunction(this, 'ExportSpecFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/api-docs/exportSpec.ts'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
    });

    exportSpecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['apigateway:GET'],
        resources: [
          `arn:aws:apigateway:${this.region}::/restapis/${props.restApiId}/*`,
        ],
      })
    );

    exportSpecFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [`arn:aws:s3:::${props.websiteBucketName}/*`],
      })
    );

    const provider = new cr.Provider(this, 'ExportSpecProvider', {
      onEventHandler: exportSpecFunction,
    });

    new cdk.CustomResource(this, 'SpecExporter', {
      serviceToken: provider.serviceToken,
      properties: {
        RestApiId: props.restApiId,
        StageName: props.stageName,
        BucketName: props.websiteBucketName,
        SpecKey: this.specKey,
        Timestamp: Date.now().toString(),
      },
    });

    new cdk.CfnOutput(this, 'OpenApiSpecUrl', {
      value: `https://${props.websiteBucketName}.s3.${this.region}.amazonaws.com/${this.specKey}`,
      description: 'OpenAPI Specification URL',
    });

    new cdk.CfnOutput(this, 'SwaggerUIUrl', {
      value: 'Available at /swagger on the CloudFront distribution',
      description: 'Swagger UI URL',
    });
  }
}
