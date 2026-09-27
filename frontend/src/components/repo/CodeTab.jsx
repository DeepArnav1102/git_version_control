import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Folder, PanelLeftClose, Search, PanelLeft, 
  ChevronRight, Check, Copy, Star, Eye, GitFork
} from 'lucide-react';
import { getFileIcon } from '../../utils/fileIcons';
import EmptyRepoView from './EmptyRepoView';
import SidebarNode from './SidebarNode';
import ReadmeBox from './ReadmeBox';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';


const getLanguageColorHex = (language) => {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    'C++': '#f34b7d',
    'C#': '#178600',
    Ruby: '#701516',
    Go: '#00ADD8',
    Rust: '#dea584',
    'Jupyter Notebook': '#DA5B0B',
    HTML: '#e34c26',
    CSS: '#563d7c'
  };
  return colors[language] || '#ccc';
};


const extensionToLanguage = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.java': 'Java',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.c': 'C',
  '.h': 'C',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.html': 'HTML',
  '.css': 'CSS',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.ipynb': 'Jupyter Notebook'
};

const calculateLanguages = (tree) => {
  if (!tree) return [];
  const counts = {};
  let total = 0;

  const traverse = (nodes) => {
    for (const node of nodes) {
      if (node.object_type === 'blob') {
        const ext = node.name.includes('.') ? node.name.substring(node.name.lastIndexOf('.')).toLowerCase() : '';
        const lang = extensionToLanguage[ext];
        if (lang && lang !== 'Markdown' && lang !== 'JSON') { // Optional: ignore some generic formats like github does
          counts[lang] = (counts[lang] || 0) + 1;
          total += 1;
        }
      } else if (node.object_type === 'tree' && node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(tree);

  if (total === 0) return [];
  
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      percentage: ((count / total) * 100).toFixed(1)
    }))
    .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
};

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
  loadingFile
}) {
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
          {loadingFile && (
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

              {/* Code viewer with syntax highlighting */}
              <div className="h-[65vh] min-h-[400px] w-full border-t border-gray-200 bg-[#fffffe]">
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
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">1</span>
              </h3>
              <div className="flex items-center gap-2 group">
                <Link to={`/u/${repoData.owner?.username}`}>
                  <img 
                    src={repoData.owner?.profilePicture || defaultPfp} 
                    alt={repoData.owner?.username}
                    className="w-8 h-8 rounded-full border border-gray-200 shadow-sm group-hover:ring-2 ring-blue-500/20 transition-all" 
                  />
                </Link>
                <div className="flex flex-col">
                  <Link to={`/u/${repoData.owner?.username}`} className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                    {repoData.owner?.username}
                  </Link>
                  <span className="text-[11px] text-gray-500">{repoData.owner?.name}</span>
                </div>
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
