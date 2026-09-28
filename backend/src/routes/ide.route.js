const express = require('express');
const { SandboxService } = require('../services/sandbox.service');
const { FileService } = require('../services/file.service');

const router = express.Router();

// Helper to determine workspace ID (for now, use 'default_workspace' if no user is authenticated)
const getWorkspaceId = (req) => {
    // If you integrate auth, you can do: return req.user?._id || 'guest';
    return 'default_workspace';
};

const GitObject = require('../models/GitObject.model');
const { resolveRepo, buildRecursiveTree } = require('../utils/repoHelpers');

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
            
            return res.json({ success: true });
        } else if (type === 'repo') {
            if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required for repo type' });
            
            const repoDoc = await resolveRepo(owner, repo, req.user); // req.user might be undefined here depending on auth middleware, but we can pass null
            if (!repoDoc) return res.status(404).json({ error: 'Repository not found' });
            
            const defaultBranch = repoDoc.defaultBranch || 'main';
            const branch = repoDoc.branches.find(b => b.name === defaultBranch);
            if (!branch) return res.status(404).json({ error: 'Default branch not found' });
            
            const commitObj = await GitObject.findOne({ repositoryId: repoDoc._id, hash: branch.commitHash, type: 'commit' });
            if (!commitObj) return res.status(404).json({ error: 'Commit not found' });
            
            const commitData = typeof commitObj.data === 'string' ? JSON.parse(commitObj.data) : commitObj.data;
            const treeHash = commitData.tree;
            
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
            return res.json({ success: true });
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
        const { path } = req.query;
        if (!path) return res.status(400).json({ error: 'Path is required' });

        const content = await FileService.readFile(workspaceId, path);
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
        const { path, type } = req.body;
        if (!path) return res.status(400).json({ error: 'Path is required' });

        const result = await FileService.create(workspaceId, path, type);
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
        const { path, content } = req.body;
        if (!path) return res.status(400).json({ error: 'Path is required' });

        const result = await FileService.updateFile(workspaceId, path, content || '');
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
        const { path } = req.body;
        if (!path) return res.status(400).json({ error: 'Path is required' });

        const result = await FileService.delete(workspaceId, path);
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
        // If filePath is provided, we run the file from the workspace
        if (filePath) {
            // First, ensure any unsaved code changes in the editor are saved to the file before running
            if (code !== undefined) {
                await FileService.updateFile(workspaceId, filePath, code);
            }
            result = await SandboxService.runPythonFile({ workspaceId, filePath, stdin });
        } else if (code) {
            // Fallback for raw code execution (legacy behavior)
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
