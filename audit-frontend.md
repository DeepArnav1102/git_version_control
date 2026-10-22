# Frontend Audit — 2026-10-22

**What this repo does:** React SPA (Vite + React 19 + Tailwind v4) for "Rusty", a GitHub-like app: repos, code browsing, pull requests, a codespace-style IDE, notifications, profiles. Auth = HttpOnly cookie sessions + axios refresh interceptor.
**Assumed load:** one deploy, one small team (~1–10 users), one backend API, no CDN/SSR. Findings are ranked for that load.

## Must fix

1. **`npm run build` fails — TypeScript checked but not installed** — `package.json:8`
    - What this is: build script is `"tsc && vite build"`.
    - Problem: no tsconfig, no `.ts` files, `node_modules/.bin/tsc` doesn't exist. Every `npm run build` dies at step 1.
    - Fix: change script to `"build": "vite build"`.
    - If we skip it: nothing ever ships from this repo.

2. **PR create hits a hardcoded `http://localhost:3000` and bypasses auth** — `PRCreateView.jsx:92-93`
    - What this is: compare-diff fetch uses bare `axios.get("http://localhost:3000/api/v1/...")` instead of the shared `apiClient`.
    - Problem: in any deployed build (or if the API moves) it fetches the wrong host and fails; and it skips the refresh-token interceptor, so logged-in users get 401s when the short-lived token expires.
    - Fix: one line — `apiClient.get("/repos/.../compare/...")`.
    - If we skip it: creating a PR works only on a dev laptop.

3. **Four links navigate to a route that doesn't exist** — `IDE.jsx:399`, `RepoDetail.jsx:245`, `RepoHeader.jsx:90`, `CodeTab.jsx:497`
    - What this is: they go to `/:owner/:repo`, but `App.jsx` only mounts the repo page at `/repo/:owner/:repo`.
    - Problem: clicking "Browse repo" from the IDE exit, fork success, "forked from" link, and the commit-count link all land on a blank page.
    - Fix: change all four to `/repo/${owner}/${repo}` (and the commits one to include `/commits/...` under that route).
    - If we skip it: four of the most-used flows dead-end.

4. **Navbar unread badge silently never loads** — `Navbar.jsx:6, 87`
    - What this is: code calls `apiClient.get('/notifications/unread-count')` but the import is named `axios`.
    - Problem: `apiClient` is undefined → ReferenceError → the empty catch swallows it → the unread dot never shows, and it looks like a data issue, not a code bug.
    - Fix: one edit — call `axios.get(...)` or rename the import.
    - If we skip it: users never learn they have notifications.

5. **File names are interpolated unquoted into a shell command in the IDE** — `IDE.jsx:289`
    - What this is: it builds `python3 "/workspace/${activeFile}"` and sends it to the IDE execute endpoint.
    - Problem: a filename containing `"` (legal on disk) closes the quotes and runs attacker shell code — a collaborator pushes a crafted filename, victim runs it, their codespace executes it.
    - Fix: smallest guard — reject/flag names not matching `/^[A-Za-z0-9._\/-]+$/` before sending; or send the path as a separate JSON field the backend quotes.
    - If we skip it: any repo you open the IDE on can inject shell into your session via a filename.

6. **Diff highlight fallback injects raw text as HTML** — `DiffViewer.jsx:29-30` and its clone `PRCreateView.jsx:112-120`
    - What this is: `highlightLine()` returns `dangerouslySetInnerHTML`; the happy path uses highlight.js (escaped), but the `catch` returns the raw line text unescaped.
    - Problem: if hljs ever throws, `<img onerror=...>` in a diff line executes — PRs are how other people send you code.
    - Fix: in the catch, escape `<` and `&` before returning (one line).
    - If we skip it: a latent XSS behind a rare error path.

7. **Starring a repo throws you out of any folder you were in** — `RepoDetail.jsx:187, 404-414`
    - What this is: the tree-fetch effect depends on the whole `repoData` object; the star toggle calls `setRepoData`.
    - Problem: starring (a like-button click) refires the effect → refetches tree/root/commits and resets the active folder. Same storm happens after any `repoData` touch.
    - Fix: key the effect on `branch` / `repo?._id` (scalars), not the whole object.
    - If we skip it: "star" and "navigate" fight each other on every repo page.

8. **PR open/closed counts only count the current page** — `PullRequestsTab.jsx:227-233`
    - What this is: counts derive from filtering the already-fetched 30-item list; switching tabs never refetches.
    - Problem: "32 open" shows as "30 open" or fewer; PRs beyond the page are invisible in counts, so the number lies as your repo grows.
    - Fix: request counts from the API (or fire a count-only fetch per state, cached).
    - If we skip it: fine until the repo has >30 PRs, then silently wrong forever.

## Should fix

9. **Last-click-wins race shows the wrong PR** — `PullRequestsTab.jsx` / `PRDetailView.jsx`
    - What this is: each click resolves its own fetch; no request is ever cancelled or checked for staleness.
    - Problem: click PR A, then PR B quickly → if A's response lands last, the detail view shows PR A's title/body data while the header says B.
    - Fix: an "is this still my latest request" token (a counter ref, ~3 lines) — ignore responses that aren't.
    - If we skip it: rare but confusing data mixups.

10. **Dead UI that promises features that don't work** — `Notifications.jsx:51, 84, 205-218`, `OnboardingFlow.jsx:11, 51-53, 96-100`, `CommitsTab.jsx:44-53`
    - What this is: a multi-select whose `selectedIds` is never set and has no checkbox UI; onboarding collects `intent` and never sends it (and `handleFinish` is uncalled); every commit shows a hardcoded "Verified" badge and a "Browse files" button that does nothing.
    - Problem: ~20 lines of unreachable code; the Verified badge claims signature validity on every commit, which is a lie.
    - Fix: delete all of it (plus swap the Verified badge for nothing).
    - If we skip it: code volume and small honesty bugs remain.

11. **~95-line copy-paste of DiffViewer lives inside PRCreateView** — `PRCreateView.jsx:106-199`
    - What this is: the compare-diff render duplicates `DiffViewer.jsx` almost line-for-line, spread across two files (`highlightLine` duplicated too).
    - Problem: bug fix one file, forget the other — finding 6 exists in two places for this reason.
    - Fix: import and use `DiffViewer` in `PRCreateView`, delete the copy.
    - If we skip it: every diff bug costs double.

12. **"Add README" checkbox is never sent to the API** — `CreateRepo.jsx:34, 127, 375-395`
    - What this is: the toggle exists in the form but the POST `/repos` payload doesn't include it.
    - Problem: user promises themselves a README and doesn't get one; the checkbox is decorative.
    - Fix: add `addReadme` to the payload (assuming the backend accepts it — one line).
    - If we skip it: a visible control that does nothing.

13. **Three different API base URLs in one app** — `RepoDetail.jsx:91-92`, `lib/axios.js:4`, `IDE.jsx:165`
    - What this is: `VITE_API_URL || 'http://localhost:3000/api/v1'`, `VITE_API_URL || '/api/v1'`, and a hardcoded `/api/v1`.
    - Problem: deploy once where `/api/v1` isn't same-origin and RepoDetail works while files break (or vice versa); every fix must be made three times.
    - Fix: RepoDetail (and IDE) import `API_BASE` from `lib/axios` or read the same env var.
    - If we skip it: works today, breaks mysteriously on first real deploy.

14. **Copy-permalink copies the literal string "undefined"** — `RepoDetail.jsx:568`
    - What this is: builds the clipboard URL from `activeFile.path`, but tree nodes only have `name` — `path` is never set.
    - Problem: every user who copies a file link copies a broken URL with the real path missing.
    - Fix: use the existing `activeFilePath` variable instead.
    - If we skip it: sharing file links never works.

15. **Empty catch on PR metadata updates** — `PRDetailView.jsx:84-102`
    - What this is: label/milestone/assignee edits do API calls whose errors are swallowed.
    - Problem: the request fails (e.g. rights), the spinner stops, UI looks fine, nothing saved — user believes the label was added.
    - Fix: reuse the existing `jsonToast` error path in each catch.
    - If we skip it: silent data loss at the UI level.

## Nice to have

16. **Commits fetched twice per repo view** — `CodeTab.jsx:57-70`
    - What this is: RepoDetail already fetches the commit list; CodeTab fetches it again on mount.
    - Problem: one duplicate request per repo open.
    - Fix: pass the already-loaded array as a prop; skip the fetch if present.
    - If we skip it: acceptable at this load.

17. **Three copies of `timeAgo`, seven copies of the default-avatar URL** — `Notifications.jsx:28`, `CodeTab.jsx:72`, `ProfileRepos.jsx:9`; avatar string across `PRListItem.jsx:50`, `CommitsTab.jsx:5`, etc.
    - What this is: the same helper and the same constant redefined per file.
    - Problem: a format change takes 7 edits; they'll drift apart.
    - Fix: one `lib/format.js` (~10 lines), import everywhere.
    - If we skip it: nothing breaks, just drift.

18. **Unused dependency + obsolete Tailwind v3 pieces** — `package.json` (`gsap` never imported), `postcss.config.js` + `tailwind.config.js` + `autoprefixer`
    - What this is: Tailwind v4's `@tailwindcss/postcss` does prefixing internally and needs no `tailwind.config.js`.
    - Problem: dead install weight; confusing for the next reader.
    - Fix: remove `gsap` and `autoprefixer` from deps, keep only `@tailwindcss/postcss` in postcss config, delete `tailwind.config.js` (verify the build still outputs the same classes).
    - If we skip it: harmless bloat.

19. **Full page reload after deleting a file** — `CodeTab.jsx:392-394`
    - What this is: success handler calls `window.location.reload()`.
    - Problem: lose scroll position and SPA state and refetch everything for what could be one tree refresh.
    - Fix: call the existing `fetchTree()` instead.
    - If we skip it: works, just clunky.

20. **Polling is chatty but fine at this load** — `IDE.jsx:150` (tree every 3s), `Navbar.jsx:~80` (unread every 30s)
    - What this is: interval refetches, no backoff or tab-visibility check.
    - Problem: 3s tree polls run even when the tab is hidden.
    - Fix: skip both — note only. If this ever grows, poll only while visible (`document.hidden` check).
    - If we skip it: right call for 1–10 users.

## Verdict

Solid sneaker-wear codebase: the top 4 are pure ship-blockers (build, localhost URL, dead-end routes) fixable in under an hour; 5–7 are the real correctness/security debt (IDE shell interpolation first); the rest is duplication and silent-failure cleanup. Nothing here needs a rewrite.

**Lean: ~-170 lines, -2 dependencies possible.** (gsap, autoprefixer; plus delete `tailwind.config.js`, ~95 duplicated diff lines, dead multi-select/onboarding/UI promises, merge `timeAgo`/avatar helpers.)

## Not checked

`backend/` and everything outside `frontend/`; remaining small UI files (ProfileDropdown, CreateDropdown, FloatingNav, RepoFloatingNav, SidebarNode, LottieIcon, IconBox, ShortcutBadge, KeyboardShortcutsModal, TokenNameInput, ProfileReadme, ProfileShared, ProfileIcons, EmptyRepoView, Onboarding steps 1–2); real browser/runtime behavior; backend field-name contracts (e.g. whether `addReadme` is accepted); whether `VITE_API_URL` is set in deploy envs.
