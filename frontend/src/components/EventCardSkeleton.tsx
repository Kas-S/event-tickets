import { Card, Skeleton } from 'antd';

const EventCardSkeleton: React.FC = () => {
  return (
    <Card
      hoverable
      cover={
        <Skeleton.Image 
          active 
          style={{ width: '100%', height: 200 }} 
        />
      }
      style={{ height: '100%' }}
    >
      <Skeleton active paragraph={{ rows: 3 }} />
    </Card>
  );
};

export default EventCardSkeleton;
