import React, { useState, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  X,
  CheckCheck,
  Trash2,
  ArrowRight,
  Filter,
  Sparkles,
  CreditCard,
  UserPlus,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { AppNotification, NotificationCategory, AppUser } from '../types';

interface DashboardNotificationsProps {
  notifications: AppNotification[];
  activeUser: AppUser | null;
  onDismissNotification: (id: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onClearAllNotifications: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const DashboardNotifications: React.FC<DashboardNotificationsProps> = ({
  notifications,
  activeUser,
  onDismissNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onNavigateTab,
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'unread' | 'payment' | 'registration'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isKetuaRt = activeUser?.authority === 'Ketua RT (Cluster)';
  const userCluster = activeUser?.cluster;

  // Filter based on Ketua RT cluster isolation if applicable
  const relevantNotifications = useMemo(() => {
    if (isKetuaRt && userCluster) {
      return notifications.filter(
        (n) => !n.cluster || n.cluster === userCluster || n.category === 'system'
      );
    }
    return notifications;
  }, [notifications, isKetuaRt, userCluster]);

  const unreadCount = useMemo(() => {
    return relevantNotifications.filter((n) => !n.read).length;
  }, [relevantNotifications]);

  const filteredNotifications = useMemo(() => {
    return relevantNotifications.filter((n) => {
      if (filterCategory === 'unread') return !n.read;
      if (filterCategory === 'payment') return n.category === 'payment';
      if (filterCategory === 'registration') return n.category === 'registration';
      return true;
    });
  }, [relevantNotifications, filterCategory]);

  const getNotificationIcon = (type: AppNotification['type'], category: NotificationCategory) => {
    if (type === 'success') {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    }
    if (type === 'error') {
      return <XCircle className="w-5 h-5 text-rose-600" />;
    }
    if (type === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }
    if (category === 'payment') {
      return <CreditCard className="w-5 h-5 text-indigo-600" />;
    }
    if (category === 'registration') {
      return <UserPlus className="w-5 h-5 text-sky-600" />;
    }
    return <Info className="w-5 h-5 text-blue-600" />;
  };

  const getBadgeStyle = (type: AppNotification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'error':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T'));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 2) return 'Baru saja';
      if (diffMin < 60) return `${diffMin} menit yang lalu`;
      if (diffHours < 24) return `${diffHours} jam yang lalu`;
      if (diffDays === 1) return 'Kemarin';
      if (diffDays < 7) return `${diffDays} hari yang lalu`;
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return timestamp;
    }
  };

  return (
    <div id="dashboard-notifications-panel" className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 relative shadow-2xs">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Pemberitahuan & Aktivitas Terkini
              </h3>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-extrabold rounded-full">
                  {unreadCount} Belum Dibaca
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold rounded-full flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" />
                  Semua Terbaca
                </span>
              )}
              {isKetuaRt && userCluster && (
                <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-lg">
                  Lingkup RT: {userCluster}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Notifikasi otomatis ketika pendaftaran disetujui, iuran diverifikasi, atau berkas diverifikasi.
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllNotificationsRead}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
              title="Tandai semua notifikasi sebagai sudah dibaca"
            >
              <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Tandai</span> Terbaca
            </button>
          )}

          {relevantNotifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAllNotifications}
              className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1"
              title="Bersihkan seluruh notifikasi"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={isExpanded ? 'Sembunyikan' : 'Tampilkan'}
          >
            <span className="text-xs font-bold px-1 text-slate-500">
              {isExpanded ? 'Tutup' : `Buka (${relevantNotifications.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Notification List */}
      {isExpanded && (
        <>
          {/* Quick Filter Chips */}
          <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1 mr-1" />
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                filterCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80'
              }`}
            >
              Semua ({relevantNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('unread')}
              className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterCategory === 'unread'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80'
              }`}
            >
              Belum Dibaca
              {unreadCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterCategory === 'unread' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('payment')}
              className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterCategory === 'payment'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80'
              }`}
            >
              <CreditCard className="w-3 h-3" />
              Iuran & Keuangan
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('registration')}
              className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterCategory === 'registration'
                  ? 'bg-sky-700 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80'
              }`}
            >
              <UserPlus className="w-3 h-3" />
              Pendaftaran Warga
            </button>
          </div>

          {/* Notifications Feed */}
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">Tidak ada notifikasi saat ini</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {filterCategory !== 'all'
                    ? 'Tidak ada notifikasi untuk kategori filter yang dipilih.'
                    : 'Pemberitahuan verifikasi pembayaran dan persetujuan pendaftaran akan muncul di sini secara real-time.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const icon = getNotificationIcon(notif.type, notif.category);
                const badgeStyle = getBadgeStyle(notif.type);

                return (
                  <div
                    key={notif.id}
                    id={`notif-${notif.id}`}
                    className={`p-4 sm:p-5 transition-colors flex items-start gap-3 sm:gap-4 relative group ${
                      !notif.read ? 'bg-emerald-50/25 hover:bg-emerald-50/40' : 'bg-white hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Unread indicator bar */}
                    {!notif.read && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-r" />
                    )}

                    {/* Notification Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        notif.type === 'success'
                          ? 'bg-emerald-100/70 border-emerald-300/80'
                          : notif.type === 'error'
                          ? 'bg-rose-100/70 border-rose-300/80'
                          : notif.type === 'warning'
                          ? 'bg-amber-100/70 border-amber-300/80'
                          : 'bg-blue-100/70 border-blue-300/80'
                      }`}
                    >
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${badgeStyle}`}>
                          {notif.category === 'payment'
                            ? 'Iuran & Kas'
                            : notif.category === 'registration'
                            ? 'Pendaftaran'
                            : notif.category === 'claim'
                            ? 'Santunan Duka'
                            : 'Sistem'}
                        </span>

                        {notif.cluster && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {notif.cluster}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 font-medium ml-auto">
                          {formatTimeAgo(notif.timestamp)}
                        </span>
                      </div>

                      <h4 className={`text-sm font-bold leading-snug ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notif.title}
                      </h4>

                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Action Links */}
                      <div className="mt-2.5 flex items-center gap-3">
                        {notif.linkTab && onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => {
                              onMarkNotificationRead(notif.id);
                              onNavigateTab(notif.linkTab!);
                            }}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 group/btn"
                          >
                            <span>Buka Halaman Terkait</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                          </button>
                        )}

                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => onMarkNotificationRead(notif.id)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800"
                          >
                            Tandai sudah dibaca
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={() => onDismissNotification(notif.id)}
                      className="text-slate-300 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                      title="Hapus notifikasi ini"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
