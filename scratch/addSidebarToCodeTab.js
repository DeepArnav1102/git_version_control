const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/components/repo/CodeTab.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add imports
if (!content.includes('import { Link }')) {
  content = content.replace("import React from 'react';", "import React from 'react';\nimport { Link } from 'react-router-dom';");
}

if (!content.includes('Star, Eye, GitFork')) {
  content = content.replace(
    'ChevronRight, Check, Copy \n} from \'lucide-react\';',
    'ChevronRight, Check, Copy, Star, Eye, GitFork\n} from \'lucide-react\';'
  );
}

// Add getLanguageColorHex before component
if (!content.includes('getLanguageColorHex')) {
  const hexCode = `
const getLanguageColorHex = (language) => {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    'C++': '#f34b7d',
    'C#': '#178600',
    Ruby: '#701516',
    Go: '#00ADD8',
    Rust: '#dea584',
    'Jupyter Notebook': '#DA5B0B'
  };
  return colors[language] || '#ccc';
};
`;
  content = content.replace('export default function CodeTab', hexCode + '\nexport default function CodeTab');
}

// Add right sidebar UI
const sidebarUI = `
        {/* Right Sidebar */}
        {!currentPath && !activeFile && (
          <div className="hidden lg:flex w-[296px] flex-shrink-0 flex-col gap-6 pl-4 border-l border-gray-200">
            {/* About */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">About</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {repoData.description || <span className="italic text-gray-400">No description, website, or topics provided.</span>}
              </p>
              
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
                  <Star size={16} className="text-gray-400" />
                  <span className="font-medium">{repoData.starsCount || 0}</span> stars
                </div>
                <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
                  <Eye size={16} className="text-gray-400" />
                  <span className="font-medium">{repoData.watchersCount || 0}</span> watching
                </div>
                <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer transition-colors">
                  <GitFork size={16} className="text-gray-400" />
                  <span className="font-medium">{repoData.forksCount || 0}</span> forks
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-200" />

            {/* Contributors */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
                Contributors
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">1</span>
              </h3>
              <div className="flex items-center gap-2 group">
                <Link to={\`/\${repoData.owner?.username}\`}>
                  <img 
                    src={repoData.owner?.profilePicture || defaultPfp} 
                    alt={repoData.owner?.username}
                    className="w-8 h-8 rounded-full border border-gray-200 shadow-sm group-hover:ring-2 ring-blue-500/20 transition-all" 
                  />
                </Link>
                <div className="flex flex-col">
                  <Link to={\`/\${repoData.owner?.username}\`} className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                    {repoData.owner?.username}
                  </Link>
                  <span className="text-[11px] text-gray-500">{repoData.owner?.name}</span>
                </div>
              </div>
            </div>

            {repoData.language && (
              <>
                <div className="h-px bg-gray-200" />
                {/* Languages */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Languages</h3>
                  <div className="h-2 w-full rounded-full overflow-hidden flex bg-gray-100 mb-2">
                    <div className="h-full" style={{ width: '100%', backgroundColor: getLanguageColorHex(repoData.language) }} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getLanguageColorHex(repoData.language) }} />
                    {repoData.language} <span className="text-gray-400 font-normal">100%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
`;

// Replace the end of the file
// Currently ends with:
//         </div>
//       </div>
//     </div>
//   );
// }
const searchEnd = `        </div>
      </div>
    </div>
  );
}`;

const searchEndCRLF = searchEnd.replace(/\n/g, '\r\n');

if (content.includes(searchEnd)) {
  content = content.replace(searchEnd, '        </div>\n' + sidebarUI + '\n  );\n}');
} else if (content.includes(searchEndCRLF)) {
  content = content.replace(searchEndCRLF, '        </div>\r\n' + sidebarUI.replace(/\n/g, '\r\n') + '\r\n  );\r\n}');
} else {
  console.log("Could not find the end of the file!");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Success");
