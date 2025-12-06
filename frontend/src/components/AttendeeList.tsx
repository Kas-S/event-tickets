import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Typography, Space, Button, message, Spin, Tag, Modal, Input, Form } from 'antd';
import type { ColumnsType, Key } from 'antd/es/table/interface';
import { DownloadOutlined, MailOutlined } from '@ant-design/icons';
import eventService from '../services/eventService';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface AttendeeInfo {
  registrationId: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  registeredAt: string;
  checkedInAt?: string;
}

interface AttendeeListProps {
  eventId: string;
  eventTitle: string;
}

const AttendeeList = ({ eventId, eventTitle }: AttendeeListProps) => {
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [form] = Form.useForm();

  const loadAttendees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await eventService.getEventAttendees(eventId);
      setAttendees(response.attendees);
    } catch (error) {
      console.error('Failed to load attendees:', error);
      message.error('Failed to load attendees');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await eventService.exportEventAttendees(eventId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const eventTitleSlug = eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `${eventTitleSlug}_attendees_${timestamp}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Attendee list exported successfully');
    } catch (error) {
      console.error('Failed to export attendees:', error);
      message.error('Failed to export attendees');
    } finally {
      setExporting(false);
    }
  };

  const handleSendNotification = () => {
    setNotificationModalVisible(true);
  };

  const handleNotificationCancel = () => {
    setNotificationModalVisible(false);
    form.resetFields();
  };

  const handleNotificationSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSendingNotification(true);
      
      const response = await eventService.sendNotification(
        eventId,
        values.subject,
        values.message
      );
      
      message.success(`Notification sent to ${response.recipientCount} attendees`);
      setNotificationModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Failed to send notification:', error);
      message.error('Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const columns: ColumnsType<AttendeeInfo> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: AttendeeInfo, b: AttendeeInfo) => a.name.localeCompare(b.name),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: AttendeeInfo, b: AttendeeInfo) => a.email.localeCompare(b.email),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'checked-in' ? 'green' : status === 'active' ? 'blue' : 'red';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Checked In', value: 'checked-in' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value: boolean | Key, record: AttendeeInfo) => record.status === value,
    },
    {
      title: 'Registered At',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      render: (date: string) => new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      sorter: (a: AttendeeInfo, b: AttendeeInfo) => 
        new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime(),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Checked In At',
      dataIndex: 'checkedInAt',
      key: 'checkedInAt',
      render: (date?: string) => date ? new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) : <Text type="secondary">Not checked in</Text>,
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Attendees for {eventTitle}
            </Title>
            <Text type="secondary">
              {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'} registered
            </Text>
          </div>
          <Space>
            <Button
              icon={<MailOutlined />}
              onClick={handleSendNotification}
              disabled={attendees.length === 0}
            >
              Send Update
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exporting}
              disabled={attendees.length === 0}
            >
              Export CSV
            </Button>
          </Space>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : attendees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">No attendees have registered for this event yet.</Text>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={attendees}
            rowKey="registrationId"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} attendees`,
            }}
          />
        )}
      </Space>

      {/* Notification Modal */}
      <Modal
        title="Send Update to Attendees"
        open={notificationModalVisible}
        onOk={handleNotificationSubmit}
        onCancel={handleNotificationCancel}
        confirmLoading={sendingNotification}
        okText="Send"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="subject"
            label="Subject"
            rules={[
              { required: true, message: 'Please enter a subject' },
              { max: 100, message: 'Subject must be less than 100 characters' },
            ]}
          >
            <Input placeholder="e.g., Important Update: Event Time Changed" />
          </Form.Item>
          
          <Form.Item
            name="message"
            label="Message"
            rules={[
              { required: true, message: 'Please enter a message' },
              { min: 10, message: 'Message must be at least 10 characters' },
              { max: 1000, message: 'Message must be less than 1000 characters' },
            ]}
          >
            <TextArea
              rows={6}
              placeholder="Enter your message to all attendees..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Text type="secondary">
            This notification will be sent to all {attendees.length} registered attendees.
          </Text>
        </Form>
      </Modal>
    </Card>
  );
};

export default AttendeeList;
