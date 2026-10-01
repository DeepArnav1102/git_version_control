import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { toast } from 'sonner';
import { isInputFocused } from '../utils/keyboardUtils';

/**
 * useGlobalShortcuts
 * ------------------
 * Registers global keyboard shortcuts for the app.
 * Sequential shortcuts (G → D, G → N …) use a 600ms window.
 * All shortcuts are disabled when focus is inside an input/textarea/select/contenteditable.
 */
export default function useGlobalShortcuts() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const pendingG = useRef(false);   // true while waiting for the second key after G
  const gTimer   = useRef(null);    // clears the G-sequence window

  useEffect(() => {
    const resetG = () => {
      pendingG.current = false;
      clearTimeout(gTimer.current);
    };

    const handleKeyDown = (e) => {
      // Never fire shortcuts when the user is typing
      if (isInputFocused()) return;

      // ── Sequential G → X shortcuts (MUST BE FIRST TO PREVENT COLLISIONS) ──
      if (pendingG.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        resetG();
        const username = user?.username;

        switch (e.key.toLowerCase()) {
          case 'd':
            navigate('/dashboard');
            break;
          case 'p':
            navigate(username ? `/u/${username}` : '/profile');
            break;
          case 'n':
            navigate('/new/repository');
            break;
          case 's':
            navigate('/profile?tab=settings');
            break;
          case 'r':
            navigate('/profile?tab=repositories');
            break;
          case 'i':
            navigate('/ide');
            break;
          default:
            break;
        }
        return;
      }

      // ── Ctrl+K / `/` → focus search bar ─────────────────────────
      if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
        e.preventDefault();
        document.querySelector('[data-search-input]')?.focus();
        resetG();
        return;
      }

      // ── Escape → blur search / close dropdowns / modals / toasts ────
      if (e.key === 'Escape') {
        document.activeElement?.blur();
        toast.dismiss(); // dismiss active toasts
        window.dispatchEvent(new CustomEvent('escape-pressed')); // close modals that listen
        resetG();
        return;
      }

      // ── Enter → Confirm dialog / Submit form ───────────────────────
      if (e.key === 'Enter') {
        const confirmBtn = document.querySelector('[data-toast-confirm="true"]');
        if (confirmBtn) {
          e.preventDefault();
          confirmBtn.click();
          return;
        }
      }

      // ── N → Dismiss active notification toast ───────────────────────
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toast.dismiss();
        return;
      }

      // ── ? → Open keyboard shortcuts help modal ───────────────────────
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-shortcuts-modal'));
        return;
      }

      // ── Ctrl + Shift + S → Open navigation sidebar ──────────────────
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-sidebar'));
        return;
      }

      // ── @ → focus search in "my repos" scope ─────────────────────
      if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('search:prefill', { detail: { value: '@', scope: 'me' } }));
        resetG();
        return;
      }

      // ── Start Sequential G → X shortcuts ────────────────────────────────
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        pendingG.current = true;
        // Auto-cancel if no second key within 600ms
        clearTimeout(gTimer.current);
        gTimer.current = setTimeout(resetG, 600);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(gTimer.current);
    };
  }, [navigate, user]);
}
