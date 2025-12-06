import { Card, Row, Col, Typography, Tag, Divider } from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { TicketResponse } from '../types';

const { Title, Text, Paragraph } = Typography;

interface TicketDisplayProps {
  ticket: TicketResponse;
}

const TicketDisplay: React.FC<TicketDisplayProps> = ({ ticket }) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusTag = () => {
    switch (ticket.status) {
      case 'checked-in':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 14 }}>
            Checked In
          </Tag>
        );
      case 'cancelled':
        return (
          <Tag color="error" style={{ fontSize: 14 }}>
            Cancelled
          </Tag>
        );
      case 'active':
      default:
        return (
          <Tag color="blue" icon={<ClockCircleOutlined />} style={{ fontSize: 14 }}>
            Active
          </Tag>
        );
    }
  };

  return (
    <Card
      className="rounded-xl overflow-hidden shadow-md print-full-width"
      role="region"
      aria-label="Event ticket details"
    >
      <Row gutter={[16, 16]} className="sm:gutter-24">
        <Col xs={24} md={16}>
          <div className="space-y-4">
            <div>
              <Title level={3} className="!mb-2 text-lg sm:text-xl md:text-2xl">
                {ticket.event.title}
              </Title>
              {getStatusTag()}
            </div>

            {ticket.event.coverPhotoUrl && (
              <img
                src={ticket.event.coverPhotoUrl}
                alt={ticket.event.title}
                className="w-full max-h-48 sm:max-h-64 md:max-h-80 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x300?text=Event+Image';
                }}
              />
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CalendarOutlined className="mt-1 text-base text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <Text strong className="block text-sm sm:text-base">Date & Time</Text>
                  <Text className="text-xs sm:text-sm break-words">{formatDate(ticket.event.eventDate)}</Text>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <EnvironmentOutlined className="mt-1 text-base text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <Text strong className="block text-sm sm:text-base">Venue</Text>
                  <Text className="block text-xs sm:text-sm">{ticket.event.venue.name}</Text>
                  <Text type="secondary" className="block text-xs sm:text-sm break-words">
                    {ticket.event.venue.address}, {ticket.event.venue.city}, {ticket.event.venue.state} {ticket.event.venue.zipCode}
                  </Text>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <UserOutlined className="mt-1 text-base text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <Text strong className="block text-sm sm:text-base">Attendee</Text>
                  <Text className="text-xs sm:text-sm">{ticket.attendee.name}</Text>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MailOutlined className="mt-1 text-base text-blue-500 flex-shrink-0" />
                <div className="flex-1">
                  <Text strong className="block text-sm sm:text-base">Email</Text>
                  <Text className="text-xs sm:text-sm break-all">{ticket.attendee.email}</Text>
                </div>
              </div>
            </div>

            <Divider className="!my-3" />
            <div className="space-y-1">
              <Text type="secondary" className="block text-xs sm:text-sm">
                <strong>Registered:</strong> {formatDate(ticket.registeredAt)}
              </Text>
              {ticket.checkedInAt && (
                <Text type="secondary" className="block text-xs sm:text-sm">
                  <strong>Checked In:</strong> {formatDate(ticket.checkedInAt)}
                </Text>
              )}
              <Text type="secondary" className="block text-xs break-all">
                <strong>Registration ID:</strong> {ticket.registrationId}
              </Text>
            </div>
          </div>
        </Col>

        <Col xs={24} md={8}>
          <Card
            className="bg-gray-50 text-center h-full flex flex-col justify-center"
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }
            }}
          >
            <Title level={4} className="!mb-4 text-base sm:text-lg">
              Your Ticket
            </Title>
            
            <div className="bg-white p-3 sm:p-4 rounded-lg mb-4 inline-block" role="img" aria-label={`QR code for ${ticket.event.title} ticket`}>
              <img
                src={ticket.qrCode}
                alt={`QR code for ticket to ${ticket.event.title}. Registration ID: ${ticket.registrationId}`}
                className="w-48 h-48 sm:w-52 sm:h-52 md:w-56 md:h-56 block"
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>

            <Paragraph
              type="secondary"
              className="text-xs sm:text-sm text-center !mb-0 px-2"
            >
              Show this QR code at the event entrance for check-in
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default TicketDisplay;
