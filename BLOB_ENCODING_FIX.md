# Fix: text files pushed by the CLI showed as "Binary file — preview not available" on the web

**Date:** 2026-11-08
**Root cause tier:** `git_version_control` (server + one service)
**Flash symptom:** open any `.txt` (or `.md`, `.json`, `.js`, …) pushed with the Rusty CLI in the web code viewer → "Binary file (N bytes) — preview not available". Also affected PR diffs and the IDE codespace.

---

## 1. Root cause

When the binary-corruption audit finding was fixed on the CLI side (`rusty/src/remote.rs`, `WIRE_ENCODING = "base64"`), the Rusty CLI started pushing **every object** — text and binary — as base64 with `encoding: "base64"`. That is the *correct* transport encoding: base64 is loss-free for arbitrary bytes, and the CLI round-trips hashes correctly (verified both directions).

What was missing: three server-side consumers that read raw `GitObject.data` and were still written against the old "everything is UTF-8" convention:

| Consumer | Before | Result |
|---|---|---|
| `repo.git.controller.js → getRepoBlob` (web file viewer) | returned the base64 string with `encoding: 'base64'` | frontend `CodeTab.jsx` sees `encoding === 'base64'` → shows **"Binary file — preview not available"** for every CLI-pushed text file |
| `repo.git.controller.js → compareBranches` (PR/compare diffs) | `getBlob` returned `obj.data` raw | diffs were computed against base64 text — whole-file garbage diffs |
| `ide.route.js → load-codespace` (web IDE) | wrote `blobObj.data` raw into the workspace | CLI-pushed files appeared inside the IDE as base64 mush |

The web-upload path (web editor, codespace pushes) stores plain UTF-8 without the marker, so these consumers had "worked" until CLI pushes appeared.

## 2. The fix

### New helper: `backend/src/utils/blobEncoding.js`

- `decodeGitBlobBytes(obj) -> Buffer` — unwraps the base64 transport layer when `encoding === 'base64'`, otherwise decodes UTF-8. Always returns the **true original bytes**.
- `looksLikeText(buffer) -> boolean` — content sniffing, in the spirit of Git's binary detection: empty → text; **any NUL byte → binary**; tolerated small amounts of stray control chars (tab/CR/LF excluded); heavy control usage → binary.
- `isTextBlob(obj)` — convenience combination.

### Consumer changes

1. **`getRepoBlob`** — decodes the blob; if the bytes are plausible text it serves `content` as UTF-8 with `encoding: 'utf8'`; if truly binary it keeps the base64 payload with `encoding: 'base64'` (so the UI still offers binary preview/byte-exact download). `size` is now the true byte length on disk, not the base64 string length.
2. **`compareBranches`** — decodes both diff sides, decides text-vs-binary **by content, not just extension** (a `.txt` that actually contains binary bytes is diffed as binary), and diffs text properly. Pre-existing `isBinaryExt` extension logic is kept and combined with content sniffing.
3. **`load-codespace`** (single-file and repo modes) — decodes blobs and writes text as UTF-8 strings, binary blobs as **Buffers**.
4. **`file.service.js → updateFile`** — accepts a `Buffer` and writes it byte-exact (`fs.writeFile` without forcing `utf8`).

### Deliberately NOT changed (scope decision)

- **The CLI wire protocol** (`GET /objects/:hash`, `POST /objects/batch-get`, `batch-store`) — the Rusty CLI verifies payload bytes against their hash; it must keep receiving exactly what was stored, marker included. Changing it would re-open the corruption class the encoding fix closed.
- **Fork/merge object copies** (`repo.core.controller.js`, `pr.controller.js`) — they copy blobs with data+encoding together, byte-exact. Correct as-is.
- **Frontend `CodeTab.jsx`** — its logic keys off the `encoding` field the API returns; with the backend now reporting `utf8` for text, text renders normally with zero frontend changes.
- **`push-codespace` binary round-trip** (pre-existing, flagged not fixed): `getAllFilesFlat` reads workspace files as UTF-8 text, so a *binary* file added inside the web IDE would be re-pushed lossy. Text is unaffected. Proper fix = capture bytes in the workspace walk + base64 on store; separate task.

## 3. Verification (done, live against your real backend)

Pushed through the fixed CLI to `arnav/encoding-smoke-test`:

- `hello.txt` → web blob endpoint now returns
  `content: "hello manual test on Sun Nov 8 …"`, `encoding: "utf8"`, `size: 69` → renders as text ✅
- `tiny.png` → returns `encoding: "base64"` with the base64 payload → binary preview + correct download ✅

`npm test`: **72/72 pass** (52 previous + 20 new `tests/blobEncoding.test.js` covering the decoder, the sniffing rules, and simulated `getRepoBlob` responses).

## 4. Manual test steps

1. Backend running (`npm run dev` in `backend/`; nodemon already hot-reloaded the fix — branch gate test confirms the new code is live).
2. Push any `.txt` from the CLI (`rusty add` + `commit` + `push` as usual).
3. Open the repo in the web UI → click the file → **text is shown with syntax highlighting** (no "Binary file" banner).
4. Push a real binary (`.png`) → viewer shows the image; PR-created binary files show "Binary file not shown" only for genuinely binary content.
5. Open the codespace for the repo → files show real text, not base64 soup; a pushed image is byte-exact on disk.
6. If you want a fast check without the web: `curl -s "$BASE/blob/<sha256-of-file>" -H "Authorization: Bearer $TOKEN"` → `encoding` must be `utf8` for text files.

## 5. Trade-offs to know

1. **Text/binary is now decided by content sniffing (NUL/controls), not solely by the `encoding` marker.** A UTF-16 text file (contains NULs) is treated as binary — same trade Git makes (git treats UTF-16 as binary for `diff`). Displaying it requires an explicit UTF-16 support decision later.
2. **`getRepoBlob` decodes on every read** — one extra Buffer allocation + one NUL-scan over up to 8 KB sample per view. Negligible vs the Mongo round-trip; full-file scan only through the already-streaming paths.
3. **`size` semantic changed slightly** — it was the base64 string length for CLI blobs; it is now the true byte length (which is what the UI showed in "Binary file (N bytes)" anyway, since it computed `Buffer.from(data,'base64').length` before).
4. **Legacy pre-encoding-era binary blobs** (pushed before the corruption fix, already destroyed by UTF-8 lossy conversion) are re-wrapped as base64 and shown as binary — they were already unrecoverable; no regression, just cleaner presentation.
5. **Codespace push of binaries is still lossy** (pre-existing, see above). If you edit a PNG inside the web IDE and push, that push damages the image. Text files are fully round-trip safe.
