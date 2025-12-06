import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  message,
  DatePicker,
  InputNumber,
  Upload,
  Space,
  Row,
  Col,
} from 'antd';
import toast from '../utils/toast';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  PictureOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import eventService from '../services/eventService';
import uploadService from '../services/uploadService';
import type { CreateEventRequest, VenueInfo, ContactInfo } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CreateEventFormValues {
  title: string;
  description: string;
  eventDate: Dayjs;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueState: string;
  venueZipCode: string;
  contactEmail: string;
  contactPhone?: string;
  capacity: number;
}

const CreateEventPage = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string>('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleUpload = async (file: File): Promise<boolean> => {
    setUploading(true);
    try {
      const url = await uploadService.uploadCoverPhoto(file);
      console.log('Upload successful, URL:', url);
      setCoverPhotoUrl(url);
      message.success('Cover photo uploaded successfully!');
      return true;
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: { message?: string } } }; message?: string })
          ?.response?.data?.error?.message ||
        (error as { message?: string })?.message ||
        'Failed to upload cover photo';
      message.error(errorMessage);
      return false;
    } finally {
      setUploading(false);
    }
  };

  const onFinish = async (values: CreateEventFormValues) => {
    console.log('Form submitted with coverPhotoUrl:', coverPhotoUrl);
    console.log('Form values:', values);
    console.log('FileList:', fileList);
    
    if (!coverPhotoUrl) {
      console.error('Cover photo URL is missing!');
      toast.error({
        title: 'Missing Cover Photo',
        description: 'Please upload a cover photo before creating the event.',
      });
      return;
    }

    setLoading(true);
    try {
      const venue: VenueInfo = {
        name: values.venueName,
        address: values.venueAddress,
        city: values.venueCity,
        state: values.venueState,
        zipCode: values.venueZipCode,
      };

      const contactInfo: ContactInfo = {
        email: values.contactEmail,
        phone: values.contactPhone,
      };

      const eventData: CreateEventRequest = {
        title: values.title,
        description: values.description,
        coverPhotoUrl,
        eventDate: values.eventDate.toISOString(),
        venue,
        contactInfo,
        capacity: values.capacity,
      };

      const createdEvent = await eventService.createEvent(eventData);
      toast.success({
        title: 'Event Created!',
        description: 'Your event has been created successfully and is ready to be published.',
      });
      navigate(`/events/${createdEvent.eventId}`);
    } catch (error) {
      console.error('Create event error:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: { message?: string } } }; message?: string })
          ?.response?.data?.error?.message ||
        (error as { message?: string })?.message ||
        'Failed to create event. Please try again.';
      toast.error({
        title: 'Failed to Create Event',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f0f2f5',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={2}>Create New Event</Title>
            <Text type="secondary">Fill in the details to create your event</Text>
          </div>

          <Form
            form={form}
            name="createEvent"
            onFinish={onFinish}
            layout="vertical"
            autoComplete="off"
          >
            <Title level={4}>Basic Information</Title>
            
            <Form.Item
              name="title"
              label="Event Title"
              rules={[
                { required: true, message: 'Please enter event title' },
                { min: 3, message: 'Title must be at least 3 characters' },
                { max: 200, message: 'Title must not exceed 200 characters' },
              ]}
            >
              <Input placeholder="e.g., Summer Music Festival 2024" size="large" />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description"
              rules={[
                { required: true, message: 'Please enter event description' },
                { min: 10, message: 'Description must be at least 10 characters' },
                { max: 2000, message: 'Description must not exceed 2000 characters' },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Describe your event, what attendees can expect, schedule, etc."
                showCount
                maxLength={2000}
              />
            </Form.Item>

            <Form.Item
              label="Cover Photo"
              required
              help={!coverPhotoUrl && fileList.length === 0 ? 'Please upload a cover photo' : ''}
              validateStatus={!coverPhotoUrl && fileList.length === 0 ? 'error' : 'success'}
            >
              <Upload
                listType="picture-card"
                fileList={fileList}
                beforeUpload={(file) => {
                  const isImage = file.type.startsWith('image/');
                  if (!isImage) {
                    message.error('You can only upload image files!');
                    return false;
                  }
                  const isLt5M = file.size / 1024 / 1024 < 5;
                  if (!isLt5M) {
                    message.error('Image must be smaller than 5MB!');
                    return false;
                  }
                  
                  handleUpload(file);
                  setFileList([
                    {
                      uid: file.uid,
                      name: file.name,
                      status: 'done',
                      url: URL.createObjectURL(file),
                    },
                  ]);
                  return false;
                }}
                onRemove={() => {
                  setCoverPhotoUrl('');
                  setFileList([]);
                }}
                maxCount={1}
              >
                {fileList.length === 0 && (
                  <div>
                    <PictureOutlined style={{ fontSize: 32, color: '#999' }} />
                    <div style={{ marginTop: 8 }}>Upload Cover Photo</div>
                  </div>
                )}
              </Upload>
              {uploading && <Text type="secondary">Uploading...</Text>}
            </Form.Item>

            <Title level={4} style={{ marginTop: 24 }}>
              Date & Capacity
            </Title>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="eventDate"
                  label="Event Date & Time"
                  rules={[
                    { required: true, message: 'Please select event date and time' },
                    {
                      validator: (_, value) => {
                        if (value && value.isBefore(dayjs())) {
                          return Promise.reject(new Error('Event date must be in the future'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    size="large"
                    prefix={<CalendarOutlined />}
                    placeholder="Select date and time"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="capacity"
                  label="Maximum Capacity"
                  rules={[
                    { required: true, message: 'Please enter maximum capacity' },
                    {
                      type: 'number',
                      min: 1,
                      message: 'Capacity must be at least 1',
                    },
                    {
                      type: 'number',
                      max: 100000,
                      message: 'Capacity must not exceed 100,000',
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    size="large"
                    prefix={<TeamOutlined />}
                    placeholder="e.g., 100"
                    min={1}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Title level={4} style={{ marginTop: 24 }}>
              Venue Information
            </Title>

            <Form.Item
              name="venueName"
              label="Venue Name"
              rules={[
                { required: true, message: 'Please enter venue name' },
                { min: 2, message: 'Venue name must be at least 2 characters' },
              ]}
            >
              <Input
                prefix={<EnvironmentOutlined />}
                placeholder="e.g., Central Park Amphitheater"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="venueAddress"
              label="Street Address"
              rules={[
                { required: true, message: 'Please enter street address' },
                { min: 5, message: 'Address must be at least 5 characters' },
              ]}
            >
              <Input placeholder="e.g., 123 Main Street" size="large" />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="venueCity"
                  label="City"
                  rules={[
                    { required: true, message: 'Please enter city' },
                    { min: 2, message: 'City must be at least 2 characters' },
                  ]}
                >
                  <Input placeholder="e.g., New York" size="large" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="venueState"
                  label="State"
                  rules={[
                    { required: true, message: 'Please enter state' },
                    { len: 2, message: 'State must be 2 characters (e.g., NY)' },
                  ]}
                >
                  <Input placeholder="e.g., NY" size="large" maxLength={2} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="venueZipCode"
                  label="ZIP Code"
                  rules={[
                    { required: true, message: 'Please enter ZIP code' },
                    {
                      pattern: /^\d{5}(-\d{4})?$/,
                      message: 'Please enter a valid ZIP code',
                    },
                  ]}
                >
                  <Input placeholder="e.g., 10001" size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Title level={4} style={{ marginTop: 24 }}>
              Contact Information
            </Title>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contactEmail"
                  label="Contact Email"
                  rules={[
                    { required: true, message: 'Please enter contact email' },
                    { type: 'email', message: 'Please enter a valid email' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="contact@example.com"
                    size="large"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="contactPhone"
                  label="Contact Phone (Optional)"
                  rules={[
                    {
                      pattern: /^[\d\s\-()]+$/,
                      message: 'Please enter a valid phone number',
                    },
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="(555) 123-4567"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item style={{ marginTop: 32 }}>
              <Space size="middle">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  disabled={uploading}
                >
                  Create Event
                </Button>
                <Button size="large" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default CreateEventPage;
