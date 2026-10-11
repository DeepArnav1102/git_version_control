import { useEffect, useRef } from 'react';
import { isInputFocused } from '../utils/keyboardUtils';

/**
 * useIdeShortcuts
 * -------------------
 * Registers keyboard shortcuts for the IDE/Codespace page at the window level.
 */
export default function useIdeShortcuts(actions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Escape to close active modal / panel
      if (key === 'escape') {
        if (isInputFocused()) {
          document.activeElement.blur();
        }
        actionsRef.current.onEscape?.();
        return;
      }

      // F1 or Ctrl+/ for shortcuts help modal (protects ? from ever being blocked while typing)
      if (key === 'f1' || ((key === '?' || key === '/') && isCtrlOrMeta)) {
        e.preventDefault();
        actionsRef.current.onOpenShortcuts?.();
        return;
      }

      // F5 to run code
      if (key === 'f5') {
        e.preventDefault();
        actionsRef.current.onRun?.();
        return;
      }

      if (isCtrlOrMeta) {
        // Ctrl + S -> Save
        if (key === 's' && !e.shiftKey) {
          e.preventDefault();
          actionsRef.current.onSave?.();
        }
        // Ctrl + Enter -> Run code
        else if (key === 'enter') {
          e.preventDefault();
          actionsRef.current.onRun?.();
        }
        // Ctrl + ` OR Ctrl + \ OR Ctrl + J -> Toggle integrated terminal
        else if (key === '`' || key === '\\' || key === 'j') {
          e.preventDefault();
          actionsRef.current.onToggleTerminal?.();
        }
        // Ctrl + B -> Toggle sidebar file tree
        else if (key === 'b') {
          e.preventDefault();
          actionsRef.current.onToggleSidebar?.();
        }
        // Ctrl + Shift + P -> Push Changes modal
        else if (key === 'p' && e.shiftKey) {
          e.preventDefault();
          actionsRef.current.onPush?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
