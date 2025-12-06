import { useState, useEffect } from 'react';
import { Row, Col, Empty, Typography, Space, message } from 'antd';
import EventCard from '../components/EventCard';
import EventCardSkeleton from '../components/EventCardSkeleton';
import SearchBar from '../components/SearchBar';
import eventService from '../services/eventService';
import type { EventResponse } from '../types';

const { Title } = Typography;

const HomePage: React.FC = () => {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async (query?: string) => {
    setLoading(true);
    try {
      const response = await eventService.listEvents({
        query,
        status: 'published',
        sortBy: 'eventDate',
        sortOrder: 'asc',
      });
      setEvents(response.items);
    } catch (error) {
      console.error('Failed to load events:', error);
      message.error('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    loadEvents(query);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12" role="main">
      <div className="max-w-7xl mx-auto">
        <Space direction="vertical" size="large" className="w-full">
          <header className="text-center py-6 sm:py-8 lg:py-10">
            <Title level={1} className="!text-3xl sm:!text-4xl lg:!text-5xl !mb-4">
              Discover Events
            </Title>
            <Typography.Paragraph className="text-base sm:text-lg text-gray-600 px-4">
              Find and register for exciting events near you
            </Typography.Paragraph>
          </header>

          <div className="flex justify-center mb-6" role="search">
            <div className="w-full max-w-3xl">
              <SearchBar onSearch={handleSearch} loading={loading} />
            </div>
          </div>

          <section aria-label="Available events" aria-live="polite" aria-busy={loading}>
            {loading ? (
              <Row gutter={[16, 16]} className="sm:gutter-24">
                {[...Array(8)].map((_, index) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={index}>
                    <EventCardSkeleton />
                  </Col>
                ))}
              </Row>
            ) : events.length === 0 ? (
              <div role="status" aria-live="polite">
                <Empty
                  description={
                    searchQuery
                      ? `No events found for "${searchQuery}"`
                      : 'No events available at the moment'
                  }
                  className="mt-12"
                />
              </div>
            ) : (
              <Row gutter={[16, 16]} className="sm:gutter-24">
                {events.map((event) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={event.eventId}>
                    <EventCard event={event} />
                  </Col>
                ))}
              </Row>
            )}
          </section>
        </Space>
      </div>
    </div>
  );
};

export default HomePage;
