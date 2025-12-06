import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Descriptions,
  message,
  Row,
  Col,
} from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from '../utils/toast';
import eventService from '../services/eventService';
import authService from '../services/authService';
import registrationService from '../services/registrationService';
import type { EventResponse } from '../types';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

const EventDetailsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (eventId) {
      loadEventDetails(eventId);
    }
  }, [eventId]);

  const loadEventDetails = async (id: string) => {
    setLoading(true);
    try {
      const eventData = await eventService.getEvent(id);
      setEvent(eventData);
    } catch (error) {
      console.error('Failed to load event details:', error);
      message.error('Failed to load event details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!authService.isAuthenticated()) {
      message.warning('Please login to register for this event');
      navigate('/login', { state: { from: `/events/${eventId}` } });
      return;
    }

    if (!event || !eventId) return;

    setRegistering(true);
    try {
      await registrationService.registerForEvent(eventId);
      toast.success({
        title: 'Registration Successful!',
        description: 'Check your email for your digital ticket with QR code.',
        duration: 5,
      });
      navigate('/my-tickets');
    } catch (error: unknown) {
      console.error('Registration failed:', error);
      
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
        if (axiosError.response?.status === 409) {
          toast.error({
            title: 'Event Full',
            description: 'This event has reached maximum capacity. Registration is now closed.',
          });
        } else if (axiosError.response?.data?.error?.message) {
          toast.error({
            title: 'Registration Failed',
            description: axiosError.response.data.error.message,
          });
        } else {
          toast.error({
            title: 'Registration Failed',
            description: 'Unable to complete registration. Please try again.',
          });
        }
      } else {
        toast.error({
          title: 'Registration Failed',
          description: 'Unable to complete registration. Please try again.',
        });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

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

  if (loading) {
    return <LoadingSpinner fullScreen tip="Loading event details..." />;
  }

  if (!event) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <Content style={{ padding: '50px' }}>
          <Card>
            <Title level={3}>Event Not Found</Title>
            <Button type="primary" onClick={handleBack}>
              Back to Events
            </Button>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px 50px 50px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack} size="large">
              Back to Events
            </Button>

            <Card
            cover={
              <img
                alt={event.title}
                src={event.coverPhotoUrl}
                style={{ width: '100%', height: 450, objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/1400x450?text=Event+Image';
                }}
              />
            }
          >
            <Row gutter={[32, 32]}>
              <Col xs={24} lg={16}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Title level={1} style={{ marginBottom: 12, fontSize: '36px' }}>
                      {event.title}
                    </Title>
                    {event.isFull ? (
                      <Tag color="red" style={{ fontSize: 14 }}>
                        EVENT FULL
                      </Tag>
                    ) : event.availableSpots <= 10 && event.availableSpots > 0 ? (
                      <Tag color="orange" style={{ fontSize: 14 }}>
                        Only {event.availableSpots} spots left
                      </Tag>
                    ) : (
                      <Tag color="green" style={{ fontSize: 14 }}>
                        Available
                      </Tag>
                    )}
                  </div>

                  <div style={{ 
                    background: '#fafafa', 
                    padding: '20px', 
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <Title level={4} style={{ marginBottom: 12 }}>About This Event</Title>
                    <Paragraph style={{ fontSize: 16, whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                      {event.description}
                    </Paragraph>
                  </div>

                  <div>
                    <Title level={4} style={{ marginBottom: 16 }}>Event Details</Title>
                    <Descriptions column={1} bordered size="middle">
                    <Descriptions.Item
                      label={
                        <span>
                          <CalendarOutlined style={{ marginRight: 8 }} />
                          Date & Time
                        </span>
                      }
                    >
                      {formatDate(event.eventDate)}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span>
                          <EnvironmentOutlined style={{ marginRight: 8 }} />
                          Venue
                        </span>
                      }
                    >
                      <div>
                        <div>{event.venue.name}</div>
                        <div style={{ color: '#666' }}>
                          {event.venue.address}, {event.venue.city}, {event.venue.state} {event.venue.zipCode}
                        </div>
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span>
                          <UserOutlined style={{ marginRight: 8 }} />
                          Capacity
                        </span>
                      }
                    >
                      {event.registeredCount} / {event.capacity} registered
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <span>
                          <MailOutlined style={{ marginRight: 8 }} />
                          Contact Email
                        </span>
                      }
                    >
                      <a href={`mailto:${event.contactInfo.email}`}>{event.contactInfo.email}</a>
                    </Descriptions.Item>
                    {event.contactInfo.phone && (
                      <Descriptions.Item
                        label={
                          <span>
                            <PhoneOutlined style={{ marginRight: 8 }} />
                            Contact Phone
                          </span>
                        }
                      >
                        <a href={`tel:${event.contactInfo.phone}`}>{event.contactInfo.phone}</a>
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Organizer">
                      {event.organizerName}
                    </Descriptions.Item>
                  </Descriptions>
                  </div>
                </Space>
              </Col>

              <Col xs={24} lg={8}>
                <Card
                  title={<span style={{ fontSize: '18px', fontWeight: 600 }}>Register for this Event</span>}
                  style={{ position: 'sticky', top: 20 }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ marginBottom: 8, fontSize: '20px' }}>
                        {event.isFull ? 'Event Full' : 'Spots Available'}
                      </Title>
                      <Paragraph style={{ marginBottom: 0 }}>
                        {event.isFull
                          ? 'This event has reached maximum capacity'
                          : `${event.availableSpots} of ${event.capacity} spots remaining`}
                      </Paragraph>
                    </div>

                    <Button
                      type="primary"
                      size="large"
                      block
                      disabled={event.isFull}
                      loading={registering}
                      onClick={handleRegister}
                    >
                      {event.isFull ? 'Event Full' : 'Register Now'}
                    </Button>

                    {!authService.isAuthenticated() && (
                      <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                        You need to be logged in to register for events
                      </Paragraph>
                    )}
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>
        </Space>
        </div>
      </Content>
    </Layout>
  );
};

export default EventDetailsPage;
