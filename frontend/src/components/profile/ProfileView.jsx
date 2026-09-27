import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Building2, Clock, Mail, Users, UserPlus, Pencil } from 'lucide-react';
import { socialIcons } from './ProfileIcons';
import { InfoRow } from './ProfileShared';

export default function ProfileView({ user, onEdit, isFollowing, onToggleFollow, currentUser }) {
  const locationStr = user?.location
    ? [user.location.city, user.location.state, user.location.country].filter(Boolean).join(', ')
    : null;

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  const socials = (user?.socialLinks || []).filter((s) => s.platform && s.url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-3">
        <h1 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">
          {user?.name || user?.username}
        </h1>
        <p className="text-[15px] text-gray-400 font-light mt-0.5">{user?.username}</p>
        {user?.gender && user.gender !== 'Prefer not to say' && (
          <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 mt-1.5 inline-block">
            {user.gender}
          </span>
        )}
      </div>

      {user?.bio && (
        <p className="text-[13.5px] text-gray-600 leading-relaxed mb-4">{user.bio}</p>
      )}

      {onEdit ? (
        <button
          onClick={onEdit}
          className="w-full py-1.5 px-4 text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 mb-5 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Pencil size={13} strokeWidth={1.8} />
          Edit profile
        </button>
      ) : currentUser && (
        <button
          onClick={onToggleFollow}
          className="w-full py-1.5 px-4 text-[13px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 mb-5 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      )}

      <div className="flex items-center gap-3 mb-5 text-[13px] text-gray-600">
        <button className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer group">
          <Users size={15} strokeWidth={1.6} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
          <strong className="text-gray-900 font-semibold">{user?.followers?.length ?? 0}</strong>
          <span>followers</span>
        </button>
        <span className="text-gray-300">·</span>
        <button className="flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer group">
          <UserPlus size={15} strokeWidth={1.6} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          <strong className="text-gray-900 font-semibold">{user?.following?.length ?? 0}</strong>
          <span>following</span>
        </button>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />

      <div className="flex flex-col gap-2.5 mb-5">
        {user?.organization && (
          <InfoRow icon={Building2}>{user.organization}</InfoRow>
        )}
        {locationStr && (
          <InfoRow icon={MapPin}>{locationStr}</InfoRow>
        )}
        {user?.localTime && (
          <InfoRow icon={Clock}>{user.localTime}</InfoRow>
        )}
        {user?.email && (
          <InfoRow icon={Mail}>
            <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline">
              {user.email}
            </a>
          </InfoRow>
        )}
      </div>

      {socials.length > 0 && (
        <>
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />
          <div className="flex flex-wrap gap-2">
            {socials.map((social, idx) => {
              const cfg = socialIcons[social.platform];
              if (!cfg) return null;
              const SocialIcon = cfg.icon;
              return (
                <a
                  key={idx}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-all duration-200 hover:shadow-sm"
                  style={{
                    color: cfg.color,
                    borderColor: `${cfg.color}30`,
                    backgroundColor: `${cfg.color}08`,
                  }}
                >
                  <SocialIcon size={13} />
                  {cfg.label}
                </a>
              );
            })}
          </div>
        </>
      )}

      {joinDate && (
        <div className="mt-5 pt-4 border-t border-gray-100 text-[11.5px] text-gray-400 flex items-center gap-1.5">
          <Clock size={12} strokeWidth={1.4} />
          Joined {joinDate}
        </div>
      )}
    </motion.div>
  );
}
