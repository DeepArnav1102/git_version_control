import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Inbox, 
  Bookmark, 
  Check, 
  User, 
  Users, 
  AtSign, 
  Filter, 
  Search, 
  CheckCircle, 
  Circle, 
  CircleDot, 
  Star, 
  UserCheck, 
  MessageSquare, 
  Sparkles, 
  X, 
  RefreshCw,
  SlidersHorizontal,
  FolderGit2
} from 'lucide-react';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';
import { Link } from 'react-router-dom';

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

export default function Notifications() {
  const [filter, setFilter] = useState('inbox'); // 'inbox', 'saved', 'done'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'FOLLOW', 'STAR', 'MENTION', 'ASSIGNED', 'PARTICIPATING'
  const [tab, setTab] = useState('unread'); // 'unread', 'all'
  const [searchQuery, setSearchQuery] = useState('is:unread');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/notifications', {
        params: {
          filter: filter === 'done' ? 'archived' : filter === 'saved' ? 'saved' : 'inbox'
        }
      });
      setNotifications(res.data.data || []);
    } catch (err) {
      jsonToast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    setSelectedIds(new Set());
  }, [filter]);

  // Tab switching updates search query and tab state
  const handleTabChange = (newTab) => {
    setTab(newTab);
    if (newTab === 'unread') {
      if (searchQuery.includes('is:read')) {
        setSearchQuery(searchQuery.replace(/is:read/g, 'is:unread'));
      } else if (!searchQuery.includes('is:unread')) {
        setSearchQuery(searchQuery ? `${searchQuery} is:unread`.trim() : 'is:unread');
      }
    } else {
      // 'all'
      const cleaned = searchQuery.replace(/\bis:unread\b/g, '').replace(/\bis:read\b/g, '').trim();
      setSearchQuery(cleaned);
    }
  };

  // Search query input handler
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.includes('is:unread')) {
      setTab('unread');
    } else if (val.includes('is:read')) {
      setTab('all');
    }
  };

  // Parse search query
  const parseQuery = (queryStr) => {
    let textQuery = '';
    let statusFilter = null; // 'read', 'unread', 'saved', 'done'
    let typeQuery = null;

    const tokens = queryStr.trim().split(/\s+/).filter(Boolean);
    tokens.forEach(tok => {
      const lower = tok.toLowerCase();
      if (lower === 'is:unread') statusFilter = 'unread';
      else if (lower === 'is:read') statusFilter = 'read';
      else if (lower === 'is:saved') statusFilter = 'saved';
      else if (lower === 'is:done' || lower === 'is:archived') statusFilter = 'done';
      else if (lower.startsWith('type:') || lower.startsWith('reason:')) {
        typeQuery = lower.split(':')[1]?.toUpperCase();
      } else {
        textQuery += (textQuery ? ' ' : '') + tok;
      }
    });

    return { textQuery: textQuery.toLowerCase(), statusFilter, typeQuery };
  };

  const { textQuery, statusFilter, typeQuery } = parseQuery(searchQuery);

  // Filter notifications
  const displayedNotifications = notifications.filter(n => {
    // 1. Status Filter (from query or tab fallback)
    if (statusFilter === 'unread' && n.isRead) return false;
    if (statusFilter === 'read' && !n.isRead) return false;
    if (statusFilter === 'saved' && !n.isSaved) return false;
    if (statusFilter === 'done' && !n.isArchived) return false;

    if (!statusFilter && tab === 'unread' && n.isRead) return false;

    // 2. Type Filter (from search query or sidebar)
    const activeType = typeQuery || (typeFilter !== 'all' ? typeFilter : null);
    if (activeType && n.type !== activeType) return false;

    // 3. Text search
    if (textQuery) {
      const actorUsername = (n.actor?.username || '').toLowerCase();
      const actorName = (n.actor?.name || '').toLowerCase();
      const repoName = (n.repo?.name || '').toLowerCase();
      const typeStr = (n.type || '').toLowerCase();
      const message = (n.message || '').toLowerCase();
      
      const match = actorUsername.includes(textQuery) ||
                    actorName.includes(textQuery) ||
                    repoName.includes(textQuery) ||
                    typeStr.includes(textQuery) ||
                    message.includes(textQuery);
      if (!match) return false;
    }

    return true;
  });

  // Calculate live badge counts
  const unreadCount = notifications.filter(n => !n.isRead && !n.isArchived).length;
  const savedCount = notifications.filter(n => n.isSaved && !n.isArchived).length;
  const followCount = notifications.filter(n => n.type === 'FOLLOW').length;
  const starCount = notifications.filter(n => n.type === 'STAR').length;
  const mentionCount = notifications.filter(n => n.type === 'MENTION').length;

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      jsonToast.success('Marked as read');
    } catch (err) {
      jsonToast.error('Failed to mark as read');
    }
  };

  const handleToggleSave = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await apiClient.patch(`/notifications/${id}/save`);
      const updated = res.data.data;
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isSaved: updated.isSaved } : n));
      if (updated.isSaved) {
        jsonToast.success('Notification saved');
      } else {
        jsonToast.info('Removed from saved');
      }
    } catch (err) {
      jsonToast.error('Failed to update save status');
    }
  };

  const handleArchive = async (ids, e) => {
    if (e) e.stopPropagation();
    try {
      if (ids.length === 1) {
        await apiClient.patch(`/notifications/${ids[0]}/archive`);
      } else {
        await apiClient.patch('/notifications/archive', { ids });
      }
      setNotifications(prev => prev.filter(n => !ids.includes(n._id)));
      setSelectedIds(new Set());
      jsonToast.success('Moved to Done');
    } catch (err) {
      jsonToast.error('Failed to archive notifications');
    }
  };

  const handleAcceptInvite = async (notification, e) => {
    if (e) e.stopPropagation();
    try {
      await apiClient.post(`/repos/${notification.repo?.owner?.username || notification.actor?.username}/${notification.repo?.name}/collaborators/accept`);
      jsonToast.success('Invitation accepted!');
      setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, isRead: true, type: 'INVITE_ACCEPTED' } : n));
    } catch (err) {
      jsonToast.error(err.response?.data?.message || 'Failed to accept invitation');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setTab('all');
    setTypeFilter('all');
  };

  const isSearchingOrFiltered = Boolean(textQuery || typeQuery || (statusFilter && statusFilter !== (tab === 'unread' ? 'unread' : '')) || typeFilter !== 'all');

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-[#f6f8fa] px-4 py-6 flex gap-6">
      
      {/* ═══════════════════════════════════════════════
          LEFT SIDEBAR
          ═══════════════════════════════════════════════ */}
      <div className="w-[240px] flex-shrink-0 space-y-6 hidden md:block">
        
        {/* Core Categories */}
        <div className="space-y-1">
          <button 
            onClick={() => { setFilter('inbox'); setTypeFilter('all'); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg transition-all ${
              filter === 'inbox' 
                ? 'bg-[#e0eaf5] text-[#0969da] font-semibold shadow-xs' 
                : 'text-[#57606a] hover:bg-gray-200/60 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Inbox size={16} strokeWidth={filter === 'inbox' ? 2.5 : 1.75} />
              <span>Inbox</span>
            </div>
            {unreadCount > 0 && filter !== 'inbox' && (
              <span className="text-[11px] px-1.5 py-0.2 bg-blue-100 text-blue-700 font-semibold rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => { setFilter('saved'); setTypeFilter('all'); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg transition-all ${
              filter === 'saved' 
                ? 'bg-[#e0eaf5] text-[#0969da] font-semibold shadow-xs' 
                : 'text-[#57606a] hover:bg-gray-200/60 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bookmark size={16} strokeWidth={filter === 'saved' ? 2.5 : 1.75} />
              <span>Saved</span>
            </div>
            {savedCount > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 bg-gray-200 text-gray-700 font-medium rounded-full">
                {savedCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => { setFilter('done'); setTypeFilter('all'); }}
            className={`w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg transition-all ${
              filter === 'done' 
                ? 'bg-[#e0eaf5] text-[#0969da] font-semibold shadow-xs' 
                : 'text-[#57606a] hover:bg-gray-200/60 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Check size={16} strokeWidth={filter === 'done' ? 2.5 : 1.75} />
              <span>Done</span>
            </div>
          </button>
        </div>

        {/* Genuine Notification Filters */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#57606a]">Filters</h3>
            {typeFilter !== 'all' && (
              <button 
                onClick={() => setTypeFilter('all')}
                className="text-[11px] text-[#0969da] hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-1">
            <button 
              onClick={() => setTypeFilter('all')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'all' 
                  ? 'bg-gray-200/80 text-[#24292f] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} />
                <span>All notifications</span>
              </div>
              <span className="text-[11px] text-gray-400 font-normal">{notifications.length}</span>
            </button>

            <button 
              onClick={() => setTypeFilter(typeFilter === 'FOLLOW' ? 'all' : 'FOLLOW')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'FOLLOW' 
                  ? 'bg-[#e0eaf5] text-[#0969da] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <User size={14} />
                <span>Follows</span>
              </div>
              {followCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full font-normal">
                  {followCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setTypeFilter(typeFilter === 'STAR' ? 'all' : 'STAR')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'STAR' 
                  ? 'bg-[#e0eaf5] text-[#0969da] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star size={14} />
                <span>Stars</span>
              </div>
              {starCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full font-normal">
                  {starCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setTypeFilter(typeFilter === 'MENTION' ? 'all' : 'MENTION')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'MENTION' 
                  ? 'bg-[#e0eaf5] text-[#0969da] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <AtSign size={14} />
                <span>Mentions</span>
              </div>
              {mentionCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 bg-gray-200 text-gray-700 rounded-full font-normal">
                  {mentionCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setTypeFilter(typeFilter === 'ASSIGNED' ? 'all' : 'ASSIGNED')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'ASSIGNED' 
                  ? 'bg-[#e0eaf5] text-[#0969da] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserCheck size={14} />
                <span>Assigned</span>
              </div>
            </button>

            <button 
              onClick={() => setTypeFilter(typeFilter === 'PARTICIPATING' ? 'all' : 'PARTICIPATING')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'PARTICIPATING' 
                  ? 'bg-[#e0eaf5] text-[#0969da] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} />
                <span>Participating</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col">
        
        {/* Top Controls: Tabs, Search Input, and Filter Button */}
        <div className="flex items-center gap-3 mb-4">
          
          {/* Tabs: Unread / All */}
          <div className="flex items-center bg-white border border-[#d0d7de] rounded-lg overflow-hidden text-[13px] font-medium shadow-xs">
            <button 
              onClick={() => handleTabChange('unread')}
              className={`px-3.5 py-1.5 transition-colors cursor-pointer ${
                tab === 'unread' && !searchQuery.includes('is:read')
                  ? 'bg-[#f6f8fa] text-[#24292f] font-semibold border-r border-[#d0d7de]' 
                  : 'text-[#57606a] hover:bg-gray-50 border-r border-[#d0d7de]'
              }`}
            >
              Unread
            </button>
            <button 
              onClick={() => handleTabChange('all')}
              className={`px-3.5 py-1.5 transition-colors cursor-pointer ${
                tab === 'all' || searchQuery.includes('is:read')
                  ? 'bg-[#f6f8fa] text-[#24292f] font-semibold' 
                  : 'text-[#57606a] hover:bg-gray-50'
              }`}
            >
              All
            </button>
          </div>
          
          {/* Search Bar with live is:read support */}
          <div className="relative flex-1 max-w-[460px]">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search size={14} className="text-[#57606a]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search or type a filter (e.g. is:unread, is:read, is:saved)..."
              className="w-full pl-8 pr-8 py-1.5 text-[13px] bg-white border border-[#d0d7de] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-xs transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button 
                onClick={() => handleSearchChange('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {/* Filter Dropdown Button */}
          <div className="relative" ref={filterDropdownRef}>
            <button 
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border rounded-lg shadow-xs transition-all cursor-pointer ${
                isFilterDropdownOpen || isSearchingOrFiltered
                  ? 'bg-[#e0eaf5] text-[#0969da] border-[#0969da]/40 ring-1 ring-[#0969da]/20'
                  : 'bg-white border-[#d0d7de] text-[#57606a] hover:bg-gray-50'
              }`}
            >
              <Filter size={14} /> 
              <span>Filter</span>
              {isSearchingOrFiltered && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#0969da]" />
              )}
            </button>

            {/* Filter Dropdown Popover */}
            <AnimatePresence>
              {isFilterDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2 w-64 bg-white border border-[#d0d7de] rounded-xl shadow-xl z-50 overflow-hidden text-[13px]"
                >
                  <div className="px-3 py-2 bg-gray-50 border-b border-[#d0d7de] font-semibold text-[#24292f] text-xs flex items-center justify-between">
                    <span>Filter notifications</span>
                    {isSearchingOrFiltered && (
                      <button 
                        onClick={() => { handleClearFilters(); setIsFilterDropdownOpen(false); }}
                        className="text-[11px] text-[#0969da] hover:underline font-normal cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase">Status</div>
                    <button
                      onClick={() => {
                        setSearchQuery('is:unread');
                        setTab('unread');
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <CircleDot size={13} className="text-blue-500" />
                        <span>Unread notifications</span>
                      </span>
                      <code className="text-[10px] text-gray-400 font-mono">is:unread</code>
                    </button>

                    <button
                      onClick={() => {
                        setSearchQuery('is:read');
                        setTab('all');
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Circle size={13} className="text-gray-400" />
                        <span>Read notifications</span>
                      </span>
                      <code className="text-[10px] text-gray-400 font-mono">is:read</code>
                    </button>

                    <button
                      onClick={() => {
                        setSearchQuery('is:saved');
                        setTab('all');
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Bookmark size={13} className="text-amber-500" />
                        <span>Saved for later</span>
                      </span>
                      <code className="text-[10px] text-gray-400 font-mono">is:saved</code>
                    </button>

                    <div className="my-1 border-t border-gray-100" />
                    <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase">Type</div>

                    <button
                      onClick={() => {
                        setTypeFilter('FOLLOW');
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <User size={13} className="text-gray-500" />
                        <span>Follows</span>
                      </span>
                      <code className="text-[10px] text-gray-400 font-mono">type:follow</code>
                    </button>

                    <button
                      onClick={() => {
                        setTypeFilter('STAR');
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Star size={13} className="text-amber-500" />
                        <span>Stars</span>
                      </span>
                      <code className="text-[10px] text-gray-400 font-mono">type:star</code>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Notifications Card Container */}
        <div className="bg-white border border-[#d0d7de] rounded-xl shadow-xs overflow-hidden flex flex-col min-h-[460px]">

          {/* List Content */}
          <div className="divide-y divide-[#d0d7de] flex-1 flex flex-col">
            {loading ? (
              // Skeleton Loading
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 bg-white">
                  <div className="pt-1 shrink-0">
                    <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse shrink-0" />
                      <div className="flex flex-col gap-2">
                        <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
                        <div className="w-56 h-4 bg-gray-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="w-16 h-3 bg-gray-200 rounded animate-pulse shrink-0 mt-1" />
                  </div>
                </div>
              ))
            ) : displayedNotifications.length === 0 ? (
              
              /* ═══════════════════════════════════════════════
                 SLEEK & MODERN ALL CAUGHT UP / EMPTY STATE
                 ═══════════════════════════════════════════════ */
              <motion.div 
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="py-20 px-6 text-center flex flex-col items-center justify-center my-auto"
              >

                {/* Headings */}
                <h3 className="text-[17px] font-bold text-[#1f2328] mb-1.5 tracking-tight">
                  {isSearchingOrFiltered
                    ? 'No matching notifications'
                    : filter === 'saved'
                    ? 'No saved notifications'
                    : filter === 'done'
                    ? 'No completed notifications'
                    : 'All caught up!'}
                </h3>

                <p className="text-[13px] text-[#57606a] max-w-sm mb-6 leading-relaxed">
                  {isSearchingOrFiltered
                    ? 'No notifications match your current search or active filters. Try adjusting or clearing them.'
                    : filter === 'saved'
                    ? 'Save important notifications for later by clicking the bookmark icon on any item.'
                    : filter === 'done'
                    ? 'Notifications you move to Done or archive will appear here.'
                    : "You don't have any unread notifications here. Take a break or explore repositories."}
                </p>

                {/* Action Buttons */}
                {isSearchingOrFiltered ? (
                  <button
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0969da] bg-[#ddf4ff] hover:bg-[#b6e3ff] border border-[#54aeff]/40 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    <RefreshCw size={12} />
                    Clear all filters
                  </button>
                ) : filter === 'inbox' && tab === 'unread' ? (
                  <button
                    onClick={() => handleTabChange('all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#24292f] bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    View all notifications
                  </button>
                ) : null}
              </motion.div>
            ) : (
              // Notification List Items
              displayedNotifications.map(notification => (
                <div 
                  key={notification._id} 
                  className={`flex items-start gap-3.5 p-3.5 hover:bg-[#f6f8fa] transition-colors group ${
                    !notification.isRead ? 'bg-white' : 'bg-[#f6f8fa]/40 opacity-85'
                  }`}
                >
                  {/* Read / Unread Indicator Dot */}
                  <div className="pt-1.5 flex items-center shrink-0">
                    {notification.isRead ? (
                      <Circle size={15} strokeWidth={1.8} className="text-[#8c959f]" title="Read" />
                    ) : (
                      <CircleDot size={15} strokeWidth={2.5} className="text-[#0969da]" title="Unread" />
                    )}
                  </div>
                  
                  {/* Notification Content Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Left: Avatar + Details */}
                      <div className="flex items-start gap-3">
                        <img 
                          src={notification.actor?.profilePicture || defaultPfp} 
                          alt={notification.actor?.username || 'User'} 
                          className="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-[#57606a] font-medium block">
                              {notification.actor?.username}
                            </span>
                            {notification.isSaved && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-[#0969da] border border-blue-200">
                                <Bookmark size={10} fill="currentColor" /> Saved
                              </span>
                            )}
                          </div>

                          {/* FOLLOW Notification */}
                          {notification.type === 'FOLLOW' && (
                            <div className="text-[14px] text-[#24292f] mt-0.5">
                              <Link 
                                to={`/u/${notification.actor?.username}`} 
                                className="font-semibold hover:text-[#0969da] hover:underline"
                              >
                                {notification.actor?.name || notification.actor?.username}
                              </Link>
                              <span className="text-gray-600"> started following you.</span>
                            </div>
                          )}

                          {/* STAR Notification */}
                          {notification.type === 'STAR' && (
                            <div className="text-[14px] text-[#24292f] mt-0.5 flex items-center gap-1 flex-wrap">
                              <Link 
                                to={`/u/${notification.actor?.username}`} 
                                className="font-semibold hover:text-[#0969da] hover:underline"
                              >
                                {notification.actor?.name || notification.actor?.username}
                              </Link>
                              <span className="text-gray-600">starred</span>
                              {notification.repo ? (
                                <Link 
                                  to={`/repo/${notification.repo.owner?.username || notification.actor?.username}/${notification.repo.name}`}
                                  className="font-semibold text-[#0969da] hover:underline inline-flex items-center gap-1"
                                >
                                  <Star size={13} className="text-amber-500 fill-amber-500" />
                                  <span>{notification.repo.owner?.username || ''}/{notification.repo.name}</span>
                                </Link>
                              ) : (
                                <span className="font-medium text-gray-700">your repository</span>
                              )}
                            </div>
                          )}

                          {/* REPO_INVITE Notification */}
                          {notification.type === 'REPO_INVITE' && (
                            <div className="text-[14px] text-[#24292f] mt-0.5">
                              <span className="font-semibold">{notification.actor?.username}</span> invited you to collaborate on{' '}
                              <Link 
                                to={`/repo/${notification.repo?.owner?.username || notification.actor?.username}/${notification.repo?.name}`}
                                className="font-semibold text-[#0969da] hover:underline"
                              >
                                {notification.repo?.owner?.username || notification.actor?.username}/{notification.repo?.name}
                              </Link>.
                              <div className="mt-2 mb-1">
                                <button 
                                  onClick={(e) => handleAcceptInvite(notification, e)}
                                  className="px-3 py-1 bg-[#2da44e] text-white text-[12px] font-semibold rounded hover:bg-[#2c974b] transition-colors border border-[rgba(27,31,36,0.15)] shadow-sm"
                                >
                                  Accept Invitation
                                </button>
                              </div>
                            </div>
                          )}

                          {notification.type === 'INVITE_ACCEPTED' && (
                            <div className="text-[14px] text-[#24292f] mt-0.5">
                              You accepted the invitation to collaborate on{' '}
                              <Link 
                                to={`/repo/${notification.repo?.owner?.username || notification.actor?.username}/${notification.repo?.name}`}
                                className="font-semibold text-[#0969da] hover:underline"
                              >
                                {notification.repo?.owner?.username || notification.actor?.username}/{notification.repo?.name}
                              </Link>.
                            </div>
                          )}

                          {/* Other / Generic Notification */}
                          {notification.type !== 'FOLLOW' && notification.type !== 'STAR' && notification.type !== 'REPO_INVITE' && notification.type !== 'INVITE_ACCEPTED' && (
                            <div className="text-[14px] text-[#24292f] mt-0.5">
                              <Link 
                                to={`/u/${notification.actor?.username}`} 
                                className="font-semibold hover:text-[#0969da] hover:underline"
                              >
                                {notification.actor?.name || notification.actor?.username}
                              </Link>
                              <span className="text-gray-600"> {notification.message || 'sent you an update.'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right: Timestamp and Action Buttons */}
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        <span className="text-[12px] text-[#57606a] whitespace-nowrap">
                          {timeAgo(notification.createdAt)}
                        </span>

                        {/* Interactive Action Icons (Save, Read, Archive) */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          
                          {/* Option to Save (Bookmark) */}
                          <button 
                            onClick={(e) => handleToggleSave(notification._id, e)}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              notification.isSaved 
                                ? 'text-[#0969da] bg-blue-50 hover:bg-blue-100' 
                                : 'text-[#57606a] hover:text-[#0969da] hover:bg-blue-50'
                            }`}
                            title={notification.isSaved ? "Remove from saved" : "Save for later"}
                          >
                            <Bookmark size={14} fill={notification.isSaved ? "currentColor" : "none"} />
                          </button>

                          {/* Mark as read */}
                          {!notification.isRead && (
                            <button 
                              onClick={(e) => handleMarkAsRead(notification._id, e)}
                              className="p-1.5 text-[#57606a] hover:text-[#0969da] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                              title="Mark as read"
                            >
                              <Check size={14} />
                            </button>
                          )}

                          {/* Mark as Done (Archive) */}
                          <button 
                            onClick={(e) => handleArchive([notification._id], e)}
                            className="p-1.5 text-[#57606a] hover:text-[#2da44e] hover:bg-green-50 rounded-md transition-colors cursor-pointer"
                            title="Mark as done"
                          >
                            <CheckCircle size={14} />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* ProTip Footer & Filter Shortcuts */}
          <div className="bg-[#f6f8fa] border-t border-[#d0d7de] p-3 px-4 flex items-center justify-between text-[12px] text-[#57606a]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#24292f]">ProTip!</span> 
              <span>Use filters like</span>
              <button 
                onClick={() => { setSearchQuery('is:read'); setTab('all'); }}
                className="font-mono text-[11px] bg-white text-[#0969da] border border-[#d0d7de] px-1.5 py-0.5 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                title="Filter read notifications"
              >
                is:read
              </button>
              <button 
                onClick={() => { setSearchQuery('is:saved'); setTab('all'); }}
                className="font-mono text-[11px] bg-white text-[#0969da] border border-[#d0d7de] px-1.5 py-0.5 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                title="Filter saved notifications"
              >
                is:saved
              </button>
              <span>to narrow down your notifications.</span>
            </div>
            
            {displayedNotifications.length > 0 && (
              <div className="text-[11px] text-gray-500 font-medium hidden sm:block">
                Showing {displayedNotifications.length} {displayedNotifications.length === 1 ? 'notification' : 'notifications'}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
