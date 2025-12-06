# Technology Stack

## Frontend

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Hosting**: S3 + CloudFront CDN
- **Styling**: Ant Design Components with CSS (standard)
- **Linting**: ESLint 9 with TypeScript support

## Backend

- **Runtime**: Node.js 20.x
- **API**: AWS API Gateway (REST)
- **Compute**: AWS Lambda functions
- **Language**: TypeScript 5.6+
- **Bundler**: esbuild (via aws-lambda-nodejs)

## Infrastructure

- **IaC**: AWS CDK 2.214.0 with TypeScript
- **Database**: DynamoDB (NoSQL)
- **Authentication**: Amazon Cognito User Pools
- **Email**: Amazon SES
- **Storage**: S3 (cover photos and static assets)
- **CDN**: CloudFront

## AWS SDK

- `@aws-sdk/client-cognito-identity-provider` - User authentication
- `@aws-sdk/client-dynamodb` & `@aws-sdk/lib-dynamodb` - Database operations
- `@aws-sdk/client-s3` & `@aws-sdk/s3-request-presigner` - File uploads
- `@aws-sdk/client-api-gateway` - API documentation export

## Testing

- **Unit Tests**: Jest 29 with ts-jest
- **Property-Based Tests**: fast-check 3
- **Frontend Tests**: React Testing Library (planned)
- **E2E Tests**: Playwright (planned)

## Development Tools

- **TypeScript**: 5.6+ for type safety
- **ESLint**: Code quality and consistency
- **LocalStack**: Local AWS service emulation (planned)

## Common Commands

### Root Workspace

```bash
# Install all dependencies (root, frontend, infra)
npm run install:all

# Build everything
npm run build

# Deploy everything to AWS
npm run deploy

# Deploy only frontend
npm run deploy:frontend

# Deploy only infrastructure
npm run deploy:infra

# Clean build artifacts
npm run clean
```

### Frontend

```bash
cd frontend

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Infrastructure

```bash
cd infra

# Compile TypeScript
npm run build

# Watch mode for development
npm run watch

# Run tests
npm run test

# Deploy all stacks
npx cdk deploy --all

# Deploy specific stack
npx cdk deploy EventTicketingStack/ApiStack

# Synthesize CloudFormation
npx cdk synth

# View differences
npx cdk diff

# Clean compiled files
npm run clean

# Lint code
npm run lint
npm run lint:fix
```

## Build System

- **Monorepo**: Root package.json orchestrates frontend and infra builds
- **TypeScript Compilation**: `tsc` for infrastructure, Vite for frontend
- **Lambda Bundling**: Automatic via NodejsFunction construct with esbuild
- **Frontend Bundling**: Vite produces optimized production bundle in `frontend/dist`

## Environment Configuration

- **CDK Context**: Configure in `infra/cdk.json` (e.g., verified SES email)
- **Lambda Environment Variables**: Set via CDK stack definitions
- **Frontend Environment**: Build-time configuration via Vite

## AWS Free Tier Considerations

All services configured to stay within Free Tier limits:
- DynamoDB: Provisioned capacity (3 RCU/WCU)
- Lambda: 1M requests/month, 400K GB-seconds
- API Gateway: 1M requests/month
- S3: 5GB storage, 20K GET requests
- CloudFront: 1TB data transfer out
