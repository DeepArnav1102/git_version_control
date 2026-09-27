import React from 'react';
import { 
  Folder, PanelLeftClose, Search, PanelLeft, 
  ChevronRight, Check, Copy 
} from 'lucide-react';
import { getFileIcon } from '../../utils/fileIcons';
import EmptyRepoView from './EmptyRepoView';
import SidebarNode from './SidebarNode';
import ReadmeBox from './ReadmeBox';

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

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
  handleEntryClick
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
  );
}
