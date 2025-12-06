/**
 * Shared utilities for digital ticket generation
 */

export interface VenueInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface ContactInfo {
  email: string;
  phone?: string;
}

export interface EventInfo {
  eventId: string;
  title: string;
  description: string;
  eventDate: string;
  venue: VenueInfo;
  contactInfo: ContactInfo;
  organizerId: string;
}

export interface AttendeeInfo {
  userId: string;
  name: string;
  email: string;
}

export interface DigitalTicket {
  registrationId: string;
  event: EventInfo;
  attendee: AttendeeInfo;
  qrCode: string;
  status: string;
  registeredAt: string;
  checkedInAt?: string;
}

/**
 * Build a complete digital ticket data structure
 */
export function buildDigitalTicket(
  registrationId: string,
  event: EventInfo,
  attendee: AttendeeInfo,
  qrCode: string,
  status: string,
  registeredAt: string,
  checkedInAt?: string
): DigitalTicket {
  return {
    registrationId,
    event: {
      eventId: event.eventId,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
      venue: event.venue,
      contactInfo: event.contactInfo,
      organizerId: event.organizerId,
    },
    attendee: {
      userId: attendee.userId,
      name: attendee.name,
      email: attendee.email,
    },
    qrCode,
    status,
    registeredAt,
    ...(checkedInAt && { checkedInAt }),
  };
}

/**
 * Format ticket data for email template
 */
export function formatTicketForEmail(ticket: DigitalTicket): string {
  const venueAddress = `${ticket.event.venue.address}, ${ticket.event.venue.city}, ${ticket.event.venue.state} ${ticket.event.venue.zipCode}`;
  const eventDate = new Date(ticket.event.eventDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Your Event Ticket</h1>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #1890ff; margin-top: 0;">${ticket.event.title}</h2>
        <p><strong>Date:</strong> ${eventDate}</p>
        <p><strong>Venue:</strong> ${ticket.event.venue.name}</p>
        <p><strong>Address:</strong> ${venueAddress}</p>
      </div>

      <div style="background-color: #fff; padding: 20px; border: 2px solid #1890ff; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h3 style="margin-top: 0;">Attendee Information</h3>
        <p><strong>Name:</strong> ${ticket.attendee.name}</p>
        <p><strong>Email:</strong> ${ticket.attendee.email}</p>
        <p><strong>Registration ID:</strong> ${ticket.registrationId}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <h3>Your QR Code</h3>
        <p>Present this QR code at the event for check-in:</p>
        <img src="${ticket.qrCode}" alt="QR Code" style="max-width: 300px; border: 1px solid #ddd; padding: 10px;" />
      </div>

      <div style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0;">Contact Information</h4>
        <p><strong>Organizer Email:</strong> ${ticket.event.contactInfo.email}</p>
        ${ticket.event.contactInfo.phone ? `<p><strong>Phone:</strong> ${ticket.event.contactInfo.phone}</p>` : ''}
      </div>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is your digital ticket. Please save this email or take a screenshot of the QR code for event check-in.
      </p>
    </div>
  `;
}
