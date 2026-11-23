import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  IndianRupee,
  RefreshCw,
  Send,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { requestSellerPayout } from '../services/financeService';
import { extractServiceError } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

const ENTRY_TYPE_FILTERS = [
  { id: 'ALL', label: 'All Entries' },
  { id: 'SALE_CREDIT', label: 'Sale Credits' },
  { id: 'PLATFORM_COMMISSION', label: 'Commission' },
  { id: 'REFUND_DEBIT', label: 'Refund Debits' },
  { id: 'PAYOUT_DEBIT', label: 'Payouts' },
  { id: 'PAYOUT_REVERSAL', label: 'Reversals' },
];

const ENTRY_TYPE_LABELS = {
  SALE_CREDIT: 'Sale Credit',
  PLATFORM_COMMISSION: 'Platform Commission',
  COMMISSION_REVERSAL: 'Commission Reversal',
  REFUND_DEBIT: 'Return Refund Debit',
  PAYOUT_DEBIT: 'Payout Withdrawal',
  PAYOUT_REVERSAL: 'Rejected Payout Reversal',
};

const PAYOUT_STATUS_META = {
  REQUESTED: { label: 'Requested', tone: 'text-amber-700' },
  PROCESSING: { label: 'Processing', tone: 'text-sky-700' },
  PAID: { label: 'Paid', tone: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', tone: 'text-red-700' },
};

function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function SellerEarningsTab({
  financeData,
  entryTypeFilter,
  onEntryTypeFilterChange,
  loading,
  shopSuspended,
  onOpenShopSettings,
  onRefresh,
}) {
  const [subView, setSubView] = useState('ledger');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [sellerNotes, setSellerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const summary = financeData?.summary || {
    settlement_hold_days: 7,
    total_net_earned: '0.00',
    total_commission_paid: '0.00',
    total_refund_debits: '0.00',
    pending_settlement: '0.00',
    available_balance: '0.00',
    in_flight_payouts: '0.00',
    total_paid_out: '0.00',
    bank_account_masked: '',
    ifsc_code: '',
    has_payout_bank_details: false,
  };

  const ledger = financeData?.ledger || [];
  const payouts = financeData?.payouts || [];
  const availableNum = Number(summary.available_balance || 0);
  const canWithdraw =
    !shopSuspended && summary.has_payout_bank_details && availableNum >= 1;

  const handleRequestPayout = async (e) => {
    e.preventDefault();
    const numeric = Number(payoutAmount);
    if (!Number.isFinite(numeric) || numeric < 1) {
      setFeedback({
        type: 'error',
        text: 'Enter a valid payout amount of at least ₹1.00.',
      });
      return;
    }
    if (numeric > availableNum) {
      setFeedback({
        type: 'error',
        text: `Amount cannot exceed your available balance of ${formatINR(availableNum)}.`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await requestSellerPayout({
        amount: numeric.toFixed(2),
        sellerNotes,
      });
      setFeedback({ type: 'success', text: res.detail });
      setPayoutAmount('');
      setSellerNotes('');
      setSubView('payouts');
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not submit payout request.'),
      });
    } finally {
      setSubmitting(false);
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
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 4-Metric Financial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Available to Withdraw</span>
            <Wallet className="h-4 w-4 text-[#2E9A90]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.available_balance)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Cleared after {summary.settlement_hold_days}-day return window
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending Settlement Hold</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.pending_settlement)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Held {summary.settlement_hold_days} days post-delivery
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Paid Out</span>
            <IndianRupee className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.total_paid_out)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            In flight: {formatINR(summary.in_flight_payouts)}
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net Platform Commission</span>
            <ArrowUpRight className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.total_commission_paid)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            Refund debits: {formatINR(summary.total_refund_debits)}
          </p>
        </div>
      </div>

      {/* Inline Bank Payout Request Panel */}
      <div className="rounded-xl bg-white border border-slate-200/80 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Request Studio Payout
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Withdraw available INR earnings directly to your verified studio bank account
              via NEFT/IMPS.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
            {summary.has_payout_bank_details ? (
              <span>
                {summary.bank_account_masked} · {summary.ifsc_code}
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenShopSettings}
                className="font-sans font-semibold text-[#2E9A90] hover:underline whitespace-nowrap shrink-0"
              >
                Add Bank &amp; IFSC in Shop Settings
              </button>
            )}
          </div>
        </div>

        <form
          onSubmit={handleRequestPayout}
          className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Withdrawal Amount (INR ₹)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="1"
                max={availableNum || undefined}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                disabled={!canWithdraw || submitting}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-[#2E9A90] disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="button"
                disabled={!canWithdraw || submitting}
                onClick={() => setPayoutAmount(availableNum.toFixed(2))}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Full
              </button>
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Studio Reference Note (Optional)
            </label>
            <input
              type="text"
              maxLength={300}
              value={sellerNotes}
              onChange={(e) => setSellerNotes(e.target.value)}
              disabled={!canWithdraw || submitting}
              placeholder="e.g. Monthly studio settlement"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90] disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={!canWithdraw || submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E9A90] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submitting ? 'Submitting...' : 'Request Payout'}</span>
            </button>
          </div>
        </form>

        {shopSuspended && (
          <p className="mt-3 text-xs text-red-600">
            Payout withdrawals are temporarily paused while your studio is under Admin review.
          </p>
        )}
      </div>

      {/* Ledger & Payout History Table Card */}
      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-5 border-b sm:border-b-0 border-slate-100 pb-2 sm:pb-0">
            <button
              type="button"
              onClick={() => setSubView('ledger')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                subView === 'ledger'
                  ? 'border-[#2E9A90] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Financial Ledger ({ledger.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('payouts')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                subView === 'payouts'
                  ? 'border-[#2E9A90] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Payout History ({payouts.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {subView === 'ledger' && (
              <select
                value={entryTypeFilter}
                onChange={(e) => onEntryTypeFilterChange(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
              >
                {ENTRY_TYPE_FILTERS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
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

        {loading && ledger.length === 0 && payouts.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : subView === 'ledger' ? (
          ledger.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No financial ledger entries yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Delivered craft suborders automatically book net seller credits and
                category commissions here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Type &amp; Description</th>
                    <th className="px-5 py-3 font-semibold">Settlement</th>
                    <th className="px-5 py-3 font-semibold text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((row) => {
                    const isCredit = row.direction === 'CREDIT';
                    const isCommissionInfo =
                      row.entry_type === 'PLATFORM_COMMISSION' ||
                      row.entry_type === 'COMMISSION_REVERSAL';
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                          {formatDateShort(row.created_at)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900">
                            {ENTRY_TYPE_LABELS[row.entry_type] || row.entry_type}
                            {row.suborder_number && (
                              <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-500">
                                · {row.suborder_number}
                              </span>
                            )}
                            {row.payout_number && (
                              <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-500">
                                · {row.payout_number}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {row.description}
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {row.entry_type === 'SALE_CREDIT' ? (
                            row.settlement_state === 'HOLD' ? (
                              <span className="font-mono text-[11px] font-semibold text-amber-700">
                                Hold · Releases {formatDateShort(row.available_at)}
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] font-semibold text-emerald-700">
                                Available{row.hold_released_early ? ' · Early Release' : ''}
                              </span>
                            )
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400">
                              Posted
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                          <span
                            className={
                              isCommissionInfo
                                ? 'text-slate-500'
                                : isCredit
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
                            }
                          >
                            {isCredit ? '+' : '-'}
                            {formatINR(row.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : payouts.length === 0 ? (
          <div className="p-10 text-center">
            <ArrowDownLeft className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No payout requests yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Once your delivered orders clear the 7-day settlement window, request a
              payout above to transfer funds to your bank account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 font-semibold">Payout Ref</th>
                  <th className="px-5 py-3 font-semibold">Bank Destination</th>
                  <th className="px-5 py-3 font-semibold">Status &amp; UTR</th>
                  <th className="px-5 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => {
                  const meta = PAYOUT_STATUS_META[p.status] || {
                    label: p.status,
                    tone: 'text-slate-700',
                  };
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">
                          {p.payout_number}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {formatDateShort(p.created_at)}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-700">
                        {p.bank_account_masked} · {p.ifsc_code}
                        {p.seller_notes && (
                          <div className="font-sans text-[11px] text-slate-500 mt-0.5">
                            {p.seller_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${meta.tone}`}>
                          {meta.label}
                        </span>
                        {p.utr_reference && (
                          <span className="ml-2 font-mono text-[11px] text-slate-600">
                            · UTR {p.utr_reference}
                          </span>
                        )}
                        {p.admin_notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.admin_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
