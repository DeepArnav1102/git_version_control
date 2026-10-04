import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // for HttpOnly cookies
});

let refreshPromise = null;

// Response interceptor to handle 401s via refresh token rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 and only once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Deduplicate concurrent refresh calls: if a refresh is already in
        // flight (e.g. two tabs firing at once), reuse that promise instead
        // of hitting the endpoint twice.
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
            .finally(() => {
              // Always clear the shared promise when it settles (success OR fail)
              refreshPromise = null;
            });
        }

        await refreshPromise;

        // Small delay to let the browser commit the new Set-Cookie header
        // before we retry, eliminating the race between cookie write and read.
        await new Promise((r) => setTimeout(r, 50));

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh itself failed (token expired / revoked / server down).
        // Clear local auth state and redirect to sign-in instead of staying
        // on a broken page.
        useAuthStore.getState().clearUser();

        // Only redirect if we are not already on an auth page
        const publicPaths = ['/sign-in', '/sign-up', '/forgot-password', '/verify-otp'];
        const isPublic = publicPaths.some((p) => window.location.pathname.startsWith(p));
        if (!isPublic) {
          window.location.href = '/sign-in';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
