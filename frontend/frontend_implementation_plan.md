# Frontend Implementation Plan: Pull Requests

The backend is fully equipped with APIs, database models, and a high-performance native Rust engine to handle Pull Requests. The next phase is strictly wiring up the React frontend to these APIs and providing a seamless UI experience.

## 1. Overview of Remaining Work
Currently, `PullRequestsTab.jsx` contains the basic scaffolding for listing, creating, and viewing PRs. We need to replace the mocked data and static buttons with real Axios calls to the backend and handle various loading/error states (especially merge conflicts).

---

## 2. API Integration Requirements
We need to create frontend service functions (likely in a `prService.js` or directly inside the components using Axios) to consume the following backend routes:

1. **`POST /api/v1/repos/:owner/:repo/pulls`**
   - **Action:** Create a new Pull Request.
   - **Payload:** `{ title, description, sourceBranch, targetBranch, targetRepoId }`
2. **`GET /api/v1/repos/:owner/:repo/pulls`**
   - **Action:** Fetch all PRs for the current repository.
   - **State Handling:** Needs filtering tabs for `Open`, `Merged`, and `Closed` PRs.
3. **`GET /api/v1/repos/:owner/:repo/pulls/:id`**
   - **Action:** Fetch specific PR details (author, state, timestamps).
4. **`GET /api/v1/repos/:owner/:repo/pulls/:id/commits`**
   - **Action:** Fetch the list of commits unique to this PR (the diff).
5. **`POST /api/v1/repos/:owner/:repo/pulls/:id/merge`**
   - **Action:** Trigger the Rust native merge engine.

---

## 3. UI Component Breakdown & State Management

### A. The "Create PR" Flow
When the user clicks "New Pull Request", the UI must:
- Fetch and display a dropdown of available branches in the current repository.
- Allow the user to select a `targetBranch` (base) and a `sourceBranch` (compare).
- **Validation:** Prevent submission if `targetBranch === sourceBranch`.
- Provide input fields for `title` (required) and `description`.
- On submit, call the `POST` API, handle validation errors (e.g., "No changes detected"), and redirect to the new PR's detail page.

### B. The PR Listing View
- Fetch the list of PRs from the backend.
- Display a list item for each PR showing its `title`, `#id`, `author`, and how long ago it was opened.
- Use distinct icons or colors for `Open` (Green), `Merged` (Purple), and `Closed` (Red) states.

### C. The PR Details View
This is the most complex component. It needs three distinct sections:
1. **Header:** Title, State Badge, and a summary (e.g., "User wants to merge 3 commits into main from feature").
2. **Commits List:** A timeline or list showing the commits fetched from the `/commits` API.
3. **The Merge Box:** The interactive area at the bottom.

### D. The Merge Box Logic
The Merge button must be heavily conditional based on data:
- **Authorization:** Only render the "Merge Pull Request" button if the `currentUser._id` matches the `pr.targetRepo.owner`. If not, show a message like *"Only repository owners can merge."*
- **State Check:** If `pr.state === 'merged'`, hide the button and show a success banner *"Pull request successfully merged."*
- **Loading State:** When the user clicks Merge, disable the button and show a spinner. (The Rust engine is fast, but network latency exists).
- **Conflict Handling (CRITICAL):** If the API returns a `409 Conflict`, catch the error in Axios. Render a prominent red warning box detailing the conflict, listing the `error.response.data.conflictFiles`, and instruct the user to resolve the conflicts locally using the CLI.

---

## 4. Suggested Implementation Steps
1. **Step 1:** Write the Axios API wrappers in the frontend `src/services/` folder.
2. **Step 2:** Wire up the **PR Listing** and **Create PR** views. Ensure you can successfully create a PR and see it in the list.
3. **Step 3:** Wire up the **PR Details** view, fetching both the PR metadata and the unique commits.
4. **Step 4:** Implement the **Merge Button**, paying special attention to the error handling for `409` merge conflicts to ensure a polished user experience.
