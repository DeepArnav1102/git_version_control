import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Globe, Pin, Eye, ChevronDown, GitFork, Star, GitBranch, History, Terminal, Check, Copy, RefreshCw, ArrowUp, ArrowDown, Download, Code2 } from 'lucide-react';

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
  handleToggleStar,
  handleFork,
  handleSync,
  handleDownloadZip,
  handleOpenRepoInCodespace,
  loadingCodespace,
  isRepo100PercentPython,
  currentUser
}) {
  const dropdownRef = useRef(null);
  const [copiedRemote, setCopiedRemote] = useState(false);
  const [copiedPush, setCopiedPush] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCloneDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setShowCloneDropdown]);

  const handleCopyRemote = () => {
    copyToClipboard(`rusty remote add origin ${remoteUrl}`);
    setCopiedRemote(true);
    setTimeout(() => setCopiedRemote(false), 2000);
  };

  const handleCopyPush = () => {
    copyToClipboard('rusty push');
    setCopiedPush(true);
    setTimeout(() => setCopiedPush(false), 2000);
  };

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
        {repoData.isFork && repoData.parentRepo && (
          <div className="text-xs text-gray-500 mt-0.5 mb-1 flex items-center gap-2 flex-wrap">
            <span>
              forked from{' '}
              <Link to={`/${repoData.parentRepo.owner.username}/${repoData.parentRepo.name}`} className="hover:text-blue-600 hover:underline">
                {repoData.parentRepo.owner.username}/{repoData.parentRepo.name}
              </Link>
            </span>
            {(repoData.ahead > 0 || repoData.behind > 0) && (
              <div className="flex items-center gap-1.5 text-[11px] bg-gray-50 px-2 py-1 rounded-full border border-gray-200 text-gray-600">
                <span>This branch is</span>
                {repoData.ahead > 0 && (
                  <span className="flex items-center gap-0.5 font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-300">
                    <ArrowUp size={11} strokeWidth={3} />
                    {repoData.ahead} ahead
                  </span>
                )}
                {repoData.behind > 0 && (
                  <span className="flex items-center gap-0.5 font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-300">
                    <ArrowDown size={11} strokeWidth={3} />
                    {repoData.behind} behind
                  </span>
                )}
                <span>of {repoData.parentRepo.owner.username}:{repoData.parentRepo.defaultBranch || 'main'}</span>
              </div>
            )}
            {repoData.ahead === 0 && repoData.behind === 0 && (
              <div className="flex items-center gap-1.5 text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-700">
                <Check size={12} strokeWidth={3} />
                <span>
                  This branch is up to date with <span className="font-semibold">{repoData.parentRepo.owner.username}:{repoData.parentRepo.defaultBranch || 'main'}</span>
                </span>
              </div>
            )}
          </div>
        )}
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
          
          {repoData.isFork && currentUser?._id === repoData.owner?._id && (
            <button 
              onClick={handleSync}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors shadow-sm cursor-pointer border text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
            >
              <RefreshCw size={14} className="text-gray-500" />
              <span>Sync fork</span>
            </button>
          )}

          <div className="flex rounded-md shadow-sm">
            <button className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
              <Eye size={14} className="text-gray-500" />
              <span>Watch</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{repoData.watchersCount || 0}</span>
            </button>
          </div>
          <div className="flex rounded-md shadow-sm">
            <button 
              onClick={handleFork}
              disabled={currentUser?._id === repoData.owner?._id}
              className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer border ${
                currentUser?._id === repoData.owner?._id ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              <GitFork size={14} className={currentUser?._id === repoData.owner?._id ? "text-gray-400" : "text-gray-500"} />
              <span>Fork</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{repoData.forksCount || 0}</span>
            </button>
          </div>
          <div className="flex rounded-md shadow-sm">
            <button 
              onClick={handleToggleStar}
              className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer border ${
                isStarred ? 'bg-gray-100 text-gray-900 border-gray-300 shadow-inner' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Star size={14} className={isStarred ? 'text-gray-900 fill-gray-900' : 'text-gray-500'} />
              <span>{isStarred ? 'Unstar' : 'Star'}</span>
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{repoData.starsCount || 0}</span>
            </button>
          </div>
        </div>

        {!isEmpty && (
          <>
            {/* Branch selector */}
            <button
              data-branch-selector
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <GitBranch size={13} />
              <span>{currentBranch}</span>
            </button>

            {/* Commits count */}
            <button
              onClick={() => handleTabChange('commits')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
            >
              <History size={13} />
              <span>{commits.length} {commits.length === 1 ? 'commit' : 'commits'}</span>
            </button>

            {/* Clone / Remote Dropdown */}
            <div className="relative" ref={dropdownRef}>
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
                    <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-md">
                      <span className="font-mono text-[10.5px] text-gray-700 truncate select-all flex-1">
                        rusty remote add origin {remoteUrl}
                      </span>
                      <button
                        onClick={handleCopyRemote}
                        className="p-1 text-gray-500 hover:text-black transition-colors cursor-pointer"
                        title="Copy Command"
                      >
                        {copiedRemote ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-md">
                      <span className="font-mono text-[10.5px] text-gray-700 truncate select-all flex-1">
                        rusty push
                      </span>
                      <button
                        onClick={handleCopyPush}
                        className="p-1 text-gray-500 hover:text-black transition-colors cursor-pointer"
                        title="Copy Command"
                      >
                        {copiedPush ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {isRepo100PercentPython && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <button
                        onClick={handleOpenRepoInCodespace}
                        disabled={loadingCodespace}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-transparent rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Code2 size={14} />
                        {loadingCodespace ? 'Preparing Codespace...' : 'Open in Codespace'}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={handleDownloadZip}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      Download ZIP
                    </button>
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
