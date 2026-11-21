import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StorefrontNavbar from '../components/storefront/StorefrontNavbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  COD_MAX_ORDER_AMOUNT,
  FREE_SHIPPING_THRESHOLD,
  formatINR,
} from '../utils/formatters';

export default function CartPage() {
  const {
    items,
    itemCount,
    subtotal,
    discount,
    shipping,
    total,
    appliedCoupon,
    updateQuantity,
    removeFromCart,
    applyCouponCode,
    removeCoupon,
    placeOrder,
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('RAZORPAY');
  const [address, setAddress] = useState({
    fullName: user?.full_name || '',
    phone: user?.phone || '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const codEligible = total <= COD_MAX_ORDER_AMOUNT;
  const distinctSellers = [...new Set(items.map((entry) => entry.product.sellerName))];

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    const res = applyCouponCode(couponInput);
    setCouponFeedback(res);
  };

  const handleConfirmOrder = (e) => {
    e.preventDefault();
    const order = placeOrder({
      address: `${address.line1}, ${address.city}, ${address.state} - ${address.pincode}`,
      paymentMethod: paymentMethod === 'COD' && codEligible ? 'COD' : 'Razorpay',
    });
    setConfirmedOrder(order);
    setCheckoutOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#2C2018] flex flex-col">
      <StorefrontNavbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Top Row: Heading + Free Shipping Notice (Matches Mockup Screen 4) */}
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

          <div className="inline-flex items-center gap-2 rounded-lg bg-[#EDF4EE] border border-[#D4E6D8] px-3.5 py-2 text-xs font-medium text-[#355E44] self-start sm:self-auto">
            <Truck className="h-4 w-4 text-[#4E7A5B] shrink-0" />
            <span>
              {subtotal >= FREE_SHIPPING_THRESHOLD
                ? 'Free Shipping unlocked on your order (above ₹999)'
                : `Add ${formatINR(FREE_SHIPPING_THRESHOLD - subtotal)} more for Free Shipping above ₹999`}
            </span>
          </div>
        </div>

        {/* Post-Order Confirmation Card */}
        {confirmedOrder && (
          <div className="mb-8 rounded-2xl bg-white border border-[#D4E6D8] p-6 sm:p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-[#355E44] shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-serif text-xl font-bold text-[#2C2018]">
                  Order {confirmedOrder.id} Confirmed
                </h2>
                <p className="mt-1 text-sm text-[#524338]">
                  Payment Method: <strong>{confirmedOrder.paymentMethod}</strong> · Total:{' '}
                  <strong className="font-mono tabular-nums">
                    {formatINR(confirmedOrder.total)}
                  </strong>
                </p>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-[#6E5E52]">
                    Multi-Vendor Suborders Created ({confirmedOrder.suborders.length} Artisan
                    Studio{confirmedOrder.suborders.length > 1 ? 's' : ''}):
                  </p>
                  {confirmedOrder.suborders.map((sub) => (
                    <div
                      key={sub.code}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF6F0] border border-[#EAE1D5] px-4 py-2.5 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-[#2C2018]">
                          {sub.code}
                        </span>
                        <span className="mx-2 text-[#9B8B7E]">·</span>
                        <span className="font-semibold text-[#8B4B28]">{sub.seller}</span>
                        <span className="mx-2 text-[#9B8B7E]">·</span>
                        <span className="text-[#524338]">{sub.item}</span>
                      </div>
                      <span className="font-medium text-[#355E44]">{sub.status}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigate(user ? '/buyer/dashboard' : '/login');
                    }}
                    className="rounded-lg bg-[#8B4B28] px-4 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
                  >
                    {user ? 'Track in Buyer Dashboard' : 'Login to Track Order'}
                  </button>
                  <Link
                    to="/"
                    className="rounded-lg border border-[#E2D8CB] bg-white px-4 py-2 text-xs font-semibold text-[#2C2018] hover:border-[#8B4B28]"
                  >
                    Back to Storefront
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty Cart State */}
        {items.length === 0 ? (
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
            {/* Left Column: Cart Item Rows + Coupon Input */}
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-2xl bg-white border border-[#EAE1D5] divide-y divide-[#F1E8DD]">
                {items.map((entry) => {
                  const lineTotal = entry.product.price * entry.quantity;
                  return (
                    <div
                      key={`${entry.product.id}-${entry.selectedVariant}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={entry.product.image}
                          alt={entry.product.name}
                          referrerPolicy="no-referrer"
                          className="h-20 w-20 rounded-xl object-cover bg-[#F3ECE2] shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold text-[#2C2018] truncate">
                            {entry.product.name}
                          </h3>
                          <p className="text-xs text-[#6E5E52] mt-0.5">
                            {entry.product.sellerName} <span aria-hidden="true">·</span>{' '}
                            {entry.selectedVariant}
                          </p>
                          <p className="mt-1.5 font-mono text-sm font-semibold text-[#2C2018] tabular-nums">
                            {formatINR(entry.product.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                        {/* Quantity Stepper */}
                        <div className="inline-flex items-center rounded-lg border border-[#E2D8CB] bg-[#FAF6F0]">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(entry.product.id, entry.selectedVariant, -1)
                            }
                            aria-label={`Decrease quantity of ${entry.product.name}`}
                            className="flex h-8 w-8 items-center justify-center text-[#524338] hover:text-[#8B4B28]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono text-sm font-semibold text-[#2C2018] tabular-nums">
                            {entry.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(entry.product.id, entry.selectedVariant, 1)
                            }
                            aria-label={`Increase quantity of ${entry.product.name}`}
                            className="flex h-8 w-8 items-center justify-center text-[#524338] hover:text-[#8B4B28]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <span className="w-20 text-right font-mono text-sm sm:text-base font-bold text-[#2C2018] tabular-nums">
                          {formatINR(lineTotal)}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(entry.product.id, entry.selectedVariant)
                          }
                          aria-label={`Remove ${entry.product.name}`}
                          className="p-2 text-[#8C7B6E] hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Apply Coupon Bar (Matches Bottom Left of Mockup Screen 4) */}
              <div className="rounded-xl bg-white border border-[#EAE1D5] p-4 sm:p-5">
                <form
                  onSubmit={handleApplyCoupon}
                  className="flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <label
                    htmlFor="coupon-input"
                    className="text-sm font-semibold text-[#2C2018] whitespace-nowrap"
                  >
                    Apply Coupon
                  </label>
                  <input
                    id="coupon-input"
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code (try CRAFT10)"
                    className="flex-1 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0] px-3.5 py-2 text-sm text-[#2C2018] placeholder:text-[#8C7B6E] focus:outline-none focus:border-[#8B4B28]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#8B4B28] px-5 py-2 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors whitespace-nowrap"
                  >
                    Apply
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

                {appliedCoupon && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#EDF4EE] px-3 py-2 text-xs text-[#355E44]">
                    <span>
                      Applied <strong>{appliedCoupon.code}</strong> — saving{' '}
                      <strong className="font-mono tabular-nums">
                        {formatINR(discount)}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Order Summary Card (Matches Right of Mockup Screen 4) */}
            <aside className="lg:col-span-4 rounded-2xl bg-white border border-[#EAE1D5] p-6 sticky top-24">
              <h2 className="text-lg font-bold text-[#2C2018]">Order Summary</h2>
              <p className="mt-1 text-xs text-[#6E5E52]">
                Fulfilled directly by {distinctSellers.length} verified artisan{' '}
                {distinctSellers.length === 1 ? 'studio' : 'studios'}
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
                    <dt>Coupon Discount</dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      -{formatINR(discount)}
                    </dd>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <dt className="text-[#524338]">Shipping</dt>
                  <dd className="font-mono font-semibold text-[#2C2018] tabular-nums">
                    {formatINR(shipping)}
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
                onClick={() => setCheckoutOpen(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="mt-3 text-center text-[11px] text-[#7A6A5E]">
                Supports Razorpay (UPI · Cards · Netbanking) &amp; COD up to ₹5,000
              </p>
            </aside>
          </div>
        )}
      </main>

      {/* Multi-Vendor Checkout Modal */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white border border-[#EAE1D5] p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE1D5]">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#2C2018]">
                  Multi-Vendor Checkout
                </h2>
                <p className="text-xs text-[#6E5E52] mt-0.5">
                  Splits cleanly into {distinctSellers.length} seller suborder(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
                className="p-1.5 text-[#6E5E52] hover:text-[#2C2018]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1">
                    Recipient Name
                  </label>
                  <input
                    required
                    value={address.fullName}
                    onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-[#E2D8CB] px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1">
                    Mobile Number
                  </label>
                  <input
                    required
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-lg border border-[#E2D8CB] px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3B31] mb-1">
                  Delivery Address
                </label>
                <input
                  required
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  placeholder="House/Flat no., Street, Locality"
                  className="w-full rounded-lg border border-[#E2D8CB] px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1">
                    City
                  </label>
                  <input
                    required
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="City"
                    className="w-full rounded-lg border border-[#E2D8CB] px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1">
                    State
                  </label>
                  <input
                    required
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    placeholder="State"
                    className="w-full rounded-lg border border-[#E2D8CB] px-3 py-2 text-sm focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A3B31] mb-1">
                    Pincode
                  </label>
                  <input
                    required
                    pattern="[0-9]{6}"
                    value={address.pincode}
                    onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                    placeholder="6-digit PIN"
                    className="w-full rounded-lg border border-[#E2D8CB] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#8B4B28]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs font-semibold text-[#4A3B31] mb-2">
                  Payment Method
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
                    <p className="text-sm font-semibold text-[#2C2018]">Razorpay Online</p>
                    <p className="text-[11px] text-[#6E5E52] mt-0.5">
                      UPI, Cards, Netbanking · Verified HMAC
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
                    <p className="text-sm font-semibold text-[#2C2018]">Cash on Delivery</p>
                    <p className="text-[11px] text-[#6E5E52] mt-0.5">
                      {codEligible
                        ? 'Pay on doorstep delivery'
                        : 'Available up to ₹5,000'}
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

              <button
                type="submit"
                className="w-full rounded-lg bg-[#8B4B28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                {paymentMethod === 'COD'
                  ? `Confirm COD Order (${formatINR(total)})`
                  : `Pay ${formatINR(total)} via Razorpay`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
