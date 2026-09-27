const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/components/repo/CodeTab.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const calcFunction = `
const extensionToLanguage = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.java': 'Java',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.c': 'C',
  '.h': 'C',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.html': 'HTML',
  '.css': 'CSS',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.ipynb': 'Jupyter Notebook'
};

const calculateLanguages = (tree) => {
  if (!tree) return [];
  const counts = {};
  let total = 0;

  const traverse = (nodes) => {
    for (const node of nodes) {
      if (node.object_type === 'blob') {
        const ext = node.name.includes('.') ? node.name.substring(node.name.lastIndexOf('.')).toLowerCase() : '';
        const lang = extensionToLanguage[ext];
        if (lang && lang !== 'Markdown' && lang !== 'JSON') { // Optional: ignore some generic formats like github does
          counts[lang] = (counts[lang] || 0) + 1;
          total += 1;
        }
      } else if (node.object_type === 'tree' && node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(tree);

  if (total === 0) return [];
  
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      percentage: ((count / total) * 100).toFixed(1)
    }))
    .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
};
`;

if (!content.includes('calculateLanguages')) {
    content = content.replace('export default function CodeTab', calcFunction + '\nexport default function CodeTab');
}

// Add HTML and CSS colors if not exist
if (!content.includes("HTML: '#e34c26'")) {
    content = content.replace(
        "    'Jupyter Notebook': '#DA5B0B'",
        "    'Jupyter Notebook': '#DA5B0B',\n    HTML: '#e34c26',\n    CSS: '#563d7c'"
    );
}

const oldLanguagesBlock = `{repoData.language && (
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
            )}`;

const newLanguagesBlock = `{(() => {
              const langs = calculateLanguages(rootTree);
              if (langs.length === 0) return null;
              
              return (
                <>
                  <div className="h-px bg-gray-200" />
                  {/* Languages */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Languages</h3>
                    <div className="h-2 w-full rounded-full overflow-hidden flex mb-2">
                      {langs.map(l => (
                        <div key={l.name} style={{ width: \`\${l.percentage}%\`, backgroundColor: getLanguageColorHex(l.name) }} title={\`\${l.name} \${l.percentage}%\`} />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                      {langs.map(l => (
                        <div key={l.name} className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getLanguageColorHex(l.name) }} />
                          {l.name} <span className="text-gray-400 font-normal">{l.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}`;

const replaceBlock = (str, oldB, newB) => {
    let result = str;
    if (result.includes(oldB)) {
        return result.replace(oldB, newB);
    }
    const oldBCRLF = oldB.replace(/\n/g, '\r\n');
    if (result.includes(oldBCRLF)) {
        return result.replace(oldBCRLF, newB.replace(/\n/g, '\r\n'));
    }
    return result;
}

content = replaceBlock(content, oldLanguagesBlock, newLanguagesBlock);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Success');
