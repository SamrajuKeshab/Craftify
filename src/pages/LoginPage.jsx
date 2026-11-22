import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CraftifyLogo from '../components/common/CraftifyLogo';
import { useAuth } from '../context/AuthContext';

/**
 * Craftify Login Page — Strictly follows Master Spec Part 4.4:
 * Displays ONLY Username, Password, Login button, and "Don't have an account? Sign Up"
 * (plus a quiet password recovery link). Zero role selectors or role-specific login buttons.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const flashMessage = location.state?.message || '';
  const rawFrom =
    typeof location.state?.from === 'string'
      ? location.state.from
      : typeof location.state?.from?.pathname === 'string'
      ? `${location.state.from.pathname}${location.state.from.search || ''}`
      : '';
  const safeReturnTo =
    rawFrom.startsWith('/') && !rawFrom.startsWith('//') && rawFrom !== '/login'
      ? rawFrom
      : '';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { user: signedInUser, redirectUrl } = await login({ username, password });
      const targetUrl =
        safeReturnTo &&
        (signedInUser?.role === 'BUYER' ||
          safeReturnTo.startsWith('/products/') ||
          safeReturnTo.startsWith('/shops/') ||
          safeReturnTo.startsWith('/cart'))
          ? safeReturnTo
          : redirectUrl;
      navigate(targetUrl, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#EAE1D5] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center mb-7">
          <CraftifyLogo variant="light" to="/" />
          <h1 className="mt-5 font-serif text-2xl font-bold text-[#2C2018]">
            Welcome Back
          </h1>
          <p className="mt-1 text-sm text-[#6E5E52]">
            Sign in to continue to Craftify
          </p>
        </div>

        {flashMessage && !error && (
          <div
            role="status"
            className="mb-5 flex items-start gap-2 rounded-lg bg-[#EDF4EE] border border-[#D4E6D8] px-4 py-3 text-xs font-medium text-[#355E44]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{flashMessage}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-[#4A3B31] mb-1.5"
            >
              Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] placeholder:text-[#9B8B7E] focus:outline-none focus:border-[#8B4B28] focus:bg-white transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#4A3B31]"
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-[#8B4B28] hover:text-[#733C1E] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] placeholder:text-[#9B8B7E] focus:outline-none focus:border-[#8B4B28] focus:bg-white transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6E5E52]">
          Don&apos;t have an account?{' '}
          <Link
            to="/sign-up"
            className="font-semibold text-[#8B4B28] hover:text-[#733C1E] hover:underline"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
