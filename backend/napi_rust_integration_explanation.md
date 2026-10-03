# Native Rust 3-Way Merge Architecture: End-to-End Flow

This document provides a highly detailed explanation of the "Secret Weapon" architecture built for handling Pull Request merges in the MiniBankingSystem Git clone. It describes how the Frontend, Node.js Backend, MongoDB, and Rust N-API module communicate seamlessly to execute high-performance, non-blocking 3-way merges.

---

## 1. The Architectural Challenge

When a user clicks "Merge Pull Request", the server must perform a **3-way merge**. This involves:
1. Finding the lowest common ancestor (LCA) commit.
2. Recursively traversing the file trees for the base, source (theirs), and target (ours) commits.
3. Comparing file hashes to detect unchanged, fast-forwarded, or conflicting files.
4. Saving the newly constructed tree and merge commit back to the database.

**The Problem:** Node.js runs on a single-threaded Event Loop. If we wrote a recursive tree-traversal and diffing algorithm in JavaScript, it would block the event loop. During a large repository merge (e.g., 10,000 files), your server would freeze, dropping all other users' HTTP requests.

**The Solution:** We offload the heavy computational logic to a Native Rust binary (`.node` file) using **N-API** (`napi-rs`). Furthermore, we leverage the `napi::Task` trait to run the Rust code asynchronously on `libuv`'s background thread pool, ensuring zero event-loop blocking.

---

## 2. End-to-End Data Flow

Here is the exact step-by-step lifecycle of a Pull Request merge, from the moment the user clicks the button on the frontend to the final database update.

### Step 1: Frontend Initiation (React)
1. The user navigates to the `PullRequestsTab` in the React frontend.
2. The user views a PR and clicks the green **"Merge pull request"** button.
3. React fires an asynchronous `POST` request via Axios to:
   `http://localhost:3000/api/v1/repos/:owner/:repo/pulls/:id/merge`

### Step 2: Pre-Merge Validation (Node.js)
1. The Express router intercepts the request and routes it to `mergePullRequest` in `pr.controller.js`.
2. The controller verifies the JWT token and ensures the user is the **owner** of the target repository.
3. The controller fetches the `targetBranch` (e.g., `main`) and `sourceBranch` (e.g., `feature`) commit hashes from MongoDB.
4. Using an iterative BFS algorithm, Node.js searches the commit graph backward to find the **Lowest Common Ancestor (LCA)** commit (the "base").

### Step 3: Batch Database Fetching (Node.js)
To avoid the dreaded "N+1 Query Problem" (querying the database 1,000 times for 1,000 folders), Node.js uses an optimized iterative algorithm:
1. Node.js calls `flattenTree(repoId, commitHash)` for the Base, Ours (Target), and Theirs (Source) commits.
2. `flattenTree` groups all tree hashes at a specific directory depth and uses MongoDB's `$in` operator to fetch them in a single batch query.
3. It recursively flattens the nested Git trees into a single-level JavaScript Map: `{"src/index.js": "hash123", "package.json": "hash456"}`.

### Step 4: Hand-off to Rust Thread Pool (N-API)
1. Node.js converts the three flattened tree Maps into JSON strings.
2. Node.js calls `await nativeMerge.performMergeAsync({ baseTree, oursTree, theirsTree })`.
3. The Node.js event loop is completely freed up to handle other web traffic. Under the hood, `napi-rs` passes the JSON strings to a C++ bridge, which allocates a background thread in the OS to execute the Rust code.

### Step 5: High-Speed 3-Way Merge (Rust)
1. In `native-merge/src/lib.rs`, the Rust thread parses the JSON strings into `BTreeMap<String, String>`.
2. Rust gathers every unique file path across all three trees into a `HashSet`.
3. It loops through every file path and compares the hashes:
   - If `ours == theirs`: No changes (keep the hash).
   - If `ours == base` and `theirs` changed: Fast-forward the file to `theirs`.
   - If `theirs == base` and `ours` changed: Keep `ours`.
   - If `ours` and `theirs` changed differently: Push the file to a `conflicts` array.
4. **Conflict Handling:** If the `conflicts` array is not empty, Rust immediately aborts the merge and returns `success: false` along with the list of conflicting files back to Node.js (which throws a 409 HTTP error to the frontend).
5. If successful, Rust serializes the final merged `BTreeMap` back into a JSON string and returns it across the C++ bridge.

### Step 6: Database Finalization (Node.js)
1. Node.js receives the merged flat tree JSON from Rust.
2. Node.js executes `buildAndSaveTree`, which reverses the flattening process. It recursively splits the flat paths (e.g., `src/index.js`) back into nested objects.
3. It generates strict JSON payloads matching the CLI's exact format (`{ "entries": [ { "mode": "100644", "name": "index.js", "object_hash": "...", "object_type": "blob" } ] }`), hashes them, and saves the new `tree` objects to MongoDB using `$set` with `upsert: true`.
4. Finally, Node.js creates a new `commit` object (with two parents representing the merge), saves it, and updates the `targetRepo.branches` array to point to this new commit.
5. The Pull Request is marked as `merged`, and the HTTP 200 Success response is sent back to React!

---

## 3. Developer Guide: Recompiling the Native Module

Because we added `.node` files and `target/` directories to `.gitignore`, any developer who clones this repository **will not** have the compiled Rust binary out-of-the-box. If they try to merge a PR, they will get a `500 Native merge module not available` error.

If you pull this code fresh, you must manually compile the Rust addon.

### Prerequisites:
1. You must have **Rust and Cargo** installed on your machine (get it from [rustup.rs](https://rustup.rs/)).
2. You must have Node.js and npm installed.

### Steps to Compile (Windows Recommended)
Due to file-locking issues on Windows (where Node.js holds onto the `.node` file while `npm run dev` is active), you must avoid overwriting conflicts. **The best and cleanest way to do this is to completely stop your Node server (`Ctrl + C`) before compiling.**

If you want to compile *without* stopping your server, you must manually rename the locked file first using the `ren` command.

1. Open your terminal and navigate to the Rust project folder:
   ```bash
   cd backend/native-merge
   ```
2. Build the project in release mode:
   ```bash
   cargo build --release
   ```
3. Copy the resulting dynamic library into the backend root:
   ```cmd
   copy target\release\native_merge.dll ..\native-merge.node
   ```
*(Note: If Windows throws a "File is in use" error during step 3 because you forgot to stop your server, either stop it now, or simply rename the existing file first: `ren ..\native-merge.node native-merge.node.old`, then retry the copy).*

### How to Verify
Start the backend (`npm run dev`) and test a Pull Request merge in the React UI. If it successfully merges without throwing a 500 error, the Rust engine is correctly wired!
