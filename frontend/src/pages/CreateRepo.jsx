import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookMarked, Globe, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';
import useAuthStore from '../store/useAuthStore';

export default function CreateRepo() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      jsonToast.error('Please enter a repository name');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/repos', {
        name: name.trim(),
        description: description.trim(),
        isPrivate,
      });

      const repo = res.data.data;
      const ownerHandle = user?.username || user?.email?.split('@')[0] || 'user';
      jsonToast.success('Repository created successfully!');
      navigate(`/repo/${ownerHandle}/${repo.name}`);
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  };

  const ownerName = user?.username || user?.email?.split('@')[0] || 'user';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 font-sans">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="border-b border-gray-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookMarked className="text-gray-700" size={24} />
          Create a new repository
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          A repository contains all project files, including the revision history and commits pushed from Rusty CLI.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Owner / Repo Name */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Owner</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800">
              <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs">
                {ownerName[0]?.toUpperCase()}
              </span>
              <span>{ownerName}</span>
            </div>
          </div>

          <span className="text-gray-400 text-xl font-light sm:mt-5">/</span>

          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Repository name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., rusty-backend"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="Short description of this project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        <div className="h-px bg-gray-200" />

        {/* Visibility */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-700 uppercase">Visibility</label>

          <label
            onClick={() => setIsPrivate(false)}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              !isPrivate ? 'border-black bg-gray-50/80 shadow-sm' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="visibility"
              checked={!isPrivate}
              onChange={() => setIsPrivate(false)}
              className="mt-0.5 text-black focus:ring-black"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-900">
                <Globe size={15} className="text-gray-600" />
                Public
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Anyone on the internet can view this repository. You choose who can commit.
              </p>
            </div>
          </label>

          <label
            onClick={() => setIsPrivate(true)}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              isPrivate ? 'border-black bg-gray-50/80 shadow-sm' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="visibility"
              checked={isPrivate}
              onChange={() => setIsPrivate(true)}
              className="mt-0.5 text-black focus:ring-black"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-900">
                <Lock size={15} className="text-gray-600" />
                Private
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Only you and people you grant access to can view and commit to this repository.
              </p>
            </div>
          </label>
        </div>

        <div className="h-px bg-gray-200" />

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2ea043] hover:bg-[#2c974b] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Create repository
          </button>
        </div>
      </form>
    </div>
  );
}
