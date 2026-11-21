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
import { useAuth } from '../context/AuthContext';
import { formatINR, formatINRCompact } from '../utils/formatters';

const EMPTY_SALES_6M = [
  { month: 'Jan', sales: 0 },
  { month: 'Feb', sales: 0 },
  { month: 'Mar', sales: 0 },
  { month: 'Apr', sales: 0 },
  { month: 'May', sales: 0 },
  { month: 'Jun', sales: 0 },
];

/**
 * Craftify Seller Dashboard — Shows real authenticated seller identity and honest
 * zero/empty states until Weeks 4–10 backend APIs (shop, products, suborders, earnings) are wired.
 */
export default function SellerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [suborders] = useState([]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'shop', label: 'My Shop', icon: Store },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

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
          <span>{user?.full_name || user?.username}</span>
        </div>
      }
    >
      <EmailVerificationBanner />

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Honest Zero-Baseline KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatINR(0)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Total Sales
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatINR(0)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Net Earnings (after category commission)
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                0
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Total Orders
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/80 p-5">
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                0
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Active Products
              </p>
            </div>
          </div>

          {/* Middle Row: Sales Overview Chart + Empty Recent Orders */}
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
                    data={EMPTY_SALES_6M}
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
                      domain={[0, 10000]}
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

              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <ShoppingCart className="h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  No orders received yet
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Seller-specific suborders from PostgreSQL will appear here once
                  products and orders go live (Weeks 5 &amp; 8).
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row: Your Shop + Quick Actions */}
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
                <div>
                  <p className="font-bold text-slate-900">
                    {user?.full_name || user?.username}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {user?.email} · Shop profile settings connect to Django in Week 4
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

      {activeTab === 'orders' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
          <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-900">
            No Seller Suborders Yet ({suborders.length})
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Multi-vendor suborder fulfilment connects to PostgreSQL in Weeks 8–9.
          </p>
        </div>
      )}

      {activeTab === 'settings' && <AccountSecurityPanel />}

      {['shop', 'products', 'earnings', 'reviews'].includes(activeTab) && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            Seller {activeTab}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            No mock records are shown here. Real PostgreSQL APIs for this section
            are scheduled in your Craftify roadmap (Week 4: Shop, Week 5: Products,
            Week 10: Earnings, Week 11: Reviews).
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
