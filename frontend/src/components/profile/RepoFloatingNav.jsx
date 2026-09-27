import React from 'react';
import { Code, GitPullRequest, CircleDot, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RepoFloatingNav({ activeTab, setActiveTab, isOwner = true }) {
  const tabs = [
    { id: 'code', icon: Code, label: 'Code' },
    { id: 'pull-requests', icon: GitPullRequest, label: 'Pull requests' },
    { id: 'issues', icon: CircleDot, label: 'Issues' },
  ];

  if (isOwner) {
    tabs.push({ id: 'settings', icon: Settings, label: 'Settings' });
  }

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-sm rounded-full py-3 px-2 flex flex-col gap-3 z-40">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative p-2.5 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200 group ${
              isActive 
                ? 'text-blue-600' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            }`}
            aria-label={tab.label}
          >
            {isActive && (
              <motion.div
                layoutId="repoFloatingNavActive"
                className="absolute inset-0 bg-blue-50 rounded-full"
                transition={{
                  type: "spring",
                  bounce: 0.15,
                  duration: 0.4
                }}
              />
            )}
            
            <span className="relative z-10 flex items-center justify-center">
              <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
            </span>
            
            {/* Tooltip */}
            <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-sm pointer-events-none z-20">
              {tab.label}
              {/* Tooltip arrow */}
              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
