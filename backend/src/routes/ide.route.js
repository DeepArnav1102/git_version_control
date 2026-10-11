const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { SandboxService } = require('../services/sandbox.service');
const { FileService } = require('../services/file.service');
const { R2StorageService } = require('../services/r2Storage.service');
const GitObject = require('../models/GitObject.model');
const Repository = require('../models/Repository.model');
const { resolveRepo, buildRecursiveTree } = require('../utils/repoHelpers');
const { buildAndSaveTree } = require('../utils/gitHelpers');
const { canUserPushToRepo, getUserRepoRole } = require('../utils/permissionHelpers');
const { protectOptional } = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply optional auth so req.user is set when token is present
router.use(protectOptional);

// Helper to determine workspace ID (scopes workspace to logged-in user, accepts query or body override)
const getWorkspaceId = (req) => {
    if (req.query?.workspaceId && req.query.workspaceId !== 'undefined' && req.query.workspaceId !== 'null') {
        return req.query.workspaceId;
    }
    if (req.body?.workspaceId && req.body.workspaceId !== 'undefined' && req.body.workspaceId !== 'null') {
        return req.body.workspaceId;
    }
    return req.user?._id ? req.user._id.toString() : 'default_workspace';
};

/**
 * @swagger
 * /api/v1/ide/codespace-info:
 *   get:
 *     summary: Get metadata and permissions for the currently loaded repository
 */
router.get('/codespace-info', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        let meta = null;
        try {
            const metaContent = await FileService.readFile(workspaceId, '.codespace_info.json');
            meta = JSON.parse(metaContent);
        } catch (_) {
            // No meta found
        }

        if (!meta) {
            return res.json({ loaded: false, repo: null });
        }

        // Refresh live permissions if repo exists in database
        let canPush = false;
        let role = 'guest';
        if (meta.owner && meta.repo) {
            const repoDoc = await resolveRepo(meta.owner, meta.repo, req.user);
            if (repoDoc) {
                canPush = canUserPushToRepo(repoDoc, req.user);
                role = getUserRepoRole(repoDoc, req.user);
            }
        }

        res.json({
            loaded: true,
            repo: {
                ...meta,
                canPush,
                role,
            },
        });
    } catch (error) {
        console.error('Error fetching codespace info:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/load-codespace:
 *   post:
 *     summary: Loads a specific git file or repository into the user's IDE sandbox
 */
router.post('/load-codespace', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { type, owner, repo, hash, filename } = req.body;

        await FileService.clearWorkspace(workspaceId);

        if (type === 'file') {
            if (!hash || !filename) return res.status(400).json({ error: 'hash and filename are required for file type' });
            const blobObj = await GitObject.findOne({ hash, type: 'blob' });
            if (!blobObj) return res.status(404).json({ error: 'Blob not found' });

            await FileService.create(workspaceId, filename, 'file');
            await FileService.updateFile(workspaceId, filename, blobObj.data);

            return res.json({ success: true, type: 'file' });
        } else if (type === 'repo') {
            if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required for repo type' });

            const repoDoc = await resolveRepo(owner, repo, req.user);
            if (!repoDoc) return res.status(404).json({ error: 'Repository not found' });

            const defaultBranch = repoDoc.defaultBranch || 'main';
            const branch = repoDoc.branches?.find(b => b.name === defaultBranch);
            let commitHash = null;

            if (branch && branch.commitHash) {
                commitHash = branch.commitHash;
                const commitObj = await GitObject.findOne({ repositoryId: repoDoc._id, hash: commitHash, type: 'commit' });
                if (commitObj) {
                    const commitData = typeof commitObj.data === 'string' ? JSON.parse(commitObj.data) : commitObj.data;
                    const treeHash = commitData.tree;
                    if (treeHash) {
                        const fileTree = await buildRecursiveTree(treeHash, repoDoc._id, '');

                        // Helper to recursively write tree
                        const writeTreeToSandbox = async (nodes, currentPath = '') => {
                            for (const node of nodes) {
                                const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
                                if (node.object_type === 'tree') {
                                    await FileService.create(workspaceId, nodePath, 'folder');
                                    if (node.children) {
                                        await writeTreeToSandbox(node.children, nodePath);
                                    }
                                } else if (node.object_type === 'blob') {
                                    const blobObj = await GitObject.findOne({ hash: node.object_hash, type: 'blob' });
                                    if (blobObj) {
                                        await FileService.create(workspaceId, nodePath, 'file');
                                        await FileService.updateFile(workspaceId, nodePath, blobObj.data);
                                    }
                                }
                            }
                        };

                        await writeTreeToSandbox(fileTree);
                    }
                }
            } else {
                // Empty repository: create an initial README.md
                await FileService.create(workspaceId, 'README.md', 'file');
                await FileService.updateFile(workspaceId, 'README.md', `# ${repoDoc.name}\n\nStart coding in your Codespace!`);
            }

            // Pull environment variables into workspace if defined on repository
            if (Array.isArray(repoDoc.environmentVariables) && repoDoc.environmentVariables.length > 0) {
                const envContent = repoDoc.environmentVariables
                    .map(item => `${item.key}=${item.value}`)
                    .join('\n');
                await FileService.create(workspaceId, '.env', 'file');
                await FileService.updateFile(workspaceId, '.env', envContent);
            }

            // Cache Rusty binary from Cloudflare R2 into shared bin folder
            try {
                const binDir = path.join(process.cwd(), 'workspace_data', 'bin');
                await R2StorageService.downloadAndCacheExecutable({
                    targetDir: binDir,
                    platform: process.platform === 'win32' ? 'windows' : 'linux',
                    version: 'latest',
                });
            } catch (r2Err) {
                console.warn('Note: Could not cache R2 executable on cold start:', r2Err.message);
            }

            // Restore cached Python packages (.local) from Cloudflare R2 if snapshot exists
            try {
                const hostWorkspacePath = await FileService.ensureWorkspace(workspaceId);
                const localEnvPath = path.join(hostWorkspacePath, '.local');
                const restored = await R2StorageService.restorePythonEnvironment({
                    owner,
                    repo: repoDoc.name,
                    targetEnvPath: localEnvPath,
                });
                if (restored) {
                    console.log(`[R2] Restored installed Python packages from Cloudflare R2 for ${owner}/${repoDoc.name}`);
                }
            } catch (r2EnvErr) {
                console.warn('[R2] Note: Could not restore python env from R2:', r2EnvErr.message);
            }

            // Evaluate push permissions (Rules 1 & 2)
            const canPush = canUserPushToRepo(repoDoc, req.user);
            const role = getUserRepoRole(repoDoc, req.user);

            // Store metadata inside workspace
            const metaInfo = {
                repoId: repoDoc._id,
                owner,
                repo: repoDoc.name,
                canPush,
                role,
                isFork: Boolean(repoDoc.isFork),
                parentRepo: repoDoc.parentRepo,
                defaultBranch,
                commitHash: branch?.commitHash || commitHash || null,
                loadedAt: new Date().toISOString(),
            };

            await FileService.create(workspaceId, '.codespace_info.json', 'file');
            await FileService.updateFile(workspaceId, '.codespace_info.json', JSON.stringify(metaInfo, null, 2));

            return res.json({
                success: true,
                type: 'repo',
                repo: metaInfo,
            });
        } else {
            return res.status(400).json({ error: 'Invalid type' });
        }
    } catch (error) {
        console.error('Error loading codespace:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/push-codespace:
 *   post:
 *     summary: Commits and pushes changes made in Codespace back to the repository
 */
router.post('/push-codespace', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { owner, repo, commitMessage = 'Update from Codespace' } = req.body;

        if (!req.user) {
            return res.status(401).json({ error: 'You must be logged in to push changes.' });
        }

        const repoDoc = await resolveRepo(owner, repo, req.user);
        if (!repoDoc) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        // Enforce Rules 1 & 2:
        // Must be owner or contributor (collaborator with write/admin).
        // If it's a fork owned by this user, repoDoc.owner === req.user._id, so canUserPushToRepo returns true.
        const canPush = canUserPushToRepo(repoDoc, req.user);
        if (!canPush) {
            return res.status(403).json({
                error: 'Push rejected: You do not have permission to push to this repository. You must be the owner or an approved contributor. Please fork the repository to push your changes.',
            });
        }

        const defaultBranch = repoDoc.defaultBranch || 'main';
        if (!repoDoc.branches) repoDoc.branches = [];
        let branch = repoDoc.branches.find(b => b.name === defaultBranch);
        if (!branch) {
            branch = { name: defaultBranch, commitHash: null, updatedAt: new Date() };
            repoDoc.branches.push(branch);
        }

        // 1. Gather all workspace files
        const filesFlat = await FileService.getAllFilesFlat(workspaceId);
        const flatTree = {};

        // 2. Hash and save every file as a blob
        for (const [relPath, content] of Object.entries(filesFlat)) {
            // Exclude internal metadata
            if (relPath === '.codespace_info.json') continue;

            const blobHash = crypto.createHash('sha256').update(content).digest('hex');
            await GitObject.updateOne(
                { repositoryId: repoDoc._id, hash: blobHash },
                {
                    $set: {
                        repositoryId: repoDoc._id,
                        hash: blobHash,
                        type: 'blob',
                        data: content,
                        pushedBy: req.user._id,
                    },
                },
                { upsert: true }
            );
            flatTree[relPath] = blobHash;
        }

        // 3. Build and save git tree hierarchy
        const rootTreeHash = await buildAndSaveTree(repoDoc._id, flatTree, req.user._id);

        // 4. Create commit object
        const parentCommitHash = branch.commitHash;
        const newCommitData = {
            tree: rootTreeHash,
            parent: parentCommitHash,
            author: req.user.username,
            message: commitMessage.trim() || 'Update from Codespace',
            date: new Date().toISOString(),
        };

        const newCommitDataStr = JSON.stringify(newCommitData);
        const newCommitHash = crypto.createHash('sha256').update(newCommitDataStr).digest('hex');

        await GitObject.updateOne(
            { repositoryId: repoDoc._id, hash: newCommitHash },
            {
                $set: {
                    repositoryId: repoDoc._id,
                    hash: newCommitHash,
                    type: 'commit',
                    data: newCommitDataStr,
                    pushedBy: req.user._id,
                },
            },
            { upsert: true }
        );

        // 5. Update branch reference
        branch.commitHash = newCommitHash;
        branch.updatedAt = new Date();

        repoDoc.latestCommit = {
            hash: newCommitHash,
            message: newCommitData.message,
            tree: rootTreeHash,
            parent: parentCommitHash,
            author: req.user.username,
            date: new Date(),
        };

        await repoDoc.save();

        // Snapshot and upload Python environment packages to Cloudflare R2
        try {
            const hostWorkspacePath = await FileService.ensureWorkspace(workspaceId);
            const localEnvPath = path.join(hostWorkspacePath, '.local');
            await R2StorageService.savePythonEnvironment({
                owner: repoDoc.owner?.username || owner || req.user.username,
                repo: repoDoc.name,
                localEnvPath,
            });
        } catch (r2SaveErr) {
            console.warn('[R2] Note: Could not snapshot python env to R2 on push:', r2SaveErr.message);
        }

        res.status(200).json({
            success: true,
            message: `Successfully pushed commit ${newCommitHash.slice(0, 8)} to ${defaultBranch}`,
            commitHash: newCommitHash,
        });
    } catch (error) {
        console.error('Error pushing from codespace:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/close-codespace:
 *   post:
 *     summary: Cleans up the user's workspace directory when closing the codespace
 */
const cleanupCodespaceWorkspace = async (workspaceId) => {
    if (!workspaceId) return { success: false };
    try {
        // Snapshot Python environment packages to Cloudflare R2 before clearing workspace
        try {
            let meta = null;
            try {
                const metaContent = await FileService.readFile(workspaceId, '.codespace_info.json');
                meta = JSON.parse(metaContent);
            } catch (_) {}

            if (meta?.owner && meta?.repo) {
                const hostWorkspacePath = await FileService.ensureWorkspace(workspaceId);
                const localEnvPath = path.join(hostWorkspacePath, '.local');
                await R2StorageService.savePythonEnvironment({
                    owner: meta.owner,
                    repo: meta.repo,
                    localEnvPath,
                });
            }
        } catch (r2CloseErr) {
            console.warn('[R2] Note: Could not snapshot python env on close:', r2CloseErr.message);
        }

        await FileService.deleteWorkspace(workspaceId);
        console.log(`[Codespace] Cleaned up workspace_data for workspaceId: ${workspaceId}`);
        return { success: true };
    } catch (error) {
        console.error(`[Codespace] Error cleaning up workspace ${workspaceId}:`, error);
        throw error;
    }
};

router.post('/close-codespace', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await cleanupCodespaceWorkspace(workspaceId);
        res.json({ success: true, message: 'Codespace cleaned and closed successfully' });
    } catch (error) {
        console.error('Error closing codespace:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/save-env:
 *   post:
 *     summary: Manually snapshots the current Python packages (.local) to Cloudflare R2
 */
router.post('/save-env', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        let meta = null;
        try {
            const metaContent = await FileService.readFile(workspaceId, '.codespace_info.json');
            meta = JSON.parse(metaContent);
        } catch (_) {}

        if (!meta?.owner || !meta?.repo) {
            return res.status(400).json({ error: 'No repository loaded in codespace' });
        }

        const hostWorkspacePath = await FileService.ensureWorkspace(workspaceId);
        const localEnvPath = path.join(hostWorkspacePath, '.local');
        const saved = await R2StorageService.savePythonEnvironment({
            owner: meta.owner,
            repo: meta.repo,
            localEnvPath,
        });

        if (!saved) {
            return res.json({ success: false, message: 'No packages found to snapshot in .local' });
        }

        res.json({ success: true, message: 'Python packages snapshot saved to Cloudflare R2 successfully!' });
    } catch (error) {
        console.error('Error saving env to R2:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/download-exe:
 *   get:
 *     summary: Download the latest rusty executable from Cloudflare R2
 */
router.get('/download-exe', async (req, res) => {
    try {
        const platform = req.query.platform === 'linux' ? 'linux' : 'windows';
        const version = req.query.version || 'latest';

        const downloadUrl = await R2StorageService.getPresignedDownloadUrl({ platform, version });
        res.json({
            platform,
            version,
            downloadUrl,
            publicUrl: process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${version}/${platform}/${platform === 'windows' ? 'rusty.exe' : 'rusty'}` : downloadUrl,
        });
    } catch (error) {
        console.error('Error generating exe download URL:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/files:
 *   get:
 *     summary: Get the workspace file tree
 */
router.get('/files', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const tree = await FileService.getWorkspaceTree(workspaceId);
        res.json({ tree });
    } catch (error) {
        console.error('Error fetching file tree:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/files/content:
 *   get:
 *     summary: Get file content
 */
router.get('/files/content', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { path: filePath } = req.query;
        if (!filePath) return res.status(400).json({ error: 'Path is required' });

        const content = await FileService.readFile(workspaceId, filePath);
        res.json({ content });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/files:
 *   post:
 *     summary: Create a file or folder
 */
router.post('/files', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { path: filePath, type } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path is required' });

        const result = await FileService.create(workspaceId, filePath, type);
        res.json(result);
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/files/content:
 *   put:
 *     summary: Update file content
 */
router.put('/files/content', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { path: filePath, content } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path is required' });

        const result = await FileService.updateFile(workspaceId, filePath, content || '');
        res.json(result);
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/files:
 *   delete:
 *     summary: Delete a file or folder
 */
router.delete('/files', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { path: filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'Path is required' });

        const result = await FileService.delete(workspaceId, filePath);
        res.json(result);
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/v1/ide/run:
 *   post:
 *     summary: Execute Python code in the sandbox
 */
router.post('/run', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { filePath, code, stdin } = req.body;

        let result;
        if (filePath) {
            if (code !== undefined) {
                await FileService.updateFile(workspaceId, filePath, code);
            }
            result = await SandboxService.runPythonFile({ workspaceId, filePath, stdin });
        } else if (code) {
            result = await SandboxService.runPythonCode({ code, stdin });
        } else {
            return res.status(400).json({ error: 'Either filePath or code is required' });
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error running sandbox code:', error);
        res.status(500).json({ error: 'Failed to run code in sandbox', details: error.message });
    }
});

module.exports = router;
module.exports.cleanupCodespaceWorkspace = cleanupCodespaceWorkspace;
