import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lottie } from 'lottie-react';
import { GitPullRequest, Loader2, Star, Lock, BookOpen, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/useAuthStore';
import axios from '../lib/axios';
import ShortcutBadge from './ShortcutBadge';
import { useNavigate } from 'react-router-dom';

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

// Extracted sub-components
import IconBox from './navbar/IconBox';
import LottieIcon from './navbar/LottieIcon';
import ProfileDropdown from './navbar/ProfileDropdown';
import Sidebar from './navbar/Sidebar';
import CreateDropdown from './navbar/CreateDropdown';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';

// Lottie animation sources
import menuAnim from '../assets/Menu V4/menuV4.json';
import searchAnim from '../assets/Search to X/searchToX.json';
import folderAnim from '../assets/Folder/folder.json';
import notificationAnim from '../assets/NotificationV3/notification-V3.json';

export default function Navbar() {
  const { user } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const navigate = useNavigate();

  // ── Search state ────────────────────────────────────────────────────
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState({ users: [], repos: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [scopeMe, setScopeMe]   = useState(false); // true → searching only my repos
  const [activeIdx, setActiveIdx] = useState(-1);  // ↑↓ keyboard nav
  const searchRef  = useRef(null);
  const inputRef   = useRef(null);
  const cacheRef   = useRef({});

  // ── Click-outside to close ──────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Listen for search:prefill (fired by useGlobalShortcuts for @ key) ─
  useEffect(() => {
    const handler = (e) => {
      const { value, scope } = e.detail || {};
      if (scope === 'me') setScopeMe(true);
      setQuery(value ?? '');
      setIsFocused(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener('search:prefill', handler);
    return () => window.removeEventListener('search:prefill', handler);
  }, []);

  // ── Listen for global toggle events ──────────────────────────────────
  useEffect(() => {
    const handleToggleSidebar = () => setIsSidebarOpen(prev => !prev);
    const handleToggleShortcuts = () => setIsShortcutsModalOpen(prev => !prev);
    
    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    window.addEventListener('toggle-shortcuts-modal', handleToggleShortcuts);
    
    return () => {
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
      window.removeEventListener('toggle-shortcuts-modal', handleToggleShortcuts);
    };
  }, []);

  // ── Reset activeIdx when results change ─────────────────────────────
  useEffect(() => { setActiveIdx(-1); }, [results]);

  // ── Flat list for keyboard navigation ───────────────────────────────
  const flatResults = [
    ...results.users.map(u => ({ type: 'user', data: u })),
    ...results.repos.map(r => ({ type: 'repo', data: r })),
  ];

  const navigateTo = useCallback((item) => {
    if (!item) return;
    if (item.type === 'user') navigate(`/u/${item.data.username}`);
    else navigate(`/repo/${item.data.owner.username}/${item.data.name}`);
    setQuery('');
    setIsFocused(false);
    setScopeMe(false);
    setActiveIdx(-1);
    if (inputRef.current) inputRef.current.blur();
  }, [navigate]);

  // ── Input keyboard handler ───────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!isFocused) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) {
        navigateTo(flatResults[activeIdx]);
      } else {
        setQuery('');
        setScopeMe(false);
        setIsFocused(false);
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setScopeMe(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  // ── Search effect ────────────────────────────────────────────────────
  useEffect(() => {
    const raw = scopeMe ? query.replace(/^@/, '').trim() : query.trim();

    if (!raw) {
      setResults({ users: [], repos: [] });
      return;
    }

    const cacheKey = scopeMe ? `@${raw}` : raw;
    if (cacheRef.current[cacheKey]) {
      setResults(cacheRef.current[cacheKey]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ q: raw });
        if (scopeMe) params.append('scope', 'me');
        const response = await axios.get(`/users/global-search?${params}`);
        const fetched = response.data.data;
        cacheRef.current[cacheKey] = fetched;
        setResults(fetched);
      } catch {
        setResults({ users: [], repos: [] });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, scopeMe]);

  const hasResults = results.users.length > 0 || results.repos.length > 0;
  const showDropdown = isFocused && query.replace(/^@/, '').trim() !== '';

  return (
    <>
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] h-12 z-50 flex items-center justify-between px-4 font-sans text-black rounded-2xl border border-white/30 bg-white/40 backdrop-blur-md shadow-sm shadow-black/5">
        {/* ── Left ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div data-hamburger>
            <LottieIcon src={menuAnim} isToggle={true} active={isSidebarOpen} onClick={(o) => setIsSidebarOpen(o)} />
          </div>
          {user && (
            <ShortcutBadge keys={['G', 'P']} position="bottom">
              <span
                className="font-semibold text-sm tracking-tight cursor-pointer hover:text-gray-600 transition-colors"
                onClick={() => navigate(`/u/${user.username}`)}
              >
                {user.username}
              </span>
            </ShortcutBadge>
          )}
        </div>

        {/* ── Right ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">

          {/* Search bar */}
          <ShortcutBadge keys={['/']} position="bottom">
            <div
              ref={searchRef}
              className="relative hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-400 text-xs hover:border-gray-400 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm"
            >
              {/* Scope pill */}
              {scopeMe && (
                <span className="flex items-center gap-1 bg-blue-100 text-blue-600 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  <UserIcon size={8} />
                  My Repos
                  <button
                    onClick={() => { setScopeMe(false); setQuery(''); }}
                    className="ml-0.5 hover:text-blue-800"
                  >×</button>
                </span>
              )}

              <Lottie src={searchAnim} loop={false} autoplay={false} style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} />

              <input
                ref={inputRef}
                data-search-input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleKeyDown}
                placeholder={scopeMe ? 'Search your repos…' : 'Type / to search'}
                className="bg-transparent outline-none text-xs text-black placeholder-gray-400 w-32 focus:w-44 transition-all duration-200"
              />
              {isLoading && <Loader2 size={12} className="text-gray-400 animate-spin absolute right-2" />}

              {/* ── Dropdown ── */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden max-h-96 overflow-y-auto z-50"
                  >
                    {/* Scope header */}
                    {scopeMe && (
                      <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex items-center gap-1.5">
                        <UserIcon size={10} className="text-blue-400" />
                        <span className="text-[10px] font-semibold text-blue-500">Searching your repositories</span>
                      </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && !hasResults && (
                      <div className="p-4 text-center text-[11px] text-gray-500">
                        No results for "{query.replace(/^@/, '')}"
                      </div>
                    )}

                    {/* ── Users section ── */}
                    {results.users.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Users</span>
                        </div>
                        {results.users.map((u, i) => {
                          const flatI = i;
                          const isActive = activeIdx === flatI;
                          return (
                            <div
                              key={u._id}
                              onClick={() => navigateTo({ type: 'user', data: u })}
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <img
                                src={u.profilePicture || defaultPfp}
                                alt={u.name}
                                className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                onError={(e) => { e.target.src = defaultPfp; }}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[12px] font-bold text-gray-900 leading-tight truncate">{u.name}</span>
                                <span className="text-[10px] text-gray-500">@{u.username}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Repositories section ── */}
                    {results.repos.length > 0 && (
                      <div>
                        {!scopeMe && (
                          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Repositories</span>
                          </div>
                        )}
                        {results.repos.map((r, i) => {
                          const flatI = results.users.length + i;
                          const isActive = activeIdx === flatI;
                          return (
                            <div
                              key={r._id}
                              onClick={() => navigateTo({ type: 'repo', data: r })}
                              className={`flex items-start gap-2 px-3 py-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <BookOpen size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-semibold text-gray-700 truncate">
                                    {r.owner.username}/<span className="text-gray-900">{r.name}</span>
                                  </span>
                                  {r.isPrivate && <Lock size={10} className="text-gray-400 flex-shrink-0" />}
                                </div>
                                {r.description && (
                                  <span className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">{r.description}</span>
                                )}
                                {r.starsCount > 0 && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400 mt-0.5">
                                    <Star size={9} className="fill-gray-300 text-gray-300" />
                                    {r.starsCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Keyboard hint at bottom */}
                    {hasResults && (
                      <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-2 bg-gray-50">
                        <span className="text-[9px] text-gray-400">↑↓ navigate</span>
                        <span className="text-[9px] text-gray-300">·</span>
                        <span className="text-[9px] text-gray-400">Enter to open</span>
                        <span className="text-[9px] text-gray-300">·</span>
                        <span className="text-[9px] text-gray-400">Esc to close</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ShortcutBadge>

          {/* Separator */}
          <div className="w-[1px] h-4 bg-gray-300 mx-1" />

          {/* Action icons */}
          <ShortcutBadge keys={['G', 'N']} position="bottom">
            <CreateDropdown />
          </ShortcutBadge>

          <IconBox>
            <GitPullRequest size={15} strokeWidth={1.8} />
          </IconBox>

          <ShortcutBadge keys={['G', 'R']} position="bottom">
            <div title="Repositories">
              <LottieIcon src={folderAnim} trigger="hover" onClick={() => navigate('/profile?tab=repositories')} />
            </div>
          </ShortcutBadge>

          <LottieIcon src={notificationAnim} trigger="hover" />

          {/* Profile */}
          <ProfileDropdown />
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal 
        isOpen={isShortcutsModalOpen} 
        onClose={() => setIsShortcutsModalOpen(false)} 
      />
    </>
  );
}
