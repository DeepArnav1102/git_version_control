const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Base directory for all workspaces
const WORKSPACE_BASE_DIR = path.join(process.cwd(), 'workspace_data');

/**
 * Service to handle isolated workspace file management for the IDE.
 * Includes security checks to prevent path traversal outside the user's workspace.
 */
class FileService {
    /**
     * Ensure the base workspace directory exists.
     */
    static async init() {
        try {
            await fs.mkdir(WORKSPACE_BASE_DIR, { recursive: true });
        } catch (err) {
            console.error('Failed to create workspace base directory:', err);
        }
    }

    /**
     * Resolves and validates a secure absolute path for a user's workspace file.
     * Prevents path traversal vulnerabilities.
     *
     * @param {string} userId - The user's unique ID.
     * @param {string} relativePath - The requested relative path within the workspace.
     * @returns {string} The resolved absolute path on the host.
     * @throws {Error} If path is invalid or attempts to escape the workspace.
     */
    static getSecurePath(userId, relativePath = '') {
        // Sanitize userId to prevent directory traversal in the ID itself
        const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
        const userWorkspace = path.join(WORKSPACE_BASE_DIR, safeUserId);
        
        // Resolve the absolute path
        const absolutePath = path.resolve(userWorkspace, relativePath);

        // Security Check: Ensure the resolved path strictly starts with the user's workspace path
        if (absolutePath !== userWorkspace && !absolutePath.startsWith(userWorkspace + path.sep)) {
            throw new Error('Access Denied: Path traversal detected.');
        }

        return absolutePath;
    }

    /**
     * Ensures a user's workspace exists.
     * @param {string} userId
     */
    static async ensureWorkspace(userId) {
        const userWorkspace = this.getSecurePath(userId);
        await fs.mkdir(userWorkspace, { recursive: true });
        return userWorkspace;
    }

    /**
     * Clears the user's entire workspace by deleting and recreating it.
     */
    static async clearWorkspace(userId) {
        const userWorkspace = this.getSecurePath(userId);
        await fs.rm(userWorkspace, { recursive: true, force: true });
        await fs.mkdir(userWorkspace, { recursive: true });
        return userWorkspace;
    }

    /**
     * Completely removes the user's workspace directory from disk when codespace is closed.
     */
    static async deleteWorkspace(userId) {
        const userWorkspace = this.getSecurePath(userId);
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await fs.rm(userWorkspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
                return { success: true };
            } catch (err) {
                if (attempt === 3) throw err;
                await new Promise(res => setTimeout(res, 250));
            }
        }
        return { success: true };
    }

    /**
     * Recursively reads a directory to build a file tree.
     *
     * @param {string} dirPath - The absolute path of the directory.
     * @param {string} relativeBasePath - The relative path from the workspace root.
     * @returns {Promise<Array>}
     */
    static async getFileTree(dirPath, relativeBasePath = '') {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const tree = [];

        for (const entry of entries) {
            // Hide .local, .git, __pycache__, and other hidden system files from the IDE file tree
            if (entry.name.startsWith('.') || entry.name === '__pycache__') {
                continue;
            }

            const entryPath = path.join(dirPath, entry.name);
            const entryRelativePath = relativeBasePath ? `${relativeBasePath}/${entry.name}` : entry.name;
            
            if (entry.isDirectory()) {
                tree.push({
                    name: entry.name,
                    path: entryRelativePath,
                    type: 'folder',
                    children: await this.getFileTree(entryPath, entryRelativePath)
                });
            } else {
                tree.push({
                    name: entry.name,
                    path: entryRelativePath,
                    type: 'file'
                });
            }
        }

        // Sort: folders first, then files alphabetically
        return tree.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
    }

    /**
     * Retrieves the complete file tree for a user's workspace.
     */
    static async getWorkspaceTree(userId) {
        const userWorkspace = await this.ensureWorkspace(userId);
        return await this.getFileTree(userWorkspace);
    }

    /**
     * Reads the content of a file.
     */
    static async readFile(userId, filePath) {
        const securePath = this.getSecurePath(userId, filePath);
        return await fs.readFile(securePath, 'utf8');
    }

    /**
     * Creates a new file or directory.
     */
    static async create(userId, filePath, type = 'file') {
        const securePath = this.getSecurePath(userId, filePath);
        if (type === 'folder') {
            await fs.mkdir(securePath, { recursive: true });
        } else {
            // Ensure parent directory exists
            await fs.mkdir(path.dirname(securePath), { recursive: true });
            await fs.writeFile(securePath, '', 'utf8');
        }
        return { success: true, path: filePath };
    }

    /**
     * Updates an existing file's content.
     */
    static async updateFile(userId, filePath, content) {
        const securePath = this.getSecurePath(userId, filePath);
        await fs.mkdir(path.dirname(securePath), { recursive: true });
        await fs.writeFile(securePath, content, 'utf8');
        return { success: true };
    }

    /**
     * Deletes a file or directory.
     */
    static async delete(userId, filePath) {
        const securePath = this.getSecurePath(userId, filePath);
        const stat = await fs.stat(securePath);
        if (stat.isDirectory()) {
            await fs.rm(securePath, { recursive: true, force: true });
        } else {
            await fs.unlink(securePath);
        }
        return { success: true };
    }

    /**
     * Recursively retrieves all workspace files as { relativePath: utf8Content }
     */
    static async getAllFilesFlat(userId) {
        const userWorkspace = await this.ensureWorkspace(userId);
        const result = {};

        async function walk(dir, relPath = '') {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === '__pycache__' || entry.name === 'node_modules') {
                    continue;
                }
                const fullPath = path.join(dir, entry.name);
                const itemRel = relPath ? `${relPath}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                    await walk(fullPath, itemRel);
                } else if (entry.isFile()) {
                    result[itemRel] = await fs.readFile(fullPath, 'utf8');
                }
            }
        }

        await walk(userWorkspace);
        return result;
    }
}

// Initialize the base directory on load
FileService.init();

module.exports = { FileService, WORKSPACE_BASE_DIR };
