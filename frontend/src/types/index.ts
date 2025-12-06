// User types
export interface User {
  userId: string;
  email: string;
  name: string;
  cognitoId: string;
  createdAt: string;
  updatedAt: string;
}

// Venue information
export interface VenueInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

// Contact information
export interface ContactInfo {
  email: string;
  phone?: string;
}

// Event types
export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface Event {
  eventId: string;
  organizerId: string;
  title: string;
  description: string;
  coverPhotoUrl: string;
  eventDate: string;
  venue: VenueInfo;
  contactInfo: ContactInfo;
  capacity: number;
  registeredCount: number;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

// Event response with additional computed fields
export interface EventResponse extends Event {
  organizerName: string;
  availableSpots: number;
  isFull: boolean;
}

// Registration types
export type RegistrationStatus = 'active' | 'cancelled' | 'checked-in';

export interface Registration {
  registrationId: string;
  eventId: string;
  userId: string;
  qrCode: string;
  qrCodeData: string;
  status: RegistrationStatus;
  checkedInAt?: string;
  createdAt: string;
}

// Ticket response with full event and attendee details
export interface TicketResponse {
  registrationId: string;
  event: EventResponse;
  attendee: {
    userId: string;
    name: string;
    email: string;
  };
  qrCode: string;
  status: RegistrationStatus;
  registeredAt: string;
  checkedInAt?: string;
}

// API Request types
export interface CreateEventRequest {
  title: string;
  description: string;
  coverPhotoUrl: string;
  eventDate: string;
  venue: VenueInfo;
  contactInfo: ContactInfo;
  capacity: number;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  coverPhotoUrl?: string;
  eventDate?: string;
  venue?: VenueInfo;
  contactInfo?: ContactInfo;
  capacity?: number;
  status?: EventStatus;
}

export interface RegisterRequest {
  eventId: string;
}

export interface RegisterResponse {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  user: User;
}

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
}

// Attendee information for organizer dashboard
export interface AttendeeInfo {
  userId: string;
  name: string;
  email: string;
  registrationId: string;
  registeredAt: string;
  status: RegistrationStatus;
  checkedInAt?: string;
}

// QR validation types
export interface QRValidationRequest {
  registrationId: string;
}

export interface QRValidationResponse {
  valid: boolean;
  attendee?: {
    name: string;
    email: string;
  };
  event?: {
    eventId: string;
    title: string;
    eventDate: string;
  };
  registration?: {
    registrationId: string;
    status: RegistrationStatus;
    registeredAt: string;
    checkedInAt?: string;
  };
  message?: string;
}

// Notification types
export interface SendNotificationRequest {
  eventId: string;
  subject: string;
  message: string;
}

export interface SendNotificationResponse {
  success: boolean;
  recipientCount: number;
  message: string;
}

// Pagination types
export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  count: number;
}

// Search and filter types
export interface EventSearchParams extends PaginationParams {
  query?: string;
  status?: EventStatus;
  sortBy?: 'eventDate' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// Error response type
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      field: string;
      issue: string;
    }[];
    requestId: string;
  };
}
