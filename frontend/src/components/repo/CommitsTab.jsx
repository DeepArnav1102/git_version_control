import React from 'react';
import { motion } from 'framer-motion';
import { History, Code } from 'lucide-react';

const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

export default function CommitsTab({ commits, copyToClipboard }) {
  return (
    <motion.div
      key="tab-commits"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="mt-6 w-full"
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <History size={16} /> Commit History
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {commits.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No commit history found.</p>
          ) : (
            commits.map((c) => (
              <div key={c.hash} className="px-6 py-4 hover:bg-gray-50 flex items-start justify-between gap-4 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm mb-1">{c.message}</p>
                  <div className="flex items-center gap-2">
                    <img
                      src={c.authorProfilePicture || defaultPfp}
                      alt={c.author}
                      className="w-5 h-5 rounded-full object-cover border border-gray-200"
                      onError={(e) => { e.target.src = defaultPfp; }}
                    />
                    <p className="text-gray-500 text-xs">
                      <span className="font-semibold text-gray-700">{c.author}</span> committed {c.date ? new Date(c.date).toLocaleDateString() : 'recently'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                  <span className="border border-green-300 text-green-700 bg-green-50 px-2 py-0.5 rounded-md text-[11px] font-semibold hidden sm:inline-block">
                    Verified
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                    <span className="font-mono bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md text-gray-700 text-xs cursor-pointer hover:bg-gray-200" title="Copy full SHA" onClick={() => copyToClipboard(c.hash)}>
                      {c.hash?.substring(0, 7)}
                    </span>
                    <button className="text-gray-500 hover:text-blue-600 transition-colors border border-gray-200 rounded-md p-1.5 bg-white cursor-pointer shadow-sm hover:shadow" title="Browse files at this point in history">
                      <Code size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
