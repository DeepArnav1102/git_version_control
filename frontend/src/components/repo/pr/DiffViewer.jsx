import React, { useState } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import { File } from 'lucide-react';

const getLanguage = (filename) => {
  if (!filename) return 'text';
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', cpp: 'cpp', c: 'c',
    cs: 'csharp', go: 'go', rs: 'rust', html: 'html', css: 'css',
    json: 'json', md: 'markdown', sh: 'bash', yml: 'yaml', yaml: 'yaml'
  };
  return map[ext] || 'text';
};

export default function DiffViewer({ file }) {
  const lines = file.diffText ? file.diffText.split('\n') : [];
  const isLarge = lines.length > 100;
  const [expanded, setExpanded] = useState(!isLarge);
  const language = getLanguage(file.path);

  const highlightLine = (text) => {
    try {
      if (!text) return ' ';
      return hljs.highlight(text, { language, ignoreIllegals: true }).value;
    } catch (e) {
      return text || ' ';
    }
  };

  const renderDiffLine = (line, idx) => {
    if (line.startsWith('@@')) {
      return (
        <div key={idx} className="bg-blue-50 border-y border-blue-100 text-blue-700 px-3 py-1 whitespace-pre font-mono text-[11px] shadow-inner flex">
           <span className="select-none text-blue-400 mr-3 w-4 inline-block text-right"></span>
           {line}
        </div>
      );
    } else if (line.startsWith('+')) {
      return (
        <div key={idx} className="bg-[#e6ffed] hover:bg-[#dcf4e3] px-3 py-0.5 whitespace-pre font-mono text-[11px] flex transition-colors">
          <span className="select-none text-green-500 mr-3 w-4 inline-block text-right">+</span>
          <span dangerouslySetInnerHTML={{ __html: highlightLine(line.substring(1)) }} className="text-gray-900" />
        </div>
      );
    } else if (line.startsWith('-')) {
      return (
        <div key={idx} className="bg-[#ffeef0] hover:bg-[#fcdde1] px-3 py-0.5 whitespace-pre font-mono text-[11px] flex transition-colors">
          <span className="select-none text-red-500 mr-3 w-4 inline-block text-right">-</span>
          <span dangerouslySetInnerHTML={{ __html: highlightLine(line.substring(1)) }} className="text-gray-900" />
        </div>
      );
    }
    const rawText = line.length > 0 && (line.startsWith(' ') || line.startsWith('\\')) ? line.substring(1) : line;
    return (
      <div key={idx} className="bg-white hover:bg-gray-50 px-3 py-0.5 whitespace-pre font-mono text-[11px] flex transition-colors">
        <span className="select-none text-gray-300 mr-3 w-4 inline-block text-right"> </span>
        <span dangerouslySetInnerHTML={{ __html: highlightLine(rawText) }} className="text-gray-700" />
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white mb-6 transition-shadow hover:shadow-md">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center group cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
           <File size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
           <span className="font-mono text-xs font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">{file.path}</span>
           {file.kind === 'added' && <span className="ml-2 text-[10px] uppercase font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">Added</span>}
           {file.kind === 'deleted' && <span className="ml-2 text-[10px] uppercase font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Deleted</span>}
           {file.kind === 'renamed' && <span className="ml-2 text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Renamed</span>}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-3 font-medium">
          <span className="text-green-600">+{file.additions}</span>
          <span className="text-red-600">-{file.deletions}</span>
          <svg className={`w-4 h-4 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
      
      {expanded && (
        <div className="overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            {lines.map((line, idx) => renderDiffLine(line, idx))}
          </div>
        </div>
      )}
    </div>
  );
}
