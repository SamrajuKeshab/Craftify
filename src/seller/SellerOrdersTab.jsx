import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  Package,
  PackageCheck,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { updateSellerSuborderStatus } from '../services/ordersService';
import { extractServiceError } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

const STATUS_TABS = ['ALL', 'PENDING', 'ACCEPTED', 'PACKED', 'CANCELLED'];

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  ACCEPTED: 'bg-blue-50 text-blue-800 border-blue-200',
  PACKED: 'bg-teal-50 text-teal-800 border-teal-200',
  SHIPPED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  DELIVERED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export default function SellerOrdersTab({
  suborders,
  statusFilter,
  onStatusFilterChange,
  loading,
  onRefresh,
}) {
  const [busyId, setBusyId] = useState(null);
  const [notesMap, setNotesMap] = useState({});
  const [feedback, setFeedback] = useState(null);

  const handleTransition = async (suborder, nextStatus) => {
    setBusyId(suborder.id);
    setFeedback(null);
    try {
      const res = await updateSellerSuborderStatus(suborder.id, {
        status: nextStatus,
        sellerNotes: notesMap[suborder.id] || '',
      });
      setFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update suborder status.'),
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
            Studio Suborders ({suborders.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Only items belonging to your Craftify studio appear here. Accept &amp; pack each order before dispatch.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
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
              {tab}
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

      {loading && suborders.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          Loading studio suborders from PostgreSQL...
        </div>
      ) : suborders.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
          <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} suborders yet
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            When buyers purchase your approved crafts, your split Seller Suborders with buyer delivery details and net payouts appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suborders.map((sub) => {
            const addr = sub.shipping_address_snapshot || {};
            const isBusy = busyId === sub.id;
            const canAccept = sub.fulfilment_status === 'PENDING';
            const canPack = sub.fulfilment_status === 'ACCEPTED';
            const canCancel =
              sub.fulfilment_status === 'PENDING' ||
              sub.fulfilment_status === 'ACCEPTED';

            return (
              <div
                key={sub.id}
                className="rounded-xl bg-white border border-slate-200/80 p-5 space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {sub.suborder_number}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        Parent {sub.parent_order_number}
                      </span>
                      <span
                        className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_STYLES[sub.fulfilment_status] ||
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {sub.fulfilment_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Buyer: <strong className="text-slate-800">{sub.buyer_name}</strong> (@
                      {sub.buyer_username}) <span aria-hidden="true">·</span>{' '}
                      {sub.payment_method} ({sub.payment_status}){' '}
                      <span aria-hidden="true">·</span>{' '}
                      <span className="font-mono">
                        {new Date(sub.created_at).toLocaleString('en-IN')}
                      </span>
                    </p>
                  </div>

                  {/* Financial Summary */}
                  <div className="text-right text-xs">
                    <p className="text-slate-500">
                      Gross{' '}
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {formatINR(Number(sub.subtotal_amount))}
                      </span>{' '}
                      <span aria-hidden="true">·</span> Commission{' '}
                      <span className="font-mono text-amber-700 tabular-nums">
                        -{formatINR(Number(sub.commission_amount))}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-teal-700">
                      Net Studio Payout:{' '}
                      <span className="font-mono tabular-nums">
                        {formatINR(Number(sub.net_seller_amount))}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Delivery Address Snapshot + Line Items */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-8 space-y-2.5">
                    {sub.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs"
                      >
                        {item.product_image_snapshot ? (
                          <img
                            src={item.product_image_snapshot}
                            alt={item.product_title_snapshot}
                            referrerPolicy="no-referrer"
                            className="h-12 w-12 rounded-lg object-cover bg-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">
                            {item.product_title_snapshot}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {item.variant_label_snapshot} <span aria-hidden="true">·</span>{' '}
                            SKU <span className="font-mono">{item.variant_sku_snapshot}</span>{' '}
                            <span aria-hidden="true">·</span> Comm{' '}
                            <span className="font-mono tabular-nums">
                              {Number(item.commission_rate_snapshot).toFixed(1)}%
                            </span>
                          </p>
                          {item.customization_note && (
                            <p className="mt-1.5 rounded bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-[11px] text-amber-950">
                              <strong>Personalization Note:</strong>{' '}
                              {item.customization_note}
                            </p>
                          )}
                        </div>
                        <div className="text-right font-mono shrink-0 tabular-nums">
                          <p className="font-semibold text-slate-900">
                            {formatINR(Number(item.line_total))}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.quantity} × {formatINR(Number(item.unit_price_snapshot))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="lg:col-span-4 rounded-lg bg-slate-50 border border-slate-100 p-3.5 text-xs space-y-1.5">
                    <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                      <MapPin className="h-3.5 w-3.5 text-[#2E9A90]" />
                      <span>Ship To</span>
                    </p>
                    <p className="font-semibold text-slate-900">
                      {addr.recipient_name || sub.buyer_name}
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                      {addr.landmark ? ` (${addr.landmark})` : ''}
                      <br />
                      {addr.city}, {addr.state} —{' '}
                      <span className="font-mono font-semibold">{addr.pincode}</span>
                    </p>
                    {addr.phone && (
                      <p className="font-mono text-slate-500 tabular-nums">
                        +91 {addr.phone}
                      </p>
                    )}
                    {sub.seller_notes && (
                      <p className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                        <strong>Studio Note:</strong> {sub.seller_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fulfilment Transition Bar */}
                {(canAccept || canPack || canCancel) && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                    <input
                      type="text"
                      maxLength={300}
                      value={notesMap[sub.id] ?? sub.seller_notes ?? ''}
                      onChange={(e) =>
                        setNotesMap((prev) => ({ ...prev, [sub.id]: e.target.value }))
                      }
                      placeholder="Optional packing / artisan dispatch note for buyer..."
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canAccept && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTransition(sub, 'ACCEPTED')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isBusy ? 'Updating...' : 'Accept Order'}</span>
                        </button>
                      )}
                      {canPack && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTransition(sub, 'PACKED')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          <span>{isBusy ? 'Updating...' : 'Mark Packed'}</span>
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTransition(sub, 'CANCELLED')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancel &amp; Restock</span>
                        </button>
                      )}
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
