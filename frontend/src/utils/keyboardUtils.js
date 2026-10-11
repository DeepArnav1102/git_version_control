/**
 * Checks if the user is currently focused on an input element.
 * Useful for disabling keyboard shortcuts when typing.
 */
export const isInputFocused = () => {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName?.toLowerCase();
  const editable = active.isContentEditable;
  const isMonaco = !!active.closest?.('.monaco-editor') || active.classList?.contains('inputarea');
  const isTerminal = !!active.closest?.('.xterm') || active.classList?.contains('xterm-helper-textarea');
  return tag === 'input' || tag === 'textarea' || tag === 'select' || editable || isMonaco || isTerminal;
};
