const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const Repository = require('../models/Repository.model');

const searchUsers = asyncHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
        return res.status(200).json({
            success: true,
            data: { users: [] }
        });
    }

    const users = await User.aggregate([
        {
            $search: {
                index: 'user_search_index',
                text: {
                    query: q,
                    path: ['name', 'username'],
                    fuzzy: {
                        maxEdits: 1,
                        prefixLength: 1
                    }
                }
            }
        },
        { $limit: 20 },
        {
            $project: {
                name: 1,
                username: 1,
                profilePicture: 1,
                bio: 1,
                _id: 1,
                score: { $meta: 'searchScore' }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: { users }
    });
});

// ─── Global Search (users + repos) ────────────────────────────────────
const globalSearch = asyncHandler(async (req, res) => {
    const { q, scope } = req.query;
    const isMyReposScope = scope === 'me' && !!req.user;

    if (!q || q.trim() === '') {
        return res.status(200).json({
            success: true,
            data: { users: [], repos: [], scope: isMyReposScope ? 'me' : 'global' }
        });
    }

    // ── Security: sanitize input ──────────────────────────────────────
    // 1. Hard cap length — prevents oversized payloads hitting Atlas Search
    // 2. Strip regex special chars — prevents ReDoS if regex fallback is ever used
    const raw = q.trim().slice(0, 60);
    const term = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (term.length < 1) {
        return res.status(200).json({ success: true, data: { users: [], repos: [] } });
    }

    const callerId = req.user?._id ?? null;
    const callerIdStr = callerId?.toString();

    // ── scope=me fast path: search only the caller's own repos ───────
    if (isMyReposScope) {
        const repos = await Repository.find({
            owner: req.user._id,
            $or: [
                { name: { $regex: raw, $options: 'i' } },
                { description: { $regex: raw, $options: 'i' } }
            ]
        })
        .populate('owner', 'username profilePicture')
        .select('name description isPrivate owner starsCount forksCount defaultBranch updatedAt')
        .sort({ updatedAt: -1 })
        .limit(8);   // show more results since we know they're all the user's

        return res.status(200).json({
            success: true,
            data: { users: [], repos, scope: 'me' }
        });
    }

    // ── Global search: users + public repos in parallel ───────────────
    const [users, rawRepos] = await Promise.all([

        // ── User search — Atlas Search (Lucene, fuzzy) ────────────────
        User.aggregate([
            {
                $search: {
                    index: 'user_search_index',
                    text: {
                        query: raw,
                        path: ['name', 'username'],
                        fuzzy: { maxEdits: 1, prefixLength: 1 }
                    }
                }
            },
            { $limit: 5 },
            {
                $project: {
                    name: 1, username: 1, profilePicture: 1, bio: 1, _id: 1,
                    score: { $meta: 'searchScore' }
                }
            }
        ]).catch(() => []),

        // ── Repo search — Atlas Search (Lucene, fuzzy) ────────────────
        Repository.aggregate([
            {
                $search: {
                    index: 'repo_search_index',
                    text: {
                        query: raw,
                        path: ['name', 'description'],
                        fuzzy: { maxEdits: 1, prefixLength: 2 }
                    }
                }
            },
            { $limit: 20 },
            {
                $project: {
                    name: 1, description: 1, isPrivate: 1, owner: 1,
                    starsCount: 1, forksCount: 1, defaultBranch: 1, updatedAt: 1,
                    score: { $meta: 'searchScore' }
                }
            }
        ]).catch(() => [])
    ]);

    // ── Access-control post-filter ────────────────────────────────────
    const visibleRepoIds = rawRepos
        .filter(r => !r.isPrivate || (callerIdStr && r.owner?.toString() === callerIdStr))
        .slice(0, 5)
        .map(r => r._id);

    const repos = await Repository
        .find({ _id: { $in: visibleRepoIds } })
        .populate('owner', 'username profilePicture')
        .select('name description isPrivate owner starsCount forksCount defaultBranch updatedAt');

    res.status(200).json({
        success: true,
        data: { users, repos, scope: 'global' }
    });
});

module.exports = {
    searchUsers,
    globalSearch
};
