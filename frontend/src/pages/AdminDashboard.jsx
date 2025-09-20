import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { API_ENDPOINTS } from '../config/api';
import AnalyticsCharts from '../components/charts/AnalyticsCharts';
import {
  Users,
  FileText,
  Shield,
  TrendingUp
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout, makeAuthenticatedRequest } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  
  // Data states
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalReports: 0,
    totalCities: 0,
    activeReports: 0
  });
  const [loading, setLoading] = useState(true);


  // Fetch dashboard data
  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('📊 Fetching admin dashboard data for user:', user.username);
      console.log('📊 API Endpoint:', API_ENDPOINTS.ADMIN_DASHBOARD);

      // Fetch real dashboard stats from API
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.ADMIN_DASHBOARD);
      
      console.log('📊 Response status:', response.status);
      console.log('📊 Response headers:', response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Dashboard data received:', data);
        setStats({
          totalUsers: data.stats.totalUsers,
          totalReports: data.stats.totalReports,
          totalCities: data.stats.totalCities,
          activeReports: data.stats.openReports
        });
      } else {
        const errorData = await response.json();
        console.error('📊 Dashboard error response:', errorData);
        throw new Error(`Failed to fetch dashboard data: ${errorData.error || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('📊 Error fetching dashboard data:', error);
      showError(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-primary-100 rounded-xl">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReports}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-xl">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cities</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCities}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-warning-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-warning-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeReports}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts */}
        <div className="mb-8">
          <AnalyticsCharts />
        </div>
    </div>
  );
};

export default AdminDashboard;