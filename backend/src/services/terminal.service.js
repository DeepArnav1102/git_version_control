const WebSocket = require('ws');
const Docker = require('dockerode');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.model');
const { verifyAccessToken } = require('./token.service');

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock';
const docker = new Docker({ socketPath });

/**
 * Initializes the WebSocket server for interactive terminal sessions.
 * Spawns an ephemeral Docker container for each connected client and pipes
 * their WebSocket stream directly into a bash TTY process.
 *
 * @param {import('http').Server} server - The running HTTP server instance.
 * @returns {WebSocket.Server} The configured WebSocket server instance.
 */
function initTerminalServer(server) {
  const wss = new WebSocket.Server({ noServer: true, path: '/ws/terminal' });
  const activeWorkspaces = new Map(); // workspaceId -> Set<WebSocket>
  const pendingCleanupTimers = new Map(); // workspaceId -> Timeout

  wss.on('connection', async (ws, req) => {
    let container;
    let isClosed = false;

    // Verify JWT accessToken signature to authenticate user, or assign unique ephemeral guest workspace
    let workspaceId = null;
    let isGuest = false;
    if (req.headers?.cookie) {
      try {
        const cookieEntries = req.headers.cookie.split(';').map(c => {
          const [k, ...v] = c.trim().split('=');
          return [k, v.join('=')];
        });
        const cookies = Object.fromEntries(cookieEntries);
        if (cookies.accessToken) {
          const decoded = jwt.decode(cookies.accessToken);
          if (decoded?.userId) {
            const user = await User.findById(decoded.userId).select('securitySalt');
            if (user?.securitySalt) {
              verifyAccessToken(cookies.accessToken, user.securitySalt);
              workspaceId = user._id.toString();
            }
          }
        }
      } catch (_) {
        workspaceId = null;
      }
    }

    if (!workspaceId) {
      isGuest = true;
      workspaceId = `guest_${crypto.randomBytes(8).toString('hex')}`;
    }

    // Register active terminal session
    if (!activeWorkspaces.has(workspaceId)) {
      activeWorkspaces.set(workspaceId, new Set());
    }
    activeWorkspaces.get(workspaceId).add(ws);

    // Cancel pending cleanup timer if this workspace reconnected (e.g. reload)
    if (pendingCleanupTimers.has(workspaceId)) {
      clearTimeout(pendingCleanupTimers.get(workspaceId));
      pendingCleanupTimers.delete(workspaceId);
      console.log(`[Codespace Watchdog] Reconnected to workspace ${workspaceId}, cancelled pending cleanup.`);
    }

    // Cloudflare 100-second idle timeout safeguard: ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    // Cleanup container and ping interval if the WebSocket closes
    ws.on('close', async () => {
      isClosed = true;
      clearInterval(pingInterval);
      try { if (container) await container.remove({ force: true }); } catch (_) { /* ignore kill errors */ }

      // Unregister active terminal session
      if (isGuest) {
        try {
          const { FileService } = require('./file.service');
          await FileService.deleteWorkspace(workspaceId);
        } catch (_) {}
      } else if (workspaceId && workspaceId !== 'default_workspace') {
        const wsSet = activeWorkspaces.get(workspaceId);
        if (wsSet) {
          wsSet.delete(ws);
          if (wsSet.size === 0) {
            activeWorkspaces.delete(workspaceId);

            // Tab closed: schedule auto-cleanup of workspace_data after 3.5 seconds
            if (pendingCleanupTimers.has(workspaceId)) {
              clearTimeout(pendingCleanupTimers.get(workspaceId));
            }
            const timer = setTimeout(async () => {
              pendingCleanupTimers.delete(workspaceId);
              console.log(`[Codespace Watchdog] Tab closed for workspace ${workspaceId}. Auto-cleaning workspace_data...`);
              try {
                const { cleanupCodespaceWorkspace } = require('../routes/ide.route');
                if (typeof cleanupCodespaceWorkspace === 'function') {
                  await cleanupCodespaceWorkspace(workspaceId);
                }
              } catch (cleanupErr) {
                console.error('[Codespace Watchdog] Auto-cleanup error:', cleanupErr.message);
              }
            }, 3500);
            pendingCleanupTimers.set(workspaceId, timer);
          }
        }
      }
    });

    try {
      const { FileService } = require('./file.service');

      const hostWorkspacePath = await FileService.ensureWorkspace(workspaceId);
      const bindPath = `${hostWorkspacePath}:/workspace`;

      // Create an isolated container for the terminal session
      container = await docker.createContainer({
        Image: 'python:3.11-slim',
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        Cmd: ['/bin/bash'],
        WorkingDir: '/workspace', // Start in their workspace
        NetworkDisabled: false, // Temporarily disabled network isolation so pip can download packages!
        Env: [
          'PIP_USER=1',
          'PYTHONUSERBASE=/workspace/.local',
          'PATH=/workspace/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin'
        ],
        HostConfig: {
          Binds: [bindPath], // Mount the workspace
          Memory: 256 * 1024 * 1024, // 256MB RAM limit
          NanoCpus: 500000000, // 0.5 CPU limit
          PidsLimit: 64,
          CapDrop: ['ALL'], // Drop all Linux capabilities
          AutoRemove: false // Set to false because we are explicitly removing it with {force: true} to avoid Windows bugs
        }
      });

      // Race condition check: if they disconnected while we were creating it!
      if (isClosed) {
          await container.remove({ force: true }).catch(() => {});
          return;
      }

      const execStream = await container.attach({
        stream: true, stdin: true, stdout: true, stderr: true, hijack: true
      });

      await container.start();

      // Pipe container output directly to the WebSocket client
      execStream.on('data', (chunk) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(chunk.toString('utf8'));
      });

      // Handle input and resize commands from the client
      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === 'input') {
            execStream.write(parsed.data);
          } else if (parsed.type === 'resize') {
            container.resize({ h: parsed.rows, w: parsed.cols }).catch(() => { /* ignore resize errors */ });
          }
        } catch (_) {
          // Ignore invalid non-JSON messages to avoid crashing the server
        }
      });

    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) ws.send(`\r\nError: ${err.message}\r\n`);
      ws.close();
    }
  });

  return wss;
}

module.exports = { initTerminalServer };
