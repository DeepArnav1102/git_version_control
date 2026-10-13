import { create } from 'zustand';
import apiClient from '../lib/axios';

// Module-level singleton — ensures initializeAuth is only ever executed once,
// even if called concurrently (e.g. React StrictMode double useEffect).
let _initPromise = null;

const useAuthStore = create((set, get) => ({
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

  // Call this ONCE at the app root (main.jsx / App.jsx).
  // A module-level promise ensures that even React StrictMode's double
  // useEffect invocation shares the same in-flight init — no duplicate
  // network calls or race conditions.
  initializeAuth: async () => {
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      // If there is no session hint, we are an unauthenticated guest.
      // Settle immediately without making any unnecessary network calls.
      if (localStorage.getItem('isAuthenticated') !== 'true') {
        set({ user: null, isInitializing: false });
        return null;
      }

      // If we have a session hint, fetch the current user.
      // If the access token is expired, the axios interceptor will handle
      // the refresh rotation and retry automatically.
      return await get().fetchUser();
    })();

    return _initPromise;
  },

  clearUser: () => {
    localStorage.removeItem('isAuthenticated');
    _initPromise = null;
    set({ user: null, isInitializing: false });
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      localStorage.removeItem('isAuthenticated');
      _initPromise = null;
      set({ user: null, isInitializing: false });
    }
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem('isAuthenticated', 'true');
    }
    set({ user, isInitializing: false });
  },
}));

export default useAuthStore;
