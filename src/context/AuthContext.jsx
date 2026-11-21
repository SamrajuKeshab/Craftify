import { createContext, useContext, useEffect, useState } from 'react';
import { clearAccessToken, setAccessToken } from '../services/apiClient';
import {
  changePasswordRequest,
  checkBackendHealth,
  confirmPasswordReset,
  loginRequest,
  logoutAllRequest,
  logoutRequest,
  refreshSessionRequest,
  registerRequest,
  requestPasswordReset,
  resendVerificationRequest,
  verifyEmailRequest,
} from '../services/authService';

const AuthContext = createContext(null);

const BACKEND_OFFLINE_MSG =
  'Cannot reach the Craftify Django server. Make sure Django is running (`python manage.py runserver`) and try again.';

function resolveRedirectUrl(role) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'SELLER') return '/seller/dashboard';
  return '/buyer/dashboard';
}

function extractApiError(err, fallback) {
  // Network error or proxy 502/504 when Django runserver is turned off
  if (!err?.response || err.response.status === 502 || err.response.status === 504) {
    return BACKEND_OFFLINE_MSG;
  }
  const data = err.response.data;
  if (!data || typeof data === 'string') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0];
  }
  const firstValue = Object.values(data)[0];
  if (Array.isArray(firstValue) && firstValue[0]) return firstValue[0];
  if (typeof firstValue === 'string') return firstValue;
  return fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // On mount: check real Django backend and silently hydrate session via HttpOnly refresh cookie
  useEffect(() => {
    let active = true;
    async function initAuth() {
      const health = await checkBackendHealth();
      if (!active) return;
      setBackendConnected(health.connected);

      if (health.connected) {
        try {
          const data = await refreshSessionRequest();
          if (!active) return;
          setAccessToken(data.access);
          setUser(data.user);
        } catch {
          clearAccessToken();
          if (active) setUser(null);
        }
      } else {
        clearAccessToken();
        setUser(null);
      }
      if (active) setAuthLoading(false);
    }
    initAuth();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Real Django Login — fails cleanly if Django backend is offline (never fakes login).
   */
  const login = async ({ username, password }) => {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      throw new Error('Please enter both username and password.');
    }

    try {
      const data = await loginRequest({ username: trimmedUser, password });
      setBackendConnected(true);
      setAccessToken(data.access);
      setUser(data.user);
      return {
        user: data.user,
        redirectUrl: data.redirect_url || resolveRedirectUrl(data.user.role),
      };
    } catch (err) {
      throw new Error(extractApiError(err, 'Invalid username or password.'));
    }
  };

  /**
   * Real Django Public Sign-Up — always requires live Django + PostgreSQL (never fakes registration).
   */
  const register = async ({ fullName, username, email, password, confirmPassword }) => {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    try {
      const data = await registerRequest({
        fullName,
        username,
        email,
        password,
        confirmPassword,
      });
      setBackendConnected(true);
      setAccessToken(data.access);
      setUser(data.user);
      return {
        user: data.user,
        redirectUrl: data.redirect_url || '/buyer/dashboard',
      };
    } catch (err) {
      throw new Error(
        extractApiError(err, 'Registration failed. Please check your details.')
      );
    }
  };

  const logout = async () => {
    await logoutRequest();
    clearAccessToken();
    setUser(null);
  };

  const logoutAll = async () => {
    try {
      await logoutAllRequest();
    } catch (err) {
      throw new Error(extractApiError(err, 'Could not revoke active sessions.'));
    }
    clearAccessToken();
    setUser(null);
  };

  const verifyEmail = async (token) => {
    if (!token) {
      throw new Error('Verification token is missing.');
    }
    try {
      const data = await verifyEmailRequest(token);
      if (data.user) {
        setUser((prev) => (prev ? { ...prev, is_email_verified: true } : data.user));
      }
      return data;
    } catch (err) {
      throw new Error(
        extractApiError(err, 'This verification link is invalid or has expired.')
      );
    }
  };

  const resendVerification = async () => {
    try {
      return await resendVerificationRequest();
    } catch (err) {
      throw new Error(
        extractApiError(err, 'Unable to resend verification email right now.')
      );
    }
  };

  const sendPasswordReset = async (email) => {
    try {
      return await requestPasswordReset(email);
    } catch (err) {
      throw new Error(extractApiError(err, 'Unable to send reset request right now.'));
    }
  };

  const completePasswordReset = async ({ token, newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    try {
      return await confirmPasswordReset({ token, newPassword, confirmPassword });
    } catch (err) {
      throw new Error(
        extractApiError(err, 'This password reset link is invalid or has expired.')
      );
    }
  };

  const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match.');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    try {
      const data = await changePasswordRequest({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (data.access) {
        setAccessToken(data.access);
      }
      return data;
    } catch (err) {
      throw new Error(extractApiError(err, 'Unable to update password.'));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        backendConnected,
        login,
        register,
        logout,
        logoutAll,
        verifyEmail,
        resendVerification,
        sendPasswordReset,
        completePasswordReset,
        changePassword,
        getDashboardUrl: () => resolveRedirectUrl(user?.role),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
