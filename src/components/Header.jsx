import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, User, Home, Brain } from 'lucide-react';

const Header = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">
              RecHub
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/') 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>
            <Link
              to="/search"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/search') 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </Link>
            <Link
              to="/profile"
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive('/profile') 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Link>
          </nav>

          {/* Mobile Navigation */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              to="/search"
              className="p-2 rounded-md text-gray-600 hover:text-gray-900"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              to="/profile"
              className="p-2 rounded-md text-gray-600 hover:text-gray-900"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
