import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { extractServiceError } from '../services/sellerService';
import { resolveSellerReturn } from '../services/shippingService';
import { formatINR } from '../utils/formatters';

const RETURN_STATUS_TABS = [
  'ALL',
  'REQUESTED',
  'APPROVED',
  'PICKED_UP',
  'COMPLETED',
  'REJECTED',
];

const RETURN_STATUS_STYLES = {
  REQUESTED: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-800 border-blue-200',
  PICKED_UP: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

export default function SellerReturnsTab({
  returns,
  statusFilter,
  onStatusFilterChange,
  loading,
  onRefresh,
}) {
  const [busyId, setBusyId] = useState(null);
  const [notesMap, setNotesMap] = useState({});
  const [restockMap, setRestockMap] = useState({});
  const [feedback, setFeedback] = useState(null);

  const handleResolve = async (ret, nextStatus) => {
    const note = (notesMap[ret.id] ?? ret.seller_response_note ?? '').trim();
    if (nextStatus === 'REJECTED' && note.length < 5) {
      setFeedback({
        type: 'error',
        text: 'Please enter a short explanation note (min 5 chars) before rejecting a return request.',
      });
      return;
    }

    setBusyId(ret.id);
    setFeedback(null);
    try {
      const res = await resolveSellerReturn(ret.id, {
        status: nextStatus,
        sellerResponseNote: note,
        restockInventory: Boolean(restockMap[ret.id]),
      });
      setFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update return status.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            7-Day Return Requests ({returns.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review buyer return requests directly for your studio, inspect evidence photos, and restock undamaged crafts.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RETURN_STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onStatusFilterChange(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                statusFilter === tab
                  ? 'bg-[#2E9A90] text-white border-[#2E9A90]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && returns.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          Loading studio return requests...
        </div>
      ) : returns.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
          <RotateCcw className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase().replace('_', ' ')} return requests
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Buyer 7-day post-delivery return requests for your studio&apos;s delivered crafts appear here for direct resolution.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.map((ret) => {
            const isBusy = busyId === ret.id;
            const isRequested = ret.status === 'REQUESTED';
            const isApproved = ret.status === 'APPROVED';
            const isPickedUp = ret.status === 'PICKED_UP';
            const hasActions = isRequested || isApproved || isPickedUp;

            return (
              <div
                key={ret.id}
                className="rounded-xl bg-white border border-slate-200/80 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {ret.return_number}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {ret.suborder_number}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          RETURN_STATUS_STYLES[ret.status] ||
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {ret.status_label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Buyer: <strong className="text-slate-800">{ret.buyer_name}</strong> (@
                      {ret.buyer_username}) <span aria-hidden="true">·</span>{' '}
                      <span className="font-semibold text-slate-700">
                        {ret.reason_label}
                      </span>{' '}
                      <span aria-hidden="true">·</span>{' '}
                      <span className="font-mono">
                        {new Date(ret.created_at).toLocaleString('en-IN')}
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Refund Estimate</p>
                    <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatINR(Number(ret.refund_amount))}
                    </p>
                    {ret.restocked && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                        Restocked to Inventory
                      </p>
                    )}
                  </div>
                </div>

                {/* Craft Item & Buyer Explanation */}
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-100 p-3.5 text-xs">
                  {ret.product_image ? (
                    <img
                      src={ret.product_image}
                      alt={ret.product_title}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-lg object-cover bg-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-slate-900">
                      {ret.product_title}{' '}
                      <span className="font-normal text-slate-500">
                        ({ret.variant_label}) × {ret.quantity}
                      </span>
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      &ldquo;{ret.description}&rdquo;
                    </p>
                    {ret.customization_note && (
                      <p className="text-[11px] text-amber-800">
                        <strong>Original Personalization:</strong> {ret.customization_note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Evidence Photos */}
                {ret.evidence_urls?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-600">
                      Buyer Photo Proof ({ret.evidence_urls.length})
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {ret.evidence_urls.map((url, idx) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 block"
                        >
                          <img
                            src={url}
                            alt={`Return proof ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-1 right-1 rounded bg-black/65 p-0.5 text-white">
                            <ExternalLink className="h-2.5 w-2.5" />
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {ret.seller_response_note && !hasActions && (
                  <p className="text-xs text-slate-600">
                    <strong>Studio Resolution Note:</strong> {ret.seller_response_note}
                  </p>
                )}

                {/* Direct Seller Resolution Actions */}
                {hasActions && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <input
                      type="text"
                      maxLength={400}
                      value={notesMap[ret.id] ?? ret.seller_response_note ?? ''}
                      onChange={(e) =>
                        setNotesMap((prev) => ({ ...prev, [ret.id]: e.target.value }))
                      }
                      placeholder={
                        isRequested
                          ? 'Studio response note (required if rejecting, optional for approval)...'
                          : 'Optional pickup or inspection note...'
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {(isApproved || isPickedUp) ? (
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(restockMap[ret.id])}
                            onChange={(e) =>
                              setRestockMap((prev) => ({
                                ...prev,
                                [ret.id]: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-300 text-[#2E9A90] focus:ring-[#2E9A90]"
                          />
                          <span>Restock undamaged craft back to inventory on completion</span>
                        </label>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Approved returns proceed to pickup &amp; completion
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {isRequested && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleResolve(ret, 'APPROVED')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{isBusy ? 'Saving...' : 'Approve Return'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleResolve(ret, 'REJECTED')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {isApproved && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleResolve(ret, 'PICKED_UP')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            <span>Mark Picked Up</span>
                          </button>
                        )}

                        {(isApproved || isPickedUp) && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleResolve(ret, 'COMPLETED')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Complete Return</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
