import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import CraftifyLogo from '../components/common/CraftifyLogo';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await sendPasswordReset(email.trim());
      setSubmittedMessage(
        res.message ||
          'If an account exists for that email address, a password reset link has been sent.'
      );
    } catch (err) {
      setError(err.message || 'Unable to process request right now.');
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
            Reset Your Password
          </h1>
          <p className="mt-1 text-sm text-[#6E5E52]">
            Enter the email address associated with your Craftify account.
          </p>
        </div>

        {submittedMessage ? (
          <div className="space-y-5 text-center">
            <div
              role="status"
              className="rounded-xl bg-[#EDF4EE] border border-[#D4E6D8] p-4 text-sm text-[#355E44] flex flex-col items-center gap-2"
            >
              <CheckCircle2 className="h-6 w-6 text-[#355E44]" />
              <p>{submittedMessage}</p>
            </div>
            <p className="text-xs text-[#6E5E52]">
              In local VS Code development, check your Django terminal console for
              the clickable reset link.
            </p>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
            >
              Return to Login
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
                htmlFor="forgot-email"
                className="block text-xs font-semibold text-[#4A3B31] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@example.com"
                className="w-full rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]/60 px-3.5 py-2.5 text-sm text-[#2C2018] placeholder:text-[#9B8B7E] focus:outline-none focus:border-[#8B4B28] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Sending Reset Link...' : 'Send Reset Link'}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#524338] hover:text-[#8B4B28]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
