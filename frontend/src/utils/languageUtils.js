export const getLanguageColorHex = (language) => {
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
    'Jupyter Notebook': '#DA5B0B',
    HTML: '#e34c26',
    CSS: '#563d7c'
  };
  return colors[language] || '#ccc';
};

export const extensionToLanguage = {
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

export const calculateLanguages = (tree) => {
  if (!tree) return [];
  const counts = {};
  let total = 0;

  const traverse = (nodes) => {
    for (const node of nodes) {
      if (node.object_type === 'blob') {
        const ext = node.name.includes('.') ? node.name.substring(node.name.lastIndexOf('.')).toLowerCase() : '';
        const lang = extensionToLanguage[ext];
        if (lang && lang !== 'Markdown' && lang !== 'JSON') {
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
