import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  Image as ImageIcon,
  MapPin,
  Package,
  Shield,
  ShoppingBag,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AccountSecurityPanel from '../components/dashboards/AccountSecurityPanel';
import DashboardShell from '../components/dashboards/DashboardShell';
import EmailVerificationBanner from '../components/dashboards/EmailVerificationBanner';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cancelBuyerOrder, fetchBuyerOrders } from '../services/ordersService';
import {
  extractServiceError,
  fetchMySellerApplicationStatus,
} from '../services/sellerService';
import { formatINR } from '../utils/formatters';
import BuyerAddressesTab from './BuyerAddressesTab';

const VALID_BUYER_TABS = new Set(['orders', 'wishlist', 'addresses', 'security']);

export default function BuyerDashboard() {
  const { user, refreshUser } = useAuth();
  const {
    wishlistItems,
    wishlistIds,
    wishlistLoading,
    addresses,
    moveWishlistToCart,
    toggleWishlist,
    showToast,
  } = useCart();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    VALID_BUYER_TABS.has(requestedTab) ? requestedTab : 'orders'
  );
  const [sellerStatus, setSellerStatus] = useState(null);
  const [busyProductId, setBusyProductId] = useState(null);

  // Week 8 Live PostgreSQL Buyer Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [orderFeedback, setOrderFeedback] = useState(null);

  useEffect(() => {
    if (requestedTab && VALID_BUYER_TABS.has(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (searchParams.get('tab')) {
      setSearchParams(tabId === 'orders' ? {} : { tab: tabId }, { replace: true });
    }
  };

  useEffect(() => {
    let active = true;
    async function loadSellerStatus() {
      try {
        const data = await fetchMySellerApplicationStatus();
        if (!active) return;
        setSellerStatus(data);
        if (data.role === 'SELLER' && user?.role !== 'SELLER') {
          await refreshUser();
        }
      } catch {
        // Non-blocking status check
      }
    }
    if (user) {
      loadSellerStatus();
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadBuyerOrders = async () => {
    setOrdersLoading(true);
    try {
      const data = await fetchBuyerOrders();
      setOrders(data.results || []);
    } catch {
      // Non-blocking fallback
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadBuyerOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCancelOrder = async (orderId) => {
    setCancellingOrderId(orderId);
    setOrderFeedback(null);
    try {
      const res = await cancelBuyerOrder(orderId);
      setOrderFeedback({ type: 'success', text: res.detail });
      showToast(res.detail || 'Order cancelled.');
      await loadBuyerOrders();
    } catch (err) {
      setOrderFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not cancel this order.'),
      });
    } finally {
      setCancellingOrderId(null);
    }
  };

  const navItems = [
    { id: 'orders', label: 'My Orders', icon: Package, badge: orders.length },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, badge: wishlistIds.length },
    { id: 'addresses', label: 'Addresses', icon: MapPin, badge: addresses.length },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const sellerApp = sellerStatus?.application;

  const handleMoveToCart = async (productId) => {
    setBusyProductId(productId);
    try {
      await moveWishlistToCart(productId);
    } finally {
      setBusyProductId(null);
    }
  };

  const handleRemoveWishlist = async (product) => {
    setBusyProductId(product.id);
    try {
      await toggleWishlist(product);
    } finally {
      setBusyProductId(null);
    }
  };

  return (
    <DashboardShell
      title="Buyer Account"
      subtitle={`Welcome, ${user?.full_name || user?.username} (${user?.email})`}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      rightBadge={
        <div className="flex items-center gap-3">
          {sellerStatus?.role === 'SELLER' ? (
            <button
              type="button"
              onClick={async () => {
                await refreshUser();
                navigate('/seller/dashboard');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75] transition-colors whitespace-nowrap"
            >
              <Store className="h-3.5 w-3.5" />
              <span>Open Seller Dashboard</span>
            </button>
          ) : (
            <Link
              to="/become-seller"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold text-[#8B4B28] hover:bg-[#8B4B28] hover:text-white transition-colors whitespace-nowrap"
            >
              <Store className="h-3.5 w-3.5" />
              <span>
                {sellerApp?.status === 'PENDING'
                  ? 'Seller App Pending'
                  : 'Become a Seller'}
              </span>
            </Link>
          )}
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B4B28] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#733C1E] whitespace-nowrap"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Cart</span>
          </Link>
        </div>
      }
    >
      <EmailVerificationBanner />

      {/* Live Seller Application Status Banner (if submitted) */}
      {sellerApp && (
        <div
          className={`mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            sellerApp.status === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : sellerApp.status === 'REJECTED'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            {sellerApp.status === 'APPROVED' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : sellerApp.status === 'REJECTED' ? (
              <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span>
              {sellerApp.status === 'APPROVED' && (
                <>
                  Your seller studio <strong>{sellerApp.shop_name}</strong> was
                  approved by Admin!
                </>
              )}
              {sellerApp.status === 'PENDING' && (
                <>
                  Seller application for <strong>{sellerApp.shop_name}</strong> is
                  currently under Admin review.
                </>
              )}
              {sellerApp.status === 'REJECTED' && (
                <>
                  Seller application for <strong>{sellerApp.shop_name}</strong> was
                  not approved: {sellerApp.review_notes}
                </>
              )}
            </span>
          </div>
          <Link
            to={sellerApp.status === 'APPROVED' ? '/seller/dashboard' : '/become-seller'}
            className="font-semibold underline whitespace-nowrap self-end sm:self-auto"
          >
            {sellerApp.status === 'APPROVED'
              ? 'Go to Seller Studio'
              : sellerApp.status === 'REJECTED'
              ? 'Review & Re-Apply'
              : 'View Application'}
          </Link>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Order History &amp; Multi-Seller Tracking ({orders.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live multi-vendor orders with per-studio fulfilment progress
              </p>
            </div>
            <Link
              to="/"
              className="text-xs font-semibold text-[#2E9A90] hover:underline"
            >
              Browse Crafts
            </Link>
          </div>

          {orderFeedback && (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-xs font-medium ${
                orderFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {orderFeedback.text}
            </div>
          )}

          {ordersLoading && orders.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-500">
              Loading your orders from PostgreSQL...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
              <Package className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                You haven&apos;t placed any orders yet
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Once you purchase handmade crafts from Craftify artisans, each
                parent order and per-studio fulfilment tracker will appear here.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                <span>Browse Handmade Crafts</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            orders.map((order) => {
              const addr = order.shipping_address_snapshot || {};
              const canCancel =
                !['CANCELLED', 'PAYMENT_FAILED', 'SHIPPED', 'DELIVERED'].includes(
                  order.overall_status
                ) &&
                !(order.suborders || []).some((sub) =>
                  ['PACKED', 'SHIPPED', 'DELIVERED'].includes(sub.fulfilment_status)
                );

              return (
                <div
                  key={order.id}
                  className="rounded-xl bg-white border border-slate-200/80 p-5 space-y-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {order.order_number}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            order.overall_status === 'CANCELLED' ||
                            order.overall_status === 'PAYMENT_FAILED'
                              ? 'bg-red-100 text-red-700'
                              : order.overall_status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-teal-50 text-teal-800'
                          }`}
                        >
                          {order.overall_status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(order.created_at).toLocaleString('en-IN')}{' '}
                        <span aria-hidden="true">·</span> {order.payment_method} (
                        {order.payment_status})
                        {order.coupon_code_snapshot ? (
                          <>
                            {' '}
                            <span aria-hidden="true">·</span> Coupon{' '}
                            <strong className="font-mono text-emerald-700">
                              {order.coupon_code_snapshot}
                            </strong>
                          </>
                        ) : null}
                      </p>
                      {addr.city && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Deliver to: {addr.recipient_name}, {addr.city}, {addr.state} —{' '}
                          <span className="font-mono">{addr.pincode}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatINR(Number(order.total_amount))}
                      </span>
                      {canCancel && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            disabled={cancellingOrderId === order.id}
                            onClick={() => handleCancelOrder(order.id)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {cancellingOrderId === order.id
                              ? 'Cancelling...'
                              : 'Cancel Order'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(order.suborders || []).map((sub) => (
                      <div
                        key={sub.id}
                        className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 text-xs space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {sub.seller_shop_name_snapshot}{' '}
                              <span className="font-mono text-slate-400">
                                ({sub.suborder_number})
                              </span>
                            </p>
                            {sub.seller_notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Studio update: {sub.seller_notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-teal-700 font-semibold">
                            <Truck className="h-3.5 w-3.5 shrink-0" />
                            <span>{sub.fulfilment_status}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                          {(sub.items || []).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 text-slate-700"
                            >
                              <div className="min-w-0">
                                <span className="font-medium text-slate-800">
                                  {item.product_title_snapshot}
                                </span>{' '}
                                <span className="text-slate-500">
                                  ({item.variant_label_snapshot}) × {item.quantity}
                                </span>
                                {item.customization_note && (
                                  <p className="text-[11px] text-amber-800 mt-0.5">
                                    Note: {item.customization_note}
                                  </p>
                                )}
                              </div>
                              <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0">
                                {formatINR(Number(item.line_total))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Saved Crafts ({wishlistItems.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live approved products synced with your Craftify account
              </p>
            </div>
            <Link
              to="/"
              className="text-xs font-semibold text-[#2E9A90] hover:underline"
            >
              Browse More Crafts
            </Link>
          </div>

          {wishlistLoading && wishlistItems.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              <div className="h-72 rounded-xl bg-white border border-slate-200/80" />
              <div className="h-72 rounded-xl bg-white border border-slate-200/80" />
            </div>
          ) : wishlistItems.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
              <Heart className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Your wishlist is empty
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tap the heart icon on any product in the storefront to save it here.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#8B4B28] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#733C1E]"
              >
                Explore Storefront
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlistItems.map(({ wishlistItemId, product }) => {
                const outOfStock = product.stock <= 0;
                const isBusy = busyProductId === product.id;
                return (
                  <div
                    key={wishlistItemId}
                    className="rounded-xl bg-white border border-slate-200/80 overflow-hidden flex flex-col"
                  >
                    <Link
                      to={`/products/${product.slug}`}
                      className="aspect-[4/3] w-full bg-slate-100 flex items-center justify-center overflow-hidden"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-slate-300" />
                      )}
                    </Link>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-slate-500">
                          {product.sellerName} <span aria-hidden="true">·</span>{' '}
                          {product.categoryName}
                        </p>
                        <Link
                          to={`/products/${product.slug}`}
                          className="block font-semibold text-slate-900 mt-0.5 hover:text-[#2E9A90] transition-colors line-clamp-1"
                        >
                          {product.name}
                        </Link>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {formatINR(product.price)}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              outOfStock ? 'text-red-600' : 'text-emerald-700'
                            }`}
                          >
                            {outOfStock ? 'Out of stock' : `${product.stock} available`}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          disabled={outOfStock || isBusy}
                          onClick={() => handleMoveToCart(product.id)}
                          className="flex-1 rounded-lg bg-[#8B4B28] px-3 py-2 text-xs font-semibold text-white hover:bg-[#733C1E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {outOfStock
                            ? 'Out of Stock'
                            : isBusy
                            ? 'Moving...'
                            : 'Move to Cart'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRemoveWishlist(product)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'addresses' && <BuyerAddressesTab />}

      {activeTab === 'security' && <AccountSecurityPanel />}
    </DashboardShell>
  );
}
