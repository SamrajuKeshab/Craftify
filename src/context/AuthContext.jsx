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

function resolveRedirectUrl(role) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'SELLER') return '/seller/dashboard';
  return '/buyer/dashboard';
}

function extractApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
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

  // On mount: detect local Django backend and silently hydrate session via HttpOnly refresh cookie
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
      }
      if (active) setAuthLoading(false);
    }
    initAuth();
    return () => {
      active = false;
    };
  }, []);

  const login = async ({ username, password }) => {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      throw new Error('Please enter both username and password.');
    }

    if (backendConnected) {
      try {
        const data = await loginRequest({ username: trimmedUser, password });
        setAccessToken(data.access);
        setUser(data.user);
        return {
          user: data.user,
          redirectUrl: data.redirect_url || resolveRedirectUrl(data.user.role),
        };
      } catch (err) {
        throw new Error(extractApiError(err, 'Invalid username or password.'));
      }
    }

    // Standalone preview fallback (when running without local Django)
    const lower = trimmedUser.toLowerCase();
    let role = 'BUYER';
    let fullName = trimmedUser;
    if (lower === 'admin' || lower === 'craftify_admin') {
      role = 'ADMIN';
      fullName = 'Craftify Admin';
    } else if (lower === 'seller' || lower === 'artistic_creations') {
      role = 'SELLER';
      fullName = 'Artistic Creations';
    }

    const previewUser = {
      id: `preview-${lower}`,
      username: trimmedUser,
      full_name: fullName,
      email: `${lower}@craftify.in`,
      role,
      is_email_verified: role !== 'BUYER',
    };
    setUser(previewUser);
    return {
      user: previewUser,
      redirectUrl: resolveRedirectUrl(role),
    };
  };

  const register = async ({ fullName, username, email, password, confirmPassword }) => {
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    if (backendConnected) {
      try {
        const data = await registerRequest({
          fullName,
          username,
          email,
          password,
          confirmPassword,
        });
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
    }

    const previewBuyer = {
      id: `preview-${username.trim().toLowerCase()}`,
      username: username.trim(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: 'BUYER',
      is_email_verified: false,
    };
    setUser(previewBuyer);
    return {
      user: previewBuyer,
      redirectUrl: '/buyer/dashboard',
    };
  };

  const logout = async () => {
    if (backendConnected) {
      await logoutRequest();
    }
    clearAccessToken();
    setUser(null);
  };

  const logoutAll = async () => {
    if (backendConnected) {
      try {
        await logoutAllRequest();
      } catch (err) {
        throw new Error(extractApiError(err, 'Could not revoke active sessions.'));
      }
    }
    clearAccessToken();
    setUser(null);
  };

  const verifyEmail = async (token) => {
    if (!token) {
      throw new Error('Verification token is missing.');
    }
    if (backendConnected) {
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
    }
    setUser((prev) => (prev ? { ...prev, is_email_verified: true } : prev));
    return { message: 'Email verified successfully in preview mode.' };
  };

  const resendVerification = async () => {
    if (backendConnected) {
      try {
        return await resendVerificationRequest();
      } catch (err) {
        throw new Error(
          extractApiError(err, 'Unable to resend verification email right now.')
        );
      }
    }
    return {
      message:
        'Verification link ready—connect your local Django server in VS Code to view the email link in your terminal.',
    };
  };

  const sendPasswordReset = async (email) => {
    if (backendConnected) {
      try {
        return await requestPasswordReset(email);
      } catch (err) {
        throw new Error(extractApiError(err, 'Unable to send reset request right now.'));
      }
    }
    return {
      message:
        'If an account exists for that email address, a password reset link has been sent.',
    };
  };

  const completePasswordReset = async ({ token, newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (backendConnected) {
      try {
        return await confirmPasswordReset({ token, newPassword, confirmPassword });
      } catch (err) {
        throw new Error(
          extractApiError(err, 'This password reset link is invalid or has expired.')
        );
      }
    }
    return { message: 'Password reset successful. Please sign in with your new password.' };
  };

  const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match.');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (backendConnected) {
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
    }
    return { message: 'Password updated successfully.' };
  };

  const enterPreviewRole = (role) => {
    const presets = {
      ADMIN: {
        id: 'preview-admin',
        username: 'admin',
        full_name: 'Craftify Admin',
        email: 'admin@craftify.in',
        role: 'ADMIN',
        is_email_verified: true,
      },
      SELLER: {
        id: 'preview-seller',
        username: 'artistic_creations',
        full_name: 'Artistic Creations',
        email: 'studio@craftify.in',
        role: 'SELLER',
        is_email_verified: true,
      },
      BUYER: {
        id: 'preview-buyer',
        username: 'priya_sharma',
        full_name: 'Priya Sharma',
        email: 'priya@craftify.in',
        role: 'BUYER',
        is_email_verified: false,
      },
    };
    const selected = presets[role] || presets.BUYER;
    setUser(selected);
    return resolveRedirectUrl(selected.role);
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
        enterPreviewRole,
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
