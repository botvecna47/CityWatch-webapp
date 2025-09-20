import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config/api';
import { Bell, Calendar, MapPin, User, AlertTriangle, Info, CheckCircle } from 'lucide-react';

const Announcements = () => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, alerts, events

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
    }
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch both alerts and events using makeAuthenticatedRequest
      const [alertsResponse, eventsResponse] = await Promise.all([
        makeAuthenticatedRequest(`${API_ENDPOINTS.ALERTS}`),
        makeAuthenticatedRequest(`${API_ENDPOINTS.EVENTS}`)
      ]);

      if (alertsResponse.ok && eventsResponse.ok) {
        const alertsData = await alertsResponse.json();
        const eventsData = await eventsResponse.json();
        
        // Combine alerts and events into announcements
        const combinedAnnouncements = [
          ...(alertsData.alerts || []).map(alert => ({
            ...alert,
            type: 'alert',
            date: alert.createdAt
          })),
          ...(eventsData.events || []).map(event => ({
            ...event,
            type: 'event',
            date: event.dateTime
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        setAnnouncements(combinedAnnouncements);
      } else {
        const alertsError = !alertsResponse.ok ? await alertsResponse.json() : null;
        const eventsError = !eventsResponse.ok ? await eventsResponse.json() : null;
        console.error('Announcements API Errors:', { alertsError, eventsError });
        setError('Failed to fetch announcements');
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Failed to fetch announcements: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    if (filter === 'all') return true;
    return announcement.type === filter;
  });

  const getAnnouncementIcon = (type) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'event':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getAnnouncementColor = (type) => {
    switch (type) {
      case 'alert':
        return 'border-l-red-500 bg-red-50';
      case 'event':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Announcements</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchAnnouncements}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
              <p className="text-gray-600">Stay updated with the latest alerts and events in your city</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            {[
              { key: 'all', label: 'All', count: announcements.length },
              { key: 'alert', label: 'Alerts', count: announcements.filter(a => a.type === 'alert').length },
              { key: 'event', label: 'Events', count: announcements.filter(a => a.type === 'event').length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </motion.div>

        {/* Announcements List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {filteredAnnouncements.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Announcements</h3>
              <p className="text-gray-600">
                {filter === 'all' 
                  ? "There are no announcements in your city yet."
                  : `There are no ${filter}s in your city yet.`
                }
              </p>
            </div>
          ) : (
            filteredAnnouncements.map((announcement, index) => (
              <motion.div
                key={`${announcement.type}-${announcement.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-lg p-6 border-l-4 ${getAnnouncementColor(announcement.type)} border border-gray-200 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getAnnouncementIcon(announcement.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {announcement.title}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {getTimeAgo(announcement.date)}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-3">
                      {announcement.type === 'alert' ? announcement.message : announcement.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{announcement.creator?.username || 'Unknown'}</span>
                        </div>
                        {announcement.location && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>{announcement.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.type === 'alert' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {announcement.type === 'alert' ? 'Alert' : 'Event'}
                        </span>
                        {announcement.isPinned && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pinned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Announcements;
