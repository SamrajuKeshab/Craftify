import {
  Heart,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/dashboards/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { FEATURED_PRODUCTS } from '../data/craftifyData';
import { formatINR } from '../utils/formatters';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { placedOrders, wishlistIds, addToCart, toggleWishlist } = useCart();
  const [activeTab, setActiveTab] = useState('orders');

  const navItems = [
    { id: 'orders', label: 'My Orders', icon: Package, badge: placedOrders.length },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, badge: wishlistIds.length },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
  ];

  const wishlistedProducts = FEATURED_PRODUCTS.filter((p) =>
    wishlistIds.includes(p.id)
  );

  return (
    <DashboardShell
      title="Buyer Account"
      subtitle={`Welcome back, ${user?.full_name || 'Craft Lover'}`}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      rightBadge={
        <div className="flex items-center gap-3">
          <Link
            to="/become-seller"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2D8CB] bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold text-[#8B4B28] hover:bg-[#8B4B28] hover:text-white transition-colors whitespace-nowrap"
          >
            <Store className="h-3.5 w-3.5" />
            <span>Become a Seller</span>
          </Link>
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
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Unified Order History &amp; Multi-Seller Tracking
          </h2>
          {placedOrders.map((order) => (
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
          ))}
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Saved Crafts ({wishlistedProducts.length})
          </h2>
          {wishlistedProducts.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-500">
              No saved items yet. Tap the heart on any craft in the storefront.
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
        <div className="rounded-xl bg-white border border-slate-200/80 p-6 max-w-xl">
          <h2 className="text-base font-bold text-slate-900">
            Default Delivery Address
          </h2>
          <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">
              {user?.full_name || 'Priya Sharma'}
            </p>
            <p>42, Indiranagar 100 Feet Road</p>
            <p>Bengaluru, Karnataka - 560038</p>
            <p className="text-xs text-slate-500 pt-1">Phone: +91 98765 43210</p>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
