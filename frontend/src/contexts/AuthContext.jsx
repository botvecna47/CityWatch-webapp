import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';
import requestThrottle from '../utils/requestThrottle';

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refreshAccessToken: async () => null,
  isRefreshing: false,
  lastFetchTime: 0
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a default context structure to prevent errors
    return {
      user: null,
      loading: true,
      login: async () => {},
      logout: () => {},
      refreshAccessToken: async () => null,
      isRefreshing: false,
      lastFetchTime: 0
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Load user data from localStorage first for immediate display
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch (error) {
          console.error('Error parsing cached user data:', error);
        }
      }
      // Then fetch fresh data from API
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, []);

  const refreshAccessToken = async () => {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshing) {
      return localStorage.getItem('accessToken');
    }

    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    setIsRefreshing(true);
    try {
      const response = await requestThrottle.throttleRequest(
        API_ENDPOINTS.REFRESH,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        },
        'REFRESH_TOKEN'
      );

      if (!response) {
        throw new Error('Request throttled');
      }

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setLastFetchTime(Date.now());
        return data.accessToken;
      } else {
        throw new Error('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchUserData = async (forceRefresh = false) => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      setLoading(false);
      return;
    }

    // Check if we should skip this request due to recent fetch
    const now = Date.now();
    const CACHE_DURATION = 60000; // 1 minute cache
    if (!forceRefresh && (now - lastFetchTime) < CACHE_DURATION) {
      setLoading(false);
      return; // Skip request, data is still fresh
    }

    try {
      const response = await requestThrottle.throttleRequest(
        API_ENDPOINTS.ME,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        'FETCH_USER_DATA'
      );

      if (!response) {
        setLoading(false);
        return; // Request was throttled
      }

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        // Cache user data in localStorage for faster loading
        localStorage.setItem('user', JSON.stringify(data.user));
        setLastFetchTime(now);
      } else if (response.status === 401) {
        // Token expired, try to refresh
        try {
          await refreshAccessToken();
        } catch (refreshError) {
          // Refresh failed, clear everything
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        // Other error, clear tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, tokens) => {
    if (tokens && tokens.accessToken && tokens.refreshToken) {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setLastFetchTime(Date.now()); // Update fetch time after login
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setLastFetchTime(0);
    setIsRefreshing(false);
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    let token = localStorage.getItem('accessToken');
    
    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    };

    try {
      // Use throttling for authenticated requests (but allow initial loads)
      const response = await requestThrottle.throttleRequest(
        url,
        requestOptions,
        `AUTH_${options.method || 'GET'}_${url}`
      );

      if (!response) {
        // For GET requests, retry once without throttling
        if ((options.method || 'GET') === 'GET') {
          console.log('Retrying GET request without throttling:', url);
          return await fetch(url, requestOptions);
        }
        throw new Error('Request throttled');
      }
      
      if (response.status === 401) {
        // Token expired, try to refresh
        try {
          token = await refreshAccessToken();
          requestOptions.headers['Authorization'] = `Bearer ${token}`;
          
          const retryResponse = await requestThrottle.throttleRequest(
            url,
            requestOptions,
            `AUTH_RETRY_${options.method || 'GET'}_${url}`
          );
          
          if (!retryResponse) {
            throw new Error('Retry request throttled');
          }
          
          return retryResponse;
        } catch (refreshError) {
          throw new Error('Authentication failed');
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    fetchUserData,
    refreshAccessToken,
    makeAuthenticatedRequest
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
