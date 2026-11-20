import { createContext, useContext, useEffect, useState } from 'react';
import {
  checkBackendHealth,
  loginRequest,
  logoutRequest,
  registerRequest,
} from '../services/authService';

const AuthContext = createContext(null);

function resolveRedirectUrl(role) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'SELLER') return '/seller/dashboard';
  return '/buyer/dashboard';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('craftify_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    let active = true;
    checkBackendHealth().then((result) => {
      if (active) setBackendConnected(result.connected);
    });
    return () => {
      active = false;
    };
  }, []);

  const persistSession = (userData, access, refresh) => {
    setUser(userData);
    localStorage.setItem('craftify_user', JSON.stringify(userData));
    if (access) localStorage.setItem('craftify_access_token', access);
    if (refresh) localStorage.setItem('craftify_refresh_token', refresh);
  };

  /**
   * Unified Login handler:
   * - Calls live Django /api/v1/auth/login/ when backend is running in VS Code.
   * - Falls back cleanly in standalone preview mode so all 3 dashboards can be verified.
   */
  const login = async ({ username, password }) => {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      throw new Error('Please enter both username and password.');
    }

    if (backendConnected) {
      try {
        const data = await loginRequest({ username: trimmedUser, password });
        persistSession(data.user, data.access, data.refresh);
        return {
          user: data.user,
          redirectUrl: data.redirect_url || resolveRedirectUrl(data.user.role),
        };
      } catch (err) {
        const msg =
          err.response?.data?.non_field_errors?.[0] ||
          err.response?.data?.detail ||
          'Invalid username or password.';
        throw new Error(msg);
      }
    }

    // Standalone preview resolution (mirrors Django backend authoritative role resolution)
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
    };
    persistSession(previewUser, null, null);
    return {
      user: previewUser,
      redirectUrl: resolveRedirectUrl(role),
    };
  };

  /**
   * Public Sign-Up handler — ALWAYS creates a BUYER account.
   */
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
        persistSession(data.user, data.access, data.refresh);
        return {
          user: data.user,
          redirectUrl: data.redirect_url || '/buyer/dashboard',
        };
      } catch (err) {
        const firstFieldError = Object.values(err.response?.data || {})[0];
        const msg = Array.isArray(firstFieldError)
          ? firstFieldError[0]
          : err.response?.data?.detail || 'Registration failed. Please check your details.';
        throw new Error(msg);
      }
    }

    const previewBuyer = {
      id: `preview-${username.trim().toLowerCase()}`,
      username: username.trim(),
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: 'BUYER',
    };
    persistSession(previewBuyer, null, null);
    return {
      user: previewBuyer,
      redirectUrl: '/buyer/dashboard',
    };
  };

  const logout = async () => {
    const refresh = localStorage.getItem('craftify_refresh_token');
    if (backendConnected && refresh) {
      await logoutRequest(refresh);
    }
    setUser(null);
    localStorage.removeItem('craftify_access_token');
    localStorage.removeItem('craftify_refresh_token');
    localStorage.removeItem('craftify_user');
  };

  const enterPreviewRole = (role) => {
    const presets = {
      ADMIN: {
        id: 'preview-admin',
        username: 'admin',
        full_name: 'Craftify Admin',
        email: 'admin@craftify.in',
        role: 'ADMIN',
      },
      SELLER: {
        id: 'preview-seller',
        username: 'artistic_creations',
        full_name: 'Artistic Creations',
        email: 'studio@craftify.in',
        role: 'SELLER',
      },
      BUYER: {
        id: 'preview-buyer',
        username: 'priya_sharma',
        full_name: 'Priya Sharma',
        email: 'priya@craftify.in',
        role: 'BUYER',
      },
    };
    const selected = presets[role] || presets.BUYER;
    persistSession(selected, null, null);
    return resolveRedirectUrl(selected.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        backendConnected,
        login,
        register,
        logout,
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
