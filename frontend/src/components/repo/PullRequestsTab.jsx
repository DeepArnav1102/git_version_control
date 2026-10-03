import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitPullRequest, Plus, Search, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import apiClient from '../../lib/axios';
import { jsonToast } from '../../lib/jsonToast';

export default function PullRequestsTab({ owner, repo, isOwner, currentBranch, branches, repoId }) {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState('list'); // 'list', 'create', 'detail'
  const [selectedPr, setSelectedPr] = useState(null);

  // Create PR form state
  const [newPr, setNewPr] = useState({
    title: '',
    description: '',
    sourceBranch: '',
    targetBranch: 'main'
  });

  const fetchPRs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/repos/${owner}/${repo}/pulls`);
      setPrs(res.data.prs || []);
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to load pull requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, [owner, repo]);

  const handleCreatePR = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient.post(`/repos/${owner}/${repo}/pulls`, {
        ...newPr,
        sourceOwner: owner,
        sourceRepo: repo,
      });
      jsonToast.success('Pull request created!');
      setViewState('list');
      fetchPRs();
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to create PR');
    }
  };

  const handleMerge = async (id) => {
    try {
      const res = await apiClient.post(`/repos/${owner}/${repo}/pulls/${id}/merge`);
      jsonToast.success(res.data.message || 'Merged successfully!');
      fetchPRs();
      setSelectedPr(null);
      setViewState('list');
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Merge failed');
    }
  };

  const handleClose = async (id) => {
    try {
      const res = await apiClient.patch(`/repos/${owner}/${repo}/pulls/${id}`, { state: 'closed' });
      jsonToast.success('Pull request closed');
      fetchPRs();
      if (selectedPr && selectedPr._id === id) {
          setSelectedPr({...selectedPr, state: 'closed'});
      }
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Close failed');
    }
  };

  return (
    <div className="w-full font-sans">
      <AnimatePresence mode="wait">
        
        {/* LIST VIEW */}
        {viewState === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search pull requests..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fd8c73]/20 focus:border-[#fd8c73] transition-all"
                />
              </div>
              <button
                onClick={() => setViewState('create')}
                className="flex items-center gap-2 bg-[#1f2328] hover:bg-[#24292e] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Plus size={16} /> New pull request
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-4 text-sm font-medium text-gray-600">
                <span className="flex items-center gap-2 text-gray-900"><GitPullRequest size={16}/> {prs.filter(p => p.state === 'open').length} Open</span>
                <span className="flex items-center gap-2"><CheckCircle size={16}/> {prs.filter(p => p.state === 'merged').length} Merged</span>
                <span className="flex items-center gap-2"><XCircle size={16}/> {prs.filter(p => p.state === 'closed').length} Closed</span>
              </div>
              
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <div className="p-8 text-center text-gray-500 text-sm">Loading pull requests...</div>
                ) : prs.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <GitPullRequest size={24} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No pull requests</h3>
                    <p className="text-gray-500 text-sm max-w-sm">There are no pull requests in this repository yet. Create one to propose changes to the code.</p>
                  </div>
                ) : (
                  prs.map(pr => (
                    <div 
                      key={pr._id} 
                      onClick={() => { setSelectedPr(pr); setViewState('detail'); }}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-4"
                    >
                      <div className="mt-1">
                        {pr.state === 'open' ? (
                          <GitPullRequest className="text-green-500" size={20} />
                        ) : pr.state === 'merged' ? (
                          <GitPullRequest className="text-purple-500" size={20} />
                        ) : (
                          <XCircle className="text-red-500" size={20} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900 hover:text-[#fd8c73] transition-colors">{pr.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>#{pr._id.slice(-4)} opened {new Date(pr.createdAt).toLocaleDateString()} by {pr.author?.username}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{pr.sourceBranch} <ArrowRight size={10}/> {pr.targetBranch}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* CREATE VIEW */}
        {viewState === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full max-w-3xl mx-auto"
          >
            <div className="mb-6">
              <button onClick={() => setViewState('list')} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-flex items-center gap-2">
                ← Back to pull requests
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Compare changes</h2>
              <p className="text-gray-500 text-sm mt-1">Choose two branches to see what's changed or to start a new pull request.</p>
            </div>

            <form onSubmit={handleCreatePR} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-4">
                 <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">base (target)</label>
                    <select 
                      value={newPr.targetBranch} 
                      onChange={e => setNewPr({...newPr, targetBranch: e.target.value})}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white font-mono"
                    >
                      {branches?.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                 </div>
                 <div className="pt-5 text-gray-400">
                    <ArrowRight size={20} />
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">compare (source)</label>
                    <select 
                      value={newPr.sourceBranch} 
                      onChange={e => setNewPr({...newPr, sourceBranch: e.target.value})}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white font-mono"
                      required
                    >
                      <option value="" disabled>Select branch...</option>
                      {branches?.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                 </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Pull request title"
                    required
                    maxLength={255}
                    value={newPr.title}
                    onChange={e => setNewPr({...newPr, title: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#fd8c73]/20 focus:border-[#fd8c73] transition-all font-semibold"
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Add a description..."
                    rows={6}
                    value={newPr.description}
                    onChange={e => setNewPr({...newPr, description: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#fd8c73]/20 focus:border-[#fd8c73] transition-all resize-y"
                  ></textarea>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
                <button type="button" onClick={() => setViewState('list')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!newPr.title || !newPr.sourceBranch} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50">
                  Create pull request
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* DETAIL VIEW */}
        {viewState === 'detail' && selectedPr && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <button onClick={() => setViewState('list')} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-flex items-center gap-2">
              ← Back to pull requests
            </button>
            
            <div className="border-b border-gray-200 pb-6 mb-6">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-3xl font-bold text-gray-900">
                  {selectedPr.title} <span className="text-gray-400 font-normal">#{selectedPr._id.slice(-4)}</span>
                </h2>
                {isOwner && selectedPr.state === 'open' && (
                  <button onClick={() => handleClose(selectedPr._id)} className="px-3 py-1.5 border border-gray-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors">
                    Close PR
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selectedPr.state === 'open' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-medium">
                    <GitPullRequest size={16}/> Open
                  </span>
                ) : selectedPr.state === 'merged' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-medium">
                    <GitPullRequest size={16}/> Merged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500 text-white rounded-full text-sm font-medium">
                    <XCircle size={16}/> Closed
                  </span>
                )}
                
                <span className="text-gray-600 text-sm">
                  <strong className="font-semibold text-gray-900">{selectedPr.author?.username}</strong> wants to merge into <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs text-gray-800">{selectedPr.targetBranch}</code> from <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs text-gray-800">{selectedPr.sourceBranch}</code>
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-6">
                <div className="flex gap-4">
                   <img src={selectedPr.author?.avatarUrl || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg'} alt="pfp" className="w-10 h-10 rounded-full border border-gray-200" />
                   <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                     <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm text-gray-600">
                        <strong className="text-gray-900">{selectedPr.author?.username}</strong> commented on {new Date(selectedPr.createdAt).toLocaleDateString()}
                     </div>
                     <div className="p-4 text-sm text-gray-800 whitespace-pre-wrap">
                        {selectedPr.description || <em className="text-gray-400">No description provided.</em>}
                     </div>
                   </div>
                </div>
                
                {selectedPr.state === 'open' && isOwner && (
                  <div className="border border-green-200 bg-green-50 rounded-xl p-6 flex flex-col items-center justify-center text-center mt-8">
                     <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                       <CheckCircle size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-1">This pull request can be merged</h3>
                     <p className="text-sm text-gray-600 mb-4 max-w-sm">
                       Our incredibly fast Rust engine has checked this branch and there are no conflicts with the base branch.
                     </p>
                     <button onClick={() => handleMerge(selectedPr._id)} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors w-full md:w-auto">
                       Merge pull request
                     </button>
                  </div>
                )}
                
                {selectedPr.state === 'merged' && (
                  <div className="border border-purple-200 bg-purple-50 rounded-xl p-6 flex flex-col items-center justify-center text-center mt-8">
                     <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
                       <GitPullRequest size={24} />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900 mb-1">Pull request successfully merged</h3>
                     <p className="text-sm text-purple-700 mb-4 max-w-sm">
                       The commits were merged into {selectedPr.targetBranch} securely via the native Rust merge engine.
                     </p>
                  </div>
                )}

              </div>
              
              <div className="w-full md:w-64 flex-shrink-0">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Reviewers</h4>
                  <p className="text-sm text-gray-600">No reviewers</p>
                  
                  <div className="h-px bg-gray-200 my-4"></div>
                  
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Assignees</h4>
                  <p className="text-sm text-gray-600">No one assigned</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
