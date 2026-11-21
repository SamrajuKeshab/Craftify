import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CraftifyLogo from '../components/common/CraftifyLogo';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { completePasswordReset } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await completePasswordReset({
        token,
        newPassword,
        confirmPassword,
      });
      navigate('/login', {
        replace: true,
        state: {
          message:
            res.message ||
            'Password reset successful. Please sign in with your new password.',
        },
      });
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
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
            Choose a New Password
          </h1>
          <p className="mt-1 text-sm text-[#6E5E52]">
            Use at least 8 characters. Resetting your password signs out all other devices.
          </p>
        </div>

        {!token ? (
          <div className="text-center space-y-4">
            <AlertCircle className="mx-auto h-9 w-9 text-red-600" />
            <p className="text-sm text-[#524338]">
              This password reset link is missing a valid security token.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
            >
              Request a New Reset Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="reset-new-password"
                className="block text-xs font-semibold text-[#4A3B31] mb-1.5"
              >
                New Password
              </label>
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="block text-xs font-semibold text-[#4A3B31] mb-1.5"
              >
                Confirm New Password
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
