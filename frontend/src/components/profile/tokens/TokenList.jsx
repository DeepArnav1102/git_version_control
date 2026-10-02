import React from 'react';
import { motion } from 'framer-motion';
import { Key, Plus, Trash2 } from 'lucide-react';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../../../assets/Loading V2/loadingV2.json';

export default function TokenList({ tokens, loading, onGenerateClick, onRevoke }) {
  return (
    <motion.div 
      key="list"
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Key size={20} className="text-gray-400" />
          Personal Access Tokens
        </h2>
        {tokens.length > 0 && !loading && (
          <button
            onClick={onGenerateClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={14} strokeWidth={2} />
            Generate token
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
              <div className="space-y-2">
                <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                <div className="w-24 h-3 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-5 bg-gray-100 rounded-full animate-pulse" />
                <div className="w-7 h-7 bg-gray-100 rounded-md animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-16 flex-1 flex flex-col justify-center">
          <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
            <Key size={18} strokeWidth={1.4} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-400 font-medium mb-1">
            Personal Access Tokens
          </p>
          <p className="text-xs text-gray-300 mb-4">
            You haven't generated any personal access tokens yet.
          </p>
          <div>
            <button 
              onClick={onGenerateClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-[13px] font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={14} strokeWidth={2} />
              Generate token
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tokens.map(token => (
            <div key={token._id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">{token.name}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Last used: {token.lastUsed ? new Date(token.lastUsed).toLocaleDateString() : 'Never'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-medium px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                  Active
                </span>
                <button
                  onClick={() => onRevoke(token._id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                  title="Revoke Token"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
