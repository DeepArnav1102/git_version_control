import React, { useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import WaveScene from './WaveScene';
import ForgotPasswordVisual from './ForgotPasswordVisual';
import useAuthStore from '../store/useAuthStore';

export default function AuthLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const isInitializing = useAuthStore(state => state.isInitializing);
  const isForgotPassword = location.pathname === '/forgot-password';

  // React to the auth state set by App.jsx's initializeAuth() — no duplicate fetchUser() call here
  useEffect(() => {
    if (!isInitializing && user) {
      if (user.username) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [isInitializing, user, navigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        {/* Prevent flashing the login form while auth state is being resolved */}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4">
        {children || <Outlet />}
      </div>

      {/* Right Column - Visual (Hidden on small screens) */}
      <div className="hidden lg:block lg:w-1/2 relative bg-white overflow-hidden">
        <AnimatePresence mode="wait">
          {isForgotPassword ? (
            <motion.div
              key="forgotPassword"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <ForgotPasswordVisual />
            </motion.div>
          ) : (
            <motion.div
              key="waveScene"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <WaveScene />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
