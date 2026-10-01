/**
 * Checks if the user is currently focused on an input element.
 * Useful for disabling keyboard shortcuts when typing.
 */
export const isInputFocused = () => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const editable = document.activeElement?.isContentEditable;
  return tag === 'input' || tag === 'textarea' || tag === 'select' || editable;
};
