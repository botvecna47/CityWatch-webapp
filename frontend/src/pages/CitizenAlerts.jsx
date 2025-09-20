import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_ENDPOINTS } from '../config/api';
import { AlertTriangle, Clock, User, MapPin, ExternalLink } from 'lucide-react';

const CitizenAlerts = () => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const { error: showError } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch alerts for the citizen's city
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await makeAuthenticatedRequest(API_ENDPOINTS.ALERTS);
        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
        } else {
          const errorData = await response.json();
          showError(errorData.error || 'Failed to load alerts');
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
        showError('Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchAlerts();
    }
  }, [user, makeAuthenticatedRequest, showError]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const alertDate = new Date(dateString);
    const diffInHours = Math.floor((now - alertDate) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
  };

  const getAlertIcon = (isPinned) => {
    return isPinned ? (
      <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded-full">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
      </div>
    ) : (
      <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
        <AlertTriangle className="w-5 h-5 text-red-600" />
      </div>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Log In</h1>
          <p className="text-gray-600">You need to be logged in to view alerts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">City Alerts</h1>
              <p className="text-gray-600">
                Important announcements and alerts for {user.city?.name || 'your city'}
              </p>
            </div>
          </div>
          
          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900">Stay Informed</h3>
                <p className="text-sm text-blue-700 mt-1">
                  These alerts are sent by local authorities to keep you informed about important events, 
                  safety notices, and city updates. Please read them carefully and follow any instructions provided.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts Yet</h3>
              <p className="text-gray-600 mb-6">
                There are currently no active alerts for {user.city?.name || 'your city'}.
              </p>
              <div className="text-sm text-gray-500">
                <p>When authorities create important alerts, they will appear here.</p>
                <p className="mt-2">You can also check the <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 underline">Dashboard</Link> for the latest updates.</p>
              </div>
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`bg-white rounded-lg shadow-sm border-l-4 ${
                  alert.isPinned 
                    ? 'border-l-yellow-400 bg-yellow-50/30' 
                    : 'border-l-red-500'
                } hover:shadow-md transition-shadow duration-200`}
              >
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* Alert Icon */}
                    {getAlertIcon(alert.isPinned)}
                    
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {alert.title}
                            </h3>
                            {alert.isPinned && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Pinned
                              </span>
                            )}
                          </div>
                          
                          {/* Meta Information */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{getTimeAgo(alert.createdAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <User className="w-4 h-4" />
                              <span>by {alert.creator.username}</span>
                            </div>
                            {alert.city && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-4 h-4" />
                                <span>{alert.city.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Alert Message */}
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {alert.message}
                        </p>
                      </div>
                      
                      {/* Footer */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Created {formatDate(alert.createdAt)}
                            {alert.updatedAt !== alert.createdAt && (
                              <span className="ml-2">
                                • Updated {formatDate(alert.updatedAt)}
                              </span>
                            )}
                          </div>
                          
                          <Link
                            to={`/alerts/${alert.id}`}
                            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <span>View Details</span>
                            <ExternalLink className="w-4 h-4 ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Info */}
        {alerts.length > 0 && (
          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                <strong>{alerts.length}</strong> alert{alerts.length !== 1 ? 's' : ''} for {user.city?.name || 'your city'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Alerts are automatically updated as new information becomes available
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenAlerts;
