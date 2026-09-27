import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Book, Lock, Globe, Plus } from 'lucide-react';
import apiClient from '../../lib/axios';
import { jsonToast } from '../../lib/jsonToast';
import useAuthStore from '../../store/useAuthStore';

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

export default function ProfileRepos({ user, onRepoCountChange }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isOwner = !user || user.username === currentUser?.username;
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchRepos = async () => {
      if (!user?.username) return;
      try {
        setLoading(true);
        const res = await apiClient.get(`/repos/user/${user.username}`);
        const repoList = res.data.data || [];
        setRepos(repoList);
        if (onRepoCountChange) {
          onRepoCountChange(repoList.length);
        }
      } catch (err) {
        jsonToast.error(err?.response?.data?.message || 'Failed to load repositories');
      } finally {
        setLoading(false);
      }
    };
    fetchRepos();
  }, [onRepoCountChange, user?.username]);

  const ownerName = user?.username || user?.email?.split('@')[0] || 'user';

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[300px] flex items-center justify-center"
      >
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Search + New Repo */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Find a repository…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white placeholder:text-gray-400"
        />
        {isOwner && (
          <button
            onClick={() => navigate('/new/repository')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2ea043] hover:bg-[#2c974b] text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={13} />
            New
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[200px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
              <Book size={18} strokeWidth={1.4} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-400 font-medium mb-1">
              {search ? 'No matching repositories' : 'No repositories yet'}
            </p>
            <p className="text-xs text-gray-300">
              {search
                ? 'Try a different search term.'
                : isOwner 
                  ? 'Create your first repository to get started.'
                  : `${user?.name || user?.username} doesn't have any public repositories yet.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map((repo, i) => {
            const repoOwner = repo.owner?.username || repo.owner?.email?.split('@')[0] || ownerName;
            return (
              <button
                key={repo._id || repo.name}
                onClick={() => navigate(`/repo/${repoOwner}/${repo.name}`)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50/70 transition-colors cursor-pointer group"
              >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-blue-600 group-hover:underline">
                  {repo.name}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-gray-300 bg-gray-50 text-gray-600">
                  {repo.isPrivate ? (
                    <>
                      <Lock size={9} /> Private
                    </>
                  ) : (
                    <>
                      <Globe size={9} /> Public
                    </>
                  )}
                </span>
              </div>
              {repo.description && (
                <p className="text-xs text-gray-500 mb-1.5 line-clamp-1">
                  {repo.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                {repo.latestCommit?.message && (
                  <span className="truncate max-w-[200px]">
                    {repo.latestCommit.message}
                  </span>
                )}
                <span>Updated {timeAgo(repo.updatedAt)}</span>
              </div>
            </button>
          );
        })}
        </div>
      )}
    </motion.div>
  );
}
