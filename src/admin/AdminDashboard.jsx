import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardCheck,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardShell from '../components/dashboards/DashboardShell';
import { useCart } from '../context/CartContext';
import { ADMIN_DASHBOARD_DATA, POPULAR_CATEGORIES } from '../data/craftifyData';
import { formatINR, formatINRCompact } from '../utils/formatters';

function OrderStatusLabel({ status }) {
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
 * Craftify Admin Dashboard — Faithfully matches Screen 2 of the user's mockup:
 * Dark slate sidebar, 4 KPI cards (₹2,45,000), Sales Overview dual-line chart,
 * Pending Approvals action card, Recent Orders table, and Top Categories donut chart.
 */
export default function AdminDashboard() {
  const { showToast } = useCart();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerApps, setSellerApps] = useState(
    ADMIN_DASHBOARD_DATA.pendingSellerApplications
  );
  const [pendingProducts, setPendingProducts] = useState(
    ADMIN_DASHBOARD_DATA.pendingProducts
  );
  const [categories, setCategories] = useState(POPULAR_CATEGORIES);

  const pendingSellerCount = sellerApps.filter((a) => a.status === 'PENDING').length;
  const pendingProductCount = pendingProducts.filter(
    (p) => p.status === 'PENDING'
  ).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sellers', label: 'Sellers', icon: Store, badge: pendingSellerCount },
    { id: 'buyers', label: 'Buyers', icon: Users },
    { id: 'products', label: 'Products', icon: Package, badge: pendingProductCount },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSellerDecision = (id, decision) => {
    setSellerApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: decision } : app))
    );
    showToast(
      decision === 'APPROVED'
        ? `Seller application ${id} approved`
        : `Seller application ${id} rejected`
    );
  };

  const handleProductDecision = (id, decision) => {
    setPendingProducts((prev) =>
      prev.map((prod) => (prod.id === id ? { ...prod, status: decision } : prod))
    );
    showToast(
      decision === 'APPROVED'
        ? `Product ${id} approved for storefront`
        : `Product ${id} rejected`
    );
  };

  const handleCommissionChange = (catId, newRate) => {
    const parsed = Math.max(0, Math.min(40, Number(newRate) || 0));
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === catId ? { ...cat, commissionRate: parsed } : cat
      )
    );
  };

  const filteredOrders = ADMIN_DASHBOARD_DATA.recentOrders.filter((order) => {
    const q = searchTerm.trim().toLowerCase();
    return (
      !q ||
      order.id.toLowerCase().includes(q) ||
      order.customer.toLowerCase().includes(q) ||
      order.status.toLowerCase().includes(q)
    );
  });

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: formatINR(ADMIN_DASHBOARD_DATA.kpis.totalRevenue),
      delta: ADMIN_DASHBOARD_DATA.kpis.revenueDelta,
      icon: Wallet,
      iconBg: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Total Orders',
      value: ADMIN_DASHBOARD_DATA.kpis.totalOrders.toLocaleString('en-IN'),
      delta: ADMIN_DASHBOARD_DATA.kpis.ordersDelta,
      icon: ShoppingCart,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total Buyers',
      value: ADMIN_DASHBOARD_DATA.kpis.totalBuyers.toLocaleString('en-IN'),
      delta: ADMIN_DASHBOARD_DATA.kpis.buyersDelta,
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Sellers',
      value: ADMIN_DASHBOARD_DATA.kpis.totalSellers.toLocaleString('en-IN'),
      delta: ADMIN_DASHBOARD_DATA.kpis.sellersDelta,
      icon: Store,
      iconBg: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="Overview of your marketplace"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Search orders, sellers, buyers..."
      rightBadge={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B4B28] text-xs font-bold text-white">
            A
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-slate-700">
            Admin
          </span>
        </div>
      }
    >
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-xl bg-white border border-slate-200/80 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 tabular-nums">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {card.delta}
                    </span>
                  </div>
                  <p className="mt-4 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {card.value}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {card.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Analytics Row: Sales Overview Line Chart + Pending Approvals Card */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  Sales Overview
                </h2>
                <div className="flex items-center gap-5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#4A7CE0]" />
                    This Month
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                    Last Month
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ADMIN_DASHBOARD_DATA.salesSeries}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
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
                    <Line
                      type="monotone"
                      dataKey="lastMonth"
                      name="Last Month"
                      stroke="#CBD5E1"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#CBD5E1' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="thisMonth"
                      name="This Month"
                      stroke="#4A7CE0"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4A7CE0' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pending Approvals Card (Matches Top-Right of Mockup Screen 2) */}
            <div className="xl:col-span-4 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Pending Approvals
                  </h2>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#4A7CE0]">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 divide-y divide-slate-100">
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-600">
                      Seller Applications
                    </span>
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      {pendingSellerCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-600">
                      Product Approvals
                    </span>
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      {pendingProductCount}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('sellers')}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B4B28] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                <span>Review Now</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom Operations Row: Recent Orders Table + Top Categories Donut */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
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

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                      <th className="py-2.5 pr-4">Order #</th>
                      <th className="py-2.5 pr-4">Customer</th>
                      <th className="py-2.5 pr-4">Payment</th>
                      <th className="py-2.5 pr-4 text-right">Amount</th>
                      <th className="py-2.5 pl-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-4 font-mono font-semibold text-slate-900">
                          {order.id}
                        </td>
                        <td className="py-3 pr-4 text-slate-700">
                          {order.customer}
                          <span className="ml-2 text-xs text-slate-400">
                            ({order.sellersCount}{' '}
                            {order.sellersCount === 1 ? 'seller' : 'sellers'})
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs font-medium text-slate-500">
                          {order.paymentMethod}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatINR(order.amount)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <OrderStatusLabel status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Categories Donut Chart */}
            <div className="xl:col-span-4 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <h2 className="text-base font-bold text-slate-900 mb-4">
                Top Categories
              </h2>
              <div className="flex flex-col sm:flex-row xl:flex-row items-center gap-4">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ADMIN_DASHBOARD_DATA.topCategories}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {ADMIN_DASHBOARD_DATA.topCategories.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="flex-1 w-full space-y-2.5 text-xs">
                  {ADMIN_DASHBOARD_DATA.topCategories.map((cat) => (
                    <li
                      key={cat.name}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {cat.value}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Seller Moderation Tab */}
      {activeTab === 'sellers' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Seller Applications &amp; Onboarding Review
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Approve verified Indian craft studios to grant Seller Panel access.
          </p>

          <div className="mt-5 divide-y divide-slate-100">
            {sellerApps.map((app) => (
              <div
                key={app.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {app.shopName}{' '}
                    <span className="font-mono text-xs text-slate-400">
                      ({app.id})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {app.applicant} · {app.city} · {app.category} · Submitted{' '}
                    {app.submittedAt}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {app.status === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSellerDecision(app.id, 'APPROVED')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#2E9A90] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75]"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSellerDecision(app.id, 'REJECTED')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${
                        app.status === 'APPROVED'
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {app.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Product Moderation Tab */}
      {activeTab === 'products' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Pending Product Approvals
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Every seller product requires Admin moderation before going live on the storefront.
          </p>

          <div className="mt-5 divide-y divide-slate-100">
            {pendingProducts.map((prod) => (
              <div
                key={prod.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">{prod.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {prod.seller} · {prod.category} ·{' '}
                    <span className="font-mono font-semibold text-slate-800">
                      {formatINR(prod.price)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {prod.status === 'PENDING' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleProductDecision(prod.id, 'APPROVED')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#2E9A90] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#247D75]"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve Listing
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProductDecision(prod.id, 'REJECTED')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${
                        prod.status === 'APPROVED'
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {prod.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Commission Management Tab */}
      {activeTab === 'categories' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Categories &amp; Platform Commission Rates
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Craftify applies category-based commissions (stored via DecimalField and snapshotted on every suborder).
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 pr-4 text-right">Active Products</th>
                  <th className="py-2.5 pl-4 text-right">Commission (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      {cat.name}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-600 tabular-nums">
                      {cat.count}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <input
                        type="number"
                        min="0"
                        max="40"
                        step="0.5"
                        value={cat.commissionRate}
                        onChange={(e) =>
                          handleCommissionChange(cat.id, e.target.value)
                        }
                        className="w-20 rounded-md border border-slate-200 px-2.5 py-1 text-right font-mono text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#2E9A90]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Remaining Admin Sections (Orders / Buyers / Payments / Reports / Settings) */}
      {['buyers', 'orders', 'payments', 'reports', 'settings'].includes(
        activeTab
      ) && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            Admin {activeTab} Management
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This module&apos;s PostgreSQL schema, `/api/v1/` endpoints, and RBAC
            permissions are documented in <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">docs/</code> and scheduled in your 12-week incremental roadmap.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="mt-4 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75]"
          >
            Back to Dashboard Overview
          </button>
        </div>
      )}
    </DashboardShell>
  );
}
