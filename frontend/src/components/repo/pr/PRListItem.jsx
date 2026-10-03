import React from 'react';
import { GitPullRequest, XCircle, ArrowRight } from 'lucide-react';

export default function PRListItem({ pr, onClick }) {
  return (
    <div
      onClick={onClick}
      className="p-3 hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3"
    >
      <div className="mt-0.5">
        {pr.state === 'open' ? (
          <GitPullRequest className="text-[#1a7f37]" size={16} />
        ) : pr.state === 'merged' ? (
          <GitPullRequest className="text-[#8250df]" size={16} />
        ) : (
          <XCircle className="text-[#cf222e]" size={16} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold text-gray-900 hover:text-[#0969da] transition-colors leading-snug">
            {pr.title}
          </h4>
          {pr.labels?.map(label => (
            <span
              key={label._id || label.name}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
              style={{ backgroundColor: label.color + '20', borderColor: label.color + '40', color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-1 w-full">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span>
              #{pr._id.slice(-4)} opened {new Date(pr.createdAt).toLocaleDateString()} by{' '}
              <span className="hover:text-[#0969da] hover:underline cursor-pointer">{pr.author?.username}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-[10px] bg-[#f6f8fa] border border-gray-200 px-1 py-0.5 rounded text-gray-600">
              {pr.sourceBranch} <ArrowRight size={8} /> {pr.targetBranch}
            </span>
          </div>
          {pr.assignees?.length > 0 && (
            <div className="flex -space-x-1.5">
              {pr.assignees.map(a => (
                <img
                  key={a._id}
                  src={a.profilePicture || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg'}
                  alt={a.username}
                  title={`Assigned to ${a.username}`}
                  className="w-5 h-5 rounded-full border border-gray-300"
                  onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg'; }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
