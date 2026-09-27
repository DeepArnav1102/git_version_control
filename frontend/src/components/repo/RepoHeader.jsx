import React from 'react';
import { Lock, Globe, Pin, Eye, ChevronDown, GitFork, Star, GitBranch, History, Terminal, Check, Copy } from 'lucide-react';

export default function RepoHeader({
  repoData,
  isOwner,
  isEmpty,
  currentBranch,
  commits,
  handleTabChange,
  showCloneDropdown,
  setShowCloneDropdown,
  remoteUrl,
  copyToClipboard,
  copiedClone,
  isPinned,
  handlePinToggle,
  isStarred,
  handleToggleStar
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
          <span className="font-bold text-gray-900 text-xl">{repoData.name}</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-gray-300 bg-gray-50 text-gray-700 ml-2">
            {repoData.isPrivate ? (
              <>
                <Lock size={10} /> Private
              </>
            ) : (
              <>
                <Globe size={10} /> Public
              </>
            )}
          </span>
        </div>
        {repoData.description && (
          <p className="text-sm text-gray-600 mt-1">{repoData.description}</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Stats Buttons */}
        <div className="hidden md:flex items-center gap-2 mr-2">
          {isOwner && (
            <button 
              onClick={handlePinToggle}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer border ${
                isPinned 
                  ? 'bg-gray-100 text-gray-900 border-gray-300 shadow-inner' 
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Pin size={14} className={isPinned ? 'text-gray-900 fill-gray-900' : 'text-gray-500'} />
              <span>{isPinned ? 'Unpin' : 'Pin'}</span>
            </button>
          )}
          <div className="flex rounded-md shadow-sm">
            <button className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 transition-colors cursor-pointer">
              <Eye size={14} className="text-gray-500" />
              <span>Watch</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{repoData.watchersCount || 0}</span>
            </button>
            <button className="px-1.5 py-1 text-gray-700 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50 transition-colors cursor-pointer">
              <ChevronDown size={14} className="text-gray-500" />
            </button>
          </div>
          <div className="flex rounded-md shadow-sm">
            <button className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 transition-colors cursor-pointer">
              <GitFork size={14} className="text-gray-500" />
              <span>Fork</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{repoData.forksCount || 0}</span>
            </button>
            <button className="px-1.5 py-1 text-gray-700 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50 transition-colors cursor-pointer">
              <ChevronDown size={14} className="text-gray-500" />
            </button>
          </div>
          <div className="flex rounded-md shadow-sm">
            <button 
              onClick={handleToggleStar}
              className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold rounded-l-md transition-colors cursor-pointer border-y border-l ${
                isStarred ? 'bg-gray-100 text-gray-900 border-gray-300 shadow-inner' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Star size={14} className={isStarred ? 'text-gray-900 fill-gray-900' : 'text-gray-500'} />
              <span>{isStarred ? 'Unstar' : 'Star'}</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{repoData.starsCount || 0}</span>
            </button>
            <button className="px-1.5 py-1 text-gray-700 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50 transition-colors cursor-pointer">
              <ChevronDown size={14} className="text-gray-500" />
            </button>
          </div>
        </div>

        {!isEmpty && (
          <>
            {/* Branch selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 transition-colors">
              <GitBranch size={13} />
              <span>{currentBranch}</span>
            </div>

            {/* Commits count */}
            <button
              onClick={() => handleTabChange('commits')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
            >
              <History size={13} />
              <span>{commits.length} {commits.length === 1 ? 'commit' : 'commits'}</span>
            </button>

            {/* Clone / Remote Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCloneDropdown(!showCloneDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2ea043] hover:bg-[#2c974b] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Terminal size={13} />
                <span>Connect</span>
              </button>

              {showCloneDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                      Rusty Remote URL
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-300 rounded-lg p-2 mb-3">
                    <span className="text-[11px] font-mono text-gray-700 truncate select-all flex-1">
                      {remoteUrl}
                    </span>
                    <button
                      onClick={() => copyToClipboard(remoteUrl)}
                      className="p-1 text-gray-500 hover:text-black transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      {copiedClone ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-600 space-y-2">
                    <p className="font-semibold text-gray-800">Add remote in Rusty CLI:</p>
                    <pre className="p-2 bg-gray-900 text-gray-100 rounded-md font-mono text-[10.5px] overflow-x-auto">
                      rusty remote add origin {remoteUrl}
                    </pre>
                    <pre className="p-2 bg-gray-900 text-gray-100 rounded-md font-mono text-[10.5px] overflow-x-auto">
                      rusty push
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
