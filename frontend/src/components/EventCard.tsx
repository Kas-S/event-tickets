import { Card, Tag, Button } from 'antd';
import { CalendarOutlined, EnvironmentOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { EventResponse } from '../types';

const { Meta } = Card;

interface EventCardProps {
  event: EventResponse;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const navigate = useNavigate();

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewDetails = () => {
    navigate(`/events/${event.eventId}`);
  };

  return (
    <Card
      hoverable
      className="h-full flex flex-col"
      role="article"
      aria-label={`Event: ${event.title}`}
      cover={
        <img
          alt={`Cover image for ${event.title}`}
          src={event.coverPhotoUrl}
          className="h-40 sm:h-48 md:h-52 lg:h-56 object-cover"
          onError={(e) => {
            // Fallback image if cover photo fails to load
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x220?text=Event+Image';
          }}
        />
      }
      actions={[
        <Button 
          type="primary" 
          onClick={handleViewDetails} 
          key="view" 
          block 
          size="middle"
          aria-label={event.isFull ? `${event.title} is full` : `View details for ${event.title}`}
        >
          View Details
        </Button>,
      ]}
    >
      <Meta
        title={
          <div className="flex justify-between items-start gap-2">
            <span className="text-sm sm:text-base font-semibold leading-tight line-clamp-2 flex-1">
              {event.title}
            </span>
            <div className="flex-shrink-0">
              {event.isFull && <Tag color="red" className="text-xs">FULL</Tag>}
              {!event.isFull && event.availableSpots <= 10 && event.availableSpots > 0 && (
                <Tag color="orange" className="text-xs">{event.availableSpots} left</Tag>
              )}
            </div>
          </div>
        }
        description={
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2">
              <CalendarOutlined className="mt-1 text-blue-500 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs sm:text-sm break-words">
                <span className="sr-only">Event date: </span>
                {formatDate(event.eventDate)}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <EnvironmentOutlined className="mt-1 text-green-500 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs sm:text-sm break-words line-clamp-2">
                <span className="sr-only">Location: </span>
                {event.venue.name}, {event.venue.city}, {event.venue.state}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <UserOutlined className="text-purple-600 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs sm:text-sm">
                <span className="sr-only">Registration status: </span>
                {event.registeredCount} of {event.capacity} spots filled
              </span>
            </div>
          </div>
        }
      />
    </Card>
  );
};

export default EventCard;
