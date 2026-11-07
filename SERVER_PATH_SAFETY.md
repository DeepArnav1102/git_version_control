# Server-side hardening: remote-supplied names are never written as paths

**Date:** 2026-11-08
**Companion work:** `../rusty/FIX_must-fix-2_remote-path-traversal.md` (AUDIT.md "Must fix" finding 2, client side)
**Related:** `../rusty/AUDIT.md` — the same trust-boundary class of bug, on the platform tier

---

## 1. Why this repo needed the same fix

The Rusty CLI now treats *everything this server tells it* as untrusted: branch names from `/refs`, tree entry names inside tree objects, and object hashes. Client-side (`rusty/src/path_check.rs`) every such name is validated before it becomes a path, and every write is verified to stay inside the repository.

That only works if the two layers agree. This backend is the **origin** of those names, and it had three gaps:

1. **Branch names were under-validated.** `updateRef` used the flat regex
   `/^[a-zA-Z0-9_\-\.\/]+$/`, which *accepts* `../evil`, `a/../b`, `.`, and trailing
   `/`. A branch stored with such a name would be served by `/refs` to every Rusty
   client, where pre-fix clients wrote it as `refs/remotes/origin/../evil` (the
   reproduced arbitrary write; post-fix clients refuse — but the repo then stays
   broken for overly-restrictive clients). Validation must match on **both** ends.

2. **Tree entry names were never validated at all.** `storeObject` /
   `storeObjectsBatch` checked the hash shape and the object type, but never parsed
   tree payloads. A hostile tree (`{"entries":[{"name":"../../pwned.txt",…}]}`) sat
   in MongoDB forever and flowed into every consumer of tree data.

3. **The same names reached path-shaped sinks on the server tier:**
   - **ZIP download** — `downloadRepoZip` passes `flattenTree` keys straight into
     `archive.append(buffer, { name })`. A tree entry named `../..` becomes a ZIP
     entry whose *extraction on the user's machine* writes outside the target
     folder (zip-slip). This is the exact analogue of the client finding, delivered
     via archive.
   - **PR merges** — `flattenTree` feeds `native-merge` (pure BTreeMap logic in
     Rust — no filesystem use, nothing to fix there), whose output is persisted by
     `buildAndSaveTree`. Without validation, hostile path segments are *re-published
     into the merged tree* and propagate to forks, codespaces, zips, and CLI clients.
   - **Codespaces** — `load-codespace` writes repo files to the host workspace via
     `FileService.updateFile`. `getSecurePath` (resolve + `startsWith`) already
     prevented the escape (verified — the workspace write is the one sink that was
     already safe), but a hostile tree made codespace load fail mid-flight with a
     500. Fail-fast is better than a confusing 500, and now also happens earlier.

## 2. What changed

### New module: `backend/src/utils/pathSafety.js`

One module owns every ingress rule, mirroring `rusty/src/path_check.rs` name-for-name:

| Function | Used for | Rules |
|---|---|---|
| `isSafeComponent` / `assertSafeComponent` | tree entry names; each segment of a branch name | non-empty, ≤255 chars, never `.`/`..`, no `/`, `\`, `:`, NUL/control chars, no Windows reserved device names (`NUL`, `CON`, `COM1…`, `LPT1…`, including `NUL.txt`) |
| `isSafeRelativePath` / `assertSafeRelativePath` | flat-tree keys (`"src/lib/main.js"`) before they become tree entry names | slash-separated under `isSafeComponent`, plus no leading `/` |
| `isSafeBranchName` / `assertSafeBranchName` | branch names on `/refs` pushes and `defaultBranch` | keeps the legacy charset (letters/digits/`_-.`), rejects `.`/`..`/empty segments, leading-trailing slashes, `//`, reserved names; ≤255 |
| `parseObjectPayload` | decode pushed object data strictly (raw JSON, base64-marked, or legacy unmarked base64) | never a "return the raw string" fallback — parsing must succeed or the check fails |
| `findUnsafeTreeEntryName` | find the first offending entry name in a parsed tree | any non-string or unsafe name is reported verbatim for the error message |

### Ingress gates (where hostile names are now refused)

- **`repo.cli.controller.js → updateRef`** — per-segment branch validation replaces
  the flat regex. `../evil` can never enter `Repository.branches`.
- **`repo.cli.controller.js → storeObject`** — tree payloads are parsed and entry
  names validated; a hostile tree gets `400` and is never stored.
- **`repo.cli.controller.js → storeObjectsBatch`** — same gate, applied per object.
  **Deliberately throws for the whole batch instead of silently skipping** the bad
  object: a skipped object would let the pushing client conclude the push succeeded
  while its history stays incomplete (an integrity lie, not just validation).
- **`repo.core.controller.js → updateRepo`** — `defaultBranch` validated the same
  way, closing the free-form branch name slot (`createRepo` hardcodes `'main'`,
  which was already safe).

### Downstream chokepoints (so names that predate this fix can't hurt either)

DBs accumulate: trees pushed *before* these gates still contain old data, so the
sinks are also guarded — this is the "verify at the write boundary" layer from the
client fix:

- **`gitHelpers.js → flattenTree`** — every entry name is validated while the tree
  is flattened. This single function is the chokepoint for **all three sinks**
  (ZIP, merge, codespace), exactly like `collect_tree_files` in the client.
  Throws `422 Unprocessable Entity` with the offending name — fail-closed.
- **`gitHelpers.js → buildAndSaveTree`** — every flat-tree key is validated before
  it is re-assembled into tree entries and persisted (merge output, web editor
  trees, codespace pushes).

### Explicitly *not* changed

- **`native-merge/src/lib.rs`** — verified: it only operates on `BTreeMap<String,
  String>` of `path → hash`, never touches a filesystem. Path validation belongs at
  the JS boundaries; adding it inside the native merge would just duplicate.
- **`FileService.getSecurePath`** — already correct (`resolve` + `startsWith`;
  the pre-existing `helpers.test.js` covers traversal and sibling-prefix
  collisions). Workspace provisioning (`load-codespace`) wipes the workspace on
  load, so its writes cannot pass through a pre-planted symlink.
- **Display-only consumers** (web file browser, commit map, `/tree` previews) —
  entry names are rendered as text there, never used to build paths; refusing them
  display-side would only hurt honest reads of old data.

## 3. Tests

`backend/tests/pathSafety.test.js` — 29 new subtests on top of the existing suite
(`node --test`, no new dependencies):

- component rules (normal names, `.`/`..`, separators, drive letters, control
  chars, Windows reserved names including `nul.txt`, oversize, non-string types)
- relative-path rules incl. `/abs`, `a//b`, trailing slash, the audit's exploit string
- branch rules incl. parity with the old allowed charset (no legit branch breaks)
- `parseObjectPayload` for all three wire formats Rusty uses (plain JSON,
  base64-with-marker, legacy unmarked base64) and garbage → `null`
- `findUnsafeTreeEntryName` — clean, traversal, backslash, drive-name, malformed
- an end-to-end simulation of the batch-store gate: exactly what arrives on
  `/objects/batch-store` when a hostile client pushes the audit tree

**Result: 52/52 tests pass** (22 pre-existing unchanged + 30 new).
`node --check` passes on all four modified files.

## 4. Trade-offs and behavior changes — what you should know

1. **Strictness parity was chosen over uniformity.** The Rust client's
   `validate_ref_path` allows unicode segment names; the server's branch check
   keeps the historical `[A-Za-z0-9_.-]` set for branches deliberately (branch
   names, unlike file names, had a legal, deployed charset here). File path
   components allow unicode on both ends. The practical effect: `branch:stream`,
   `a//b`, `../x` are rejected on both ends; `Ω-main` is rejected by the server for
   branches but fine as a file name on both.
2. **Hostile trees now fail a batch push atomically** (400) instead of being
   silently skipped. Legitimate pushes from the Rusty CLI (which builds trees from
   real files) are unaffected; only trees with impossible names are punished, and
   the client surfaces the exact entry name in the error.
3. **Old poisoned data surfaces at sink time, is rejected at ingest forever after.**
   A repo already containing a hostile tree (pushed pre-fix) will fail PR merge,
   ZIP download, and codespace load with a clear `422` naming the offending path —
   it no longer fails *silently wrong* (zip-slip) or cryptically (codespace 500
   "Access Denied"). Cleaning it up requires a maintenance job to rewrite the tree
   objects or delete the commit; that's a data fix, out of scope for this change.
4. **Cost:** a `JSON.parse` + entry scan per pushed tree and one regex-free
   validation per flattened entry. Trees are typically tens of entries; this is
   nanoseconds-to-microseconds against a MongoDB round trip already in flight, and
   `flattenTree`'s depth-batched pipeline (its whole reason to exist) is untouched.
5. **Windows reserved-name check applies on all platforms.** A branch named `NUL`
   is rejected even on Linux builds of the server — intentional, because the name
   will be *written to disk later on a Windows client*, where the check matters.
6. **What still deserves attention** (flagged, not fixed here):
   - The `/refs` push endpoint accepts 40–64-char hashes `[a-f0-9]{40,64}` (SHA-1
     lengths are accepted alongside SHA-256). The Rusty CLI only produces 64-hex;
     tightening to a single schema would prevent mixed-length hash artifacts, but
     risks compatibility with other hypothetical clients. Left as-is on purpose.
   - `checkObjectsBatch`/`checkObjectExists` use hashes only as Mongo query values
     (no path use) — verified safe, no gate needed.
   - The web editor's file-delete route (`deleteFileFromTree`) only performs
     in-tree Mongo edits, no filesystem writes — no gate needed.

## 5. Quick review map

- `git diff src/utils/pathSafety.js` — the rules; ~230 lines, zero new dependencies
- `git diff src/controllers/repo.cli.controller.js` — 3 gates: `updateRef`,
  `storeObject`, `storeObjectsBatch`
- `git diff src/utils/gitHelpers.js` — 2 chokepoints: `flattenTree`, `buildAndSaveTree`
- `git diff src/controllers/repo.core.controller.js` — 1 gate: `defaultBranch`
- `git diff tests/pathSafety.test.js` — the guarantees, runnable with existing `npm test`

## 6. One-line summary

The server now validates every name at the moment a client supplies it (branch
names, tree entry names, `defaultBranch`) and re-verifies every path right before
it becomes a ZIP entry, a new tree object, or a codespace file — the same
fail-closed, two-layer posture the Rusty CLI just adopted, so a hostile client can
no longer plant traversal paths in the object store and a hostile publisher can no
longer push them in either.
