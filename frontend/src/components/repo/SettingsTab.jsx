import React from 'react';
import { motion } from 'framer-motion';

export default function SettingsTab({
  repoSettings,
  setRepoSettings,
  updatingSettings,
  handleUpdateRepo,
  repoData,
  otpSent,
  handleRequestDeleteOtp,
  deleting,
  deleteOtp,
  setDeleteOtp,
  handleDeleteRepo
}) {
  return (
    <motion.div
      key="tab-settings"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="mt-6 w-full space-y-6"
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">General Settings</h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleUpdateRepo} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Repository Name</label>
              <input
                type="text"
                value={repoSettings.name}
                onChange={(e) => setRepoSettings({ ...repoSettings, name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={repoSettings.description}
                onChange={(e) => setRepoSettings({ ...repoSettings, description: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={!repoSettings.isPrivate}
                  onChange={() => setRepoSettings({ ...repoSettings, isPrivate: false })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 font-medium">Public</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={repoSettings.isPrivate}
                  onChange={() => setRepoSettings({ ...repoSettings, isPrivate: true })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm text-gray-700 font-medium">Private</span>
              </label>
            </div>
            {repoData?.branches?.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default Branch</label>
                <select
                  value={repoSettings.defaultBranch}
                  onChange={(e) => setRepoSettings({ ...repoSettings, defaultBranch: e.target.value })}
                  className="w-full md:w-64 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                >
                  {repoData.branches.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="pt-4">
              <button
                type="submit"
                disabled={updatingSettings}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingSettings ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50">
          <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-gray-900 text-sm">Delete this repository</h4>
              <p className="text-[11px] text-gray-600 mt-1 max-w-xl">
                Once you delete a repository, there is no going back. Please be certain.
                This will permanently delete the repo, along with its commits, blob tree, and all git objects.
              </p>
            </div>
            {!otpSent ? (
              <button
                onClick={handleRequestDeleteOtp}
                disabled={deleting}
                className="px-3 py-1.5 bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
              >
                {deleting ? 'Requesting...' : 'Request Delete'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={deleteOtp}
                  onChange={(e) => setDeleteOtp(e.target.value)}
                  className="w-32 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-center tracking-widest"
                  maxLength={6}
                />
                <button
                  onClick={handleDeleteRepo}
                  disabled={deleting || deleteOtp.length !== 6}
                  className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                >
                  {deleting ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
