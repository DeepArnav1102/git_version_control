const fs = require('fs');
const path = require('path');

const overviewPath = path.join(__dirname, '../frontend/src/components/profile/ProfileOverview.jsx');
let content = fs.readFileSync(overviewPath, 'utf8');

// 1. Remove the modal at the bottom
const modalRegex = /\{?isPinModalOpen\s*\&\&\s*\(\s*<div className="fixed inset-0[^]*?<\/motion\.div>\s*<\/div>\s*\)\s*\}?/g;
content = content.replace(modalRegex, '');

// 2. Remove AnimatePresence wrap around the modal if it exists at the bottom
const animatePresenceModalRegex = /<AnimatePresence>[\s\n\r]*<\/AnimatePresence>/g;
content = content.replace(animatePresenceModalRegex, '');
// There's an AnimatePresence wrap in the file specifically for modal. 
// We can just use string replacement for the bottom part.

// More robust way for the bottom modal:
const bottomModalStart = '{/* ── PIN REPOSITORIES MODAL ── */}';
const bottomModalIndex = content.indexOf(bottomModalStart);
if (bottomModalIndex !== -1) {
    const bottomModalEndIndex = content.indexOf('</AnimatePresence>', bottomModalIndex);
    if (bottomModalEndIndex !== -1) {
        content = content.substring(0, bottomModalIndex) + content.substring(bottomModalEndIndex + '</AnimatePresence>'.length);
    }
}

// 3. Replace the pins section
const pinsSectionStart = '<div className="flex items-center justify-between mb-4">';
const heatmapSectionStart = '{/* ── CONTRIBUTIONS HEATMAP ── */}';

const beforePins = content.substring(0, content.indexOf(pinsSectionStart));
const afterPins = content.substring(content.indexOf(heatmapSectionStart));

const newPinsSection = `<div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-800 font-semibold">Pinned</h2>
          {isOwner && !isPinModalOpen && (
            <button
              onClick={openPinModal}
              className="text-xs text-gray-500 hover:text-blue-600 transition-colors cursor-pointer font-medium"
            >
              Customize your pins
            </button>
          )}
        </div>

        {isPinModalOpen ? (
          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Edit Pinned Repositories</h3>
              <div className="text-xs text-gray-500">{selectedPins.length}/6 pinned</div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 mb-4 scrollbar-thin">
              {loadingRepos ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
              ) : allRepos.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No repositories available to pin.</p>
              ) : (
                allRepos.map(repo => (
                  <label key={repo._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-gray-100 hover:border-gray-200 shadow-sm">
                    <input
                      type="checkbox"
                      checked={selectedPins.includes(repo._id)}
                      onChange={() => togglePin(repo._id)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-800 truncate">{repo.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-500 text-[10px] font-semibold">
                          {repo.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{repo.description}</p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button 
                onClick={() => setIsPinModalOpen(false)} 
                className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={savePins} 
                disabled={savingPins}
                className="px-4 py-1.5 text-xs font-semibold bg-[#2ea043] text-white hover:bg-[#2c974b] rounded-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingPins ? 'Saving...' : 'Save Pins'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user?.pinnedRepos?.map((repo) => (
              <div key={repo._id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Book size={16} className="text-gray-400" />
                    <Link to={\`/\${repo.owner?.username || user.username}/\${repo.name}\`} className="font-semibold text-blue-600 hover:underline text-sm">
                      {repo.name}
                    </Link>
                    <span className="px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 text-[10px] font-semibold">
                      {repo.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                    {repo.description || 'No description provided.'}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                  {repo.language && (
                    <div className="flex items-center gap-1.5">
                      <span className={\`w-2.5 h-2.5 rounded-full \${getLanguageColor(repo.language)}\`} />
                      {repo.language}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {(!user?.pinnedRepos || user.pinnedRepos.length === 0) && (
              <div className="col-span-1 md:col-span-2 py-10 border border-gray-200 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                <Book size={24} className="mb-2 text-gray-400" />
                <p className="text-sm font-medium">No pinned repositories yet.</p>
                {isOwner && (
                  <button
                    onClick={openPinModal}
                    className="mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Pin repositories
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      `;

content = beforePins + newPinsSection + afterPins;

fs.writeFileSync(overviewPath, content, 'utf8');
console.log("Success refactoring pins UI");
