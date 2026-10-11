/**
 * Helper functions to check repository permissions according to rules:
 * 1. Anyone can open a public repo in Codespace, but cannot push unless they are a contributor (collaborator with write/admin).
 * 2. A user can change and push changes to their own created repo or their own forked repo.
 */

/**
 * Checks if a user has write/push permissions to a repository
 * @param {Object} repoDoc - The Mongoose repository document
 * @param {Object} user - The authenticated user object (must have _id)
 * @returns {boolean}
 */
function canUserPushToRepo(repoDoc, user) {
    if (!repoDoc || !user || !user._id) return false;

    const userIdStr = user._id.toString();

    // 1. Owner of the repo (covers both directly created repos and forked repos owned by this user)
    if (repoDoc.owner && repoDoc.owner.toString() === userIdStr) {
        return true;
    }

    // 2. Verified collaborator / contributor with 'write' or 'admin' role
    if (Array.isArray(repoDoc.collaborators)) {
        const isContributor = repoDoc.collaborators.some(c => {
            const collaboratorUserId = c.user?._id ? c.user._id.toString() : c.user?.toString();
            return collaboratorUserId === userIdStr && ['write', 'admin'].includes(c.role);
        });
        if (isContributor) return true;
    }

    return false;
}

/**
 * Gets the effective role of a user for a repository
 * @param {Object} repoDoc
 * @param {Object} user
 * @returns {'owner' | 'admin' | 'contributor' | 'viewer' | 'guest'}
 */
function getUserRepoRole(repoDoc, user) {
    if (!repoDoc || !user || !user._id) return 'guest';

    const userIdStr = user._id.toString();

    if (repoDoc.owner && repoDoc.owner.toString() === userIdStr) {
        return 'owner';
    }

    if (Array.isArray(repoDoc.collaborators)) {
        const collaborator = repoDoc.collaborators.find(c => {
            const collaboratorUserId = c.user?._id ? c.user._id.toString() : c.user?.toString();
            return collaboratorUserId === userIdStr;
        });
        if (collaborator) {
            if (collaborator.role === 'admin') return 'admin';
            if (collaborator.role === 'write') return 'contributor';
            return 'viewer';
        }
    }

    return 'viewer';
}

module.exports = {
    canUserPushToRepo,
    getUserRepoRole,
};
