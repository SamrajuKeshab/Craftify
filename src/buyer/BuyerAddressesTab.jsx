import {
  CheckCircle2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { INDIAN_STATES_AND_UTS } from '../services/commerceService';

const EMPTY_FORM = {
  label: 'HOME',
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  is_default: false,
};

/**
 * Reusable Indian Delivery Address Form (used in BuyerAddressesTab and CartPage inline add).
 */
export function BuyerAddressForm({
  initialValues = null,
  onSave,
  onCancel,
  submitLabel = 'Save Address',
  tone = 'dashboard',
}) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    recipient_name: initialValues?.recipient_name || user?.full_name || '',
    phone: initialValues?.phone || '',
    label: initialValues?.label || 'HOME',
    line1: initialValues?.line1 || '',
    line2: initialValues?.line2 || '',
    landmark: initialValues?.landmark || '',
    city: initialValues?.city || '',
    state: initialValues?.state || '',
    pincode: initialValues?.pincode || '',
    is_default: Boolean(initialValues?.is_default),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accentFocus =
    tone === 'storefront' ? 'focus:border-[#8B4B28]' : 'focus:border-[#2E9A90]';
  const primaryBtn =
    tone === 'storefront'
      ? 'bg-[#8B4B28] hover:bg-[#733C1E]'
      : 'bg-[#2E9A90] hover:bg-[#247D75]';
  const borderColor =
    tone === 'storefront' ? 'border-[#E2D8CB]' : 'border-slate-200';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = form.phone.replace(/[\s\-()]+/g, '').replace(/^(\+91|91)/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    const cleanPin = form.pincode.replace(/\s+/g, '');
    if (!/^[1-9]\d{5}$/.test(cleanPin)) {
      setError('Enter a valid 6-digit Indian pincode.');
      return;
    }

    setSaving(true);
    try {
      const res = await onSave({
        ...form,
        phone: cleanPhone,
        pincode: cleanPin,
      });
      if (res && !res.ok) {
        setError(res.message || 'Could not save delivery address.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Address Label Segmented Control */}
      <div>
        <span className="block text-xs font-semibold text-slate-700 mb-1.5">
          Address Type
        </span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-1">
          {[
            { id: 'HOME', label: 'Home' },
            { id: 'WORK', label: 'Work' },
            { id: 'OTHER', label: 'Other' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, label: opt.id }))}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                form.label === opt.id
                  ? `${primaryBtn} text-white`
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Recipient Full Name
          </label>
          <input
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={form.recipient_name}
            onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))}
            placeholder="e.g., Priya Sharma"
            className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm text-slate-900 focus:outline-none ${accentFocus}`}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Indian Mobile Number
          </label>
          <input
            type="tel"
            required
            maxLength={15}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="10-digit mobile (e.g., 9876543210)"
            className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none ${accentFocus}`}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Address Line 1 (House / Flat No., Building, Street)
        </label>
        <input
          type="text"
          required
          minLength={5}
          maxLength={220}
          value={form.line1}
          onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
          placeholder="House/Flat No., Street, Locality"
          className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm text-slate-900 focus:outline-none ${accentFocus}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Address Line 2 (Area / Colony — optional)
          </label>
          <input
            type="text"
            maxLength={220}
            value={form.line2}
            onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
            placeholder="Sector, Neighbourhood"
            className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm text-slate-900 focus:outline-none ${accentFocus}`}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Landmark (optional)
          </label>
          <input
            type="text"
            maxLength={140}
            value={form.landmark}
            onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
            placeholder="Near City Park / Metro Station"
            className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm text-slate-900 focus:outline-none ${accentFocus}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            City / Town
          </label>
          <input
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="e.g., Jaipur"
            className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm text-slate-900 focus:outline-none ${accentFocus}`}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            State / UT
          </label>
          <select
            required
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            className={`w-full rounded-lg border ${borderColor} bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none ${accentFocus}`}
          >
            <option value="">Select state...</option>
            {INDIAN_STATES_AND_UTS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Pincode (6 digits)
          </label>
          <input
            type="text"
            required
            maxLength={6}
            inputMode="numeric"
            value={form.pincode}
            onChange={(e) =>
              setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))
            }
            placeholder="302003"
            className={`w-full rounded-lg border ${borderColor} px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none ${accentFocus}`}
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
          className="h-4 w-4 rounded border-slate-300 text-[#2E9A90] focus:ring-[#2E9A90]"
        />
        <span>Set as my default delivery address</span>
      </label>

      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className={`rounded-lg px-5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 ${primaryBtn}`}
        >
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Buyer Dashboard -> Addresses Tab (Persistent PostgreSQL Indian Address Book).
 */
export default function BuyerAddressesTab() {
  const {
    addresses,
    addressesLoading,
    saveAddress,
    removeAddress,
    makeDefaultAddress,
  } = useCart();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const openCreate = () => {
    setEditingAddress(null);
    setModalOpen(true);
  };

  const openEdit = (addr) => {
    setEditingAddress(addr);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    const res = await saveAddress(payload, editingAddress?.id || null);
    if (res.ok) {
      setModalOpen(false);
      setEditingAddress(null);
    }
    return res;
  };

  const handleDelete = async (addrId) => {
    setBusyId(addrId);
    try {
      await removeAddress(addrId);
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (addrId) => {
    setBusyId(addrId);
    try {
      await makeDefaultAddress(addrId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Saved Delivery Addresses ({addresses.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stored in your Craftify account for quick multi-vendor checkout across India
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add New Address</span>
        </button>
      </div>

      {addressesLoading && addresses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-44 rounded-xl bg-white border border-slate-200/80" />
          <div className="h-44 rounded-xl bg-white border border-slate-200/80" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center max-w-xl">
          <MapPin className="mx-auto h-9 w-9 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            No saved delivery addresses yet
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Add your home or work Indian delivery address now so it is ready at checkout.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#247D75] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Your First Address</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`rounded-xl bg-white border p-5 flex flex-col justify-between gap-4 ${
                addr.is_default ? 'border-[#2E9A90]' : 'border-slate-200/80'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {addr.label === 'HOME'
                          ? 'Home'
                          : addr.label === 'WORK'
                          ? 'Work'
                          : 'Other'}
                      </span>
                      {addr.is_default && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#2E9A90]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Default Address
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      {addr.recipient_name}
                    </h3>
                  </div>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed space-y-0.5">
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  {addr.landmark && (
                    <p className="text-slate-500">Landmark: {addr.landmark}</p>
                  )}
                  <p className="font-medium text-slate-800">
                    {addr.city}, {addr.state} —{' '}
                    <span className="font-mono tabular-nums">{addr.pincode}</span>
                  </p>
                </div>

                <p className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 tabular-nums pt-0.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>+91 {addr.phone}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                {!addr.is_default ? (
                  <button
                    type="button"
                    disabled={busyId === addr.id}
                    onClick={() => handleSetDefault(addr.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E9A90] hover:underline disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                    <span>Set as Default</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Used first at checkout
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(addr)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === addr.id}
                    onClick={() => handleDelete(addr.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close address form"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <BuyerAddressForm
              initialValues={editingAddress}
              onSave={handleSave}
              onCancel={() => setModalOpen(false)}
              submitLabel={editingAddress ? 'Save Changes' : 'Save Address'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
