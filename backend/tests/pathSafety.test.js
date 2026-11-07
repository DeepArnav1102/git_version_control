const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isSafeComponent,
    assertSafeComponent,
    isSafeRelativePath,
    assertSafeRelativePath,
    isSafeBranchName,
    assertSafeBranchName,
    parseObjectPayload,
    findUnsafeTreeEntryName,
} = require('../src/utils/pathSafety');

test('pathSafety: single components (tree entry names)', async (t) => {
    await t.test('accepts normal file and directory names', () => {
        for (const name of ['README.md', 'src', 'main.rs', 'file name.txt', 'Мой-файл', 'a..b']) {
            assert.equal(isSafeComponent(name), true, name);
        }
    });

    await t.test('rejects directory shortcuts and empty names', () => {
        for (const name of ['', '.', '..']) {
            assert.equal(isSafeComponent(name), false, JSON.stringify(name));
        }
    });

    await t.test('rejects path separators inside a single name', () => {
        for (const name of ['a/b', 'a\\b', 'a/../b']) {
            assert.equal(isSafeComponent(name), false, name);
        }
    });

    await t.test('rejects drive-letter and alternate-data-stream syntax', () => {
        for (const name of ['C:', 'C:evil', 'file:stream']) {
            assert.equal(isSafeComponent(name), false, name);
        }
    });

    await t.test('rejects control characters and NUL', () => {
        assert.equal(isSafeComponent('a\nb'), false);
        assert.equal(isSafeComponent('a\tb'), false);
        assert.equal(isSafeComponent('a\0b'), false);
    });

    await t.test('rejects Windows reserved device names, including with extension', () => {
        for (const name of ['NUL', 'nul.txt', 'CON', 'COM1', 'lpt9.txt']) {
            assert.equal(isSafeComponent(name), false, name);
        }
    });

    await t.test('rejects types that cannot be names and oversized components', () => {
        assert.equal(isSafeComponent(undefined), false);
        assert.equal(isSafeComponent(null), false);
        assert.equal(isSafeComponent(42), false);
        assert.equal(isSafeComponent('a'.repeat(256)), false);
    });

    await t.test('assertSafeComponent throws ApiError with status 400', () => {
        assert.throws(() => assertSafeComponent('../pwned.txt', 'Tree entry'), (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /unsafe name/);
            return true;
        });
    });
});

test('pathSafety: repository-relative paths (flat tree keys)', async (t) => {
    await t.test('accepts normal nested paths', () => {
        for (const p of ['src/index.js', 'a/b/c/d.txt', 'README.md', 'docs/read me.md']) {
            assert.equal(isSafeRelativePath(p), true, p);
        }
    });

    await t.test('rejects traversal, absolute, and malformed paths', () => {
        for (const p of ['', '../pwned.txt', 'a/../b', 'src/../../../etc/passwd', '/abs/path.txt', 'a//b', 'a/', 'C:pwned.txt', 'a\\b']) {
            assert.equal(isSafeRelativePath(p), false, p);
        }
    });

    await t.test('assertSafeRelativePath throws ApiError with status 400', () => {
        assert.throws(() => assertSafeRelativePath('../x.js', 'Tree path'), (err) => {
            assert.equal(err.statusCode, 400);
            return true;
        });
    });
});

test('pathSafety: branch names pushed to /refs', async (t) => {
    await t.test('accepts usual branch names (legacy regex parity)', () => {
        for (const name of ['main', 'master', 'feature/login-page', 'release/v2.0', 'dev-2', 'my_branch.dots']) {
            assert.equal(isSafeBranchName(name), true, name);
        }
    });

    await t.test('rejects traversal that the old flat regex allowed', () => {
        for (const name of ['../evil', 'a/../b', 'feature/../../pwned', '.', '..', 'a//b', 'a/', '/abs', '', 'branch:stream', 'a\\b']) {
            assert.equal(isSafeBranchName(name), false, name);
        }
    });

    await t.test('rejects Windows reserved names for consistency with the Rusty CLI', () => {
        assert.equal(isSafeBranchName('NUL'), false);
    });

    await t.test('rejects over-length names', () => {
        assert.equal(isSafeBranchName('a'.repeat(256)), false);
    });

    await t.test('assertSafeBranchName throws ApiError with status 400', () => {
        assert.throws(() => assertSafeBranchName('../evil'), (err) => {
            assert.equal(err.statusCode, 400);
            assert.match(err.message, /branch name/i);
            return true;
        });
    });
});

test('pathSafety: pushed tree object payloads', async (t) => {
    const tree = {
        entries: [
            { name: 'src', object_hash: 'a'.repeat(64), object_type: 'tree' },
            { name: 'index.js', object_hash: 'b'.repeat(64), object_type: 'blob' },
        ],
    };

    await t.test('parses plain JSON payloads', () => {
        assert.deepEqual(parseObjectPayload(JSON.stringify(tree), undefined), tree);
    });

    await t.test('parses base64-marked payloads (Rusty CLI wire format)', () => {
        const encoded = Buffer.from(JSON.stringify(tree), 'utf8').toString('base64');
        assert.deepEqual(parseObjectPayload(encoded, 'base64'), tree);
    });

    await t.test('falls back to unmarked base64 (legacy clients)', () => {
        const encoded = Buffer.from(JSON.stringify(tree), 'utf8').toString('base64');
        assert.deepEqual(parseObjectPayload(encoded, undefined), tree);
    });

    await t.test('returns null on garbage instead of a raw fallback string', () => {
        assert.equal(parseObjectPayload('not json {{{', undefined), null);
        assert.equal(parseObjectPayload('???', 'base64'), null);
        assert.equal(parseObjectPayload(undefined, undefined), null);
    });

    await t.test('findUnsafeTreeEntryName returns null for clean trees', () => {
        assert.equal(findUnsafeTreeEntryName(tree), null);
    });

    await t.test('findUnsafeTreeEntryName catches traversal entry names', () => {
        const hostile = {
            entries: [
                { name: 'docs', object_hash: 'a'.repeat(64), object_type: 'tree' },
                { name: '../../pwned.txt', object_hash: 'b'.repeat(64), object_type: 'blob' },
            ],
        };
        assert.equal(findUnsafeTreeEntryName(hostile), '../../pwned.txt');
    });

    await t.test('findUnsafeTreeEntryName catches backslash and drive names', () => {
        assert.equal(
            findUnsafeTreeEntryName({ entries: [{ name: 'weird\\name', object_hash: 'c'.repeat(64) }] }),
            'weird\\name'
        );
        assert.equal(
            findUnsafeTreeEntryName({ entries: [{ name: 'C:evil', object_hash: 'c'.repeat(64) }] }),
            'C:evil'
        );
    });

    await t.test('findUnsafeTreeEntryName tolerates malformed trees without crashing', () => {
        assert.equal(findUnsafeTreeEntryName(null), null);
        assert.equal(findUnsafeTreeEntryName({}), null);
        assert.equal(findUnsafeTreeEntryName({ entries: [] }), null);
        // Missing name -> treated as unsafe (reported as empty string), the
        // caller must reject the object.
        assert.equal(findUnsafeTreeEntryName({ entries: [{ object_hash: 'x' }] }), '');
        // Non-string names are rejected too, but the offender is reported
        // back verbatim so error messages can show it ("42 !== null").
        assert.notEqual(findUnsafeTreeEntryName({ entries: [{ name: 42 }] }), null);
    });
});

test('pathSafety: end-to-end ingest gate simulation (storeObject tree rejection)', async (t) => {
    // Mirrors the exact gate added to repo.cli.controller.js store paths:
    // a pushed tree object whose entry contains traversal must be rejected.
    const hostileTree = {
        entries: [{ name: '../pwned.txt', object_hash: 'b'.repeat(64), object_type: 'blob' }],
    };
    const wireData = Buffer.from(JSON.stringify(hostileTree), 'utf8').toString('base64');

    const parsedTree = parseObjectPayload(wireData, 'base64');
    const unsafeName = findUnsafeTreeEntryName(parsedTree);

    assert.notEqual(unsafeName, null, 'gate must fire');
    assert.throws(() => {
        throw new (require('../src/utils/ApiError'))(400, `Tree object rejected: entry name "${unsafeName}" is not a safe path`);
    }, /not a safe path/);
});
