# Implementing Fork and Sync in a MERN Codebase

A "fork" in Git platforms (like GitHub or GitLab) is not a native Git concept, but rather a platform-level feature. When you fork a repository, the platform creates a completely new repository under your user account, copies all the Git data (commits, branches, tags) from the original repository (the "upstream"), and establishes a database link between your new repo and the original.

"Syncing" a fork involves pulling the latest commits from the upstream repository's default branch and merging them into the fork's default branch.

Based on the structure of your MERN-stack codebase, here is a complete plan for implementing Fork and Sync features.

## 1. Database Updates

First, you need to tell your database that a repository is a fork and keep track of where it came from.

**Update `backend/src/models/Repository.model.js`:**
Add fields to track the fork lineage.

```javascript
const repositorySchema = new mongoose.Schema({
  // ... existing fields ...
  isFork: { 
    type: Boolean, 
    default: false 
  },
  parentRepo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Repository', 
    default: null 
  },
  // Optional: Track the original root repo if forks of forks are allowed
  rootRepo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Repository', 
    default: null 
  }
}, { timestamps: true });
```

## 2. Backend Implementation: Forking

When a user clicks "Fork", you need to create a new database record and physically copy the Git repository on your server's filesystem.

**Create the Git helper in `backend/src/utils/repoHelpers.js`:**

```javascript
const { execSync } = require('child_process');
const path = require('path');

const forkGitRepository = (sourceRepoPath, targetRepoPath) => {
  try {
    // A simple recursive copy or a bare clone works best for forking on the same filesystem
    execSync(`cp -r ${sourceRepoPath} ${targetRepoPath}`);
    return true;
  } catch (error) {
    console.error("Git fork failed:", error);
    throw new Error("Failed to copy repository files");
  }
};
```

**Add the Controller logic in `backend/src/controllers/repo.controller.js`:**

```javascript
const forkRepository = asyncHandler(async (req, res) => {
  const { id: sourceRepoId } = req.params;
  const currentUser = req.user; 

  const sourceRepo = await Repository.findById(sourceRepoId).populate('owner');
  if (!sourceRepo) throw new ApiError(404, "Repository not found");

  // Prevent forking your own repo
  if (sourceRepo.owner._id.toString() === currentUser._id.toString()) {
    throw new ApiError(400, "You cannot fork your own repository");
  }

  // 1. Create DB Record
  const forkedRepo = await Repository.create({
    name: sourceRepo.name,
    description: sourceRepo.description,
    owner: currentUser._id,
    isFork: true,
    parentRepo: sourceRepo._id,
    rootRepo: sourceRepo.rootRepo || sourceRepo._id,
    // ... copy other relevant fields, but NOT the path yet
  });

  // 2. Define filesystem paths
  const sourcePath = getRepoPath(sourceRepo.owner.username, sourceRepo.name);
  const targetPath = getRepoPath(currentUser.username, forkedRepo.name);

  // 3. Copy the actual Git repo on the server
  forkGitRepository(sourcePath, targetPath);

  res.status(201).json(new ApiResponse(201, forkedRepo, "Repository forked successfully"));
});
```

*Don't forget to map this in `backend/src/routes/repo.route.js` as `router.post('/:id/fork', verifyJWT, forkRepository);`*

## 3. Backend Implementation: Syncing a Fork

To sync, the fork needs to pull changes from the parent. On the filesystem, this means adding the parent repo as a temporary "remote", fetching its changes, and merging them.

**Add Sync logic to `backend/src/utils/repoHelpers.js`:**

```javascript
const syncForkWithUpstream = (forkRepoPath, upstreamRepoPath, branch = 'main') => {
  try {
    // 1. Navigate to the fork's directory
    // 2. Fetch directly from the upstream filesystem path
    // 3. Merge the changes
    const fetchCmd = `git -C ${forkRepoPath} fetch ${upstreamRepoPath} ${branch}`;
    const mergeCmd = `git -C ${forkRepoPath} merge FETCH_HEAD`;
    
    execSync(fetchCmd);
    execSync(mergeCmd);
    
    return true;
  } catch (error) {
    console.error("Sync failed:", error);
    throw new Error("Merge conflict or failure to sync with upstream");
  }
};
```

**Controller for Syncing (`repo.controller.js`):**

```javascript
const syncRepository = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const repo = await Repository.findById(id).populate('parentRepo');
  
  if (!repo.isFork || !repo.parentRepo) {
    throw new ApiError(400, "This repository is not a fork.");
  }

  const forkPath = getRepoPath(req.user.username, repo.name);
  // You'll need the parent owner's username to resolve their path
  const parentOwner = await User.findById(repo.parentRepo.owner);
  const parentPath = getRepoPath(parentOwner.username, repo.parentRepo.name);

  syncForkWithUpstream(forkPath, parentPath);

  res.status(200).json(new ApiResponse(200, null, "Successfully synced with upstream"));
});
```

## 4. Frontend Integration

Now, tie it together in your React frontend.

**1. Update `frontend/src/components/repo/RepoHeader.jsx`:**
Add the visual indicator for forks and the action buttons.

```javascript
// Inside RepoHeader.jsx
return (
  <div className="repo-header">
    <div className="title-section">
      <h1>{repo.name}</h1>
      {repo.isFork && repo.parentRepo && (
        <span className="text-sm text-gray-500">
          forked from <Link to={`/${repo.parentRepo.owner.username}/${repo.parentRepo.name}`}>
            {repo.parentRepo.owner.username}/{repo.parentRepo.name}
          </Link>
        </span>
      )}
    </div>
    
    <div className="actions">
      {/* Show FORK button if the user is not the owner */}
      {currentUser._id !== repo.owner._id && (
        <button onClick={handleFork}>Fork</button>
      )}

      {/* Show SYNC button if this is the user's fork */}
      {repo.isFork && currentUser._id === repo.owner._id && (
        <button onClick={handleSync}>Sync fork</button>
      )}
    </div>
  </div>
);
```

**2. Make the API Calls:**
Add the methods to your repo service or directly in the component using `axios.js`.

```javascript
const handleFork = async () => {
  try {
    const res = await axiosInstance.post(`/repos/${repo._id}/fork`);
    toast.success("Repository forked!");
    // Redirect to the new fork URL
    navigate(`/${currentUser.username}/${repo.name}`);
  } catch (error) {
    toast.error("Failed to fork repository");
  }
};

const handleSync = async () => {
  try {
    await axiosInstance.post(`/repos/${repo._id}/sync`);
    toast.success("Repository synced with upstream!");
    // Refresh commit history/files
    fetchRepoData(); 
  } catch (error) {
    toast.error("Sync failed. There might be merge conflicts.");
  }
};
```