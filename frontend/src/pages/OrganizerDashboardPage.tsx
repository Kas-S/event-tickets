import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Table, Typography, Space, message, Tag, Skeleton, Modal } from 'antd';
import { PlusOutlined, TeamOutlined, ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import eventService from '../services/eventService';
import AttendeeList from '../components/AttendeeList';
import type { EventResponse } from '../types';

const { Title, Text } = Typography;

const OrganizerDashboardPage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizerEvents();
  }, []);

  const loadOrganizerEvents = async () => {
    try {
      setLoading(true);
      const response = await eventService.getOrganizerEvents();
      setEvents(response.events);
    } catch (error) {
      console.error('Failed to load organizer events:', error);
      message.error('Failed to load your events');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttendees = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleBackToEvents = () => {
    setSelectedEventId(null);
  };

  const handleEditEvent = (eventId: string) => {
    navigate(`/events/${eventId}/edit`);
  };

  const handleDeleteEvent = (event: EventResponse) => {
    Modal.confirm({
      title: 'Delete Event',
      content: (
        <div>
          <p>Are you sure you want to delete "{event.title}"?</p>
          {event.registeredCount > 0 && (
            <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
              Warning: This event has {event.registeredCount} registered attendee{event.registeredCount > 1 ? 's' : ''}. 
              They will no longer be able to access their tickets.
            </p>
          )}
          <p>This action cannot be undone.</p>
        </div>
      ),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setDeletingEventId(event.eventId);
          await eventService.deleteEvent(event.eventId);
          message.success('Event deleted successfully');
          await loadOrganizerEvents();
        } catch (error: any) {
          console.error('Failed to delete event:', error);
          message.error(error.response?.data?.message || 'Failed to delete event');
        } finally {
          setDeletingEventId(null);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: EventResponse) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {new Date(record.eventDate).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Venue',
      dataIndex: ['venue', 'name'],
      key: 'venue',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'published' ? 'green' : status === 'draft' ? 'orange' : 'red';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Registrations',
      key: 'registrations',
      render: (_: unknown, record: EventResponse) => (
        <Space>
          <Text>
            {record.registeredCount} / {record.capacity}
          </Text>
          {record.isFull && <Tag color="red">FULL</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: EventResponse) => (
        <Space>
          <Button
            type="link"
            icon={<TeamOutlined />}
            onClick={() => handleViewAttendees(record.eventId)}
          >
            Attendees
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditEvent(record.eventId)}
          >
            Edit
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteEvent(record)}
            loading={deletingEventId === record.eventId}
            disabled={deletingEventId !== null && deletingEventId !== record.eventId}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  if (selectedEventId) {
    const selectedEvent = events.find(e => e.eventId === selectedEventId);
    
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToEvents}
          style={{ marginBottom: 16 }}
        >
          Back to Events
        </Button>
        <AttendeeList 
          eventId={selectedEventId} 
          eventTitle={selectedEvent?.title || 'Event'} 
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                Organizer Dashboard
              </Title>
              <Text type="secondary">Manage your events and view attendees</Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => navigate('/events/create')}
            >
              Create Event
            </Button>
          </div>

          <Card>
            {loading ? (
              <div style={{ padding: '20px' }}>
                <Skeleton active paragraph={{ rows: 5 }} />
              </div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">You haven't created any events yet.</Text>
                <br />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={() => navigate('/events/create')}
                >
                  Create Your First Event
                </Button>
              </div>
            ) : (
              <Table
                columns={columns}
                dataSource={events}
                rowKey="eventId"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                }}
              />
            )}
          </Card>
        </Space>
    </div>
  );
};

export default OrganizerDashboardPage;
