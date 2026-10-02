import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Users, AlertTriangle, GitBranch, Webhook, Check, X, UserPlus, Trash2, Clock, Shield } from 'lucide-react';
import apiClient from '../../lib/axios';
import { jsonToast } from '../../lib/jsonToast';

const defaultPfp = 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';

const CustomSelect = ({ value, onChange, options, icon: Icon, className, placement = 'bottom' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {Icon && <Icon size={14} className="text-gray-500 shrink-0" />}
          <span className="text-gray-800 font-medium truncate">{selectedOption?.label}</span>
        </div>
        <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: placement === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: placement === 'top' ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-20 w-full ${placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden`}
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map(opt => (
                <div 
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`px-3 py-2 text-[13px] cursor-pointer flex flex-col transition-colors ${value === opt.value ? 'bg-blue-50 border-l-2 border-blue-600' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
                >
                  <span className={`font-semibold ${value === opt.value ? 'text-blue-700' : 'text-gray-800'}`}>{opt.label}</span>
                  {opt.description && <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">{opt.description}</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function SettingsTab({
  repoSettings,
  setRepoSettings,
  updatingSettings,
  handleUpdateRepo,
  repoData,
  otpSent,
  handleRequestDeleteOtp,
  deleting,
  deleteOtp,
  setDeleteOtp,
  handleDeleteRepo
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [topicInput, setTopicInput] = useState('');
  
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('read');
  const [inviting, setInviting] = useState(false);
  const [collabs, setCollabs] = useState([]);
  const [invites, setInvites] = useState([]);
  
  const [searchedUser, setSearchedUser] = useState(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  useEffect(() => {
    if (repoData) {
      setCollabs(repoData.collaborators || []);
      setInvites(repoData.pendingInvites || []);
    }
  }, [repoData]);

  useEffect(() => {
    if (!inviteUsername.trim()) {
      setSearchedUser(null);
      setIsSearchingUser(false);
      return;
    }
    
    setIsSearchingUser(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/users/u/${inviteUsername.trim()}`);
        setSearchedUser(res.data.data.user);
      } catch (err) {
        setSearchedUser(null);
      } finally {
        setIsSearchingUser(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [inviteUsername]);

  const handleAddTopic = (e) => {
    if (e.key === 'Enter' && topicInput.trim()) {
      e.preventDefault();
      const newTopic = topicInput.trim().toLowerCase();
      if (!repoSettings.topics?.includes(newTopic)) {
        setRepoSettings({
          ...repoSettings,
          topics: [...(repoSettings.topics || []), newTopic]
        });
      }
      setTopicInput('');
    }
  };

  const removeTopic = (topicToRemove) => {
    setRepoSettings({
      ...repoSettings,
      topics: (repoSettings.topics || []).filter(t => t !== topicToRemove)
    });
  };

  const toggleFeature = (featureName) => {
    setRepoSettings({
      ...repoSettings,
      features: {
        ...repoSettings.features,
        [featureName]: !repoSettings.features?.[featureName]
      }
    });
  };

  const handleInviteCollaborator = async () => {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    try {
      await apiClient.post(`/repos/${repoData.owner.username}/${repoData.name}/collaborators/invite`, {
        username: inviteUsername.trim(),
        role: inviteRole
      });
      jsonToast.success('Invitation sent!');
      setInviteUsername('');
      // In a real app, we'd refetch repoData, but we can optimistically assume it was added or wait for reload
    } catch (err) {
      jsonToast.error(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (userId, isInvite) => {
    try {
      await apiClient.delete(`/repos/${repoData.owner.username}/${repoData.name}/collaborators/${userId}`);
      if (isInvite) {
        setInvites(prev => prev.filter(i => i.user?._id !== userId));
      } else {
        setCollabs(prev => prev.filter(c => c.user?._id !== userId));
      }
      jsonToast.success('Removed successfully');
    } catch (err) {
      jsonToast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <motion.div
      key="tab-settings"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className="mt-6 w-full flex flex-col md:flex-row gap-6 min-h-[500px]"
    >
      {/* Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0">
        <nav className="flex flex-col space-y-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'general' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Settings size={16} /> General
          </button>
          <button
            onClick={() => setActiveTab('collaborators')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'collaborators' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Users size={16} /> Collaborators
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'danger' ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
            }`}
          >
            <AlertTriangle size={16} /> Danger Zone
          </button>
        </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                  <h3 className="text-lg font-bold text-gray-900">General Settings</h3>
                </div>
                <div className="p-6">
                  <form onSubmit={handleUpdateRepo} className="space-y-5">
                    <div>
                      <label className="block text-[13px] font-semibold text-gray-800 mb-1">Repository Name</label>
                      <input
                        type="text"
                        value={repoSettings.name}
                        onChange={(e) => setRepoSettings({ ...repoSettings, name: e.target.value })}
                        className="w-full max-w-lg px-3 py-2 text-[13px] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[13px] font-semibold text-gray-800 mb-1">Description</label>
                      <input
                        type="text"
                        value={repoSettings.description}
                        onChange={(e) => setRepoSettings({ ...repoSettings, description: e.target.value })}
                        className="w-full max-w-2xl px-3 py-2 text-[13px] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-gray-800 mb-1">Topics</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(repoSettings.topics || []).map(topic => (
                          <span key={topic} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                            {topic}
                            <button type="button" onClick={() => removeTopic(topic)} className="hover:bg-blue-200 rounded-full p-0.5 cursor-pointer">
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={handleAddTopic}
                        placeholder="Add topics (press Enter)"
                        className="w-full max-w-lg px-3 py-2 text-[13px] bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <h4 className="text-[13px] font-semibold text-gray-800 mb-3">Features</h4>
                      <div className="space-y-3 max-w-lg">
                        <label className="flex items-center justify-between cursor-pointer group">
                          <div>
                            <span className="text-[13px] font-medium text-gray-900 block group-hover:text-blue-600">Issues</span>
                            <span className="text-[11px] text-gray-500">Enable issue tracker for this repository</span>
                          </div>
                          <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${repoSettings.features?.hasIssues ? 'bg-blue-600' : 'bg-gray-200'}`}>
                            <input type="checkbox" className="sr-only" checked={repoSettings.features?.hasIssues || false} onChange={() => toggleFeature('hasIssues')} />
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${repoSettings.features?.hasIssues ? 'translate-x-4' : 'translate-x-1'}`} />
                          </div>
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group">
                          <div>
                            <span className="text-[13px] font-medium text-gray-900 block group-hover:text-blue-600">Pull Requests</span>
                            <span className="text-[11px] text-gray-500">Accept pull requests for code changes</span>
                          </div>
                          <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${repoSettings.features?.hasPullRequests ? 'bg-blue-600' : 'bg-gray-200'}`}>
                            <input type="checkbox" className="sr-only" checked={repoSettings.features?.hasPullRequests || false} onChange={() => toggleFeature('hasPullRequests')} />
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${repoSettings.features?.hasPullRequests ? 'translate-x-4' : 'translate-x-1'}`} />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <h4 className="text-[13px] font-semibold text-gray-800 mb-3">Visibility</h4>
                      <div className="flex items-center gap-4 max-w-lg">
                        <label className="flex items-center gap-2 cursor-pointer p-2.5 border border-gray-200 rounded-lg flex-1 hover:border-blue-300 transition-colors bg-gray-50 hover:bg-white">
                          <input
                            type="radio"
                            name="visibility"
                            checked={!repoSettings.isPrivate}
                            onChange={() => setRepoSettings({ ...repoSettings, isPrivate: false })}
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div>
                            <span className="text-[13px] text-gray-900 font-bold block">Public</span>
                            <span className="text-[11px] text-gray-500 block">Anyone can see this repository</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-2.5 border border-gray-200 rounded-lg flex-1 hover:border-blue-300 transition-colors bg-gray-50 hover:bg-white">
                          <input
                            type="radio"
                            name="visibility"
                            checked={repoSettings.isPrivate}
                            onChange={() => setRepoSettings({ ...repoSettings, isPrivate: true })}
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div>
                            <span className="text-[13px] text-gray-900 font-bold block">Private</span>
                            <span className="text-[11px] text-gray-500 block">Only you and collaborators can see</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {repoData?.branches?.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <label className="block text-[13px] font-semibold text-gray-800 mb-1">Default Branch</label>
                        <CustomSelect 
                          value={repoSettings.defaultBranch}
                          onChange={(val) => setRepoSettings({ ...repoSettings, defaultBranch: val })}
                          options={repoData.branches.map(b => ({ value: b.name, label: b.name }))}
                          icon={GitBranch}
                          className="w-full max-w-xs h-[38px]"
                        />
                      </div>
                    )}

                    <div className="pt-6 border-t border-gray-200 flex items-center justify-end max-w-2xl">
                      <button
                        type="submit"
                        disabled={updatingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {updatingSettings ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'collaborators' && (
            <motion.div
              key="collaborators"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between rounded-t-xl">
                  <h3 className="text-lg font-bold text-gray-900">Manage Access</h3>
                </div>
                <div className="p-6">
                  {/* Invite Form */}
                  <div className="mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="text-[13px] font-bold text-gray-900 mb-3">Invite a collaborator</h4>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          value={inviteUsername}
                          onChange={(e) => setInviteUsername(e.target.value)}
                          placeholder="Search by username..."
                          className="w-full px-3 py-2 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-[38px]"
                        />
                        <AnimatePresence>
                          {inviteUsername.trim() && (
                            <motion.div 
                              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                              className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 flex items-center gap-3"
                            >
                              {isSearchingUser ? (
                                <span className="text-[12px] text-gray-500 py-1 px-2">Searching...</span>
                              ) : searchedUser ? (
                                <div 
                                  className={`w-full flex items-center gap-3 p-1.5 rounded-md transition-colors ${searchedUser.username.toLowerCase() === inviteUsername.trim().toLowerCase() ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-100 cursor-pointer border border-transparent'}`}
                                  onClick={() => setInviteUsername(searchedUser.username)}
                                >
                                  <img 
                                    src={searchedUser.profilePicture || defaultPfp} 
                                    onError={(e) => { e.target.src = defaultPfp; }}
                                    className="w-8 h-8 rounded-full border border-gray-200" 
                                    alt="" 
                                  />
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-[13px] font-bold text-gray-900 truncate leading-tight flex items-center gap-1">
                                      {searchedUser.name || searchedUser.username}
                                      {searchedUser.username.toLowerCase() === inviteUsername.trim().toLowerCase() && (
                                        <Check size={14} className="text-green-600" />
                                      )}
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate leading-tight">@{searchedUser.username}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[12px] text-red-500 py-1 px-2">User not found</span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      <CustomSelect 
                        value={inviteRole}
                        onChange={(val) => setInviteRole(val)}
                        options={[
                          { value: 'read', label: 'Read', description: 'Can view and clone code' },
                          { value: 'write', label: 'Write', description: 'Can push to the repository' },
                          { value: 'admin', label: 'Admin', description: 'Full access including settings' }
                        ]}
                        className="w-[160px] h-[38px]"
                      />

                      <button 
                        onClick={handleInviteCollaborator}
                        disabled={inviting || !searchedUser}
                        className="h-[38px] px-4 bg-blue-600 text-white font-semibold rounded-lg text-[13px] hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <UserPlus size={14} />
                        {inviting ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>
                    
                    <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-start gap-2">
                      <div className="mt-0.5"><AlertTriangle size={14} className="text-blue-500"/></div>
                      <div className="text-[12px] text-blue-800 leading-relaxed">
                        <span className="font-semibold text-blue-900">Role Permissions:</span>
                        <ul className="mt-1.5 space-y-1 pl-1">
                          <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400"></span><strong>Read:</strong> Can clone and view code, but cannot push changes.</li>
                          <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400"></span><strong>Write:</strong> Can push commits to branches and collaborate on code.</li>
                          <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400"></span><strong>Admin:</strong> Full access, including repository settings and collaborator management.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Active Collaborators */}
                  <div className="mb-6">
                    <h4 className="text-[13px] font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3">Active Collaborators</h4>
                    {collabs.length === 0 ? (
                      <p className="text-[13px] text-gray-500 py-2">No collaborators have been added yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {collabs.map(collab => (
                          <div key={collab.user?._id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                            <div className="flex items-center gap-3">
                              <img 
                                src={collab.user?.profilePicture || defaultPfp} 
                                onError={(e) => { e.target.src = defaultPfp; }}
                                alt={collab.user?.username} 
                                className="w-8 h-8 rounded-full" 
                              />
                              <div>
                                <p className="text-[13px] font-bold text-gray-900">{collab.user?.username}</p>
                                <p className="text-[11px] text-gray-500">{collab.user?.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[11px] font-medium rounded capitalize">{collab.role}</span>
                              <button onClick={() => handleRemoveCollaborator(collab.user?._id, false)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pending Invites */}
                  {invites.length > 0 && (
                    <div>
                      <h4 className="text-[13px] font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3">Pending Invitations</h4>
                      <div className="space-y-3">
                        {invites.map(invite => (
                          <div key={invite.user?._id} className="flex items-center justify-between p-3 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-3">
                              <img 
                                src={invite.user?.profilePicture || defaultPfp} 
                                onError={(e) => { e.target.src = defaultPfp; }}
                                alt={invite.user?.username} 
                                className="w-8 h-8 rounded-full opacity-75" 
                              />
                              <div>
                                <p className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
                                  {invite.user?.username}
                                  <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 rounded uppercase font-bold"><Clock size={10}/> Pending</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-gray-200 text-gray-600 text-[11px] font-medium rounded capitalize">{invite.role}</span>
                              <button onClick={() => handleRemoveCollaborator(invite.user?._id, true)} className="text-[11px] font-semibold text-gray-500 hover:text-red-600">
                                Revoke
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'danger' && (
            <motion.div
              key="danger"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-red-200 bg-red-50">
                  <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
                </div>
                <div className="p-6 space-y-6">
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Transfer ownership</h4>
                      <p className="text-xs text-gray-600 mt-1 max-w-xl">
                        Transfer this repository to another user or to an organization where you have the right to create repositories.
                      </p>
                    </div>
                    <button disabled className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg text-xs font-bold transition-colors cursor-not-allowed opacity-50">
                      Transfer
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Archive this repository</h4>
                      <p className="text-xs text-gray-600 mt-1 max-w-xl">
                        Mark this repository as archived and read-only.
                      </p>
                    </div>
                    <button disabled className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg text-xs font-bold transition-colors cursor-not-allowed opacity-50">
                      Archive repo
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Delete this repository</h4>
                      <p className="text-xs text-gray-600 mt-1 max-w-xl">
                        Once you delete a repository, there is no going back. Please be certain.
                      </p>
                    </div>
                    {!otpSent ? (
                      <button
                        onClick={handleRequestDeleteOtp}
                        disabled={deleting}
                        className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm cursor-pointer"
                      >
                        {deleting ? 'Requesting...' : 'Delete repository'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          value={deleteOtp}
                          onChange={(e) => setDeleteOtp(e.target.value)}
                          className="w-32 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center tracking-widest font-mono"
                          maxLength={6}
                        />
                        <button
                          onClick={handleDeleteRepo}
                          disabled={deleting || deleteOtp.length !== 6}
                          className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm cursor-pointer"
                        >
                          {deleting ? 'Deleting...' : 'Confirm'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
