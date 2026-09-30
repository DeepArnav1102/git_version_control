import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // for HttpOnly cookies
});

let refreshPromise = null;

// Response interceptor to handle 401s for refresh token rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        }
        await refreshPromise;
        refreshPromise = null;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
