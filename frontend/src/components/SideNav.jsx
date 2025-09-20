import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  FileText, 
  Settings, 
  Shield, 
  UserPlus, 
  Building2, 
  MapPin, 
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';

const SideNav = ({ isOpen, onClose, onToggle }) => {
  const location = useLocation();

  const adminNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Shield,
      path: '/admin/dashboard',
      description: 'Overview and analytics'
    },
    {
      id: 'users',
      label: 'Manage Users',
      icon: Users,
      path: '/admin/users',
      description: 'User management and roles'
    },
    {
      id: 'create-authority',
      label: 'Create Authority',
      icon: UserPlus,
      path: '/admin/create-authority',
      description: 'Add new authority accounts'
    },
    {
      id: 'authority-types',
      label: 'Authority Types',
      icon: Building2,
      path: '/admin/authority-types',
      description: 'Manage authority categories'
    },
    {
      id: 'city-requests',
      label: 'City Requests',
      icon: MapPin,
      path: '/admin/city-requests',
      description: 'Handle city change requests'
    },
    {
      id: 'event-approvals',
      label: 'Event Approvals',
      icon: Calendar,
      path: '/admin/event-approvals',
      description: 'Review pending events'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      path: '/admin/analytics',
      description: 'Data analytics and insights'
    },
    {
      id: 'reports',
      label: 'Manage Reports',
      icon: FileText,
      path: '/admin/reports',
      description: 'Report management'
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: Settings,
      path: '/admin/settings',
      description: 'System configuration'
    }
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  const sidebarVariants = {
    open: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 40
      }
    },
    closed: {
      x: -320,
      opacity: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 40
      }
    }
  };

  const overlayVariants = {
    open: {
      opacity: 1,
      transition: { duration: 0.2 }
    },
    closed: {
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        <motion.aside
          className="fixed top-0 left-0 h-full w-80 bg-white shadow-xl border-r border-gray-200 z-50 flex flex-col"
          variants={sidebarVariants}
          initial="closed"
          animate={isOpen ? "open" : "closed"}
          exit="closed"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
                <p className="text-sm text-gray-500">Management Tools</p>
              </div>
            </div>
            
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="px-4 space-y-2">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    className={`group relative flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                      active 
                        ? 'bg-primary-100 text-primary-600' 
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="font-medium">{item.label}</div>
                      <div className={`text-xs transition-colors ${
                        active ? 'text-primary-600' : 'text-gray-500'
                      }`}>
                        {item.description}
                      </div>
                    </div>

                    {/* Active indicator */}
                    {active && (
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-primary-600 rounded-l-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              CityWatch Admin Panel v1.0
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>

      {/* Desktop toggle button (when sidebar is closed) */}
      {!isOpen && (
        <motion.button
          onClick={onToggle}
          className="fixed left-4 top-1/2 transform -translate-y-1/2 z-30 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          aria-label="Open admin panel"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      )}
    </>
  );
};

export default SideNav;
