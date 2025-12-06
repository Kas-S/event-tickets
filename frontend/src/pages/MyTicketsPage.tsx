import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Typography,
  Space,
  Empty,
  message,
  Row,
  Col,
  Button,
} from 'antd';
import {
  ArrowLeftOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import LoadingSpinner from '../components/LoadingSpinner';
import registrationService from '../services/registrationService';
import type { TicketResponse } from '../types';
import TicketDisplay from '../components/TicketDisplay';

const { Content } = Layout;
const { Title } = Typography;

const MyTicketsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await registrationService.getUserRegistrations();
      setTickets(response.registrations);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      message.error('Failed to load your tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return <LoadingSpinner fullScreen tip="Loading your tickets..." />;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px 50px 50px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button icon={<ArrowLeftOutlined />} onClick={handleBack} size="large">
                Back to Events
              </Button>
            </div>

            <Card>
              <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ marginBottom: 8 }}>
                  <IdcardOutlined style={{ marginRight: 12 }} />
                  My Tickets
                </Title>
                <Typography.Text type="secondary" style={{ fontSize: 16 }}>
                  View and manage your event registrations
                </Typography.Text>
              </div>

              {tickets.length === 0 ? (
                <Empty
                  description="You haven't registered for any events yet"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={() => navigate('/')}>
                    Browse Events
                  </Button>
                </Empty>
              ) : (
                <Row gutter={[24, 24]}>
                  {tickets.map((ticket) => (
                    <Col xs={24} key={ticket.registrationId}>
                      <TicketDisplay ticket={ticket} />
                    </Col>
                  ))}
                </Row>
              )}
            </Card>
          </Space>
        </div>
      </Content>
    </Layout>
  );
};

export default MyTicketsPage;
