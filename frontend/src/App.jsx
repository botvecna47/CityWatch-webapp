import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AIAssistant from './components/AIAssistant';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import RoleBasedDashboard from './components/RoleBasedDashboard';
import CreateReport from './pages/CreateReport';
import ReportDetail from './pages/ReportDetail';
import ReportsPage from './pages/ReportsPage';
import ReportsMap from './pages/ReportsMap';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminReports from './pages/AdminReports';
import AdminSettings from './pages/AdminSettings';
import CreateAuthority from './pages/CreateAuthority';
import AuthorityTypes from './pages/AuthorityTypes';
import AdminCityChangeRequests from './pages/AdminCityChangeRequests';
import AdminEventApprovals from './pages/AdminEventApprovals';
import AlertDetail from './pages/AlertDetail';
import EventDetail from './pages/EventDetail';
import AuthorityDashboard from './pages/AuthorityDashboard';
import Alerts from './pages/Alerts';
import Events from './pages/Events';
import Announcements from './pages/Announcements';
import AnalyticsDashboard from './components/AnalyticsDashboard';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                <div className="App">
                  <Layout>
                    <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <RoleBasedDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/create" 
              element={
                <ProtectedRoute>
                  <CreateReport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/map" 
              element={
                <ProtectedRoute>
                  <ReportsMap />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/:id" 
              element={
                <ProtectedRoute>
                  <ReportDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/dashboard" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/users" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminUsers />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/reports" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminReports />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminSettings />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/create-authority" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <CreateAuthority />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/authority-types" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AuthorityTypes />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/city-requests" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminCityChangeRequests />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/event-approvals" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminEventApprovals />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AnalyticsDashboard />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="/alerts" 
              element={
                <ProtectedRoute>
                  <Alerts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/alerts/:id" 
              element={
                <ProtectedRoute>
                  <AlertDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/events" 
              element={
                <ProtectedRoute>
                  <Events />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/events/:id" 
              element={
                <ProtectedRoute>
                  <EventDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/announcements" 
              element={
                <ProtectedRoute>
                  <Announcements />
                </ProtectedRoute>
              } 
            />
                    </Routes>
                    <AIAssistant />
                  </Layout>
                </div>
              </Router>
            </ToastProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App
