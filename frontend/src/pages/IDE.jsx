import React, { useState, useRef, useEffect } from 'react';
import Editor from '../components/ide/Editor';
import Terminal from '../components/ide/Terminal';
import FileTree from '../components/ide/FileTree';
import { Play, TerminalSquare, FolderGit2, PanelLeft, PanelBottom } from 'lucide-react';
import axios from 'axios';

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import useIdeShortcuts from '../hooks/useIdeShortcuts';

export default function IDE() {
  const [fileTree, setFileTree] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  
  // Maps filePath -> content string
  const [fileContents, setFileContents] = useState({});
  const [unsavedChanges, setUnsavedChanges] = useState({});

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('output'); // 'output' or 'terminal'
  
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);

  const editorRef = useRef(null);
  const myTerminalRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);

  const fetchTree = async () => {
    try {
      const res = await axios.get('/api/v1/ide/files');
      setFileTree(res.data.tree || []);
    } catch (err) {
      console.error('Failed to fetch file tree:', err);
    }
  };

  useEffect(() => {
    fetchTree();

    // Auto-refresh file tree when window regains focus 
    const handleFocus = () => fetchTree();
    window.addEventListener('focus', handleFocus);
    
    // Poll the backend every 3 seconds to catch files created in the terminal instantly
    const intervalId = setInterval(() => fetchTree(), 3000);
    
    return () => {
        window.removeEventListener('focus', handleFocus);
        clearInterval(intervalId);
    };
  }, []);

  const handleFileClick = async (filePath) => {
    if (!fileContents[filePath]) {
      try {
        const res = await axios.get(`/api/v1/ide/files/content?path=${encodeURIComponent(filePath)}`);
        setFileContents(prev => ({ ...prev, [filePath]: res.data.content }));
      } catch (err) {
        console.error('Failed to read file:', err);
        return;
      }
    }
    setActiveFile(filePath);
  };

  const handleCreateFile = async (name) => {
    try {
      await axios.post('/api/v1/ide/files', { path: name, type: 'file' });
      await fetchTree();
      handleFileClick(name); 
    } catch (err) {
      console.error('Create file failed:', err);
    }
  };

  const handleCreateFolder = async (name) => {
    try {
      await axios.post('/api/v1/ide/files', { path: name, type: 'folder' });
      await fetchTree();
    } catch (err) {
      console.error('Create folder failed:', err);
    }
  };

  const handleDelete = async (filePath) => {
    try {
      await axios.delete('/api/v1/ide/files', { data: { path: filePath } });
      await fetchTree();
      if (activeFile === filePath) setActiveFile(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleEditorChange = (newCode) => {
    if (!activeFile) return;
    setFileContents(prev => ({ ...prev, [activeFile]: newCode }));
    setUnsavedChanges(prev => ({ ...prev, [activeFile]: true }));

    // Auto-save debounce (1000ms)
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    
    const fileToSave = activeFile;
    autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await axios.put('/api/v1/ide/files/content', { path: fileToSave, content: newCode });
          setUnsavedChanges(prev => ({ ...prev, [fileToSave]: false }));
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
    }, 1000);
  };

  const saveCurrentFile = async () => {
    if (!activeFile) return;
    const currentCode = editorRef.current ? editorRef.current.getValue() : fileContents[activeFile];
    
    try {
      await axios.put('/api/v1/ide/files/content', { path: activeFile, content: currentCode });
      setUnsavedChanges(prev => ({ ...prev, [activeFile]: false }));
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleRunCode = async () => {
    if (!activeFile) {
        setOutput('Please select or create a Python file to run.');
        return;
    }

    await saveCurrentFile();

    // Check if it's a python file. If so, run it in the interactive terminal so input() works!
    if (activeFile.endsWith('.py')) {
        setActiveTab('terminal');
        if (myTerminalRef.current) {
            // Use absolute path /workspace/ to ensure it works even if the user cd'd into another directory
            myTerminalRef.current.executeCommand(`python3 "/workspace/${activeFile}"`);
        } else {
            setOutput('Terminal is not mounted. Please click the Terminal tab and try again.');
        }
        return;
    }

    // Fallback for non-python files (or standard execution)
    setIsRunning(true);
    setOutput(`Running ${activeFile}...\n`);
    setActiveTab('output');
    try {
      const response = await axios.post('/api/v1/ide/run', { filePath: activeFile });
      const { stdout, stderr, exitCode, timedOut } = response.data;
      
      let resText = '';
      if (timedOut) resText += '[Error: Execution Timed Out]\n';
      if (stdout) resText += stdout + '\n';
      if (stderr) resText += stderr + '\n';
      resText += `\n[Exited with code ${exitCode}]`;
      setOutput(resText);
    } catch (error) {
      setOutput(`Error executing code:\n${error.response?.data?.error || error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useIdeShortcuts({
    onSave: () => saveCurrentFile(),
    onToggleTerminal: () => setShowTerminal(prev => !prev),
    onToggleSidebar: () => setShowSidebar(prev => !prev),
    onEscape: () => {
       if (activeFile) setActiveFile(null);
    }
  });

  return (
    <div className="flex h-screen w-full flex-col bg-white text-gray-800 font-sans overflow-hidden">
      {/* Top Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-[#f8f9fa] px-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
            <FolderGit2 className="text-blue-600" size={20} />
            <h1 className="text-sm font-semibold text-gray-700">Codespaces IDE</h1>
        </div>
        <div className="flex items-center gap-2 mr-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded transition-colors ${showSidebar ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Toggle Sidebar"
          >
            <PanelLeft size={18} />
          </button>

          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`p-1.5 rounded transition-colors ${showTerminal ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Toggle Bottom Panel"
          >
            <PanelBottom size={18} />
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          
          <button
            onClick={handleRunCode}
            disabled={isRunning || !activeFile}
            title="Run File"
            className={`flex items-center justify-center rounded p-1.5 text-green-600 transition-colors hover:bg-green-100 ${isRunning || !activeFile ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Play size={20} fill="currentColor" className={isRunning ? "animate-pulse" : ""} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden h-full">
        
        {/* Activity Bar (Far Left) */}
        <div className="w-12 shrink-0 bg-[#f8f9fa] border-r border-gray-200 flex flex-col items-center py-4 gap-4">
            <div className="p-2 bg-gray-200 rounded cursor-pointer text-gray-700">
                <FolderGit2 size={24} />
            </div>
        </div>

        {/* Resizable Layout */}
        <PanelGroup direction="horizontal" className="flex flex-row flex-1 w-full h-full">
          {/* Sidebar Panel */}
          {showSidebar && (
            <>
              <Panel defaultSize={20} minSize={10} maxSize={40} className="border-r border-gray-200 bg-[#f8f9fa] flex flex-col">
                <FileTree 
                  tree={fileTree} 
                  onFileClick={handleFileClick} 
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onDeleteClick={handleDelete}
                  onRefresh={fetchTree}
                />
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize transition-colors shrink-0" />
            </>
          )}

          {/* Center Pane (Editor + Terminal) */}
          <Panel defaultSize={80} className="flex flex-col">
            <PanelGroup direction="vertical" className="flex flex-col w-full h-full">
              {/* Top: Editor */}
              <Panel defaultSize={65} minSize={20} className="flex flex-col bg-white">
                <div className="flex shrink-0 h-10 border-b border-gray-200 bg-[#f8f9fa]">
                    {activeFile ? (
                        <div className="flex items-center gap-2 border-t-2 border-t-blue-500 bg-white px-4 py-2 text-sm text-gray-800 border-r border-gray-200 min-w-[120px]">
                            {activeFile} {unsavedChanges[activeFile] && <span className="w-2 h-2 rounded-full bg-blue-500 ml-2"></span>}
                        </div>
                    ) : (
                        <div className="flex items-center px-4 text-sm text-gray-400 italic">No file selected</div>
                    )}
                </div>
                <div className="flex-1 relative h-full">
                    {activeFile ? (
                        <Editor 
                            code={fileContents[activeFile] || ''} 
                            onChange={handleEditorChange} 
                            onRun={handleRunCode} 
                            editorRef={editorRef} 
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            Select or create a file in the explorer to start coding.
                        </div>
                    )}
                </div>
              </Panel>

              {/* Bottom: Terminal */}
              {showTerminal && (
                <>
                  <PanelResizeHandle className="h-1 bg-gray-200 hover:bg-blue-500 cursor-row-resize transition-colors" />
                  <Panel defaultSize={35} minSize={10} className="flex flex-col bg-white">
                    <div className="flex shrink-0 h-10 border-b border-gray-200 bg-[#f8f9fa]">
                        <button
                        onClick={() => setActiveTab('output')}
                        className={`flex items-center gap-2 border-b-2 px-4 text-sm font-medium ${activeTab === 'output' ? 'border-blue-500 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                        Output
                        </button>
                        <button
                        onClick={() => setActiveTab('terminal')}
                        className={`flex items-center gap-2 border-b-2 px-4 text-sm font-medium ${activeTab === 'terminal' ? 'border-blue-500 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                        <TerminalSquare size={16} />
                        Terminal
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto bg-white h-full relative">
                        <pre className={`p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap absolute inset-0 ${activeTab === 'output' ? 'block' : 'hidden'}`}>
                            {output}
                        </pre>
                        <div className={`absolute inset-0 ${activeTab === 'terminal' ? 'block' : 'hidden'}`}>
                            <Terminal wsUrl="/ws/terminal" ref={myTerminalRef} />
                        </div>
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
