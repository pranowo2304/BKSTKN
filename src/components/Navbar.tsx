import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SystemSettings, Payment, AppUser, UserAuthority, Member, AppNotification, AmbulanceOrder } from '../types';
import { formatIDR } from '../lib/storage';
import { calculatePendingGracePeriod, getGracePeriodSummary } from '../lib/gracePeriodUtils';
import { isMemberAwaitingPaguyubanApproval } from '../lib/ktaUtils';
import { useRolePermissions, isAuthorizedForFuneralInventory } from '../lib/permissions';
import { 
  HeartHandshake, 
  Users, 
  CreditCard, 
  CheckSquare, 
  Receipt, 
  ShieldAlert, 
  Settings, 
  LayoutDashboard,
  RotateCcw,
  UserCheck,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  Bell,
  Clock,
  CheckCircle2,
  CheckCheck,
  ArrowRight,
  Shield,
  User,
  UserCog,
  Crown,
  Landmark,
  Building2,
  ChevronDown,
  X,
  Cloud,
  CloudOff,
  Trash2,
  Database,
  Globe,
  LogOut,
  LogIn,
  Lock,
  AlertTriangle,
  AlertCircle,
  Smartphone,
  UserPlus,
  Coins,
  Ambulance,
  Calendar,
  Boxes,
} from 'lucide-react';
import { DataManagementModal } from './DataManagementModal';
import { AppIcon } from './AppIcon';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  pendingCount: number;
  pendingRtVerificationCount?: number;
  pendingPaguyubanApprovalCount?: number;
  pendingAmbulanceCount?: number;
  activeFuneralCount?: number;
  activeLoanCount?: number;
  totalBalance: number;
  settings: SystemSettings;
  payments?: Payment[];
  members?: Member[];
  notifications?: AppNotification[];
  ambulanceOrders?: AmbulanceOrder[];
  users?: AppUser[];
  activeUser?: AppUser | null;
  memberCount?: number;
  claimCount?: number;
  cloudStatus?: 'connected' | 'connecting' | 'offline' | 'error';
  onSwitchActiveUser?: (user: AppUser) => void;
  onResetData: () => void;
  onClearTransactions?: () => Promise<void> | void;
  onClearDemoData?: () => Promise<void> | void;
  onClearClaims?: () => Promise<void> | void;
  onOpenExportModal?: () => void;
  onLogout?: () => void;
  onOpenLoginModal?: () => void;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onClearAllNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  isAdmin,
  setIsAdmin,
  pendingCount,
  pendingRtVerificationCount = 0,
  pendingPaguyubanApprovalCount = 0,
  pendingAmbulanceCount = 0,
  activeFuneralCount = 0,
  activeLoanCount = 0,
  totalBalance,
  settings,
  payments = [],
  members = [],
  notifications = [],
  ambulanceOrders = [],
  users = [],
  activeUser,
  memberCount = 0,
  claimCount = 0,
  cloudStatus = 'connected',
  onSwitchActiveUser,
  onResetData,
  onClearTransactions,
  onClearDemoData,
  onClearClaims,
  onOpenExportModal,
  onLogout,
  onOpenLoginModal,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [popoverFilter, setPopoverFilter] = useState<'all' | 'rt' | 'payment' | 'paguyuban' | 'ambulance' | 'system'>('all');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const authority: UserAuthority = activeUser ? activeUser.authority : 'Anggota';
  const isBendahara = authority === 'Bendahara';
  const isBendaharaOrAdmin = authority === 'Bendahara' || authority === 'Admin';
  const isKetuaRt = authority === 'Ketua RT (Cluster)';
  const isKetuaPaguyuban = authority === 'Ketua Paguyuban';
  const isDriver = authority === 'Driver';
  const isStaf = authority === 'Petugas Staf';
  const isAdminRole = authority === 'Admin';
  const userCluster = activeUser?.cluster;

  // Tombol ganti peran hanya untuk Admin
  const canSwitchRole = authority === 'Admin';
  // Tombol laporan di header untuk Admin, Bendahara, dan Ketua DKM
  const canAccessReport =
    authority === 'Admin' ||
    authority === 'Bendahara' ||
    authority === 'Ketua DKM';

  const pendingPayments = useMemo(() => {
    return payments.filter((p) => p.status === 'Pending');
  }, [payments]);

  const graceSummary = useMemo(() => {
    return getGracePeriodSummary(payments);
  }, [payments]);

  const pendingRtMembers = useMemo(() => {
    return members.filter((m) => {
      if (isKetuaRt && userCluster && m.cluster !== userCluster) {
        return false;
      }
      return m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending';
    });
  }, [members, isKetuaRt, userCluster]);

  const pendingPaguyubanMembers = useMemo(() => {
    return members.filter((m) => isMemberAwaitingPaguyubanApproval(m, payments));
  }, [members, payments]);

  const pendingAmbulanceList = useMemo(() => {
    if (!ambulanceOrders) return [];
    if (isBendahara || isAdminRole || isKetuaPaguyuban) {
      return ambulanceOrders.filter((o) => o.status === 'MENUNGGU_BENDAHARA');
    }
    if (isStaf) {
      return ambulanceOrders.filter((o) => o.status === 'DISETUJUI_BENDAHARA' || o.status === 'PENUGASAN_ULANG_STAF');
    }
    if (isDriver) {
      return ambulanceOrders.filter((o) => o.status === 'MENUNGGU_KONFIRMASI_DRIVER' && (o.driverId === activeUser?.id || !o.driverId));
    }
    return ambulanceOrders.filter((o) => ['MENUNGGU_BENDAHARA', 'DISETUJUI_BENDAHARA', 'MENUNGGU_KONFIRMASI_DRIVER'].includes(o.status));
  }, [ambulanceOrders, isBendahara, isAdminRole, isKetuaPaguyuban, isStaf, isDriver, activeUser]);

  const unreadSystemNotifs = useMemo(() => {
    if (!notifications) return [];
    return notifications.filter((n) => {
      if (n.read) return false;
      if (isKetuaRt && userCluster) {
        return !n.cluster || n.cluster === userCluster || n.category === 'system';
      }
      return true;
    });
  }, [notifications, isKetuaRt, userCluster]);

  // Unified list of actionable notification items tailored to user authority
  const actionableItems = useMemo(() => {
    const items: Array<{
      id: string;
      category: 'rt' | 'payment' | 'paguyuban' | 'ambulance' | 'system';
      title: string;
      subtitle: string;
      meta: string;
      badgeLabel: string;
      badgeColor: string;
      isOverdue?: boolean;
      overdueText?: string;
      actionLabel: string;
      onAction: () => void;
      onSecondaryAction?: () => void;
      secondaryActionLabel?: string;
    }> = [];

    // 1. Verifikasi RT Warga Baru (untuk RT dan Admin)
    if (isKetuaRt || isAdminRole) {
      pendingRtMembers.forEach((m) => {
        items.push({
          id: `rt-${m.id}`,
          category: 'rt',
          title: `Pendaftaran: ${m.name}`,
          subtitle: `Wilayah ${m.cluster || 'Cluster'} • NIK: ${m.nik}`,
          meta: `Terdaftar: ${m.createdAt ? m.createdAt.split(' ')[0] : 'Baru'}`,
          badgeLabel: 'Verifikasi RT',
          badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
          actionLabel: 'Verifikasi Warga',
          onAction: () => {
            setShowNotifications(false);
            setIsAdmin(true);
            setCurrentTab('rt-verification');
          },
        });
      });
    }

    // 2. Validasi Pembayaran Kas Pending (untuk Bendahara dan Admin)
    if (isBendahara || isAdminRole) {
      pendingPayments.forEach((p) => {
        const graceInfo = calculatePendingGracePeriod(p);
        const isOverdue = graceInfo.isExceedingGracePeriod;
        items.push({
          id: `payment-${p.id}`,
          category: 'payment',
          title: `Iuran: ${p.memberName}`,
          subtitle: `${p.paymentType} (${p.periodMonth}) • ${formatIDR(p.amount)}`,
          meta: `${p.paymentMethod} • ${p.createdAt ? p.createdAt.split(' ')[0] : ''}`,
          badgeLabel: isOverdue ? `Lewat +${graceInfo.daysOverdue}h` : `${graceInfo.daysPending} hari`,
          badgeColor: isOverdue ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300',
          isOverdue,
          overdueText: isOverdue ? `Tertahan ${graceInfo.daysPending} hari (>30h)` : undefined,
          actionLabel: isOverdue ? 'Tindak Lanjuti' : 'Validasi Kas',
          onAction: () => {
            setShowNotifications(false);
            setIsAdmin(true);
            setCurrentTab('validation');
          },
        });
      });
    }

    // 3. Persetujuan Akhir Ketua Paguyuban (untuk Ketua Paguyuban dan Admin)
    if (isKetuaPaguyuban || isAdminRole) {
      pendingPaguyubanMembers.forEach((m) => {
        items.push({
          id: `paguyuban-${m.id}`,
          category: 'paguyuban',
          title: `Persetujuan KTA: ${m.name}`,
          subtitle: `Cluster ${m.cluster || ''} • Telah Lolos RT & Iuran Kas Lunas`,
          meta: `Form: ${m.memberNumber || 'Pending KTA'}`,
          badgeLabel: 'Persetujuan Ketua',
          badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
          actionLabel: 'Persetujuan KTA',
          onAction: () => {
            setShowNotifications(false);
            setIsAdmin(true);
            setCurrentTab('paguyuban-approval');
          },
        });
      });
    }

    // 4. Layanan Ambulans Siaga (Driver, Bendahara, Staf, Admin)
    if (isDriver || isBendahara || isStaf || isAdminRole || isKetuaPaguyuban) {
      pendingAmbulanceList.forEach((o) => {
        items.push({
          id: `amb-${o.id}`,
          category: 'ambulance',
          title: `Ambulans: ${o.patientName}`,
          subtitle: `${o.originAddress} ➔ ${o.destinationAddress}`,
          meta: `Status: ${o.status.replace(/_/g, ' ')} • Urgensi: ${o.urgencyLevel || 'STANDAR'}`,
          badgeLabel: 'Ambulans Siaga',
          badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
          actionLabel: 'Kelola Ambulans',
          onAction: () => {
            setShowNotifications(false);
            setIsAdmin(true);
            setCurrentTab('ambulance');
          },
        });
      });
    }

    // 5. Notifikasi Sistem & Aktivitas Belum Dibaca
    unreadSystemNotifs.forEach((n) => {
      items.push({
        id: `sys-${n.id}`,
        category: 'system',
        title: n.title,
        subtitle: n.message,
        meta: n.timestamp ? n.timestamp.split('T')[0] : 'Baru',
        badgeLabel: n.category === 'payment' ? 'Iuran' : n.category === 'registration' ? 'Warga' : n.category === 'claim' ? 'Santunan' : n.category === 'ambulance' ? 'Ambulans' : 'Sistem',
        badgeColor: n.type === 'error' ? 'bg-rose-100 text-rose-900 border-rose-300' : n.type === 'warning' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-900 border-blue-200',
        actionLabel: n.linkTab ? 'Buka Menu' : 'Tandai Dibaca',
        onAction: () => {
          if (onMarkNotificationRead) onMarkNotificationRead(n.id);
          if (n.linkTab) {
            setShowNotifications(false);
            setIsAdmin(true);
            setCurrentTab(n.linkTab);
          }
        },
        secondaryActionLabel: n.linkTab ? 'Tandai Dibaca' : undefined,
        onSecondaryAction: n.linkTab ? () => onMarkNotificationRead && onMarkNotificationRead(n.id) : undefined,
      });
    });

    return items;
  }, [
    isKetuaRt,
    isAdminRole,
    isBendahara,
    isKetuaPaguyuban,
    isDriver,
    isStaf,
    pendingRtMembers,
    pendingPayments,
    pendingPaguyubanMembers,
    pendingAmbulanceList,
    unreadSystemNotifs,
    onMarkNotificationRead,
    setCurrentTab,
    setIsAdmin,
  ]);

  // Total badge count MUST precisely equal the count of actual actionable items visible to this user!
  const totalPendingNotifications = actionableItems.length;

  // Filtered items based on active popover tab
  const displayedItems = useMemo(() => {
    if (popoverFilter === 'all') return actionableItems;
    return actionableItems.filter((item) => item.category === popoverFilter);
  }, [actionableItems, popoverFilter]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNavigateToValidation = () => {
    setShowNotifications(false);
    setIsAdmin(true);
    setCurrentTab('validation');
  };

  const handleNavigateToRtVerification = () => {
    setShowNotifications(false);
    setIsAdmin(true);
    setCurrentTab('rt-verification');
  };

  const handleNavigateToPaguyubanApproval = () => {
    setShowNotifications(false);
    setIsAdmin(true);
    setCurrentTab('paguyuban-approval');
  };

  const handleNavigateToAmbulance = () => {
    setShowNotifications(false);
    setIsAdmin(true);
    setCurrentTab('ambulance');
  };

  const getAuthorityBadgeColor = (auth?: UserAuthority) => {
    switch (auth) {
      case 'Admin':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'Ketua Paguyuban':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Bendahara':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Ketua RT (Cluster)':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Ketua RW':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Ketua DKM':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'Petugas Staf':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Driver':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'Anggota':
        return 'bg-slate-700 text-slate-300 border-slate-600';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getAuthorityIcon = (auth?: UserAuthority) => {
    switch (auth) {
      case 'Admin':
        return <Crown className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Ketua Paguyuban':
        return <Crown className="w-3.5 h-3.5 text-purple-400" />;
      case 'Bendahara':
        return <Landmark className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Ketua RT (Cluster)':
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />;
      case 'Ketua RW':
        return <Building2 className="w-3.5 h-3.5 text-purple-400" />;
      case 'Ketua DKM':
        return <HeartHandshake className="w-3.5 h-3.5 text-teal-400" />;
      case 'Petugas Staf':
        return <Users className="w-3.5 h-3.5 text-blue-400" />;
      case 'Driver':
        return <Ambulance className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <User className="w-3.5 h-3.5 text-slate-300" />;
    }
  };

  const { permissions } = useRolePermissions();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
      {/* Top Bar Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/90 flex items-center justify-center p-0.5 overflow-hidden shadow-lg shadow-emerald-950/40 shrink-0">
              <img
                src={settings.logoUrl}
                alt={settings.communityName}
                className="w-full h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <AppIcon size={40} className="rounded-xl shadow-lg shadow-emerald-950/40 shrink-0" />
          )}
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-tight text-white flex items-center gap-2">
              {settings.communityName}
            </h1>
            <p className="text-xs text-slate-400 font-medium">Sistem Pengelolaan & Realisasi Dana Kematian</p>
          </div>
        </div>

        {/* Live Balance, Role Switcher & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
          {/* Cloud Database Status Badge (Non-clickable static indicator) */}
          <div 
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 border border-slate-700/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl shadow-inner text-xs select-none"
            title={
              cloudStatus === 'connected'
                ? 'Database terhubung aktif & tersinkronisasi real-time'
                : cloudStatus === 'connecting'
                ? 'Sedang menghubungkan ke Database...'
                : 'Mode Penyimpanan Lokal Aktif'
            }
          >
            {cloudStatus === 'connected' ? (
              <>
                <div className="relative flex items-center justify-center">
                  <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                </div>
                <div className="leading-tight">
                  <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-wider font-semibold hidden xs:block">Cloud DB</p>
                  <p className="text-[10px] sm:text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                    <span>Realtime</span>
                  </p>
                </div>
              </>
            ) : cloudStatus === 'connecting' ? (
              <>
                <Cloud className="w-4 h-4 text-amber-400 animate-pulse" />
                <div className="leading-tight">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Cloud DB</p>
                  <p className="text-[11px] font-bold text-amber-300">Menghubungkan...</p>
                </div>
              </>
            ) : (
              <>
                <CloudOff className="w-4 h-4 text-amber-400/90" />
                <div className="leading-tight">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Cloud DB</p>
                  <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <span>Mode Lokal</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Total Saldo Kas Badge */}
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl shadow-inner">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Saldo Kas</p>
              <p className="text-sm font-extrabold text-emerald-400 font-mono leading-none">{formatIDR(totalBalance)}</p>
            </div>
          </div>

          {/* Tombol Pasang Aplikasi Mobile (PWA) */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-pwa-install'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Pasang ikon aplikasi di Layar Utama HP / Komputer (PWA)"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Pasang Aplikasi</span>
          </button>

          {/* Active User Profile & Role Switcher Popover OR Guest Login */}
          {activeUser ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {canSwitchRole ? (
                /* TOMBOL GANTI PERAN (Hanya untuk Admin) */
                <div className="relative" ref={userDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700/80 hover:border-slate-600 transition-all text-xs cursor-pointer"
                    title="Ganti Peran / Simulasi Otoritas Pengguna (Admin)"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[11px] ${activeUser.avatarColor || 'bg-indigo-600'}`}>
                      {activeUser.name.charAt(0)}
                    </div>
                    <div className="text-left hidden sm:block max-w-[130px] truncate">
                      <p className="font-bold text-white leading-tight truncate">{activeUser.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{activeUser.authority}</p>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* USER SWITCHER DROPDOWN */}
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-3.5 bg-slate-900 text-white border-b border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow ${activeUser.avatarColor || 'bg-indigo-600'}`}>
                            {activeUser.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-xs text-white truncate">{activeUser.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate">{activeUser.email}</p>
                            <span className={`inline-block mt-0.5 px-2 py-0.2 rounded-md text-[9px] font-black border ${getAuthorityBadgeColor(activeUser.authority)}`}>
                              {activeUser.authority} {activeUser.cluster ? `• ${activeUser.cluster}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                          Simulasi Ganti Peran (Switch User):
                        </p>
                        <div className="max-h-52 overflow-y-auto space-y-1">
                          {users.map((u) => {
                            const isCurrent = u.id === activeUser.id;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  if (onSwitchActiveUser) onSwitchActiveUser(u);
                                  setShowUserDropdown(false);
                                }}
                                className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                  isCurrent
                                    ? 'bg-indigo-50 text-indigo-900 font-bold'
                                    : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 ${u.avatarColor || 'bg-slate-700'}`}>
                                    {u.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs truncate leading-tight">{u.name}</p>
                                    <p className="text-[10px] text-slate-500 truncate font-medium">
                                      {u.authority} {u.cluster ? `(${u.cluster})` : ''}
                                    </p>
                                  </div>
                                </div>
                                {isCurrent && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-2 mt-1 border-t border-slate-100 space-y-1.5">
                          {authority === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserDropdown(false);
                                setCurrentTab('users');
                              }}
                              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Kelola Pengguna & Otoritas</span>
                            </button>
                          )}

                          {onLogout && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowUserDropdown(false);
                                onLogout();
                              }}
                              className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5 text-rose-600" />
                              <span>Keluar dari Akun (Logout)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Profil Pengguna Aktif (Tombol Ganti Peran Dihilangkan untuk RT, RW, Anggota, dll) */
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/60 text-white rounded-xl border border-slate-700/60 text-xs select-none"
                  title={`Akun: ${activeUser.name} (${activeUser.authority}${activeUser.cluster ? ` - ${activeUser.cluster}` : ''})`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[11px] ${activeUser.avatarColor || 'bg-indigo-600'}`}>
                    {activeUser.name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block max-w-[130px] truncate">
                    <p className="font-bold text-white leading-tight truncate">{activeUser.name}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold truncate">{activeUser.authority}</p>
                  </div>
                </div>
              )}

              {/* DIRECT LOGOUT BUTTON */}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Keluar dari Akun (Logout)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-700/80 hover:border-rose-500/40 transition-all text-xs cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span className="hidden md:inline font-bold">Keluar</span>
                </button>
              )}
            </div>
          ) : (
            /* GUEST MODE QUICK NAVIGATION & LOGIN BUTTONS */
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setCurrentTab('registration')}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentTab === 'registration'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                    : 'bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/40'
                }`}
                title="Pendaftaran Anggota Warga Baru"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Registrasi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentTab !== 'public') {
                    setCurrentTab('public');
                  }
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('open-besaran-iuran'));
                  }, 80);
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-500/40"
                title="Pengumuman Besaran Iuran Kas Paguyuban"
              >
                <Coins className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pengumuman Iuran</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onOpenLoginModal) {
                    onOpenLoginModal();
                  } else {
                    setCurrentTab('public');
                    const el = document.getElementById('section-login');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-900/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk / Login</span>
              </button>
            </div>
          )}

          {/* NOTIFICATION BELL DROPDOWN */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-xl transition-all border ${
                showNotifications
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/50'
                  : graceSummary.hasOverdue && isBendaharaOrAdmin
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30 ring-2 ring-rose-500/30 animate-pulse'
                  : totalPendingNotifications > 0
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700'
              }`}
              title={
                graceSummary.hasOverdue && isBendaharaOrAdmin
                  ? `🚨 PERINGATAN BENDAHARA: ${graceSummary.overdueCount} Pembayaran Pending Melebihi 30 Hari Masa Tenggang!`
                  : totalPendingNotifications > 0
                  ? `${totalPendingNotifications} Antrean Memerlukan Aksi`
                  : 'Notifikasi'
              }
            >
              <Bell className="w-4 h-4" />
              {totalPendingNotifications > 0 && (
                <span
                  className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 font-black text-[10px] rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 ${
                    graceSummary.hasOverdue && isBendaharaOrAdmin
                      ? 'bg-rose-600 text-white animate-bounce ring-1 ring-rose-300'
                      : 'bg-amber-500 text-slate-950 animate-pulse'
                  }`}
                >
                  {graceSummary.hasOverdue && isBendaharaOrAdmin ? (
                    <span className="flex items-center gap-0.5">
                      <span>{totalPendingNotifications}</span>
                      <span className="text-[8px] bg-rose-950 text-rose-200 px-0.5 rounded">!</span>
                    </span>
                  ) : (
                    totalPendingNotifications
                  )}
                </span>
              )}
            </button>

            {/* NOTIFICATION POPOVER PANEL */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-[460px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Popover Header */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider">Pemberitahuan & Antrean</h3>
                      <p className="text-[10px] text-slate-400">Aktivitas verifikasi kas, berkas, & sistem</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {graceSummary.hasOverdue && isBendaharaOrAdmin && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{graceSummary.overdueCount} Kritis</span>
                      </span>
                    )}
                    {totalPendingNotifications > 0 ? (
                      <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full">
                        {totalPendingNotifications} Perlu Aksi
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded-md font-semibold">
                        Semua Bersih
                      </span>
                    )}
                  </div>
                </div>

                {/* BENDAHARA 30-DAY GRACE PERIOD ALERT BANNER */}
                {graceSummary.hasOverdue && isBendaharaOrAdmin && (
                  <div className="p-3 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white border-b border-rose-800/80 flex items-start gap-2.5 shadow-inner">
                    <div className="p-1.5 bg-rose-500/30 text-rose-300 rounded-lg shrink-0 mt-0.5 border border-rose-500/40">
                      <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-rose-300 uppercase tracking-wider">
                          🚨 Peringatan Masa Tenggang
                        </span>
                        <span className="font-mono text-[10px] font-extrabold text-rose-200 bg-rose-900/80 px-2 py-0.5 rounded border border-rose-700">
                          {formatIDR(graceSummary.overdueTotalAmount)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-snug">
                        Terdapat <strong className="text-white font-black">{graceSummary.overdueCount} iuran pending</strong> melebihi 30 hari. Segera validasi kas.
                      </p>
                      <button
                        type="button"
                        onClick={handleNavigateToValidation}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded transition-colors inline-flex items-center gap-1 mt-0.5"
                      >
                        <span>Validasi Kritis &gt;30 Hari</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Filter Categories if multiple categories have items */}
                {actionableItems.length > 0 && (
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPopoverFilter('all')}
                      className={`px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors ${
                        popoverFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      Semua ({actionableItems.length})
                    </button>
                    {pendingRtMembers.length > 0 && (isKetuaRt || isAdminRole) && (
                      <button
                        type="button"
                        onClick={() => setPopoverFilter('rt')}
                        className={`px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                          popoverFilter === 'rt'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>RT</span>
                        <span className="px-1 bg-amber-100 text-amber-800 rounded-full text-[9px] font-black">
                          {pendingRtMembers.length}
                        </span>
                      </button>
                    )}
                    {pendingPayments.length > 0 && (isBendahara || isAdminRole) && (
                      <button
                        type="button"
                        onClick={() => setPopoverFilter('payment')}
                        className={`px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                          popoverFilter === 'payment'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>Iuran</span>
                        <span className="px-1 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black">
                          {pendingPayments.length}
                        </span>
                      </button>
                    )}
                    {pendingPaguyubanMembers.length > 0 && (isKetuaPaguyuban || isAdminRole) && (
                      <button
                        type="button"
                        onClick={() => setPopoverFilter('paguyuban')}
                        className={`px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                          popoverFilter === 'paguyuban'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>KTA</span>
                        <span className="px-1 bg-purple-100 text-purple-800 rounded-full text-[9px] font-black">
                          {pendingPaguyubanMembers.length}
                        </span>
                      </button>
                    )}
                    {pendingAmbulanceList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPopoverFilter('ambulance')}
                        className={`px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                          popoverFilter === 'ambulance'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>Ambulans</span>
                        <span className="px-1 bg-cyan-100 text-cyan-800 rounded-full text-[9px] font-black">
                          {pendingAmbulanceList.length}
                        </span>
                      </button>
                    )}
                    {unreadSystemNotifs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPopoverFilter('system')}
                        className={`px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                          popoverFilter === 'system'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>Pesan</span>
                        <span className="px-1 bg-blue-100 text-blue-800 rounded-full text-[9px] font-black">
                          {unreadSystemNotifs.length}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Popover Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {displayedItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                      <p className="text-xs font-bold text-slate-700">Tidak ada antrean atau notifikasi</p>
                      <p className="text-[11px] text-slate-400">
                        {popoverFilter !== 'all'
                          ? 'Tidak ada antrean pada kategori ini. Silakan klik "Semua".'
                          : 'Seluruh verifikasi pendaftaran warga, validasi kas, dan pemberitahuan telah diproses.'}
                      </p>
                    </div>
                  ) : (
                    displayedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 transition-colors flex items-start justify-between gap-3 group ${
                          item.isOverdue
                            ? 'bg-rose-50/50 hover:bg-rose-50 border-l-4 border-l-rose-500'
                            : item.category === 'rt'
                            ? 'hover:bg-amber-50/40 border-l-4 border-l-amber-400'
                            : item.category === 'paguyuban'
                            ? 'hover:bg-purple-50/40 border-l-4 border-l-purple-400'
                            : item.category === 'ambulance'
                            ? 'hover:bg-cyan-50/40 border-l-4 border-l-cyan-400'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Icon & Details */}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                              item.category === 'rt'
                                ? 'bg-amber-100 text-amber-700 border-amber-300'
                                : item.category === 'payment'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : item.category === 'paguyuban'
                                ? 'bg-purple-100 text-purple-700 border-purple-300'
                                : item.category === 'ambulance'
                                ? 'bg-cyan-100 text-cyan-700 border-cyan-300'
                                : 'bg-blue-100 text-blue-700 border-blue-300'
                            }`}
                          >
                            {item.category === 'rt' ? (
                              <UserPlus className="w-3.5 h-3.5" />
                            ) : item.category === 'payment' ? (
                              <CreditCard className="w-3.5 h-3.5" />
                            ) : item.category === 'paguyuban' ? (
                              <Crown className="w-3.5 h-3.5" />
                            ) : item.category === 'ambulance' ? (
                              <Ambulance className="w-3.5 h-3.5" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900 truncate">
                                {item.title}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${item.badgeColor}`}>
                                {item.badgeLabel}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 font-medium leading-snug">
                              {item.subtitle}
                            </p>

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                              <span>{item.meta}</span>
                              {item.overdueText && (
                                <span className="text-rose-600 font-bold ml-1">
                                  • {item.overdueText}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-1 shrink-0 self-center">
                          <button
                            type="button"
                            onClick={item.onAction}
                            className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg transition-colors border shadow-xs inline-flex items-center gap-1 ${
                              item.isOverdue
                                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                                : item.category === 'rt'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                                : item.category === 'paguyuban'
                                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600'
                                : item.category === 'ambulance'
                                ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                            }`}
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {item.secondaryActionLabel && item.onSecondaryAction && (
                            <button
                              type="button"
                              onClick={item.onSecondaryAction}
                              className="text-[10px] text-slate-400 hover:text-slate-700 font-medium text-center"
                            >
                              {item.secondaryActionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Popover Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  {unreadSystemNotifs.length > 0 && onMarkAllNotificationsRead ? (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-bold inline-flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Tandai Semua Terbaca</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">
                      {totalPendingNotifications} antrean tercatat
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      setCurrentTab('dashboard');
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 group"
                  >
                    <span>Buka Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Dashboard Button for Admin & Bendahara in Top Header Bar */}
          {isBendaharaOrAdmin && (
            <button
              type="button"
              onClick={() => setCurrentTab('dashboard')}
              title={`Buka ${isBendahara ? 'Dashboard Kas Bendahara' : 'Dashboard Administrator'}`}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-sm ${
                currentTab === 'dashboard'
                  ? isBendahara
                    ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-500/30'
                    : 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-500/30'
                  : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="inline">
                {isBendahara ? 'Dashboard Bendahara' : 'Dashboard Admin'}
              </span>
              {isBendahara && pendingCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-rose-500 text-white">
                  {pendingCount}
                </span>
              ) : authority === 'Admin' && totalPendingNotifications > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-amber-500 text-slate-950">
                  {totalPendingNotifications}
                </span>
              ) : null}
            </button>
          )}

          {/* Unduh Laporan CSV Button (Hanya tampil untuk Admin, Bendahara, Ketua Paguyuban, dan Ketua DKM) */}
          {onOpenExportModal && canAccessReport && (
            <button
              onClick={onOpenExportModal}
              title="Unduh Laporan Keuangan CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl border border-emerald-500/40 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Laporan CSV</span>
            </button>
          )}

          {/* Data Management & Clear Transactions Button (Khusus Admin) */}
          {authority === 'Admin' && (
            <button
              type="button"
              onClick={() => setIsDataModalOpen(true)}
              title="Kelola Basis Data & Hapus Data Transaksi Firebase"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors border border-transparent hover:border-slate-700 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-400/80" />
            </button>
          )}
        </div>
      </div>

      {/* 🧭 HORIZONTAL NAVIGATION BAR (MODUL OPERASIONAL UNTUK PENGURUS/ADMIN/BENDAHARA/STAF/DRIVER - TIDAK TAMPIL UNTUK KETUA PAGUYUBAN & KETUA RT) */}
      {activeUser && !isKetuaPaguyuban && (isBendaharaOrAdmin || (authority !== 'Ketua RT (Cluster)' && (authority === 'Ketua RW' || authority === 'Ketua DKM' || authority === 'Petugas Staf' || authority === 'Driver'))) && (
        <div className="bg-slate-950/80 border-t border-slate-800/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-start gap-2 overflow-x-auto scrollbar-none py-1.5">
            <nav className="flex items-center gap-1 sm:gap-1.5 shrink-0" aria-label="Navigasi Menu Bar">
              {/* 1. VALIDASI KAS (BENDAHARA & ADMIN) */}
              {isBendaharaOrAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('validation')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'validation'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Validasi Kas</span>
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950">
                      {pendingCount}
                    </span>
                  )}
                </button>
              )}

              {/* 2. TERIMA / INPUT IURAN (BENDAHARA & ADMIN) */}
              {isBendaharaOrAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('payment')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'payment'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>{isBendahara ? 'Terima Iuran' : 'Input Iuran'}</span>
                </button>
              )}

              {/* 3. REALISASI SANTUNAN */}
              {(isBendaharaOrAdmin || authority === 'Ketua DKM') && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('realization')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'realization'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50 ring-1 ring-rose-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
                  <span>Realisasi Duka</span>
                  {claimCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono text-slate-400 bg-slate-800">
                      {claimCount}
                    </span>
                  )}
                </button>
              )}

              {/* 4. AMBULANS SIAGA 24 JAM */}
              <button
                type="button"
                onClick={() => setCurrentTab('ambulance')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  currentTab === 'ambulance'
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/50 ring-1 ring-red-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <Ambulance className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>Ambulans Siaga</span>
                {pendingAmbulanceCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-red-500 text-white animate-pulse">
                    {pendingAmbulanceCount}
                  </span>
                )}
              </button>

              {/* 5. JADWAL PEMAKAMAN & FARDHU KIFAYAH */}
              <button
                type="button"
                onClick={() => setCurrentTab('funeral-schedule')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  currentTab === 'funeral-schedule'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>Jadwal Pemakaman</span>
                {activeFuneralCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-emerald-500 text-white animate-pulse">
                    {activeFuneralCount}
                  </span>
                )}
              </button>

              {/* 6. INVENTARIS DUKA & LOGISTIK (HANYA ADMIN, BENDAHARA, KETUA, DAN DKM) */}
              {isAuthorizedForFuneralInventory(activeUser) && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('inventory')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'inventory'
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-950/50 ring-1 ring-teal-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                  <span>Inventaris Duka</span>
                  {activeLoanCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950">
                      {activeLoanCount}
                    </span>
                  )}
                </button>
              )}

              {/* 7. LAPORAN KAS & REKAP (BENDAHARA & ADMIN) */}
              {isBendaharaOrAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('history')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'history'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>Laporan Kas</span>
                </button>
              )}

              {/* 5. DATA WARGA & TANGGUNGAN */}
              {(isBendaharaOrAdmin || authority === 'Ketua RW') && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('registration')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'registration'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Data Warga</span>
                  {memberCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono text-slate-400 bg-slate-800">
                      {memberCount}
                    </span>
                  )}
                </button>
              )}

              {/* 6. KHUSUS ADMIN: PENGGUNA & OTORITAS */}
              {authority === 'Admin' && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('users')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'users'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <UserCog className="w-3.5 h-3.5 shrink-0" />
                  <span>Pengguna & Otoritas</span>
                </button>
              )}

              {/* 7. KHUSUS ADMIN: PENGATURAN SISTEM */}
              {authority === 'Admin' && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('settings')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    currentTab === 'settings'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50 ring-1 ring-purple-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" />
                  <span>Pengaturan</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Data Management & Clear Transactions Modal (Khusus Admin) */}
      {authority === 'Admin' && (
        <DataManagementModal
          isOpen={isDataModalOpen}
          onClose={() => setIsDataModalOpen(false)}
          memberCount={memberCount}
          paymentCount={payments.length}
          claimCount={claimCount}
          onClearTransactions={onClearTransactions}
          onClearDemoData={onClearDemoData || onClearTransactions}
          onRestoreDemoData={onResetData}
          onClearClaims={onClearClaims}
        />
      )}

    </header>
  );
};
