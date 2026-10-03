import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, Smile, User, Users, MessageSquare, Milestone, Tag, MessageCircle, PanelLeftClose } from 'lucide-react';
import { jsonToast } from '../../../lib/jsonToast';

export default function PRSidebar({ activeFilter, setActiveFilter, setIsSidebarOpen }) {
  const navItem = (filter, icon, label, fullWidth = false) => (
    <button
      onClick={() => setActiveFilter(filter)}
      className={`flex items-center gap-3 px-3 py-1.5 text-xs rounded-md transition-colors ${fullWidth ? 'w-full text-left' : ''} ${
        activeFilter === filter
          ? 'bg-gray-100 text-gray-900 font-semibold border border-gray-200 shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 'auto', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b md:border-b-0 md:border-r border-gray-200 bg-transparent overflow-hidden flex-shrink-0"
    >
      <div className="w-full md:w-64 flex flex-col justify-between p-4 bg-transparent h-full min-w-[256px]">
        <div>
          <nav className="flex flex-col gap-0.5 mb-6">
            {navItem('all', <Inbox size={14} />, 'Pull requests')}
            {navItem('authored', <Smile size={14} />, 'Authored by me')}
            {navItem('assigned', <User size={14} />, 'Assigned to me', true)}
            {navItem('involves', <Users size={14} />, 'Involves me', true)}
            {navItem('reviewing', <MessageSquare size={14} />, 'Review requests', true)}
          </nav>

          <div className="h-px bg-gray-200 w-full mb-4" />

          <nav className="flex flex-col gap-0.5">
            <button
              onClick={() => jsonToast('Feature coming soon')}
              className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md transition-colors opacity-70 w-full text-left"
            >
              <Milestone size={14} /> Milestones
            </button>
            <button
              onClick={() => jsonToast('Feature coming soon')}
              className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md transition-colors opacity-70 w-full text-left"
            >
              <Tag size={14} /> Labels
            </button>
          </nav>
        </div>

        <div className="mt-8">
          <nav className="flex flex-col gap-0.5">
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md transition-colors"
            >
              <MessageCircle size={14} /> Feedback
            </a>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md transition-colors w-full text-left"
            >
              <PanelLeftClose size={14} /> Collapse sidebar
            </button>
          </nav>
        </div>
      </div>
    </motion.div>
  );
}
