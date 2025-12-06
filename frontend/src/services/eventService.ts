import apiClient from './apiClient';
import type { EventResponse, EventSearchParams, PaginatedResponse, CreateEventRequest, UpdateEventRequest } from '../types';

class EventService {
  async listEvents(params?: EventSearchParams): Promise<PaginatedResponse<EventResponse>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.query) {
        queryParams.append('q', params.query);
      }
      if (params?.status) {
        queryParams.append('status', params.status);
      }
      if (params?.sortBy) {
        queryParams.append('sortBy', params.sortBy);
      }
      if (params?.sortOrder) {
        queryParams.append('sortOrder', params.sortOrder);
      }
      if (params?.limit) {
        queryParams.append('limit', params.limit.toString());
      }
      if (params?.nextToken) {
        queryParams.append('nextToken', params.nextToken);
      }

      const queryString = queryParams.toString();
      const url = queryString ? `/events?${queryString}` : '/events';
      
      const response = await apiClient.get<PaginatedResponse<EventResponse>>(url);
      return response.data;
    } catch (error) {
      console.error('List events error:', error);
      throw error;
    }
  }

  async getEvent(eventId: string): Promise<EventResponse> {
    try {
      const response = await apiClient.get<EventResponse>(`/events/${eventId}`);
      return response.data;
    } catch (error) {
      console.error('Get event error:', error);
      throw error;
    }
  }

  async createEvent(eventData: CreateEventRequest): Promise<EventResponse> {
    try {
      const response = await apiClient.post<EventResponse>('/events', eventData);
      return response.data;
    } catch (error) {
      console.error('Create event error:', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, eventData: UpdateEventRequest): Promise<EventResponse> {
    try {
      const response = await apiClient.put<EventResponse>(`/events/${eventId}`, eventData);
      return response.data;
    } catch (error) {
      console.error('Update event error:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await apiClient.delete(`/events/${eventId}`);
    } catch (error) {
      console.error('Delete event error:', error);
      throw error;
    }
  }

  async searchEvents(query: string, params?: Omit<EventSearchParams, 'query'>): Promise<PaginatedResponse<EventResponse>> {
    return this.listEvents({ ...params, query });
  }

  async getOrganizerEvents(limit?: number, lastKey?: string): Promise<{
    events: EventResponse[];
    lastEvaluatedKey?: string;
    hasMore: boolean;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (limit) {
        queryParams.append('limit', limit.toString());
      }
      if (lastKey) {
        queryParams.append('lastKey', lastKey);
      }

      const queryString = queryParams.toString();
      const url = queryString ? `/events/my-events?${queryString}` : '/events/my-events';
      
      const response = await apiClient.get<{
        events: EventResponse[];
        lastEvaluatedKey?: string;
        hasMore: boolean;
      }>(url);
      return response.data;
    } catch (error) {
      console.error('Get organizer events error:', error);
      throw error;
    }
  }

  async getEventAttendees(eventId: string): Promise<{
    eventId: string;
    attendees: Array<{
      registrationId: string;
      userId: string;
      name: string;
      email: string;
      status: string;
      registeredAt: string;
      checkedInAt?: string;
    }>;
    totalCount: number;
  }> {
    try {
      const response = await apiClient.get(`/events/${eventId}/attendees`);
      return response.data;
    } catch (error) {
      console.error('Get event attendees error:', error);
      throw error;
    }
  }

  async exportEventAttendees(eventId: string): Promise<Blob> {
    try {
      const response = await apiClient.get(`/events/${eventId}/attendees/export`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Export event attendees error:', error);
      throw error;
    }
  }

  async sendNotification(eventId: string, subject: string, message: string): Promise<{
    success: boolean;
    recipientCount: number;
    message: string;
  }> {
    try {
      const response = await apiClient.post(`/events/${eventId}/notify`, {
        subject,
        message,
      });
      return response.data;
    } catch (error) {
      console.error('Send notification error:', error);
      throw error;
    }
  }
}

export default new EventService();
