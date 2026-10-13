import React, { useRef, useState, useEffect } from 'react';
import { User, FolderGit2, Star, Settings, LogOut, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import apiClient from '../../lib/axios';
import { jsonToast } from '../../lib/jsonToast';

/**
 * ProfileDropdown — profile picture avatar + dropdown menu.
 * Handles navigation to profile/settings and logout.
 */
export default function ProfileDropdown() {
  const { user, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      clearUser();
      setDropdownOpen(false);
      jsonToast.success('Logged out successfully');
      navigate('/', { replace: true });
    } catch (err) {
      jsonToast.error('Failed to logout');
    }
  };

  const handleMenuItemClick = (action) => {
    action();
    setDropdownOpen(false);
  };

  // Profile picture URL — falls back to a default
  const defaultPfp =
    import.meta.env.VITE_DEFAULT_PFP_URL ||
    'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';
  const profilePic = user?.profilePicture || defaultPfp;

  // Dropdown menu items
  const menuItems = [
    { icon: User, label: 'Profile', action: () => navigate('/profile') },
    { icon: FolderGit2, label: 'Repositories', action: () => navigate('/profile?tab=repositories') },
    { icon: Star, label: 'Stars', action: () => navigate('/profile?tab=stars') },
    { icon: Key, label: 'My Tokens', action: () => navigate('/profile?tab=tokens') },
    { icon: Settings, label: 'Settings', action: () => navigate('/settings') },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar button */}
      <div
        onClick={() => setDropdownOpen((prev) => !prev)}
        className={`w-9 h-9 ml-1 rounded-full overflow-hidden border-2 cursor-pointer transition-all shadow-sm ${dropdownOpen ? 'border-gray-500 shadow' : 'border-gray-200 hover:border-gray-400'
          }`}
      >
        <img
          src={profilePic}
          alt="Profile"
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = defaultPfp; }}
        />
      </div>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-[60]"
          style={{ animation: 'dropdownFadeIn 0.15s ease-out' }}
        >
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                <img
                  src={profilePic}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = defaultPfp; }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.username}</p>
                <p className="text-xs text-gray-400 truncate">{user?.name || user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation items */}
          <div className="py-1">
            {menuItems.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={() => handleMenuItemClick(action)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Icon size={16} strokeWidth={1.8} className="text-gray-400" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-gray-100 pt-1 pb-0.5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut size={16} strokeWidth={1.8} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}

      {/* Dropdown animation keyframes */}
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
