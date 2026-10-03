import React, { useState, useEffect } from 'react';
import { ArrowRight, Check, X, GitCommit, FileCode, Users, AlertTriangle, File } from 'lucide-react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

const getLanguage = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
    go: 'go', rs: 'rust', php: 'php', html: 'html', css: 'css', json: 'json',
    md: 'markdown', sh: 'bash', yml: 'yaml', yaml: 'yaml'
  };
  return map[ext] || 'plaintext';
};

const BranchSelect = ({ value, onChange, options, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center gap-2" ref={containerRef}>
      {label && <span className="text-xs font-semibold text-gray-600">{label}:</span>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between min-w-[140px] px-2.5 py-1.5 border border-gray-300 rounded-md text-xs bg-gray-50 hover:bg-gray-100 font-mono focus:outline-none transition-colors shadow-sm"
      >
        <span className="truncate">{value || placeholder}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
          {options.map((opt) => (
            <button
              key={opt.name}
              type="button"
              onClick={() => {
                onChange(opt.name);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-gray-50 text-gray-700 flex items-center justify-between"
            >
              {opt.name}
              {value === opt.name && <Check size={14} className="text-green-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function PRCreateView({ newPr, setNewPr, branches, onSubmit, onCancel }) {
  const { owner, repo } = useParams();
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (newPr.targetBranch && newPr.sourceBranch) {
      fetchCompareData();
    }
  }, [newPr.targetBranch, newPr.sourceBranch]);

  const fetchCompareData = async () => {
    if (newPr.targetBranch === newPr.sourceBranch) {
      setCompareData({ identical: true });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/v1/repos/${owner}/${repo}/compare/${newPr.targetBranch}...${newPr.sourceBranch}`,
        { withCredentials: true }
      );
      setCompareData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to compare branches');
    } finally {
      setLoading(false);
    }
  };

  const getProfilePicture = (pfp) => pfp || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

  const DiffViewer = ({ file }) => {
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
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <File size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-700 font-mono truncate max-w-md">{file.path}</span>
            {file.status === 'added' && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">Added</span>}
            {file.status === 'deleted' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">Deleted</span>}
          </div>
          {!file.isBinary && (
            <div className="flex items-center gap-2 text-[11px] font-mono">
              {file.additions > 0 && <span className="text-green-600">+{file.additions}</span>}
              {file.deletions > 0 && <span className="text-red-600">-{file.deletions}</span>}
            </div>
          )}
        </div>
        
        <div className="bg-white overflow-x-auto">
          {file.isBinary ? (
            <div className="py-8 text-center text-xs text-gray-500 italic flex justify-center items-center gap-2 bg-gray-50">
              <FileCode size={16} className="text-gray-400" />
              Binary file not shown.
            </div>
          ) : file.diffText ? (
            <div className="min-w-max border-t-0 border-gray-100">
              {expanded ? (
                <div className="py-2 bg-white">
                  {lines.map((line, idx) => renderDiffLine(line, idx))}
                </div>
              ) : (
                <div className="py-10 flex justify-center items-center bg-gray-50/50">
                  <button 
                    onClick={() => setExpanded(true)}
                    className="px-4 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-blue-600 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Load diff ({lines.length} lines)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-gray-500 italic bg-gray-50">No content changes.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full pb-20">
      <div className="mb-4">
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-900 mb-2 inline-flex items-center gap-1 font-medium transition-colors">
          ← Back to pull requests
        </button>
        <h2 className="text-xl font-semibold text-gray-800">Comparing changes</h2>
        <p className="text-gray-500 text-xs mt-1">Choose two branches to see what's changed or to start a new pull request.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-visible shadow-sm mb-4">
        <div className="bg-gray-50 p-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <BranchSelect
            label="base"
            value={newPr.targetBranch}
            onChange={(val) => setNewPr({ ...newPr, targetBranch: val })}
            options={branches || []}
            placeholder="Select branch..."
          />
          <div className="text-gray-400"><ArrowRight size={14} /></div>
          <BranchSelect
            label="compare"
            value={newPr.sourceBranch}
            onChange={(val) => setNewPr({ ...newPr, sourceBranch: val })}
            options={branches || []}
            placeholder="Select branch..."
          />
          
          <div className="ml-auto flex items-center gap-3">
            {!loading && compareData && !compareData.identical && !compareData.upToDate && (
              <div className="flex items-center">
                {compareData.mergeable ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                    <Check size={14} /> Able to merge.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                    <X size={14} /> Can't automatically merge.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#fd8c73]"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-sm flex flex-col items-center gap-2">
            <AlertTriangle size={20} />
            {error}
          </div>
        ) : compareData?.identical || compareData?.upToDate ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            There isn't anything to compare.
            <br />
            <span className="text-xs text-gray-400 mt-1 block">
              {compareData?.upToDate 
                ? `${newPr.sourceBranch} is up to date with all commits from ${newPr.targetBranch}.` 
                : `${newPr.targetBranch} and ${newPr.sourceBranch} are entirely identical.`}
            </span>
          </div>
        ) : compareData ? (
          <div className="p-4 bg-white rounded-b-lg">
            {!showForm ? (
               <button
                 onClick={() => setShowForm(true)}
                 disabled={!compareData.mergeable && compareData.commits?.length === 0}
                 className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
               >
                 Create pull request
               </button>
            ) : (
               <form onSubmit={onSubmit} className="space-y-3 mb-2 p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                 <input
                   type="text"
                   placeholder="Pull request title"
                   required
                   maxLength={255}
                   value={newPr.title}
                   onChange={e => setNewPr({ ...newPr, title: e.target.value })}
                   className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#fd8c73] focus:border-[#fd8c73] transition-all font-semibold bg-white"
                 />
                 <textarea
                   placeholder="Add a description..."
                   rows={4}
                   value={newPr.description}
                   onChange={e => setNewPr({ ...newPr, description: e.target.value })}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#fd8c73] focus:border-[#fd8c73] transition-all resize-y bg-white text-gray-700"
                 />
                 <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newPr.title || !newPr.sourceBranch}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                    >
                      Create pull request
                    </button>
                 </div>
               </form>
            )}

            {!compareData.mergeable && compareData.conflictFiles?.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <h4 className="text-xs font-bold text-red-800 flex items-center gap-1 mb-2"><AlertTriangle size={14}/> Conflicting files</h4>
                <ul className="text-xs text-red-700 font-mono ml-5 list-disc">
                  {compareData.conflictFiles.map((c, i) => (
                    <li key={i}>{c.path} <span className="text-red-400 text-[10px]">({c.kind || 'conflict'})</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">Select branches to compare</div>
        )}
      </div>

      {compareData && !compareData.identical && !compareData.upToDate && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-6 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm text-xs text-gray-600">
             <div className="flex items-center gap-2">
                <GitCommit size={14} className="text-gray-400" />
                <span className="font-semibold text-gray-900">{compareData.stats?.commitsCount || 0}</span> commits
             </div>
             <div className="flex items-center gap-2">
                <FileCode size={14} className="text-gray-400" />
                <span className="font-semibold text-gray-900">{compareData.stats?.filesChanged || 0}</span> files changed
             </div>
             <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                <span className="font-semibold text-gray-900">
                  {new Set(compareData.commits?.map(c => c.author)).size || 0}
                </span> contributors
             </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
             <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
               <h3 className="text-xs font-bold text-gray-700">Commits</h3>
             </div>
             <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
               {compareData.commits?.map(commit => (
                 <div key={commit.hash} className="px-4 py-2 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                   <img 
                     src={getProfilePicture(commit.authorProfilePicture)} 
                     alt={commit.author} 
                     className="w-5 h-5 rounded-full object-cover mt-0.5 ring-1 ring-gray-200"
                     onError={(e) => { e.currentTarget.src = 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg'; e.currentTarget.onerror = null; }}
                   />
                   <div className="flex-1 min-w-0">
                     <p className="text-xs font-medium text-gray-900 truncate leading-tight">{commit.message}</p>
                     <p className="text-[11px] text-gray-500 mt-0.5">{commit.author}</p>
                   </div>
                   <div className="text-[11px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{commit.hash.substring(0, 7)}</div>
                 </div>
               ))}
             </div>
          </div>

          <div className="space-y-3">
             <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
               Files changed
               <span className="text-xs font-normal text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded-full border border-gray-200">{compareData.stats?.filesChanged || 0}</span>
             </h3>
             {compareData.files?.map(file => (
               <DiffViewer key={file.path} file={file} />
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
