import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command } from 'lucide-react';

const ShortcutCategory = ({ title, shortcuts }) => (
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">{title}</h3>
    <div className="space-y-2">
      {shortcuts.map((sc, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
          <span className="text-sm text-gray-600">{sc.action}</span>
          <div className="flex gap-1.5">
            {sc.keys.map((k, j) => (
              <kbd key={j} className="px-2 py-1 text-xs font-mono font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded shadow-sm whitespace-nowrap">
                {k}
              </kbd>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('escape-pressed', handleEsc);
    return () => window.removeEventListener('escape-pressed', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = [
    {
      title: "Global Navigation",
      shortcuts: [
        { action: "Go to Dashboard", keys: ["G", "Then", "D"] },
        { action: "Go to Profile", keys: ["G", "Then", "P"] },
        { action: "New Repository", keys: ["G", "Then", "N"] },
        { action: "Profile Settings", keys: ["G", "Then", "S"] },
        { action: "Repositories tab", keys: ["G", "Then", "R"] },
        { action: "Go to IDE / Codespace", keys: ["G", "Then", "I"] },
      ]
    },
    {
      title: "Search",
      shortcuts: [
        { action: "Focus search bar", keys: ["/"] },
        { action: "Focus search (VS Code style)", keys: ["Ctrl", "K"] },
        { action: "Focus search in 'your repos'", keys: ["@"] },
        { action: "Navigate search results", keys: ["↑", "↓"] },
        { action: "Open result", keys: ["Enter"] },
        { action: "Clear & close search", keys: ["Escape"] }
      ]
    },
    {
      title: "Repository Page",
      shortcuts: [
        { action: "Focus file tree filter", keys: ["T"] },
        { action: "Toggle left sidebar", keys: ["W"] },
        { action: "Switch to Code tab", keys: ["1"] },
        { action: "Switch to Pull Requests tab", keys: ["2"] },
        { action: "Switch to Commits tab", keys: ["3"] },
        { action: "Switch to Settings tab", keys: ["4"] },
        { action: "Focus branch selector", keys: ["B"] },
        { action: "Toggle Star", keys: ["S"] },
        { action: "Fork repository", keys: ["F"] },
        { action: "Copy clone URL", keys: ["C"] },
        { action: "Toggle Pin", keys: ["P"] },
        { action: "Download ZIP", keys: ["D"] },
        { action: "Open in IDE", keys: ["Ctrl", "."] },
      ]
    },
    {
      title: "File Viewer",
      shortcuts: [
        { action: "Close file", keys: ["Escape"] },
        { action: "Copy file permalink", keys: ["Y"] },
        { action: "Copy raw file content", keys: ["Ctrl", "C"] },
        { action: "Navigate to parent folder", keys: ["["] },
        { action: "Navigate into selected folder", keys: ["]"] }
      ]
    },
    {
      title: "Profile Page",
      shortcuts: [
        { action: "Open Edit Profile", keys: ["E"] },
        { action: "Switch to Overview", keys: ["1"] },
        { action: "Switch to Repositories", keys: ["2"] },
        { action: "Switch to Starred", keys: ["3"] },
        { action: "Switch to Tokens", keys: ["4"] }
      ]
    },
    {
      title: "IDE / Codespace",
      shortcuts: [
        { action: "Save current file", keys: ["Ctrl", "S"] },
        { action: "Toggle integrated terminal", keys: ["Ctrl", "`"] },
        { action: "Toggle file tree", keys: ["Ctrl", "B"] },
        { action: "Close active panel", keys: ["Escape"] }
      ]
    },
    {
      title: "Modals & Toasts",
      shortcuts: [
        { action: "Close modal / dropdown", keys: ["Escape"] },
        { action: "Confirm dialog / Submit", keys: ["Enter"] },
        { action: "Dismiss toast notification", keys: ["N"] }
      ]
    },
    {
      title: "UI / Misc",
      shortcuts: [
        { action: "Show keyboard shortcuts", keys: ["?"] },
        { action: "Open navigation sidebar", keys: ["Ctrl", "Shift", "S"] }
      ]
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                <Command size={18} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
              {categories.map((cat, i) => (
                <ShortcutCategory key={i} title={cat.title} shortcuts={cat.shortcuts} />
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
