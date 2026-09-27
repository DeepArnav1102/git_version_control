import React from 'react';
import { Monitor, UserPlus, Copy } from 'lucide-react';

export default function EmptyRepoView({ repoData, remoteUrl, copyToClipboard }) {
  return (
    <div className="mt-6 space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Codespaces */}
        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:border-gray-300 transition-colors">
          <Monitor size={24} strokeWidth={1.5} className="text-gray-600 mb-4" />
          <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Start coding with Codespaces</h3>
          <p className="text-xs text-gray-500 mb-4 h-8">
            Add a README file and start coding in a secure, configurable, and dedicated development environment.
          </p>
          <button className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 transition-colors cursor-pointer">
            Create a codespace
          </button>
        </div>

        {/* Card 2: Collaborators */}
        <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:border-gray-300 transition-colors">
          <UserPlus size={24} strokeWidth={1.5} className="text-gray-600 mb-4" />
          <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Add collaborators to this repository</h3>
          <p className="text-xs text-gray-500 mb-4 h-8">
            Search for people using their GitHub username or email address.
          </p>
          <button className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 transition-colors cursor-pointer">
            Invite collaborators
          </button>
        </div>
      </div>

      {/* Command Line Instructions */}
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-900 text-[15px] mb-2">
            ...or create a new repository on the command line
          </h3>
          <div className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <pre className="p-4 text-gray-800 font-mono text-[13px] leading-relaxed overflow-x-auto">
              <div>echo "# {repoData.name}" &gt;&gt; README.md</div>
              <div>rusty init</div>
              <div>rusty add README.md</div>
              <div>rusty commit -m "first commit"</div>
              <div>rusty branch -M main</div>
              <div>rusty remote add origin {remoteUrl}</div>
              <div>rusty push -u origin main</div>
            </pre>
            <button
              onClick={() =>
                copyToClipboard(
                  `echo "# ${repoData.name}" >> README.md\nrusty init\nrusty add README.md\nrusty commit -m "first commit"\nrusty branch -M main\nrusty remote add origin ${remoteUrl}\nrusty push -u origin main`
                )
              }
              className="absolute top-2 right-2 p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm opacity-0 group-hover:opacity-100"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 text-[15px] mb-2">
            ...or push an existing repository from the command line
          </h3>
          <div className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <pre className="p-4 text-gray-800 font-mono text-[13px] leading-relaxed overflow-x-auto">
              <div>rusty remote add origin {remoteUrl}</div>
              <div>rusty branch -M main</div>
              <div>rusty push -u origin main</div>
            </pre>
            <button
              onClick={() =>
                copyToClipboard(`rusty remote add origin ${remoteUrl}\nrusty branch -M main\nrusty push -u origin main`)
              }
              className="absolute top-2 right-2 p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm opacity-0 group-hover:opacity-100"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
