# Design Document

## Overview

The Event Ticketing System is a serverless web application built on AWS infrastructure that enables event organizers to create and manage events while allowing attendees to discover, register, and receive digital tickets. The system follows a three-tier architecture with a React-based frontend, API Gateway with Lambda functions for the backend, and DynamoDB for data persistence. All components are designed to operate within AWS Free Tier limits.

The architecture emphasizes scalability, cost-effectiveness, and security through AWS managed services. Authentication is handled via Amazon Cognito, file storage uses S3, email delivery leverages SES, and QR code generation is performed server-side to ensure uniqueness and security.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront CDN                          │
│                    (Frontend Distribution)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      S3 Bucket (Static)                         │
│                    React Application Bundle                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (REST)                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├──────────────┬──────────────┬──────────────┬────────
             ▼              ▼              ▼              ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
      │ Lambda:  │   │ Lambda:  │   │ Lambda:  │   │ Lambda:  │
      │  Auth    │   │  Events  │   │  Tickets │   │  Email   │
      └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
           │              │              │              │
           └──────────────┴──────────────┴──────────────┘
                          │
                          ▼
           ┌──────────────────────────────────┐
           │         DynamoDB Tables          │
           │  - Users                         │
           │  - Events                        │
           │  - Registrations                 │
           └──────────────────────────────────┘

           ┌──────────────────────────────────┐
           │      Amazon Cognito              │
           │   (User Pool & Identity)         │
           └──────────────────────────────────┘

           ┌──────────────────────────────────┐
           │      Amazon SES                  │
           │   (Email Delivery)               │
           └──────────────────────────────────┘

           ┌──────────────────────────────────┐
           │      S3 Bucket (Images)          │
           │   (Event Cover Photos)           │
           └──────────────────────────────────┘
```

### Component Responsibilities

**Frontend (React + TypeScript)**
- User interface for event browsing, creation, and registration
- Authentication flow integration with Cognito
- QR code display for digital tickets
- Responsive design for mobile and desktop
- Client-side form validation

**API Gateway**
- RESTful API endpoint routing
- Request/response transformation
- CORS configuration
- Integration with Cognito authorizer
- Request throttling and rate limiting

**Lambda Functions**
- Stateless compute for business logic
- Separate functions per domain (auth, events, tickets, notifications)
- Integration with DynamoDB for data operations
- QR code generation using libraries
- Email composition and SES integration

**DynamoDB**
- NoSQL data storage with single-table design
- Partition keys optimized for access patterns
- Global Secondary Indexes for queries
- Conditional writes for capacity enforcement
- Point-in-time recovery enabled

**Cognito**
- User authentication and authorization
- JWT token generation and validation
- User pool for email/password authentication
- User attributes for profile information

**S3**
- Static website hosting for React bundle
- Event cover photo storage with presigned URLs
- Versioning enabled for frontend deployments

**CloudFront**
- Global content delivery for frontend
- HTTPS enforcement
- Caching strategy for static assets
- Origin access identity for S3 security

**SES**
- Transactional email delivery
- Template-based emails for tickets and notifications
- Bounce and complaint handling
- Sandbox mode for development, production mode for deployment

## Components and Interfaces

### Frontend Components

**Pages**
- `HomePage`: Landing page with event listings and search
- `EventDetailsPage`: Detailed view of a single event
- `CreateEventPage`: Form for organizers to create events
- `OrganizerDashboardPage`: Event management and attendee lists
- `MyTicketsPage`: User's registered events and digital tickets
- `LoginPage`: Authentication interface
- `RegisterPage`: User account creation

**Shared Components**
- `EventCard`: Reusable event display component
- `TicketDisplay`: QR code and ticket information renderer
- `SearchBar`: Event search input with filtering
- `AttendeeList`: Table of registered attendees
- `CapacityIndicator`: Visual representation of event capacity

**Services**
- `apiClient`: Axios-based HTTP client with auth interceptors
- `authService`: Cognito integration for login/logout/register
- `eventService`: API calls for event CRUD operations
- `ticketService`: Registration and ticket retrieval
- `storageService`: S3 presigned URL generation for uploads

### Backend API Endpoints

**Authentication Endpoints** (Lambda: auth-handler)
- `POST /auth/register` - Create new user account
- `POST /auth/login` - Authenticate user and return tokens
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user profile

**Event Endpoints** (Lambda: event-handler)
- `POST /events` - Create new event (organizer only)
- `GET /events` - List all published events with pagination
- `GET /events/{eventId}` - Get event details
- `PUT /events/{eventId}` - Update event (organizer only)
- `DELETE /events/{eventId}` - Delete event (organizer only)
- `GET /events/search?q={query}` - Search events by title/description
- `GET /events/{eventId}/attendees` - List attendees (organizer only)

**Registration Endpoints** (Lambda: ticket-handler)
- `POST /events/{eventId}/register` - Register for event
- `GET /registrations/me` - Get user's registrations
- `GET /registrations/{registrationId}` - Get specific registration with ticket
- `POST /registrations/{registrationId}/validate` - Validate QR code at check-in

**Notification Endpoints** (Lambda: notification-handler)
- `POST /events/{eventId}/notify` - Send update email to all attendees

**Upload Endpoints** (Lambda: upload-handler)
- `POST /uploads/presigned-url` - Generate presigned URL for cover photo upload

### Data Models

**User Table** (DynamoDB)
```typescript
interface User {
  PK: string;              // "USER#{userId}"
  SK: string;              // "PROFILE"
  userId: string;          // UUID
  email: string;           // Unique email address
  cognitoId: string;       // Cognito user sub
  name: string;            // User display name
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}

// GSI: EmailIndex
// PK: email, SK: userId
```

**Event Table** (DynamoDB)
```typescript
interface Event {
  PK: string;              // "EVENT#{eventId}"
  SK: string;              // "METADATA"
  eventId: string;         // UUID
  organizerId: string;     // Reference to User.userId
  title: string;           // Event title
  description: string;     // Event description
  coverPhotoUrl: string;   // S3 URL for cover image
  eventDate: string;       // ISO 8601 timestamp
  venue: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contactInfo: {
    email: string;
    phone?: string;
  };
  capacity: number;        // Maximum attendees
  registeredCount: number; // Current registration count
  status: 'draft' | 'published' | 'cancelled';
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}

// GSI: OrganizerIndex
// PK: organizerId, SK: eventDate

// GSI: StatusDateIndex
// PK: status, SK: eventDate
```

**Registration Table** (DynamoDB)
```typescript
interface Registration {
  PK: string;              // "REG#{registrationId}"
  SK: string;              // "DETAILS"
  registrationId: string;  // UUID
  eventId: string;         // Reference to Event.eventId
  userId: string;          // Reference to User.userId
  qrCode: string;          // Base64 encoded QR code image
  qrCodeData: string;      // Raw data encoded in QR (registrationId)
  status: 'active' | 'cancelled' | 'checked-in';
  checkedInAt?: string;    // ISO 8601 timestamp
  createdAt: string;       // ISO 8601 timestamp
}

// GSI: UserRegistrationIndex
// PK: userId, SK: createdAt

// GSI: EventRegistrationIndex
// PK: eventId, SK: createdAt
```

### API Request/Response Schemas

**Create Event Request**
```typescript
interface CreateEventRequest {
  title: string;
  description: string;
  coverPhotoUrl: string;
  eventDate: string;       // ISO 8601
  venue: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contactInfo: {
    email: string;
    phone?: string;
  };
  capacity: number;
}
```

**Event Response**
```typescript
interface EventResponse {
  eventId: string;
  organizerId: string;
  organizerName: string;
  title: string;
  description: string;
  coverPhotoUrl: string;
  eventDate: string;
  venue: VenueInfo;
  contactInfo: ContactInfo;
  capacity: number;
  registeredCount: number;
  availableSpots: number;
  isFull: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}
```

**Register for Event Request**
```typescript
interface RegisterRequest {
  eventId: string;
}
```

**Ticket Response**
```typescript
interface TicketResponse {
  registrationId: string;
  event: EventResponse;
  attendee: {
    userId: string;
    name: string;
    email: string;
  };
  qrCode: string;          // Base64 data URL
  status: string;
  registeredAt: string;
  checkedInAt?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### User Authentication Properties

**Property 1: User registration creates unique accounts**
*For any* valid email and password combination not already in the system, submitting a registration form should create a new user account with a unique identifier.
**Validates: Requirements 1.1**

**Property 2: Duplicate email rejection**
*For any* email address already registered in the system, attempting to register with that email should be rejected with an error message.
**Validates: Requirements 1.2**

**Property 3: Valid credentials grant access**
*For any* registered user with correct credentials, submitting login credentials should authenticate successfully and grant platform access.
**Validates: Requirements 1.3**

**Property 4: Email as unique identifier**
*For any* created user account, querying by the user's email address should return that exact user account.
**Validates: Requirements 1.4**

**Property 5: Authentication token issuance**
*For any* successful login, the system should issue a valid authentication token that can be used for subsequent authenticated requests.
**Validates: Requirements 1.5**

### Event Management Properties

**Property 6: Event creation persists all fields**
*For any* valid event data submitted by an organizer, creating an event should persist all fields (title, description, cover photo URL, event date, venue details, contact information) and make them retrievable.
**Validates: Requirements 2.1**

**Property 7: Published events are publicly visible**
*For any* event with status 'published', the event should appear in the public event listing accessible to all attendees.
**Validates: Requirements 2.2**

**Property 8: Cover photo storage and association**
*For any* uploaded cover photo, the image should be stored and the resulting URL should be associated with and retrievable from the event record.
**Validates: Requirements 2.3**

**Property 9: Invalid event data rejection**
*For any* event submission with missing required fields or invalid data (e.g., past dates, negative capacity), the system should reject the creation and return validation errors.
**Validates: Requirements 2.4**

**Property 10: Event updates persist changes**
*For any* existing event, updating any field should persist the changes such that subsequent retrieval returns the updated values.
**Validates: Requirements 2.5**

### Capacity Management Properties

**Property 11: Capacity value storage**
*For any* event created with a maximum capacity value, that capacity should be stored and retrievable from the event record.
**Validates: Requirements 3.1**

**Property 12: Capacity enforcement prevents over-registration**
*For any* event where the number of active registrations equals the maximum capacity, additional registration attempts should be rejected with a capacity-reached message.
**Validates: Requirements 3.2, 3.3**

**Property 13: Registration count accuracy**
*For any* event, the displayed registration count should equal the actual number of active registrations for that event.
**Validates: Requirements 3.4**

**Property 14: Concurrent registration safety**
*For any* event with limited remaining capacity, concurrent registration attempts should not result in total registrations exceeding the maximum capacity.
**Validates: Requirements 3.5**

### Registration and Ticketing Properties

**Property 15: Registration creates linked record**
*For any* authenticated attendee registering for an available event, a registration record should be created that links the user ID to the event ID.
**Validates: Requirements 4.1**

**Property 16: QR code uniqueness**
*For any* two different registrations, the generated QR codes should be unique and contain different registration identifiers.
**Validates: Requirements 4.2**

**Property 17: Ticket completeness**
*For any* generated digital ticket, it should include event details, attendee information (name, email), and a unique QR code.
**Validates: Requirements 4.3**

**Property 18: Ticket email delivery**
*For any* completed registration, an email containing the digital ticket should be sent to the attendee's registered email address.
**Validates: Requirements 4.4**

**Property 19: User ticket retrieval**
*For any* user, querying their registrations should return all their active registrations with complete ticket information including QR codes.
**Validates: Requirements 4.5**

### Event Discovery Properties

**Property 20: Event listing completeness**
*For any* request to list events, all published events should be returned with title, date, venue, and cover photo information.
**Validates: Requirements 5.1**

**Property 21: Search result relevance**
*For any* search query, all returned events should have the query string present in either the title or description field.
**Validates: Requirements 5.2**

**Property 22: Event detail retrieval**
*For any* valid event ID, requesting event details should return the complete event information including all fields.
**Validates: Requirements 5.3**

**Property 23: Capacity indication in listings**
*For any* event at maximum capacity, the event listing should indicate that the event is full.
**Validates: Requirements 5.4**

**Property 24: Event date sorting**
*For any* event listing response, events should be sorted by event date in ascending chronological order.
**Validates: Requirements 5.5**

### Organizer Dashboard Properties

**Property 25: Organizer event filtering**
*For any* organizer accessing their dashboard, only events created by that organizer should be displayed.
**Validates: Requirements 6.1**

**Property 26: Attendee list completeness**
*For any* event, the attendee list should include all registered attendees with their names and email addresses.
**Validates: Requirements 6.2**

**Property 27: Registration timestamp display**
*For any* attendee in an event's attendee list, their registration timestamp should be included in the displayed information.
**Validates: Requirements 6.4**

**Property 28: Attendee data export**
*For any* event with registrations, the system should be able to generate a downloadable file containing all attendee data.
**Validates: Requirements 6.5**

### Notification Properties

**Property 29: Bulk notification delivery**
*For any* event with registered attendees, triggering a notification should result in emails being sent to all registered attendees for that event.
**Validates: Requirements 7.1**

**Property 30: Notification email content**
*For any* notification email sent, the message body should include the event title, updated event details, and organizer contact information.
**Validates: Requirements 7.2, 7.5**

**Property 31: Notification confirmation**
*For any* completed notification process, the system should return a confirmation response to the event organizer.
**Validates: Requirements 7.3**

### QR Code Validation Properties

**Property 32: QR code validation**
*For any* QR code containing a valid registration identifier, scanning and validating should decode the identifier and verify it exists in the registration database.
**Validates: Requirements 8.1**

**Property 33: Valid QR response completeness**
*For any* valid QR code validation, the response should include attendee name, event details, and current registration status.
**Validates: Requirements 8.2**

**Property 34: Invalid QR rejection**
*For any* QR code containing invalid, malformed, or non-existent registration data, validation should reject it and return an error message.
**Validates: Requirements 8.3**

**Property 35: Check-in status update**
*For any* successful QR code validation, the registration status should be updated to 'checked-in' with the current timestamp.
**Validates: Requirements 8.4**

**Property 36: Duplicate check-in detection**
*For any* registration already in 'checked-in' status, re-scanning the QR code should display the original check-in timestamp and indicate a duplicate scan.
**Validates: Requirements 8.5**

## Error Handling

### Error Categories

**Validation Errors (400 Bad Request)**
- Missing required fields in requests
- Invalid data formats (malformed emails, invalid dates)
- Business rule violations (negative capacity, past event dates)
- Response includes field-specific error messages

**Authentication Errors (401 Unauthorized)**
- Missing or invalid authentication tokens
- Expired tokens
- Unverified email addresses
- Response includes authentication failure reason

**Authorization Errors (403 Forbidden)**
- Attempting to modify events not owned by the user
- Accessing organizer-only endpoints as an attendee
- Response includes permission denial message

**Resource Not Found Errors (404 Not Found)**
- Invalid event IDs
- Invalid registration IDs
- Invalid user IDs
- Response includes resource type and identifier

**Conflict Errors (409 Conflict)**
- Duplicate email registration
- Registering for an event at capacity
- Concurrent modification conflicts
- Response includes conflict reason and current state

**Server Errors (500 Internal Server Error)**
- Database operation failures
- External service failures (SES, S3)
- Unexpected exceptions
- Response includes generic error message (no sensitive details)
- Detailed errors logged to CloudWatch

### Error Response Format

All error responses follow a consistent structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: {             // Optional field-specific details
      field: string;
      issue: string;
    }[];
    requestId: string;      // For support and debugging
  };
}
```

### Retry and Recovery Strategies

**Idempotent Operations**
- Event creation, updates, and deletions use idempotency keys
- Duplicate requests within 24 hours return cached responses
- Prevents duplicate event creation from network retries

**Email Delivery**
- Failed SES calls are retried with exponential backoff (3 attempts)
- Failures logged to CloudWatch for manual review
- Dead letter queue for persistent failures

**Database Operations**
- Conditional writes for capacity enforcement prevent race conditions
- Optimistic locking for event updates using version numbers
- Transaction rollback on any operation failure

**File Uploads**
- Presigned URLs expire after 15 minutes
- Failed uploads require new presigned URL generation
- Orphaned S3 objects cleaned up by lifecycle policy

## Testing Strategy

The Event Ticketing System employs a comprehensive dual testing approach combining unit tests and property-based tests to ensure correctness across all components.

### Unit Testing

**Framework**: Vitest for both frontend and backend
**Coverage Target**: 80% code coverage minimum

**Unit Test Focus Areas**:
- **API Handlers**: Test individual Lambda function handlers with mocked dependencies
  - Example: Test event creation handler with mocked DynamoDB client
  - Example: Test registration handler with mocked SES client
- **Validation Logic**: Test input validation functions with specific valid and invalid inputs
  - Example: Test email format validation with valid/invalid emails
  - Example: Test date validation with past/future dates
- **Business Logic**: Test core functions with specific scenarios
  - Example: Test capacity check with event at 0%, 50%, 100% capacity
  - Example: Test QR code generation with specific registration IDs
- **Error Handling**: Test error cases and edge conditions
  - Example: Test handler behavior when DynamoDB throws errors
  - Example: Test authentication with expired tokens
- **Frontend Components**: Test React components with React Testing Library
  - Example: Test EventCard renders all event information
  - Example: Test registration button disabled when event is full

**Unit Test Organization**:
- Co-locate tests with source files using `.test.ts` or `.test.tsx` suffix
- Use descriptive test names: `describe('createEvent')` → `it('should reject events with past dates')`
- Mock external dependencies (AWS SDK, Cognito, SES)
- Use test fixtures for common data structures

### Property-Based Testing

**Framework**: fast-check (JavaScript/TypeScript property-based testing library)
**Iterations**: Minimum 100 runs per property test

**Property Test Requirements**:
- Each correctness property from the design document MUST be implemented as a property-based test
- Each property test MUST be tagged with a comment referencing the design document
- Tag format: `// Feature: event-ticketing-system, Property {number}: {property_text}`
- Property tests verify universal behaviors across randomly generated inputs

**Property Test Focus Areas**:
- **User Authentication**: Generate random email/password combinations to test registration and login
  - Property 1-5: User account creation, duplicate prevention, authentication
- **Event Management**: Generate random event data to test CRUD operations
  - Property 6-10: Event creation, publishing, updates, validation
- **Capacity Enforcement**: Generate events with random capacities and registration attempts
  - Property 11-14: Capacity storage, enforcement, concurrent safety
- **Registration Flow**: Generate random user-event combinations for registration
  - Property 15-19: Registration creation, QR uniqueness, ticket generation
- **Search and Discovery**: Generate random search queries and event datasets
  - Property 20-24: Listing, searching, sorting, filtering
- **Organizer Features**: Generate random organizer-event-attendee scenarios
  - Property 25-28: Dashboard filtering, attendee lists, exports
- **Notifications**: Generate random notification scenarios
  - Property 29-31: Bulk emails, content validation, confirmations
- **QR Validation**: Generate random QR codes (valid and invalid)
  - Property 32-36: Validation, check-in, duplicate detection

**Property Test Generators**:
Custom generators will be created for domain objects:
- `arbitraryEmail()`: Generates valid email addresses
- `arbitraryPassword()`: Generates passwords meeting requirements
- `arbitraryEvent()`: Generates valid event data
- `arbitraryFutureDate()`: Generates dates in the future
- `arbitraryCapacity()`: Generates positive integers for capacity
- `arbitraryQRCode()`: Generates QR code data strings

**Property Test Execution**:
- Run property tests as part of CI/CD pipeline
- Configure to run 100+ iterations per property
- Shrink failing cases to minimal counterexamples
- Log all generated inputs for failing tests

### Integration Testing

**Scope**: End-to-end API testing with real AWS services (LocalStack for local development)

**Integration Test Scenarios**:
- Complete user registration → event creation → registration → ticket retrieval flow
- Capacity enforcement with multiple concurrent registrations
- Email delivery through SES (sandbox mode)
- S3 upload and retrieval of cover photos
- Cognito authentication flow

**Tools**:
- LocalStack for local AWS service emulation
- Supertest for HTTP API testing
- AWS SDK for service interaction verification

### Frontend Testing

**Unit Tests**: React Testing Library for component testing
- User interactions (clicks, form submissions)
- Conditional rendering based on props/state
- Integration with API client (mocked)

**E2E Tests**: Playwright for critical user journeys
- User registration and login flow
- Event creation and publishing
- Event registration and ticket viewing
- Organizer dashboard and attendee management

### Test Execution Strategy

**Local Development**:
- Run unit tests on file save (watch mode)
- Run property tests before commits
- Use LocalStack for integration tests

**CI/CD Pipeline**:
1. Run all unit tests (fail fast)
2. Run property-based tests (100 iterations)
3. Run integration tests with LocalStack
4. Run E2E tests against deployed preview environment
5. Generate coverage reports
6. Block merge if coverage < 80% or any test fails

**Performance Testing**:
- Load test registration endpoint with concurrent requests
- Verify capacity enforcement under load
- Monitor Lambda cold start times
- Verify CloudFront cache hit rates

## Security Considerations

### Authentication and Authorization

**Cognito Integration**:
- User passwords hashed with bcrypt (handled by Cognito)
- JWT tokens for stateless authentication
- Token expiration: 1 hour for access tokens, 30 days for refresh tokens
- Token validation on every API request via API Gateway authorizer

**Authorization Rules**:
- Attendees can only view their own registrations
- Organizers can only modify their own events
- Organizers can only view attendees for their events
- Admin role (future) for platform-wide management

### Data Protection

**Encryption**:
- All data encrypted at rest in DynamoDB (AWS managed keys)
- All data encrypted in transit (HTTPS/TLS 1.2+)
- S3 buckets encrypted with SSE-S3
- Cognito user pool data encrypted by default

**PII Handling**:
- Email addresses stored in Cognito and DynamoDB
- No credit card data stored (payment out of scope for MVP)
- User data deletion on account closure (GDPR compliance)
- Audit logs for data access (CloudWatch Logs)

### API Security

**Rate Limiting**:
- API Gateway throttling: 100 requests/second per user
- Burst limit: 200 requests
- Lambda concurrency limits to prevent runaway costs

**Input Validation**:
- All inputs validated against schemas
- SQL injection not applicable (NoSQL database)
- XSS prevention through React's built-in escaping
- CORS configured to allow only frontend domain

**Secrets Management**:
- AWS Secrets Manager for sensitive configuration
- No hardcoded credentials in code
- Environment variables for Lambda configuration
- IAM roles for service-to-service authentication

### Infrastructure Security

**Network Security**:
- CloudFront with HTTPS only
- S3 buckets not publicly accessible (CloudFront OAI)
- API Gateway with custom domain and TLS certificate
- Lambda functions in VPC (if database requires)

**IAM Policies**:
- Least privilege principle for all roles
- Separate roles per Lambda function
- No wildcard permissions
- Regular audit of IAM policies

**Monitoring and Logging**:
- CloudWatch Logs for all Lambda functions
- API Gateway access logs
- CloudTrail for AWS API calls
- Alarms for suspicious activity (failed auth attempts, rate limit hits)

## Deployment Strategy

### Infrastructure as Code

**AWS CDK Stack Structure**:
```
infra/
├── lib/
│   ├── infra-stack.ts           # Main stack
│   ├── frontend-stack.ts        # S3 + CloudFront
│   ├── api-stack.ts             # API Gateway + Lambda
│   ├── database-stack.ts        # DynamoDB tables
│   ├── auth-stack.ts            # Cognito user pool
│   └── email-stack.ts           # SES configuration
```

**CDK Constructs**:
- `NodejsFunction` for Lambda with automatic bundling
- `Distribution` for CloudFront with S3 origin
- `Table` for DynamoDB with GSIs
- `UserPool` for Cognito with email verification
- `RestApi` for API Gateway with CORS

### Deployment Pipeline

**Stages**:
1. **Development**: Local development with LocalStack
2. **Preview**: Ephemeral environment per pull request
3. **Staging**: Pre-production environment for testing
4. **Production**: Live environment

**CI/CD Workflow** (GitHub Actions):
```yaml
1. Code push to branch
2. Run linting and type checking
3. Run unit tests
4. Run property-based tests
5. Build frontend and backend
6. Deploy to preview environment (CDK)
7. Run E2E tests against preview
8. On merge to main:
   - Deploy to staging
   - Run smoke tests
   - Manual approval gate
   - Deploy to production
   - Run smoke tests
```

### Environment Configuration

**Environment Variables**:
- `STAGE`: dev | preview | staging | production
- `COGNITO_USER_POOL_ID`: Cognito user pool identifier
- `COGNITO_CLIENT_ID`: Cognito app client identifier
- `DYNAMODB_TABLE_NAME`: Main DynamoDB table name
- `S3_BUCKET_NAME`: Cover photo storage bucket
- `SES_FROM_EMAIL`: Verified sender email address
- `FRONTEND_URL`: CloudFront distribution URL

### Monitoring and Observability

**CloudWatch Metrics**:
- Lambda invocation count, duration, errors
- API Gateway request count, latency, 4xx/5xx errors
- DynamoDB read/write capacity units consumed
- S3 bucket request count
- SES email delivery rate

**CloudWatch Alarms**:
- Lambda error rate > 5%
- API Gateway 5xx error rate > 1%
- DynamoDB throttling events
- SES bounce rate > 5%
- CloudFront 5xx error rate > 1%

**Dashboards**:
- Real-time system health dashboard
- Business metrics (events created, registrations, tickets issued)
- Cost tracking dashboard (Free Tier usage)

### Rollback Strategy

**Automated Rollback**:
- CloudWatch alarms trigger rollback on high error rates
- CDK retains previous stack version for quick rollback
- Database migrations are backward compatible

**Manual Rollback**:
- Revert to previous CDK stack version
- Restore DynamoDB table from point-in-time backup
- Invalidate CloudFront cache for frontend rollback

## AWS Free Tier Optimization

### Service Usage Limits

**Lambda**:
- Free Tier: 1M requests/month, 400,000 GB-seconds compute
- Strategy: Optimize function memory (128-256 MB), minimize cold starts
- Estimated usage: ~100K requests/month for MVP

**API Gateway**:
- Free Tier: 1M API calls/month (first 12 months)
- Strategy: Implement caching for read-heavy endpoints
- Estimated usage: ~100K requests/month

**DynamoDB**:
- Free Tier: 25 GB storage, 25 read/write capacity units
- Strategy: Use on-demand pricing, optimize queries with GSIs
- Estimated usage: < 1 GB storage, < 10 RCU/WCU for MVP

**S3**:
- Free Tier: 5 GB storage, 20,000 GET requests, 2,000 PUT requests
- Strategy: Compress images, implement lifecycle policies
- Estimated usage: < 1 GB for cover photos

**CloudFront**:
- Free Tier: 1 TB data transfer out, 10M HTTP/HTTPS requests
- Strategy: Aggressive caching for static assets
- Estimated usage: < 10 GB data transfer for MVP

**Cognito**:
- Free Tier: 50,000 monthly active users
- Strategy: Standard user pool (no advanced features)
- Estimated usage: < 1,000 users for MVP

**SES**:
- Free Tier: 62,000 emails/month (when called from EC2/Lambda)
- Strategy: Template-based emails, batch sending
- Estimated usage: < 5,000 emails/month

### Cost Monitoring

**Budgets and Alerts**:
- AWS Budget set to $5/month with 80% threshold alert
- Cost anomaly detection enabled
- Daily cost reports to team email

**Optimization Techniques**:
- Lambda function timeout set to minimum required (10-30 seconds)
- DynamoDB auto-scaling disabled (on-demand mode)
- S3 lifecycle policy to delete orphaned uploads after 7 days
- CloudFront cache TTL set to 1 hour for static assets
- API Gateway caching for event listings (5 minutes)

## Future Enhancements (Post-MVP)

### Phase 2 Features
- Payment integration (Stripe)
- Tiered ticketing (Early Bird, VIP, General Admission)
- Private events with access codes
- Seat selection for venues
- Automated refund system
- Event categories and tags
- Advanced search filters
- Event recommendations

### Phase 3 Features
- Mobile native apps (iOS/Android)
- Social sharing and invitations
- Event analytics dashboard
- Attendee check-in mobile app
- Multi-language support
- Calendar integration (Google, Apple, Outlook)
- Waitlist functionality
- Event series and recurring events

### Scalability Considerations
- Migrate to Aurora Serverless for relational data needs
- Implement ElastiCache for high-traffic caching
- Add CloudSearch or Elasticsearch for advanced search
- Implement EventBridge for event-driven architecture
- Add Step Functions for complex workflows (refunds, waitlists)
- Implement GraphQL API with AppSync for mobile apps
