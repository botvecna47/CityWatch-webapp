import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_ENDPOINTS } from '../config/api';
import LazyImage from './LazyImage';
import { 
  MessageCircle, 
  ThumbsUp, 
  AlertTriangle, 
  TrendingUp,
  Users,
  Star
} from 'lucide-react';

const ReportCard = ({ report, onDelete, onVote }) => {
  const { user, makeAuthenticatedRequest } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [userVote, setUserVote] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);

  useEffect(() => {
    fetchUserVote();
  }, [report.id]);

  const fetchUserVote = async () => {
    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.REPORT_VOTE(report.id), {
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserVote(data.data);
      }
    } catch (error) {
      console.error('Error fetching user vote:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'URGENT':
        return <AlertTriangle className="w-3 h-3" />;
      case 'HIGH':
        return <TrendingUp className="w-3 h-3" />;
      case 'MEDIUM':
        return <Star className="w-3 h-3" />;
      case 'LOW':
        return <ThumbsUp className="w-3 h-3" />;
      default:
        return <Star className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN':
        return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleVote = async (severity) => {
    if (!user || user.role !== 'citizen') return;
    
    setIsVoting(true);
    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.REPORT_VOTE(report.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ severity })
      });

      if (response.ok) {
        const data = await response.json();
        setUserVote({ hasVoted: true, severity });
        showSuccess(data.message);
        setShowVoteModal(false);
        if (onVote) onVote(report.id, data.data);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      showError('Failed to vote on report');
    } finally {
      setIsVoting(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const isOwner = user && report.authorId === user.id;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-200 hover:shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-sm">
              📝
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{report.author?.username}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">{report.city?.name}</span>
              </div>
              <div className="text-xs text-gray-500">{formatTimestamp(report.createdAt)}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Priority Badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(report.priority)}`}>
              {getPriorityIcon(report.priority)}
              <span className="ml-1">{report.priority}</span>
            </span>
            
            {/* Status Badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
              {report.status.replace('_', ' ')}
            </span>

            {isOwner && onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(report.id);
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
            {report.title}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">
            {truncateText(report.description)}
          </p>
          
          {/* Images Gallery */}
          {report.attachments && report.attachments.length > 0 && (
            <div className="mb-3">
              {report.attachments.length === 1 ? (
                // Single image
                <div className="w-full h-48 rounded-lg overflow-hidden">
                  <LazyImage
                    src={`http://localhost:5000${report.attachments[0].url}`}
                    alt={report.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                // Multiple images - show first image with count
                <div className="relative w-full h-48 rounded-lg overflow-hidden group cursor-pointer">
                  <LazyImage
                    src={`http://localhost:5000${report.attachments[0].url}`}
                    alt={report.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Image count overlay */}
                  <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                    {report.attachments.length} images
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium transition-opacity duration-200">
                      View All Images
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to={`/reports/${report.id}`}
                className="text-sm font-medium text-blue-700 hover:underline"
              >
                View Details
              </Link>
              
              <span className="text-sm text-gray-500 flex items-center">
                <MessageCircle className="w-4 h-4 mr-1" />
                {report.comments?.length || 0}
              </span>

              {/* Voting Section */}
              {user && user.role === 'citizen' && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {report.voteCount || 1}
                  </span>
                  
                  <button
                    onClick={() => setShowVoteModal(true)}
                    className={`text-sm flex items-center px-2 py-1 rounded-md transition-colors ${
                      userVote?.hasVoted 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    {userVote?.hasVoted ? `Voted (${userVote.severity})` : 'Vote Severity'}
                  </button>
                </div>
              )}

              {/* Severity Display */}
              <span className="text-sm text-gray-500">
                Severity: {report.severity || 1}/10
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vote Modal */}
      {showVoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Vote on Report Severity
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              How severe do you think this issue is? (1 = Minor, 10 = Critical)
            </p>
            
            <div className="grid grid-cols-5 gap-2 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((severity) => (
                <button
                  key={severity}
                  onClick={() => handleVote(severity)}
                  disabled={isVoting}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    userVote?.severity === severity
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {severity}
                </button>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowVoteModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                disabled={isVoting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportCard;
