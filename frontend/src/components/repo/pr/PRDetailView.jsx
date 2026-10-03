import React from 'react';
import { GitPullRequest, XCircle, CheckCircle, AlertTriangle, GitCommit, Plus } from 'lucide-react';
import apiClient from '../../../lib/axios';

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
}) {
  const avatarFallback = (username) =>
    'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

  return (
    <div className="w-full">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-flex items-center gap-2">
        ← Back to pull requests
      </button>

      {/* PR Header */}
      <div className="border-b border-gray-200 pb-6 mb-6">
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-3xl font-bold text-gray-900">
            {selectedPr.title} <span className="text-gray-400 font-normal">#{selectedPr._id.slice(-4)}</span>
          </h2>
          {isOwner && selectedPr.state === 'open' && (
            <button onClick={() => onClose(selectedPr._id)} className="px-3 py-1.5 border border-gray-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors">
              Close PR
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedPr.state === 'open' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-medium">
              <GitPullRequest size={16} /> Open
            </span>
          ) : selectedPr.state === 'merged' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500 text-white rounded-full text-sm font-medium">
              <GitPullRequest size={16} /> Merged
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500 text-white rounded-full text-sm font-medium">
              <XCircle size={16} /> Closed
            </span>
          )}
          <span className="text-gray-600 text-sm">
            <strong className="font-semibold text-gray-900">{selectedPr.author?.username}</strong> wants to merge into{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs text-gray-800">{selectedPr.targetBranch}</code> from{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs text-gray-800">{selectedPr.sourceBranch}</code>
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Main column */}
        <div className="flex-1 space-y-6">
          {/* Description */}
          <div className="flex gap-4">
            <img
              src={selectedPr.author?.profilePicture || avatarFallback(selectedPr.author?.username)}
              alt="pfp"
              className="w-10 h-10 rounded-full border border-gray-200"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = avatarFallback(selectedPr.author?.username); }}
            />
            <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm text-gray-600">
                <strong className="text-gray-900">{selectedPr.author?.username}</strong> commented on {new Date(selectedPr.createdAt).toLocaleDateString()}
              </div>
              <div className="p-4 text-sm text-gray-800 whitespace-pre-wrap">
                {selectedPr.description || <em className="text-gray-400">No description provided.</em>}
              </div>
            </div>
          </div>

          {/* Commits */}
          {selectedPrCommits.length > 0 && (
            <div className="ml-5 border-l-2 border-gray-200 pl-8 space-y-6 py-4">
              {selectedPrCommits.map(commit => (
                <div key={commit.hash} className="relative">
                  <div className="absolute -left-[43px] bg-gray-100 p-1.5 rounded-full border border-gray-300 z-10">
                    <GitCommit size={14} className="text-gray-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src={avatarFallback(commit.author)}
                      alt="author"
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="font-semibold text-gray-900 text-sm">{commit.author}</span>
                    <span className="text-gray-900 text-sm">{commit.message}</span>
                    <span className="text-gray-500 font-mono text-xs ml-auto">{commit.hash.slice(0, 7)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Merge / Conflict / Closed banners */}
          {selectedPr.state === 'open' && isOwner && !mergeConflict && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-6 flex flex-col items-center justify-center text-center mt-8">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">This pull request can be merged</h3>
              <p className="text-sm text-gray-600 mb-4 max-w-sm">
                Our incredibly fast Rust engine has checked this branch and there are no conflicts with the base branch.
              </p>
              <button onClick={() => onMerge(selectedPr._id)} disabled={merging} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors w-full md:w-auto disabled:opacity-50">
                {merging ? 'Merging...' : 'Merge pull request'}
              </button>
            </div>
          )}

          {selectedPr.state === 'open' && isOwner && mergeConflict && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-6 flex flex-col items-start mt-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-sm">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">This branch has conflicts that must be resolved</h3>
              </div>
              <p className="text-sm text-gray-700 mb-4">The native Rust merge engine detected a conflict. Please resolve the following files locally:</p>
              <ul className="list-disc list-inside text-sm font-mono text-red-700 bg-white border border-red-200 rounded p-4 w-full mb-4 shadow-inner">
                {mergeConflict.files.map((file, idx) => <li key={idx}>{file}</li>)}
              </ul>
              <p className="text-sm text-gray-600">
                Use the CLI to resolve conflicts, commit the changes, and push to the <code className="bg-gray-200 px-1 py-0.5 rounded">{selectedPr.sourceBranch}</code> branch.
              </p>
            </div>
          )}

          {selectedPr.state === 'open' && !isOwner && (
            <div className="border border-gray-200 bg-gray-50 rounded-xl p-6 flex flex-col items-center justify-center text-center mt-8">
              <h3 className="text-base font-bold text-gray-900 mb-1">Only repository owners can merge</h3>
              <p className="text-sm text-gray-600">You do not have permission to merge this pull request.</p>
            </div>
          )}

          {selectedPr.state === 'merged' && (
            <div className="border border-purple-200 bg-purple-50 rounded-xl p-6 flex flex-col items-center justify-center text-center mt-8">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
                <GitPullRequest size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Pull request successfully merged</h3>
              <p className="text-sm text-purple-700 mb-4 max-w-sm">
                The commits were merged into {selectedPr.targetBranch} securely via the native Rust merge engine.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
            {/* Assignees */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assignees</h4>
              </div>
              {selectedPr.assignees?.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedPr.assignees.map(a => (
                    <div key={a._id} className="flex items-center gap-2 text-sm text-gray-700">
                      <img
                        src={a.profilePicture || avatarFallback(a.username)}
                        alt={a.username}
                        className="w-5 h-5 rounded-full border border-gray-200"
                        onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = avatarFallback(a.username); }}
                      />
                      {a.username}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  No one assigned.{' '}
                  {user && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await apiClient.patch(`/repos/${owner}/${repo}/pulls/${selectedPr._id}`, {
                            assignees: [...(selectedPr.assignees || []), user._id],
                          });
                          setSelectedPr(res.data.pr);
                          fetchPRs();
                        } catch (err) {}
                      }}
                      className="text-[#0969da] hover:underline"
                    >
                      Assign yourself
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-200" />

            {/* Reviewers */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reviewers</h4>
              </div>
              {selectedPr.reviewers?.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {selectedPr.reviewers.map(r => (
                    <div key={r._id} className="flex items-center gap-2 text-sm text-gray-700">
                      <img
                        src={r.profilePicture || avatarFallback(r.username)}
                        alt={r.username}
                        className="w-5 h-5 rounded-full border border-gray-200"
                        onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = avatarFallback(r.username); }}
                      />
                      {r.username}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  No reviewers.{' '}
                  {user && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await apiClient.patch(`/repos/${owner}/${repo}/pulls/${selectedPr._id}`, {
                            reviewers: [...(selectedPr.reviewers || []), user._id],
                          });
                          setSelectedPr(res.data.pr);
                          fetchPRs();
                        } catch (err) {}
                      }}
                      className="text-[#0969da] hover:underline"
                    >
                      Request yourself
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-200" />

            {/* Labels */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Labels</h4>
                <button
                  onClick={async () => {
                    const name = window.prompt('Enter label name:');
                    if (name) {
                      const colors = ['#cf222e', '#1a7f37', '#0969da', '#bf3989', '#8250df', '#d4a72c'];
                      const color = colors[Math.floor(Math.random() * colors.length)];
                      try {
                        const res = await apiClient.patch(`/repos/${owner}/${repo}/pulls/${selectedPr._id}`, {
                          labels: [...(selectedPr.labels || []), { name, color }],
                        });
                        setSelectedPr(res.data.pr);
                        fetchPRs();
                      } catch (err) {}
                    }
                  }}
                  className="text-gray-400 hover:text-gray-900"
                >
                  <Plus size={14} />
                </button>
              </div>
              {selectedPr.labels?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPr.labels.map((label, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full text-[11px] font-medium border" style={{ backgroundColor: label.color + '20', borderColor: label.color + '40', color: label.color }}>
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">None yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
