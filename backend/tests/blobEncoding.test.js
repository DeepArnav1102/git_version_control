const test = require('node:test');
const assert = require('node:assert/strict');

const {
    decodeGitBlobBytes,
    looksLikeText,
    isTextBlob,
} = require('../src/utils/blobEncoding');

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0xFF, 0xFE, 0xC3, 0x28, 0x00]);
const TEXT = 'hello $(date) world\nline two\nline three\n';

test('blobEncoding: decodeGitBlobBytes unwraps base64 transport layer', async (t) => {
    await t.test('decodes base64-marked payloads to exact original bytes', () => {
        const obj = { data: PNG_BYTES.toString('base64'), encoding: 'base64' };

        assert.deepEqual(decodeGitBlobBytes(obj), PNG_BYTES);
    });

    await t.test('decodes text pushed by the Rusty CLI back to plain UTF-8', () => {
        const obj = { data: Buffer.from(TEXT, 'utf8').toString('base64'), encoding: 'base64' };

        assert.equal(decodeGitBlobBytes(obj).toString('utf8'), TEXT);
    });

    await t.test('unmarked payloads decode as UTF-8 (web editor history)', () => {
        const obj = { data: TEXT };

        assert.deepEqual(decodeGitBlobBytes(obj), Buffer.from(TEXT, 'utf8'));
    });

    await t.test('explicit utf8 marker decodes as UTF-8', () => {
        const obj = { data: TEXT, encoding: 'utf8' };

        assert.deepEqual(decodeGitBlobBytes(obj), Buffer.from(TEXT, 'utf8'));
    });

    await t.test('missing or null data yields an empty buffer, not a crash', () => {
        assert.deepEqual(decodeGitBlobBytes(null), Buffer.alloc(0));
        assert.deepEqual(decodeGitBlobBytes({}), Buffer.alloc(0));
        assert.deepEqual(decodeGitBlobBytes({ data: null }), Buffer.alloc(0));
    });
});

test('blobEncoding: looksLikeText content sniffing', async (t) => {
    await t.test('empty content counts as text', () => {
        assert.equal(looksLikeText(Buffer.alloc(0)), true);
    });

    await t.test('plain ASCII and unicode text counts as text', () => {
        assert.equal(looksLikeText(Buffer.from(TEXT, 'utf8')), true);
        assert.equal(looksLikeText(Buffer.from('Ünïcode 日本語 file\n', 'utf8')), true);
    });

    await t.test('any NUL byte makes content binary', () => {
        assert.equal(looksLikeText(PNG_BYTES), false);          // PNG magic has NULs
        assert.equal(looksLikeText(Buffer.from([0x61, 0x00, 0x62])), false);
    });

    await t.test('newlines, tabs and carriage returns are NOT binary indicators', () => {
        assert.equal(looksLikeText(Buffer.from('a\r\nb\tc\n', 'utf8')), true);
    });

    await t.test('heavy stray control characters make content binary', () => {
        const noisy = Buffer.from(Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 0x07 : 0x41)));
        assert.equal(looksLikeText(noisy), false);
    });

    await t.test('a couple of stray control characters are tolerated (text)', () => {
        assert.equal(looksLikeText(Buffer.from([0x41, 0x41, 0x07, 0x42])), true); // 1/4 > 2 threshold edge — uses max(2, ...)
    });
});

test('blobEncoding: isTextBlob end-to-end decision for stored objects', async (t) => {
    await t.test('CLI-pushed .txt (base64-wrapped) is TEXT', () => {
        const obj = { data: Buffer.from(TEXT, 'utf8').toString('base64'), encoding: 'base64' };

        assert.equal(isTextBlob(obj), true);
        assert.equal(decodeGitBlobBytes(obj).toString('utf8'), TEXT);
    });

    await t.test('CLI-pushed .png (base64-wrapped) is BINARY', () => {
        const obj = { data: PNG_BYTES.toString('base64'), encoding: 'base64' };

        assert.equal(isTextBlob(obj), false);
    });

    await t.test('web-editor-pushed .txt (unmarked UTF-8) is TEXT', () => {
        assert.equal(isTextBlob({ data: TEXT }), true);
    });
});

test('blobEncoding: getRepoBlob response contract simulated', async (t) => {
    await t.test('text blob: content decoded, encoding reported as utf8, size = byte length', () => {
        const blobObj = {
            hash: 'a'.repeat(64),
            data: Buffer.from(TEXT, 'utf8').toString('base64'),
            encoding: 'base64',
        };

        const bytes = decodeGitBlobBytes(blobObj);
        const textContent = looksLikeText(bytes) ? bytes.toString('utf8') : null;

        assert.notEqual(textContent, null);
        assert.equal(textContent, TEXT);
        assert.equal(bytes.length, Buffer.byteLength(TEXT, 'utf8'));
    });

    await t.test('binary blob: raw base64 kept, encoding stays base64', () => {
        const blobObj = {
            hash: 'b'.repeat(64),
            data: PNG_BYTES.toString('base64'),
            encoding: 'base64',
        };

        const bytes = decodeGitBlobBytes(blobObj);
        const textContent = looksLikeText(bytes) ? bytes.toString('utf8') : null;

        assert.equal(textContent, null);
        assert.deepEqual(bytes, PNG_BYTES);
    });
});
