import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const Terminal = forwardRef(({ wsUrl }, ref) => {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const socketRef = useRef(null);

  useImperativeHandle(ref, () => ({
    executeCommand: (cmd) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        // Send command and a newline to execute it
        socketRef.current.send(JSON.stringify({ type: 'input', data: cmd + '\r' }));
      }
    }
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: { background: '#ffffff', foreground: '#333333', cursor: '#333333', selection: '#c5e2ff' },
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      fontSize: 13,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    xtermInstance.current = term;

    // Allow IDE global shortcuts to pass through rather than getting swallowed by xterm
    term.attachCustomKeyEventHandler((event) => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      if (isCtrlOrMeta) {
        const k = event.key.toLowerCase();
        // Allow IDE shortcuts: Ctrl+S, Ctrl+B, Ctrl+`, Ctrl+\, Ctrl+J, Ctrl+Enter, Ctrl+Shift+P
        if (k === 's' || k === 'b' || k === '`' || k === '\\' || k === 'j' || k === 'enter' || (k === 'p' && event.shiftKey)) {
          return false; // let event bubble to window listener
        }
      }
      if (event.key === 'F5' || event.key === 'Escape') {
        return false;
      }
      return true;
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}${wsUrl}`);
    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln('\r\n*** Connected to Sandboxed Interactive Terminal ***\r\n');
    };

    socket.onmessage = (event) => term.write(event.data);
    
    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.close();
      term.dispose();
    };
  }, [wsUrl]);

  return <div ref={terminalRef} className="h-full w-full bg-white p-2" />;
});

export default Terminal;
