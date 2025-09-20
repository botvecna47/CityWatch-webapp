import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_ENDPOINTS } from '../config/api';
import { AlertTriangle, Clock, User, MapPin, ExternalLink } from 'lucide-react';

const Alerts = () => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    isPinned: false
  });

  // Fetch alerts
  useEffect(() => {
    const fetchAlerts = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // For authorities/admins, get their own alerts
        // For citizens, get all alerts in their city
        const endpoint = ['authority', 'admin'].includes(user.role) 
          ? API_ENDPOINTS.ALERTS_MY
          : API_ENDPOINTS.ALERTS;
          
        console.log('Fetching alerts from:', endpoint, 'for user role:', user.role);
        const response = await makeAuthenticatedRequest(endpoint);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Alerts response:', data);
          setAlerts(data.alerts || []);
        } else {
          const errorData = await response.json();
          console.error('Alerts API Error:', errorData);
          showError(errorData.error || 'Failed to load alerts');
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
        showError('Failed to load alerts: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [user, makeAuthenticatedRequest, showError]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      showError('Title and message are required');
      return;
    }

    try {
      const url = editingAlert 
        ? `http://localhost:5000/api/alerts/${editingAlert.id}`
        : 'http://localhost:5000/api/alerts';
      
      const method = editingAlert ? 'PATCH' : 'POST';
      
      const response = await makeAuthenticatedRequest(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess(editingAlert ? 'Alert updated successfully!' : 'Alert created successfully!');
        
        // Refresh alerts list
        const alertsResponse = await makeAuthenticatedRequest('http://localhost:5000/api/alerts/my/alerts');
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          setAlerts(alertsData.alerts);
        }
        
        // Reset form
        setFormData({ title: '', message: '', isPinned: false });
        setShowCreateForm(false);
        setEditingAlert(null);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to save alert');
      }
    } catch (error) {
      console.error('Error saving alert:', error);
      showError('Failed to save alert');
    }
  };

  const handleEdit = (alert) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title,
      message: alert.message,
      isPinned: alert.isPinned
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (alertId) => {
    if (!window.confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    try {
      const response = await makeAuthenticatedRequest(`http://localhost:5000/api/alerts/${alertId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess('Alert deleted successfully!');
        setAlerts(alerts.filter(alert => alert.id !== alertId));
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete alert');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      showError('Failed to delete alert');
    }
  };

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

  const isAuthorityOrAdmin = ['authority', 'admin'].includes(user?.role);

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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {isAuthorityOrAdmin ? 'City Alerts' : 'City Alerts'}
                    </h1>
                    <p className="text-gray-600">
                      {isAuthorityOrAdmin 
                        ? `Manage alerts for ${user.city?.name || 'your city'}`
                        : `Important announcements for ${user.city?.name || 'your city'}`
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              {isAuthorityOrAdmin && (
                <button
                  onClick={() => {
                    setShowCreateForm(true);
                    setEditingAlert(null);
                    setFormData({ title: '', message: '', isPinned: false });
                  }}
                  className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Alert
                </button>
              )}
            </div>
            
            {/* Info Card for Citizens */}
            {!isAuthorityOrAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
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
            )}
          </div>

          {/* Create/Edit Form - Only for Authority/Admin */}
          {isAuthorityOrAdmin && showCreateForm && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {editingAlert ? 'Edit Alert' : 'Create New Alert'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter alert title"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter alert message"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPinned"
                    name="isPinned"
                    checked={formData.isPinned}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isPinned" className="ml-2 block text-sm text-gray-700">
                    Pin this alert (appears at top)
                  </label>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {editingAlert ? 'Update Alert' : 'Create Alert'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingAlert(null);
                      setFormData({ title: '', message: '', isPinned: false });
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Alerts List */}
          {isAuthorityOrAdmin ? (
            // Authority/Admin View - Original table layout
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Your Alerts</h2>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading alerts...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-2H4v2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating your first alert.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{alert.title}</h3>
                            {alert.isPinned && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Pinned
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 mb-3 whitespace-pre-wrap">{alert.message}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Created {formatDate(alert.createdAt)}</span>
                            <span>by {alert.creator.username}</span>
                            {alert.updatedAt !== alert.createdAt && (
                              <span>Updated {formatDate(alert.updatedAt)}</span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex space-x-2">
                          <button
                            onClick={() => handleEdit(alert)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(alert.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Citizen View - Card layout
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
              
              {/* Footer Info for Citizens */}
              {alerts.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
