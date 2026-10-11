import React, { useState, useRef, useEffect } from 'react';
import Editor from '../components/ide/Editor';
import Terminal from '../components/ide/Terminal';
import FileTree from '../components/ide/FileTree';
import { 
  Play, 
  TerminalSquare, 
  FolderGit2, 
  PanelLeft, 
  PanelBottom, 
  UploadCloud, 
  GitFork, 
  Download, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Check, 
  X, 
  LogOut, 
  AlertTriangle,
  Keyboard
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../lib/axios';
import useAuthStore from '../store/useAuthStore';
import { toast } from 'sonner';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import useIdeShortcuts from '../hooks/useIdeShortcuts';

export default function IDE() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const targetOwner = searchParams.get('owner');
  const targetRepo = searchParams.get('repo');
  const targetType = searchParams.get('type');
  const targetHash = searchParams.get('hash');
  const targetFilename = searchParams.get('filename');

  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState(
    Boolean((targetOwner && targetRepo) || (targetType === 'file' && targetHash))
  );
  const [initStatusText, setInitStatusText] = useState(
    targetOwner && targetRepo 
      ? `Setting up environment for ${targetOwner}/${targetRepo}...`
      : 'Setting up workspace...'
  );

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

  // Codespace Repo Metadata & Push Permissions
  const [repoInfo, setRepoInfo] = useState(null);
  const [hasUnpushedChanges, setHasUnpushedChanges] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showCloseWarningModal, setShowCloseWarningModal] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Update from Codespace');
  const [isPushing, setIsPushing] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  const editorRef = useRef(null);
  const myTerminalRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const hasInitializedRef = useRef(false);

  const fetchCodespaceInfo = async () => {
    try {
      const res = await apiClient.get('/ide/codespace-info');
      if (res.data?.repo) {
        setRepoInfo(res.data.repo);
      }
    } catch (err) {
      console.warn('Could not fetch codespace repo info:', err);
    }
  };

  const fetchTree = async () => {
    try {
      const res = await apiClient.get('/ide/files');
      setFileTree(res.data.tree || []);
    } catch (err) {
      console.error('Failed to fetch file tree:', err);
    }
  };

  useEffect(() => {
    const initAndLoad = async () => {
      if (!hasInitializedRef.current && ((targetOwner && targetRepo) || (targetType === 'file' && targetHash))) {
        hasInitializedRef.current = true;
        setIsInitializingWorkspace(true);
        setInitStatusText(
          targetOwner && targetRepo 
            ? `Cloning ${targetOwner}/${targetRepo} and restoring Python packages...`
            : `Loading ${targetFilename || 'file'} into Codespace...`
        );
        try {
          if (targetType === 'file') {
            await apiClient.post('/ide/load-codespace', {
              type: 'file',
              hash: targetHash,
              filename: targetFilename
            });
          } else {
            await apiClient.post('/ide/load-codespace', {
              type: 'repo',
              owner: targetOwner,
              repo: targetRepo
            });
          }
        } catch (err) {
          console.error('Failed to initialize codespace:', err);
          toast.error(err?.response?.data?.error || 'Failed to initialize Codespace');
        } finally {
          setIsInitializingWorkspace(false);
          await fetchTree();
          await fetchCodespaceInfo();
        }
      } else {
        await fetchTree();
        await fetchCodespaceInfo();
      }
    };

    initAndLoad();

    // Auto-refresh file tree when window regains focus 
    const handleFocus = () => {
      fetchTree();
      fetchCodespaceInfo();
    };
    window.addEventListener('focus', handleFocus);
    
    // Poll the backend every 3 seconds to catch files created in the terminal instantly
    const intervalId = setInterval(() => fetchTree(), 3000);

    // Browser beforeunload prompt if unpushed changes exist
    const handleBeforeUnload = (e) => {
      if (hasUnpushedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unpushed changes. Are you sure you want to exit?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clean up codespace workspace from disk when the tab is closed or navigated away
    const handlePageHide = () => {
      const wsId = user?._id;
      const url = `/api/v1/ide/close-codespace${wsId ? `?workspaceId=${encodeURIComponent(wsId)}` : ''}`;
      try {
        fetch(url, {
          method: 'POST',
          keepalive: true,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: wsId, reason: 'tab_closed' })
        });
      } catch (_) {
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon(url);
          }
        } catch (_) {}
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('pagehide', handlePageHide);
        clearInterval(intervalId);
    };
  }, [hasUnpushedChanges, targetOwner, targetRepo, targetType, targetHash, targetFilename, user?._id]);

  const handleFileClick = async (filePath) => {
    if (!fileContents[filePath]) {
      try {
        const res = await apiClient.get(`/ide/files/content?path=${encodeURIComponent(filePath)}`);
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
      await apiClient.post('/ide/files', { path: name, type: 'file' });
      setHasUnpushedChanges(true);
      await fetchTree();
      handleFileClick(name); 
    } catch (err) {
      console.error('Create file failed:', err);
      toast.error('Failed to create file');
    }
  };

  const handleCreateFolder = async (name) => {
    try {
      await apiClient.post('/ide/files', { path: name, type: 'folder' });
      setHasUnpushedChanges(true);
      await fetchTree();
    } catch (err) {
      console.error('Create folder failed:', err);
      toast.error('Failed to create folder');
    }
  };

  const handleDelete = async (filePath) => {
    try {
      await apiClient.delete('/ide/files', { data: { path: filePath } });
      setHasUnpushedChanges(true);
      await fetchTree();
      if (activeFile === filePath) setActiveFile(null);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete file');
    }
  };

  const handleEditorChange = (newCode) => {
    if (!activeFile) return;
    setFileContents(prev => ({ ...prev, [activeFile]: newCode }));
    setUnsavedChanges(prev => ({ ...prev, [activeFile]: true }));
    setHasUnpushedChanges(true);

    // Auto-save debounce (1000ms)
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    
    const fileToSave = activeFile;
    autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await apiClient.put('/ide/files/content', { path: fileToSave, content: newCode });
          setUnsavedChanges(prev => ({ ...prev, [fileToSave]: false }));
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
    }, 1000);
  };

  const saveCurrentFile = async (notify = false) => {
    if (!activeFile) return;
    const currentCode = editorRef.current ? editorRef.current.getValue() : fileContents[activeFile];
    
    try {
      await apiClient.put('/ide/files/content', { path: activeFile, content: currentCode });
      setUnsavedChanges(prev => ({ ...prev, [activeFile]: false }));
      if (notify) {
        toast.success(`Saved ${activeFile}`);
      }
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save file');
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
      const response = await apiClient.post('/ide/run', { filePath: activeFile });
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

  // Push Changes Handler (Rule 1 & Rule 2)
  const handlePushToRepo = async () => {
    if (!repoInfo?.canPush) {
      toast.error('You do not have permission to push to this repository. You must be an approved contributor or fork owner.');
      return;
    }

    try {
      setIsPushing(true);
      await saveCurrentFile();
      const res = await apiClient.post('/ide/push-codespace', {
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        commitMessage: commitMessage.trim() || 'Update from Codespace'
      });
      toast.success(res.data.message || 'Successfully pushed changes!');
      setHasUnpushedChanges(false);
      setShowPushModal(false);
      setCommitMessage('Update from Codespace');
      fetchCodespaceInfo();
    } catch (err) {
      console.error('Push failed:', err);
      toast.error(err.response?.data?.error || 'Failed to push changes');
    } finally {
      setIsPushing(false);
    }
  };

  // Fork Repository Handler
  const handleForkRepo = async () => {
    if (!repoInfo?.owner || !repoInfo?.repo) return;
    try {
      setIsForking(true);
      const res = await apiClient.post(`/repos/${repoInfo.owner}/${repoInfo.repo}/fork`);
      toast.success('Repository forked successfully! Loading your fork in Codespace...');
      
      // Load the new fork into codespace
      const myUsername = user?.username || res.data.data.owner?.username;
      await apiClient.post('/ide/load-codespace', {
        type: 'repo',
        owner: myUsername,
        repo: repoInfo.repo
      });

      await fetchTree();
      await fetchCodespaceInfo();
      setHasUnpushedChanges(false);
      toast.success('Your forked repository is now active and writable!');
    } catch (err) {
      console.error('Fork failed:', err);
      toast.error(err.response?.data?.message || 'Failed to fork repository');
    } finally {
      setIsForking(false);
    }
  };

  // Download Executable from Cloudflare R2
  const handleDownloadExe = async () => {
    try {
      const res = await apiClient.get('/ide/download-exe?platform=windows');
      const targetUrl = res.data.downloadUrl || res.data.publicUrl;
      if (targetUrl) {
        window.open(targetUrl, '_blank');
        toast.success('Downloading rusty.exe from Cloudflare R2...');
      } else {
        toast.error('Binary download URL unavailable');
      }
    } catch (err) {
      console.error('Failed to get download URL:', err);
      toast.error('Failed to download rusty.exe');
    }
  };

  // Execute Close & Clean Workspace from Disk
  const executeCloseAndCleanup = async () => {
    try {
      setIsClosing(true);
      await apiClient.post('/ide/close-codespace');
      toast.success('Codespace closed and workspace data cleaned from disk.');
      
      // Navigate to repository page or dashboard
      if (repoInfo?.owner && repoInfo?.repo) {
        navigate(`/${repoInfo.owner}/${repoInfo.repo}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to clean workspace:', err);
      toast.error('Failed to clean workspace data completely');
    } finally {
      setIsClosing(false);
    }
  };

  // Close Codespace Click Listener (checks unpushed changes)
  const handleCloseCodespace = () => {
    if (hasUnpushedChanges) {
      toast.warning('Please push your changes before closing! You have unpushed file modifications.');
      setShowCloseWarningModal(true);
    } else {
      executeCloseAndCleanup();
    }
  };

  useIdeShortcuts({
    onSave: () => saveCurrentFile(true),
    onRun: () => handleRunCode(),
    onToggleTerminal: () => setShowTerminal(prev => !prev),
    onToggleSidebar: () => setShowSidebar(prev => !prev),
    onPush: () => setShowPushModal(true),
    onOpenShortcuts: () => setIsShortcutsModalOpen(prev => !prev),
    onEscape: () => {
      if (isShortcutsModalOpen) {
        setIsShortcutsModalOpen(false);
      } else if (showPushModal) {
        setShowPushModal(false);
      } else if (showCloseWarningModal) {
        setShowCloseWarningModal(false);
      }
    }
  });

  return (
    <div className="flex h-screen w-full flex-col bg-white text-gray-800 font-sans overflow-hidden">
      {/* Top Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-[#f8f9fa] px-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
            <FolderGit2 className="text-blue-600 shrink-0" size={20} />
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-gray-800">
                {repoInfo?.owner ? `${repoInfo.owner}/${repoInfo.repo}` : 'Codespaces IDE'}
              </h1>
              
              {/* Permission Badge */}
              {repoInfo && (
                repoInfo.canPush ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200" title="You have direct write and push access to this repository">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    {repoInfo.role === 'owner' ? 'Owner (Writable)' : repoInfo.isFork ? 'Fork (Writable)' : 'Contributor (Writable)'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200" title="You can open and run code, but cannot push unless you are a contributor or fork this repo">
                    <ShieldAlert size={12} className="text-amber-600" />
                    Read-Only Upstream
                  </span>
                )
              )}

              {/* Unpushed indicator */}
              {hasUnpushedChanges && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 animate-pulse border border-orange-300">
                  Unpushed Changes
                </span>
              )}
            </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Push or Fork Action Button */}
          {repoInfo && (
            repoInfo.canPush ? (
              <button
                onClick={() => setShowPushModal(true)}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shadow-sm transition-colors"
                title="Commit and Push changes to repository"
              >
                <UploadCloud size={14} />
                <span>Push Changes</span>
              </button>
            ) : (
              <button
                onClick={handleForkRepo}
                disabled={isForking}
                className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 shadow-sm transition-colors disabled:opacity-50"
                title="Fork repository to change and push your changes"
              >
                <GitFork size={14} />
                <span>{isForking ? 'Forking...' : 'Fork to Edit & Push'}</span>
              </button>
            )
          )}

          {/* Cloudflare R2 Executable Download Button */}
          <button
            onClick={handleDownloadExe}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            title="Download compiled rusty.exe directly from Cloudflare R2"
          >
            <Download size={13} className="text-gray-500" />
            <span className="hidden sm:inline">rusty.exe</span>
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1"></div>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded transition-colors ${showSidebar ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Toggle Sidebar (Ctrl+B)"
          >
            <PanelLeft size={17} />
          </button>

          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`p-1.5 rounded transition-colors ${showTerminal ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Toggle Terminal (Ctrl+` or Ctrl+\)"
          >
            <PanelBottom size={17} />
          </button>
          
          <div className="w-px h-5 bg-gray-300 mx-1"></div>
          
          {/* Run Python Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning || !activeFile}
            title="Run Python File (Ctrl+Enter / F5)"
            className={`flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 shadow-sm ${isRunning || !activeFile ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Play size={14} fill="currentColor" className={isRunning ? "animate-pulse" : ""} />
            <span>Run</span>
          </button>

          <button
            onClick={() => setIsShortcutsModalOpen(true)}
            className="p-1.5 rounded transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard size={17} />
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1"></div>

          {/* Close Codespace Button */}
          <button
            onClick={handleCloseCodespace}
            disabled={isClosing}
            className="flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition-colors shadow-sm disabled:opacity-50"
            title="Exit and clean workspace data from disk"
          >
            <LogOut size={13} />
            <span>Close</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden h-full">
        
        {/* Activity Bar (Far Left) */}
        <div className="w-12 shrink-0 bg-[#f8f9fa] border-r border-gray-200 flex flex-col items-center py-4 gap-4">
            <div className="p-2 bg-gray-200 rounded cursor-pointer text-gray-700" title="Explorer">
                <FolderGit2 size={22} />
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
                            onSave={() => saveCurrentFile(true)}
                            onToggleTerminal={() => setShowTerminal(prev => !prev)}
                            onToggleSidebar={() => setShowSidebar(prev => !prev)}
                            onPush={() => setShowPushModal(true)}
                            onOpenShortcuts={() => setIsShortcutsModalOpen(prev => !prev)}
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
                            <Terminal wsUrl={user?._id ? `/ws/terminal?workspaceId=${user._id}` : '/ws/terminal'} ref={myTerminalRef} />
                        </div>
                    </div>
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Push Commit Modal */}
      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <UploadCloud className="text-blue-600" size={20} />
                Push Changes to {repoInfo?.owner}/{repoInfo?.repo}
              </h3>
              <button 
                onClick={() => setShowPushModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              All saved files in this codespace will be packaged into a new Git commit and pushed directly to the default branch.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Commit Message
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="e.g., Update Python logic in main.py"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPushModal(false)}
                disabled={isPushing}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePushToRepo}
                disabled={isPushing}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPushing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Commit & Push
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unpushed Changes Warning On Close Modal */}
      {showCloseWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-amber-200">
            <div className="flex items-center gap-3 mb-3 text-amber-600">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                Unpushed Changes Warning
              </h3>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              You have modified files in this Codespace that have not been pushed to the remote repository.
            </p>
            <p className="text-sm text-rose-600 font-medium mb-5">
              ⚠️ Closing will completely delete and clean the <code className="bg-rose-50 px-1 py-0.5 rounded text-xs">workspace_data</code> folder from your disk. All unpushed changes will be permanently lost!
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => setShowCloseWarningModal(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCloseWarningModal(false);
                  executeCloseAndCleanup();
                }}
                disabled={isClosing}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                Discard & Close Anyway
              </button>
              {repoInfo?.canPush ? (
                <button
                  onClick={() => {
                    setShowCloseWarningModal(false);
                    setShowPushModal(true);
                  }}
                  className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 flex items-center justify-center gap-1.5"
                >
                  <UploadCloud size={14} />
                  Push Changes First
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowCloseWarningModal(false);
                    handleForkRepo();
                  }}
                  className="rounded-md bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 flex items-center justify-center gap-1.5"
                >
                  <GitFork size={14} />
                  Fork to Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal 
        isOpen={isShortcutsModalOpen} 
        onClose={() => setIsShortcutsModalOpen(false)} 
      />

      {/* Codespace Startup Loading Overlay */}
      {isInitializingWorkspace && (
        <div className="fixed inset-0 bg-[#1e1e1e] z-50 flex flex-col items-center justify-center text-white select-none">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-semibold tracking-wide flex items-center gap-2">
            <FolderGit2 className="text-blue-400" size={24} />
            Starting Codespace
          </h2>
          <p className="text-sm text-gray-400 mt-2 text-center max-w-md px-4">
            {initStatusText}
          </p>
        </div>
      )}
    </div>
  );
}
