import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AccountSecurityPanel from '../components/dashboards/AccountSecurityPanel';
import DashboardShell from '../components/dashboards/DashboardShell';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatINRCompact } from '../utils/formatters';

const EMPTY_ADMIN_SERIES = [
  { month: 'Jan', thisMonth: 0 },
  { month: 'Feb', thisMonth: 0 },
  { month: 'Mar', thisMonth: 0 },
  { month: 'Apr', thisMonth: 0 },
  { month: 'May', thisMonth: 0 },
  { month: 'Jun', thisMonth: 0 },
];

/**
 * Craftify Admin Dashboard — Displays authenticated Admin identity and honest
 * zero/empty states until Weeks 4–11 backend APIs populate live PostgreSQL metrics.
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sellers', label: 'Sellers', icon: Store },
    { id: 'buyers', label: 'Buyers', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: formatINR(0),
      icon: Wallet,
      iconBg: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Total Orders',
      value: '0',
      icon: ShoppingCart,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total Buyers',
      value: '0',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Sellers',
      value: '0',
      icon: Store,
      iconBg: 'bg-orange-50 text-orange-600',
    },
  ];

  const adminInitial = (user?.full_name || user?.username || 'A')
    .charAt(0)
    .toUpperCase();

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
            {adminInitial}
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-slate-700">
            {user?.full_name || user?.username}
          </span>
        </div>
      }
    >
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Honest Zero-Baseline KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-xl bg-white border border-slate-200/80 p-5"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}
                  >
                    <Icon className="h-4 w-4" />
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

          {/* Analytics Row: Sales Overview Chart + Pending Approvals Card */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  Sales Overview
                </h2>
                <span className="text-xs text-slate-500">
                  Live metrics populate as orders flow in
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={EMPTY_ADMIN_SERIES}
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
                      domain={[0, 10000]}
                      tickFormatter={formatINRCompact}
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(val) => formatINR(val)} />
                    <Line
                      type="monotone"
                      dataKey="thisMonth"
                      name="Monthly Revenue"
                      stroke="#4A7CE0"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#4A7CE0' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

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
                      0
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-600">
                      Product Approvals
                    </span>
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      0
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('sellers')}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B4B28] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
              >
                <span>Open Moderation Queue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Empty Recent Orders State */}
          <div className="rounded-xl bg-white border border-slate-200/80 p-8 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 text-sm font-bold text-slate-900">
              No marketplace orders recorded yet
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Real PostgreSQL seller approvals, product moderation queues, and
              parent/suborder tables connect progressively starting in Week 4.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'settings' && <AccountSecurityPanel />}

      {['sellers', 'buyers', 'products', 'categories', 'orders', 'payments', 'reports'].includes(
        activeTab
      ) && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            Admin {activeTab} Management
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            No fake placeholder records are shown here. Live PostgreSQL APIs for{' '}
            <strong>{activeTab}</strong> will be built in upcoming modules (Week 4:
            Sellers &amp; Buyers, Week 5: Categories &amp; Products, Weeks 8–11:
            Orders, Payments &amp; Reports).
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
