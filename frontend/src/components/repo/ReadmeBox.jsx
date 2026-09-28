import React, { useState, useEffect } from 'react';
import { BookMarked } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import 'github-markdown-css/github-markdown-light.css';
import apiClient from '../../lib/axios';

// Subcomponent to load and render README.md preview
export default function ReadmeBox({ owner, repo, entry }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReadme = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/repos/${owner}/${repo}/blob/${entry.object_hash}`);
        setContent(res.data.data.content);
      } catch (err) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadReadme();
  }, [owner, repo, entry]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700">
        <BookMarked size={14} />
        README.md
      </div>
      <div className="p-8 markdown-body" style={{ minHeight: '100px' }}>
        {loading ? (
          <span className="text-xs text-gray-400">Loading README...</span>
        ) : content ? (
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeRaw]}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <span className="text-xs text-gray-400">Empty README</span>
        )}
      </div>
    </div>
  );
}
