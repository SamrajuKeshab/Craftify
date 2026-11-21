import apiClient from './apiClient';

export async function checkBackendHealth() {
  try {
    const { data } = await apiClient.get('/health/');
    return { connected: true, data };
  } catch {
    return { connected: false, data: null };
  }
}

export async function refreshSessionRequest() {
  const { data } = await apiClient.post('/auth/token/refresh/', {});
  return data;
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

export async function logoutRequest() {
  try {
    await apiClient.post('/auth/logout/', {});
  } catch {
    // Clear local session cleanly even if backend is offline in preview mode
  }
}

export async function logoutAllRequest() {
  const { data } = await apiClient.post('/auth/logout-all/', {});
  return data;
}

export async function verifyEmailRequest(token) {
  const { data } = await apiClient.post('/auth/verify-email/', { token });
  return data;
}

export async function resendVerificationRequest() {
  const { data } = await apiClient.post('/auth/resend-verification/', {});
  return data;
}

export async function requestPasswordReset(email) {
  const { data } = await apiClient.post('/auth/password/reset/', { email });
  return data;
}

export async function confirmPasswordReset({
  token,
  newPassword,
  confirmPassword,
}) {
  const { data } = await apiClient.post('/auth/password/reset/confirm/', {
    token,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
  return data;
}

export async function changePasswordRequest({
  currentPassword,
  newPassword,
  confirmPassword,
}) {
  const { data } = await apiClient.post('/auth/password/change/', {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
  return data;
}
