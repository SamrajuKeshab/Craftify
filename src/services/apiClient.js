import axios from 'axios';

// Uses Vite same-origin proxy `/api/v1` in local VS Code dev so HttpOnly refresh cookies persist across reloads.
// In production (Vercel), set VITE_API_BASE_URL to your Render HTTPS URL (e.g. https://craftify-api.onrender.com/api/v1).
const rawEnvBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
const isLocalCrossPortDevUrl =
  import.meta.env.DEV &&
  /^https?:\/\/(127\.0\.0\.1|localhost):8000\/api\/v1\/?$/i.test(rawEnvBaseUrl);

export const API_BASE_URL =
  !rawEnvBaseUrl || isLocalCrossPortDevUrl
    ? '/api/v1'
    : rawEnvBaseUrl.replace(/\/+$/, '');

// Short-lived JWT access token stored strictly in JS memory (never localStorage or sessionStorage)
let inMemoryAccessToken = null;

// Single-flight mutex so concurrent 401s or React StrictMode double-mounts NEVER send two
// competing rotating refresh-token requests (which would blacklist the cookie and log the user out).
let inflightRefreshPromise = null;

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

/**
 * Deduplicated HttpOnly cookie refresh call. All concurrent callers share the exact same
 * in-flight promise so SimpleJWT token rotation never races against itself.
 */
export function refreshAccessToken() {
  if (!inflightRefreshPromise) {
    inflightRefreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/token/refresh/`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        }
      )
      .then(({ data }) => {
        setAccessToken(data.access);
        return data;
      })
      .catch((err) => {
        clearAccessToken();
        throw err;
      })
      .finally(() => {
        inflightRefreshPromise = null;
      });
  }
  return inflightRefreshPromise;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
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

// Silently rotate access token using the deduplicated HttpOnly refresh cookie when a 401 occurs
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
        const data = await refreshAccessToken();
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
