import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PasswordInput from '../components/PasswordInput';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../assets/Loading V2/loadingV2.json';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';
import useAuthStore from '../store/useAuthStore';

export default function SignIn() {
  const navigate = useNavigate();
  const setUser = useAuthStore(state => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: async (codeResponse) => {
      try {
        setIsLoading(true);
        const res = await apiClient.post('/auth/google/callback', {
          code: codeResponse.code,
          redirectUri: 'postmessage',
        });
        jsonToast.success('Google Sign-In successful');

        const user = res.data.data.user;
        setUser(user);

        if (!user.username) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        jsonToast.error(err.response?.data?.message || 'Google Sign-In failed');
      } finally {
        setIsLoading(false);
      }
    },
    onError: errorResponse => jsonToast.error('Google Sign-In failed'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      jsonToast.success('Login successful');

      const user = res.data.data.user;
      setUser(user);
      setIsLoading(false);

      if (!user.username) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setIsLoading(false);
      if (err.response?.status === 404) {
        jsonToast.error('Account does not exist. Please create an account.');
      } else {
        jsonToast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md mx-auto p-8 sm:p-12"
    >
      {/* Header */}
      <h1 className="text-5xl font-serif mb-2 tracking-tight">Sign In</h1>
      <p className="text-gray-400 text-sm font-sans mb-8">
        Continue to access your dashboard
      </p>

      {/* Social Logins */}
      <div className="space-y-3 mb-8 font-sans text-sm font-medium">
        <button
          onClick={() => handleGoogleLogin()}
          type="button"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-gray-400 font-sans tracking-widest uppercase">
            OR
          </span>
        </div>
      </div>

      {/* Form */}
      <form className="space-y-5 font-sans" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-semibold text-black mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-black">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs font-semibold text-black hover:underline">
              Forgot Password?
            </Link>
          </div>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="group w-full bg-black text-white text-sm font-medium py-3 rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed h-12"
        >
          {isLoading ? (
            <div className="w-8 h-8 flex items-center justify-center">
              <Lottie src={loadingAnimation} autoplay loop style={{ width: 32, height: 32, filter: 'brightness(0) invert(1)' }} />
            </div>
          ) : (
            <>
              <span className='text-emerald-500'>$rusty</span>
              <span>Sign In</span>
              <svg
                className="w-4 h-4 transform -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-8 text-center font-sans text-sm text-gray-400">
        Don't have an account?{' '}
        <Link to="/signup" className="text-black font-semibold hover:underline">
          Create an Account
        </Link>
      </div>
    </motion.div>
  );
}
