import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

/**
 * Calm verification reminder banner for authenticated users whose email is not yet verified.
 */
export default function EmailVerificationBanner() {
  const { user, resendVerification } = useAuth();
  const { showToast } = useCart();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.is_email_verified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await resendVerification();
      showToast(res.message || 'Verification email sent');
    } catch (err) {
      showToast(err.message || 'Could not resend email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="status"
      className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900"
    >
      <div className="flex items-start sm:items-center gap-2.5">
        <MailWarning className="h-4 w-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
        <span>
          Your email address (<strong>{user.email}</strong>) is not verified yet.
          Verify it to unlock seller applications and full order alerts.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          type="button"
          disabled={sending}
          onClick={handleResend}
          className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {sending ? 'Sending...' : 'Resend Verification Email'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss verification notice"
          className="p-1 text-amber-700 hover:text-amber-950"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
