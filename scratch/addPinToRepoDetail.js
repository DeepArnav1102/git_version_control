const fs = require('fs');
const path = require('path');

const repoDetailPath = path.join(__dirname, '../frontend/src/pages/RepoDetail.jsx');
let content = fs.readFileSync(repoDetailPath, 'utf8');

const targetStr = `  };\n\n  const handleRequestDeleteOtp = async () => {`;
const targetStrCRLF = `  };\r\n\r\n  const handleRequestDeleteOtp = async () => {`;

const insertStr = `  };

  const isPinned = currentUser?.pinnedRepos?.some(r => (r._id || r) === repoData?._id);

  const handlePinToggle = async () => {
    if (!currentUser) return;
    let newPinned = [];
    if (isPinned) {
      newPinned = currentUser.pinnedRepos.filter(r => (r._id || r) !== repoData._id).map(r => r._id || r);
    } else {
      if ((currentUser.pinnedRepos?.length || 0) >= 6) {
        jsonToast.error('Maximum 6 repositories can be pinned');
        return;
      }
      newPinned = [...(currentUser.pinnedRepos?.map(r => r._id || r) || []), repoData._id];
    }
    
    try {
      const res = await apiClient.put('/users/pinned', { pinnedRepos: newPinned });
      setUser({ ...currentUser, pinnedRepos: res.data.data.pinnedRepos });
      jsonToast.success(isPinned ? 'Repository unpinned' : 'Repository pinned');
    } catch (err) {
      jsonToast.error('Failed to update pin status');
    }
  };

  const handleRequestDeleteOtp = async () => {`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, insertStr);
} else if (content.includes(targetStrCRLF)) {
  content = content.replace(targetStrCRLF, insertStr);
} else {
  console.log("target string not found!");
}

// Now replace RepoHeader rendering
const repoHeaderTarget = `<RepoHeader
        repoData={repoData}
        isOwner={isOwner}
        isEmpty={isEmpty}
        currentBranch={currentBranch}
        commits={commits}
        handleTabChange={handleTabChange}
        showCloneDropdown={showCloneDropdown}
        setShowCloneDropdown={setShowCloneDropdown}
        remoteUrl={remoteUrl}
        copyToClipboard={copyToClipboard}
        copiedClone={copiedClone}
      />`;

const repoHeaderTargetCRLF = repoHeaderTarget.replace(/\n/g, '\r\n');

const repoHeaderReplace = `<RepoHeader
        repoData={repoData}
        isOwner={isOwner}
        isEmpty={isEmpty}
        currentBranch={currentBranch}
        commits={commits}
        handleTabChange={handleTabChange}
        showCloneDropdown={showCloneDropdown}
        setShowCloneDropdown={setShowCloneDropdown}
        remoteUrl={remoteUrl}
        copyToClipboard={copyToClipboard}
        copiedClone={copiedClone}
        isPinned={isPinned}
        handlePinToggle={handlePinToggle}
      />`;

if (content.includes(repoHeaderTarget)) {
  content = content.replace(repoHeaderTarget, repoHeaderReplace);
} else if (content.includes(repoHeaderTargetCRLF)) {
  content = content.replace(repoHeaderTargetCRLF, repoHeaderReplace);
} else {
  console.log("repoHeader target string not found!");
}

fs.writeFileSync(repoDetailPath, content, 'utf8');
console.log("Success");
