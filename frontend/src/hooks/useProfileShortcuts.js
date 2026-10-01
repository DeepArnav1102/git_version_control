import { useEffect } from 'react';
import { isInputFocused } from '../utils/keyboardUtils';

/**
 * useProfileShortcuts
 * -------------------
 * Registers keyboard shortcuts for the profile page.
 * Skips firing if the user is typing in an input/textarea.
 */
export default function useProfileShortcuts(actions) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isInputFocused()) return;

      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      const key = e.key.toLowerCase();

      if (!hasModifier) {
        switch (key) {
          case 'e':
            e.preventDefault();
            actions.onEditProfile?.();
            break;
          case '1':
            e.preventDefault();
            actions.onSwitchToOverview?.();
            break;
          case '2':
            e.preventDefault();
            actions.onSwitchToRepositories?.();
            break;
          case '3':
            e.preventDefault();
            actions.onSwitchToStarred?.();
            break;
          case '4':
            e.preventDefault();
            actions.onSwitchToTokens?.();
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
