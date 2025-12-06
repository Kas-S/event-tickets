# Event Ticketing System

A full-stack serverless event ticketing platform built with React, AWS CDK, Lambda, DynamoDB, and Cognito.

## Project Structure

```
event-ticketing-system/
├── frontend/          # React + TypeScript + Vite
├── infra/            # AWS CDK Infrastructure
└── package.json      # Root workspace scripts
```

## Quick Start

```bash
# Install dependencies
npm run install:all

# Deploy everything to AWS
npm run deploy
```

That's it! Your event ticketing system is now live. See [QUICK_START.md](QUICK_START.md) for details.

### Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`

### Local Development

```bash
# Start frontend dev server (connects to deployed AWS backend)
npm run dev:frontend
```

Open http://localhost:5173 in your browser.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run install:all` | Install dependencies for all projects |
| `npm run deploy` | Deploy everything (infrastructure + frontend) |
| `npm run deploy:backend` | Deploy backend infrastructure only |
| `npm run deploy:frontend` | Deploy frontend only |
| `npm run config:frontend` | Update frontend config from CDK outputs |
| `npm run dev:frontend` | Start frontend dev server |
| `npm run build` | Build both frontend and infrastructure |
| `npm run clean` | Clean build artifacts |

## Features

- **User Authentication** - Email-based registration via AWS Cognito
- **Event Management** - Create, update, delete events with cover photos
- **Event Discovery** - Browse and search published events
- **Registration System** - Register for events and receive digital tickets
- **QR Code Tickets** - Digital tickets with QR codes for check-in
- **Organizer Dashboard** - View attendees, export lists, send notifications
- **Email Notifications** - Automated emails via Amazon SES
- **Capacity Management** - Automatic enforcement of event limits

## Backend Integration

The frontend is fully integrated with AWS backend services:

- **API Gateway** - RESTful API with Lambda functions
- **Cognito** - User authentication and authorization
- **DynamoDB** - Event, user, and registration data
- **S3** - Cover photo uploads with presigned URLs
- **SES** - Email notifications

Configuration is automatically managed after deployment. See [INTEGRATION.md](frontend/INTEGRATION.md) for details.

## Documentation

- **[Quick Start Guide](QUICK_START.md)** - Get started in minutes
- **[Deployment Guide](DEPLOYMENT.md)** - Complete deployment instructions
- **[Frontend Integration](frontend/INTEGRATION.md)** - Backend integration details
- **[Frontend README](frontend/README.md)** - Frontend development guide
- **[Infrastructure README](infra/README.md)** - CDK infrastructure guide
- **[API Documentation](SWAGGER-DEPLOYMENT.md)** - Swagger UI setup
- **[Specifications](.kiro/specs/event-ticketing-system/)** - Feature specs

## API Documentation

The system includes automated Swagger UI documentation:
- **Access**: `https://<cloudfront-domain>/swagger/`
- **Auto-generated**: OpenAPI spec exported from API Gateway on every deployment
- **Interactive**: Test endpoints directly from the UI
- See `SWAGGER-DEPLOYMENT.md` for details

## Architecture

- **Frontend**: React + TypeScript + Vite → S3 + CloudFront
- **API**: API Gateway + Lambda Functions
- **Database**: DynamoDB
- **Auth**: Cognito User Pools
- **Email**: Amazon SES
- **Infrastructure**: AWS CDK (TypeScript)

## License

MIT
