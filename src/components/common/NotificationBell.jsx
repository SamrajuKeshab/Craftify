import { Bell, Check, CheckCheck, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationsService';

const CATEGORY_LABELS = {
  ORDER: 'Order',
  SHIPPING: 'Shipping',
  RETURN: 'Return',
  FINANCE: 'Finance',
  REVIEW: 'Review',
  GOVERNANCE: 'Governance',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const loadInbox = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setItems(data.results || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Fail quietly if offline or unauthenticated
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadInbox();
  };

  const handleMarkOne = async (notif) => {
    try {
      if (!notif.is_read) {
        const res = await markNotificationRead(notif.id);
        setUnreadCount(res.unread_count ?? Math.max(0, unreadCount - 1));
        setItems((prev) =>
          prev.map((item) =>
            item.id === notif.id ? { ...item, is_read: true } : item
          )
        );
      }
      if (notif.action_url) {
        setOpen(false);
        navigate(notif.action_url);
      }
    } catch {
      // Ignore transient error
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      // Ignore transient error
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Open notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#2E9A90] hover:text-[#2E9A90] transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#8B4B28] px-1 font-mono text-[10px] font-bold text-white tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Notifications</h3>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                {unreadCount} unread
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E9A90] hover:underline whitespace-nowrap shrink-0"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={loadInbox}
                aria-label="Refresh notifications"
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  All caught up
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Order, shipping, return, payout, and review alerts appear here.
                </p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleMarkOne(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 ${
                    n.is_read ? 'bg-white' : 'bg-[#2E9A90]/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      <span className="font-semibold text-[#2E9A90]">
                        {CATEGORY_LABELS[n.category] || n.category}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(n.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        n.is_read
                          ? 'font-medium text-slate-700'
                          : 'font-bold text-slate-900'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span
                      title="Unread"
                      className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2E9A90]/15 text-[#2E9A90] shrink-0"
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
