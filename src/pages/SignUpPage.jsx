import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CraftifyLogo from '../components/common/CraftifyLogo';
import { useAuth } from '../context/AuthContext';

/**
 * Craftify Public Sign-Up Page — Strictly follows Master Spec Part 4.4:
 * Collects Full Name, Username, Email Address, Password, Confirm Password.
 * Every public registration automatically creates a BUYER account.
 */
export default function SignUpPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { redirectUrl } = await register(form);
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#EAE1D5] p-8 shadow-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <CraftifyLogo variant="light" to="/" />
          <h1 className="mt-5 font-serif text-2xl font-bold text-[#2C2018]">
            Create Your Account
          </h1>
          <p className="mt-1 text-sm text-[#6E5E52]">
            Join Craftify to discover and collect handmade Indian crafts
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="signup-fullname"
              className="block text-xs font-semibold text-[#4A3B31] mb-1"
            >
              Full Name
            </label>
            <input
              id="signup-fullname"
              name="fullName"
              type="text"
              required
              value={form.fullName}
              onChange={handleChange}
              placeholder="Priya Sharma"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="signup-username"
              className="block text-xs font-semibold text-[#4A3B31] mb-1"
            >
              Username
            </label>
            <input
              id="signup-username"
              name="username"
              type="text"
              required
              value={form.username}
              onChange={handleChange}
              placeholder="priya_sharma"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="signup-email"
              className="block text-xs font-semibold text-[#4A3B31] mb-1"
            >
              Email Address
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="priya@example.com"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className="block text-xs font-semibold text-[#4A3B31] mb-1"
            >
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="signup-confirm"
              className="block text-xs font-semibold text-[#4A3B31] mb-1"
            >
              Confirm Password
            </label>
            <input
              id="signup-confirm"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6E5E52]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#8B4B28] hover:text-[#733C1E] hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
