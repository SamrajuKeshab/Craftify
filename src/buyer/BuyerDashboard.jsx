import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  Package,
  Shield,
  ShoppingBag,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AccountSecurityPanel from '../components/dashboards/AccountSecurityPanel';
import DashboardShell from '../components/dashboards/DashboardShell';
import EmailVerificationBanner from '../components/dashboards/EmailVerificationBanner';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { FEATURED_PRODUCTS } from '../data/craftifyData';
import { fetchMySellerApplicationStatus } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

export default function BuyerDashboard() {
  const { user, refreshUser } = useAuth();
  const { placedOrders, wishlistIds, addToCart, toggleWishlist } = useCart();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders');
  const [sellerStatus, setSellerStatus] = useState(null);

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

  const navItems = [
    { id: 'orders', label: 'My Orders', icon: Package, badge: placedOrders.length },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, badge: wishlistIds.length },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const wishlistedProducts = FEATURED_PRODUCTS.filter((p) =>
    wishlistIds.includes(p.id)
  );

  const sellerApp = sellerStatus?.application;

  return (
    <DashboardShell
      title="Buyer Account"
      subtitle={`Welcome, ${user?.full_name || user?.username} (${user?.email})`}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
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
          <h2 className="text-base font-bold text-slate-900">
            Order History &amp; Multi-Seller Tracking
          </h2>

          {placedOrders.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
              <Package className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                You haven&apos;t placed any orders yet
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Once you purchase handmade crafts from Craftify artisans, each
                parent order and per-studio shipment tracker will appear here.
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
            placedOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl bg-white border border-slate-200/80 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {order.id}
                    </span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-xs text-slate-500">
                      {order.date} · {order.paymentMethod}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {formatINR(order.total)}
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {order.suborders.map((sub) => (
                    <div
                      key={sub.code}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {sub.seller}{' '}
                          <span className="font-mono text-slate-400">
                            ({sub.code})
                          </span>
                        </p>
                        <p className="text-slate-600 mt-0.5">{sub.item}</p>
                      </div>
                      <div className="flex items-center gap-2 text-teal-700 font-medium">
                        <Truck className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {sub.status} · {sub.tracking}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Saved Crafts ({wishlistedProducts.length})
          </h2>
          {wishlistedProducts.length === 0 ? (
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
              {wishlistedProducts.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl bg-white border border-slate-200/80 overflow-hidden flex flex-col"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500">
                        {product.sellerName}
                      </p>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {product.name}
                      </p>
                      <p className="font-mono text-sm font-bold text-slate-900 mt-1 tabular-nums">
                        {formatINR(product.price)}
                      </p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="flex-1 rounded-lg bg-[#8B4B28] px-3 py-2 text-xs font-semibold text-white hover:bg-[#733C1E]"
                      >
                        Move to Cart
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(product)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'addresses' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center max-w-xl">
          <MapPin className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            No saved delivery addresses yet
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Persistent Buyer Addresses backed by PostgreSQL (`BuyerAddress` model)
            will be wired in Week 7.
          </p>
        </div>
      )}

      {activeTab === 'security' && <AccountSecurityPanel />}
    </DashboardShell>
  );
}
