import { CreditCard } from 'lucide-react';
import { formatINR } from '../utils/formatters';

const PROVIDERS = ['ALL', 'RAZORPAY', 'COD'];

const PAYMENT_STATUS_STYLE = {
  CAPTURED: 'bg-emerald-100 text-emerald-800',
  COD_PENDING: 'bg-amber-100 text-amber-800',
  CREATED: 'bg-blue-100 text-blue-800',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-slate-100 text-slate-700',
};

export default function AdminPaymentsTab({
  payments,
  providerFilter,
  onProviderFilterChange,
  loading,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Payment Ledger ({payments.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified Razorpay captures and Cash on Delivery payment records stored in PostgreSQL
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PROVIDERS.map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => onProviderFilterChange(prov)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                providerFilter === prov
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {prov}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        {loading && payments.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading payment ledger from PostgreSQL...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center">
            <CreditCard className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No payment records yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Every Razorpay checkout and COD order automatically creates an immutable payment record here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Buyer</th>
                  <th className="px-4 py-3 font-semibold">Provider &amp; Gateway IDs</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {p.order_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{p.buyer_full_name}</p>
                      <p className="text-[11px] text-slate-500">@{p.buyer_username}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{p.provider}</p>
                      {p.razorpay_payment_id ? (
                        <p className="font-mono text-[11px] text-slate-500">
                          {p.razorpay_payment_id}
                        </p>
                      ) : p.razorpay_order_id ? (
                        <p className="font-mono text-[11px] text-slate-500">
                          {p.razorpay_order_id}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400">Cash on Delivery</p>
                      )}
                      {p.failure_reason && (
                        <p className="text-[11px] text-red-600 mt-0.5">
                          {p.failure_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(Number(p.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          PAYMENT_STATUS_STYLE[p.status] ||
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                      {new Date(p.created_at).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
