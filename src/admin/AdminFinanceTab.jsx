import {
  CheckCircle2,
  Clock,
  IndianRupee,
  RefreshCw,
  RotateCcw,
  Unlock,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  actOnAdminPayout,
  actOnAdminRefund,
  releaseLedgerHold,
} from '../services/financeService';
import { extractServiceError } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

const PAYOUT_FILTERS = ['ALL', 'REQUESTED', 'PROCESSING', 'PAID', 'REJECTED'];
const REFUND_FILTERS = ['ALL', 'PENDING', 'PROCESSED', 'FAILED'];
const LEDGER_FILTERS = [
  'ALL',
  'SALE_CREDIT',
  'PLATFORM_COMMISSION',
  'COMMISSION_REVERSAL',
  'REFUND_DEBIT',
  'PAYOUT_DEBIT',
  'PAYOUT_REVERSAL',
];

function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminFinanceTab({
  financeData,
  payoutStatusFilter,
  onPayoutStatusFilterChange,
  refundStatusFilter,
  onRefundStatusFilterChange,
  entryTypeFilter,
  onEntryTypeFilterChange,
  loading,
  onRefresh,
  onFeedback,
}) {
  const [subTab, setSubTab] = useState('payouts');
  const [busyId, setBusyId] = useState(null);
  const [utrMap, setUtrMap] = useState({});
  const [payoutNoteMap, setPayoutNoteMap] = useState({});
  const [refundRefMap, setRefundRefMap] = useState({});
  const [refundNoteMap, setRefundNoteMap] = useState({});

  const summary = financeData?.summary || {
    settlement_hold_days: 7,
    net_platform_commission: '0.00',
    total_seller_credits: '0.00',
    held_settlement_amount: '0.00',
    pending_payouts_count: 0,
    pending_payouts_amount: '0.00',
    paid_payouts_amount: '0.00',
    pending_refunds_count: 0,
    pending_refunds_amount: '0.00',
    processed_refunds_amount: '0.00',
  };

  const payouts = financeData?.payouts || [];
  const refunds = financeData?.refunds || [];
  const ledger = financeData?.ledger || [];

  const handlePayoutAction = async (payoutId, nextStatus) => {
    const utr = (utrMap[payoutId] || '').trim();
    const notes = (payoutNoteMap[payoutId] || '').trim();

    if (nextStatus === 'PAID' && utr.length < 4) {
      onFeedback({
        type: 'error',
        text: 'Enter a NEFT/IMPS/UTR reference number (min 4 chars) before marking a payout Paid.',
      });
      return;
    }
    if (nextStatus === 'REJECTED' && notes.length < 5) {
      onFeedback({
        type: 'error',
        text: 'Enter a rejection reason (min 5 chars) so the artisan knows why funds were returned.',
      });
      return;
    }

    setBusyId(payoutId);
    onFeedback(null);
    try {
      const res = await actOnAdminPayout(payoutId, {
        status: nextStatus,
        utrReference: utr,
        adminNotes: notes,
      });
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update seller payout.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRefundAction = async (refundId, nextStatus) => {
    const refId = (refundRefMap[refundId] || '').trim();
    const notes = (refundNoteMap[refundId] || '').trim();

    if (nextStatus === 'PROCESSED' && refId.length < 4) {
      onFeedback({
        type: 'error',
        text: 'Enter a Razorpay refund ID or bank/UPI reference (min 4 chars) before marking Processed.',
      });
      return;
    }
    if (nextStatus === 'FAILED' && notes.length < 5) {
      onFeedback({
        type: 'error',
        text: 'Enter failure notes (min 5 chars) when marking a refund Failed.',
      });
      return;
    }

    setBusyId(refundId);
    onFeedback(null);
    try {
      const res = await actOnAdminRefund(refundId, {
        status: nextStatus,
        gatewayRefundId: refId,
        adminNotes: notes,
      });
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update refund record.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReleaseHold = async (entry) => {
    setBusyId(entry.id);
    onFeedback(null);
    try {
      const res = await releaseLedgerHold(
        entry.id,
        'Verified delivery settlement approved by Admin'
      );
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not release 7-day settlement hold.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 4-Metric Platform Finance KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net Platform Commission</span>
            <IndianRupee className="h-4 w-4 text-[#2E9A90]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.net_platform_commission)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            Seller credits: {formatINR(summary.total_seller_credits)}
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending Seller Payouts</span>
            <Wallet className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.pending_payouts_amount)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            {summary.pending_payouts_count} request(s) awaiting transfer
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Paid to Artisans</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.paid_payouts_amount)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            In 7-day hold: {formatINR(summary.held_settlement_amount)}
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/80 p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending Buyer Refunds</span>
            <RotateCcw className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(summary.pending_refunds_amount)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums">
            {summary.pending_refunds_count} pending · Paid:{' '}
            {formatINR(summary.processed_refunds_amount)}
          </p>
        </div>
      </div>

      {/* Main Governance Container */}
      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSubTab('payouts')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'payouts'
                  ? 'border-[#2E9A90] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Seller Payouts ({payouts.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('refunds')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'refunds'
                  ? 'border-[#2E9A90] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Buyer Refunds ({refunds.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('ledger')}
              className={`text-sm font-bold pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'ledger'
                  ? 'border-[#2E9A90] text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Platform Ledger ({ledger.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'payouts' && (
              <select
                value={payoutStatusFilter}
                onChange={(e) => onPayoutStatusFilterChange(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
              >
                {PAYOUT_FILTERS.map((st) => (
                  <option key={st} value={st}>
                    Status: {st}
                  </option>
                ))}
              </select>
            )}
            {subTab === 'refunds' && (
              <select
                value={refundStatusFilter}
                onChange={(e) => onRefundStatusFilterChange(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
              >
                {REFUND_FILTERS.map((st) => (
                  <option key={st} value={st}>
                    Status: {st}
                  </option>
                ))}
              </select>
            )}
            {subTab === 'ledger' && (
              <select
                value={entryTypeFilter}
                onChange={(e) => onEntryTypeFilterChange(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
              >
                {LEDGER_FILTERS.map((et) => (
                  <option key={et} value={et}>
                    Type: {et}
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

        {/* SUB-TAB 1: SELLER PAYOUTS QUEUE */}
        {subTab === 'payouts' &&
          (payouts.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No seller payout requests in this queue
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Artisan payout withdrawals appear here once sellers request disbursement
                from their available balance.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payouts.map((p) => {
                const isActionable =
                  p.status === 'REQUESTED' || p.status === 'PROCESSING';
                return (
                  <div
                    key={p.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-900">
                          {p.payout_number}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800">
                          {p.seller_shop_name}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span
                          className={`font-semibold ${
                            p.status === 'PAID'
                              ? 'text-emerald-700'
                              : p.status === 'REJECTED'
                                ? 'text-red-700'
                                : p.status === 'PROCESSING'
                                  ? 'text-sky-700'
                                  : 'text-amber-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        Bank {p.bank_account_masked} · IFSC {p.ifsc_code} · Requested{' '}
                        {formatDateShort(p.created_at)}
                      </div>
                      {p.seller_notes && (
                        <p className="text-xs text-slate-600">
                          Seller note: {p.seller_notes}
                        </p>
                      )}
                      {p.utr_reference && (
                        <p className="text-xs font-mono text-emerald-700">
                          UTR: {p.utr_reference}
                          {p.processed_by_username
                            ? ` · by @${p.processed_by_username}`
                            : ''}
                        </p>
                      )}
                      {p.admin_notes && (
                        <p className="text-xs text-slate-500">
                          Admin note: {p.admin_notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                      <div className="text-left sm:text-right mr-2">
                        <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                          {formatINR(p.amount)}
                        </div>
                      </div>

                      {isActionable && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="NEFT / UTR Ref"
                            value={utrMap[p.id] || ''}
                            onChange={(e) =>
                              setUtrMap({ ...utrMap, [p.id]: e.target.value })
                            }
                            className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2E9A90]"
                          />
                          <input
                            type="text"
                            placeholder="Admin note / reject reason"
                            value={payoutNoteMap[p.id] || ''}
                            onChange={(e) =>
                              setPayoutNoteMap({
                                ...payoutNoteMap,
                                [p.id]: e.target.value,
                              })
                            }
                            className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#2E9A90]"
                          />
                          {p.status === 'REQUESTED' && (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => handlePayoutAction(p.id, 'PROCESSING')}
                              className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                            >
                              Processing
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handlePayoutAction(p.id, 'PAID')}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#2E9A90] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75] whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Mark Paid</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            onClick={() => handlePayoutAction(p.id, 'REJECTED')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* SUB-TAB 2: BUYER REFUNDS QUEUE */}
        {subTab === 'refunds' &&
          (refunds.length === 0 ? (
            <div className="p-10 text-center">
              <RotateCcw className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No buyer refund records in this queue
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Refunds are queued automatically when a 7-day return completes or a paid
                Razorpay order is cancelled.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {refunds.map((r) => (
                <div
                  key={r.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900">
                        {r.refund_number}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-700">
                        {r.order_number}
                      </span>
                      {r.return_number && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-slate-600">
                            {r.return_number}
                          </span>
                        </>
                      )}
                      <span className="text-slate-300">·</span>
                      <span
                        className={`font-semibold ${
                          r.status === 'PROCESSED'
                            ? 'text-emerald-700'
                            : r.status === 'FAILED'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Buyer @{r.buyer_username} ({r.buyer_email}) · {r.payment_method} ·{' '}
                      {r.trigger_source.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Commission reversed: {formatINR(r.commission_reversed)} · Seller
                      debit: {formatINR(r.net_seller_deduction)}
                    </div>
                    {r.gateway_refund_id && (
                      <div className="text-xs font-mono text-emerald-700">
                        Gateway Ref: {r.gateway_refund_id}
                      </div>
                    )}
                    {r.admin_notes && (
                      <div className="text-xs text-slate-500">
                        Admin note: {r.admin_notes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                    <div className="text-left sm:text-right mr-2">
                      <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                        {formatINR(r.amount)}
                      </div>
                    </div>

                    {r.status === 'PENDING' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Razorpay rfnd_ / UPI ref"
                          value={refundRefMap[r.id] || ''}
                          onChange={(e) =>
                            setRefundRefMap({ ...refundRefMap, [r.id]: e.target.value })
                          }
                          className="w-40 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2E9A90]"
                        />
                        <input
                          type="text"
                          placeholder="Admin note"
                          value={refundNoteMap[r.id] || ''}
                          onChange={(e) =>
                            setRefundNoteMap({
                              ...refundNoteMap,
                              [r.id]: e.target.value,
                            })
                          }
                          className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#2E9A90]"
                        />
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleRefundAction(r.id, 'PROCESSED')}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#2E9A90] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75] whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Processed</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleRefundAction(r.id, 'FAILED')}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          Fail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* SUB-TAB 3: PLATFORM IMMUTABLE LEDGER */}
        {subTab === 'ledger' &&
          (ledger.length === 0 ? (
            <div className="p-10 text-center">
              <Clock className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No platform ledger entries recorded yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Every delivered suborder, category commission, refund debit, and seller
                payout is permanently logged here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Studio &amp; Entry</th>
                    <th className="px-5 py-3 font-semibold">Settlement Window</th>
                    <th className="px-5 py-3 font-semibold text-right">Amount</th>
                    <th className="px-5 py-3 font-semibold text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {formatDateShort(row.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">
                          {row.seller_shop_name}
                          <span className="ml-1.5 font-mono text-[11px] font-medium text-[#2E9A90]">
                            · {row.entry_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.description}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap font-mono text-[11px]">
                        {row.entry_type === 'SALE_CREDIT' ? (
                          row.settlement_state === 'HOLD' ? (
                            <span className="text-amber-700 font-semibold">
                              Hold until {formatDateShort(row.available_at)}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">
                              Available{row.hold_released_early ? ' (Early)' : ''}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">Posted</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {row.direction === 'CREDIT' ? '+' : '-'}
                        {formatINR(row.amount)}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {row.entry_type === 'SALE_CREDIT' &&
                        row.settlement_state === 'HOLD' ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => handleReleaseHold(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <Unlock className="h-3 w-3" />
                            <span>Release Hold</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
