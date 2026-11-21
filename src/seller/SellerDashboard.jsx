import {
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  Package,
  PlusSquare,
  Settings,
  ShoppingCart,
  Star,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
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
import { useCart } from '../context/CartContext';
import { SELLER_DASHBOARD_DATA } from '../data/craftifyData';
import { formatINR, formatINRCompact } from '../utils/formatters';

function SuborderStatus({ status }) {
  const styles = {
    Processing: 'bg-amber-50 text-amber-700 border-amber-200',
    Shipped: 'bg-teal-50 text-teal-700 border-teal-200',
    Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${
        styles[status] || 'bg-slate-50 text-slate-700 border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

/**
 * Craftify Seller Dashboard — Faithfully matches Screen 3 of the user's mockup:
 * Dark slate sidebar, 4 KPI cards (₹75,000 / ₹63,750 / 120 / 45),
 * 6-Month Sales Bar Chart, Recent Orders list, Your Shop card, and Quick Actions.
 */
export default function SellerDashboard() {
  const { showToast } = useCart();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeframe, setTimeframe] = useState('6m');
  const [suborders, setSuborders] = useState(
    SELLER_DASHBOARD_DATA.recentSuborders
  );
  const [newProduct, setNewProduct] = useState({
    title: '',
    price: '',
    stock: '5',
    processingDays: '3',
  });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'shop', label: 'My Shop', icon: Store },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const chartData =
    timeframe === '6m'
      ? SELLER_DASHBOARD_DATA.sales6Months
      : SELLER_DASHBOARD_DATA.sales12Months;

  const markAsShipped = (suborderCode) => {
    const tracking = `DLVRY-${Math.floor(1000000 + Math.random() * 8999999)}`;
    setSuborders((prev) =>
      prev.map((order) =>
        order.suborderCode === suborderCode
          ? { ...order, status: 'Shipped', trackingNumber: tracking }
          : order
      )
    );
    showToast(`Suborder ${suborderCode} marked Shipped (${tracking})`);
  };

  const handleAddProductSubmit = (e) => {
    e.preventDefault();
    showToast(`"${newProduct.title}" submitted for Admin approval`);
    setNewProduct({ title: '', price: '', stock: '5', processingDays: '3' });
    setActiveTab('dashboard');
  };

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
          <span>{SELLER_DASHBOARD_DATA.shop.name}</span>
        </div>
      }
    >
      <EmailVerificationBanner />
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Seller KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {formatINR(SELLER_DASHBOARD_DATA.kpis.totalSales)}
                </p>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 tabular-nums">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {SELLER_DASHBOARD_DATA.kpis.salesDelta}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Total Sales
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {formatINR(SELLER_DASHBOARD_DATA.kpis.netEarnings)}
                </p>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 tabular-nums">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {SELLER_DASHBOARD_DATA.kpis.earningsDelta}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Net Earnings (after category commission)
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {SELLER_DASHBOARD_DATA.kpis.totalOrders}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Total Orders
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {SELLER_DASHBOARD_DATA.kpis.productsCount}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">Products</p>
            </div>
          </div>

          {/* Middle Row: Sales Overview Bar Chart + Recent Suborders */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-7 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  Sales Overview
                </h2>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  aria-label="Sales overview timeframe"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#2E9A90]"
                >
                  <option value="6m">6 Months</option>
                  <option value="12m">12 Months</option>
                </select>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatINRCompact}
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val) => formatINR(val)}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
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

            <div className="xl:col-span-5 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
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

              <div className="divide-y divide-slate-100">
                {suborders.map((order) => (
                  <div
                    key={order.suborderCode}
                    className="flex items-center justify-between gap-3 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-slate-900">
                        {order.id}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {order.item}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {formatINR(order.amount)}
                      </span>
                      <SuborderStatus status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row: Your Shop + Quick Actions (Matches Screen 3 Bottom) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-6 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">Your Shop</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('shop')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4A7CE0] hover:underline"
                >
                  <span>Edit Shop</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src={SELLER_DASHBOARD_DATA.shop.logo}
                  alt={SELLER_DASHBOARD_DATA.shop.name}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2.5">
                    <p className="font-bold text-slate-900">
                      {SELLER_DASHBOARD_DATA.shop.name}
                    </p>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {SELLER_DASHBOARD_DATA.shop.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {SELLER_DASHBOARD_DATA.shop.tagline} ·{' '}
                    {SELLER_DASHBOARD_DATA.shop.city}
                  </p>
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
                  onClick={() => setActiveTab('products')}
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

      {/* Seller Suborders Fulfilment Tab */}
      {activeTab === 'orders' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Seller-Specific Suborders
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            You only see items belonging to Artistic Creations. Mark orders shipped to notify buyers.
          </p>

          <div className="mt-5 divide-y divide-slate-100">
            {suborders.map((order) => (
              <div
                key={order.suborderCode}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {order.suborderCode} · {order.buyerName}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {order.item} · Gross {formatINR(order.amount)} · Net{' '}
                    <strong className="font-mono">{formatINR(order.netAmount)}</strong>
                  </p>
                  {order.trackingNumber && (
                    <p className="text-xs font-mono text-teal-700 mt-1">
                      Tracking: {order.trackingNumber}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <SuborderStatus status={order.status} />
                  {order.status === 'Processing' && (
                    <button
                      type="button"
                      onClick={() => markAsShipped(order.suborderCode)}
                      className="rounded-lg bg-[#2E9A90] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75]"
                    >
                      Mark Shipped
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Product Tab */}
      {activeTab === 'products' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6 max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900">
            Upload New Handmade Product
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            New products enter PENDING_APPROVAL until vetted by a Craftify Admin.
          </p>

          <form onSubmit={handleAddProductSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name
              </label>
              <input
                required
                value={newProduct.title}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, title: e.target.value })
                }
                placeholder="e.g., Hand-Painted Terracotta Lamp"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Price (INR ₹)
                </label>
                <input
                  required
                  type="number"
                  min="50"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                  placeholder="1499"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#2E9A90]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inventory Qty
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={newProduct.stock}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, stock: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#2E9A90]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Processing Days
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={newProduct.processingDays}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      processingDays: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#2E9A90]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-[#8B4B28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E]"
            >
              Submit Product for Approval
            </button>
          </form>
        </div>
      )}

      {activeTab === 'settings' && <AccountSecurityPanel />}

      {['shop', 'earnings', 'reviews'].includes(activeTab) && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            Seller {activeTab}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Connected to the modular Django API plan in{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              docs/04_API_SPEC_AND_PERMISSIONS.md
            </code>
            . Ready for incremental backend wiring across Weeks 4–10.
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
