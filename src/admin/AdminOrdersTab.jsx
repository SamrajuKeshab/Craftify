import { ChevronDown, ChevronUp, RotateCcw, ShoppingCart, Truck } from 'lucide-react';
import { useState } from 'react';
import { formatINR } from '../utils/formatters';

const ORDER_STATUS_FILTERS = [
  'ALL',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CANCELLED',
];

const STATUS_STYLE = {
  CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PROCESSING: 'bg-blue-50 text-blue-800 border-blue-200',
  SHIPPED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  DELIVERED: 'bg-teal-50 text-teal-800 border-teal-200',
  RETURNED: 'bg-purple-50 text-purple-800 border-purple-200',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-800 border-amber-200',
  PAYMENT_FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function AdminOrdersTab({
  orders,
  statusFilter,
  onStatusFilterChange,
  loading,
}) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Platform Orders ({orders.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live multi-vendor parent orders with per-studio commission and net payout splits
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ORDER_STATUS_FILTERS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatusFilterChange(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading platform orders from PostgreSQL...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No orders found matching this filter
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Completed COD and Razorpay orders placed by buyers appear here in real time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const isOpen = expandedId === order.id;
              return (
                <div key={order.id} className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {order.order_number}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                            STATUS_STYLE[order.overall_status] ||
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {order.overall_status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {order.payment_method} · {order.payment_status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Buyer:{' '}
                        <strong className="text-slate-800">
                          {order.buyer_full_name}
                        </strong>{' '}
                        (@{order.buyer_username}) <span aria-hidden="true">·</span>{' '}
                        {order.suborders?.length || 0} studio suborder
                        {(order.suborders?.length || 0) === 1 ? '' : 's'}
                        {order.coupon_code_snapshot ? (
                          <>
                            {' '}
                            <span aria-hidden="true">·</span> Coupon{' '}
                            <span className="font-mono font-semibold text-emerald-700">
                              {order.coupon_code_snapshot}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {formatINR(Number(order.total_amount))}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {new Date(order.created_at).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : order.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90]"
                      >
                        <span>{isOpen ? 'Hide Split' : 'View Split'}</span>
                        {isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                      {order.suborders?.map((sub) => (
                        <div
                          key={sub.id}
                          className="rounded-lg bg-slate-50 border border-slate-100 p-3.5 text-xs space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {sub.seller_shop_name_snapshot}{' '}
                                <span className="font-mono text-slate-400">
                                  ({sub.suborder_number})
                                </span>
                              </p>
                              <p className="text-slate-600 mt-0.5">
                                {sub.items
                                  ?.map(
                                    (i) =>
                                      `${i.product_title_snapshot} × ${i.quantity}`
                                  )
                                  .join(', ')}
                              </p>
                            </div>
                            <div className="text-right font-mono tabular-nums space-y-0.5">
                              <p className="font-semibold text-slate-800">
                                Subtotal {formatINR(Number(sub.subtotal_amount))} · Comm{' '}
                                {formatINR(Number(sub.commission_amount))}
                              </p>
                              <p className="text-teal-700 font-semibold">
                                Net Seller {formatINR(Number(sub.net_seller_amount))} ·{' '}
                                {sub.fulfilment_status}
                              </p>
                            </div>
                          </div>

                          {(sub.shipment || sub.delivered_at) && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 text-[11px] text-slate-600">
                              <Truck className="h-3.5 w-3.5 text-[#2E9A90] shrink-0" />
                              {sub.shipment && (
                                <span>
                                  <strong className="text-slate-800">
                                    {sub.shipment.courier_name}
                                  </strong>{' '}
                                  · AWB{' '}
                                  <span className="font-mono font-semibold">
                                    {sub.shipment.tracking_number}
                                  </span>{' '}
                                  · {sub.shipment.status_label}
                                </span>
                              )}
                              {sub.delivered_at && (
                                <span className="text-emerald-700 font-medium">
                                  · Delivered{' '}
                                  <span className="font-mono">
                                    {new Date(sub.delivered_at).toLocaleDateString(
                                      'en-IN'
                                    )}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}

                          {sub.return_requests?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-amber-900">
                              <RotateCcw className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                              <span>
                                Returns:{' '}
                                {sub.return_requests
                                  .map(
                                    (ret) =>
                                      `${ret.return_number} · ${ret.status_label} · ${formatINR(Number(ret.refund_amount))}`
                                  )
                                  .join(' | ')}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
