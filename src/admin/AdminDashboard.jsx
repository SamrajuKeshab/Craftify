import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  Package,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Store,
  Tag,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import {
  fetchAdminCategories,
  fetchAdminProducts,
} from '../services/catalogService';
import {
  downloadVerificationDocument,
  extractServiceError,
  fetchAdminAuditLogs,
  fetchAdminBuyers,
  fetchAdminDashboard,
  fetchAdminSellerApplications,
  fetchAdminSellers,
  reviewSellerApplication,
  toggleSellerSuspend,
  toggleUserActive,
} from '../services/sellerService';
import { fetchAdminCoupons } from '../services/commerceService';
import { fetchAdminFinance } from '../services/financeService';
import {
  fetchAdminOrders,
  fetchAdminPayments,
} from '../services/ordersService';
import { formatINR, formatINRCompact } from '../utils/formatters';
import AdminCategoriesTab from './AdminCategoriesTab';
import AdminCouponsTab from './AdminCouponsTab';
import AdminFinanceTab from './AdminFinanceTab';
import AdminOrdersTab from './AdminOrdersTab';
import AdminPaymentsTab from './AdminPaymentsTab';
import AdminProductsTab from './AdminProductsTab';

const EMPTY_ADMIN_SERIES = [
  { month: 'Jan', thisMonth: 0 },
  { month: 'Feb', thisMonth: 0 },
  { month: 'Mar', thisMonth: 0 },
  { month: 'Apr', thisMonth: 0 },
  { month: 'May', thisMonth: 0 },
  { month: 'Jun', thisMonth: 0 },
];

/**
 * Craftify Admin Dashboard (Week 4 Live Governance):
 * Connected to PostgreSQL for real Buyer/Seller KPIs, Seller Application Approvals,
 * Approved Seller Suspension, Buyer Account Controls, and Immutable Audit Logs.
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  // Live Admin state from PostgreSQL
  const [dashboard, setDashboard] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appStatusFilter, setAppStatusFilter] = useState('PENDING');
  const [sellersSubTab, setSellersSubTab] = useState('applications');
  const [sellers, setSellers] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productStatusFilter, setProductStatusFilter] = useState('PENDING');
  const [coupons, setCoupons] = useState([]);
  const [couponStatusFilter, setCouponStatusFilter] = useState('ALL');
  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [payments, setPayments] = useState([]);
  const [paymentProviderFilter, setPaymentProviderFilter] = useState('ALL');
  const [financeData, setFinanceData] = useState(null);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('ALL');
  const [refundStatusFilter, setRefundStatusFilter] = useState('ALL');
  const [ledgerEntryFilter, setLedgerEntryFilter] = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [reviewNotesMap, setReviewNotesMap] = useState({});

  const loadDashboardOverview = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminDashboard();
      setDashboard(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load Admin dashboard summary.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSellerApplications = async (statusFilter = appStatusFilter, search = searchTerm) => {
    setLoading(true);
    try {
      const data = await fetchAdminSellerApplications({
        status: statusFilter === 'ALL' ? '' : statusFilter,
        search,
      });
      setApplications(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load seller applications.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSellersDirectory = async (search = searchTerm) => {
    setLoading(true);
    try {
      const data = await fetchAdminSellers(search);
      setSellers(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load approved sellers.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBuyersDirectory = async (search = searchTerm) => {
    setLoading(true);
    try {
      const data = await fetchAdminBuyers(search);
      setBuyers(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load buyers directory.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminAuditLogs();
      setAuditLogs(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load audit logs.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async (search = searchTerm) => {
    setLoading(true);
    try {
      const data = await fetchAdminCategories(search);
      setCategories(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load craft categories.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminProducts = async (
    statusFilter = productStatusFilter,
    search = searchTerm
  ) => {
    setLoading(true);
    try {
      const data = await fetchAdminProducts({
        status: statusFilter === 'ALL' ? '' : statusFilter,
        search,
      });
      setProducts(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load seller products.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminCoupons = async (
    statusFilter = couponStatusFilter,
    search = searchTerm
  ) => {
    setLoading(true);
    try {
      const data = await fetchAdminCoupons({
        status: statusFilter === 'ALL' ? '' : statusFilter,
        search,
      });
      setCoupons(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load platform coupons.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminOrders = async (
    statusFilter = orderStatusFilter,
    search = searchTerm
  ) => {
    setLoading(true);
    try {
      const data = await fetchAdminOrders({
        status: statusFilter === 'ALL' ? '' : statusFilter,
        search,
      });
      setOrders(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load platform orders.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminPayments = async (
    providerFilter = paymentProviderFilter,
    search = searchTerm
  ) => {
    setLoading(true);
    try {
      const data = await fetchAdminPayments({
        provider: providerFilter === 'ALL' ? '' : providerFilter,
        search,
      });
      setPayments(data.results || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load payment records.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminFinance = async (
    payoutStatus = payoutStatusFilter,
    refundStatus = refundStatusFilter,
    entryType = ledgerEntryFilter,
    search = searchTerm
  ) => {
    setLoading(true);
    try {
      const data = await fetchAdminFinance({
        payoutStatus,
        refundStatus,
        entryType,
        search,
      });
      setFinanceData(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Failed to load financial ledger & payouts.'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'sellers') {
      if (sellersSubTab === 'applications') {
        loadSellerApplications(appStatusFilter, searchTerm);
      } else {
        loadSellersDirectory(searchTerm);
      }
    } else if (activeTab === 'buyers') {
      loadBuyersDirectory(searchTerm);
    } else if (activeTab === 'categories') {
      loadCategories(searchTerm);
    } else if (activeTab === 'products') {
      loadAdminProducts(productStatusFilter, searchTerm);
    } else if (activeTab === 'coupons') {
      loadAdminCoupons(couponStatusFilter, searchTerm);
    } else if (activeTab === 'orders') {
      loadAdminOrders(orderStatusFilter, searchTerm);
    } else if (activeTab === 'payments') {
      loadAdminPayments(paymentProviderFilter, searchTerm);
    } else if (activeTab === 'finance') {
      loadAdminFinance(
        payoutStatusFilter,
        refundStatusFilter,
        ledgerEntryFilter,
        searchTerm
      );
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    sellersSubTab,
    appStatusFilter,
    productStatusFilter,
    couponStatusFilter,
    orderStatusFilter,
    paymentProviderFilter,
    payoutStatusFilter,
    refundStatusFilter,
    ledgerEntryFilter,
    searchTerm,
  ]);

  const handleReviewApplication = async (appId, action) => {
    const notes = (reviewNotesMap[appId] || '').trim();
    if (action === 'REJECT' && !notes) {
      setFeedback({
        type: 'error',
        text: 'Please enter a short review note explaining why the application is rejected.',
      });
      return;
    }
    setActionBusyId(appId);
    setFeedback(null);
    try {
      const res = await reviewSellerApplication(appId, {
        action,
        reviewNotes: notes,
      });
      setFeedback({ type: 'success', text: res.detail });
      await Promise.all([
        loadDashboardOverview(),
        loadSellerApplications(appStatusFilter, searchTerm),
      ]);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not process application decision.'),
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleSellerSuspend = async (seller) => {
    setActionBusyId(seller.id);
    setFeedback(null);
    try {
      const res = await toggleSellerSuspend(
        seller.id,
        seller.is_suspended ? '' : 'Suspended by Craftify Admin for review'
      );
      setFeedback({ type: 'success', text: res.detail });
      await Promise.all([loadDashboardOverview(), loadSellersDirectory(searchTerm)]);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update seller suspension status.'),
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleBuyerActive = async (buyer) => {
    setActionBusyId(buyer.id);
    setFeedback(null);
    try {
      const res = await toggleUserActive(
        buyer.id,
        buyer.is_active ? 'Account suspended by Craftify Admin' : ''
      );
      setFeedback({ type: 'success', text: res.detail });
      await Promise.all([loadDashboardOverview(), loadBuyersDirectory(searchTerm)]);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update user account status.'),
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const pendingSellerCount =
    dashboard?.pending_approvals?.seller_applications ?? 0;
  const pendingProductCount =
    dashboard?.pending_approvals?.product_approvals ?? 0;
  const pendingFinanceCount =
    (dashboard?.pending_approvals?.pending_payouts ?? 0) +
    (dashboard?.pending_approvals?.pending_refunds ?? 0);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'sellers',
      label: 'Sellers',
      icon: Store,
      badge: pendingSellerCount || undefined,
    },
    { id: 'buyers', label: 'Buyers', icon: Users },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      badge: pendingProductCount || undefined,
    },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    {
      id: 'finance',
      label: 'Finance & Payouts',
      icon: Wallet,
      badge: pendingFinanceCount || undefined,
    },
    { id: 'audit', label: 'Audit Logs', icon: ScrollText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: formatINR(Number(dashboard?.kpis?.total_revenue || 0)),
      icon: Wallet,
      iconBg: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Total Orders',
      value: String(dashboard?.kpis?.total_orders ?? 0),
      icon: ShoppingCart,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total Buyers',
      value: String(dashboard?.kpis?.total_buyers ?? 0),
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Sellers',
      value: String(dashboard?.kpis?.total_sellers ?? 0),
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
      searchPlaceholder="Search sellers, buyers, shop names..."
      rightBadge={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              loadDashboardOverview();
              if (activeTab === 'sellers') {
                sellersSubTab === 'applications'
                  ? loadSellerApplications()
                  : loadSellersDirectory();
              } else if (activeTab === 'categories') {
                loadCategories();
              } else if (activeTab === 'products') {
                loadAdminProducts();
              } else if (activeTab === 'coupons') {
                loadAdminCoupons();
              } else if (activeTab === 'orders') {
                loadAdminOrders();
              } else if (activeTab === 'payments') {
                loadAdminPayments();
              } else if (activeTab === 'buyers') {
                loadBuyersDirectory();
              } else if (activeTab === 'audit') {
                loadAuditLogs();
              }
            }}
            title="Refresh live data"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B4B28] text-xs font-bold text-white">
            {adminInitial}
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-slate-700">
            {user?.full_name || user?.username}
          </span>
        </div>
      }
    >
      {feedback && (
        <div
          role="status"
          className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
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

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-base font-bold text-slate-900">
                  Sales Overview
                </h2>
                <span className="text-xs text-slate-500">
                  Live Last 6 Months GMV (PostgreSQL)
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={
                      dashboard?.sales_series?.length
                        ? dashboard.sales_series
                        : EMPTY_ADMIN_SERIES
                    }
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
                      domain={
                        (dashboard?.sales_series || []).some((d) => d.thisMonth > 0)
                          ? [0, 'auto']
                          : [0, 10000]
                      }
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
                    <span
                      className={`font-mono text-base font-bold tabular-nums ${
                        pendingSellerCount > 0 ? 'text-[#8B4B28]' : 'text-slate-900'
                      }`}
                    >
                      {pendingSellerCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-600">
                      Product Approvals
                    </span>
                    <span
                      className={`font-mono text-base font-bold tabular-nums ${
                        pendingProductCount > 0 ? 'text-[#8B4B28]' : 'text-slate-900'
                      }`}
                    >
                      {pendingProductCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (pendingProductCount > 0 && pendingSellerCount === 0) {
                      setProductStatusFilter('PENDING');
                      setActiveTab('products');
                    } else {
                      setSellersSubTab('applications');
                      setAppStatusFilter('PENDING');
                      setActiveTab('sellers');
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8B4B28] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#733C1E] transition-colors"
                >
                  <span>
                    {pendingSellerCount > 0
                      ? `Review ${pendingSellerCount} Seller Application${pendingSellerCount > 1 ? 's' : ''}`
                      : pendingProductCount > 0
                      ? `Moderate ${pendingProductCount} Pending Product${pendingProductCount > 1 ? 's' : ''}`
                      : 'Open Moderation Queue'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                {pendingProductCount > 0 && pendingSellerCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductStatusFilter('PENDING');
                      setActiveTab('products');
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90] transition-colors"
                  >
                    <span>
                      Moderate {pendingProductCount} Pending Product
                      {pendingProductCount > 1 ? 's' : ''}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Recent Governance & Audit Activity */}
          <div className="rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Recent Governance &amp; Onboarding Activity
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E9A90] hover:underline"
              >
                <span>View Full Audit Log</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {!dashboard?.recent_audit_logs?.length ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No onboarding or governance events recorded yet. Once buyers apply
                to become sellers, every submission and review appears here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {dashboard.recent_audit_logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-[#2E9A90]">
                        {log.action}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-700">{log.summary}</span>
                    </div>
                    <span className="text-slate-400 font-mono">
                      @{log.actor_username} ·{' '}
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE SELLERS & APPLICATION APPROVALS (WEEK 4) */}
      {activeTab === 'sellers' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setSellersSubTab('applications')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  sellersSubTab === 'applications'
                    ? 'bg-[#2E9A90] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Seller Applications ({pendingSellerCount} Pending)
              </button>
              <button
                type="button"
                onClick={() => setSellersSubTab('directory')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  sellersSubTab === 'directory'
                    ? 'bg-[#2E9A90] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Approved Studios ({dashboard?.kpis?.total_sellers ?? sellers.length})
              </button>
            </div>

            {sellersSubTab === 'applications' && (
              <div className="flex flex-wrap gap-1.5">
                {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAppStatusFilter(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                      appStatusFilter === st
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {sellersSubTab === 'applications' && (
            <div className="space-y-4">
              {loading && applications.length === 0 ? (
                <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-500">
                  Loading seller applications from PostgreSQL...
                </div>
              ) : applications.length === 0 ? (
                <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center">
                  <ClipboardCheck className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    No {appStatusFilter === 'ALL' ? '' : appStatusFilter.toLowerCase()}{' '}
                    seller applications found
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Verified buyers who submit the Become a Seller form appear here
                    immediately for review.
                  </p>
                </div>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {app.shop_name}
                          </h3>
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                              app.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : app.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Applicant: <strong>{app.applicant_full_name}</strong> (@
                          {app.applicant_username}) · {app.applicant_email}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {new Date(app.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg bg-slate-50 border border-slate-100 p-3.5 text-xs">
                      <div>
                        <span className="text-slate-400 block">Category</span>
                        <span className="font-semibold text-slate-800">
                          {app.primary_category}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Pickup Location</span>
                        <span className="font-semibold text-slate-800">
                          {app.city}, {app.state} ({app.pincode})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">PAN / GSTIN</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {app.pan_number}
                          {app.gstin ? ` · ${app.gstin}` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Payout Bank</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {app.bank_account_masked || 'Not provided'}
                          {app.ifsc_code ? ` (${app.ifsc_code})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold text-slate-900">
                        Pickup Address:{' '}
                      </span>
                      {app.pickup_address}
                      <p className="mt-1.5">
                        <span className="font-semibold text-slate-900">
                          Craft Story:{' '}
                        </span>
                        {app.bio}
                      </p>
                    </div>

                    {app.documents?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {app.documents.map((doc) => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() =>
                              downloadVerificationDocument(
                                doc.id,
                                doc.original_filename
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>
                              Download {doc.doc_type}: {doc.original_filename}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {app.status === 'PENDING' ? (
                      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={reviewNotesMap[app.id] || ''}
                          onChange={(e) =>
                            setReviewNotesMap((prev) => ({
                              ...prev,
                              [app.id]: e.target.value,
                            }))
                          }
                          placeholder="Review notes (required for rejection, optional for approval)..."
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={actionBusyId === app.id}
                            onClick={() => handleReviewApplication(app.id, 'APPROVE')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve &amp; Promote</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionBusyId === app.id}
                            onClick={() => handleReviewApplication(app.id, 'REJECT')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                        Reviewed by <strong>@{app.reviewed_by_username || 'admin'}</strong>
                        {app.review_notes ? ` — "${app.review_notes}"` : ''}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {sellersSubTab === 'directory' && (
            <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
              {sellers.length === 0 ? (
                <div className="p-10 text-center">
                  <Store className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    No approved seller studios yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Approve a pending seller application to create a verified studio.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Studio</th>
                        <th className="px-4 py-3 font-semibold">Owner</th>
                        <th className="px-4 py-3 font-semibold">Location</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sellers.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {s.shop_name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {s.primary_category}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">
                              {s.owner_full_name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              @{s.owner_username}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {s.city}, {s.state}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                                s.is_suspended
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {s.is_suspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={actionBusyId === s.id}
                              onClick={() => handleToggleSellerSuspend(s)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                                s.is_suspended
                                  ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-red-200 text-red-700 hover:bg-red-50'
                              }`}
                            >
                              {s.is_suspended ? 'Reinstate Studio' : 'Suspend Studio'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE BUYERS DIRECTORY */}
      {activeTab === 'buyers' && (
        <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Registered Buyers ({buyers.length})
              </h2>
              <p className="text-xs text-slate-500">
                Live accounts stored in PostgreSQL
              </p>
            </div>
          </div>

          {buyers.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No buyer accounts found matching your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Buyer</th>
                    <th className="px-4 py-3 font-semibold">Email Verified</th>
                    <th className="px-4 py-3 font-semibold">Seller App</th>
                    <th className="px-4 py-3 font-semibold">Account Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buyers.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{b.full_name}</p>
                        <p className="text-[11px] text-slate-500">
                          @{b.username} · {b.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            b.is_email_verified
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {b.is_email_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {b.latest_application_status || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            b.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {b.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={actionBusyId === b.id}
                          onClick={() => handleToggleBuyerActive(b)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                            b.is_active
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {b.is_active ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE IMMUTABLE AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Immutable Security &amp; Governance Audit Logs
              </h2>
              <p className="text-xs text-slate-500">
                Append-only PostgreSQL trail of every seller application, approval,
                rejection, and account suspension
              </p>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-10 text-center">
              <ShieldAlert className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No audit entries recorded yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-[#2E9A90]">
                      {log.action}
                    </span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-slate-800">{log.summary}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 shrink-0">
                    @{log.actor_username} ({log.actor_role}) ·{' '}
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LIVE CRAFT CATEGORIES & COMMISSION SCHEDULE (WEEK 5) */}
      {activeTab === 'categories' && (
        <AdminCategoriesTab
          categories={categories}
          loading={loading}
          onRefresh={async () => {
            await Promise.all([loadDashboardOverview(), loadCategories(searchTerm)]);
          }}
          onFeedback={setFeedback}
        />
      )}

      {/* TAB 6: LIVE PRODUCT MODERATION QUEUE (WEEK 5) */}
      {activeTab === 'products' && (
        <AdminProductsTab
          products={products}
          statusFilter={productStatusFilter}
          onStatusFilterChange={setProductStatusFilter}
          loading={loading}
          onRefresh={async () => {
            await Promise.all([
              loadDashboardOverview(),
              loadAdminProducts(productStatusFilter, searchTerm),
            ]);
          }}
          onFeedback={setFeedback}
        />
      )}

      {/* TAB 7: LIVE PLATFORM COUPONS (WEEK 7) */}
      {activeTab === 'coupons' && (
        <AdminCouponsTab
          coupons={coupons}
          statusFilter={couponStatusFilter}
          onStatusFilterChange={setCouponStatusFilter}
          loading={loading}
          onRefresh={async () => {
            await Promise.all([
              loadDashboardOverview(),
              loadAdminCoupons(couponStatusFilter, searchTerm),
            ]);
          }}
          onFeedback={setFeedback}
        />
      )}

      {/* TAB 8: LIVE PLATFORM ORDERS (WEEK 8) */}
      {activeTab === 'orders' && (
        <AdminOrdersTab
          orders={orders}
          statusFilter={orderStatusFilter}
          onStatusFilterChange={setOrderStatusFilter}
          loading={loading}
        />
      )}

      {/* TAB 9: LIVE PAYMENT LEDGER (WEEK 8) */}
      {activeTab === 'payments' && (
        <AdminPaymentsTab
          payments={payments}
          providerFilter={paymentProviderFilter}
          onProviderFilterChange={setPaymentProviderFilter}
          loading={loading}
        />
      )}

      {/* TAB 10: LIVE FINANCIAL LEDGER, REFUNDS & SELLER PAYOUTS (WEEK 10) */}
      {activeTab === 'finance' && (
        <AdminFinanceTab
          financeData={financeData}
          payoutStatusFilter={payoutStatusFilter}
          onPayoutStatusFilterChange={setPayoutStatusFilter}
          refundStatusFilter={refundStatusFilter}
          onRefundStatusFilterChange={setRefundStatusFilter}
          entryTypeFilter={ledgerEntryFilter}
          onEntryTypeFilterChange={setLedgerEntryFilter}
          loading={loading}
          onRefresh={async () => {
            await Promise.all([
              loadDashboardOverview(),
              loadAdminFinance(
                payoutStatusFilter,
                refundStatusFilter,
                ledgerEntryFilter,
                searchTerm
              ),
            ]);
          }}
          onFeedback={setFeedback}
        />
      )}

      {activeTab === 'settings' && <AccountSecurityPanel />}

      {activeTab === 'reports' && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Admin Reports &amp; Exports
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            No fake placeholder records are shown here. Deep analytics dashboards
            and notification reports connect in Week 11 of our roadmap.
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
