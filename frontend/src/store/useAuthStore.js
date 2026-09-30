import { create } from 'zustand';
import apiClient from '../lib/axios';

const useAuthStore = create((set) => ({
  user: null,
  isInitializing: true,
  
  fetchUser: async () => {
    try {
      // Always attempt to fetch the user. The axios interceptor will handle 401s
      // and attempt to refresh the token automatically.
      const response = await apiClient.get('/users/me');
      localStorage.setItem('isAuthenticated', 'true');
      set({ user: response.data.data.user, isInitializing: false });
      return response.data.data.user;
    } catch (error) {
      localStorage.removeItem('isAuthenticated');
      set({ user: null, isInitializing: false });
      return null;
    }
  },

  clearUser: () => {
    localStorage.removeItem('isAuthenticated');
    set({ user: null });
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
      localStorage.removeItem('isAuthenticated');
      set({ user: null });
    } catch (error) {
      console.error("Logout failed", error);
    }
  },

  setUser: (user) => {
    set({ user });
  }
}));

export default useAuthStore;
