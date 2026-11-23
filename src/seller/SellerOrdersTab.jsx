import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  PackageCheck,
  Send,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { updateSellerSuborderStatus } from '../services/ordersService';
import { extractServiceError } from '../services/sellerService';
import {
  INDIAN_COURIERS,
  addShipmentEvent,
  dispatchSellerSuborder,
  markSuborderDelivered,
} from '../services/shippingService';
import { formatINR } from '../utils/formatters';

const STATUS_TABS = [
  'ALL',
  'PENDING',
  'ACCEPTED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
];

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  ACCEPTED: 'bg-blue-50 text-blue-800 border-blue-200',
  PACKED: 'bg-teal-50 text-teal-800 border-teal-200',
  SHIPPED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  DELIVERED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  RETURNED: 'bg-purple-50 text-purple-800 border-purple-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

const MILESTONE_OPTIONS = [
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERY_ATTEMPTED', label: 'Delivery Attempted' },
];

const DEFAULT_SHIP_DRAFT = {
  courierPreset: INDIAN_COURIERS[0],
  customCourier: '',
  trackingNumber: '',
  trackingUrl: '',
  estimatedDeliveryDate: '',
  dispatchNotes: '',
};

const DEFAULT_EVENT_DRAFT = {
  status: 'IN_TRANSIT',
  location: '',
  notes: '',
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
  const [shipDrafts, setShipDrafts] = useState({});
  const [eventDrafts, setEventDrafts] = useState({});
  const [deliveryNotesMap, setDeliveryNotesMap] = useState({});
  const [expandedTimeline, setExpandedTimeline] = useState({});
  const [feedback, setFeedback] = useState(null);

  const getShipDraft = (subId) => ({
    ...DEFAULT_SHIP_DRAFT,
    ...(shipDrafts[subId] || {}),
  });

  const updateShipDraft = (subId, patch) => {
    setShipDrafts((prev) => ({
      ...prev,
      [subId]: { ...DEFAULT_SHIP_DRAFT, ...(prev[subId] || {}), ...patch },
    }));
  };

  const getEventDraft = (subId) => ({
    ...DEFAULT_EVENT_DRAFT,
    ...(eventDrafts[subId] || {}),
  });

  const updateEventDraft = (subId, patch) => {
    setEventDrafts((prev) => ({
      ...prev,
      [subId]: { ...DEFAULT_EVENT_DRAFT, ...(prev[subId] || {}), ...patch },
    }));
  };

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

  const handleDispatch = async (e, suborder) => {
    e.preventDefault();
    const draft = getShipDraft(suborder.id);
    const courierName =
      draft.courierPreset === 'Custom'
        ? draft.customCourier.trim()
        : draft.courierPreset;

    if (!courierName) {
      setFeedback({
        type: 'error',
        text: 'Please select an Indian courier or enter a custom courier name.',
      });
      return;
    }
    if (draft.trackingNumber.trim().length < 4) {
      setFeedback({
        type: 'error',
        text: 'Please enter a valid AWB / tracking number (at least 4 characters).',
      });
      return;
    }

    setBusyId(suborder.id);
    setFeedback(null);
    try {
      const res = await dispatchSellerSuborder(suborder.id, {
        courierName,
        trackingNumber: draft.trackingNumber.trim(),
        trackingUrl: draft.trackingUrl.trim(),
        estimatedDeliveryDate: draft.estimatedDeliveryDate || null,
        dispatchNotes: draft.dispatchNotes.trim(),
      });
      setFeedback({ type: 'success', text: res.detail });
      setShipDrafts((prev) => {
        const next = { ...prev };
        delete next[suborder.id];
        return next;
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not dispatch shipment.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAddEvent = async (e, suborder) => {
    e.preventDefault();
    const draft = getEventDraft(suborder.id);
    setBusyId(suborder.id);
    setFeedback(null);
    try {
      const res = await addShipmentEvent(suborder.id, {
        status: draft.status,
        location: draft.location.trim(),
        notes: draft.notes.trim(),
      });
      setFeedback({ type: 'success', text: res.detail });
      setEventDrafts((prev) => ({
        ...prev,
        [suborder.id]: { ...DEFAULT_EVENT_DRAFT, status: draft.status },
      }));
      setExpandedTimeline((prev) => ({ ...prev, [suborder.id]: true }));
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not record tracking event.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkDelivered = async (suborder) => {
    setBusyId(suborder.id);
    setFeedback(null);
    try {
      const res = await markSuborderDelivered(suborder.id, {
        deliveryNotes: (deliveryNotesMap[suborder.id] || '').trim(),
      });
      setFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not mark parcel as delivered.'),
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
            Accept, pack, dispatch with Indian courier AWB tracking, and record delivery milestones for your studio.
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
            const isPacked = sub.fulfilment_status === 'PACKED';
            const isShipped = sub.fulfilment_status === 'SHIPPED';
            const shipment = sub.shipment;
            const shipDraft = getShipDraft(sub.id);
            const eventDraft = getEventDraft(sub.id);
            const timelineOpen = Boolean(expandedTimeline[sub.id]);

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

                {/* Fulfilment Transition Bar (PENDING / ACCEPTED) */}
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

                {/* Week 9: Dispatch with Indian Courier Form (when PACKED) */}
                {isPacked && (
                  <form
                    onSubmit={(e) => handleDispatch(e, sub)}
                    className="pt-3.5 border-t border-slate-100 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Truck className="h-4 w-4 text-[#2E9A90]" />
                      <span>Dispatch Packed Parcel with Indian Courier</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Courier Partner
                        </label>
                        <select
                          value={shipDraft.courierPreset}
                          onChange={(e) =>
                            updateShipDraft(sub.id, { courierPreset: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                        >
                          {INDIAN_COURIERS.map((courier) => (
                            <option key={courier} value={courier}>
                              {courier}
                            </option>
                          ))}
                          <option value="Custom">Custom Courier...</option>
                        </select>
                      </div>

                      {shipDraft.courierPreset === 'Custom' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Custom Courier Name
                          </label>
                          <input
                            required
                            maxLength={80}
                            value={shipDraft.customCourier}
                            onChange={(e) =>
                              updateShipDraft(sub.id, { customCourier: e.target.value })
                            }
                            placeholder="e.g., Shree Maruti Courier"
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          AWB / Tracking Number
                        </label>
                        <input
                          required
                          maxLength={100}
                          value={shipDraft.trackingNumber}
                          onChange={(e) =>
                            updateShipDraft(sub.id, { trackingNumber: e.target.value })
                          }
                          placeholder="e.g., DLV8492019482"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-[#2E9A90]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Estimated Delivery (Optional)
                        </label>
                        <input
                          type="date"
                          value={shipDraft.estimatedDeliveryDate}
                          onChange={(e) =>
                            updateShipDraft(sub.id, {
                              estimatedDeliveryDate: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-[#2E9A90]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="url"
                        maxLength={500}
                        value={shipDraft.trackingUrl}
                        onChange={(e) =>
                          updateShipDraft(sub.id, { trackingUrl: e.target.value })
                        }
                        placeholder="Optional courier tracking URL (https://...)"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={300}
                          value={shipDraft.dispatchNotes}
                          onChange={(e) =>
                            updateShipDraft(sub.id, { dispatchNotes: e.target.value })
                          }
                          placeholder="Optional dispatch note (e.g., Bubble-wrapped, fragile)"
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                        />
                        <button
                          type="submit"
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60 shrink-0"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{isBusy ? 'Dispatching...' : 'Dispatch Parcel'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Week 9: Active Courier Tracking Banner + Timeline (SHIPPED / DELIVERED / RETURNED) */}
                {shipment && (
                  <div className="pt-3.5 border-t border-slate-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Truck className="h-4 w-4 text-[#2E9A90] shrink-0" />
                        <span className="font-semibold text-slate-900">
                          {shipment.courier_name}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono font-semibold text-slate-800">
                          AWB {shipment.tracking_number}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-semibold text-indigo-700">
                          {shipment.status_label}
                        </span>
                        {shipment.estimated_delivery_date && !shipment.delivered_at && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-500">
                              ETA{' '}
                              <span className="font-mono">
                                {shipment.estimated_delivery_date}
                              </span>
                            </span>
                          </>
                        )}
                        {shipment.delivered_at && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-emerald-700 font-medium">
                              Delivered{' '}
                              <span className="font-mono">
                                {new Date(shipment.delivered_at).toLocaleDateString(
                                  'en-IN'
                                )}
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {shipment.tracking_url && (
                          <a
                            href={shipment.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E9A90] hover:underline"
                          >
                            <span>Courier Link</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTimeline((prev) => ({
                              ...prev,
                              [sub.id]: !prev[sub.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                        >
                          <span>
                            Timeline ({shipment.events?.length || 0})
                          </span>
                          {timelineOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {timelineOpen && shipment.events?.length > 0 && (
                      <ol className="ml-2 border-l border-slate-200 pl-4 space-y-2.5 text-xs">
                        {shipment.events.map((ev) => (
                          <li key={ev.id} className="relative">
                            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#2E9A90] ring-2 ring-white" />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-900">
                                {ev.status_label}
                              </span>
                              {ev.location && (
                                <>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-slate-600">{ev.location}</span>
                                </>
                              )}
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {new Date(ev.event_timestamp).toLocaleString('en-IN')}
                              </span>
                            </div>
                            {ev.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {ev.notes}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}

                    {/* Add Transit Event & Mark Delivered (when SHIPPED) */}
                    {isShipped && (
                      <div className="space-y-2.5 pt-1">
                        <form
                          onSubmit={(e) => handleAddEvent(e, sub)}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2"
                        >
                          <select
                            value={eventDraft.status}
                            onChange={(e) =>
                              updateEventDraft(sub.id, { status: e.target.value })
                            }
                            className="sm:col-span-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                          >
                            {MILESTONE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            maxLength={120}
                            value={eventDraft.location}
                            onChange={(e) =>
                              updateEventDraft(sub.id, { location: e.target.value })
                            }
                            placeholder="Hub / City (e.g., Jaipur Hub)"
                            className="sm:col-span-3 rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                          />
                          <input
                            type="text"
                            maxLength={300}
                            value={eventDraft.notes}
                            onChange={(e) =>
                              updateEventDraft(sub.id, { notes: e.target.value })
                            }
                            placeholder="Optional transit note..."
                            className="sm:col-span-4 rounded-lg border border-slate-200 px-2.5 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                          />
                          <button
                            type="submit"
                            disabled={isBusy}
                            className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                          >
                            Add Update
                          </button>
                        </form>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                          <input
                            type="text"
                            maxLength={300}
                            value={deliveryNotesMap[sub.id] || ''}
                            onChange={(e) =>
                              setDeliveryNotesMap((prev) => ({
                                ...prev,
                                [sub.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional delivery confirmation note (starts 7-day return window)..."
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleMarkDelivered(sub)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 shrink-0"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              {isBusy ? 'Updating...' : 'Mark Delivered'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Return summary indicator on delivered/returned suborders */}
                    {sub.return_requests?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>
                          {sub.return_requests.length} return request
                          {sub.return_requests.length === 1 ? '' : 's'} linked:{' '}
                          {sub.return_requests
                            .map((r) => `${r.return_number} (${r.status_label})`)
                            .join(', ')}
                        </span>
                      </div>
                    )}
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

