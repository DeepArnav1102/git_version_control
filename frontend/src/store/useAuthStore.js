import { create } from 'zustand';
import apiClient from '../lib/axios';

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
  // Subsequent calls are no-ops once initialization is done.
  initializeAuth: async () => {
    // Already done — skip to avoid duplicate network calls
    if (!get().isInitializing) return;

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
