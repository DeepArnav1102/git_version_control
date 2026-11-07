/**
 * Path-safety validation for repository-supplied names and paths.
 *
 * Branch names, tree entry names, and object paths all originate from
 * clients (the Rusty CLI, the web IDE, or a direct API client). Just as the
 * Rusty CLI validates every name it receives from this server before using
 * it as a filesystem path (see rusty/src/path_check.rs, AUDIT.md finding 2),
 * this server must validate the same names at their ingress points so that
 * hostile paths never enter the object store and never reach path-shaped
 * consumers later:
 *
 *   - ZIP download  (repo.git.controller.js: entry names become archive paths)
 *   - PR merges     (flattenTree -> native merge -> buildAndSaveTree)
 *   - Codespaces    (flattenTree -> FileService)
 *   - CLI refs      (updateRef: branch names become refs/remotes/... on client machines)
 *
 * Rules enforced by `isSafeComponent` mirror the Rust side exactly:
 *   - non-empty, at most 255 chars per component
 *   - never "." or ".."
 *   - no "/", "\", ":" (drive letters, ADS), or NUL/control characters
 *   - no Windows reserved device names (NUL, CON, COM1.., LPT1.., even "NUL.txt")
 */
const ApiError = require('./ApiError');

const WINDOWS_RESERVED = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
];

function truncate(value, max = 80) {
    const text = String(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Validate a single path component (a file or directory name, or one
 * segment of a branch name) that came from a client or remote source.
 */
function isSafeComponent(name) {
    if (typeof name !== 'string') return false;
    if (name.length === 0 || name.length > 255) return false;
    if (name === '.' || name === '..') return false;
    if (name.includes('/') || name.includes('\\')) return false;
    if (name.includes(':') || name.includes('\0')) return false;

    // Control characters make file names invisible and are refused by git refs.
    for (const ch of name) {
        const code = ch.codePointAt(0);
        if (code < 0x20 || code === 0x7f) return false;
    }

    // "NUL.txt" is still special on Windows, so check the name without extension.
    const base = name.split('.')[0].toUpperCase();
    if (WINDOWS_RESERVED.includes(base)) return false;

    return true;
}

/**
 * Throwing variant. `what` describes the context in the error message.
 */
function assertSafeComponent(name, what = 'Path') {
    if (!isSafeComponent(name)) {
        throw new ApiError(
            400,
            `${what} contains an unsafe name: "${truncate(name || '')}"`
        );
    }
}

/**
 * Validate a slash-separated relative path (e.g. "src/lib/main.js") that
 * will be tracked or joined onto a filesystem directory anywhere downstream.
 */
function isSafeRelativePath(pathValue) {
    if (typeof pathValue !== 'string') return false;
    if (pathValue.length === 0 || pathValue.length > 1024) return false;
    if (pathValue.startsWith('/') || pathValue.startsWith('\\')) return false;

    return pathValue.split('/').every(isSafeComponent);
}

function assertSafeRelativePath(pathValue, what = 'File path') {
    if (!isSafeRelativePath(pathValue)) {
        throw new ApiError(
            400,
            `${what} is not a safe repository-relative path: "${truncate(pathValue || '')}"`
        );
    }
}

/**
 * Validate a branch name as used for refs (push / default branch).
 *
 * Keeps the historical character restrictions
 * (letters, digits, `_ - . /` only) while closing the traversal holes the
 * flat regex allowed: `..`, `.`, empty segments, leading/trailing slashes,
 * and Windows reserved names.
 */
function isSafeBranchName(name) {
    if (typeof name !== 'string') return false;
    if (name.length === 0 || name.length > 255) return false;
    if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) {
        return false;
    }

    return name.split('/').every((segment) => {
        if (segment.length === 0 || segment === '.' || segment === '..') {
            return false;
        }
        if (!/^[A-Za-z0-9_.-]+$/.test(segment)) return false;
        if (WINDOWS_RESERVED.includes(segment.toUpperCase())) return false;
        return true;
    });
}

function assertSafeBranchName(name, what = 'Branch name') {
    if (!isSafeBranchName(name)) {
        throw new ApiError(
            400,
            `${what} is not a valid branch name: "${truncate(name || '')}"`
        );
    }
}

/**
 * Strictly parse a pushed object payload the way it will be read back later
 * (honoring the base64 encoding marker). Unlike utils/repoHelpers
 * `parseGitObjectData`, this never falls back to returning a raw string:
 * for security validation we need to know parsing actually succeeded.
 *
 * @returns {object|null} parsed JSON object, or null when unparsable
 */
function parseObjectPayload(dataString, encoding) {
    if (typeof dataString !== 'string') return null;

    let raw = dataString;
    if (encoding === 'base64') {
        try {
            raw = Buffer.from(dataString, 'base64').toString('utf8');
        } catch {
            return null;
        }
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        // Legacy behavior: some clients pushed base64 without marking the
        // encoding. Attempt one decode before giving up.
        try {
            const decoded = Buffer.from(raw, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
}

/**
 * Find the first tree entry with an unsafe name in a parsed tree object.
 * Returns the offending name (string) or null when the tree is clean.
 *
 * @param {object} parsed - parsed tree JSON ({ entries: [{ name, ... }] })
 * @returns {string|null}
 */
function findUnsafeTreeEntryName(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.entries)) return null;

    for (const entry of parsed.entries) {
        const name = entry ? entry.name : undefined;
        if (!isSafeComponent(name)) {
            return name === undefined || name === null ? '' : name;
        }
    }

    return null;
}

module.exports = {
    isSafeComponent,
    assertSafeComponent,
    isSafeRelativePath,
    assertSafeRelativePath,
    isSafeBranchName,
    assertSafeBranchName,
    parseObjectPayload,
    findUnsafeTreeEntryName,
};
