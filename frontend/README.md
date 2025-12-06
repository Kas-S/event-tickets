# Event Ticketing System - Frontend

React-based frontend application for the Event Ticketing System, built with TypeScript and Vite.

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Authentication**: AWS Cognito (via AWS SDK)
- **Styling**: CSS (Ant Design planned for future tasks)

## Project Structure

```
src/
├── pages/          # Page components (to be implemented)
├── components/     # Reusable UI components (to be implemented)
├── services/       # API and authentication services
│   ├── apiClient.ts       # Axios client with interceptors
│   ├── authService.ts     # Cognito authentication service
│   └── index.ts           # Service exports
├── types/          # TypeScript type definitions
│   └── index.ts           # All data model interfaces
├── App.tsx         # Main application component with routing
├── main.tsx        # Application entry point
└── index.css       # Global styles
```

## Available Scripts

### Development
```bash
npm run dev
```
Starts the development server at http://localhost:5173

### Build
```bash
npm run build
```
Builds the application for production to the `dist/` folder

### Preview
```bash
npm run preview
```
Preview the production build locally

### Lint
```bash
npm run lint
```
Run ESLint to check code quality

## Environment Configuration

Copy `.env.example` to `.env.local` and configure:

```env
VITE_API_BASE_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_CLIENT_ID=your-cognito-client-id
```

## Services

### API Client (`services/apiClient.ts`)
- Axios instance with base URL configuration
- Request interceptor for JWT token injection
- Response interceptor for error handling
- Automatic token refresh on 401 errors

### Auth Service (`services/authService.ts`)
- User registration and login
- Cognito integration for authentication
- Token management (access, refresh, ID tokens)
- User session management
- Logout functionality

## Type Definitions

All TypeScript interfaces are defined in `src/types/index.ts`:
- User, Event, Registration, Ticket types
- API request/response types
- Error response types
- Pagination and search types

## Routing

Basic routing structure is set up in `App.tsx`:
- `/` - Home page
- `/login` - Login page
- `/register` - Registration page
- `/events` - Event listing
- `/events/:eventId` - Event details
- `/my-tickets` - User's tickets
- `/organizer/dashboard` - Organizer dashboard

## Next Steps

The following tasks will implement the UI components:
- Task 13: Authentication UI (Login/Register pages)
- Task 14: Event browsing UI (Home, Event listing, Event details)
- Task 15: Event creation UI (Create event form)
- Task 16: Registration and ticketing UI (Ticket display)
- Task 17: Organizer dashboard UI (Attendee management)
