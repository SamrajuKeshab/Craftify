import apiClient from './apiClient';

export async function checkBackendHealth() {
  try {
    const { data } = await apiClient.get('/health/');
    return { connected: true, data };
  } catch {
    return { connected: false, data: null };
  }
}

export async function loginRequest({ username, password }) {
  const { data } = await apiClient.post('/auth/login/', { username, password });
  return data;
}

export async function registerRequest({
  fullName,
  username,
  email,
  password,
  confirmPassword,
}) {
  const { data } = await apiClient.post('/auth/register/', {
    full_name: fullName,
    username,
    email,
    password,
    confirm_password: confirmPassword,
  });
  return data;
}

export async function logoutRequest(refreshToken) {
  if (!refreshToken) return;
  try {
    await apiClient.post('/auth/logout/', { refresh: refreshToken });
  } catch {
    // Clear local session even if backend is offline in preview mode
  }
}
