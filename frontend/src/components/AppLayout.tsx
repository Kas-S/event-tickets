import type { ReactNode } from 'react';
import { Layout } from 'antd';
import Header from './Header';

const { Content } = Layout;

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <Layout className="min-h-screen bg-gray-50">
      <Header />
      <Content>
        {children}
      </Content>
    </Layout>
  );
};

export default AppLayout;
