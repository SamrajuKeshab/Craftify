import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 6000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Bearer access token on every outgoing request
apiClient.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('craftify_access_token');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Automatically refresh expired access tokens when connected to live Django backend
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.url?.includes('/auth/login/')
    ) {
      const refreshToken = localStorage.getItem('craftify_refresh_token');
      if (refreshToken) {
        originalRequest._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('craftify_access_token', data.access);
          if (data.refresh) {
            localStorage.setItem('craftify_refresh_token', data.refresh);
          }
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return apiClient(originalRequest);
        } catch {
          localStorage.removeItem('craftify_access_token');
          localStorage.removeItem('craftify_refresh_token');
          localStorage.removeItem('craftify_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
