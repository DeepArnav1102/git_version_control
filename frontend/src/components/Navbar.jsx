import React, { useState, useEffect, useRef } from 'react';
import { Lottie } from 'lottie-react';
import { GitPullRequest, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import axios from '../lib/axios';

// Extracted sub-components
import IconBox from './navbar/IconBox';
import LottieIcon from './navbar/LottieIcon';
import ProfileDropdown from './navbar/ProfileDropdown';
import Sidebar from './navbar/Sidebar';
import CreateDropdown from './navbar/CreateDropdown';

// Lottie animation sources
import menuAnim from '../assets/Menu V4/menuV4.json';
import searchAnim from '../assets/Search to X/searchToX.json';
import folderAnim from '../assets/Folder/folder.json';
import notificationAnim from '../assets/NotificationV3/notification-V3.json';

import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef(null);
  
  // Lightning-fast search cache
  const cacheRef = useRef({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    // 1. Instant Cache Hit (0ms delay!)
    if (cacheRef.current[q]) {
      setResults(cacheRef.current[q]);
      return;
    }

    // 2. Reduced debounce for network requests
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/users/search?q=${encodeURIComponent(q)}`);
        const fetchedUsers = response.data.data.users;
        
        // Save to cache
        cacheRef.current[q] = fetchedUsers;
        setResults(fetchedUsers);
      } catch (error) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 150); // Reduced from 300ms to 150ms for snappier feel

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] h-12 z-50 flex items-center justify-between px-4 font-sans text-black rounded-2xl border border-white/30 bg-white/40 backdrop-blur-md shadow-sm shadow-black/5">
        {/* ── Left Section ── */}
        <div className="flex items-center gap-3">
          <div data-hamburger>
            <LottieIcon
              src={menuAnim}
              isToggle={true}
              active={isSidebarOpen}
              onClick={(isOpen) => setIsSidebarOpen(isOpen)}
            />
          </div>
          {user && (
            <span className="font-semibold text-sm tracking-tight">
              {user.username}
            </span>
          )}
        </div>

        {/* ── Right Section ── */}
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div ref={searchRef} className="relative hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 text-xs hover:border-gray-400 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
            <Lottie
              src={searchAnim}
              loop={false}
              autoplay={false}
              style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="Type / to search"
              className="bg-transparent outline-none text-xs text-black placeholder-gray-400 w-32 focus:w-44 transition-all duration-200"
            />
            {isLoading && <Loader2 size={12} className="text-gray-400 animate-spin absolute right-2" />}

            {/* Dropdown */}
            <AnimatePresence>
              {isFocused && (query.trim() !== '') && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto"
                >
                  {results.length > 0 ? (
                    results.map((u) => (
                      <div 
                        key={u._id} 
                        onClick={() => {
                          navigate(`/u/${u.username}`);
                          setQuery('');
                          setIsFocused(false);
                        }}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <img
                          src={u.profilePicture || `https://api.dicebear.com/7.x/notionists/svg?seed=${u.username}`}
                          alt={u.name}
                          className="w-7 h-7 rounded-full object-cover border border-gray-200"
                        />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-gray-900 leading-tight">{u.name}</span>
                          <span className="text-[10px] text-gray-500">@{u.username}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    !isLoading && (
                      <div className="p-3 text-center text-[11px] text-gray-500">
                        No users found for "{query}"
                      </div>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Separator */}
          <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

          {/* Action icons */}
          <CreateDropdown />

          <IconBox>
            <GitPullRequest size={15} strokeWidth={1.8} />
          </IconBox>

          <IconBox onClick={() => navigate('/profile?tab=repositories')} title="Repositories">
            <LottieIcon src={folderAnim} trigger="hover" />
          </IconBox>
          <LottieIcon src={notificationAnim} trigger="hover" />

          {/* Profile avatar & dropdown */}
          <ProfileDropdown />
        </div>
      </nav>

      {/* ── Sidebar Drawer ── */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  );
}
