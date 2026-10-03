import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, GitPullRequest, Check } from 'lucide-react';
import { jsonToast } from '../../../lib/jsonToast';

function UserDropdown({ title, users, onSelect, onClose, align = 'left' }) {
  const [query, setQuery] = useState('');
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden`}>
      <div className="px-3 py-2 border-b border-gray-200 font-semibold text-xs text-gray-800 bg-gray-50/50 flex justify-between items-center">
        Filter by {title.toLowerCase()}
        <X size={14} className="cursor-pointer text-gray-400 hover:text-gray-700" onClick={onClose} />
      </div>
      <div className="p-2 border-b border-gray-200 bg-gray-50/50">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
          <input
            type="text"
            placeholder={`Filter ${title.toLowerCase()}s`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500 text-center">No matches</div>
        ) : filteredUsers.map(u => (
          <div
            key={u._id}
            onClick={() => onSelect(u.username)}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-xs flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors"
          >
            <img
              src={u.profilePicture || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg'}
              alt=""
              className="w-5 h-5 rounded-full ring-1 ring-gray-200"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg'; }}
            />
            <span className="font-medium text-gray-700">{u.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabelDropdown({ labels, onSelect, onClose, align = 'left' }) {
  const [query, setQuery] = useState('');
  const filteredLabels = labels.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden`}>
      <div className="px-3 py-2 border-b border-gray-200 font-semibold text-xs text-gray-800 bg-gray-50/50 flex justify-between items-center">
        Filter by labels
        <X size={14} className="cursor-pointer text-gray-400 hover:text-gray-700" onClick={onClose} />
      </div>
      <div className="p-2 border-b border-gray-200 bg-gray-50/50">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter labels"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredLabels.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500 text-center">No matches</div>
        ) : filteredLabels.map(label => (
          <div
            key={label.name}
            onClick={() => onSelect(label.name)}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-xs flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors"
          >
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color || '#e5e7eb' }} />
            <span className="font-medium text-gray-700">{label.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PRFilterBar({
  activeState, setActiveState,
  openCount, closedCount,
  activeDropdown, setActiveDropdown,
  prMetadata,
  setActiveAuthor, setActiveFilter,
  setActiveLabel,
  setActiveAssignee,
  sortState, setSortState,
}) {
  const close = () => setActiveDropdown(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    
    if (activeDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown, setActiveDropdown]);

  return (
    <div ref={containerRef} className="bg-[#f6f8fa] border-b border-gray-300 px-4 py-3 flex flex-col lg:flex-row justify-between lg:items-center text-xs text-gray-500 gap-4 lg:gap-0">
      <div className="flex items-center gap-4">
        <input type="checkbox" className="rounded-sm border-gray-300 bg-white checked:bg-[#0969da] cursor-pointer w-3.5 h-3.5" />
        <div
          onClick={() => setActiveState('open')}
          className={`flex items-center gap-1.5 cursor-pointer hover:text-gray-900 transition-colors ${activeState === 'open' ? 'font-semibold text-gray-900' : ''}`}
        >
          <GitPullRequest size={14} />
          Open <span className="bg-gray-200 px-1.5 py-0.5 rounded-full text-[10px] text-gray-700 font-normal">{openCount}</span>
        </div>
        <div
          onClick={() => setActiveState('closed')}
          className={`flex items-center gap-1.5 cursor-pointer hover:text-gray-900 transition-colors ${activeState === 'closed' ? 'font-semibold text-gray-900' : ''}`}
        >
          <Check size={14} />
          Closed <span className="bg-gray-200 px-1.5 py-0.5 rounded-full text-[10px] text-gray-700 font-normal">{closedCount}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 lg:gap-6 items-center">
        {/* Author */}
        <div className="relative">
          <span onClick={() => setActiveDropdown(activeDropdown === 'author' ? null : 'author')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 opacity-70">
            Author <ChevronDown size={12} />
          </span>
          {activeDropdown === 'author' && (
            <UserDropdown
              title="Author"
              users={prMetadata.users}
              onSelect={u => { setActiveAuthor(u); setActiveFilter('all'); close(); }}
              onClose={close}
            />
          )}
        </div>

        {/* Label */}
        <div className="relative">
          <span onClick={() => setActiveDropdown(activeDropdown === 'label' ? null : 'label')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 opacity-70">
            Label <ChevronDown size={12} />
          </span>
          {activeDropdown === 'label' && (
            <LabelDropdown
              labels={prMetadata.labels}
              onSelect={l => { setActiveLabel(l); close(); }}
              onClose={close}
            />
          )}
        </div>

        {/* Projects / Milestones stubs */}
        <span onClick={() => jsonToast('Feature coming soon')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 opacity-70">Projects <ChevronDown size={12} /></span>
        <span onClick={() => jsonToast('Feature coming soon')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 opacity-70">Milestones <ChevronDown size={12} /></span>

        {/* Reviews */}
        <div className="relative">
          <span onClick={() => setActiveDropdown(activeDropdown === 'reviews' ? null : 'reviews')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 opacity-70">
            Reviews <ChevronDown size={12} />
          </span>
          {activeDropdown === 'reviews' && (
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
              <div onClick={() => { setActiveFilter('reviewing'); close(); }} className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-xs">Awaiting my review</div>
              <div onClick={() => { setActiveFilter('all'); close(); }} className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-xs text-gray-400">Clear filter</div>
            </div>
          )}
        </div>

        {/* Assignee */}
        <div className="relative">
          <span onClick={() => setActiveDropdown(activeDropdown === 'assignee' ? null : 'assignee')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 opacity-70">
            Assignee <ChevronDown size={12} />
          </span>
          {activeDropdown === 'assignee' && (
            <UserDropdown
              title="Assignee"
              users={prMetadata.users}
              onSelect={u => { setActiveAssignee(u); setActiveFilter('all'); close(); }}
              onClose={close}
              align="right"
            />
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <span onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')} className="hover:text-gray-900 cursor-pointer flex items-center gap-1 font-semibold text-gray-700">
            Sort: {sortState === 'oldest' ? 'Oldest' : sortState === 'recently_updated' ? 'Recently updated' : 'Newest'} <ChevronDown size={12} />
          </span>
          {activeDropdown === 'sort' && (
            <div className="absolute right-0 mt-1 w-44 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
              <div onClick={() => { setSortState('newest'); close(); }} className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-xs">Newest</div>
              <div onClick={() => { setSortState('oldest'); close(); }} className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-xs">Oldest</div>
              <div onClick={() => { setSortState('recently_updated'); close(); }} className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-xs">Recently updated</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
