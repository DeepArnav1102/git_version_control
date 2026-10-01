import { useEffect } from 'react';
import { isInputFocused } from '../utils/keyboardUtils';

/**
 * useIdeShortcuts
 * -------------------
 * Registers keyboard shortcuts for the IDE/Codespace page.
 */
export default function useIdeShortcuts(actions) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Escape to close active panel / modal
      if (key === 'escape') {
        // If an input is focused, blur it first
        if (isInputFocused()) {
           document.activeElement.blur();
        } else if (actions.onEscape) {
           actions.onEscape();
        }
        return;
      }

      if (isCtrlOrMeta) {
        if (key === 's') {
          e.preventDefault();
          actions.onSave?.();
        } else if (key === '`') {
          e.preventDefault();
          actions.onToggleTerminal?.();
        } else if (key === 'b') {
          e.preventDefault();
          actions.onToggleSidebar?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
