import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Package,
  PlusSquare,
  Save,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AccountSecurityPanel from '../components/dashboards/AccountSecurityPanel';
import DashboardShell from '../components/dashboards/DashboardShell';
import EmailVerificationBanner from '../components/dashboards/EmailVerificationBanner';
import { useAuth } from '../context/AuthContext';
import {
  fetchPublicCategories,
  fetchSellerProducts,
} from '../services/catalogService';
import { fetchSellerSuborders } from '../services/ordersService';
import {
  extractServiceError,
  fetchMySellerShop,
  updateMySellerShop,
} from '../services/sellerService';
import { formatINR, formatINRCompact } from '../utils/formatters';
import SellerOrdersTab from './SellerOrdersTab';
import SellerProductsTab from './SellerProductsTab';

const EMPTY_SALES_6M = [
  { month: 'Jan', sales: 0 },
  { month: 'Feb', sales: 0 },
  { month: 'Mar', sales: 0 },
  { month: 'Apr', sales: 0 },
  { month: 'May', sales: 0 },
  { month: 'Jun', sales: 0 },
];

/**
 * Craftify Seller Dashboard — Wired to live PostgreSQL SellerProfile (Week 4)
 * with honest zero baselines for upcoming Products/Orders/Earnings modules.
 */
export default function SellerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [suborders, setSuborders] = useState([]);
  const [orderSummary, setOrderSummary] = useState({
    total_sales: '0.00',
    total_commission: '0.00',
    net_earnings: '0.00',
    total_orders: 0,
    pending_count: 0,
  });
  const [salesSeries, setSalesSeries] = useState(EMPTY_SALES_6M);
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [shop, setShop] = useState(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopForm, setShopForm] = useState({
    shop_name: '',
    primary_category: '',
    description: '',
    city: '',
    state: '',
    pickup_line1: '',
    pickup_pincode: '',
    ifsc_code: '',
    bank_account_number: '',
  });
  const [savingShop, setSavingShop] = useState(false);
  const [shopMessage, setShopMessage] = useState(null);

  // Week 5 live Seller Products & Categories
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [approvedProductCount, setApprovedProductCount] = useState(0);
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');
  const [productsLoading, setProductsLoading] = useState(false);
  const [openComposerOnProductsTab, setOpenComposerOnProductsTab] = useState(false);

  const loadSellerProducts = async (statusFilter = productStatusFilter) => {
    setProductsLoading(true);
    try {
      const data = await fetchSellerProducts(statusFilter);
      const list = data.results || [];
      setProducts(list);
      if (typeof data.approved_count === 'number') {
        setApprovedProductCount(data.approved_count);
      }
      return list;
    } catch {
      return [];
    } finally {
      setProductsLoading(false);
    }
  };

  const loadSellerSuborders = async (statusFilter = orderStatusFilter) => {
    setOrdersLoading(true);
    try {
      const data = await fetchSellerSuborders(statusFilter);
      setSuborders(data.results || []);
      if (data.summary) setOrderSummary(data.summary);
      if (Array.isArray(data.sales_series) && data.sales_series.length > 0) {
        setSalesSeries(data.sales_series);
      }
      return data.results || [];
    } catch {
      return [];
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function loadInitialStudioData() {
      setShopLoading(true);
      try {
        const [shopData, catData, prodData, suborderData] = await Promise.allSettled([
          fetchMySellerShop(),
          fetchPublicCategories(),
          fetchSellerProducts('ALL'),
          fetchSellerSuborders('ALL'),
        ]);
        if (!active) return;

        const liveCategories =
          catData.status === 'fulfilled' ? catData.value?.results || [] : [];
        setCategories(liveCategories);

        if (prodData.status === 'fulfilled') {
          setProducts(prodData.value?.results || []);
          setApprovedProductCount(prodData.value?.approved_count ?? 0);
        }

        if (suborderData.status === 'fulfilled' && suborderData.value) {
          setSuborders(suborderData.value.results || []);
          if (suborderData.value.summary) {
            setOrderSummary(suborderData.value.summary);
          }
          if (
            Array.isArray(suborderData.value.sales_series) &&
            suborderData.value.sales_series.length > 0
          ) {
            setSalesSeries(suborderData.value.sales_series);
          }
        }

        if (shopData.status === 'fulfilled' && shopData.value) {
          const data = shopData.value;
          setShop(data);
          setShopForm({
            shop_name: data.shop_name || '',
            primary_category:
              data.primary_category || liveCategories[0]?.name || '',
            description: data.description || '',
            city: data.city || '',
            state: data.state || '',
            pickup_line1: data.pickup_address_json?.line1 || '',
            pickup_pincode: data.pickup_address_json?.pincode || '',
            ifsc_code: data.ifsc_code || '',
            bank_account_number: '',
          });
        } else {
          setShop(null);
        }
      } finally {
        if (active) setShopLoading(false);
      }
    }
    loadInitialStudioData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
      loadSellerProducts(productStatusFilter);
    } else if (activeTab === 'orders') {
      loadSellerSuborders(orderStatusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, productStatusFilter, orderStatusFilter]);

  const handleSaveShop = async (e) => {
    e.preventDefault();
    setSavingShop(true);
    setShopMessage(null);
    try {
      const payload = {
        shop_name: shopForm.shop_name.trim(),
        primary_category: shopForm.primary_category,
        description: shopForm.description.trim(),
        city: shopForm.city.trim(),
        state: shopForm.state.trim(),
        pickup_address_json: {
          line1: shopForm.pickup_line1.trim(),
          city: shopForm.city.trim(),
          state: shopForm.state.trim(),
          pincode: shopForm.pickup_pincode.trim(),
        },
        ifsc_code: shopForm.ifsc_code.trim().toUpperCase(),
      };
      if (shopForm.bank_account_number.trim()) {
        payload.bank_account_number = shopForm.bank_account_number.trim();
      }
      const updated = await updateMySellerShop(payload);
      setShop(updated);
      setShopForm((prev) => ({ ...prev, bank_account_number: '' }));
      setShopMessage({
        type: 'success',
        text: 'Shop profile saved to PostgreSQL successfully.',
      });
    } catch (err) {
      setShopMessage({
        type: 'error',
        text: extractServiceError(err, 'Could not update shop profile.'),
      });
    } finally {
      setSavingShop(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'shop', label: 'My Shop', icon: Store },
    { id: 'products', label: 'Products', icon: Package },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
      badge: orderSummary.pending_count || undefined,
    },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const studioTitle = shop?.shop_name || user?.full_name || user?.username;

  return (
    <DashboardShell
      title="Seller Dashboard"
      subtitle="Grow your art & craft business"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      rightBadge={
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#FAF6F0] px-3 py-1.5 text-xs font-semibold text-[#2C2018]">
          <Store className="h-3.5 w-3.5 text-[#8B4B28]" />
          <span>{studioTitle}</span>
        </div>
      }
    >
      <EmailVerificationBanner />

      {shop?.is_suspended && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-900"
        >
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong>Your studio is currently suspended by Craftify Admin.</strong>
            {shop.suspension_reason ? ` Reason: ${shop.suspension_reason}` : ''}
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Live Seller KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatINR(Number(orderSummary.total_sales || 0))}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Total Sales
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatINR(Number(orderSummary.net_earnings || 0))}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Net Earnings (after category commission)
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {orderSummary.total_orders ?? 0}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Total Orders
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {approvedProductCount}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Active Approved Products
              </p>
            </div>
          </div>

          {/* Middle Row: Live Sales Overview Chart + Live Recent Suborders */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-7 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  Sales Overview
                </h2>
                <span className="text-xs text-slate-500">Last 6 Months</span>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesSeries}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#F1F5F9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={
                        salesSeries.some((d) => d.sales > 0)
                          ? [0, 'auto']
                          : [0, 10000]
                      }
                      tickFormatter={formatINRCompact}
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(val) => formatINR(val)} />
                    <Bar
                      dataKey="sales"
                      name="Gross Sales"
                      fill="#4A7CE0"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={34}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="xl:col-span-5 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  Recent Orders
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4A7CE0] hover:underline"
                >
                  <span>View All</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {suborders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <ShoppingCart className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    No orders received yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">
                    Once buyers order your approved crafts, your split Seller Suborders will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {suborders.slice(0, 4).map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="w-full text-left py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-lg px-1.5 -mx-1.5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-900 truncate">
                          {sub.suborder_number}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {sub.buyer_name} · {sub.items?.length || 0} item
                          {(sub.items?.length || 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                          {formatINR(Number(sub.net_seller_amount))}
                        </p>
                        <p className="text-[11px] font-semibold text-teal-700">
                          {sub.fulfilment_status}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Live Your Shop Card + Quick Actions */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-6 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">Your Shop</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('shop')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4A7CE0] hover:underline"
                >
                  <span>Manage Shop</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FAF6F0] border border-[#EAE1D5] text-[#8B4B28] shrink-0">
                  <Store className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {shopLoading ? 'Loading studio...' : studioTitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {shop
                      ? `${shop.primary_category || 'Handmade Crafts'} · ${shop.city}, ${shop.state}`
                      : user?.email}
                  </p>
                  {shop && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-700">
                      {shop.is_suspended ? 'Suspended' : 'Verified Craftify Studio'} ·
                      Slug: <span className="font-mono">{shop.slug}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-6 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <h2 className="text-base font-bold text-slate-900 mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpenComposerOnProductsTab(true);
                    setActiveTab('products');
                  }}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#F3F7FD] border border-blue-100 px-3 py-4 text-xs font-semibold text-slate-800 hover:border-[#4A7CE0] transition-colors"
                >
                  <PlusSquare className="h-5 w-5 text-[#4A7CE0]" />
                  <span>Add Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#F3F7FD] border border-blue-100 px-3 py-4 text-xs font-semibold text-slate-800 hover:border-[#4A7CE0] transition-colors"
                >
                  <ShoppingCart className="h-5 w-5 text-[#4A7CE0]" />
                  <span>View Orders</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('shop')}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#F3F7FD] border border-blue-100 px-3 py-4 text-xs font-semibold text-slate-800 hover:border-[#4A7CE0] transition-colors"
                >
                  <ClipboardList className="h-5 w-5 text-[#4A7CE0]" />
                  <span>Update Shop</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Week 4 My Shop Profile Editor */}
      {activeTab === 'shop' && (
        <div className="max-w-3xl rounded-xl bg-white border border-slate-200/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                My Studio Profile
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live PostgreSQL profile linked to your approved Seller account
              </p>
            </div>
            {shop?.bank_account_masked && (
              <span className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700">
                Payout Bank: {shop.bank_account_masked}
              </span>
            )}
          </div>

          {shopMessage && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-medium ${
                shopMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {shopMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{shopMessage.text}</span>
            </div>
          )}

          {shopLoading ? (
            <p className="py-8 text-sm text-slate-500">Loading your shop profile...</p>
          ) : !shop ? (
            <p className="py-8 text-sm text-slate-600">
              No `SellerProfile` record was found for this account yet.
            </p>
          ) : (
            <form onSubmit={handleSaveShop} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shop Name
                  </label>
                  <input
                    required
                    value={shopForm.shop_name}
                    onChange={(e) =>
                      setShopForm({ ...shopForm, shop_name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Craft Category
                  </label>
                  {categories.length > 0 ? (
                    <select
                      value={shopForm.primary_category}
                      onChange={(e) =>
                        setShopForm({
                          ...shopForm,
                          primary_category: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                    >
                      {!categories.some((c) => c.name === shopForm.primary_category) &&
                        shopForm.primary_category && (
                          <option value={shopForm.primary_category}>
                            {shopForm.primary_category}
                          </option>
                        )}
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={shopForm.primary_category}
                      onChange={(e) =>
                        setShopForm({
                          ...shopForm,
                          primary_category: e.target.value,
                        })
                      }
                      placeholder="e.g., Pottery & Ceramics"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Artisan Studio Story &amp; Bio
                </label>
                <textarea
                  rows={3}
                  value={shopForm.description}
                  onChange={(e) =>
                    setShopForm({ ...shopForm, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pickup Street Address
                </label>
                <input
                  value={shopForm.pickup_line1}
                  onChange={(e) =>
                    setShopForm({ ...shopForm, pickup_line1: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    value={shopForm.city}
                    onChange={(e) =>
                      setShopForm({ ...shopForm, city: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    value={shopForm.state}
                    onChange={(e) =>
                      setShopForm({ ...shopForm, state: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pincode
                  </label>
                  <input
                    maxLength={6}
                    value={shopForm.pickup_pincode}
                    onChange={(e) =>
                      setShopForm({ ...shopForm, pickup_pincode: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Update Bank Account (Leave blank to keep {shop.bank_account_masked || 'current'})
                  </label>
                  <input
                    value={shopForm.bank_account_number}
                    onChange={(e) =>
                      setShopForm({
                        ...shopForm,
                        bank_account_number: e.target.value,
                      })
                    }
                    placeholder="Enter new account number to replace"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    IFSC Code
                  </label>
                  <input
                    maxLength={11}
                    value={shopForm.ifsc_code}
                    onChange={(e) =>
                      setShopForm({
                        ...shopForm,
                        ifsc_code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-[#2E9A90]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingShop}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2E9A90] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingShop ? 'Saving...' : 'Save Studio Profile'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Live Week 8 Seller Suborders Fulfilment Tab */}
      {activeTab === 'orders' && (
        <SellerOrdersTab
          suborders={suborders}
          statusFilter={orderStatusFilter}
          onStatusFilterChange={setOrderStatusFilter}
          loading={ordersLoading}
          onRefresh={() => loadSellerSuborders(orderStatusFilter)}
        />
      )}

      {/* Live Week 5 Seller Products & Inventory Manager */}
      {activeTab === 'products' && (
        <SellerProductsTab
          products={products}
          categories={categories}
          statusFilter={productStatusFilter}
          onStatusFilterChange={setProductStatusFilter}
          loading={productsLoading}
          shopSuspended={Boolean(shop?.is_suspended)}
          openComposerInitially={openComposerOnProductsTab}
          onCloseInitialComposer={() => setOpenComposerOnProductsTab(false)}
          onRefresh={() => loadSellerProducts(productStatusFilter)}
        />
      )}

      {activeTab === 'settings' && <AccountSecurityPanel />}

      {['earnings', 'reviews'].includes(activeTab) && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            Seller {activeTab}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            No mock records are shown here. Real PostgreSQL APIs for this section
            are scheduled in your Craftify roadmap (Week 10: Earnings, Week 11:
            Reviews).
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="mt-4 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75]"
          >
            Back to Seller Overview
          </button>
        </div>
      )}
    </DashboardShell>
  );
}
