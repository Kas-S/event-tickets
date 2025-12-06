# Project Structure

## Repository Layout

```
event-ticketing-system/
├── frontend/              # React application
├── infra/                # AWS CDK infrastructure
├── .kiro/                # Kiro configuration and specs
├── package.json          # Root workspace scripts
└── README.md             # Project documentation
```

## Frontend Structure

```
frontend/
├── src/
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   ├── index.css         # Global styles
│   └── assets/           # Static assets (images, icons)
├── public/
│   ├── swagger/          # Swagger UI for API docs
│   └── vite.svg          # Public assets
├── dist/                 # Production build output (generated)
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Frontend dependencies
```

## Infrastructure Structure

```
infra/
├── lib/
│   ├── infra-stack.ts         # Main orchestration stack
│   ├── api-stack.ts           # API Gateway + Lambda functions
│   ├── auth-stack.ts          # Cognito User Pool
│   ├── database-stack.ts      # DynamoDB tables
│   ├── frontend-stack.ts      # S3 + CloudFront
│   ├── api-docs-stack.ts      # Swagger documentation
│   ├── email-stack.ts         # SES configuration
│   └── lambdas/               # Lambda function code
│       ├── auth/              # Authentication handlers
│       │   ├── login.ts
│       │   └── register.ts
│       ├── events/            # Event management handlers
│       │   ├── createEvent.ts
│       │   ├── getEvent.ts
│       │   ├── updateEvent.ts
│       │   ├── deleteEvent.ts
│       │   └── listEvents.ts
│       ├── uploads/           # File upload handlers
│       │   └── generatePresignedUrl.ts
│       └── api-docs/          # API documentation
│           └── exportSpec.ts
├── bin/
│   └── infra.ts              # CDK app entry point
├── test/                     # Infrastructure tests
├── scripts/                  # Deployment scripts
├── cdk.out/                  # CDK synthesis output (generated)
├── cdk.json                  # CDK configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Infrastructure dependencies
```

## Architecture Patterns

### Stack Organization

- **Modular Stacks**: Each AWS service group in separate stack (auth, database, api, frontend)
- **Main Stack**: `InfraStack` orchestrates all sub-stacks and passes resources between them
- **Stack Dependencies**: Resources passed via constructor props (e.g., userPoolId to ApiStack)

### Lambda Organization

- **One Function Per File**: Each Lambda handler in separate TypeScript file
- **Domain Grouping**: Functions organized by domain (auth, events, uploads)
- **Handler Pattern**: Export `handler` function with AWS Lambda signature
- **Shared Code**: Common utilities can be imported (not yet implemented)

### DynamoDB Design

- **Single Table Design**: Uses PK/SK pattern for flexible access patterns
- **Partition Keys**: Format `ENTITY#ID` (e.g., `USER#uuid`, `EVENT#uuid`)
- **Sort Keys**: `METADATA` for main records, other patterns for relationships
- **GSIs**: Global Secondary Indexes for alternate query patterns
  - `EmailIndex`: Query users by email
  - `OrganizerIndex`: Query events by organizer
  - `StatusDateIndex`: Query events by status and date

### API Structure

- **RESTful Design**: Resource-based endpoints (`/events`, `/auth`, `/registrations`)
- **Cognito Authorizer**: Protected endpoints use Cognito JWT validation
- **CORS Enabled**: All endpoints configured for cross-origin requests
- **Lambda Integration**: Each endpoint backed by dedicated Lambda function

### Error Handling

- **Consistent Format**: All errors return structured JSON with code, message, details
- **HTTP Status Codes**: Proper use of 400, 401, 403, 404, 409, 500
- **Type Guards**: TypeScript type guards for runtime validation
- **Request Validation**: Input validation before processing

### TypeScript Conventions

- **Strict Mode**: TypeScript strict mode enabled
- **Interfaces**: Define interfaces for all data structures
- **Type Guards**: Runtime type checking with type guard functions
- **No Any**: Avoid `any` type, use `unknown` with type guards
- **Explicit Types**: Function parameters and returns explicitly typed

## Configuration Files

- **Root**: `package.json` - Workspace orchestration scripts
- **Frontend**: `vite.config.ts`, `tsconfig.json`, `eslint.config.js`
- **Infrastructure**: `cdk.json`, `tsconfig.json`, `eslint.config.mjs`, `jest.config.js`
- **Kiro**: `.kiro/specs/` - Feature specifications and design documents

## Build Artifacts

- `frontend/dist/` - Production frontend bundle (deployed to S3)
- `infra/cdk.out/` - CloudFormation templates (deployed to AWS)
- `infra/lib/**/*.js` - Compiled TypeScript (temporary, cleaned after deploy)
- `infra/lib/**/*.d.ts` - TypeScript declarations (temporary, cleaned after deploy)

## Naming Conventions

- **Stacks**: PascalCase with "Stack" suffix (e.g., `AuthStack`, `ApiStack`)
- **Lambda Functions**: camelCase with "Function" suffix (e.g., `loginFunction`)
- **DynamoDB Tables**: PascalCase with "Table" suffix (e.g., `usersTable`)
- **Files**: camelCase for TypeScript files, kebab-case for config files
- **Interfaces**: PascalCase (e.g., `CreateEventRequest`, `UserRecord`)
