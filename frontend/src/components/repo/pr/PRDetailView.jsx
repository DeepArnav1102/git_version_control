import React, { useState, useEffect } from 'react';
import { GitPullRequest, XCircle, CheckCircle, AlertTriangle, GitCommit, FileCode, Plus, MessageCircle, X } from 'lucide-react';
import apiClient from '../../../lib/axios';
import MultiSelect from './MultiSelect';
import DiffViewer from './DiffViewer';

export default function PRDetailView({
  selectedPr, setSelectedPr,
  selectedPrCommits,
  mergeConflict,
  merging,
  isOwner,
  user,
  owner, repo,
  onBack,
  onMerge,
  onClose,
  fetchPRs,
  prMetadata = { users: [], labels: [] }
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('conversation');
  const [compareData, setCompareData] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  
  const canMerge = user && selectedPr.targetRepo?.owner?.username === user.username;
  
  const getProfilePicture = (pfp) => pfp || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

  useEffect(() => {
    fetchCompareData();
  }, [selectedPr._id]);

  const fetchCompareData = async () => {
    setLoadingCompare(true);
    try {
      const sourceOwnerName = selectedPr.sourceRepo?.owner?.username || owner;
      const targetOwnerName = selectedPr.targetRepo?.owner?.username || owner;
      const targetRepoName = selectedPr.targetRepo?.name || repo;
      
      const sourceRef = sourceOwnerName !== targetOwnerName 
        ? `${sourceOwnerName}:${selectedPr.sourceBranch}` 
        : selectedPr.sourceBranch;
        
      const res = await apiClient.get(`/repos/${targetOwnerName}/${targetRepoName}/compare/${selectedPr.targetBranch}...${sourceRef}`);
      setCompareData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCompare(false);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await apiClient.get(`/repos/${owner}/${repo}/pulls/${selectedPr._id}/comments`);
      setComments(res.data.comments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [selectedPr._id]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await apiClient.post(`/repos/${owner}/${repo}/pulls/${selectedPr._id}/comments`, { content: newComment });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMetadata = async (field, value) => {
    try {
      const res = await apiClient.patch(`/repos/${owner}/${repo}/pulls/${selectedPr._id}`, {
        [field]: value.map(v => v._id || v)
      });
      setSelectedPr(res.data.pr);
      fetchPRs();
    } catch (err) {}
  };

  const handleUpdateLabels = async (value) => {
    try {
      const res = await apiClient.patch(`/repos/${owner}/${repo}/pulls/${selectedPr._id}`, {
        labels: value.map(l => ({ name: l.name, color: l.color }))
      });
      setSelectedPr(res.data.pr);
      fetchPRs();
    } catch (err) {}
  };

  // timeline generation: merge commits and comments sorted by createdAt
  const timelineEvents = [
    ...selectedPrCommits.map(c => ({ type: 'commit', data: c, date: new Date(c.date || Date.now()) })),
    ...comments.map(c => ({ type: 'comment', data: c, date: new Date(c.createdAt) }))
  ].sort((a, b) => a.date - b.date);

  return (
    <div className="w-full pb-20">
      <button onClick={onBack} className="text-sm text-[#0969da] hover:underline mb-4 inline-flex items-center gap-2">
        ← Back to pull requests
      </button>
      {/* PR Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-3xl font-normal text-gray-900">
            {selectedPr.title} <span className="text-gray-400 font-light">#{selectedPr._id.slice(-4)}</span>
          </h2>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-md transition-colors">
              Edit
            </button>
            {isOwner && selectedPr.state === 'open' && (
              <button onClick={() => onClose(selectedPr._id)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-md transition-colors">
                Close
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          {selectedPr.state === 'open' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2da44e] text-white rounded-full text-sm font-semibold shadow-sm">
              <GitPullRequest size={16} /> Open
            </span>
          ) : selectedPr.state === 'merged' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8250df] text-white rounded-full text-sm font-semibold shadow-sm">
              <GitPullRequest size={16} /> Merged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 text-white rounded-full text-sm font-semibold shadow-sm">
              <XCircle size={16} /> Closed
            </span>
          )}
          
          <span className="text-gray-500 text-sm flex items-center">
            <strong className="font-semibold text-gray-700 mr-1">{selectedPr.author?.username}</strong> wants to merge {selectedPrCommits.length} commit into{' '}
            <code className="bg-[#ddf4ff] text-[#0969da] px-1.5 py-0.5 rounded font-mono text-xs mx-1">{selectedPr.targetBranch}</code> from{' '}
            <code className="bg-[#ddf4ff] text-[#0969da] px-1.5 py-0.5 rounded font-mono text-xs mx-1">{selectedPr.sourceBranch}</code>
          </span>

          {compareData && compareData.files && (
            <div className="ml-auto text-sm font-mono flex items-center gap-3 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
              <span className="text-green-600 font-semibold">+{compareData.files.reduce((a, b) => a + (b.additions || 0), 0)}</span>
              <span className="text-red-600 font-semibold">-{compareData.files.reduce((a, b) => a + (b.deletions || 0), 0)}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200">
           <button className={`py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'conversation' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('conversation')}>
             <MessageCircle size={16}/> Conversation <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{comments.length}</span>
           </button>
           <button className={`py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'commits' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('commits')}>
             <GitCommit size={16}/> Commits <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{selectedPrCommits.length}</span>
           </button>
           <button className={`py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'checks' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('checks')}>
             Checks <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">0</span>
           </button>
           <button className={`py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'files' ? 'border-[#fd8c73] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('files')}>
             Files changed <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{compareData?.files ? compareData.files.length : 0}</span>
           </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Main column */}
        <div className="flex-1">
          {/* Timeline */}
          {activeTab === 'conversation' && (
          <div className="space-y-6 relative">
             
             {/* Initial Description */}
             <div className="flex gap-4 relative z-10 mb-8">
               <img
                 src={getProfilePicture(selectedPr.author?.profilePicture)}
                 alt="pfp"
                 className="w-10 h-10 rounded-full border border-gray-200 bg-white"
               />
               <div className="flex-1 bg-white border border-[#d0d7de] rounded-md overflow-hidden relative shadow-sm">
                 <div className="absolute left-[-6px] top-4 w-3 h-3 bg-[#f6f8fa] border-l border-b border-[#d0d7de] transform rotate-45"></div>
                 <div className="bg-[#f6f8fa] px-4 py-2.5 border-b border-[#d0d7de] text-sm text-gray-600 flex justify-between items-center relative z-10">
                   <div><strong className="text-gray-900 font-semibold">{selectedPr.author?.username}</strong> commented</div>
                   <span className="px-2 py-0.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 bg-white">Owner</span>
                 </div>
                 <div className="p-4 text-sm text-gray-800 whitespace-pre-wrap min-h-[100px]">
                   {selectedPr.description || <em className="text-gray-500 italic">No description provided.</em>}
                 </div>
               </div>
             </div>

             {/* Commits & Comments Timeline */}
             {loadingComments ? (
                [1, 2].map(i => (
                  <div key={i} className="flex gap-4 relative z-10 ml-8 mb-4 items-start animate-pulse">
                    <div className="flex gap-4 w-full -ml-[32px]">
                      <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-200" />
                      <div className="flex-1 border border-[#d0d7de] rounded-md overflow-hidden bg-white shadow-sm">
                        <div className="bg-[#f6f8fa] px-4 py-3 border-b border-[#d0d7de] flex items-center relative z-10">
                          <div className="absolute left-[-6px] top-4 w-3 h-3 bg-[#f6f8fa] border-l border-b border-[#d0d7de] transform rotate-45"></div>
                          <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                        </div>
                        <div className="p-4">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
             ) : (
                timelineEvents.map((evt, idx) => (
                   <div key={idx} className="flex gap-4 relative z-10 ml-8 mb-4 items-start">
                      {evt.type === 'commit' ? (
                        <>
                           <div className="mt-1 w-6 h-6 bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center relative -left-[45px] top-1">
                             <GitCommit size={14} className="text-gray-500" />
                           </div>
                           <div className="flex -ml-4 items-center gap-2 flex-1 pt-1.5">
                             <img src={getProfilePicture(null)} alt="author" className="w-5 h-5 rounded-full" />
                             <span className="font-semibold text-gray-900 text-sm">{evt.data.author}</span>
                             <span className="text-gray-700 text-sm">{evt.data.message}</span>
                             <span className="text-gray-500 font-mono text-xs ml-auto bg-gray-100 px-1.5 py-0.5 rounded">{evt.data.hash.slice(0, 7)}</span>
                           </div>
                        </>
                      ) : (
                        <div className="flex gap-4 w-full -ml-[32px]">
                          <img src={getProfilePicture(evt.data.author?.profilePicture)} alt="pfp" className="w-10 h-10 rounded-full border border-gray-200 bg-white" />
                          <div className="flex-1 bg-white border border-[#d0d7de] rounded-md overflow-hidden relative shadow-sm">
                            <div className="absolute left-[-6px] top-4 w-3 h-3 bg-[#f6f8fa] border-l border-b border-[#d0d7de] transform rotate-45"></div>
                            <div className="bg-[#f6f8fa] px-4 py-2 border-b border-[#d0d7de] text-sm text-gray-600 flex justify-between items-center relative z-10">
                              <div><strong className="text-gray-900 font-semibold">{evt.data.author?.username}</strong> commented</div>
                            </div>
                            <div className="p-4 text-sm text-gray-800 whitespace-pre-wrap">
                              {evt.data.content}
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
                ))
             )}

             {/* Merge Box */}
             {(canMerge || selectedPr.state === 'merged') && (
               <div className="relative z-10 mt-8 mb-8">
                 <div className="flex items-start gap-4">
                   <div className="mt-4">
                     <div className="w-10 h-10 rounded-full bg-[#2da44e] flex items-center justify-center shadow-sm">
                       <CheckCircle size={20} className="text-white" />
                     </div>
                   </div>
                   <div className="flex-1 border border-[#d0d7de] rounded-md overflow-hidden bg-white shadow-sm">
                     {selectedPr.state === 'open' && canMerge && !mergeConflict && (
                       <>
                         <div className="p-4 border-b border-[#d0d7de]">
                           <h3 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">This branch has no conflicts with the base branch</h3>
                           <p className="text-sm text-gray-600">Merging can be performed automatically.</p>
                         </div>
                         <div className="p-4 bg-[#f6f8fa] flex gap-2">
                           <button onClick={() => onMerge(selectedPr._id)} disabled={merging} className="bg-[#2da44e] hover:bg-[#2c974b] text-white px-4 py-1.5 rounded-md text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 border border-[rgba(27,31,36,0.15)]">
                             {merging ? 'Merging...' : 'Merge pull request'}
                           </button>
                           <div className="flex items-center text-sm text-gray-500 pl-2">
                             You can also merge this with the command line.
                           </div>
                         </div>
                       </>
                     )}
                     {selectedPr.state === 'open' && canMerge && mergeConflict && (
                       <>
                         <div className="p-4 border-b border-red-200 bg-red-50">
                           <h3 className="text-base font-bold text-red-800 mb-1 flex items-center gap-2"><AlertTriangle size={18}/> This branch has conflicts</h3>
                           <p className="text-sm text-red-700">The native Rust merge engine detected a conflict. Please resolve the following files locally:</p>
                         </div>
                         <div className="p-4 bg-white">
                           <ul className="list-disc list-inside text-sm font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                             {mergeConflict.files.map((file, idx) => <li key={idx}>{file}</li>)}
                           </ul>
                           <button disabled className="bg-gray-300 text-white px-4 py-2 rounded-md text-sm font-semibold cursor-not-allowed">
                             Merge pull request
                           </button>
                         </div>
                       </>
                     )}
                     {selectedPr.state === 'merged' && (
                       <div className="p-4 bg-purple-50">
                           <h3 className="text-base font-bold text-purple-900 mb-1 flex items-center gap-2"><GitPullRequest size={18}/> Pull request successfully merged</h3>
                           <p className="text-sm text-purple-700">The commits were merged into {selectedPr.targetBranch}.</p>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             )}

             {/* Comment Box */}
             <div className="flex gap-4 relative z-10">
               <img src={getProfilePicture(user?.profilePicture || user?.avatar_url)} alt="pfp" className="w-10 h-10 rounded-full border border-gray-200 bg-white" />
               <form onSubmit={handleAddComment} className="flex-1 bg-white border border-[#d0d7de] rounded-md overflow-hidden relative shadow-sm">
                 <div className="absolute left-[-6px] top-4 w-3 h-3 bg-[#f6f8fa] border-l border-b border-[#d0d7de] transform rotate-45"></div>
                 
                 <div className="bg-[#f6f8fa] px-4 pt-2 border-b border-[#d0d7de] text-sm text-gray-600 flex gap-4 relative z-10">
                   <span className="text-gray-900 border-b-2 border-gray-400 pb-2 font-semibold">Write</span>
                   <span className="text-gray-500 font-normal cursor-not-allowed">Preview</span>
                 </div>
                 
                 <div className="p-3">
                   <textarea
                     placeholder="Leave a comment"
                     rows={4}
                     value={newComment}
                     onChange={e => setNewComment(e.target.value)}
                     className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0969da]/30 focus:border-[#0969da] border border-gray-200 rounded-md bg-gray-50/50 resize-y text-gray-700 min-h-[100px]"
                   />
                 </div>
                 
                 <div className="bg-[#f6f8fa] px-3 py-2 flex justify-between items-center text-xs text-gray-500 border-t border-[#d0d7de]">
                   <span className="flex items-center gap-1"><FileCode size={14}/> Markdown is supported</span>
                   <button
                     type="submit"
                     disabled={!newComment.trim() || loadingComments}
                     className="bg-[#2da44e] hover:bg-[#2c974b] text-white px-3 py-1.5 rounded-md font-semibold transition-colors disabled:opacity-50 shadow-sm border border-[rgba(27,31,36,0.15)]"
                   >
                     {loadingComments ? 'Loading...' : 'Comment'}
                   </button>
                 </div>
               </form>
             </div>
          </div>
          )}

          {activeTab === 'commits' && (
             <div className="bg-white border border-gray-200 rounded-md shadow-sm mt-4">
                <div className="px-4 py-3 border-b border-gray-200 bg-[#f6f8fa] flex items-center justify-between">
                   <h3 className="font-semibold text-gray-800 text-sm">{selectedPrCommits.length} commits</h3>
                </div>
                <div className="flex flex-col">
                   {selectedPrCommits.map((c, i) => (
                     <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-200 last:border-0 hover:bg-gray-50">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-gray-900 text-sm">{c.message}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                             <img src={getProfilePicture(null)} alt="" className="w-4 h-4 rounded-full" />
                             <span className="font-medium text-gray-700">{c.author}</span>
                             <span>committed on {new Date(c.date || Date.now()).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-xs text-[#0969da] bg-[#ddf4ff] px-2 py-1 rounded cursor-pointer">{c.hash.slice(0, 7)}</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'checks' && (
             <div className="border border-gray-200 rounded-md p-10 flex flex-col items-center justify-center text-center bg-white shadow-sm mt-4">
                <div className="w-12 h-12 bg-[#f6f8fa] rounded-full flex items-center justify-center mb-4">
                   <CheckCircle size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Checks have not been configured yet</h3>
                <p className="text-sm text-gray-500 max-w-md mb-6">
                   Automate your workflow from idea to production with GitHub Actions. It is easy to get started right here.
                </p>
                <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-md text-sm font-semibold transition-colors">
                   Set up CI
                </button>
             </div>
          )}

          {activeTab === 'files' && (
             <div className="mt-4">
               {loadingCompare ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="mb-4 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden animate-pulse">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                        <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                        <div className="h-4 bg-gray-100 rounded w-4/6"></div>
                      </div>
                    </div>
                  ))
               ) : compareData && compareData.files ? (
                  compareData.files.map((f, i) => <DiffViewer key={i} file={f} />)
               ) : (
                  <div className="text-sm text-gray-500 py-10 text-center border border-gray-200 rounded-md bg-white">No files changed.</div>
               )}
             </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-[260px] flex-shrink-0 space-y-1">
          <MultiSelect
            label="Reviewers"
            placeholder="No reviews"
            options={prMetadata?.users?.filter(u => u._id !== user?._id) || []}
            selected={selectedPr.reviewers || []}
            onChange={val => handleUpdateMetadata('reviewers', val)}
            renderOption={(u, isSel, onRemove) => (
              <div className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-2">
                  <img src={getProfilePicture(u.profilePicture || u.avatar_url)} alt="pfp" className="w-4 h-4 rounded-full"/>
                  <span className={isSel ? 'font-medium text-gray-900' : 'text-gray-700'}>{u.username || u.name}</span>
                </div>
                {isSel && onRemove && (
                  <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          />
          <div className="border-t border-gray-200 my-1"></div>
          <MultiSelect
            label="Assignees"
            placeholder={user ? <span onClick={(e) => { e.preventDefault(); handleUpdateMetadata('assignees', [...(selectedPr.assignees || []), user]) }} className="cursor-pointer hover:text-[#0969da] hover:underline">No one—assign yourself</span> : "No one"}
            options={prMetadata?.users || []}
            selected={selectedPr.assignees || []}
            onChange={val => handleUpdateMetadata('assignees', val)}
            renderOption={(u, isSel, onRemove) => (
              <div className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-2">
                  <img src={getProfilePicture(u.profilePicture || u.avatar_url)} alt="pfp" className="w-4 h-4 rounded-full"/>
                  <span className={isSel ? 'font-medium text-gray-900' : 'text-gray-700'}>{u.username || u.name}</span>
                </div>
                {isSel && onRemove && (
                  <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          />
          <div className="border-t border-gray-200 my-1"></div>
          <MultiSelect
            label="Labels"
            placeholder="None yet"
            options={prMetadata?.labels || []}
            selected={selectedPr.labels || []}
            onChange={val => handleUpdateLabels(val)}
            renderOption={(l, isSel, onRemove) => (
              <div className="flex items-center justify-between w-full group">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border" style={{ backgroundColor: (l.color || '#ccc') + '20', borderColor: (l.color || '#ccc') + '40', color: l.color || '#666' }}>
                  {l.name}
                </span>
                {isSel && onRemove && (
                  <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          />
          <div className="border-t border-gray-200 my-1"></div>
          <div className="py-2">
            <h4 className="text-[12px] font-semibold text-gray-600 mb-1">Projects</h4>
            <div className="text-[12px] text-gray-500">None yet</div>
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="py-2">
            <h4 className="text-[12px] font-semibold text-gray-600 mb-1">Milestone</h4>
            <div className="text-[12px] text-gray-500">No milestone</div>
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="py-2">
            <h4 className="text-[12px] font-semibold text-gray-600 mb-1">Development</h4>
            <div className="text-[12px] text-gray-500">Successfully merging this pull request may close these issues.</div>
            <div className="text-[12px] text-gray-500 mt-1">None yet</div>
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="py-2">
            <h4 className="text-[12px] font-semibold text-gray-600 mb-1 flex justify-between items-center">Notifications <span className="font-normal cursor-pointer hover:text-[#0969da]">Customize</span></h4>
            <button className="w-full mt-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[12px] font-semibold text-gray-700 flex items-center justify-center gap-1 hover:bg-gray-100 transition-colors shadow-sm">
               Unsubscribe
            </button>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              You're receiving notifications because you authored the thread.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
