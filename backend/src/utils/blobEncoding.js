/**
 * Blob payload decoding for GitObject documents.
 *
 * The Rusty CLI pushes EVERY object — text or binary — as base64 with
 * `encoding: 'base64'` (see rusty/src/remote.rs `WIRE_ENCODING`). This is
 * what fixed the binary-corruption audit finding: base64 is loss-free for
 * arbitrary bytes.
 *
 * But several server-side and web consumers read `GitObject.data` raw
 * (assuming plain UTF-8 from the old upload path), so any file pushed by
 * the CLI — including "hello.txt" — reached the web viewer still
 * base64-wrapped, and the frontend classified it as a binary file.
 *
 * Consumers must use these helpers when they need the *actual bytes*:
 *   - decodeGitBlobBytes(obj) -> Buffer
 *   - looksLikeText(buffer)   -> boolean (NUL byte / control-char sniffing)
 *
 * The CLI wire protocol itself (GET /objects/:hash, POST /objects/batch-get)
 * is NOT changed — the CLI verifies payloads against their hash and must
 * keep receiving exactly what was stored, encoding marker included.
 */
const LEGACY_BINARY_SAMPLE_LENGTH = 8000;

/**
 * Return the true bytes of a GitObject, unwrapping the base64 transport
 * layer when the object was stored with `encoding: 'base64'`.
 */
function decodeGitBlobBytes(obj) {
    if (!obj || obj.data === undefined || obj.data === null) {
        return Buffer.alloc(0);
    }

    if (obj.encoding === 'base64') {
        return Buffer.from(String(obj.data), 'base64');
    }

    // 'utf8' or pre-encoding-era payloads: stored as UTF-8 text.
    return Buffer.from(String(obj.data), 'utf8');
}

/**
 * Heuristically decide whether decoded bytes are displayable text,
 * mirroring Git's is_binary detection in spirit:
 *   - empty buffers are treated as text
 *   - a NUL byte in the sample is always binary
 *   - otherwise, small amounts of stray control characters are tolerated,
 *     heavy control usage is binary
 */
function looksLikeText(buffer) {
    if (!buffer || buffer.length === 0) return true;

    const sample = buffer.subarray(0, LEGACY_BINARY_SAMPLE_LENGTH);

    if (sample.includes(0)) return false;

    let controlBytes = 0;

    for (const byte of sample) {
        if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
            controlBytes++;
        }
    }

    return controlBytes <= Math.max(2, Math.floor(sample.length * 0.02));
}

/**
 * Convenience: true when the stored blob decodes to plausible text and can
 * be rendered / diffed as UTF-8.
 */
function isTextBlob(obj) {
    return looksLikeText(decodeGitBlobBytes(obj));
}

module.exports = {
    decodeGitBlobBytes,
    looksLikeText,
    isTextBlob,
};
