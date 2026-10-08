import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, PanelLeftClose, GitPullRequest } from 'lucide-react';
import apiClient from '../../lib/axios';
import { jsonToast } from '../../lib/jsonToast';
import useAuthStore from '../../store/useAuthStore';

import PRSidebar from './pr/PRSidebar';
import PRFilterBar from './pr/PRFilterBar';
import PRListItem from './pr/PRListItem';
import PRCreateView from './pr/PRCreateView';
import PRDetailView from './pr/PRDetailView';

export default function PullRequestsTab({ owner, repo, isOwner, currentBranch, branches, repoId, repoData }) {
  const { user } = useAuthStore();

  // Data
  const [prs, setPrs] = useState([]);
  const [prMetadata, setPrMetadata] = useState({ users: [], labels: [] });
  const [loading, setLoading] = useState(true);

  // View
  const [viewState, setViewState] = useState('list'); // 'list' | 'create' | 'detail'
  const [selectedPr, setSelectedPr] = useState(null);
  const [selectedPrCommits, setSelectedPrCommits] = useState([]);
  const [mergeConflict, setMergeConflict] = useState(null);
  const [merging, setMerging] = useState(false);

  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeState, setActiveState] = useState('open');
  const [searchQuery, setSearchQuery] = useState('is:pr state:open');
  const [sortState, setSortState] = useState('newest');
  const [activeLabel, setActiveLabel] = useState(null);
  const [activeAuthor, setActiveAuthor] = useState(null);
  const [activeAssignee, setActiveAssignee] = useState(null);
  const [activeReviewer, setActiveReviewer] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Create form
  const [newPr, setNewPr] = useState({ 
    title: '', 
    description: '', 
    sourceBranch: '', 
    targetBranch: 'main',
    sourceOwner: owner,
    sourceRepo: repo,
    targetOwner: owner,
    targetRepo: repo
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (repoData?.isFork && repoData.parentRepo) {
      setNewPr(prev => ({
        ...prev,
        targetOwner: repoData.parentRepo.owner.username,
        targetRepo: repoData.parentRepo.name
      }));
    } else {
      setNewPr(prev => ({
        ...prev,
        targetOwner: owner,
        targetRepo: repo
      }));
    }
  }, [repoData, owner, repo]);

  useEffect(() => {
    if (branches && branches.length > 0) {
      const defBranch = branches.find(b => b.isDefault)?.name || branches.find(b => b.name === 'main' || b.name === 'master')?.name || branches[0].name;
      setNewPr(prev => ({ ...prev, targetBranch: defBranch }));
    }
  }, [branches]);

  // ─── API ────────────────────────────────────────────────────────────────────

  const fetchPRs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (activeFilter === 'authored' && user) params.append('author', user._id);
      else if (activeAuthor) params.append('author', activeAuthor);

      if (activeFilter === 'assigned' && user) params.append('assignee', user._id);
      else if (activeAssignee) params.append('assignee', activeAssignee);

      if (activeFilter === 'reviewing' && user) params.append('reviewer', user._id);
      else if (activeReviewer) params.append('reviewer', activeReviewer);

      if (activeFilter === 'involves' && user) params.append('involves', user._id);
      if (activeLabel) params.append('label', activeLabel);
      if (sortState !== 'newest') params.append('sort', sortState);
      params.append('page', page);
      params.append('limit', 30);

      const url = `/repos/${owner}/${repo}/pulls${params.toString() ? `?${params}` : ''}`;
      const res = await apiClient.get(url);
      setPrs(res.data.prs || []);
      if (res.data.metadata) {
        setPrMetadata(res.data.metadata);
        setTotalPages(res.data.metadata.totalPages || 1);
      }
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to load pull requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPRs(); }, [owner, repo, activeFilter, activeLabel, activeAuthor, activeAssignee, activeReviewer, sortState, user, page]);

  // Sync search query display
  useEffect(() => {
    const filterParts = { authored: 'author:@me', assigned: 'assignee:@me', reviewing: 'reviewer:@me', involves: 'involves:@me' };
    let query = `is:pr${activeState !== 'all' ? ` state:${activeState}` : ''}`;
    if (filterParts[activeFilter]) query += ` ${filterParts[activeFilter]}`;
    else {
      if (activeAuthor) query += ` author:${activeAuthor}`;
      if (activeAssignee) query += ` assignee:${activeAssignee}`;
      if (activeReviewer) query += ` reviewer:${activeReviewer}`;
    }
    if (activeLabel) query += ` label:${activeLabel}`;
    setSearchQuery(query);
  }, [activeFilter, activeState, activeLabel, activeAuthor, activeAssignee, activeReviewer]);

  const handleSearchSubmit = (e) => {
    if (e.key !== 'Enter') return;
    const q = searchQuery.toLowerCase();
    if (q.includes('state:closed') || q.includes('state:merged')) setActiveState('closed');
    else if (q.includes('state:open')) setActiveState('open');
    else setActiveState('all');

    const isMe = q.includes(':@me') || (user && q.includes(`:${user.username.toLowerCase()}`));
    let newFilter = 'all';
    if (q.includes('author:') && isMe) newFilter = 'authored';
    else if (q.includes('assignee:') && isMe) newFilter = 'assigned';
    else if (q.includes('reviewer:') && isMe) newFilter = 'reviewing';
    else if (q.includes('involves:') && isMe) newFilter = 'involves';
    setActiveFilter(newFilter);

    const authorMatch = q.match(/author:([^\s:]+)/);
    setActiveAuthor(authorMatch && !isMe ? authorMatch[1] : null);
    const assigneeMatch = q.match(/assignee:([^\s:]+)/);
    setActiveAssignee(assigneeMatch && !isMe ? assigneeMatch[1] : null);
    const reviewerMatch = q.match(/reviewer:([^\s:]+)/);
    setActiveReviewer(reviewerMatch && !isMe ? reviewerMatch[1] : null);
    const labelMatch = q.match(/label:([^\s:]+)/);
    setActiveLabel(labelMatch ? labelMatch[1] : null);
    setPage(1); // Reset page on new search
  };

  const handleCreatePR = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newPr,
        sourceOwner: newPr.sourceOwner,
        sourceRepo: newPr.sourceRepo,
        assignees: newPr.assignees?.map(a => a._id || a) || [],
        reviewers: newPr.reviewers?.map(r => r._id || r) || [],
      };
      await apiClient.post(`/repos/${newPr.targetOwner}/${newPr.targetRepo}/pulls`, payload);
      jsonToast.success('Pull request created!');
      setViewState('list');
      // If we posted to another repo (the parent), fetchPRs on the current repo won't show it immediately,
      // but if the user goes to the parent repo, they'll see it.
      // We can still try to fetchPRs (maybe we show outgoing PRs?)
      fetchPRs();
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to create PR');
    }
  };

  const fetchPRDetails = async (pr) => {
    setSelectedPr(pr);
    setViewState('detail');
    setMergeConflict(null);
    setSelectedPrCommits([]);
    try {
      const [prRes, commitsRes] = await Promise.all([
        apiClient.get(`/repos/${owner}/${repo}/pulls/${pr._id}`),
        apiClient.get(`/repos/${owner}/${repo}/pulls/${pr._id}/commits`),
      ]);
      setSelectedPr(prRes.data.pr);
      setSelectedPrCommits(commitsRes.data.commits || []);
    } catch {
      jsonToast.error('Failed to load pull request details');
    }
  };

  const handleMerge = async (id) => {
    try {
      setMerging(true);
      setMergeConflict(null);
      const res = await apiClient.post(`/repos/${owner}/${repo}/pulls/${id}/merge`);
      jsonToast.success(res.data.message || 'Merged successfully!');
      fetchPRs();
      setSelectedPr(prev => ({ ...prev, state: 'merged' }));
    } catch (err) {
      if (err?.response?.status === 409) {
        setMergeConflict({ message: err.response.data.message || 'Merge conflict', files: err.response.data.conflictFiles || [] });
      } else {
        jsonToast.error(err?.response?.data?.message || 'Merge failed');
      }
    } finally {
      setMerging(false);
    }
  };

  const handleClose = async (id) => {
    try {
      await apiClient.patch(`/repos/${owner}/${repo}/pulls/${id}`, { state: 'closed' });
      jsonToast.success('Pull request closed');
      fetchPRs();
      if (selectedPr?._id === id) setSelectedPr(prev => ({ ...prev, state: 'closed' }));
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Close failed');
    }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const openCount = prs.filter(p => p.state === 'open').length;
  const closedCount = prs.filter(p => p.state === 'closed' || p.state === 'merged').length;
  const displayedPrs = prs.filter(p => {
    if (activeState === 'open') return p.state === 'open';
    if (activeState === 'closed') return p.state === 'closed' || p.state === 'merged';
    return true;
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

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
            className="w-full bg-transparent text-gray-900 overflow-hidden"
          >
            <div className="flex flex-col md:flex-row min-h-[500px]">
              {/* Sidebar */}
              <AnimatePresence initial={false}>
                {isSidebarOpen && (
                  <PRSidebar
                    activeFilter={activeFilter}
                    setActiveFilter={setActiveFilter}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                )}
              </AnimatePresence>

              {/* Main Content */}
              <div className="flex-1 p-6 min-w-0">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    {!isSidebarOpen && (
                      <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors border border-gray-200"
                        title="Expand sidebar"
                      >
                        <PanelLeftClose size={16} className="rotate-180" />
                      </button>
                    )}
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">All pull requests</h2>
                  </div>
                  <button
                    onClick={() => setViewState('create')}
                    className="bg-[#0969da] hover:bg-[#0353a4] text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-sm border border-[rgba(0,0,0,0.1)]"
                  >
                    New pull request
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-4 flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all bg-gray-50">
                  <div className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 border-r border-gray-300 cursor-pointer hover:text-gray-900 flex items-center gap-1">
                    Filters <ChevronDown size={12} />
                  </div>
                  <div className="flex-1 flex items-center px-3 py-1.5 bg-gray-50">
                    <Search size={14} className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchSubmit}
                      className="bg-transparent border-none outline-none text-xs text-gray-900 w-full placeholder-gray-500"
                    />
                    <X
                      size={14}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer ml-2"
                      onClick={() => { setSearchQuery('is:pr state:open'); setActiveState('open'); setActiveFilter('all'); setActiveAuthor(null); setActiveAssignee(null); setActiveLabel(null); }}
                    />
                  </div>
                </div>

                {/* List Container */}
                <div className="border border-gray-300 rounded-md overflow-visible bg-white">
                  <PRFilterBar
                    activeState={activeState} setActiveState={setActiveState}
                    openCount={openCount} closedCount={closedCount}
                    activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown}
                    prMetadata={prMetadata}
                    setActiveAuthor={setActiveAuthor} setActiveFilter={setActiveFilter}
                    setActiveLabel={setActiveLabel}
                    setActiveAssignee={setActiveAssignee}
                    sortState={sortState} setSortState={setSortState}
                  />

                  <div className="divide-y divide-gray-200">
                    {loading ? (
                      [1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="p-3 flex items-start gap-3 bg-white">
                          <div className="mt-0.5"><div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2 max-w-[400px]" />
                              <div className="h-3 bg-gray-200 rounded-full animate-pulse w-16" />
                            </div>
                            <div className="flex items-center justify-between w-full mt-1">
                              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3 max-w-[300px]" />
                              <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse" />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : displayedPrs.length === 0 ? (
                      <div className="p-16 text-center flex flex-col items-center">
                        <GitPullRequest size={28} className="text-gray-400 mb-4 stroke-[1.5]" />
                        <h3 className="text-[16px] font-bold text-gray-900 mb-2 tracking-tight">No pull requests matched your search</h3>
                        <p className="text-gray-500 text-xs max-w-sm">
                          Try a different search query.{' '}
                          <a href="#" className="text-[#0969da] hover:underline">Learn more about searching and filtering pull requests.</a>
                        </p>
                      </div>
                    ) : (
                      displayedPrs.map(pr => (
                        <PRListItem key={pr._id} pr={pr} onClick={() => fetchPRDetails(pr)} />
                      ))
                    )}
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex justify-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-xs border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-xs text-gray-600 border border-transparent flex items-center">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 text-xs border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* CREATE VIEW */}
        {viewState === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <PRCreateView
              newPr={newPr} setNewPr={setNewPr}
              branches={branches}
              prMetadata={prMetadata}
              user={user}
              onSubmit={handleCreatePR}
              onCancel={() => setViewState('list')}
            />
          </motion.div>
        )}

        {/* DETAIL VIEW */}
        {viewState === 'detail' && selectedPr && (
          <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full">
            <PRDetailView
              selectedPr={selectedPr} setSelectedPr={setSelectedPr}
              selectedPrCommits={selectedPrCommits}
              mergeConflict={mergeConflict}
              merging={merging}
              isOwner={isOwner}
              user={user}
              owner={owner} repo={repo}
              onBack={() => setViewState('list')}
              onMerge={handleMerge}
              onClose={handleClose}
              fetchPRs={fetchPRs}
              prMetadata={prMetadata}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
