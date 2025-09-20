import React from 'react';
import EnhancedCityMap from '../components/EnhancedCityMap';

const ReportsMap = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">City Reports Map</h1>
              <p className="mt-2 text-gray-600">
                View all submitted reports on an interactive map. Filter by category and status to find specific issues.
              </p>
            </div>
            
            <EnhancedCityMap height="70vh" showFilters={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsMap;
