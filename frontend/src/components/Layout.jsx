import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TopNav from './TopNav';
import SideNav from './SideNav';

const Layout = ({ children }) => {
  // All hooks must be called at the top level, before any early returns
  const authContext = useAuth();
  const { user, loading } = authContext;
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if current route is an admin route
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  // Auto-open sidebar on admin routes for desktop
  useEffect(() => {
    if (isAdminRoute && user?.role === 'admin' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    } else if (!isAdminRoute) {
      setSidebarOpen(false);
    }
  }, [isAdminRoute, user?.role]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Show loading state while auth context is initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNav 
        onToggleSidebar={handleToggleSidebar}
        sidebarOpen={sidebarOpen}
      />

      <div className="flex">
        {/* Admin Sidebar */}
        {user?.role === 'admin' && (
          <SideNav
            isOpen={sidebarOpen}
            onClose={handleCloseSidebar}
            onToggle={handleToggleSidebar}
          />
        )}

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${
          user?.role === 'admin' && sidebarOpen 
            ? 'lg:ml-80' 
            : 'lg:ml-0'
        }`}>
          <div className="min-h-screen">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
