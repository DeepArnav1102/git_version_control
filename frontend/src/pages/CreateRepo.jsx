import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, Globe, Lock, ArrowLeft, Loader2, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';
import useAuthStore from '../store/useAuthStore';

// Animation variants
const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function CreateRepo() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [addReadme, setAddReadme] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowVisibilityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [focused, setFocused] = useState(false);

  const criteria = [
    { id: 'min_length', label: '3+ characters', regex: /.{3,}/ },
    { id: 'max_length', label: 'Under 100 characters', regex: /^.{0,100}$/ },
    { id: 'valid_chars', label: 'Letters, numbers, _, -', regex: /^[a-zA-Z0-9_-]+$/ },
  ];

  const getMet = (regex) => {
    if (!name) return false;
    if (regex.source === '^.{0,100}$') {
      return name.length > 0 && name.length <= 100;
    }
    return regex.test(name);
  };

  const sortedCriteria = [...criteria].sort((a, b) => {
    const aMet = getMet(a.regex);
    const bMet = getMet(b.regex);
    if (aMet === bMet) {
      return criteria.indexOf(a) - criteria.indexOf(b);
    }
    return aMet ? -1 : 1; 
  });
  
  const isValid = criteria.every(c => getMet(c.regex));

  const [isAvailable, setIsAvailable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!name || name.trim() === '') {
      setIsAvailable(null);
      return;
    }
    
    if (!isValid) {
      setIsAvailable(null);
      return;
    }

    const checkName = async () => {
      setIsChecking(true);
      try {
        const res = await apiClient.get(`/repos/check-availability?name=${name}`);
        if (res.data?.success) {
          setIsAvailable(res.data.available);
        } else {
          setIsAvailable(false);
        }
      } catch (err) {
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      checkName();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [name, isValid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      jsonToast.error('Please enter a repository name');
      return;
    }
    if (!isValid) {
      jsonToast.error('Please enter a valid repository name');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/repos', {
        name: name.trim(),
        description: description.trim(),
        isPrivate,
      });

      const repo = res.data.data;
      const ownerHandle = user?.username || user?.email?.split('@')[0] || 'user';
      jsonToast.success('Repository created successfully!');
      navigate(`/repo/${ownerHandle}/${repo.name}`);
    } catch (err) {
      jsonToast.error(err?.response?.data?.message || 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  };

  const ownerName = user?.username || user?.email?.split('@')[0] || 'user';
  
  const defaultPfp = import.meta.env.VITE_DEFAULT_PFP_URL || 'https://res.cloudinary.com/do0st5xde/image/upload/v1787493034/defaultpfp.jpg';
  const profilePic = user?.profilePicture || defaultPfp;

  return (
    <motion.div
      className="max-w-3xl mx-auto px-6 py-12 font-sans min-h-screen"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div className="mb-10" variants={itemVariants}>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">
          Create a new repository
        </h1>
        <p className="text-sm text-gray-500 mb-2">
          Repositories contain a project's files and version history. Have a project elsewhere? <a href="#" className="text-blue-600 hover:underline">Import a repository.</a>
        </p>
        <p className="text-sm text-gray-500 italic">
          Required fields are marked with an asterisk (*).
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Section 1: General */}
        <motion.div className="flex gap-6" variants={itemVariants}>
          <div className="flex-shrink-0 mt-0.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-500">
              1
            </span>
          </div>
          
          <div className="flex-1 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">General</h2>
            
            <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-4">
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Owner *</label>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-sm font-medium text-gray-900 cursor-not-allowed opacity-80 h-9">
                  <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0">
                    <img 
                      src={profilePic} 
                      alt={ownerName} 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = defaultPfp; }}
                    />
                  </div>
                  <span>{ownerName}</span>
                  <ChevronDown size={14} className="text-gray-400 ml-2" />
                </div>
              </div>

              <span className="hidden sm:block text-gray-400 text-xl font-light mt-7">/</span>

              <div className="flex-1 w-full relative">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Repository name *
                </label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    required
                    className={`w-full px-3 py-1.5 h-9 text-sm bg-white border rounded-md outline-none transition-all pr-10
                      ${!name 
                        ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                        : (isValid && isAvailable === false) || !isValid
                          ? 'border-red-300 focus:ring-red-200'
                          : isAvailable === true
                            ? 'border-green-300 focus:ring-green-200' 
                            : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {isChecking && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                    {!isChecking && name && isValid && isAvailable === true && <Check className="w-4 h-4 text-green-500" />}
                    {!isChecking && name && (!isValid || isAvailable === false) && <X className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
                
                {isValid && isAvailable === false && !isChecking && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">The repository {name} already exists on this account.</p>
                )}
                
                <AnimatePresence>
                  {(focused || (name && name.length > 0)) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 top-[calc(100%+0.5rem)] w-full sm:w-64 bg-white border border-gray-100 shadow-xl rounded-xl p-4 z-50 pointer-events-none"
                    >
                      <div className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-wider">
                        Repository Name Rules
                      </div>
                      <div className="flex flex-col gap-2">
                        {sortedCriteria.map((c) => {
                          const met = getMet(c.regex);
                          return (
                            <motion.div
                              layout
                              key={c.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center text-xs font-medium"
                            >
                              <motion.div
                                animate={{ 
                                  backgroundColor: met ? '#10b981' : '#f3f4f6',
                                  borderColor: met ? '#10b981' : '#e5e7eb',
                                }}
                                className="w-4 h-4 rounded-full border flex items-center justify-center mr-2.5 shrink-0"
                              >
                                <motion.svg 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: met ? 1 : 0 }}
                                  className="w-2.5 h-2.5 text-white" 
                                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </motion.svg>
                              </motion.div>
                              <motion.span
                                animate={{
                                  color: met ? '#9ca3af' : '#111827',
                                }}
                                className="relative"
                              >
                                {c.label}
                                <motion.span
                                  initial={false}
                                  animate={{ width: met ? '100%' : '0%' }}
                                  className="absolute left-0 top-1/2 h-[1px] bg-gray-400 -translate-y-1/2"
                                />
                              </motion.span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-1">
              Great repository names are short and memorable. How about <span className="font-semibold text-gray-700">congenial-fortnight</span>?
            </p>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Description <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 h-9 text-sm bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <p className="text-xs text-gray-400 mt-1.5 flex justify-end">
                {description.length} / 350 characters
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section 2: Configuration */}
        <motion.div className="flex gap-6" variants={itemVariants}>
          <div className="flex-shrink-0 mt-0.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-500">
              2
            </span>
          </div>
          
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
            
            <div className="border border-gray-200 rounded-lg">
              {/* Visibility */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 gap-4 sm:gap-0">
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Choose visibility *</label>
                  <p className="text-xs text-gray-500 mt-0.5">Choose who can see and commit to this repository</p>
                </div>
                
                <div className="relative" ref={dropdownRef}>
                  <button 
                    type="button"
                    onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none transition-colors"
                  >
                    {isPrivate ? <Lock size={14} className="text-gray-500" /> : <Globe size={14} className="text-gray-500" />}
                    {isPrivate ? 'Private' : 'Public'}
                    <ChevronDown size={14} className="text-gray-500" />
                  </button>
                  
                  {showVisibilityDropdown && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                      <button
                        type="button"
                        onClick={() => { setIsPrivate(false); setShowVisibilityDropdown(false); }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                      >
                        <Globe size={14} className="text-gray-500" />
                        <div>
                          <div className="font-medium text-gray-900">Public</div>
                          <div className="text-xs text-gray-500">Anyone on the internet</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsPrivate(true); setShowVisibilityDropdown(false); }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                      >
                        <Lock size={14} className="text-gray-500" />
                        <div>
                          <div className="font-medium text-gray-900">Private</div>
                          <div className="text-xs text-gray-500">Only you can view</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Add README */}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Add README</label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    READMEs can be used as longer descriptions. <a href="#" className="text-blue-600 hover:underline">About READMEs</a>
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 font-medium">{addReadme ? 'On' : 'Off'}</span>
                  <button
                    type="button"
                    onClick={() => setAddReadme(!addReadme)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${addReadme ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${addReadme ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className="h-px bg-gray-200 mt-8 mb-6" variants={itemVariants} />

        {/* Submit */}
        <motion.div className="flex justify-end pt-2" variants={itemVariants}>
          <button
            type="submit"
            disabled={loading || !name.trim() || !isValid || isAvailable === false || isChecking}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-[#2da44e] hover:bg-[#2c974b] disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-sm transition-all cursor-pointer"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Create repository
          </button>
        </motion.div>
      </form>
    </motion.div>
  );
}

