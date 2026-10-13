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
      // Proactively refresh the access token before calling /users/me, but ONLY
      // if we have a session hint. This prevents a 401 on the first request after
      // the access token expired (page idle, server restart, etc.) while also
      // avoiding an extra server hit for unauthenticated / guest users.
      //
      // Security note: localStorage is JS-readable, but this flag is purely a
      // performance hint — it cannot grant access. The real auth decision is made
      // server-side via the HttpOnly refreshToken cookie which JS cannot touch.
      // The refresh endpoint is also rate-limited to mitigate abuse.
      if (localStorage.getItem('isAuthenticated') === 'true') {
        try {
          await apiClient.post('/auth/refresh');
        } catch {
          // Refresh failed — either the refresh token expired or was revoked.
          // fetchUser below will confirm the final auth state.
        }
      }

      await get().fetchUser();
    })();

    return _initPromise;
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
      console.error('Logout failed', error);
    }
  },

  setUser: (user) => {
    set({ user });
  },
}));

export default useAuthStore;
