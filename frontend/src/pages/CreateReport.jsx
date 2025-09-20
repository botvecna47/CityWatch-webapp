import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LocationPicker from '../components/LocationPicker';
import DuplicateReportModal from '../components/DuplicateReportModal';
import Button from '../components/ui/Button';
import { API_ENDPOINTS } from '../config/api';
import { MapPin, Map, X, Upload } from 'lucide-react';

const CreateReport = () => {
  const navigate = useNavigate();
  const { user, makeAuthenticatedRequest } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    latitude: '',
    longitude: ''
  });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMethod, setLocationMethod] = useState('current'); // 'current' or 'manual'
  const [showMap, setShowMap] = useState(false);
  
  // Duplicate detection state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [submittingAnyway, setSubmittingAnyway] = useState(false);

  // AI Analysis function
  const analyzeContent = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      setAiAnalysis(null);
      return;
    }

    console.log('🤖 Starting AI analysis for:', formData.title);
    setAnalyzing(true);
    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.AI_ANALYZE_AUTHORITY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim()
        })
      });

      console.log('🤖 AI Analysis response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🤖 AI Analysis data:', data);
        setAiAnalysis(data.data.analysis);
      } else {
        const errorData = await response.json();
        console.error('🤖 AI Analysis error:', errorData);
      }
    } catch (error) {
      console.error('🤖 AI analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  // Analyze content when title or description changes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      analyzeContent();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [formData.title, formData.description]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate file types and sizes - Only allow images for mandatory requirement
    const validFiles = selectedFiles.filter(file => {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validImageTypes.includes(file.type)) {
        setError(`File ${file.name} is not a supported image type. Please upload only images (JPEG, PNG, GIF, WebP).`);
        return false;
      }
      
      if (file.size > maxSize) {
        setError(`File ${file.name} is too large. Maximum size is 5MB.`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setError(''); // Clear any previous errors
      setFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Max 10 image files
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData({
          ...formData,
          latitude: latitude.toString(),
          longitude: longitude.toString()
        });
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationLoading(false);
        
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
        setError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const handleLocationSelect = (lat, lng) => {
    setFormData({
      ...formData,
      latitude: lat.toString(),
      longitude: lng.toString()
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required');
      setLoading(false);
      return;
    }

    if (formData.title.trim().length < 5) {
      setError('Title must be at least 5 characters long');
      setLoading(false);
      return;
    }

    // Location validation
    if (!formData.latitude || !formData.longitude) {
      setError('Location is required. Please select a location for your report.');
      setLoading(false);
      return;
    }

    if (formData.description.trim().length < 10) {
      setError('Description must be at least 10 characters long');
      setLoading(false);
      return;
    }

    // Image validation - At least 2 images required
    if (files.length < 2) {
      setError('At least 2 images are required to submit a report. Please upload clear photos of the issue.');
      setLoading(false);
      return;
    }

    try {
      // First, check for duplicates (unless submitting anyway)
      if (!submittingAnyway) {
        console.log('🔍 Checking for duplicates...', {
          title: formData.title.trim(),
          description: formData.description.trim(),
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude)
        });

        const duplicateResponse = await makeAuthenticatedRequest(API_ENDPOINTS.REPORTS_CHECK_DUPLICATE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: formData.title.trim(),
            description: formData.description.trim(),
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude)
          }),
        });

        console.log('📡 Duplicate check response status:', duplicateResponse.status);
        const duplicateData = await duplicateResponse.json();
        console.log('📋 Duplicate check response data:', duplicateData);

        if (duplicateResponse.ok && duplicateData.duplicate && duplicateData.matches.length > 0) {
          console.log('🚨 Duplicate detected! Showing modal...');
          // Show duplicate modal
          setDuplicateMatches(duplicateData.matches);
          setDuplicateModalOpen(true);
          setLoading(false);
          return;
        } else {
          console.log('✅ No duplicates found, proceeding with report creation...');
        }
      }

      // Create the report (with force=true if submitting anyway)
      const reportPayload = { ...formData };
      if (submittingAnyway) {
        reportPayload.force = true;
      }

      const reportResponse = await makeAuthenticatedRequest(API_ENDPOINTS.REPORTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportPayload),
      });

      const reportData = await reportResponse.json();

      if (!reportResponse.ok) {
        // Handle duplicate detection from server
        if (reportResponse.status === 409 && reportData.duplicate) {
          setDuplicateMatches(reportData.matches);
          setDuplicateModalOpen(true);
          setLoading(false);
          return;
        }
        throw new Error(reportData.error || 'Failed to create report');
      }

      // If files are selected, upload them
      if (files.length > 0) {
        const formDataFiles = new FormData();
        files.forEach(file => {
          formDataFiles.append('files', file);
        });

        const uploadResponse = await makeAuthenticatedRequest(`http://localhost:5000/api/attachments/${reportData.report.id}/upload`, {
          method: 'POST',
          body: formDataFiles,
        });

        if (!uploadResponse.ok) {
          const uploadError = await uploadResponse.json();
          console.warn('File upload failed:', uploadError.error);
          // Don't fail the entire operation if file upload fails
        }
      }

      // Show success message and redirect
      showSuccess('Report created successfully!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Duplicate modal handlers
  const handleViewReport = (reportId) => {
    navigate(`/reports/${reportId}`);
  };

  const handleSubmitAnyway = () => {
    setSubmittingAnyway(true);
    setDuplicateModalOpen(false);
    // Trigger form submission again
    handleSubmit({ preventDefault: () => {} });
  };

  const handleCloseDuplicateModal = () => {
    setDuplicateModalOpen(false);
    setDuplicateMatches([]);
    setSubmittingAnyway(false);
  };

  // Redirect if not a citizen
  if (user && user.role !== 'citizen') {
    navigate('/dashboard');
    return null;
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create New Report
            </h1>
            <p className="text-gray-600">
              Report an issue in your city to help improve community safety and services.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Report Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief description of the issue"
                  value={formData.title}
                  onChange={handleChange}
                />
                <p className="mt-1 text-sm text-gray-500">Minimum 5 characters</p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Provide detailed information about the issue, including location, severity, and any other relevant details..."
                  value={formData.description}
                  onChange={handleChange}
                />
                <p className="mt-1 text-sm text-gray-500">Minimum 10 characters</p>
              </div>

              {/* AI Analysis Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Analysis
                </label>
                
                {analyzing && (
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">Analyzing your report...</span>
                  </div>
                )}

                {aiAnalysis && !analyzing && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-green-800 mb-2">AI Analysis Complete</h4>
                        <div className="space-y-2 text-sm text-green-700">
                          <div>
                            <span className="font-medium">Category:</span> {aiAnalysis.category}
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              {(aiAnalysis.categoryConfidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Authority:</span> {aiAnalysis.authorityType}
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              {(aiAnalysis.authorityConfidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <div className="text-xs text-green-600 mt-2">
                            <span className="font-medium">Reasoning:</span> {aiAnalysis.categoryReasoning}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!aiAnalysis && !analyzing && formData.title.trim() && formData.description.trim() && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-gray-600">
                      Enter your title and description above for AI analysis...
                    </p>
                  </div>
                )}
              </div>

              {/* Location Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Location *</h3>
                
                {/* Location Method Selection */}
                <div className="mb-4">
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="locationMethod"
                        value="current"
                        checked={locationMethod === 'current'}
                        onChange={(e) => setLocationMethod(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Use my current location</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="locationMethod"
                        value="manual"
                        checked={locationMethod === 'manual'}
                        onChange={(e) => setLocationMethod(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Pick location manually</span>
                    </label>
                  </div>
                </div>

                {/* Current Location Option */}
                {locationMethod === 'current' && (
                  <div className="mb-4">
                    <Button
                      type="button"
                      onClick={getCurrentLocation}
                      loading={locationLoading}
                      leftIcon={<MapPin className="w-4 h-4" />}
                      size="sm"
                      variant="secondary"
                    >
                      {locationLoading ? 'Getting Location...' : 'Get Current Location'}
                    </Button>
                    <p className="mt-1 text-sm text-gray-500">
                      Use your device's GPS to automatically set the location
                    </p>
                  </div>
                )}

                {/* Manual Location Option */}
                {locationMethod === 'manual' && (
                  <div className="mb-4">
                    <Button
                      type="button"
                      onClick={() => setShowMap(!showMap)}
                      leftIcon={<Map className="w-4 h-4" />}
                      size="sm"
                      variant="secondary"
                    >
                      {showMap ? 'Hide Map' : 'Show Map'}
                    </Button>
                    <p className="mt-1 text-sm text-gray-500">
                      Click on the map to select a location
                    </p>
                    
                    {/* Map Picker */}
                    {showMap && (
                      <div className="mt-4">
                        <LocationPicker
                          onLocationSelect={handleLocationSelect}
                          initialLocation={
                            formData.latitude && formData.longitude
                              ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
                              : null
                          }
                          height="300px"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Location Display */}
                {(formData.latitude && formData.longitude) && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-800">Location Selected</p>
                        <p className="text-xs text-green-600">
                          {formData.latitude}, {formData.longitude}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Coordinate Input */}
                {locationMethod === 'manual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-2">
                        Latitude
                      </label>
                      <input
                        type="number"
                        id="latitude"
                        name="latitude"
                        step="any"
                        placeholder="e.g., 40.7128"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.latitude}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-2">
                        Longitude
                      </label>
                      <input
                        type="number"
                        id="longitude"
                        name="longitude"
                        step="any"
                        placeholder="e.g., -74.0060"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.longitude}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="files" className="block text-sm font-medium text-gray-700 mb-2">
                  Images * (Minimum 2 required)
                </label>
                <input
                  type="file"
                  id="files"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Upload clear photos of the issue (minimum 2 images, maximum 10 images, 5MB each)
                </p>
                <p className="mt-1 text-sm text-red-600 font-medium">
                  {files.length < 2 ? `${2 - files.length} more image(s) required` : `${files.length}/10 images uploaded`}
                </p>
                
                {files.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Images ({files.length}/10):</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {files.map((file, index) => (
                        <div key={index} className="relative bg-gray-50 rounded-lg p-2 border border-gray-200">
                          <div className="aspect-square bg-gray-100 rounded-md overflow-hidden mb-2">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-600 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Math.round(file.size / 1024)} KB
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeFile(index)}
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 p-1 h-6 w-6 bg-red-500 hover:bg-red-600 text-white rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>


              <div className="flex space-x-4">
                <Button
                  type="submit"
                  loading={loading}
                  fullWidth
                  className="flex-1"
                  disabled={!formData.title.trim() || !formData.description.trim() || !formData.latitude || !formData.longitude || files.length < 2}
                >
                  {loading ? 'Creating Report...' : 'Create Report'}
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  variant="secondary"
                  fullWidth
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

      {/* Duplicate Detection Modal */}
      <DuplicateReportModal
        isOpen={duplicateModalOpen}
        onClose={handleCloseDuplicateModal}
        matches={duplicateMatches}
        onViewReport={handleViewReport}
        onSubmitAnyway={handleSubmitAnyway}
      />
    </>
  );
};

export default CreateReport;


