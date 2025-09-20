// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  SIGNUP_VALIDATE: `${API_BASE_URL}/api/auth/validate-signup`,
  SIGNUP_VERIFY: `${API_BASE_URL}/api/auth/send-verification`,
  SIGNUP_COMPLETE: `${API_BASE_URL}/api/auth/complete-signup`,
  REFRESH: `${API_BASE_URL}/api/auth/refresh`,
  ME: `${API_BASE_URL}/api/auth/me`,
  VERIFY_OTP: `${API_BASE_URL}/api/auth/verify-otp`,
  RESEND_OTP: `${API_BASE_URL}/api/auth/resend-otp`,
  SEND_PHONE_VERIFICATION: `${API_BASE_URL}/api/auth/send-phone-verification`,
  VERIFY_PHONE_OTP: `${API_BASE_URL}/api/auth/verify-phone-otp`,
  
  // Reports endpoints
  REPORTS: `${API_BASE_URL}/api/reports`,
  REPORTS_NEARBY: `${API_BASE_URL}/api/reports/nearby`,
  REPORTS_CHECK_DUPLICATE: `${API_BASE_URL}/api/reports/check-duplicate`,
  REPORTS_CREATE: `${API_BASE_URL}/api/reports`,
  REPORTS_BY_ID: (id) => `${API_BASE_URL}/api/reports/${id}`,
  REPORTS_TIMELINE: (id) => `${API_BASE_URL}/api/reports/${id}/timeline`,
  REPORTS_UPDATE: (id) => `${API_BASE_URL}/api/reports/${id}/updates`,
  REPORTS_CLOSE: (id) => `${API_BASE_URL}/api/reports/${id}/close`,
  REPORTS_VERIFY: (id) => `${API_BASE_URL}/api/reports/${id}/verify`,
  REPORTS_VERIFICATION: (id) => `${API_BASE_URL}/api/reports/${id}/verification`,
  REPORT_VOTE: (id) => `${API_BASE_URL}/api/reports/${id}/vote`,
  
  // City Change Request endpoints
  CITY_CHANGE_REQUEST: `${API_BASE_URL}/api/city-change`,
  CITY_CHANGE_MY_REQUESTS: `${API_BASE_URL}/api/city-change/my-requests`,
  CITY_CHANGE_ALL: `${API_BASE_URL}/api/city-change/all`,
  CITY_CHANGE_UPDATE: (id) => `${API_BASE_URL}/api/city-change/${id}`,
  
  // Cities endpoints
  CITIES: `${API_BASE_URL}/api/cities`,
  
  // Events endpoints
  EVENTS: `${API_BASE_URL}/api/events`,
  
  // Alerts endpoints
  ALERTS: `${API_BASE_URL}/api/alerts`,
  
  // Comments endpoints
  COMMENTS: (reportId) => `${API_BASE_URL}/api/comments/${reportId}`,
  COMMENTS_DELETE: (commentId) => `${API_BASE_URL}/api/comments/${commentId}`,
  
  // Users endpoints
  USERS_ME: `${API_BASE_URL}/api/users/me`,
  USERS_CITY: `${API_BASE_URL}/api/users/me/city`,
  USERS_PROFILE: `${API_BASE_URL}/api/users/me/profile`,
  
  // Cities endpoints
  CITIES: `${API_BASE_URL}/api/cities`,
  
  // Attachments endpoints
  ATTACHMENTS_UPLOAD: (reportId) => `${API_BASE_URL}/api/attachments/${reportId}/upload`,
  ATTACHMENTS_GET: (reportId) => `${API_BASE_URL}/api/attachments/${reportId}`,
  ATTACHMENTS_DELETE: (attachmentId) => `${API_BASE_URL}/api/attachments/${attachmentId}`,
  
  // Notifications endpoints
  NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
  NOTIFICATIONS_READ: `${API_BASE_URL}/api/notifications/read`,
  NOTIFICATIONS_UNREAD_COUNT: `${API_BASE_URL}/api/notifications/unread-count`,
  
  // Admin endpoints
  ADMIN_DASHBOARD: `${API_BASE_URL}/api/admin/dashboard/stats`,
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_REPORTS: `${API_BASE_URL}/api/admin/reports`,
  ADMIN_AUDIT: `${API_BASE_URL}/api/admin/audit`,
  ADMIN_USER_ROLE: (userId) => `${API_BASE_URL}/api/admin/users/${userId}/role`,
  ADMIN_USER_BAN: (userId) => `${API_BASE_URL}/api/admin/users/${userId}/ban`,
  ADMIN_USER_CITY: (userId) => `${API_BASE_URL}/api/admin/users/${userId}/city`,
  ADMIN_REPORT_DELETE: (reportId) => `${API_BASE_URL}/api/admin/reports/${reportId}`,
  ADMIN_REPORT_RESTORE: (reportId) => `${API_BASE_URL}/api/admin/reports/${reportId}/restore`,
  CREATE_AUTHORITY: `${API_BASE_URL}/api/admin/create-authority`,
  AUTHORITY_TYPES: `${API_BASE_URL}/api/admin/authority-types`,
  AUTHORITY_TYPE_BY_ID: (id) => `${API_BASE_URL}/api/admin/authority-types/${id}`,
  
  // Alerts endpoints
  ALERTS: `${API_BASE_URL}/api/alerts`,
  ALERTS_MY: `${API_BASE_URL}/api/alerts/my/alerts`,
  ALERTS_BY_ID: (id) => `${API_BASE_URL}/api/alerts/${id}`,
  ALERTS_UPDATE: (id) => `${API_BASE_URL}/api/alerts/${id}`,
  ALERTS_DELETE: (id) => `${API_BASE_URL}/api/alerts/${id}`,
  
  // Events endpoints
  EVENTS: `${API_BASE_URL}/api/events`,
  EVENTS_MY: `${API_BASE_URL}/api/events/my/events`,
  EVENTS_BY_ID: (id) => `${API_BASE_URL}/api/events/${id}`,
  EVENTS_DELETE: (id) => `${API_BASE_URL}/api/events/${id}`,

  // AI endpoints
  AI_CHAT: `${API_BASE_URL}/api/ai/chat`,
  AI_CITY_UPDATES: `${API_BASE_URL}/api/ai/city-updates`,
  AI_SUGGESTIONS: `${API_BASE_URL}/api/ai/suggestions`,
  AI_HELP: `${API_BASE_URL}/api/ai/help`,
  AI_STATUS: `${API_BASE_URL}/api/ai/status`,
  AI_ANALYZE_AUTHORITY: `${API_BASE_URL}/api/ai/analyze-report-authority`,

  // Analytics endpoints
  ANALYTICS_DASHBOARD: `${API_BASE_URL}/api/analytics/dashboard`,
  ANALYTICS_USERS: `${API_BASE_URL}/api/analytics/users`,
  ANALYTICS_REPORTS: `${API_BASE_URL}/api/analytics/reports`,
  ANALYTICS_EVENTS: `${API_BASE_URL}/api/analytics/events`,
  ANALYTICS_ALERTS: `${API_BASE_URL}/api/analytics/alerts`,
  ANALYTICS_AUTHORITY_DASHBOARD: `${API_BASE_URL}/api/analytics/authority/dashboard`,
  ANALYTICS_ADMIN_COMPREHENSIVE: `${API_BASE_URL}/api/analytics/admin/comprehensive`,

  // User Reports endpoints
  USER_REPORTS: `${API_BASE_URL}/api/user-reports`,
  USER_REPORTS_ANALYTICS: `${API_BASE_URL}/api/user-reports/analytics`,
  USER_REPORT_STATUS: (id) => `${API_BASE_URL}/api/user-reports/${id}/status`,
};

export default API_BASE_URL;
