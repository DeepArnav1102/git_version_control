# Repo audit: git_version_control

**Date:** 2026-10-22 — read-only audit, no code changed.

**What this repo does:** A GitHub-like platform, coded from scratch: Node/Express + MongoDB backend stores git objects as documents, a web IDE runs user code in Docker containers, a Rust N-API addon does 3-way merges, and a Rust CLI (`rusty/`) pushes and pulls. React frontend on Vite.

**Load assumed:** a few users at once on one Node process (3 real contributors on GitHub), but the core is a public platform, so data-exposure bugs count as much as crashes.

Order: bugs and security first, then scale, tests, lean.

---

## Must fix

1. **Anyone can fork a private repo and become its owner** (`backend/src/controllers/repo.core.controller.js:345-405`)
   - **What this is:** The fork endpoint copies the source repo's object store into a new repo owned by the caller.
   - **Problem:** There is no `isPrivate` check anywhere in `forkRepo` (`resolveRepo` resolves private repos too). Any logged-in user can `POST /repos/<victim>/<private-repo>/fork` and receive a complete copy of every blob, tree and commit of a private repo, as their own repo. Confirmed by reading the code, not by running it.
   - **Fix:** Three lines: after `resolveRepo`, `if (sourceRepo.isPrivate && sourceRepo.owner.toString() !== req.user._id.toString() && !isCollaborator) throw new ApiError(404/403)` — reusing the check pattern from `getRepoDetails:167`.
   - **If we skip it:** "Private" is a UI label only, and forks are silent — no error ever tells the victim.

2. **Terminal WebSocket trusts an unsigned JWT; guests share one workspace** (`backend/src/services/terminal.service.js:28-46, 110-131`)
   - **What this is:** The `/ws/terminal` upgrade reads the JWT cookie, but only `jwt.decode` — no signature check — and picks `workspaceId = decoded.userId`, falling back to `guest_workspace` for everyone else.
   - **Problem:** Anyone can connect with a hand-written cookie payload `{"userId":"<victim id>"}` and get a root shell on the victim's workspace directory — including the `.env` file that `load-codespace` writes repo secrets into (`ide.route.js:143-149`). Anonymous users all land in the same `guest_workspace` folder, where they can read, overwrite and delete each other's files. The terminal container also gets network access (`NetworkDisabled: false`, no `CapDrop`, writable root), so untrusted shell code can reach the host's LAN and internal services.
   - **Fix:** Verify the JWT properly here (reuse `verifyAccessToken` from `token.service.js` after loading the user, same as `protect` middleware); give anonymous users a per-connection temp dir instead of one shared folder; set `NetworkDisabled: true` unless pip is explicitly allowed, and add `CapDrop: ['ALL']`.
   - **If we skip it:** The shell-in-a-box feature is an open door to every user's workspace data and the host network.

3. **Private repos readable without the privacy check on 8 endpoints** (`backend/src/controllers/repo.git.controller.js:106, 318, 570`; `backend/src/controllers/repo.cli.controller.js:133, 284, 462, 510, 630`)
   - **What this is:** `resolveRepo` finds a repo regardless of privacy; only blob and zip handlers re-check `isPrivate`.
   - **Problem:** Anonymous requests to `/tree`, `/commits`, `/compare/...` and authenticated requests to `/refs`, `/objects/:hash`, `/objects/batch-get` on a private repo return the full tree, commit history, diff, raw object data and branch refs to anyone. Any user with an account can download a private repo's complete content over the "CLI" endpoints.
   - **Fix:** Add the privacy check (owner or collaborator) to `resolveRepo` itself, passing `req.user` into one helper — one function, every endpoint covered.
   - **If we skip it:** Private repos keep leaking piecemeal, and every new endpoint forgets the check again.

4. **Blob lookup falls back to a global hash match, skipping the privacy check it just did** (`backend/src/controllers/repo.git.controller.js:299-304, 147-151, 205-209, 520-524`; `backend/src/utils/repoHelpers.js:47-51`)
   - **What this is:** After failing to find an object in this repo, handlers re-query `GitObject.findOne({ hash, type })` with no `repositoryId`.
   - **Problem:** Case: repo A was recently made private, or shares object hashes through an old fork; a user with no access to it requests hash of a file through `/repos/o/a/blob/<hash>` — the fallback hands over the private repo's blob because hashes are content addresses, not secrets.
   - **Fix:** Delete the fallback queries; objects only resolve within the repo being asked (the fork flow already copies objects, so nothing depends on cross-repo lookup).
   - **If we skip it:** Knowing one hash is enough to defeat the check that the preceding code deliberately performed.

5. **Stored XSS: user README rendered as raw HTML** (`frontend/src/components/repo/ReadmeBox.jsx:39-42`)
   - **What this is:** README.md is rendered with `react-markdown` plus `rehypeRaw`.
   - **Problem:** A public repo with `<img src=x onerror=...>` in its README runs script in every viewer's browser. The session cookie is HttpOnly, but the attacker's script can still call the API as the victim (create PATs, delete repos) since cookies are sent automatically.
   - **Fix:** Delete `rehypeRaw` from the plugin list (react-markdown escapes everything by default) — one word.
   - **If we skip it:** One malicious repo spoofs the UI and takes over accounts of every visitor who opens it.

6. **Pull request pages ignore which repo they belong to, so private-repo PRs leak** (`backend/src/controllers/pr.controller.js:169-180, 182-205, 388-395`)
   - **What this is:** `getPullRequest`, `getPullRequestCommits` and `getPullRequestComments` fetch by PR id with no access check; the `:owner/:repo` URL params are never compared to the PR's target repo.
   - **Problem:** PR ids are sequential ObjectIds; any authenticated user can walk them and read titles, descriptions, diffs and comments of PRs on private repos they can't see.
   - **Fix:** After loading, verify `pr.targetRepo` is the repo in the URL and that repo passes the privacy/collaborator check (same helper as finding 3).
   - **If we skip it:** Scraping one collection leaks all private-team discussions.

7. **Real credentials sit in plaintext in `backend/.env`** (`backend/.env:1-29`)
   - **What this is:** MongoDB Atlas URL with password, Google OAuth secret, Gmail app password, Cloudinary keys, JWT secret, R2 keys.
   - **Problem:** It's untracked in this checkout (good), but these are live production credentials that have been sitting in plaintext next to a public GitHub repo; anyone with your machine or backups has full DB and mail access.
   - **Fix:** Rotate every value in the file (Atlas password, Gmail app password, R2, Cloudinary, ACCESS_TOKEN_SECRET), and keep .env out of git permanently.
   - **If we skip it:** One leaked file is a full account-and-database compromise.

## Should fix

8. **Concurrent pushes overwrite each other — commits get lost** (`backend/src/controllers/repo.cli.controller.js:399-443`; `backend/src/routes/ide.route.js:244-321`; `backend/src/controllers/pr.controller.js:362-379`)
   - **What this is:** Branch refs are updated by load-modify-`save()` on the whole `Repository` document (branch array not touched separately).
   - **Problem:** Case: two developers push different branches at the same moment, or one pushes while another merges a PR — both read the same `branches` array, and the second `save()` writes back its copy, dropping the first push's ref forever. Same pattern in star/follow (`repo.core.controller.js:304-343`).
   - **Fix:** Replace `read + save()` with one atomic `Repository.findOneAndUpdate({_id, 'branches.name': b}, {$set: {'branches.$.commitHash': c}})`, creating the branch with `upsert`/`$push` variants. Per-branch and star operations become collision-free.
   - **If we skip it:** Daily-use feature silently eats commits under concurrent users.

9. **Unauthenticated code-execution endpoint can drain the Docker host** (`backend/src/routes/ide.route.js:562-584`; `backend/src/app.js:17-24`)
   - **What this is:** `/api/v1/ide/run` needs no login and spawns one container per call for up to 10s; the only cap is the global 1000-requests/15min IP limiter.
   - **Problem:** One unknown IP can keep roughly 60+ containers running concurrently; each burns CPU/RAM/disk, and anonymous codespace actions all write into the shared `guest_workspace` folder, wiping each other mid-session.
   - **Fix:** Require login for `/ide/run` (or a small per-IP limiter at 20/min) and give each guest workspace its own random id, not the fixed string.
   - **If we skip it:** The platform's cheapest denial-of-service is a one-line curl loop — and you only have one Node process that pays for each container.

10. **Loading a repo into the IDE does one DB query and write per file** (`backend/src/routes/ide.route.js:112-133`)
    - **What this is:** `writeTreeToSandbox` calls `GitObject.findOne` for every blob plus two `FileService` calls per file.
    - **Problem:** A 2000-file repo means ~2000 queries and 4000 disk writes per load — seconds of latency and a queue of competing loads. The codebase already has the batched flattener (`gitHelpers.flattenTree`) the README advertises.
    - **Fix:** Flatten the tree once with `flattenTree`, fetch all blobs with one `$in` query, then write files from that map.
    - **If we skip it:** Repo loading time grows linearly with repo size and doubles server load for several users.

11. **Every commit-history request loads every commit in the repo** (`backend/src/controllers/repo.git.controller.js:330-337`; `backend/src/controllers/repo.core.controller.js:198-208`)
    - **What this is:** To walk the parent chain, requests fetch all commit documents for the repo (and for both repos in fork ahead/behind) then walk in memory.
    - **Problem:** A repo with 10,000 commits parses 10,000 documents (~10-30MB) on every history page view or repo-detail view; 20 concurrent users can push the process into GC trouble.
    - **Fix:** Walk the chain but batch: keep a frontier of the next ~64 parents and issue one `find({repositoryId, hash: {$in}})` per hop (the pattern `getCommitGraph` in `gitHelpers.js:64-74` already uses).
    - **If we skip it:** History pages get slower forever as repos age, and memory spikes regress under load.

12. **ZIP download builds the whole archive in RAM with one query per blob** (`backend/src/controllers/repo.git.controller.js:537-567`)
    - **What this is:** `AdmZip` collects every blob, then `zip.toBuffer()` produces one big buffer.
    - **Problem:** A 200MB repo spike ≈ 400MB RSS per download; a few concurrent downloads OOM the single Node process. Also one DB round-trip per file.
    - **Fix:** `archiver` is already in `package.json` — stream the zip (`archiver` + `$in` blob batches), and delete `adm-zip` here.
    - **If we skip it:** GitHub-style repo downloads become the crash vector.

13. **User-controlled regex in token-name lookups** (`backend/src/controllers/token.controller.js:26, 43, 77`)
    - **What this is:** Token names are interpolated straight into `new RegExp('^' + name + '$', 'i')`.
    - **Problem:** Case: `check-name?q=(((a+)+)+)$` — a crafted pattern backtracks catastrophically on every check; also `name = "h.llo"` matches unintended names since `.` isn't escaped.
    - **Fix:** Escape the input first (`name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` — the codebase already has this regex in `search.controller.js:64`), or compare case-insensitively in JS after fetching the user's tokens (they're few).
    - **If we skip it:** Free CPU exhaustion on a single-threaded server.

14. **Merge silently keeps "ours" on modify-vs-delete, contradicting its own spec** (`backend/native-merge/src/lib.rs:69-78`; `README.md:132`; JSON fallback at `lib.rs:36-38`)
    - **What this is:** The documented state machine says "modified vs deleted = flag conflict", but branch 3 (`theirs_hash == base_hash` → keep ours) inserts the modified hash when theirs deleted the path.
    - **Problem:** Case: PR X deletes `a.txt`, you modify `a.txt` meanwhile → merge succeeds and the file reappears; the delete instruction is dropped with no conflict warning. Also `unwrap_or_default()` on parse failure turns a corrupt tree into an empty map, so everything looks "added by their branch".
    - **Fix:** Add a conflict for `ours: Some(modified), theirs: None(delete)`. Remove `unwrap_or_default` and fail loudly instead.
    - **If we skip it:** Reviewers believe a delete was merged; users keep re-deleting the same file.

15. **Path check misses sibling folders with shared prefixes** (`backend/src/services/file.service.js:39-46`)
    - **What this is:** `getSecurePath` rejects escapes with `absolutePath.startsWith(userWorkspace)`.
    - **What it misses:** No separator check: a workspace `.../u1` also accepts `.../u10/...` — so if any workspace id were a prefix of another (the `guest_workspace` name makes both `"guest_workspace"` and a user id plausible ids), one user's path resolves into another user's folder.
    - **Fix:** Require `absolutePath === userWorkspace || absolutePath.startsWith(userWorkspace + path.sep)`.
    - **If we skip it:** One-line insurance against a class of cross-user file access that all IDE endpoints pass through.

16. **`involves` filter searches all repositories, not the one in the URL** (`backend/src/controllers/pr.controller.js:91-98`)
    - **What this is:** `query.$or` initially scopes to the repo; the `involves` branch overwrites it with a user-only `$or`.
    - **Problem:** Case: `GET /repos/o/r/pulls?involves=me` returns PRs of every repo in the database involving that user — wrong results and cross-repo metadata exposure.
    - **Fix:** Keep the repo filters and combine: `query.$and = [{repo scope}, {$or: [...user matches]}]`.
    - **If we skip it:** The list endpoint shows data from the wrong repos.

17. **No rate limit on register and login** (`backend/src/routes/auth.route.js:51, 78`)
    - **What this is:** The OTP endpoints are limited (3/15min), but `/register` fires an OTP email each time and `/login` is only under the global 1000/15min limit.
    - **Problem:** Case: script hits `/register` with 1000 addresses → 1000 OTP emails from your Gmail (spam reputation burn); password guessing at 60+ tries/min per IP via `/login`.
    - **Fix:** Put `otpLimiter` on `/register` and add a 10-per-5min login limiter (same middleware file, four lines).
    - **If we skip it:** Mail provider and account security depend on the generosity of strangers.

18. **Zero automated tests for everything risky on the server** (`backend/package.json:9`)
    - **What this is:** `"test"` prints "no test specified"; the Rust crate has real unit tests (`rusty/src/merge.rs`, `fsck.rs`, `ignore.rs`) but the whole Node backend has none.
    - **Problem:** The riskiest logic — privacy checks, permission rules, the merge state machine, `FileService` path safety, OTP flow, ref updates — has nothing that fails when a future edit breaks it (findings 1-3, 8, 14-15 would all have been caught by one afternoon of tests).
    - **Fix:** One test file with ~15 asserts against the pure helpers first: `canUserPushToRepo`, `FileService.getSecurePath`, native merge result table, `generateUnifiedDiff`. Run with `node --test` — no new dependency.
    - **If we skip it:** Every fix above regresses silently with the next "quick change".

19. **Dead weight carried by everyone: unused packages, dead schema fields, scratch scripts** (`backend/package.json:34-38`; `backend/src/models/Repository.model.js:102-111`; `backend/test*.js`, `scratch/`)
    - **What this is:** `node-pty` (a native compile!), `resend`, `archiver` (used by nothing yet), `extract-zip` are installed; `webhooks` and `branchProtection` exist only in the schema (grep confirms nothing reads them); `test*.js`/`scratch/` are 613 lines of one-off scripts that talk to the live production DB (`testPin.js` hardcodes a real username); tracked build artifacts `libnative_merge.d/.so`; several selects request a `language` field the schema doesn't have.
    - **Problem:** `node-pty` alone makes every `npm install` compile a native module for no feature; the dead flags promise behavior nobody implemented.
    - **Fix:** Delete the four deps, the two schema fields, the six test scripts and scratch/ (into a branch if you want them), gitignore the binaries.
    - **If we skip it:** Each person who touches the repo pays the compile time and the confusion forever.

## Nice to have

20. **PAT saved world-readable on disk** (`rusty/src/auth.rs:44-48`)
    - **What this is:** `~/.rusty/credentials.json` stores the bearer token with default file mode.
    - **Problem:** On shared Unix hosts another local user can read the token file (Windows ACLs differ, so this matters mostly on Linux).
    - **Fix:** After `fs::write`, `fs::set_permissions(&path, Permissions::from_mode(0o600))` — three lines.
    - **If we skip it:** Same-machine users read each other's tokens.

---

**Verdict:** Not healthy. Merge, auth and file storage work, but a first-time auditor could exfiltrate all private repos through four independent doors (1, 2, 3, 4) and hijack sessions via 5 — fix those seven first, then the ref race (8) and the tests (18).

**Lean: -630 lines, -4 dependencies possible** (finding 19, plus `adm-zip` swap if you do 12).

**Not checked:** the ~40 frontend pages/components in detail (only ReadmeBox, DiffViewer, store, vite config), `rusty/` CLI command internals (clone/push/pull/fetch/index logic — only `auth.rs` read), `native-merge` build config, `backend/scripts/*.js`, swagger setup, notification model details, git history for past secret exposure (recommended: rotate anyway per finding 7), any runtime testing — everything above comes from reading code, not executing it.
