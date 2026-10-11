import React, { useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';

/**
 * Monaco Editor wrapper for Python code editing.
 * Exposes an `editorRef` to allow the parent to read the live editor value
 * at any time without relying on potentially-stale React state.
 *
 * @param {Object} props
 * @param {string} props.code - The controlled code value.
 * @param {Function} props.onChange - Called when the editor content changes.
 * @param {Function} props.onRun - Called when Ctrl+Enter is pressed.
 * @param {React.MutableRefObject} props.editorRef - Ref to expose the Monaco editor instance.
 */
export default function Editor({ 
  code, 
  onChange, 
  onRun, 
  onSave, 
  onToggleTerminal, 
  onToggleSidebar, 
  onPush, 
  onOpenShortcuts, 
  editorRef 
}) {
  const callbacksRef = useRef({});
  callbacksRef.current = {
    onRun,
    onSave,
    onToggleTerminal,
    onToggleSidebar,
    onPush,
    onOpenShortcuts,
  };

  const handleEditorDidMount = (editor, monaco) => {
    // Store the editor instance so the parent can call editor.getValue() directly
    if (editorRef) editorRef.current = editor;

    // Ctrl + S / Cmd + S -> Save current file
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      callbacksRef.current.onSave?.();
    });

    // Ctrl + Enter / Cmd + Enter -> Run Python code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      callbacksRef.current.onRun?.();
    });

    // F5 -> Run Python code
    editor.addCommand(monaco.KeyCode.F5, () => {
      callbacksRef.current.onRun?.();
    });

    // Ctrl + ` / Cmd + ` -> Toggle integrated terminal
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => {
      callbacksRef.current.onToggleTerminal?.();
    });

    // Ctrl + \ / Cmd + \ -> Toggle integrated terminal
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
      callbacksRef.current.onToggleTerminal?.();
    });

    // Ctrl + J / Cmd + J -> Toggle integrated terminal (VS Code style)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      callbacksRef.current.onToggleTerminal?.();
    });

    // Ctrl + B / Cmd + B -> Toggle sidebar file tree
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      callbacksRef.current.onToggleSidebar?.();
    });

    // Ctrl + Shift + P / Cmd + Shift + P -> Push Changes modal
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      callbacksRef.current.onPush?.();
    });
  };

  return (
    <MonacoEditor
      height="100%"
      language="python"
      theme="vs-light"
      value={code}
      onChange={onChange}
      onMount={handleEditorDidMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: 'on',
      }}
    />
  );
}
