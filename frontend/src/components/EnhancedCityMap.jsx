import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const createCustomIcon = (color, iconType = 'marker') => {
  const iconHtml = iconType === 'user' 
    ? `<div style="
        width: 20px; 
        height: 20px; 
        background-color: ${color}; 
        border: 3px solid white; 
        border-radius: 50%; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`
    : `<div style="
        width: 25px; 
        height: 25px; 
        background-color: ${color}; 
        border: 2px solid white; 
        border-radius: 50% 50% 50% 0; 
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      "><div style="
        transform: rotate(45deg);
        color: white;
        font-size: 12px;
        font-weight: bold;
      ">!</div></div>`;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-icon',
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

// Map center updater component
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
};

const EnhancedCityMap = ({ height = '500px', showFilters = true }) => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const { showToast } = useToast();
  
  // State
  const [userLocation, setUserLocation] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to NYC
  const [mapZoom, setMapZoom] = useState(10);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  // Get user's current location
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationPermission('denied');
      showToast('Geolocation is not supported by this browser', 'error');
      return;
    }

    setLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { lat: latitude, lng: longitude };
        
        setUserLocation(location);
        setLocationPermission('granted');
        setLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationPermission('denied');
        setLoading(false);
        
        let message = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied. Please enable location permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
        }
        showToast(message, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  }, [showToast]);

  // Watch user's location
  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation || !userLocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        
        setUserLocation(newLocation);
      },
      (error) => {
        console.error('Error watching location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minute
      }
    );
  }, [userLocation]);

  // Stop watching location
  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Fetch all reports for map display
  const fetchAllReports = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);
      
      const response = await makeAuthenticatedRequest(
        `http://localhost:5000/api/reports/map/all?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setAllReports(data.reports || []);
        setFilteredReports(data.reports || []);
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Failed to fetch reports', 'error');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      showToast('Failed to fetch reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, makeAuthenticatedRequest, showToast, selectedCategory, selectedStatus]);

  // Toggle user location display
  const toggleUserLocation = useCallback(() => {
    const newShowUserLocation = !showUserLocation;
    setShowUserLocation(newShowUserLocation);
    
    if (newShowUserLocation && !userLocation) {
      getUserLocation();
    }
  }, [showUserLocation, userLocation, getUserLocation]);

  // Request location permission
  const requestLocation = useCallback(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Center map on user location
  const centerOnUser = useCallback(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(15);
    }
  }, [userLocation]);

  // Center map on all reports
  const centerOnReports = useCallback(() => {
    if (filteredReports.length > 0) {
      const bounds = L.latLngBounds();
      filteredReports.forEach(report => {
        bounds.extend([report.latitude, report.longitude]);
      });
      
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [filteredReports]);

  // Get status color for reports
  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN':
        return '#ef4444'; // red
      case 'IN_PROGRESS':
        return '#f59e0b'; // yellow
      case 'RESOLVED':
        return '#10b981'; // green
      case 'CLOSED':
        return '#6b7280'; // gray
      default:
        return '#3b82f6'; // blue
    }
  };

  // Get category color for reports
  const getCategoryColor = (category) => {
    switch (category) {
      case 'GARBAGE':
        return '#8b5cf6'; // purple
      case 'ROAD':
        return '#f59e0b'; // amber
      case 'WATER':
        return '#06b6d4'; // cyan
      case 'POWER':
        return '#f97316'; // orange
      default:
        return '#6b7280'; // gray
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get unique categories from reports
  const getUniqueCategories = () => {
    const categories = [...new Set(allReports.map(report => report.category))];
    return categories.sort();
  };

  // Get unique statuses from reports
  const getUniqueStatuses = () => {
    const statuses = [...new Set(allReports.map(report => report.status))];
    return statuses.sort();
  };

  // Apply filters
  useEffect(() => {
    let filtered = allReports;
    
    if (selectedCategory) {
      filtered = filtered.filter(report => report.category === selectedCategory);
    }
    
    if (selectedStatus) {
      filtered = filtered.filter(report => report.status === selectedStatus);
    }
    
    setFilteredReports(filtered);
  }, [allReports, selectedCategory, selectedStatus]);

  // Fetch reports on component mount and when filters change
  useEffect(() => {
    fetchAllReports();
  }, [fetchAllReports]);

  // Start/stop location watching
  useEffect(() => {
    if (showUserLocation && userLocation) {
      startLocationWatch();
    } else {
      stopLocationWatch();
    }

    return () => stopLocationWatch();
  }, [showUserLocation, userLocation, startLocationWatch, stopLocationWatch]);

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 space-y-3 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">City Reports Map</h3>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {filteredReports.length} Reports
          </span>
          {locationPermission === 'granted' && showUserLocation && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              Location Active
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center space-x-2">
          {/* Filter Controls */}
          {showFilters && (
            <>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {getUniqueCategories().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {getUniqueStatuses().map(status => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
            </>
          )}
          
          {/* Location Controls */}
          {locationPermission === 'prompt' && (
            <button
              onClick={requestLocation}
              disabled={loading}
              className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
            >
              {loading ? 'Getting Location...' : 'Enable Location'}
            </button>
          )}
          
          {locationPermission === 'granted' && (
            <button
              onClick={toggleUserLocation}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                showUserLocation
                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                  : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {showUserLocation ? 'Hide My Location' : 'Show My Location'}
            </button>
          )}
          
          {filteredReports.length > 0 && (
            <button
              onClick={centerOnReports}
              className="px-3 py-1 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
            >
              View All Reports
            </button>
          )}
          
          {showUserLocation && userLocation && (
            <button
              onClick={centerOnUser}
              className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
            >
              Center On Me
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-200">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            
            {/* User location marker */}
            {showUserLocation && userLocation && (
              <>
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={createCustomIcon('#3b82f6', 'user')}
                >
                  <Popup>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">Your Location</div>
                      <div className="text-sm text-gray-600">
                        {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
                
                {/* Search radius circle */}
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={1000} // 1km in meters
                  pathOptions={{
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    weight: 2
                  }}
                />
              </>
            )}
            
            {/* All reports markers */}
            {filteredReports.map((report) => (
              <Marker
                key={report.id}
                position={[report.latitude, report.longitude]}
                icon={createCustomIcon(getStatusColor(report.status))}
              >
                <Popup>
                  <div className="max-w-xs">
                    <div className="font-semibold text-gray-900 mb-1">{report.title}</div>
                    <div className="text-xs text-blue-600 font-medium mb-1">{report.city?.name}</div>
                    <div className="text-sm text-gray-600 mb-2 line-clamp-2">{report.description}</div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        report.status === 'OPEN' ? 'bg-red-100 text-red-800' :
                        report.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                        report.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {report.status.replace('_', ' ')}
                      </span>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        report.category === 'GARBAGE' ? 'bg-purple-100 text-purple-800' :
                        report.category === 'ROAD' ? 'bg-amber-100 text-amber-800' :
                        report.category === 'WATER' ? 'bg-cyan-100 text-cyan-800' :
                        report.category === 'POWER' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {report.category}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-1">
                      By {report.author.username} • {formatDate(report.createdAt)}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {report._count.comments} comments • {report._count.votes} votes
                    </div>
                    
                    {report.city && (
                      <div className="text-xs text-gray-500 mt-1">
                        📍 {report.city.name}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Loading reports...</span>
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {locationPermission === 'denied' && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-800">
              Location access denied. Enable location permissions to see your position on the map.
            </div>
          </div>
        </div>
      )}

      {filteredReports.length === 0 && !loading && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="text-sm text-gray-600 text-center">
            {allReports.length === 0 
              ? 'No reports found in your city.' 
              : 'No reports match the current filters.'}
          </div>
        </div>
      )}

      {filteredReports.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-800">
            Showing {filteredReports.length} of {allReports.length} reports on the map.
            {selectedCategory && ` Filtered by category: ${selectedCategory}.`}
            {selectedStatus && ` Filtered by status: ${selectedStatus.replace('_', ' ')}.`}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCityMap;
