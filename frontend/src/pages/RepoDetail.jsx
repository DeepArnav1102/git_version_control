import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleDot, GitPullRequest } from 'lucide-react';
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
import RepoFloatingNav from '../components/profile/RepoFloatingNav';

// ─── File icon helper based on extension ────────────────────────────────
function getFileIcon(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'md':
    case 'markdown':
    case 'txt':
    case 'rst':
      return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'rs':
    case 'py':
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
    case 'java':
    case 'go':
    case 'html':
    case 'css':
    case 'scss':
    case 'php':
    case 'sh':
      return <FileCode size={14} className="text-blue-500/80 flex-shrink-0" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return <FileCode size={14} className="text-amber-500/80 flex-shrink-0" />;
    default:
      return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
  }
}

// ─── GitHub-style recursive sidebar tree node ─────────────────────────
function SidebarNode({
  entry,
  owner,
  repo,
  branch,
  basePath,
  depth = 0,
  expandedPaths,
  toggleFolder,
  onFileClick,
  onFolderClick,
  activeFilePath,
  currentPath,
  filterQuery = '',
}) {
  const fullPath = entry.path || (basePath ? `${basePath}/${entry.name}` : entry.name);
  const isDirectory = entry.object_type === 'tree';
  const isExpanded = isDirectory && expandedPaths.has(fullPath);
  const isFileActive = !isDirectory && activeFilePath === fullPath;
  const isDirActive = isDirectory && currentPath === fullPath && !activeFilePath;
  const isActive = isFileActive || isDirActive;

  // Filter matching
  const matchesFilter = (item) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.children && item.children.length > 0) {
      return item.children.some(matchesFilter);
    }
    return false;
  };

  if (filterQuery && !matchesFilter(entry)) {
    return null;
  }

  const sortedChildren = isDirectory && entry.children
    ? [...entry.children].sort((a, b) => {
        if (a.object_type === b.object_type) return a.name.localeCompare(b.name);
        return a.object_type === 'tree' ? -1 : 1;
      })
    : [];

  if (isDirectory) {
    return (
      <div>
        <div
          onClick={() => {
            toggleFolder(fullPath);
            onFolderClick(fullPath);
          }}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center gap-1.5 py-1 px-2 text-[12px] rounded-md transition-colors cursor-pointer select-none ${
            isActive
              ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
              : 'text-gray-700 hover:bg-gray-100/80'
          }`}
          title={fullPath}
        >
          {/* Chevron toggle button */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(fullPath);
            }}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200/60 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0"
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>

          {/* Folder Icon */}
          {isExpanded ? (
            <FolderOpen size={14} className="text-[#54aeff] flex-shrink-0" />
          ) : (
            <Folder size={14} className="text-[#54aeff] flex-shrink-0" />
          )}

          {/* Folder Name */}
          <span className="truncate flex-1 font-medium">{entry.name}</span>
        </div>

        {/* Nested Children */}
        {isExpanded && sortedChildren.length > 0 && (
          <div className="relative">
            {sortedChildren.map((child) => (
              <SidebarNode
                key={child.path || `${fullPath}/${child.name}`}
                entry={child}
                owner={owner}
                repo={repo}
                branch={branch}
                basePath={fullPath}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                toggleFolder={toggleFolder}
                onFileClick={onFileClick}
                onFolderClick={onFolderClick}
                activeFilePath={activeFilePath}
                currentPath={currentPath}
                filterQuery={filterQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File item
  return (
    <div
      onClick={() => onFileClick(entry, fullPath)}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      className={`group flex items-center gap-1.5 py-1 px-2 text-[12px] rounded-md transition-colors cursor-pointer select-none ${
        isActive
          ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
          : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
      }`}
      title={fullPath}
    >
      {/* Spacer to align with folder chevron */}
      <span className="w-4 h-4 flex-shrink-0" />

      {/* File Icon */}
      {getFileIcon(entry.name)}

      {/* File Name */}
      <span className="truncate flex-1 font-normal">{entry.name}</span>
    </div>
  );
}

export default function RepoDetail() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

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
  const [showCommitsModal, setShowCommitsModal] = useState(false);
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

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab !== 'code') {
      setSearchParams({ tab: newTab }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

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
  const fetchRepo = async () => {
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
  };

  // 2. Fetch File Tree
  const fetchTree = async (branch, path = '') => {
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
  };

  // 3. Fetch Root Tree for Sidebar (recursive)
  const fetchRootTree = async (branch) => {
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
  };

  // 4. Fetch Commits
  const fetchCommits = async (branch) => {
    try {
      const res = await apiClient.get(`/repos/${owner}/${repo}/commits/${branch}`);
      setCommits(res.data.data || []);
    } catch (err) {
      // non-fatal
    }
  };

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
  const handleEntryClick = async (entry) => {
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
  };

  // Click on a folder from the sidebar (navigates main view like GitHub)
  const handleSidebarFolderClick = (folderPath) => {
    fetchTree(currentBranch, folderPath);
    setCurrentPath(folderPath);
    setActiveFile(null);
    setActiveFilePath('');
  };

  // Click on a file from the sidebar
  const handleSidebarFileClick = async (entry, fullPath) => {
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
  };

  // Navigate breadcrumb path
  const handleBreadcrumbClick = (index) => {
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
  };

  // Close active file and return to current directory view
  const handleCloseFile = () => {
    setActiveFile(null);
    setActiveFilePath('');
    fetchTree(currentBranch, currentPath);
  };

  const copyToClipboard = (text, isFile = false) => {
    navigator.clipboard.writeText(text);
    if (isFile) {
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    } else {
      setCopiedClone(true);
      setTimeout(() => setCopiedClone(false), 2000);
    }
    jsonToast.success('Copied to clipboard!');
  };

  const pathSegments = currentPath ? currentPath.split('/') : [];

  if (loading) {
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

  const isEmpty = treeData?.isEmpty || (!treeData?.entries?.length && !treeData?.commit);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full px-6 md:pl-10 md:pr-24 py-8 font-sans"
    >
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
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
              <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
                <Pin size={14} className="text-gray-500" />
                <span>Pin</span>
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
              <button className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 transition-colors cursor-pointer">
                <Star size={14} className="text-gray-500" />
                <span>Star</span>
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
                onClick={() => setShowCommitsModal(true)}
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
                  <span>Connect / Push</span>
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

      <AnimatePresence mode="wait">
        {activeTab === 'code' && (
          <motion.div
            key="tab-code"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
          {/* ── EMPTY REPO VIEW ────────────────────────────────────── */}
      {isEmpty ? (
        <div className="mt-6 space-y-6">
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Codespaces */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:border-gray-300 transition-colors">
              <Monitor size={24} strokeWidth={1.5} className="text-gray-600 mb-4" />
              <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Start coding with Codespaces</h3>
              <p className="text-xs text-gray-500 mb-4 h-8">
                Add a README file and start coding in a secure, configurable, and dedicated development environment.
              </p>
              <button className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 transition-colors cursor-pointer">
                Create a codespace
              </button>
            </div>

            {/* Card 2: Collaborators */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:border-gray-300 transition-colors">
              <UserPlus size={24} strokeWidth={1.5} className="text-gray-600 mb-4" />
              <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Add collaborators to this repository</h3>
              <p className="text-xs text-gray-500 mb-4 h-8">
                Search for people using their GitHub username or email address.
              </p>
              <button className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 transition-colors cursor-pointer">
                Invite collaborators
              </button>
            </div>
          </div>

          {/* Command Line Instructions */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 text-[15px] mb-2">
                ...or create a new repository on the command line
              </h3>
              <div className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <pre className="p-4 text-gray-800 font-mono text-[13px] leading-relaxed overflow-x-auto">
                  <div>echo "# {repoData.name}" &gt;&gt; README.md</div>
                  <div>rusty init</div>
                  <div>rusty add README.md</div>
                  <div>rusty commit -m "first commit"</div>
                  <div>rusty branch -M main</div>
                  <div>rusty remote add origin {remoteUrl}</div>
                  <div>rusty push -u origin main</div>
                </pre>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `echo "# ${repoData.name}" >> README.md\nrusty init\nrusty add README.md\nrusty commit -m "first commit"\nrusty branch -M main\nrusty remote add origin ${remoteUrl}\nrusty push -u origin main`
                    )
                  }
                  className="absolute top-2 right-2 p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 text-[15px] mb-2">
                ...or push an existing repository from the command line
              </h3>
              <div className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <pre className="p-4 text-gray-800 font-mono text-[13px] leading-relaxed overflow-x-auto">
                  <div>rusty remote add origin {remoteUrl}</div>
                  <div>rusty branch -M main</div>
                  <div>rusty push -u origin main</div>
                </pre>
                <button
                  onClick={() =>
                    copyToClipboard(`rusty remote add origin ${remoteUrl}\nrusty branch -M main\nrusty push -u origin main`)
                  }
                  className="absolute top-2 right-2 p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── POPULATED REPOSITORY VIEW ─────────────────────────── */
        <div className="mt-6 space-y-4">
          {/* Latest Commit Bar */}
          {treeData?.commit && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={treeData.commit.authorProfilePicture || defaultPfp}
                  alt={treeData.commit.author}
                  className="w-5 h-5 rounded-full object-cover border border-gray-200"
                  onError={(e) => { e.target.src = defaultPfp; }}
                />
                <span className="font-semibold text-gray-900">
                  {treeData.commit.author}
                </span>
                <span className="text-gray-700 truncate font-medium">
                  {treeData.commit.message}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-gray-500 font-mono text-[11px]">
                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                  {treeData.commit.hash?.substring(0, 7)}
                </span>
              </div>
            </div>
          )}

          {/* ── Sidebar + Main Panel ──────────────────────────── */}
          <div className="flex gap-4 items-start">
            {/* Sidebar Tree */}
            {sidebarOpen && (
              <div className="w-64 flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50/80 border-b border-gray-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 truncate">
                    <Folder size={14} className="text-[#54aeff] flex-shrink-0" />
                    <span className="truncate">Files</span>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 transition-colors cursor-pointer"
                    title="Collapse file tree"
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>

                {/* Filter / Search Bar */}
                <div className="p-2 border-b border-gray-100 bg-white">
                  <div className="relative flex items-center">
                    <Search size={12} className="absolute left-2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={treeFilter}
                      onChange={(e) => setTreeFilter(e.target.value)}
                      placeholder="Filter files..."
                      className="w-full pl-6 pr-6 py-1 bg-gray-50 border border-gray-200 rounded-md text-[11px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                    {treeFilter && (
                      <button
                        onClick={() => setTreeFilter('')}
                        className="absolute right-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Tree View */}
                <div className="p-1.5 max-h-[600px] overflow-y-auto space-y-0.5">
                  {rootTree && rootTree.length > 0 ? (
                    [...rootTree]
                      .sort((a, b) => {
                        if (a.object_type === b.object_type) return a.name.localeCompare(b.name);
                        return a.object_type === 'tree' ? -1 : 1;
                      })
                      .map((entry) => (
                        <SidebarNode
                          key={entry.path || entry.name}
                          entry={entry}
                          owner={owner}
                          repo={repo}
                          branch={currentBranch}
                          basePath=""
                          depth={0}
                          expandedPaths={expandedPaths}
                          toggleFolder={toggleFolder}
                          onFileClick={handleSidebarFileClick}
                          onFolderClick={handleSidebarFolderClick}
                          activeFilePath={activeFilePath}
                          currentPath={currentPath}
                          filterQuery={treeFilter}
                        />
                      ))
                  ) : (
                    <div className="py-6 text-center text-xs text-gray-400">
                      No files in this branch
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Collapsed sidebar toggle */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer shadow-xs"
                title="Expand file tree"
              >
                <PanelLeft size={14} />
              </button>
            )}

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Breadcrumbs Navigation */}
              <div className="flex items-center gap-1.5 text-xs text-gray-600 px-1">
                <button
                  onClick={() => handleBreadcrumbClick(-1)}
                  className="font-bold text-gray-900 hover:underline cursor-pointer"
                >
                  {repoData.name}
                </button>
                {pathSegments.map((segment, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className={`hover:underline cursor-pointer ${
                        idx === pathSegments.length - 1 && !activeFile
                          ? 'font-bold text-gray-900'
                          : 'text-gray-600'
                      }`}
                    >
                      {segment}
                    </button>
                  </React.Fragment>
                ))}
                {activeFile && (
                  <>
                    <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="font-bold text-gray-900 flex items-center gap-1">
                      {getFileIcon(activeFile.name)}
                      {activeFile.name}
                    </span>
                  </>
                )}
              </div>

              {/* File Viewer (Active File) */}
              {activeFile ? (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs">
                    <div className="flex items-center gap-2">
                      {getFileIcon(activeFile.name)}
                      <span className="font-semibold text-gray-800">{activeFile.name}</span>
                      <span className="text-gray-400 font-normal">({activeFile.size} bytes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(activeFile.content, true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        {copiedFile ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        {copiedFile ? 'Copied' : 'Raw'}
                      </button>
                      <button
                        onClick={handleCloseFile}
                        className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {/* Code viewer with line numbers */}
                  <div className="p-4 overflow-x-auto font-mono text-[12px] leading-relaxed bg-[#f8f9fa] text-gray-900">
                    <pre className="table w-full">
                      {activeFile.content.split('\n').map((line, i) => (
                        <div key={i} className="table-row hover:bg-gray-100/70">
                          <span className="table-cell pr-4 text-right select-none text-gray-400 text-[11px] w-10">
                            {i + 1}
                          </span>
                          <span className="table-cell whitespace-pre">{line || ' '}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              ) : (
                /* File Tree Table */
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-4">Name</th>
                        <th className="py-2.5 px-4 text-right">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Up one directory if inside a folder */}
                      {currentPath && (
                        <tr
                          onClick={() => handleBreadcrumbClick(pathSegments.length - 2)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td colSpan={2} className="py-2.5 px-4 font-semibold text-gray-600 flex items-center gap-2">
                            <Folder size={14} className="text-blue-500" />
                            ..
                          </td>
                        </tr>
                      )}

                      {treeData?.entries?.map((entry) => (
                        <tr
                          key={entry.name}
                          onClick={() => handleEntryClick(entry)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors group"
                        >
                          <td className="py-2.5 px-4 font-medium text-gray-800 flex items-center gap-2.5">
                            {entry.object_type === 'tree' ? (
                              <Folder size={15} className="text-[#54aeff] flex-shrink-0" />
                            ) : (
                              getFileIcon(entry.name)
                            )}
                            <span className="group-hover:text-blue-600 group-hover:underline transition-colors">
                              {entry.name}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-400 capitalize">
                            {entry.object_type === 'tree' ? 'directory' : 'file'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* README Preview if present */}
              {!activeFile &&
                treeData?.entries?.find((e) => e.name.toLowerCase() === 'readme.md') && (
                  <ReadmeBox
                    owner={owner}
                    repo={repo}
                    entry={treeData.entries.find((e) => e.name.toLowerCase() === 'readme.md')}
                  />
                )}
            </div>
          </div>
        </div>
      )}
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

        {activeTab === 'settings' && isOwner && (
          <motion.div
            key="tab-settings"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="mt-6 w-full space-y-6"
          >
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">General Settings</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleUpdateRepo} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Repository Name</label>
                  <input
                    type="text"
                    value={repoSettings.name}
                    onChange={(e) => setRepoSettings({ ...repoSettings, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={repoSettings.description}
                    onChange={(e) => setRepoSettings({ ...repoSettings, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={!repoSettings.isPrivate}
                      onChange={() => setRepoSettings({ ...repoSettings, isPrivate: false })}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700 font-medium">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      checked={repoSettings.isPrivate}
                      onChange={() => setRepoSettings({ ...repoSettings, isPrivate: true })}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700 font-medium">Private</span>
                  </label>
                </div>
                {repoData?.branches?.length > 0 && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Default Branch</label>
                    <select
                      value={repoSettings.defaultBranch}
                      onChange={(e) => setRepoSettings({ ...repoSettings, defaultBranch: e.target.value })}
                      className="w-full md:w-64 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      {repoData.branches.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={updatingSettings}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingSettings ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 bg-red-50">
              <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Delete this repository</h4>
                  <p className="text-[11px] text-gray-600 mt-1 max-w-xl">
                    Once you delete a repository, there is no going back. Please be certain.
                    This will permanently delete the repo, along with its commits, blob tree, and all git objects.
                  </p>
                </div>
                {!otpSent ? (
                  <button
                    onClick={handleRequestDeleteOtp}
                    disabled={deleting}
                    className="px-3 py-1.5 bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                  >
                    {deleting ? 'Requesting...' : 'Request Delete'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={deleteOtp}
                      onChange={(e) => setDeleteOtp(e.target.value)}
                      className="w-32 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-center tracking-widest"
                      maxLength={6}
                    />
                    <button
                      onClick={handleDeleteRepo}
                      disabled={deleting || deleteOtp.length !== 6}
                      className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                    >
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Floating Navigation Sidebar */}
      <RepoFloatingNav activeTab={activeTab} setActiveTab={handleTabChange} isOwner={isOwner} />

      {/* ── Commits History Modal ─────────────────────────────── */}
      {showCommitsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <History size={16} /> Commit History ({commits.length})
              </h3>
              <button
                onClick={() => setShowCommitsModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 p-2">
              {commits.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No commit history found.</p>
              ) : (
                commits.map((c) => (
                  <div key={c.hash} className="px-4 py-3 hover:bg-gray-50 flex items-start justify-between gap-3 text-sm border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <img
                          src={c.authorProfilePicture || defaultPfp}
                          alt={c.author}
                          className="w-5 h-5 rounded-full object-cover border border-gray-200"
                          onError={(e) => { e.target.src = defaultPfp; }}
                        />
                        <p className="text-gray-500 text-xs">
                          <span className="font-semibold text-gray-700">{c.author}</span> committed {c.date ? new Date(c.date).toLocaleDateString() : 'recently'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      <span className="border border-green-300 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-semibold hidden sm:inline-block">
                        Verified
                      </span>
                      <span className="font-mono bg-gray-100 border border-gray-200 px-2 py-1 rounded-md text-gray-600 text-xs cursor-pointer hover:bg-gray-200" title="Copy full SHA" onClick={() => copyToClipboard(c.hash)}>
                        {c.hash?.substring(0, 7)}
                      </span>
                      <button className="text-gray-400 hover:text-blue-600 transition-colors border border-gray-200 rounded-md p-1 bg-white cursor-pointer shadow-sm hover:shadow" title="Browse files at this point in history">
                        <Code size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Subcomponent to load and render README.md preview
function ReadmeBox({ owner, repo, entry }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReadme = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/repos/${owner}/${repo}/blob/${entry.object_hash}`);
        setContent(res.data.data.content);
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadReadme();
  }, [owner, repo, entry]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700">
        <BookMarked size={14} />
        README.md
      </div>
      <div className="p-6 text-sm text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
        {loading ? (
          <span className="text-xs text-gray-400">Loading README...</span>
        ) : (
          content || <span className="text-xs text-gray-400">Empty README</span>
        )}
      </div>
    </div>
  );
}
