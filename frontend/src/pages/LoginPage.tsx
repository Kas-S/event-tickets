import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import toast from '../utils/toast';
import authService from '../services/authService';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const onFinish = async (values: LoginFormValues) => {
    console.log('Login form submitted:', { email: values.email });
    setLoading(true);
    try {
      const result = await authService.login({
        email: values.email,
        password: values.password,
      });
      
      console.log('Login successful:', result);

      toast.success({
        title: 'Welcome Back!',
        description: 'You have successfully logged in.',
      });
      
      // Redirect to the page they tried to access or home
      navigate(from, { replace: true });
    } catch (error: unknown) {
      console.error('Login error:', error);
      
      const errorMessage = (error as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message 
        || (error as { message?: string })?.message 
        || 'Login failed. Please check your credentials.';
      
      toast.error({
        title: 'Login Failed',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4 py-8" role="main">
      <Card className="w-full max-w-md">
        <header className="text-center mb-6">
          <Title level={2} className="!text-xl sm:!text-2xl !mb-2">Welcome Back</Title>
          <Text type="secondary" className="text-sm sm:text-base">Log in to your account</Text>
        </header>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          autoComplete="off"
          aria-label="Login form"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="john@example.com"
              size="large"
              className="text-sm sm:text-base"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password' },
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="Enter password"
              size="large"
              className="text-sm sm:text-base"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              size="large"
              className="text-sm sm:text-base"
            >
              Log In
            </Button>
          </Form.Item>

          <div className="text-center">
            <Text className="text-sm sm:text-base">
              Don't have an account? <Link to="/register" className="font-medium">Register</Link>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
