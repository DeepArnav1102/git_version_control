import React from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Folder } from 'lucide-react';
import { getFileIcon } from '../../utils/fileIcons';

export default function SidebarNode({
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
