import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useParams } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import ProfileView from '../components/profile/ProfileView';
import ProfileEdit from '../components/profile/ProfileEdit';
import ProfileReadme from '../components/profile/ProfileReadme';
import ProfileOverview from '../components/profile/ProfileOverview';
import ProfileTokens from '../components/profile/ProfileTokens';
import ProfileRepos from '../components/profile/ProfileRepos';
import FloatingNav from '../components/profile/FloatingNav';
import { BookOpen, Book, Star, Loader2, Camera, Key, Plus } from 'lucide-react';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../assets/Loading V2/loadingV2.json';
import useProfileShortcuts from '../hooks/useProfileShortcuts';

export default function Profile() {
  const { user: currentUser, setUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { username } = useParams(); // Get username from /u/:username
  const tabParam = searchParams.get('tab');
  
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(tabParam || 'overview');
  const [uploading, setUploading] = useState(false);
  
  // Public profile state
  const [profileUser, setProfileUser] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  const isOwner = !username || (currentUser && username === currentUser.username);
  const user = isOwner ? currentUser : profileUser;

  // Fetch public profile if viewing someone else
  useEffect(() => {
    if (username && !isOwner) {
      const fetchProfile = async () => {
        setIsLoadingProfile(true);
        try {
          const res = await apiClient.get(`/users/u/${username}`);
          setProfileUser(res.data.data.user);
        } catch (error) {
          jsonToast.error("User not found");
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
    } else {
      setProfileUser(null);
    }
  }, [username, isOwner]);

  // Sync state with URL parameter if navigated from elsewhere
  useEffect(() => {
    let nextTab = tabParam || 'overview';
    
    // Prevent non-owners from viewing the tokens tab
    if (nextTab === 'tokens' && !isOwner) {
      nextTab = 'overview';
    }

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [tabParam, activeTab, isOwner]);

  // Keep URL parameter in sync with state when user clicks FloatingNav
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab !== 'overview') {
      setSearchParams({ tab: newTab }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  useProfileShortcuts({
    onEditProfile: () => { if (isOwner) setEditing(true); },
    onSwitchToOverview: () => handleTabChange('overview'),
    onSwitchToRepositories: () => handleTabChange('repositories'),
    onSwitchToStarred: () => handleTabChange('stars'),
    onSwitchToTokens: () => { if (isOwner) handleTabChange('tokens'); }
  });

  const defaultPfp =
    import.meta.env.VITE_DEFAULT_PFP_URL ||
    'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';
  const profilePic = user?.profilePicture || defaultPfp;

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const res = await apiClient.put('/users/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUser(res.data.data.user);
      jsonToast.success('Profile picture updated');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to upload photo';
      jsonToast.error(msg);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="flex w-full max-w-[1440px] mx-auto px-8 py-6 gap-8 font-sans relative">
      {/* ════════════════════════════════════════════
          LEFT SIDEBAR — Profile card
          ════════════════════════════════════════════ */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-[296px] flex-shrink-0"
      >
        {/* ── Avatar ── */}
        <div className="mb-4">
          <div className={`relative w-[280px] h-[280px] rounded-full mx-auto transition-all ${editing && isOwner ? 'group' : ''}`}>
            <div className={`w-full h-full rounded-full overflow-hidden shadow-md border-2 ${uploading ? 'border-gray-200 opacity-70' : 'border-transparent'}`}>
              <img
                src={profilePic}
                alt={user?.username || 'Profile'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = defaultPfp;
                }}
              />
            </div>

            {editing && isOwner && (
              <>
                <div className={`absolute inset-0 bg-black/40 rounded-full flex items-center justify-center transition-opacity z-10 ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {uploading ? (
                    <Lottie 
                      src={loadingAnimation} 
                      loop={true} 
                      autoplay={true} 
                      className="invert opacity-100"
                      style={{ width: 100, height: 100 }} 
                    />
                  ) : (
                    <span className="text-white text-sm font-semibold tracking-wider">CHANGE</span>
                  )}
                </div>

                {/* Visible Edit Badge */}
                {!uploading && (
                  <div className="absolute bottom-6 right-8 bg-white text-gray-700 p-2.5 rounded-full shadow-lg border border-gray-200 pointer-events-none transition-opacity duration-200 group-hover:opacity-0">
                    <Camera size={22} strokeWidth={1.5} />
                  </div>
                )}

                {!uploading && (
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full z-20"
                    onChange={handlePhotoUpload}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Animate between view / edit modes ── */}
        <AnimatePresence mode="wait">
          {!editing ? (
            <ProfileView 
              key="view" 
              user={user} 
              onEdit={isOwner ? () => setEditing(true) : null} 
              currentUser={currentUser}
              isFollowing={currentUser?.following?.some(id => id === user?._id) || false}
              onToggleFollow={async () => {
                if (!currentUser) return;
                try {
                  const res = await apiClient.post(`/users/u/${user.username}/follow`);
                  // Refresh users to update followers/following lists
                  const refreshMe = await apiClient.get('/users/me');
                  setUser(refreshMe.data.data.user);
                  const refreshProfile = await apiClient.get(`/users/u/${user.username}`);
                  setProfileUser(refreshProfile.data.data.user);
                  jsonToast.success(res.data.message);
                } catch (error) {
                  jsonToast.error(error.response?.data?.message || 'Failed to toggle follow');
                }
              }}
            />
          ) : (
            <ProfileEdit key="edit" user={user} onCancel={() => setEditing(false)} isUploading={uploading} />
          )}
        </AnimatePresence>
      </motion.aside>

      {/* ════════════════════════════════════════════
          RIGHT CONTENT AREA
          ════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 pr-12">
        {activeTab === 'overview' && <ProfileOverview user={user} isOwner={isOwner} />}

        {activeTab === 'repositories' && <ProfileRepos user={user} />}

        {activeTab === 'stars' && (
          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {isLoadingProfile || !user ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="w-12 h-4 bg-gray-100 rounded-full animate-pulse ml-1" />
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded animate-pulse mb-2" />
                      <div className="w-2/3 h-3 bg-gray-100 rounded animate-pulse" />
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
                      <div className="w-10 h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : user?.starredRepos && user.starredRepos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.starredRepos.map((repo) => (
                  <div key={repo._id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Book size={16} className="text-gray-400" />
                        <a href={`/repo/${repo.owner?.username || user.username}/${repo.name}`} className="font-semibold text-blue-600 hover:underline text-sm">
                          {repo.owner?.username}/{repo.name}
                        </a>
                        <span className="px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 text-[10px] font-semibold">
                          {repo.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                        {repo.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                      {repo.language && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                          {repo.language}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-gray-400" />
                        {repo.starsCount || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Star size={18} strokeWidth={1.4} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium mb-1">
                    Starred
                  </p>
                  <p className="text-xs text-gray-300">
                    {isOwner 
                      ? "You haven't starred any repositories yet." 
                      : `${user?.name || user?.username} hasn't starred any repositories yet.`}
                  </p>
                </div>
              </div>
            )}
          </motion.main>
        )}

        {activeTab === 'tokens' && isOwner && <ProfileTokens />}
      </div>

      {/* ════════════════════════════════════════════
          FLOATING NAVIGATION
          ════════════════════════════════════════════ */}
      <FloatingNav activeTab={activeTab} setActiveTab={handleTabChange} isOwner={isOwner} />
    </div>
  );
}
