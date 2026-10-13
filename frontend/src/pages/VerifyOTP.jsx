import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Lottie } from 'lottie-react';
import loadingAnimation from '../assets/Loading V2/loadingV2.json';
import { useLocation } from 'react-router-dom';
import apiClient from '../lib/axios';
import { jsonToast } from '../lib/jsonToast';
import useAuthStore from '../store/useAuthStore';

export default function VerifyOTP({ onBack, onVerify }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const [isLoading, setIsLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const handleChange = (index, value) => {
    // Only allow numbers
    const cleanValue = value.replace(/[^0-9]/g, '');

    // Handle paste of multiple digits
    if (cleanValue.length > 1) {
      const pastedData = cleanValue.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedData.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);

      // Focus last filled or next empty
      const nextIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanValue;
    setOtp(newOtp);

    // Auto-advance
    if (cleanValue !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Auto-retreat on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) return;

    setIsLoading(true);

    if (onVerify) {
      // If used inside Forgot Password flow, just pass it up
      onVerify(otpValue);
      setIsLoading(false);
    } else {
      // If used as a standalone page (like Registration Verify)
      try {
        const res = await apiClient.post('/auth/verify-email', {
          email,
          otp: otpValue,
        });
        jsonToast.success('Email verified successfully');
        setIsLoading(false);

        const user = res.data.data.user;
        useAuthStore.getState().setUser(user);

        if (!user.username) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        setIsLoading(false);
        jsonToast.error(err.response?.data?.message || 'Verification failed');
      }
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendStatus('Sending...');
    try {
      await apiClient.post('/auth/resend-verification', { email });
      jsonToast.success('OTP Resent!');
      setResendStatus('OTP Resent!');
      setTimeout(() => setResendStatus(''), 3000);
    } catch (err) {
      jsonToast.error(err.response?.data?.message || 'Failed to resend OTP');
      setResendStatus('Failed to send');
      setTimeout(() => setResendStatus(''), 3000);
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
      {/* Back Button */}
      <button
        onClick={() => onBack ? onBack() : navigate(-1)}
        className="group mb-8 flex items-center text-sm font-semibold text-gray-400 hover:text-black transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <h1 className="text-5xl font-serif mb-2 tracking-tight">Verify</h1>
      <p className="text-gray-400 text-sm font-sans mb-8 leading-relaxed">
        We've sent a 6-digit secure code to your email. Please enter it below to continue.
      </p>

      {/* Form */}
      <form className="space-y-8 font-sans" onSubmit={handleVerify}>
        <div className="flex justify-between gap-2 sm:gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl font-semibold border border-gray-200 rounded-xl focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all bg-gray-50/50"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="group w-full bg-black text-white text-sm font-medium py-3 rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed h-12"
        >
          {isLoading ? (
            <div className="w-8 h-8 flex items-center justify-center">
              <Lottie src={loadingAnimation} autoplay loop style={{ width: 32, height: 32, filter: 'brightness(0) invert(1)' }} />
            </div>
          ) : (
            <>
              <span className='text-emerald-500'>$rusty</span>
              <span>Confirm Code</span>
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
        Didn't receive the code?{' '}
        <button
          onClick={handleResend}
          type="button"
          disabled={!email || resendStatus === 'Sending...'}
          className="text-black font-semibold hover:underline cursor-pointer disabled:opacity-50"
        >
          Resend
        </button>
      </div>
    </motion.div>
  );
}
