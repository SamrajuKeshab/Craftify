import axios from 'axios';

// Uses Vite same-origin proxy `/api/v1` in local VS Code dev so HttpOnly refresh cookies work seamlessly.
// In production (Vercel), set VITE_API_BASE_URL to your Render HTTPS URL (e.g. https://craftify-api.onrender.com/api/v1).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Short-lived JWT access token stored strictly in JS memory (never localStorage or sessionStorage)
let inMemoryAccessToken = null;

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 6000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Attach in-memory Bearer access token on every outgoing request
apiClient.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

// Silently rotate access token using the HttpOnly refresh cookie when a 401 occurs
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthBypassUrl =
      originalRequest?.url?.includes('/auth/login/') ||
      originalRequest?.url?.includes('/auth/register/') ||
      originalRequest?.url?.includes('/auth/token/refresh/');

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isAuthBypassUrl
    ) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/token/refresh/`,
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
          }
        );
        setAccessToken(data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest);
      } catch {
        clearAccessToken();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
