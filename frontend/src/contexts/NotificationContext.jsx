import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import requestThrottle from '../utils/requestThrottle';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  // All hooks must be called at the top level, before any early returns
  const authContext = useAuth();
  const { user, makeAuthenticatedRequest } = authContext;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Reduced polling interval (2 minutes) and add request deduplication
  const POLLING_INTERVAL = 120000; // 2 minutes instead of 30 seconds
  const REQUEST_CACHE_DURATION = 30000; // 30 seconds cache

  // Fetch notifications from API with caching and deduplication
  const fetchNotifications = useCallback(async (page = 1, limit = 20, unreadOnly = false, forceRefresh = false) => {
    if (!user) return;

    // Check if we should skip this request due to recent fetch
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTime) < REQUEST_CACHE_DURATION) {
      return null; // Skip request, data is still fresh
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(unreadOnly && { unreadOnly: 'true' })
      });

      const response = await makeAuthenticatedRequest(`http://localhost:5000/api/notifications?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setLastFetchTime(now); // Update last fetch time
      return data.data;
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, makeAuthenticatedRequest, REQUEST_CACHE_DURATION]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const response = await makeAuthenticatedRequest('http://localhost:5000/api/notifications/unread-count');

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [user, makeAuthenticatedRequest]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!user) return false;

    try {
      const response = await makeAuthenticatedRequest(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return false;
    }
  }, [user, makeAuthenticatedRequest]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return false;

    try {
      const response = await makeAuthenticatedRequest('http://localhost:5000/api/notifications/read-all', {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );

      // Reset unread count
      setUnreadCount(0);

      return true;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      return false;
    }
  }, [user, makeAuthenticatedRequest]);

  // Load initial notifications
  const loadNotifications = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    const data = await fetchNotifications(1, 20, false, forceRefresh);
    if (data) {
      setNotifications(data.notifications || data.data?.notifications || []);
    }

    // Also fetch unread count
    await fetchUnreadCount();
  }, [user, fetchNotifications, fetchUnreadCount]);

  // Set up polling with optimized intervals
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLastFetchTime(0);
      return;
    }

    // Load initial data only once
    loadNotifications();

    // Set up polling interval with reduced frequency
    const interval = setInterval(() => {
      // Only fetch unread count, not full notifications list
      fetchUnreadCount();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [user, loadNotifications, fetchUnreadCount]);

  // Refresh notifications (for manual refresh)
  const refreshNotifications = useCallback(async () => {
    await loadNotifications(true); // Force refresh
  }, [loadNotifications]);

  // Navigate to notification link
  const navigateToNotification = useCallback((notification, navigate) => {
    if (notification.link) {
      // Mark as read first
      markAsRead(notification.id);
      
      // Navigate using React Router
      navigate(notification.link);
    }
  }, [markAsRead]);

  // Format notification time
  const formatNotificationTime = useCallback((timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    navigateToNotification,
    formatNotificationTime,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};