import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import EventDetailsPage from './pages/EventDetailsPage';
import CreateEventPage from './pages/CreateEventPage';
import EditEventPage from './pages/EditEventPage';
import MyTicketsPage from './pages/MyTicketsPage';
import OrganizerDashboardPage from './pages/OrganizerDashboardPage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/AppLayout';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/events" element={<HomePage />} />
            <Route path="/events/:eventId" element={<EventDetailsPage />} />
            
            <Route 
              path="/events/create" 
              element={
                <ProtectedRoute>
                  <CreateEventPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/events/:eventId/edit" 
              element={
                <ProtectedRoute>
                  <EditEventPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-tickets" 
              element={
                <ProtectedRoute>
                  <MyTicketsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/organizer/dashboard" 
              element={
                <ProtectedRoute>
                  <OrganizerDashboardPage />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<div>404 - Page Not Found</div>} />
          </Routes>
        </AppLayout>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
