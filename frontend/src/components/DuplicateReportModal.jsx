import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Eye, X, FileText, MapPin, Clock, ThumbsUp, Flag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_ENDPOINTS } from '../config/api';
import Button from './ui/Button';

const DuplicateReportModal = ({ isOpen, onClose, matches, onViewReport, onSubmitAnyway }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportType, setReportType] = useState('MISLEADING_CONTENT');
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle severity voting
  const handleVoteSeverity = async (severity) => {
    if (!selectedReport) return;
    
    setIsVoting(true);
    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.REPORT_VOTE(selectedReport.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ severity })
      });

      if (response.ok) {
        showSuccess('Your vote has been recorded! Thank you for helping prioritize this issue.');
        setShowVoteModal(false);
        setSelectedReport(null);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to vote on report severity');
      }
    } catch (error) {
      console.error('Error voting on report:', error);
      showError('Failed to vote on report severity');
    } finally {
      setIsVoting(false);
    }
  };

  // Handle reporting misleading content
  const handleReportMisleading = async () => {
    if (!selectedReport || !reportReason.trim()) return;
    
    setIsReporting(true);
    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.REPORTS_BY_ID(selectedReport.id) + '/report-misleading', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          reason: reportReason.trim(),
          type: 'MISLEADING_CONTENT'
        })
      });

      if (response.ok) {
        showSuccess('Report submitted to admin for review. Thank you for helping maintain report quality.');
        setShowReportModal(false);
        setSelectedReport(null);
        setReportReason('');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to report misleading content');
      }
    } catch (error) {
      console.error('Error reporting misleading content:', error);
      showError('Failed to report misleading content');
    } finally {
      setIsReporting(false);
    }
  };

  // Open vote modal
  const openVoteModal = (report) => {
    setSelectedReport(report);
    setShowVoteModal(true);
  };

  // Open report modal
  const openReportModal = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.9) return 'text-red-600';
    if (similarity >= 0.8) return 'text-orange-600';
    return 'text-yellow-600';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Potential Duplicate Report
                  </h2>
                  <p className="text-sm text-gray-600">
                    We found {matches.length} similar report{matches.length > 1 ? 's' : ''} in your area
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-orange-800 mb-1">
                      Duplicate Detection
                    </h3>
                    <p className="text-sm text-orange-700">
                      Please review the similar reports below. You can view an existing report or submit your report anyway if it's different.
                    </p>
                  </div>
                </div>
              </div>

              {/* Matches List */}
              <div className="space-y-4">
                {matches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                          {match.title}
                        </h4>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {match.excerpt}
                        </p>
                      </div>
                      <div className="ml-4 flex flex-col items-end space-y-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(match.status)}`}>
                          {match.status.replace('_', ' ')}
                        </span>
                        <span className={`text-xs font-medium ${getSimilarityColor(match.similarity)}`}>
                          {Math.round(match.similarity * 100)}% similar
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(match.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye className="w-4 h-4" />}
                        onClick={() => onViewReport(match.id)}
                      >
                        View Report
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        leftIcon={<ThumbsUp className="w-4 h-4" />}
                        onClick={() => openVoteModal(match)}
                      >
                        Vote Severity
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Flag className="w-4 h-4" />}
                        onClick={() => openReportModal(match)}
                      >
                        Report Issue
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                <p>Is your report different from these? You can still submit it.</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="secondary"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  onClick={onSubmitAnyway}
                  leftIcon={<FileText className="w-4 h-4" />}
                >
                  Submit Anyway
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Vote Severity Modal */}
      <AnimatePresence>
        {showVoteModal && selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Vote on Report Severity
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                How severe is this issue? Your vote helps prioritize the response.
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Report: "{selectedReport.title}"
              </p>
              
              <div className="grid grid-cols-5 gap-2 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((severity) => (
                  <button
                    key={severity}
                    onClick={() => handleVoteSeverity(severity)}
                    disabled={isVoting}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      isVoting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                    } ${
                      severity <= 3 ? 'border-red-300 text-red-700 bg-red-50' :
                      severity <= 6 ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                      'border-green-300 text-green-700 bg-green-50'
                    }`}
                  >
                    {severity}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowVoteModal(false)}
                  disabled={isVoting}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Misleading Content Modal */}
      <AnimatePresence>
        {showReportModal && selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Report Misleading Content
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                If this report contains incorrect or misleading information, please provide details below.
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Report: "{selectedReport.title}"
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for reporting *
                </label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Please explain why this report is misleading or incorrect..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  disabled={isReporting}
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportReason('');
                  }}
                  disabled={isReporting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReportMisleading}
                  disabled={isReporting || !reportReason.trim()}
                  loading={isReporting}
                >
                  Submit Report
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default DuplicateReportModal;
