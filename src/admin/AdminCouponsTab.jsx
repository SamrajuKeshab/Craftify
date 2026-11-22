import {
  Pencil,
  Plus,
  Power,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  createAdminCoupon,
  deleteAdminCoupon,
  updateAdminCoupon,
} from '../services/commerceService';
import { extractServiceError } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

function toLocalDateTimeInput(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function getDefaultDateWindow() {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    valid_from: toLocalDateTimeInput(now.toISOString()),
    valid_until: toLocalDateTimeInput(nextMonth.toISOString()),
  };
}

const STATUS_STYLE = {
  ACTIVE: 'text-emerald-700',
  SCHEDULED: 'text-blue-700',
  EXPIRED: 'text-amber-700',
  EXHAUSTED: 'text-slate-600',
  INACTIVE: 'text-red-700',
};

/**
 * Admin Dashboard -> Platform Coupons Tab (Week 7).
 * Starts with zero coupons; Admins manually create, edit, toggle, or delete unused coupons.
 */
export default function AdminCouponsTab({
  coupons,
  statusFilter,
  onStatusFilterChange,
  loading,
  onRefresh,
  onFeedback,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState(() => ({
    code: '',
    description: '',
    discount_type: 'PERCENT',
    value: '10',
    min_order_amount: '500',
    max_discount_amount: '500',
    ...getDefaultDateWindow(),
    max_uses: '0',
    per_user_limit: '1',
    is_active: true,
  }));

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormError('');
    setForm({
      code: '',
      description: '',
      discount_type: 'PERCENT',
      value: '10',
      min_order_amount: '500',
      max_discount_amount: '500',
      ...getDefaultDateWindow(),
      max_uses: '0',
      per_user_limit: '1',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormError('');
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      value: String(Number(coupon.value)),
      min_order_amount: String(Number(coupon.min_order_amount || 0)),
      max_discount_amount:
        coupon.max_discount_amount !== null && coupon.max_discount_amount !== undefined
          ? String(Number(coupon.max_discount_amount))
          : '',
      valid_from: toLocalDateTimeInput(coupon.valid_from),
      valid_until: toLocalDateTimeInput(coupon.valid_until),
      max_uses: String(coupon.max_uses ?? 0),
      per_user_limit: String(coupon.per_user_limit ?? 1),
      is_active: Boolean(coupon.is_active),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      setFormError(
        'Coupon code must be 3-32 characters (letters, numbers, hyphen, or underscore).'
      );
      return;
    }

    const fromDate = new Date(form.valid_from);
    const untilDate = new Date(form.valid_until);
    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(untilDate.getTime()) ||
      untilDate <= fromDate
    ) {
      setFormError('Expiry date/time must be later than the start date/time.');
      return;
    }

    const payload = {
      code,
      description: form.description.trim(),
      discount_type: form.discount_type,
      value: Number(form.value),
      min_order_amount: Number(form.min_order_amount || 0),
      max_discount_amount:
        form.discount_type === 'PERCENT' && form.max_discount_amount !== ''
          ? Number(form.max_discount_amount)
          : null,
      valid_from: fromDate.toISOString(),
      valid_until: untilDate.toISOString(),
      max_uses: Math.max(0, parseInt(form.max_uses || '0', 10) || 0),
      per_user_limit: Math.max(0, parseInt(form.per_user_limit || '1', 10) || 0),
      is_active: Boolean(form.is_active),
    };

    setSubmitting(true);
    try {
      const res = editingCoupon
        ? await updateAdminCoupon(editingCoupon.id, payload)
        : await createAdminCoupon(payload);
      setModalOpen(false);
      setEditingCoupon(null);
      onFeedback({ type: 'success', text: res.detail || 'Coupon saved.' });
      await onRefresh();
    } catch (err) {
      setFormError(extractServiceError(err, 'Could not save platform coupon.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (coupon) => {
    setBusyId(coupon.id);
    try {
      const res = await updateAdminCoupon(coupon.id, { is_active: !coupon.is_active });
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not toggle coupon status.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (coupon) => {
    setBusyId(coupon.id);
    try {
      const res = await deleteAdminCoupon(coupon.id);
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not delete coupon.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Platform Discount Coupons ({coupons.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Server-validated promo codes with INR minimum order thresholds, usage caps, and audit logging
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Coupon</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {['ALL', 'ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => onStatusFilterChange(st)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap ${
              statusFilter === st
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        {loading && coupons.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading platform coupons from PostgreSQL...
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="mx-auto h-9 w-9 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              No platform coupons configured yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Create your first percentage or flat-INR coupon code so shoppers can apply verified discounts in their cart.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#247D75] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Coupon</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Offer</th>
                  <th className="px-4 py-3 font-semibold">Min Order</th>
                  <th className="px-4 py-3 font-semibold">Usage</th>
                  <th className="px-4 py-3 font-semibold">Validity</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-bold text-slate-900">
                        {c.code}
                      </p>
                      {c.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800 tabular-nums">
                      {c.discount_type === 'PERCENT' ? (
                        <>
                          {Number(c.value)}% off
                          {c.max_discount_amount && (
                            <span className="block font-sans text-[11px] font-normal text-slate-500">
                              Cap {formatINR(Number(c.max_discount_amount))}
                            </span>
                          )}
                        </>
                      ) : (
                        <>{formatINR(Number(c.value))} flat</>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                      {Number(c.min_order_amount) > 0
                        ? formatINR(Number(c.min_order_amount))
                        : 'No minimum'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                      {c.used_count} / {c.max_uses > 0 ? c.max_uses : '∞'}
                      <span className="block font-sans text-[11px] text-slate-400">
                        {c.per_user_limit > 0
                          ? `${c.per_user_limit} per buyer`
                          : 'Unlimited / buyer'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600 font-mono tabular-nums">
                      <div>{new Date(c.valid_from).toLocaleDateString('en-IN')}</div>
                      <div className="text-slate-400">
                        to {new Date(c.valid_until).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          STATUS_STYLE[c.computed_status] || 'text-slate-600'
                        }`}
                      >
                        {c.computed_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleToggleActive(c)}
                          title={c.is_active ? 'Deactivate coupon' : 'Activate coupon'}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          title="Edit coupon"
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleDelete(c)}
                          title="Delete unused coupon"
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Coupon Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingCoupon ? 'Edit Platform Coupon' : 'Create Platform Coupon'}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCoupon ? `Edit Coupon ${editingCoupon.code}` : 'Create Platform Coupon'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close coupon modal"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={32}
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                      }))
                    }
                    placeholder="e.g., FESTIVE10"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={form.discount_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discount_type: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  >
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FIXED">Flat INR (₹)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (shown to buyer when applied)
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="e.g., 10% off festive handcrafted orders above ₹1,000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {form.discount_type === 'PERCENT' ? 'Discount (%)' : 'Discount (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={form.discount_type === 'PERCENT' ? '90' : '50000'}
                    step="0.01"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Order (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.min_order_amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, min_order_amount: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>

                {form.discount_type === 'PERCENT' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Cap (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.max_discount_amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, max_discount_amount: e.target.value }))
                      }
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                    />
                  </div>
                ) : (
                  <div className="flex items-end pb-2 text-[11px] text-slate-400">
                    Flat amount capped at subtotal
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid From
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.valid_from}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, valid_from: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.valid_until}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, valid_until: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Platform Uses (0 = Unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_uses}
                    onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Per-Buyer Limit (0 = Unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.per_user_limit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, per_user_limit: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-[#2E9A90] focus:ring-[#2E9A90]"
                />
                <span>Coupon is active and redeemable immediately within validity dates</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2E9A90] px-5 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
                >
                  {submitting
                    ? 'Saving...'
                    : editingCoupon
                    ? 'Update Coupon'
                    : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
