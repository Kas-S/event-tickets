# Event Ticketing System - Infrastructure

This directory contains the AWS CDK infrastructure code for the Event Ticketing System. The infrastructure is organized into separate stacks for modularity and maintainability.

## Architecture Overview

The infrastructure consists of the following stacks:

- **DatabaseStack**: DynamoDB tables for Users, Events, and Registrations with GSIs
- **AuthStack**: Cognito User Pool for authentication with JWT tokens
- **EmailStack**: SES configuration for transactional emails
- **FrontendStack**: S3 buckets for frontend hosting and cover photos, CloudFront distribution
- **ApiStack**: API Gateway with Cognito authorizer and REST endpoints

## Prerequisites

1. AWS CLI configured with credentials
2. Node.js 18+ and npm installed
3. AWS CDK CLI installed: `npm install -g aws-cdk`

## NPM Scripts

See [NPM_SCRIPTS.md](./NPM_SCRIPTS.md) for detailed documentation on available scripts.

**Quick Reference**:
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Auto-compile on file changes
- `npm run clean` - Remove compiled .js and .d.ts files
- `npm run clean:verify` - Build and verify, then cleanup
- `npm test` - Run unit tests
- `npm run cdk -- <command>` - Run CDK commands

## Configuration

### Verified Sender Email

Before deploying, configure your verified sender email for SES:

**Option 1: Update cdk.json**
```json
{
  "context": {
    "verifiedSenderEmail": "your-email@example.com"
  }
}
```

**Option 2: Environment Variable**
```bash
export VERIFIED_SENDER_EMAIL="your-email@example.com"
```

**Option 3: CDK Context Parameter**
```bash
npx cdk deploy -c verifiedSenderEmail=your-email@example.com
```

### Email Verification

After deployment, you must verify the sender email in the AWS SES Console:
1. Go to AWS SES Console
2. Navigate to "Verified identities"
3. Find your email address
4. Click the verification link sent to your email

## Deployment

### First Time Setup

1. Install dependencies:
```bash
npm install
```

2. Bootstrap CDK (one-time per AWS account/region):
```bash
npx cdk bootstrap
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Review the CloudFormation template:
```bash
npx cdk synth
```

5. Deploy all stacks:
```bash
npx cdk deploy --all
```

### Subsequent Deployments

```bash
npm run build
npx cdk deploy --all
```

### Frontend Deployment

The FrontendStack automatically deploys your React application from `../frontend/dist` to S3 and invalidates the CloudFront cache.

**Before deploying infrastructure:**
```bash
# Build the frontend first
cd ../frontend
npm run build

# Then deploy infrastructure (which will upload the dist folder)
cd ../infra
npm run build
npx cdk deploy EventTicketingStack/FrontendStack
```

**Note**: The `frontend/dist` folder must exist before deploying the FrontendStack, otherwise the deployment will fail.

## Stack Outputs

After deployment, the following outputs will be available:

- **API Gateway URL**: Base URL for API endpoints
- **CloudFront Distribution URL**: Frontend website URL
- **Cognito User Pool ID**: For frontend authentication configuration
- **DynamoDB Table Names**: For Lambda function configuration
- **S3 Bucket Names**: For frontend deployment and photo uploads

## Development

### Watch Mode

For active development, use watch mode to automatically compile TypeScript:
```bash
npm run watch
```

### Testing

Run unit tests:
```bash
npm test
```

## Useful CDK Commands

* `npm run build`   - Compile TypeScript to JavaScript
* `npm run watch`   - Watch for changes and compile
* `npm run test`    - Run Jest unit tests
* `npx cdk deploy`  - Deploy stacks to AWS
* `npx cdk diff`    - Compare deployed stack with current state
* `npx cdk synth`   - Emit synthesized CloudFormation template
* `npx cdk destroy` - Remove all stacks from AWS

## Cost Optimization

All resources are configured to stay within AWS Free Tier limits:

- DynamoDB: Pay-per-request billing mode
- Lambda: Included in free tier (1M requests/month)
- S3: Standard storage class
- CloudFront: 1TB data transfer/month free
- Cognito: 50,000 MAUs free
- SES: 62,000 emails/month free (when sending from EC2)

## Security

- All S3 buckets have encryption enabled
- DynamoDB tables use AWS-managed encryption
- CloudFront enforces HTTPS
- API Gateway uses Cognito authorizer for protected endpoints
- IAM roles follow least privilege principle

## Cleanup

To remove all infrastructure:
```bash
npx cdk destroy --all
```

Note: S3 buckets and DynamoDB tables have `RETAIN` removal policy to prevent accidental data loss. You must manually delete them from the AWS Console if needed.
