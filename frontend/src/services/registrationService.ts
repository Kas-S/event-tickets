import apiClient from './apiClient';
import type { TicketResponse } from '../types';

export interface Registration {
  registrationId: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'confirmed' | 'cancelled';
  registeredAt: string;
  checkedInAt?: string;
  ticketCode: string;
  qrCodeUrl: string;
}

export interface RegisterForEventRequest {
  eventId: string;
}

class RegistrationService {
  async registerForEvent(eventId: string): Promise<Registration> {
    try {
      const response = await apiClient.post<Registration>(`/events/${eventId}/register`);
      return response.data;
    } catch (error) {
      console.error('Register for event error:', error);
      throw error;
    }
  }

  async getRegistration(registrationId: string): Promise<Registration> {
    try {
      const response = await apiClient.get<Registration>(`/registrations/${registrationId}`);
      return response.data;
    } catch (error) {
      console.error('Get registration error:', error);
      throw error;
    }
  }

  async getUserRegistrations(): Promise<{
    registrations: TicketResponse[];
    count: number;
  }> {
    try {
      const response = await apiClient.get<{
        registrations: TicketResponse[];
        count: number;
      }>('/registrations/me');
      return response.data;
    } catch (error) {
      console.error('Get user registrations error:', error);
      throw error;
    }
  }

  async cancelRegistration(registrationId: string): Promise<void> {
    try {
      await apiClient.delete(`/registrations/${registrationId}`);
    } catch (error) {
      console.error('Cancel registration error:', error);
      throw error;
    }
  }
}

export default new RegistrationService();
