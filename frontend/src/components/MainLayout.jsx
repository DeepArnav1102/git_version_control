import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import Navbar from './Navbar';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../assets/Loading V2/loadingV2.json';

export default function MainLayout({ children }) {
  const navigate = useNavigate();

  const { user, isInitializing } = useAuthStore();

  useEffect(() => {
    // Wait until the global auth bootstrap (initializeAuth in App.jsx) is done.
    // While isInitializing is true the refresh token flow may still be in-flight —
    // redirecting now would incorrectly send the user to the login page.
    if (isInitializing) return;

    if (!user) {
      navigate('/', { replace: true });
    } else if (!user.username) {
      navigate('/onboarding', { replace: true });
    }
  }, [isInitializing, user, navigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Lottie 
          animationData={loadingAnimation} 
          loop={true} 
          autoplay={true} 
          className="w-20 h-20 opacity-80" 
        />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      {/* Add top padding so content is not hidden behind the fixed navbar */}
      <main className="flex-grow pt-20 relative z-0">
        {children}
      </main>
    </div>
  );
}
