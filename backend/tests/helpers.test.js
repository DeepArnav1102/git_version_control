const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { canUserPushToRepo, getUserRepoRole } = require('../src/utils/permissionHelpers');
const { FileService } = require('../src/services/file.service');
const { generateUnifiedDiff } = require('../src/utils/gitHelpers');
const nativeMerge = require('../native-merge.node');

test('FileService: getSecurePath boundary and traversal validation', async (t) => {
    await t.test('resolves legitimate file path inside workspace', () => {
        const p = FileService.getSecurePath('user123', 'src/index.js');
        assert.ok(p.includes('user123'));
        assert.ok(p.endsWith(path.join('src', 'index.js')));
    });

    await t.test('blocks directory traversal escaping workspace', () => {
        assert.throws(() => {
            FileService.getSecurePath('user123', '../../etc/passwd');
        }, /Access Denied/);
    });

    await t.test('blocks sibling directory prefix collision', () => {
        // A workspace for 'u1' must not permit resolving into a sibling 'u10'
        const baseWorkspace = FileService.getSecurePath('u1');
        assert.throws(() => {
            // Attempting to resolve a path that starts with userWorkspace prefix without separator
            FileService.getSecurePath('u1', '../u10/secret.txt');
        }, /Access Denied/);
    });
});

test('permissionHelpers: canUserPushToRepo and getUserRepoRole', async (t) => {
    const ownerId = '507f1f77bcf86cd799439011';
    const collId = '507f1f77bcf86cd799439012';
    const viewerId = '507f1f77bcf86cd799439013';
    const strangerId = '507f1f77bcf86cd799439014';

    const repoDoc = {
        owner: ownerId,
        collaborators: [
            { user: collId, role: 'write' },
            { user: viewerId, role: 'read' },
        ],
    };

    await t.test('owner has push permission and owner role', () => {
        assert.equal(canUserPushToRepo(repoDoc, { _id: ownerId }), true);
        assert.equal(getUserRepoRole(repoDoc, { _id: ownerId }), 'owner');
    });

    await t.test('write collaborator has push permission and contributor role', () => {
        assert.equal(canUserPushToRepo(repoDoc, { _id: collId }), true);
        assert.equal(getUserRepoRole(repoDoc, { _id: collId }), 'contributor');
    });

    await t.test('read-only collaborator cannot push and has viewer role', () => {
        assert.equal(canUserPushToRepo(repoDoc, { _id: viewerId }), false);
        assert.equal(getUserRepoRole(repoDoc, { _id: viewerId }), 'viewer');
    });

    await t.test('unaffiliated user cannot push and has viewer role', () => {
        assert.equal(canUserPushToRepo(repoDoc, { _id: strangerId }), false);
        assert.equal(getUserRepoRole(repoDoc, { _id: strangerId }), 'viewer');
    });

    await t.test('unauthenticated user cannot push and has guest role', () => {
        assert.equal(canUserPushToRepo(repoDoc, null), false);
        assert.equal(getUserRepoRole(repoDoc, null), 'guest');
    });
});

test('gitHelpers: generateUnifiedDiff', async (t) => {
    await t.test('identical content has 0 additions and 0 deletions', () => {
        const res = generateUnifiedDiff('hello world\n', 'hello world\n');
        assert.equal(res.additions, 0);
        assert.equal(res.deletions, 0);
    });

    await t.test('modified content accurately counts additions and deletions', () => {
        const res = generateUnifiedDiff('line 1\nline 2\n', 'line 1\nline 2 modified\nline 3\n');
        assert.ok(res.additions > 0);
        assert.ok(res.diffText.includes('+line 3'));
    });

    await t.test('rejects oversized inputs (>200k chars) with warning', () => {
        const huge = 'a'.repeat(250000);
        const res = generateUnifiedDiff(huge, huge);
        assert.equal(res.diffText, 'File is too large to display diffs.');
    });
});

test('native-merge: three-way merge state machine', async (t) => {
    await t.test('clean merge keeps modified file when only one side changed', async () => {
        const res = await nativeMerge.performMergeAsync({
            baseTree: JSON.stringify({ 'file.txt': 'base_hash' }),
            oursTree: JSON.stringify({ 'file.txt': 'base_hash' }),
            theirsTree: JSON.stringify({ 'file.txt': 'modified_hash' }),
        });
        assert.equal(res.success, true);
        assert.equal(res.conflictFiles.length, 0);
        const merged = JSON.parse(res.mergedTree);
        assert.equal(merged['file.txt'], 'modified_hash');
    });

    await t.test('flags conflict on modify vs delete (theirs deleted, ours modified)', async () => {
        const res = await nativeMerge.performMergeAsync({
            baseTree: JSON.stringify({ 'a.txt': 'v1' }),
            oursTree: JSON.stringify({ 'a.txt': 'v2' }),
            theirsTree: JSON.stringify({}),
        });
        assert.equal(res.success, false);
        assert.deepEqual(res.conflictFiles, ['a.txt']);
    });

    await t.test('flags conflict on delete vs modify (ours deleted, theirs modified)', async () => {
        const res = await nativeMerge.performMergeAsync({
            baseTree: JSON.stringify({ 'a.txt': 'v1' }),
            oursTree: JSON.stringify({}),
            theirsTree: JSON.stringify({ 'a.txt': 'v2' }),
        });
        assert.equal(res.success, false);
        assert.deepEqual(res.conflictFiles, ['a.txt']);
    });

    await t.test('flags conflict on both modified differently', async () => {
        const res = await nativeMerge.performMergeAsync({
            baseTree: JSON.stringify({ 'a.txt': 'v1' }),
            oursTree: JSON.stringify({ 'a.txt': 'v2' }),
            theirsTree: JSON.stringify({ 'a.txt': 'v3' }),
        });
        assert.equal(res.success, false);
        assert.deepEqual(res.conflictFiles, ['a.txt']);
    });

    await t.test('fails loudly on malformed JSON tree instead of silent fallback', async () => {
        await assert.rejects(
            async () => {
                await nativeMerge.performMergeAsync({
                    baseTree: 'not a json string',
                    oursTree: '{}',
                    theirsTree: '{}',
                });
            },
            /Failed to parse base_tree/
        );
    });
});

test('binary-encoding: base64 and binary blob handling', async (t) => {
    const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0xFF, 0xFE, 0xC3, 0x28, 0x00]);
    const b64 = PNG_BYTES.toString('base64');

    await t.test('Buffer round-trips binary PNG magic bytes via base64', () => {
        const decoded = Buffer.from(b64, 'base64');
        assert.deepEqual(decoded, PNG_BYTES);
    });

    await t.test('binary size matches byte length rather than base64 string length', () => {
        const decoded = Buffer.from(b64, 'base64');
        assert.equal(decoded.length, PNG_BYTES.length);
        assert.equal(PNG_BYTES.length, 10);
        assert.ok(b64.length > PNG_BYTES.length);
    });
});

