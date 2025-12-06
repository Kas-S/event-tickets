import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Typography, Drawer } from 'antd';
import { UserOutlined, PlusOutlined, DashboardOutlined, FileTextOutlined, MenuOutlined } from '@ant-design/icons';
import authService from '../services/authService';

const { Title } = Typography;

const Header = () => {
  const navigate = useNavigate();
  const isAuthenticated = authService.isAuthenticated();
  const [drawerVisible, setDrawerVisible] = useState(false);

  const handleLogout = () => {
    authService.logout();
    setDrawerVisible(false);
    navigate('/login');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setDrawerVisible(false);
  };

  const navigationButtons = (
    <>
      <Button onClick={() => handleNavigation('/')} className="w-full sm:w-auto">
        Browse Events
      </Button>
      {isAuthenticated ? (
        <>
          <Button 
            icon={<FileTextOutlined />} 
            onClick={() => handleNavigation('/my-tickets')}
            className="w-full sm:w-auto"
          >
            <span className="hidden sm:inline">My Tickets</span>
          </Button>
          <Button 
            icon={<PlusOutlined />} 
            onClick={() => handleNavigation('/events/create')}
            className="w-full sm:w-auto"
          >
            <span className="hidden sm:inline">Create Event</span>
          </Button>
          <Button 
            icon={<DashboardOutlined />} 
            onClick={() => handleNavigation('/organizer/dashboard')}
            className="w-full sm:w-auto"
          >
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <Button onClick={handleLogout} className="w-full sm:w-auto">
            Logout
          </Button>
        </>
      ) : (
        <>
          <Button 
            icon={<UserOutlined />} 
            onClick={() => handleNavigation('/login')}
            className="w-full sm:w-auto"
          >
            Login
          </Button>
          <Button 
            type="primary" 
            onClick={() => handleNavigation('/register')}
            className="w-full sm:w-auto"
          >
            Sign Up
          </Button>
        </>
      )}
    </>
  );

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm" role="banner">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex justify-between items-center h-16">
          <Title 
            level={3} 
            className="!m-0 cursor-pointer text-base sm:text-xl md:text-2xl truncate max-w-[200px] sm:max-w-none"
            onClick={() => handleNavigation('/')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigation('/');
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Go to home page"
          >
            <span className="hidden sm:inline">Event Ticketing System</span>
            <span className="sm:hidden">Event Tickets</span>
          </Title>
          
          <div className="hidden md:block" role="navigation" aria-label="Desktop menu">
            <Space size="small">
              {navigationButtons}
            </Space>
          </div>

          <Button
            className="md:hidden"
            icon={<MenuOutlined />}
            onClick={() => setDrawerVisible(true)}
            type="text"
            aria-label="Open navigation menu"
            aria-expanded={drawerVisible}
            aria-controls="mobile-menu"
          />
        </div>
      </nav>

      <Drawer
        title="Menu"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
        id="mobile-menu"
        aria-label="Mobile navigation menu"
      >
        <nav aria-label="Mobile menu">
          <Space direction="vertical" size="middle" className="w-full">
            {navigationButtons}
          </Space>
        </nav>
      </Drawer>
    </header>
  );
};

export default Header;
