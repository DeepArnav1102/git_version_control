import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../../lib/axios';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import useAuthStore from '../../../store/useAuthStore';

// Reusing backend logic constraints
const coreDetailsSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  bio: z.string()
    .max(500, 'Bio cannot exceed 500 characters')
    .optional(),
});

const CoreDetailsStep = ({ username, onNext, onBack }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(coreDetailsSchema),
    defaultValues: { name: '', bio: '' }
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSuggestions([]);
    try {
      const res = await apiClient.patch('/users/onboarding', {
        username: username,
        name: data.name,
        bio: data.bio
      });
      
      if (res.data?.data?.user) {
        useAuthStore.getState().setUser(res.data.data.user);
      }
      
      toast.success("Profile setup complete!");
      onNext();
    } catch (error) {
      if (error.response?.status === 409) {
        // Handle race condition where username got taken
        toast.error("That username was just taken. Please go back and pick another.");
        if (error.response.data.data?.suggestions) {
          setSuggestions(error.response.data.data.suggestions);
        }
      } else {
        toast.error(error.response?.data?.message || "Failed to update profile. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      <button 
        onClick={onBack}
        className="self-start flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </button>



      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm mx-auto flex flex-col space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            {...register('name')}
            className={`block w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all
              ${errors.name ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-green-100 focus:border-green-500'}`}
            placeholder="Jane Smith"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
            Bio <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            id="bio"
            rows={3}
            {...register('bio')}
            className={`block w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all resize-none
              ${errors.bio ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-green-100 focus:border-green-500'}`}
            placeholder="I build awesome things..."
          />
          {errors.bio && <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>}
        </div>

        {suggestions.length > 0 && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <p className="text-sm text-red-800 font-medium mb-2">Username '{username}' was just taken. Go back or try these:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(sug => (
                <span key={sug} className="px-2 py-1 bg-white border border-red-200 rounded text-xs text-red-700 font-mono">
                  {sug}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="group w-full bg-black text-white text-sm font-medium py-3 rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed h-12"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <>
              <span className='text-emerald-500'>$rusty</span>
              <span>Continue</span>
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
    </div>
  );
};

export default CoreDetailsStep;
