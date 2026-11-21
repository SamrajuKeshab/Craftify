import { CheckCircle2, KeyRound, LogOut, MailCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

/**
 * Shared Security Settings view for Buyer, Seller, and Admin dashboards:
 * - Email verification status + Resend action
 * - Change Password (verifies current password & revokes other sessions)
 * - Sign Out All Devices (blacklists all active refresh tokens)
 */
export default function AccountSecurityPanel() {
  const { user, changePassword, logoutAll, resendVerification } = useAuth();
  const { showToast } = useCart();
  const navigate = useNavigate();

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);
  const [resending, setResending] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    setSavingPwd(true);
    try {
      const res = await changePassword(passwords);
      setPwdSuccess(res.message || 'Password updated successfully.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password updated');
    } catch (err) {
      setPwdError(err.message || 'Could not update password.');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogoutAll = async () => {
    setRevokingAll(true);
    try {
      await logoutAll();
      navigate('/login', {
        replace: true,
        state: { message: 'Signed out from all active devices.' },
      });
    } catch (err) {
      showToast(err.message || 'Unable to sign out all devices');
      setRevokingAll(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await resendVerification();
      showToast(res.message || 'Verification email sent');
    } catch (err) {
      showToast(err.message || 'Could not send verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Account & Verification Status */}
      <div className="rounded-xl bg-white border border-slate-200/80 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {user?.is_email_verified ? (
              <MailCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Email Verification
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {user?.email} ·{' '}
                <span
                  className={
                    user?.is_email_verified
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-amber-700'
                  }
                >
                  {user?.is_email_verified ? 'Verified' : 'Pending Verification'}
                </span>
              </p>
            </div>
          </div>

          {!user?.is_email_verified && (
            <button
              type="button"
              disabled={resending}
              onClick={handleResend}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-[#2E9A90] hover:text-[#2E9A90] disabled:opacity-60 whitespace-nowrap"
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </button>
          )}
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-xl bg-white border border-slate-200/80 p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <KeyRound className="h-4 w-4 text-[#2E9A90]" />
          <h2 className="text-base font-bold text-slate-900">Change Password</h2>
        </div>

        {pwdError && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
          >
            {pwdError}
          </div>
        )}
        {pwdSuccess && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{pwdSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label
              htmlFor="sec-current-password"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Current Password
            </label>
            <input
              id="sec-current-password"
              type="password"
              required
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, currentPassword: e.target.value })
              }
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sec-new-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                New Password
              </label>
              <input
                id="sec-new-password"
                type="password"
                required
                minLength={8}
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, newPassword: e.target.value })
                }
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              />
            </div>

            <div>
              <label
                htmlFor="sec-confirm-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="sec-confirm-password"
                type="password"
                required
                minLength={8}
                value={passwords.confirmPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, confirmPassword: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPwd}
            className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 transition-colors"
          >
            {savingPwd ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Active Sessions Revocation */}
      <div className="rounded-xl bg-white border border-slate-200/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Active Sessions Across Devices
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immediately revoke all refresh tokens on phones, tablets, and other browsers.
          </p>
        </div>

        <button
          type="button"
          disabled={revokingAll}
          onClick={handleLogoutAll}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{revokingAll ? 'Signing Out...' : 'Sign Out All Devices'}</span>
        </button>
      </div>
    </div>
  );
}
