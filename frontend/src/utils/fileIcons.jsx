import React from 'react';
import { FileText, FileCode } from 'lucide-react';

export function getFileIcon(fileName) {
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
