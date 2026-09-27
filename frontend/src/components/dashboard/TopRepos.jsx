import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookMarked, Star, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import apiClient from '../../lib/axios';

function RepoRow({ repo, index, avatarSrc, onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors group cursor-pointer text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <img
          src={avatarSrc}
          alt="repo owner"
          className="w-4 h-4 rounded-full flex-shrink-0 object-cover bg-gray-200"
        />
        <span className="text-[12.5px] font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
          {repo.name}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        {repo.isPrivate && (
          <Lock size={10} className="text-gray-400" />
        )}
      </div>
    </motion.button>
  );
}

export default function TopRepos() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const defaultPfp =
    import.meta.env.VITE_DEFAULT_PFP_URL ||
    'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';
  const profilePic = user?.profilePicture || defaultPfp;

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/repos');
        setRepos(res.data.data || []);
      } catch (err) {
        // fail silently for unauth / offline
      } finally {
        setLoading(false);
      }
    };
    fetchRepos();
  }, []);

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRepoClick = (repo) => {
    const ownerHandle =
      repo.owner?.username ||
      repo.owner?.email?.split('@')[0] ||
      user?.username ||
      'user';
    navigate(`/repo/${ownerHandle}/${repo.name}`);
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-[220px] flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[11px] font-bold text-gray-700 uppercase tracking-widest">
          Top Repos
        </span>
        <button
          onClick={() => navigate('/new/repository')}
          className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[#2ea043] hover:bg-[#2c974b] border border-[#2ea043] px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-sm"
        >
          <BookMarked size={11} strokeWidth={2.5} />
          New
        </button>
      </div>

      {/* Search */}
      <div className="mb-3 mx-1">
        <input
          type="text"
          placeholder="Find a repository…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-[12px] text-gray-900 placeholder-gray-500 bg-gray-100 border border-gray-300 rounded-lg outline-none focus:border-gray-500 focus:bg-white focus:ring-1 focus:ring-gray-300 transition-all"
        />
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-2" />

      {/* Repo list */}
      <div className="flex flex-col gap-0.5">
        {loading ? (
          <div className="py-4 text-center text-xs text-gray-400">Loading repos...</div>
        ) : filteredRepos.length > 0 ? (
          filteredRepos.map((repo, i) => (
            <RepoRow
              key={repo._id || repo.name}
              repo={repo}
              index={i}
              avatarSrc={repo.owner?.profilePicture || profilePic}
              onClick={() => handleRepoClick(repo)}
            />
          ))
        ) : (
          <div className="py-6 px-2 text-center text-xs text-gray-500">
            <p className="mb-2">No repositories found.</p>
            <button
              onClick={() => navigate('/new/repository')}
              className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Create your first repo
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
