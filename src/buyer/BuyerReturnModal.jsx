import {
  AlertCircle,
  Camera,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { extractServiceError } from '../services/sellerService';
import { createBuyerReturnRequest } from '../services/shippingService';
import { formatINR } from '../utils/formatters';

const ALL_RETURN_REASONS = [
  { value: 'DAMAGED', label: 'Damaged in Transit' },
  { value: 'DEFECTIVE', label: 'Defective Craftsmanship' },
  { value: 'WRONG_ITEM', label: 'Wrong Item Received' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as Described' },
  { value: 'SIZE_OR_FIT', label: 'Size or Dimension Mismatch' },
];

const RESTRICTED_RETURN_REASONS = ALL_RETURN_REASONS.slice(0, 3);

export default function BuyerReturnModal({
  item,
  suborder,
  onClose,
  onSubmitted,
}) {
  const isRestricted = Boolean(item?.is_return_restricted);
  const availableReasons = isRestricted
    ? RESTRICTED_RETURN_REASONS
    : ALL_RETURN_REASONS;

  const [reason, setReason] = useState(availableReasons[0].value);
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  if (!item || !suborder) return null;

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const combined = [...files, ...picked].slice(0, 3);
    setFiles(combined);
    e.target.value = '';
  };

  const handleRemoveFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createBuyerReturnRequest({
        orderItemId: item.id,
        reason,
        description: description.trim(),
        quantity,
        files,
      });
      await onSubmitted(res);
    } catch (err) {
      setError(
        extractServiceError(err, 'Could not submit your return request.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request 7-Day Return"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Request 7-Day Return
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {suborder.seller_shop_name_snapshot} ·{' '}
              <span className="font-mono">{suborder.suborder_number}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close return modal"
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Item Summary */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs">
          {item.product_image_snapshot ? (
            <img
              src={item.product_image_snapshot}
              alt={item.product_title_snapshot}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-lg object-cover bg-slate-200 shrink-0"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 truncate">
              {item.product_title_snapshot}
            </p>
            <p className="text-slate-500 mt-0.5">
              {item.variant_label_snapshot} ·{' '}
              <span className="font-mono tabular-nums">
                {formatINR(Number(item.unit_price_snapshot))}
              </span>{' '}
              × {item.quantity}
            </p>
          </div>
        </div>

        {isRestricted && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[11px] text-amber-900">
            <strong>Personalized / Made-to-Order Policy:</strong> This handmade
            item can only be returned if damaged in transit, defective, or wrong
            item received.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={item.quantity > 1 ? 'sm:col-span-2' : 'sm:col-span-3'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#8B4B28]"
              >
                {availableReasons.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {item.quantity > 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Qty to Return
                </label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#8B4B28]"
                >
                  {Array.from({ length: item.quantity }, (_, i) => i + 1).map(
                    (q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Details for the Artisan Studio
            </label>
            <textarea
              required
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what arrived damaged, defective, or mismatched so the studio can review quickly..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#8B4B28]"
            />
          </div>

          {/* Optional Cloudinary Photo Proof */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Photo Proof (Optional · up to 3 images)
              </label>
              <span className="text-[11px] text-slate-400">
                JPG, PNG, WebP · max 5 MB
              </span>
            </div>

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mb-2.5">
                {previews.map((src, idx) => (
                  <div
                    key={src}
                    className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200"
                  >
                    <img
                      src={src}
                      alt={`Evidence ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      aria-label="Remove photo"
                      className="absolute top-0.5 right-0.5 rounded bg-black/70 p-0.5 text-white hover:bg-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < 3 && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-[#8B4B28] hover:text-[#8B4B28] transition-colors">
                <Camera className="h-4 w-4" />
                <span>
                  {files.length === 0 ? 'Attach Evidence Photo' : 'Add Another Photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B4B28] px-5 py-2 text-xs font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit Return Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
