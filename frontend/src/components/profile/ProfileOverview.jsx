import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, GripVertical, Settings, X, Plus, Loader2 } from 'lucide-react';
import apiClient from '../../lib/axios';
import { jsonToast } from '../../lib/jsonToast';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import ProfileReadme from './ProfileReadme';

// Helper to determine the color of a contribution square
const getContributionHex = (count) => {
  if (count === 0) return '#ebedf0';
  if (count <= 2) return '#9be9a8';
  if (count <= 4) return '#40c463';
  if (count <= 6) return '#30a14e';
  return '#216e39';
};

const getLanguageColor = (language) => {
  const colors = {
    JavaScript: 'bg-yellow-400',
    TypeScript: 'bg-blue-500',
    Python: 'bg-blue-400',
    Java: 'bg-orange-500',
    'C++': 'bg-pink-500',
    'C#': 'bg-green-500',
    Ruby: 'bg-red-500',
    Go: 'bg-cyan-500',
    Rust: 'bg-orange-600',
    'Jupyter Notebook': 'bg-orange-500'
  };
  return colors[language] || 'bg-gray-400';
};

export default function ProfileOverview({ user, isOwner }) {
  const [heatmapData, setHeatmapData] = useState(null);
  const [totalContributions, setTotalContributions] = useState(0);
  const [loadingHeatmap, setLoadingHeatmap] = useState(true);
  
  // Pin Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [allRepos, setAllRepos] = useState([]);
  const [selectedPins, setSelectedPins] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingPins, setSavingPins] = useState(false);
  const { setUser } = useAuthStore();

  useEffect(() => {
    if (user?.username) {
      fetchContributions();
    }
  }, [user?.username]);

  const fetchContributions = async () => {
    try {
      const res = await apiClient.get(`/users/u/${user.username}/contributions`);
      setHeatmapData(res.data.data.heatmap);
      setTotalContributions(res.data.data.totalContributions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  const openPinModal = async () => {
    setIsPinModalOpen(true);
    setSelectedPins(user.pinnedRepos?.map(r => r._id) || []);
    setLoadingRepos(true);
    try {
      const res = await apiClient.get('/repos');
      // only show repos owned by this user
      const userId = user._id || user.id;
      const owned = res.data.data.filter(r => r.owner._id === userId || r.owner === userId);
      setAllRepos(owned);
    } catch (err) {
      jsonToast.error('Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const savePins = async () => {
    if (selectedPins.length > 6) {
      return jsonToast.error('You can only pin up to 6 repositories');
    }
    setSavingPins(true);
    try {
      const res = await apiClient.put('/users/pinned', { pinnedRepos: selectedPins });
      setUser({ ...user, pinnedRepos: res.data.data.pinnedRepos });
      setIsPinModalOpen(false);
      jsonToast.success('Pins updated successfully');
    } catch (err) {
      jsonToast.error('Failed to update pins');
    } finally {
      setSavingPins(false);
    }
  };

  const togglePin = (repoId) => {
    if (selectedPins.includes(repoId)) {
      setSelectedPins(selectedPins.filter(id => id !== repoId));
    } else {
      if (selectedPins.length >= 6) {
        jsonToast.error('Maximum 6 repositories can be pinned');
        return;
      }
      setSelectedPins([...selectedPins, repoId]);
    }
  };

  // Generate heatmap grid (last 371 days to fit 53 weeks)
  const generateGrid = () => {
    if (!heatmapData) return [];
    const grid = [];
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 370); // Start 370 days ago
    
    // Create 53 columns
    for (let col = 0; col < 53; col++) {
      const week = [];
      for (let row = 0; row < 7; row++) {
        const dateString = currentDate.toISOString().split('T')[0];
        const count = heatmapData[dateString] || 0;
        week.push({ date: dateString, count });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      grid.push(week);
    }
    return grid;
  };

  const heatmapGrid = generateGrid();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      {/* ── PROFILE README ── */}
      <div className="pb-4 border-b border-gray-100">
        <ProfileReadme user={user} />
      </div>

      {/* ── PINNED REPOSITORIES ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-800 font-semibold">Pinned</h2>
          {isOwner && !isPinModalOpen && (
            <button
              onClick={openPinModal}
              className="text-xs text-gray-500 hover:text-blue-600 transition-colors cursor-pointer font-medium"
            >
              Customize your pins
            </button>
          )}
        </div>

        {isPinModalOpen ? (
          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Edit Pinned Repositories</h3>
              <div className="text-xs text-gray-500">{selectedPins.length}/6 pinned</div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 mb-4 scrollbar-thin">
              {loadingRepos ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
              ) : allRepos.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No repositories available to pin.</p>
              ) : (
                allRepos.map(repo => (
                  <label key={repo._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-gray-100 hover:border-gray-200 shadow-sm">
                    <input
                      type="checkbox"
                      checked={selectedPins.includes(repo._id)}
                      onChange={() => togglePin(repo._id)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-800 truncate">{repo.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-500 text-[10px] font-semibold">
                          {repo.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{repo.description}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button 
                onClick={() => setIsPinModalOpen(false)} 
                className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={savePins} 
                disabled={savingPins}
                className="px-4 py-1.5 text-xs font-semibold bg-[#2ea043] text-white hover:bg-[#2c974b] rounded-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingPins ? 'Saving...' : 'Save Pins'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user?.pinnedRepos?.map((repo) => (
              <div key={repo._id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Book size={16} className="text-gray-400" />
                    <Link to={`/repo/${repo.owner?.username || user.username}/${repo.name}`} className="font-semibold text-blue-600 hover:underline text-sm">
                      {repo.name}
                    </Link>
                    <span className="px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 text-[10px] font-semibold">
                      {repo.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                    {repo.description || 'No description provided.'}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  {repo.language && (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${getLanguageColor(repo.language)}`} />
                      {repo.language}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {(!user?.pinnedRepos || user.pinnedRepos.length === 0) && (
              <div className="col-span-1 md:col-span-2 py-10 border border-gray-200 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                <Book size={24} className="mb-2 text-gray-400" />
                <p className="text-sm font-medium">No pinned repositories yet.</p>
                {isOwner && (
                  <button
                    onClick={openPinModal}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Pin repositories
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CONTRIBUTIONS HEATMAP ── */}
      <div className="pt-4 border-t border-gray-200">
        <h2 className="text-gray-800 font-semibold mb-4">
          {totalContributions} contributions in the last year
        </h2>
        
        <div className="border border-gray-200 rounded-xl p-6 bg-white overflow-hidden relative shadow-sm">
          {loadingHeatmap ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-500 text-sm">Loading contributions...</span>
            </div>
          ) : (
            <div className="flex gap-[3px] overflow-x-auto pb-2 scrollbar-thin">
              {heatmapGrid.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      title={`${day.count} contributions on ${day.date}`}
                      className="w-[10px] h-[10px] rounded-[2px]"
                      style={{ backgroundColor: getContributionHex(day.count) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
          
          {/* Legend */}
          <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-gray-500 w-full font-medium">
            <span>Less</span>
            <div className="flex gap-[3px]">
              <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: '#ebedf0' }} />
              <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: '#9be9a8' }} />
              <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: '#40c463' }} />
              <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: '#30a14e' }} />
              <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: '#216e39' }} />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>

      {/* ── PIN MODAL ── */}
      
    </motion.div>
  );
}
