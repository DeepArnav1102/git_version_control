# Backend Implementation Plan: Branches, PRs, and Merging

To support remote branches, forks, and pull requests, we need to extend the backend APIs and MongoDB schema. Here is the step-by-step plan.

## 1. Enhancing Branch Support
Currently, the backend stores branches in the `Repository` model under the `branches` array. We need to expose this to the CLI.

**New Routes (`src/routes/repo.route.js`):**
*   `GET /:owner/:repo/refs`
    *   **Purpose:** Returns a list of all branches and their commit hashes (e.g., `[{ branch: 'main', commitHash: 'abc...' }, ...]`).
    *   **Controller Logic:** Find the repository, map over `repo.branches`, and return them. This allows the CLI `fetch` command to download all remote branches.
*   `DELETE /:owner/:repo/refs/:branch`
    *   **Purpose:** Delete a remote branch.
    *   **Controller Logic:** Remove the branch object from the `repo.branches` array and save.

## 2. Pull Request Data Model
We need a new MongoDB model to track Pull Requests.

**New File (`src/models/PullRequest.model.js`):**
```javascript
const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    state: { type: String, enum: ['open', 'merged', 'closed'], default: 'open' },
    
    // For handling forks vs same-repo PRs
    sourceRepo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    sourceBranch: { type: String, required: true },
    
    targetRepo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    targetBranch: { type: String, required: true },
    
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mergeCommitHash: { type: String }, // Set when merged
}, { timestamps: true });

module.exports = mongoose.model('PullRequest', pullRequestSchema);
```

## 3. Pull Request APIs
Create new routes for managing the PR lifecycle.

**New Routes (`src/routes/pr.route.js`):**
*   `POST /:owner/:repo/pulls` - Create a PR. Validates that the source branch/repo has commits that the target doesn't.
*   `GET /:owner/:repo/pulls` - List open/closed PRs for a repository.
*   `GET /:owner/:repo/pulls/:id` - View PR details (title, description, author).
*   `GET /:owner/:repo/pulls/:id/commits` - Get the list of commits unique to this PR by traversing parent commits from the `sourceBranch` down to the common ancestor with `targetBranch`.
*   `PATCH /:owner/:repo/pulls/:id` - Close or reopen a PR.

## 4. Merging the Pull Request (The "Secret Weapon" Approach)

Merging on the backend is typically challenging because the backend stores raw Git Objects in MongoDB without a flat file system. However, we will bypass this complexity by leveraging your existing Rust CLI code (`rusty/src/merge.rs`). 

We will use the **Native Node-API (N-API) via `napi-rs`**. 

**Why N-API is better than Child Process:**
While a Child Process is easier to set up, spawning a new OS process for every PR merge introduces unacceptable latency for a web server. More importantly, it requires passing large amounts of raw Git blob data over standard input/output, or forcing the Rust binary to manage its own separate MongoDB connection pool. N-API compiles your Rust code into a native Node.js library (`.node` file). This means Node.js can use its existing MongoDB connection pool, fetch the data, and pass memory pointers directly to Rust with **zero serialization overhead**.

*   **API:** `POST /:owner/:repo/pulls/:id/merge`
*   **Execution Strategy:**
    1.  **Node.js pre-fetches the data:** When the merge API is called, the Node backend fetches the `GitObject`s (target commit, source commit, and base commit) from MongoDB.
    2.  **Handing off to Rust (N-API):** Node.js passes the raw object buffers directly to the imported Rust N-API function.
    3.  **Rust performs the merge:** The highly-optimized Rust code runs the 3-way merge algorithm in memory. It traverses the trees, compares the file hashes, and runs the text-diffing logic exactly as it does locally on the CLI.
    4.  **Rust creates the new objects:** Once the merge is resolved in memory, the Rust module generates the new merged blob objects, tree objects, and the merge commit object with two parents.
    5.  **Rust returns to Node:** The Rust module returns the newly created objects (and their hashes) back to Node.js.
    6.  **Node.js finalizes:** Node.js saves the new objects to MongoDB using its existing Mongoose models, updates the `targetBranch` reference, and marks the Pull Request state as `merged`.

### Security Considerations
*   **Event Loop Blocking (Denial of Service):** Text-diffing algorithms can be CPU-intensive (especially on massive files or intentionally malicious "zip bomb" style commits). If Rust runs synchronously, it will freeze the Node.js event loop, taking down the whole server.
*   **Out of Memory (OOM):** Loading multiple massive blobs into memory simultaneously to merge them could exceed the server's RAM limits.
*   **Authorization:** Ensure strict backend checks to verify the user initiating the merge has write/admin privileges on the `targetRepo`.

### Further Optimizations
*   **Asynchronous Rust Execution (Non-blocking):** To fix the DoS security issue, use `napi-rs` async bindings (`AsyncTask`). This pushes the heavy Rust computation off the main Node.js event loop and onto a background thread pool (like `libuv`), allowing Node to continue serving other HTTP requests while the merge calculates.
*   **Batch Database Fetching:** Instead of fetching trees one by one recursively, optimize the Mongo queries to fetch all required objects in a single batch using `$in` queries.
*   **Pre-computed Merge Bases:** Finding the common ancestor is expensive. Compute and cache the merge base hash when the Pull Request is first opened or updated, rather than calculating it at the exact moment the user clicks "Merge".
