import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Folder, PanelLeftClose, Search, PanelLeft,
  ChevronRight, Check, Copy, Star, Eye, GitFork, X, MoreVertical, Trash2, History, Download
} from 'lucide-react';
import { getFileIcon } from '../../utils/fileIcons';
import EmptyRepoView from './EmptyRepoView';
import SidebarNode from './SidebarNode';
import ReadmeBox from './ReadmeBox';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../lib/axios';
import { Code2 } from 'lucide-react';
import { jsonToast } from '../../lib/jsonToast';

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';


import { getLanguageColorHex, calculateLanguages } from '../../utils/languageUtils';

export default function CodeTab({
  isEmpty,
  repoData,
  remoteUrl,
  copyToClipboard,
  treeData,
  sidebarOpen,
  setSidebarOpen,
  treeFilter,
  setTreeFilter,
  rootTree,
  owner,
  repo,
  currentBranch,
  expandedPaths,
  toggleFolder,
  handleSidebarFileClick,
  handleSidebarFolderClick,
  activeFilePath,
  currentPath,
  pathSegments,
  handleBreadcrumbClick,
  activeFile,
  copiedFile,
  handleCloseFile,
  handleEntryClick,
  loadingFile,
  loadingTree,
  isOwner
}) {
  const navigate = useNavigate();
  const [loadingCodespace, setLoadingCodespace] = React.useState(false);
  const [fileMenuOpen, setFileMenuOpen] = React.useState(false);
  const [commitCount, setCommitCount] = React.useState(0);

  React.useEffect(() => {
    if (!owner || !repo) return;
    const fetchCommits = async () => {
      try {
        const res = await apiClient.get(`/repos/${owner}/${repo}/commits/${currentBranch || 'main'}`);
        if (res.data?.success) {
          setCommitCount(res.data.data.length);
        }
      } catch (err) {
        console.error("Failed to fetch commits", err);
      }
    };
    fetchCommits();
  }, [owner, repo, currentBranch]);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0) return years === 1 ? 'last year' : `${years} years ago`;
    if (months > 0) return months === 1 ? 'last month' : `${months} months ago`;
    if (days > 0) return days === 1 ? 'yesterday' : `${days} days ago`;
    if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    return 'just now';
  };

  const handleOpenFileInCodespace = async () => {
    try {
      setLoadingCodespace(true);
      await apiClient.post('/ide/load-codespace', {
        type: 'file',
        hash: activeFile.hash,
        filename: activeFile.name
      });
      jsonToast.success('Codespace ready!');
      navigate('/ide');
    } catch (err) {
      jsonToast.error(err?.response?.data?.error || 'Failed to open Codespace');
      setLoadingCodespace(false);
    }
  };

  const isRepo100PercentPython = React.useMemo(() => {
    const langs = calculateLanguages(rootTree);
    return langs.length === 1 && langs[0].name === 'Python';
  }, [rootTree]);

  const isPythonFile = activeFile?.name?.endsWith('.py');

  if (isEmpty) {
    return <EmptyRepoView repoData={repoData} remoteUrl={remoteUrl} copyToClipboard={copyToClipboard} />;
  }

  return (
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
      <div className="flex items-start">
        {/* Sidebar Tree */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0, marginRight: 0 }}
              animate={{ width: 256, opacity: 1, marginRight: 16 }}
              exit={{ width: 0, opacity: 0, marginRight: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-shrink-0 overflow-hidden"
            >
              <div className="w-64 bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
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
                      data-tree-filter
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed sidebar toggle */}
        {!sidebarOpen && (
          <div className="mr-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer shadow-xs"
              title="Expand file tree"
            >
              <PanelLeft size={14} />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-4 relative">
          {(loadingFile || loadingTree) && (
            <div className="absolute -top-3 left-0 right-0 h-[2px] bg-blue-100 overflow-hidden rounded-full z-10">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          )}
          {/* Breadcrumbs Navigation */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
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
                    className={`hover:underline cursor-pointer ${idx === pathSegments.length - 1 && !activeFile
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
                  {isPythonFile && (
                    <button
                      onClick={handleOpenFileInCodespace}
                      disabled={loadingCodespace}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 border border-blue-600 rounded hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Code2 size={12} />
                      {loadingCodespace ? 'Opening...' : 'Open in Codespace'}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(activeFile.content, true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {copiedFile ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedFile ? 'Copied' : 'Raw'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setFileMenuOpen(!fileMenuOpen)}
                      className="px-1.5 py-1 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer flex items-center"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {fileMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-0" onClick={() => setFileMenuOpen(false)}></div>
                        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                          <button
                            onClick={() => {
                              setFileMenuOpen(false);
                              try {
                                let blob;
                                const ext = activeFile.name.split('.').pop().toLowerCase();
                                const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext);
                                if (isImage) {
                                  const isLikelyBase64 = /^[a-zA-Z0-9+/]*={0,2}$/.test(activeFile.content.trim().substring(0, 100));
                                  if (ext === 'svg') {
                                    blob = new Blob([activeFile.content], { type: 'image/svg+xml' });
                                  } else if (isLikelyBase64) {
                                    const byteCharacters = atob(activeFile.content);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    blob = new Blob([byteArray], { type: `image/${ext}` });
                                  } else {
                                    try {
                                      const base64 = btoa(unescape(encodeURIComponent(activeFile.content)));
                                      const byteCharacters = atob(base64);
                                      const byteNumbers = new Array(byteCharacters.length);
                                      for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                      }
                                      const byteArray = new Uint8Array(byteNumbers);
                                      blob = new Blob([byteArray], { type: `image/${ext}` });
                                    } catch (e) {
                                      blob = new Blob([activeFile.content]);
                                    }
                                  }
                                } else {
                                  blob = new Blob([activeFile.content]);
                                }
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', activeFile.name);
                                document.body.appendChild(link);
                                link.click();
                                link.parentNode.removeChild(link);
                              } catch (err) {
                                jsonToast.error('Failed to download file');
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer border-b border-gray-100"
                          >
                            <Download size={12} />
                            Download
                          </button>
                          {isOwner && (
                            <button
                              onClick={async () => {
                                setFileMenuOpen(false);
                                try {
                                  await apiClient.delete(`/repos/${owner}/${repo}/contents/${activeFilePath}?branch=${currentBranch}`);
                                  jsonToast.success(`Deleted ${activeFile.name} successfully`);
                                  handleCloseFile();
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 500);
                                } catch (err) {
                                  jsonToast.error(err?.response?.data?.message || 'Failed to delete file');
                                }
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={12} />
                              Delete file
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleCloseFile}
                    className="px-1.5 py-1 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer flex items-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Code viewer with syntax highlighting or Image Viewer */}
              <div className="h-[65vh] min-h-[400px] w-full border-t border-gray-200 bg-[#fffffe] flex flex-col">
                {(() => {
                  const ext = activeFile.name.split('.').pop().toLowerCase();
                  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext);

                  if (isImage) {
                    // Try to guess if content is already base64, otherwise try to convert or use raw
                    const isLikelyBase64 = /^[a-zA-Z0-9+/]*={0,2}$/.test(activeFile.content.trim().substring(0, 100));
                    let imgSrc = '';
                    if (ext === 'svg') {
                      imgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(activeFile.content)}`;
                    } else if (isLikelyBase64) {
                      imgSrc = `data:image/${ext};base64,${activeFile.content}`;
                    } else {
                      // if it was saved as raw binary string, btoa might fail on invalid characters.
                      try {
                        imgSrc = `data:image/${ext};base64,${btoa(unescape(encodeURIComponent(activeFile.content)))}`;
                      } catch (e) {
                        // fallback to raw in case it magically works or just let it break with a broken image icon
                        imgSrc = `data:image/${ext};base64,${btoa(activeFile.content.replace(/[^\x00-\xFF]/g, ''))}`;
                      }
                    }

                    return (
                      <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://raw.githubusercontent.com/tannerlinsley/react-table/master/media/checkered.png')] bg-repeat">
                        <img
                          src={imgSrc}
                          alt={activeFile.name}
                          className="max-w-full max-h-[60vh] object-contain shadow-sm border border-gray-300 rounded bg-white"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.parentElement.innerHTML = '<div class="text-sm text-gray-500 bg-white p-4 rounded border border-red-200 text-center">Unable to load image.<br/><span class="text-xs text-gray-400 mt-2 block">The file might be corrupted or not pushed with correct binary encoding.</span></div>';
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <Editor
                      height="100%"
                      path={activeFile.name}
                      value={activeFile.content}
                      theme="vs-light"
                      options={{
                        readOnly: true,
                        domReadOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        lineNumbersMinChars: 4,
                        padding: { top: 16, bottom: 16 },
                        scrollbar: { alwaysConsumeMouseWheel: false },
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          ) : (
            /* File Tree Table */
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Top-level commit header */}
              {treeData?.commit && (
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between text-xs text-gray-700">
                  <div className="flex items-center gap-3">
                    <img
                      src={treeData.commit.authorProfilePicture || defaultPfp}
                      alt={treeData.commit.author}
                      className="w-6 h-6 rounded-full border border-gray-300"
                    />
                    <span className="font-semibold text-gray-900">{treeData.commit.author}</span>
                    <span className="text-gray-600 truncate max-w-sm lg:max-w-md hover:text-blue-600 cursor-pointer transition-colors" title={treeData.commit.message}>{treeData.commit.message}</span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-500">
                    <span className="font-mono hover:text-blue-600 cursor-pointer transition-colors" title={treeData.commit.hash}>{treeData.commit.hash?.substring(0, 7)}</span>
                    <span>{timeAgo(treeData.commit.date)}</span>
                    <Link to={`/${owner}/${repo}/commits/${currentBranch || 'main'}`} className="font-semibold flex items-center gap-1 hover:text-blue-600 cursor-pointer transition-colors ml-2"><History size={14} /> {commitCount} <span className="hidden sm:inline">Commits</span></Link>
                  </div>
                </div>
              )}
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-gray-100">
                  {loadingTree ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-2.5 px-4 flex items-center gap-2.5 w-[35%] sm:w-[40%]">
                          <div className="w-4 h-4 bg-gray-200 rounded"></div>
                          <div className="h-3.5 bg-gray-200 rounded w-1/2"></div>
                        </td>
                        <td className="py-2.5 px-4 hidden sm:table-cell w-[45%]">
                          <div className="h-3.5 bg-gray-200 rounded w-3/4"></div>
                        </td>
                        <td className="py-2.5 px-4 text-right w-[15%]">
                          <div className="h-3.5 bg-gray-200 rounded w-16 ml-auto"></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {/* Up one directory if inside a folder */}
                      {currentPath && (
                        <tr
                          onClick={() => handleBreadcrumbClick(pathSegments.length - 2)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td colSpan={3} className="py-2.5 px-4 font-semibold text-gray-600 flex items-center gap-2">
                            <Folder size={14} className="text-[#54aeff]" />
                            <span className="group-hover:text-blue-600 group-hover:underline transition-colors mt-0.5">..</span>
                          </td>
                        </tr>
                      )}

                      {treeData?.entries?.map((entry) => (
                        <tr
                          key={entry.name}
                          onClick={() => handleEntryClick(entry)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors group"
                        >
                          <td className="py-2.5 px-4 font-medium text-gray-800 flex items-center gap-2.5 w-[35%] sm:w-[40%] truncate">
                            {entry.object_type === 'tree' ? (
                              <Folder size={15} className="text-[#54aeff] flex-shrink-0" />
                            ) : (
                              getFileIcon(entry.name)
                            )}
                            <span className="group-hover:text-blue-600 group-hover:underline transition-colors truncate">
                              {entry.name}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-gray-500 truncate w-[45%] hidden sm:table-cell">
                            <span className="hover:text-blue-600 transition-colors cursor-pointer" title={entry.commit?.message || treeData.commit?.message || ''}>{entry.commit?.message || treeData.commit?.message || ''}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-400 whitespace-nowrap w-[15%]">
                            {timeAgo(entry.commit?.date || treeData.commit?.date)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
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

        {/* Right Sidebar */}
        {!currentPath && !activeFile && (
          <div className="hidden lg:flex w-[296px] flex-shrink-0 flex-col gap-6 pl-4 border-l border-gray-200">
            {/* About */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">About</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {repoData.description || <span className="italic text-gray-400">No description, website, or topics provided.</span>}
              </p>

              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
                  <Star size={16} className="text-gray-400" />
                  <span className="font-medium">{repoData.starsCount || 0}</span> stars
                </div>
                <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
                  <Eye size={16} className="text-gray-400" />
                  <span className="font-medium">{repoData.watchersCount || 0}</span> watching
                </div>
                <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
                  <GitFork size={16} className="text-gray-400" />
                  <span className="font-medium">{repoData.forksCount || 0}</span> forks
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            {/* Contributors */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
                Contributors
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {1 + (repoData.collaborators?.length || 0)}
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {/* Owner */}
                <Link to={`/u/${repoData.owner?.username}`} title={`Owner: ${repoData.owner?.username}`} className="group">
                  <img
                    src={repoData.owner?.profilePicture || defaultPfp}
                    onError={(e) => { e.target.src = defaultPfp; }}
                    alt={repoData.owner?.username}
                    className="w-8 h-8 rounded-full border border-gray-200 shadow-sm group-hover:ring-2 ring-blue-500/20 transition-all"
                  />
                </Link>
                {/* Collaborators */}
                {repoData.collaborators?.map(collab => (
                  <Link key={collab.user?._id} to={`/u/${collab.user?.username}`} title={`${collab.role}: ${collab.user?.username}`} className="group">
                    <img
                      src={collab.user?.profilePicture || defaultPfp}
                      onError={(e) => { e.target.src = defaultPfp; }}
                      alt={collab.user?.username}
                      className="w-8 h-8 rounded-full border border-gray-200 shadow-sm group-hover:ring-2 ring-blue-500/20 transition-all"
                    />
                  </Link>
                ))}
              </div>
            </div>

            {(() => {
              const langs = calculateLanguages(rootTree);
              if (langs.length === 0) return null;

              return (
                <>
                  <div className="h-px bg-gray-200" />
                  {/* Languages */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Languages</h3>
                    <div className="h-2 w-full rounded-full overflow-hidden flex mb-2">
                      {langs.map(l => (
                        <div key={l.name} style={{ width: `${l.percentage}%`, backgroundColor: getLanguageColorHex(l.name) }} title={`${l.name} ${l.percentage}%`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                      {langs.map(l => (
                        <div key={l.name} className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getLanguageColorHex(l.name) }} />
                          {l.name} <span className="text-gray-400 font-normal">{l.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>

  );
}
