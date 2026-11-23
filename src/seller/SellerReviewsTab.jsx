import {
  AlertCircle,
  CheckCircle2,
  MessageSquareReply,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { replyToSellerReview } from '../services/reviewsService';
import { extractServiceError } from '../services/sellerService';

export default function SellerReviewsTab({
  reviewsData,
  ratingFilter,
  onRatingFilterChange,
  loading,
  onRefresh,
}) {
  const [replyDrafts, setReplyDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const summary = reviewsData?.summary || {
    rating_avg: '0.00',
    review_count: 0,
    unreplied_count: 0,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })),
  };
  const reviews = reviewsData?.results || [];

  const handleSendReply = async (reviewId) => {
    const text = (replyDrafts[reviewId] || '').trim();
    if (text.length < 3) {
      setFeedback({
        type: 'error',
        text: 'Enter a studio reply of at least 3 characters.',
      });
      return;
    }
    setBusyId(reviewId);
    setFeedback(null);
    try {
      const res = await replyToSellerReview(reviewId, text);
      setFeedback({ type: 'success', text: res.detail });
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not post studio reply.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Studio Rating Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-xl bg-white border border-slate-200/80 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Verified Studio Rating
            </p>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="font-mono text-4xl font-bold text-slate-900 tabular-nums">
                {summary.rating_avg}
              </span>
              <span className="text-xs text-slate-500">/ 5.00</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${
                    s <= Math.round(Number(summary.rating_avg || 0))
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500 font-mono tabular-nums">
            {summary.review_count} published · {summary.unreplied_count || 0} awaiting reply
          </p>
        </div>

        <div className="lg:col-span-8 rounded-xl bg-white border border-slate-200/80 p-5">
          <p className="text-xs font-bold text-slate-900 mb-3">
            Star Rating Breakdown
          </p>
          <div className="space-y-2">
            {(summary.distribution || []).map((row) => {
              const pct =
                summary.review_count > 0
                  ? Math.round((row.count / summary.review_count) * 100)
                  : 0;
              return (
                <div key={row.stars} className="flex items-center gap-3 text-xs">
                  <span className="w-10 font-mono font-semibold text-slate-700 tabular-nums">
                    {row.stars} ★
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2E9A90]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-slate-500 tabular-nums">
                    {row.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews List + Inline Studio Reply */}
      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Verified Buyer Reviews ({reviews.length})
            </h2>
            <p className="text-xs text-slate-500">
              Every review comes from a buyer whose craft order was marked Delivered.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ratingFilter}
              onChange={(e) => onRatingFilterChange(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {loading && reviews.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-10 text-center">
            <Star className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No verified buyer reviews yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Once buyers receive delivered orders and rate your handmade crafts, their
              reviews appear here for you to respond to.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => (
              <div key={rev.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-amber-600 tabular-nums">
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(5 - rev.rating)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-slate-900">
                        {rev.product_title}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{rev.variant_label}</span>
                      {rev.status === 'HIDDEN' && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold text-red-700">
                            Hidden by Admin
                          </span>
                        </>
                      )}
                    </div>
                    {rev.title && (
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {rev.title}
                      </p>
                    )}
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {rev.comment}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-400 shrink-0">
                    <div>@{rev.buyer_username} · Verified</div>
                    <div>
                      {new Date(rev.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>

                {rev.seller_reply && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-4 py-2.5 text-xs">
                    <p className="font-semibold text-[#2E9A90]">
                      Your Studio Reply
                    </p>
                    <p className="mt-0.5 text-slate-700">{rev.seller_reply}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={1000}
                    value={replyDrafts[rev.id] ?? ''}
                    onChange={(e) =>
                      setReplyDrafts({ ...replyDrafts, [rev.id]: e.target.value })
                    }
                    placeholder={
                      rev.seller_reply
                        ? 'Update your studio response...'
                        : 'Thank the buyer or answer a craftsmanship question...'
                    }
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-[#2E9A90]"
                  />
                  <button
                    type="button"
                    disabled={busyId === rev.id}
                    onClick={() => handleSendReply(rev.id)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2E9A90] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <MessageSquareReply className="h-3.5 w-3.5" />
                    <span>{rev.seller_reply ? 'Update Reply' : 'Post Reply'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
