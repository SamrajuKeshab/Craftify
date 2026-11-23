import { AlertCircle, Star, X } from 'lucide-react';
import { useState } from 'react';
import { submitBuyerReview } from '../services/reviewsService';
import { extractServiceError } from '../services/sellerService';

export default function BuyerReviewModal({ target, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;
  const { item, suborder } = target;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (comment.trim().length < 8) {
      setError('Please share at least 8 characters about the handmade craft.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await submitBuyerReview({
        orderItemId: item.id,
        rating,
        title: title.trim(),
        comment: comment.trim(),
      });
      await onSubmitted(res);
    } catch (err) {
      setError(extractServiceError(err, 'Could not submit verified review.'));
    } finally {
      setSubmitting(false);
    }
  };

  const activeStars = hoverRating || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Write a Verified Purchase Review
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {item.product_title_snapshot} · {suborder.seller_shop_name_snapshot}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review modal"
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Overall Craftsmanship Rating
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} out of 5`}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= activeStars
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                {rating} / 5
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Review Headline (Optional)
            </label>
            <input
              type="text"
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Authentic glaze and careful packaging"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Review
            </label>
            <textarea
              rows={4}
              maxLength={1500}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share details about finish, material quality, and delivery packaging..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#8B4B28] px-5 py-2 text-xs font-semibold text-white hover:bg-[#733C1E] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Publishing...' : 'Publish Verified Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
