import { LogOut, Menu, Search, Store, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CraftifyLogo from '../common/CraftifyLogo';
import NotificationBell from '../common/NotificationBell';

/**
 * Shared dark charcoal-slate sidebar (#242B33) + signature teal active item (#2E9A90)
 * matching both the Admin Dashboard and Seller Dashboard mockups.
 */
export default function DashboardShell({
  title,
  subtitle,
  navItems,
  activeTab,
  onSelectTab,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  rightBadge,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#242B33] text-slate-200">
      <div className="flex items-center justify-between px-6 h-16 border-b border-white/10">
        <CraftifyLogo variant="dark" to="/" />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-1 text-slate-300 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#2E9A90] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-[#2E3741] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.badge > 0 && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          to="/"
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2E3741] hover:text-white transition-colors"
        >
          <Store className="h-4 w-4 shrink-0" />
          <span>View Storefront</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2E3741] hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/50"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-64 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden sm:block text-xs text-slate-500 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {onSearchChange && (
              <div className="relative hidden md:block w-64">
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-[#F8FAFC] pl-3.5 pr-9 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2E9A90] focus:bg-white transition-colors"
                />
                <Search className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            <NotificationBell />
            {rightBadge}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
