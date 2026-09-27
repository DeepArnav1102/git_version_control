import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleDot, GitPullRequest, Settings } from 'lucide-react';
import {
  BookMarked,
  GitBranch,
  History,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Copy,
  Check,
  Terminal,
  Lock,
  Globe,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Star,
  Download,
  Key,
  PanelLeftClose,
  PanelLeft,
  Search,
  Pin,
  GitFork,
  Monitor,
  UserPlus,
  Code
} from 'lucide-react';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';
import useAuthStore from '../store/useAuthStore';
import { getFileIcon } from '../utils/fileIcons';
import SidebarNode from '../components/repo/SidebarNode';
import ReadmeBox from '../components/repo/ReadmeBox';
import EmptyRepoView from '../components/repo/EmptyRepoView';
import RepoHeader from '../components/repo/RepoHeader';
import CommitsTab from '../components/repo/CommitsTab';
import SettingsTab from '../components/repo/SettingsTab';
import CodeTab from '../components/repo/CodeTab';

export default function RepoDetail() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuthStore();

  const [repoData, setRepoData] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [rootTree, setRootTree] = useState(null); // For sidebar
  const [currentBranch, setCurrentBranch] = useState('main');
  const [currentPath, setCurrentPath] = useState('');
  const [activeFile, setActiveFile] = useState(null);
  const [activeFilePath, setActiveFilePath] = useState(''); // Full path for sidebar highlight
  const [expandedPaths, setExpandedPaths] = useState(new Set()); // Tracks expanded folders
  const [treeFilter, setTreeFilter] = useState(''); // File filter query
  const [commits, setCommits] = useState([]);
  const [showCloneDropdown, setShowCloneDropdown] = useState(false);
  const [copiedClone, setCopiedClone] = useState(false);
  const [copiedFile, setCopiedFile] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'code');
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [repoSettings, setRepoSettings] = useState({
    name: '',
    description: '',
    isPrivate: false,
    defaultBranch: 'main'
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const isOwner = user && user.username === owner;

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  const remoteUrl = `${apiBase}/repos/${owner}/${repo}`;

  useEffect(() => {
    const nextTab = tabParam || 'code';
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [tabParam, activeTab]);

  useEffect(() => {
    if (repoData) {
      setRepoSettings({
        name: repoData.name || '',
        description: repoData.description || '',
        isPrivate: repoData.isPrivate || false,
        defaultBranch: repoData.defaultBranch || 'main'
      });
    }
  }, [repoData]);

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    if (newTab !== 'code') {
      setSearchParams({ tab: newTab }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams]);

  const handleUpdateRepo = async (e) => {
    e.preventDefault();
    try {
      setUpdatingSettings(true);
      const res = await apiClient.patch(`/repos/${owner}/${repo}`, repoSettings);
      jsonToast.success('Settings updated successfully');
      
      if (res.data.data.name !== repo) {
        navigate(`/repo/${owner}/${res.data.data.name}?tab=settings`);
      } else {
        setRepoData(res.data.data);
      }
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to update settings');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const isPinned = user?.pinnedRepos?.some(r => (r._id || r) === repoData?._id);

  const handlePinToggle = async () => {
    if (!user) return;
    let newPinned = [];
    if (isPinned) {
      newPinned = user.pinnedRepos.filter(r => (r._id || r) !== repoData._id).map(r => r._id || r);
    } else {
      if ((user.pinnedRepos?.length || 0) >= 6) {
        jsonToast.error('Maximum 6 repositories can be pinned');
        return;
      }
      newPinned = [...(user.pinnedRepos?.map(r => r._id || r) || []), repoData._id];
    }
    
    try {
      const res = await apiClient.put('/users/pinned', { pinnedRepos: newPinned });
      setUser({ ...user, pinnedRepos: res.data.data.pinnedRepos });
      jsonToast.success(isPinned ? 'Repository unpinned' : 'Repository pinned');
    } catch (err) {
      jsonToast.error('Failed to update pin status');
    }
  };

  const handleRequestDeleteOtp = async () => {
    if (!window.confirm(`Are you absolutely sure you want to delete ${owner}/${repo}? This action cannot be undone.`)) {
      return;
    }
    try {
      setDeleting(true);
      await apiClient.post(`/repos/${owner}/${repo}/request-delete-otp`);
      jsonToast.success('Security code sent to your email');
      setOtpSent(true);
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to request OTP');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRepo = async () => {
    if (!deleteOtp) {
      jsonToast.error('Please enter the OTP');
      return;
    }
    try {
      setDeleting(true);
      await apiClient.delete(`/repos/${owner}/${repo}`, { data: { otp: deleteOtp } });
      jsonToast.success('Repository deleted successfully');
      navigate('/dashboard');
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to delete repository');
      setDeleting(false);
    }
  };

  // Helper to toggle folder expand/collapse in sidebar
  const toggleFolder = useCallback((folderPath) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  // Helper to automatically expand all parent folders for a path
  const autoExpandParents = useCallback((path) => {
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      let current = '';
      for (let i = 0; i < parts.length; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        next.add(current);
      }
      return next;
    });
  }, []);

  // 1. Fetch Repository Details
  const fetchRepo = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/repos/${owner}/${repo}`);
      setRepoData(res.data.data);
      if (res.data.data.defaultBranch) {
        setCurrentBranch(res.data.data.defaultBranch);
      }
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to load repository');
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  // 2. Fetch File Tree
  const fetchTree = useCallback(async (branch, path = '') => {
    try {
      const res = await apiClient.get(`/repos/${owner}/${repo}/tree/${branch}`, {
        params: { path },
      });
      setTreeData(res.data.data);
      setCurrentPath(path);
      setActiveFile(null);
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to load file tree');
    }
  }, [owner, repo]);

  // 3. Fetch Root Tree for Sidebar (recursive)
  const fetchRootTree = useCallback(async (branch) => {
    try {
      const res = await apiClient.get(`/repos/${owner}/${repo}/tree/${branch}`, {
        params: { recursive: 'true' },
      });
      // Backend returns `tree` field when recursive=true (full nested structure)
      // Fall back to flat `entries` if recursive tree is not available
      const fullTree = res.data.data?.tree || res.data.data?.entries || [];
      setRootTree(fullTree);
    } catch (err) {
      // non-fatal
    }
  }, [owner, repo]);

  // 4. Fetch Commits
  const fetchCommits = useCallback(async (branch) => {
    try {
      const res = await apiClient.get(`/repos/${owner}/${repo}/commits/${branch}`);
      setCommits(res.data.data || []);
    } catch (err) {
      // non-fatal
    }
  }, [owner, repo]);

  useEffect(() => {
    fetchRepo();
  }, [owner, repo]);

  useEffect(() => {
    if (repoData) {
      fetchTree(currentBranch, '');
      fetchRootTree(currentBranch);
      fetchCommits(currentBranch);
    }
  }, [repoData, currentBranch]);

  // Keep sidebar folders auto-expanded based on current path
  useEffect(() => {
    if (currentPath) {
      autoExpandParents(currentPath);
    }
  }, [currentPath, autoExpandParents]);

  // Keep sidebar folders auto-expanded based on active file path
  useEffect(() => {
    if (activeFilePath) {
      const parentDir = activeFilePath.includes('/')
        ? activeFilePath.substring(0, activeFilePath.lastIndexOf('/'))
        : '';
      if (parentDir) {
        autoExpandParents(parentDir);
      }
    }
  }, [activeFilePath, autoExpandParents]);

  // Click on a file in tree table
  const handleEntryClick = useCallback(async (entry) => {
    if (entry.object_type === 'tree') {
      const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      fetchTree(currentBranch, nextPath);
      setCurrentPath(nextPath);
      setActiveFilePath('');
      autoExpandParents(nextPath);
    } else {
      // Fetch blob
      const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      try {
        setLoadingFile(true);
        const res = await apiClient.get(`/repos/${owner}/${repo}/blob/${entry.object_hash}`);
        setActiveFile({
          name: entry.name,
          content: res.data.data.content,
          hash: entry.object_hash,
          size: res.data.data.size,
        });
        setActiveFilePath(filePath);
        if (currentPath) {
          autoExpandParents(currentPath);
        }
      } catch (err) {
        jsonToast.error('Failed to load file content');
      } finally {
        setLoadingFile(false);
      }
    }
  }, [owner, repo, currentPath, currentBranch, fetchTree, autoExpandParents]);

  // Click on a folder from the sidebar (navigates main view like GitHub)
  const handleSidebarFolderClick = useCallback((folderPath) => {
    fetchTree(currentBranch, folderPath);
    setCurrentPath(folderPath);
    setActiveFile(null);
    setActiveFilePath('');
  }, [fetchTree, currentBranch]);

  // Click on a file from the sidebar
  const handleSidebarFileClick = useCallback(async (entry, fullPath) => {
    try {
      setLoadingFile(true);
      const res = await apiClient.get(`/repos/${owner}/${repo}/blob/${entry.object_hash}`);
      setActiveFile({
        name: entry.name,
        content: res.data.data.content,
        hash: entry.object_hash,
        size: res.data.data.size,
      });
      setActiveFilePath(fullPath);
      const parentDir = fullPath.includes('/')
        ? fullPath.substring(0, fullPath.lastIndexOf('/'))
        : '';
      setCurrentPath(parentDir);
      if (parentDir) {
        autoExpandParents(parentDir);
      }
    } catch (err) {
      jsonToast.error('Failed to load file content');
    } finally {
      setLoadingFile(false);
    }
  }, [owner, repo, autoExpandParents]);

  // Navigate breadcrumb path
  const handleBreadcrumbClick = useCallback((index) => {
    if (index === -1) {
      fetchTree(currentBranch, '');
      setCurrentPath('');
      setActiveFile(null);
      setActiveFilePath('');
      return;
    }
    const segments = currentPath.split('/');
    const nextPath = segments.slice(0, index + 1).join('/');
    fetchTree(currentBranch, nextPath);
    setCurrentPath(nextPath);
    setActiveFile(null);
    setActiveFilePath('');
    autoExpandParents(nextPath);
  }, [currentPath, currentBranch, fetchTree, autoExpandParents]);

  // Close active file and return to current directory view
  const handleCloseFile = useCallback(() => {
    setActiveFile(null);
    setActiveFilePath('');
    fetchTree(currentBranch, currentPath);
  }, [currentBranch, currentPath, fetchTree]);

  const copyToClipboard = useCallback((text, isFile = false) => {
    navigator.clipboard.writeText(text);
    if (isFile) {
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    } else {
      setCopiedClone(true);
      setTimeout(() => setCopiedClone(false), 2000);
    }
    jsonToast.success('Copied to clipboard!');
  }, []);

  const pathSegments = currentPath ? currentPath.split('/') : [];

  if (loading || !treeData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Loading repository...</p>
      </div>
    );
  }

  if (!repoData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-gray-800">Repository not found</h2>
        <p className="text-sm text-gray-500 mt-2">The repository {owner}/{repo} does not exist or is private.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const isEmpty = treeData.isEmpty;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1400px] mx-auto px-6 md:px-10 py-8 font-sans"
    >
      {/* ── Top Header ────────────────────────────────────────── */}
      <RepoHeader
        repoData={repoData}
        isOwner={isOwner}
        isEmpty={isEmpty}
        currentBranch={currentBranch}
        commits={commits}
        handleTabChange={handleTabChange}
        showCloneDropdown={showCloneDropdown}
        setShowCloneDropdown={setShowCloneDropdown}
        remoteUrl={remoteUrl}
        copyToClipboard={copyToClipboard}
        copiedClone={copiedClone}
        isPinned={isPinned}
        handlePinToggle={handlePinToggle}
      />

      {/* Horizontal Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-200 mb-6 px-1">
        <button
          onClick={() => handleTabChange('code')}
          className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'code' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Code size={16} /> Code
        </button>
        <button
          onClick={() => handleTabChange('commits')}
          className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'commits' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <History size={16} /> Commits
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs ml-1">{commits.length}</span>
        </button>
        {isOwner && (
          <button
            onClick={() => handleTabChange('settings')}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings size={16} /> Settings
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'code' && (
          <motion.div
            key="tab-code"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
          
          <CodeTab
            isEmpty={isEmpty}
            repoData={repoData}
            remoteUrl={remoteUrl}
            copyToClipboard={copyToClipboard}
            treeData={treeData}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            treeFilter={treeFilter}
            setTreeFilter={setTreeFilter}
            rootTree={rootTree}
            owner={owner}
            repo={repo}
            currentBranch={currentBranch}
            expandedPaths={expandedPaths}
            toggleFolder={toggleFolder}
            handleSidebarFileClick={handleSidebarFileClick}
            handleSidebarFolderClick={handleSidebarFolderClick}
            activeFilePath={activeFilePath}
            currentPath={currentPath}
            pathSegments={pathSegments}
            handleBreadcrumbClick={handleBreadcrumbClick}
            activeFile={activeFile}
            copiedFile={copiedFile}
            handleCloseFile={handleCloseFile}
            handleEntryClick={handleEntryClick}
          />
        </motion.div>
      )}

        {activeTab === 'pull-requests' && (
          <motion.div
            key="tab-pr"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-6 bg-white border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px]"
          >
          <GitPullRequest size={32} className="text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-800">No pull requests yet</h3>
          <p className="text-sm text-gray-500 mt-1">Welcome to pull requests!</p>
        </motion.div>
      )}

        {activeTab === 'issues' && (
          <motion.div
            key="tab-issues"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-6 bg-white border border-gray-200 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px]"
          >
            <CircleDot size={32} className="text-gray-300 mb-3" />
            <h3 className="text-lg font-bold text-gray-800">No issues found</h3>
            <p className="text-sm text-gray-500 mt-1">Welcome to issues!</p>
          </motion.div>
        )}

        {activeTab === 'commits' && (
          <CommitsTab commits={commits} copyToClipboard={copyToClipboard} />
        )}

        {activeTab === 'settings' && isOwner && (
          <SettingsTab
            repoSettings={repoSettings}
            setRepoSettings={setRepoSettings}
            updatingSettings={updatingSettings}
            handleUpdateRepo={handleUpdateRepo}
            repoData={repoData}
            otpSent={otpSent}
            handleRequestDeleteOtp={handleRequestDeleteOtp}
            deleting={deleting}
            deleteOtp={deleteOtp}
            setDeleteOtp={setDeleteOtp}
            handleDeleteRepo={handleDeleteRepo}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
