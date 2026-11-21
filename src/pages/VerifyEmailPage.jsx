import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CraftifyLogo from '../components/common/CraftifyLogo';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { verifyEmail, user, getDashboardUrl } = useAuth();

  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token
      ? 'Verifying your email address...'
      : 'No verification token was found in this link.'
  );

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyEmail(token)
      .then((res) => {
        if (!active) return;
        setStatus('success');
        setMessage(res.message || 'Your email address has been verified.');
      })
      .catch((err) => {
        if (!active) return;
        setStatus('error');
        setMessage(
          err.message || 'This verification link is invalid or has expired.'
        );
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#EAE1D5] p-8 shadow-sm text-center">
        <div className="flex justify-center mb-6">
          <CraftifyLogo variant="light" to="/" />
        </div>

        {status === 'loading' && (
          <div className="py-4 space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#8B4B28]" />
            <h1 className="font-serif text-2xl font-bold text-[#2C2018]">
              Verifying Email
            </h1>
            <p className="text-sm text-[#6E5E52]">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-2 space-y-4">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#355E44]" />
            <h1 className="font-serif text-2xl font-bold text-[#2C2018]">
              Email Verified
            </h1>
            <p className="text-sm text-[#524338]">{message}</p>
            <div className="pt-2">
              <Link
                to={user ? getDashboardUrl() : '/login'}
                className="inline-block w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                {user ? 'Go to Your Dashboard' : 'Continue to Sign In'}
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-2 space-y-4">
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
            <h1 className="font-serif text-2xl font-bold text-[#2C2018]">
              Verification Link Expired
            </h1>
            <p className="text-sm text-[#524338]">{message}</p>
            <div className="pt-2 space-y-2.5">
              <Link
                to={user ? getDashboardUrl() : '/login'}
                className="inline-block w-full rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                {user ? 'Request a New Link in Settings' : 'Back to Login'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
