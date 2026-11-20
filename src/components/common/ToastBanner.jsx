import { CheckCircle2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function ToastBanner() {
  const { toastMessage } = useCart();

  if (!toastMessage) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-lg bg-[#242B33] px-4 py-3 text-sm font-medium text-white shadow-lg border border-white/10"
    >
      <CheckCircle2 className="h-4 w-4 text-[#2E9A90] shrink-0" />
      <span>{toastMessage}</span>
    </div>
  );
}
