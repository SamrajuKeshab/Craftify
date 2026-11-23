import {
  BarChart3,
  Eye,
  EyeOff,
  RefreshCw,
  Star,
  Store,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { moderateAdminReview } from '../services/reviewsService';
import { extractServiceError } from '../services/sellerService';
import { formatINR, formatINRCompact } from '../utils/formatters';

export default function AdminAnalyticsTab({
  analytics,
  reviewsData,
  reviewStatusFilter,
  onReviewStatusFilterChange,
  loading,
  onRefresh,
  onFeedback,
}) {
  const [subTab, setSubTab] = useState('analytics');
  const [busyId, setBusyId] = useState(null);
  const [noteMap, setNoteMap] = useState({});

  const monthly = analytics?.monthly_performance || [];
  const categories = analytics?.category_breakdown || [];
  const funnel = analytics?.fulfilment_funnel || [];
  const paymentMix = analytics?.payment_mix || [];
  const topStudios = analytics?.top_studios || [];
  const quality = analytics?.quality_metrics || {
    platform_rating_avg: '0.00',
    total_published_reviews: 0,
    return_rate_pct: 0,
    total_paid_out: '0.00',
    total_refunds_processed: '0.00',
  };

  const reviews = reviewsData?.results || [];

  const handleModerate = async (reviewId, nextStatus) => {
    const notes = (noteMap[reviewId] || '').trim();
    if (nextStatus === 'HIDDEN' && notes.length < 5) {
      onFeedback({
        type: 'error',
        text: 'Enter a moderation reason (min 5 chars) before hiding a review.',
      });
      return;
    }
    setBusyId(reviewId);
    onFeedback(null);
    try {
      const res = await moderateAdminReview(reviewId, {
        status: nextStatus,
        moderationNotes: notes || 'Restored by Admin',
      });
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update review status.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Sub-Tab Switcher */}
      <div className="rounded-xl bg-white border border-slate-200/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'analytics'
                ? 'border-[#2E9A90] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Platform Analytics
          </button>
          <button
            type="button"
            onClick={() => setSubTab('reviews')}
            className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'reviews'
                ? 'border-[#2E9A90] text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Review Moderation ({reviews.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'reviews' && (
            <select
              value={reviewStatusFilter}
              onChange={(e) => onReviewStatusFilterChange(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
            >
              <option value="ALL">Status: ALL</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="HIDDEN">HIDDEN</option>
            </select>
          )}
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

      {subTab === 'analytics' ? (
        <div className="space-y-5">
          {/* Quality & Settlement KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Platform Avg Rating</span>
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {quality.platform_rating_avg} / 5
              </p>
              <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
                {quality.total_published_reviews} verified reviews
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Post-Delivery Return Rate</span>
                <TrendingUp className="h-4 w-4 text-[#2E9A90]" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {quality.return_rate_pct}%
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Returned vs. delivered suborders
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Artisan Payouts Paid</span>
                <Store className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatINR(quality.total_paid_out)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Settled via NEFT/IMPS UTR
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Buyer Refunds Processed</span>
                <BarChart3 className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatINR(quality.total_refunds_processed)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Completed return &amp; prepaid refunds
              </p>
            </div>
          </div>

          {/* Real DB Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200/80 p-5">
              <h3 className="text-sm font-bold text-slate-900">
                6-Month GMV vs. Platform Commission (INR ₹)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Live PostgreSQL aggregation across confirmed &amp; delivered orders
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      tickFormatter={(v) => formatINRCompact(v)}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <Tooltip formatter={(val) => formatINR(val)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Gross Sales (₹)"
                      stroke="#2E9A90"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="commission"
                      name="Platform Commission (₹)"
                      stroke="#8B4B28"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200/80 p-5">
              <h3 className="text-sm font-bold text-slate-900">
                Revenue by Craft Category
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Top categories ranked by confirmed INR sales
              </p>
              {categories.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Category sales data will populate once orders are placed.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categories} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatINRCompact(v)}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="category"
                        width={110}
                        tick={{ fontSize: 11, fill: '#334155' }}
                      />
                      <Tooltip formatter={(val) => formatINR(val)} />
                      <Bar dataKey="revenue" name="Revenue (₹)" fill="#2E9A90" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Payment Mix + Fulfilment Funnel + Top Artisan Studios */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-xl bg-white border border-slate-200/80 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Payment Method Mix
                </h3>
                {paymentMix.length === 0 ? (
                  <p className="text-xs text-slate-400">No confirmed orders yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {paymentMix.map((pm) => (
                      <div
                        key={pm.method}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">
                            {pm.method === 'RAZORPAY'
                              ? 'Razorpay Prepaid'
                              : 'Cash on Delivery (COD)'}
                          </span>
                          <span className="ml-2 font-mono text-slate-500">
                            · {pm.orders} order(s)
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(pm.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white border border-slate-200/80 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Suborder Fulfilment Funnel
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {funnel.map((step) => (
                    <div
                      key={step.status}
                      className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {step.status}
                      </div>
                      <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {step.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Top Artisan Studios by GMV
                </h3>
                <p className="text-xs text-slate-500">
                  Live gross sales, platform commission share, and verified studio rating
                </p>
              </div>
              {topStudios.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Studio leaderboard populates once orders are fulfilled.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Studio</th>
                        <th className="px-5 py-3 font-semibold">Rating</th>
                        <th className="px-5 py-3 font-semibold text-right">Suborders</th>
                        <th className="px-5 py-3 font-semibold text-right">GMV</th>
                        <th className="px-5 py-3 font-semibold text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topStudios.map((st) => (
                        <tr key={st.shop_name} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-900">
                              {st.shop_name}
                            </div>
                            <div className="text-[11px] text-slate-500">{st.city}</div>
                          </td>
                          <td className="px-5 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            ★ {st.rating_avg} ({st.review_count})
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                            {st.suborders}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatINR(st.gmv)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-[#2E9A90] font-semibold">
                            {formatINR(st.commission)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SUB-TAB 2: ADMIN REVIEW MODERATION */
        <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
          {reviews.length === 0 ? (
            <div className="p-10 text-center">
              <Star className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No verified reviews in this filter
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-amber-600">
                        ★{rev.rating}/5
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-slate-900">
                        {rev.product_title}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">{rev.seller_shop_name}</span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`font-semibold ${
                          rev.status === 'PUBLISHED'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {rev.status}
                      </span>
                    </div>
                    {rev.title && (
                      <p className="text-xs font-bold text-slate-900">{rev.title}</p>
                    )}
                    <p className="text-xs text-slate-700">{rev.comment}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      Buyer @{rev.buyer_username} ·{' '}
                      {new Date(rev.created_at).toLocaleDateString('en-IN')}
                      {rev.moderation_notes ? ` · Note: ${rev.moderation_notes}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Moderation note"
                      value={noteMap[rev.id] || ''}
                      onChange={(e) =>
                        setNoteMap({ ...noteMap, [rev.id]: e.target.value })
                      }
                      className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#2E9A90]"
                    />
                    {rev.status === 'PUBLISHED' ? (
                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleModerate(rev.id, 'HIDDEN')}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Hide</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleModerate(rev.id, 'PUBLISHED')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#2E9A90] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75] whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
