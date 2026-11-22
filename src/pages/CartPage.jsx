import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  MapPin,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BuyerAddressForm } from '../buyer/BuyerAddressesTab';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatINR } from '../utils/formatters';

export default function CartPage() {
  const {
    items,
    itemCount,
    distinctSellersCount,
    subtotal,
    discount,
    shipping,
    total,
    freeShippingThreshold,
    codMaxAmount,
    codEligible,
    appliedCoupon,
    couponNotice,
    cartLoading,
    addresses,
    updateCartItemQuantity,
    updateCartItemNote,
    removeFromCart,
    applyCouponCode,
    removeCoupon,
    saveAddress,
  } = useCart();
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState(null);
  const [busyItemId, setBusyItemId] = useState(null);

  // Inline customization note editing for customizable crafts
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Checkout Readiness Modal (Saved Address Selection + Inline Add Address)
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addingInlineAddress, setAddingInlineAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY');

  useEffect(() => {
    if (addresses.length > 0) {
      const stillExists = addresses.some((a) => a.id === selectedAddressId);
      if (!stillExists) {
        const defaultAddr = addresses.find((a) => a.is_default) || addresses[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } else {
      setSelectedAddressId('');
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!codEligible && paymentMethod === 'COD') {
      setPaymentMethod('RAZORPAY');
    }
  }, [codEligible, paymentMethod]);

  const hasUnavailableItems = items.some((entry) => !entry.isAvailable);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  const handleQtyChange = async (entry, delta) => {
    const nextQty = entry.quantity + delta;
    if (delta > 0 && nextQty > entry.availableStock) return;
    setBusyItemId(entry.id);
    try {
      await updateCartItemQuantity(entry.id, nextQty);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleRemoveItem = async (itemId) => {
    setBusyItemId(itemId);
    try {
      await removeFromCart(itemId);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleSaveNote = async (itemId) => {
    setBusyItemId(itemId);
    try {
      const res = await updateCartItemNote(itemId, noteDraft);
      if (res?.ok) {
        setEditingNoteId(null);
        setNoteDraft('');
      }
    } finally {
      setBusyItemId(null);
    }
  };

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponInput.trim() || couponBusy) return;
    setCouponBusy(true);
    setCouponFeedback(null);
    try {
      const res = await applyCouponCode(couponInput);
      setCouponFeedback(res);
      if (res.ok) {
        setCouponInput('');
      }
    } finally {
      setCouponBusy(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponBusy(true);
    setCouponFeedback(null);
    try {
      await removeCoupon();
    } finally {
      setCouponBusy(false);
    }
  };

  const handleInlineAddressSave = async (payload) => {
    const res = await saveAddress(payload);
    if (res?.ok && res.address?.id) {
      setSelectedAddressId(res.address.id);
      setAddingInlineAddress(false);
    }
    return res;
  };

  // Group items by studio for checkout split preview
  const studioGroups = Object.values(
    items.reduce((acc, entry) => {
      const key = entry.sellerId || entry.sellerName;
      if (!acc[key]) {
        acc[key] = {
          sellerName: entry.sellerName,
          items: [],
          subtotal: 0,
        };
      }
      acc[key].items.push(entry);
      acc[key].subtotal += entry.lineTotal;
      return acc;
    }, {})
  );

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Top Row: Heading + Free Shipping Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2018]">
              Your Cart ({itemCount} {itemCount === 1 ? 'Item' : 'Items'})
            </h1>
            <Link
              to="/"
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#524338] hover:text-[#8B4B28] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Continue Shopping</span>
            </Link>
          </div>

          {user && items.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#EDF4EE] border border-[#D4E6D8] px-3.5 py-2 text-xs font-medium text-[#355E44] self-start sm:self-auto">
              <Truck className="h-4 w-4 text-[#4E7A5B] shrink-0" />
              <span>
                {subtotal >= freeShippingThreshold
                  ? `Free Shipping unlocked on your order (above ${formatINR(freeShippingThreshold)})`
                  : `Add ${formatINR(
                      freeShippingThreshold - subtotal
                    )} more for Free Shipping above ${formatINR(freeShippingThreshold)}`}
              </span>
            </div>
          )}
        </div>

        {/* Unauthenticated Sign-In Gate */}
        {!authLoading && !user ? (
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-12 text-center max-w-2xl mx-auto">
            <Lock className="mx-auto h-10 w-10 text-[#A8927B]" />
            <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2018]">
              Sign in to view your shopping cart
            </h2>
            <p className="mt-2 text-sm text-[#6E5E52] max-w-md mx-auto">
              Your Craftify cart, wishlist, saved Indian delivery addresses, and coupons stay synced across sessions once you sign in.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate('/login', {
                    state: {
                      from: '/cart',
                      message: 'Sign in to access your Craftify shopping cart.',
                    },
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                <span>Sign In to Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0] px-5 py-2.5 text-sm font-semibold text-[#2C2018] hover:border-[#8B4B28] transition-colors"
              >
                <span>Browse Crafts</span>
              </Link>
            </div>
          </div>
        ) : cartLoading && items.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            <div className="lg:col-span-8 h-64 rounded-2xl bg-white border border-[#EAE1D5]" />
            <div className="lg:col-span-4 h-64 rounded-2xl bg-white border border-[#EAE1D5]" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[#EAE1D5] p-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-[#C2B3A3]" />
            <h2 className="mt-4 font-serif text-xl font-bold text-[#2C2018]">
              Your shopping cart is empty
            </h2>
            <p className="mt-1 text-sm text-[#6E5E52]">
              Explore handcrafted pottery, textiles, woodcraft, and jewellery from verified Indian artists.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
            >
              <span>Browse Crafts</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Persistent Cart Items + Server-Validated Coupon Bar */}
            <div className="lg:col-span-8 space-y-4">
              {hasUnavailableItems && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    One or more items in your cart have stock or availability changes. Adjust quantities or remove flagged items before checkout.
                  </span>
                </div>
              )}

              <div className="rounded-2xl bg-white border border-[#EAE1D5] divide-y divide-[#F1E8DD]">
                {items.map((entry) => {
                  const isBusy = busyItemId === entry.id;
                  const atMaxStock = entry.quantity >= entry.availableStock;
                  return (
                    <div
                      key={entry.id}
                      className="p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <Link
                            to={`/products/${entry.productSlug}`}
                            className="shrink-0"
                          >
                            {entry.image ? (
                              <img
                                src={entry.image}
                                alt={entry.productTitle}
                                referrerPolicy="no-referrer"
                                className="h-20 w-20 rounded-xl object-cover bg-[#F3ECE2]"
                              />
                            ) : (
                              <div className="h-20 w-20 rounded-xl bg-[#F3ECE2] border border-[#E5DACB] flex items-center justify-center text-[#A8927B]">
                                <ShoppingBag className="h-6 w-6" />
                              </div>
                            )}
                          </Link>

                          <div className="min-w-0">
                            <Link
                              to={`/products/${entry.productSlug}`}
                              className="text-sm sm:text-base font-semibold text-[#2C2018] hover:text-[#8B4B28] transition-colors line-clamp-1"
                            >
                              {entry.productTitle}
                            </Link>
                            <p className="text-xs text-[#6E5E52] mt-0.5">
                              {entry.sellerSlug ? (
                                <Link
                                  to={`/shops/${entry.sellerSlug}`}
                                  className="hover:text-[#8B4B28] hover:underline"
                                >
                                  {entry.sellerName}
                                </Link>
                              ) : (
                                entry.sellerName
                              )}{' '}
                              <span aria-hidden="true">·</span> {entry.variantLabel}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono text-sm font-semibold text-[#2C2018] tabular-nums">
                                {formatINR(entry.unitPrice)}
                              </span>
                              <span aria-hidden="true" className="text-[#C5B5A3]">
                                ·
                              </span>
                              <span
                                className={
                                  entry.isAvailable
                                    ? 'text-[#355E44] font-medium'
                                    : 'text-red-700 font-semibold'
                                }
                              >
                                {entry.isAvailable
                                  ? `${entry.availableStock} in stock`
                                  : entry.availabilityIssue || 'Unavailable'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                          {/* Stock-Capped Quantity Stepper */}
                          <div className="inline-flex items-center rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleQtyChange(entry, -1)}
                              aria-label={`Decrease quantity of ${entry.productTitle}`}
                              className="flex h-8 w-8 items-center justify-center text-[#524338] hover:text-[#8B4B28] disabled:opacity-40"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono text-sm font-semibold text-[#2C2018] tabular-nums">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={isBusy || atMaxStock}
                              onClick={() => handleQtyChange(entry, 1)}
                              aria-label={`Increase quantity of ${entry.productTitle}`}
                              title={
                                atMaxStock
                                  ? `Maximum available stock (${entry.availableStock}) reached`
                                  : 'Increase quantity'
                              }
                              className="flex h-8 w-8 items-center justify-center text-[#524338] hover:text-[#8B4B28] disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <span className="w-24 text-right font-mono text-sm sm:text-base font-bold text-[#2C2018] tabular-nums">
                            {formatINR(entry.lineTotal)}
                          </span>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRemoveItem(entry.id)}
                            aria-label={`Remove ${entry.productTitle}`}
                            className="p-2 text-[#8C7B6E] hover:text-red-600 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Optional Personalization Note Row for Customizable Crafts */}
                      {entry.isCustomizable && (
                        <div className="pt-1 sm:pl-24">
                          {editingNoteId === entry.id ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="text"
                                maxLength={300}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Add personalization instructions for the artisan..."
                                className="flex-1 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0] px-3 py-1.5 text-xs text-[#2C2018] focus:outline-none focus:border-[#8B4B28]"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSaveNote(entry.id)}
                                  className="rounded-lg bg-[#8B4B28] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#733C1E]"
                                >
                                  Save Note
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="rounded-lg border border-[#E2D8CB] px-3 py-1.5 text-xs font-medium text-[#524338] hover:bg-[#FAF6F0]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E5E52]">
                              <span>
                                {entry.customizationNote ? (
                                  <>
                                    Personalization:{' '}
                                    <strong className="text-[#2C2018]">
                                      {entry.customizationNote}
                                    </strong>
                                  </>
                                ) : (
                                  'Customizable piece — no note added yet'
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(entry.id);
                                  setNoteDraft(entry.customizationNote || '');
                                }}
                                className="inline-flex items-center gap-1 font-semibold text-[#8B4B28] hover:underline"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>
                                  {entry.customizationNote ? 'Edit note' : 'Add note'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Server-Validated Apply Coupon Bar */}
              <div className="rounded-xl bg-white border border-[#EAE1D5] p-4 sm:p-5">
                <form
                  onSubmit={handleApplyCoupon}
                  className="flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <label
                    htmlFor="coupon-input"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2C2018] whitespace-nowrap"
                  >
                    <Tag className="h-4 w-4 text-[#8B4B28]" />
                    <span>Apply Coupon</span>
                  </label>
                  <input
                    id="coupon-input"
                    type="text"
                    maxLength={32}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                    className="flex-1 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0] px-3.5 py-2 text-sm font-mono text-[#2C2018] placeholder:font-sans placeholder:text-[#8C7B6E] focus:outline-none focus:border-[#8B4B28]"
                  />
                  <button
                    type="submit"
                    disabled={couponBusy || !couponInput.trim()}
                    className="rounded-lg bg-[#8B4B28] px-5 py-2 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {couponBusy ? 'Validating...' : 'Apply'}
                  </button>
                </form>

                {couponFeedback && (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      couponFeedback.ok ? 'text-[#355E44]' : 'text-red-600'
                    }`}
                  >
                    {couponFeedback.message}
                  </p>
                )}

                {!couponFeedback && couponNotice && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    {couponNotice}
                  </p>
                )}

                {appliedCoupon && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#EDF4EE] border border-[#D4E6D8] px-3.5 py-2.5 text-xs text-[#355E44]">
                    <span>
                      Applied <strong className="font-mono">{appliedCoupon.code}</strong>{' '}
                      <span aria-hidden="true">·</span> saving{' '}
                      <strong className="font-mono tabular-nums">
                        {formatINR(discount)}
                      </strong>
                      {appliedCoupon.description ? ` (${appliedCoupon.description})` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={couponBusy}
                      onClick={handleRemoveCoupon}
                      className="font-semibold hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Authoritative Server Order Summary */}
            <aside className="lg:col-span-4 rounded-2xl bg-white border border-[#EAE1D5] p-6 sticky top-24">
              <h2 className="text-lg font-bold text-[#2C2018]">Order Summary</h2>
              <p className="mt-1 text-xs text-[#6E5E52]">
                Fulfilled directly by {distinctSellersCount} verified artisan{' '}
                {distinctSellersCount === 1 ? 'studio' : 'studios'}
              </p>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[#524338]">Subtotal</dt>
                  <dd className="font-mono font-semibold text-[#2C2018] tabular-nums">
                    {formatINR(subtotal)}
                  </dd>
                </div>

                {discount > 0 && (
                  <div className="flex items-center justify-between text-[#355E44]">
                    <dt>
                      Coupon{' '}
                      {appliedCoupon?.code ? `(${appliedCoupon.code})` : 'Discount'}
                    </dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      -{formatINR(discount)}
                    </dd>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <dt className="text-[#524338]">Shipping</dt>
                  <dd className="font-mono font-semibold text-[#2C2018] tabular-nums">
                    {shipping === 0 ? 'Free' : formatINR(shipping)}
                  </dd>
                </div>

                <div className="border-t border-[#EAE1D5] pt-3.5 flex items-center justify-between text-base">
                  <dt className="font-bold text-[#2C2018]">Total</dt>
                  <dd className="font-mono text-lg font-bold text-[#2C2018] tabular-nums">
                    {formatINR(total)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={hasUnavailableItems}
                onClick={() => {
                  setAddingInlineAddress(addresses.length === 0);
                  setCheckoutOpen(true);
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#733C1E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span>Select Delivery Address &amp; Review</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-3 text-center text-[11px] text-[#7A6A5E]">
                Supports Razorpay (UPI · Cards · Netbanking) &amp; COD up to{' '}
                {formatINR(codMaxAmount)}
              </p>
            </aside>
          </div>
        )}
      </main>

      {/* Saved Indian Delivery Address & Multi-Vendor Checkout Preview Modal */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select Delivery Address and Review Checkout"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-white border border-[#EAE1D5] p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE1D5]">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#2C2018]">
                  Delivery Address &amp; Checkout Review
                </h2>
                <p className="text-xs text-[#6E5E52] mt-0.5">
                  Splits cleanly into {studioGroups.length} artisan studio suborder
                  {studioGroups.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout review"
                className="p-1.5 text-[#6E5E52] hover:text-[#2C2018]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Saved Indian Addresses Section */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A3B31]">
                    <MapPin className="h-3.5 w-3.5 text-[#8B4B28]" />
                    <span>Saved Delivery Addresses ({addresses.length})</span>
                  </span>
                  {!addingInlineAddress && (
                    <button
                      type="button"
                      onClick={() => setAddingInlineAddress(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B4B28] hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add New Address</span>
                    </button>
                  )}
                </div>

                {addingInlineAddress ? (
                  <div className="rounded-xl border border-[#EAE1D5] bg-[#FAF6F0]/60 p-4">
                    <BuyerAddressForm
                      tone="storefront"
                      submitLabel="Save & Select Address"
                      onSave={handleInlineAddressSave}
                      onCancel={
                        addresses.length > 0
                          ? () => setAddingInlineAddress(false)
                          : undefined
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {addresses.map((addr) => {
                      const active = addr.id === selectedAddressId;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                            active
                              ? 'border-[#8B4B28] bg-[#FAF6F0]'
                              : 'border-[#E2D8CB] bg-white hover:border-[#8B4B28]/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#2C2018]">
                              {addr.recipient_name}{' '}
                              <span className="font-normal text-[#6E5E52]">
                                · {addr.label === 'HOME' ? 'Home' : addr.label === 'WORK' ? 'Work' : 'Other'}
                              </span>
                            </span>
                            {active && (
                              <CheckCircle2 className="h-4 w-4 text-[#8B4B28] shrink-0" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#524338]">
                            {addr.line1}
                            {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city},{' '}
                            {addr.state} —{' '}
                            <span className="font-mono tabular-nums">{addr.pincode}</span>
                          </p>
                          <p className="mt-0.5 text-[11px] font-mono text-[#7A6A5E] tabular-nums">
                            +91 {addr.phone}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Per-Studio Split Preview */}
              {!addingInlineAddress && (
                <>
                  <div className="border-t border-[#F1E8DD] pt-4 space-y-2">
                    <p className="text-xs font-semibold text-[#4A3B31]">
                      Multi-Vendor Suborder Breakdown
                    </p>
                    {studioGroups.map((group) => (
                      <div
                        key={group.sellerName}
                        className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF6F0] border border-[#EAE1D5] px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#2C2018] truncate">
                            {group.sellerName}
                          </p>
                          <p className="text-[#6E5E52] truncate">
                            {group.items
                              .map((it) => `${it.productTitle} × ${it.quantity}`)
                              .join(', ')}
                          </p>
                        </div>
                        <span className="font-mono font-semibold text-[#2C2018] tabular-nums shrink-0">
                          {formatINR(group.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Payment Method Eligibility Preview */}
                  <div className="border-t border-[#F1E8DD] pt-4">
                    <p className="text-xs font-semibold text-[#4A3B31] mb-2">
                      Payment Method Eligibility
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('RAZORPAY')}
                        className={`rounded-xl border p-3.5 text-left transition-colors ${
                          paymentMethod === 'RAZORPAY'
                            ? 'border-[#8B4B28] bg-[#FAF6F0]'
                            : 'border-[#E2D8CB] hover:border-[#8B4B28]/50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#2C2018]">
                          Razorpay Online
                        </p>
                        <p className="text-[11px] text-[#6E5E52] mt-0.5">
                          UPI, Cards, Netbanking · Verified signature
                        </p>
                      </button>

                      <button
                        type="button"
                        disabled={!codEligible}
                        onClick={() => setPaymentMethod('COD')}
                        className={`rounded-xl border p-3.5 text-left transition-colors ${
                          !codEligible
                            ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                            : paymentMethod === 'COD'
                            ? 'border-[#8B4B28] bg-[#FAF6F0]'
                            : 'border-[#E2D8CB] hover:border-[#8B4B28]/50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#2C2018]">
                          Cash on Delivery
                        </p>
                        <p className="text-[11px] text-[#6E5E52] mt-0.5">
                          {codEligible
                            ? 'Eligible for doorstep payment'
                            : `Available up to ${formatINR(codMaxAmount)}`}
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-[#FAF6F0] border border-[#EAE1D5] px-4 py-3 text-sm">
                    <span className="font-medium text-[#524338]">Payable Total</span>
                    <span className="font-mono text-base font-bold text-[#2C2018] tabular-nums">
                      {formatINR(total)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#EDF4EE] border border-[#D4E6D8] p-4 text-xs text-[#355E44] space-y-1.5">
                    <p className="font-semibold">
                      {selectedAddress
                        ? `Delivery address ready: ${selectedAddress.recipient_name}, ${selectedAddress.city} (${selectedAddress.pincode})`
                        : 'Save a delivery address above to prepare for checkout.'}
                    </p>
                    <p>
                      Live multi-vendor Order creation, atomic inventory locking, COD confirmation, and Razorpay payment verification connect to this exact cart &amp; address selection in Week 8.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <Link
                      to="/buyer/dashboard?tab=addresses"
                      onClick={() => setCheckoutOpen(false)}
                      className="text-xs font-semibold text-[#8B4B28] hover:underline"
                    >
                      Manage Addresses in Buyer Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCheckoutOpen(false)}
                      className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#733C1E]"
                    >
                      Done Reviewing
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
