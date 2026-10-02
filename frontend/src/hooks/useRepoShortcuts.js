import { useEffect } from 'react';
import { jsonToast } from '../lib/jsonToast';
import { isInputFocused } from '../utils/keyboardUtils';

/**
 * useRepoShortcuts
 * ----------------
 * Registers keyboard shortcuts for the repository page.
 * Skips firing if the user is typing in an input/textarea.
 */
export default function useRepoShortcuts(actions) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      const key = e.key.toLowerCase();

      // ── File Viewer Shortcuts (Escape works even if inputs are focused, to blur them)
      if (key === 'escape') {
        if (isInputFocused()) {
          document.activeElement.blur();
        } else if (actions.onCloseFile) {
          actions.onCloseFile();
        }
        return;
      }

      // ── Ctrl+C / Cmd+C for raw file copy (only if no text is selected)
      if ((e.ctrlKey || e.metaKey) && key === 'c' && !e.altKey && !e.shiftKey) {
        if (!isInputFocused() && window.getSelection().toString() === '') {
          if (actions.onCopyRawFileContent) {
            e.preventDefault();
            actions.onCopyRawFileContent();
            return;
          }
        }
      }

      // ── Ctrl+. / Cmd+. for Codespace
      if ((e.ctrlKey || e.metaKey) && key === '.') {
        if (actions.onOpenInCodespace) {
          e.preventDefault();
          actions.onOpenInCodespace();
          return;
        }
      }

      // Ignore other single-key shortcuts if user is typing
      if (isInputFocused()) return;

      if (!hasModifier) {
        switch (key) {
          case 't':
            e.preventDefault();
            actions.onFocusTreeFilter?.();
            break;
          case 'w':
            e.preventDefault();
            actions.onToggleSidebar?.();
            break;
          case '1':
            e.preventDefault();
            actions.onSwitchToCode?.();
            break;
          case '2':
            e.preventDefault();
            actions.onSwitchToCommits?.();
            break;
          case '3':
            e.preventDefault();
            actions.onSwitchToSettings?.();
            break;
          case 'b':
            e.preventDefault();
            actions.onFocusBranchSelector?.();
            break;
          case 's':
            e.preventDefault();
            actions.onToggleStar?.();
            break;
          case 'f':
            e.preventDefault();
            actions.onFork?.();
            break;
          case 'c':
            e.preventDefault();
            actions.onCopyCloneUrl?.();
            break;
          case 'p':
            e.preventDefault();
            actions.onTogglePin?.();
            break;
          case 'd':
            e.preventDefault();
            actions.onDownloadZip?.();
            break;
          case 'y':
            e.preventDefault();
            actions.onCopyFilePermalink?.();
            break;
          case '[':
            e.preventDefault();
            actions.onNavigateUp?.();
            break;
          case ']':
            e.preventDefault();
            actions.onNavigateInto?.();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
