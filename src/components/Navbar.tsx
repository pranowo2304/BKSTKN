import React, { useState, useRef, useEffect } from 'react';
import { SystemSettings, Payment, AppUser, UserAuthority } from '../types';
import { formatIDR } from '../lib/storage';
import { calculatePendingGracePeriod, getGracePeriodSummary } from '../lib/gracePeriodUtils';
import { useRolePermissions } from '../lib/permissions';
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
  totalBalance: number;
  settings: SystemSettings;
  payments?: Payment[];
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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  isAdmin,
  setIsAdmin,
  pendingCount,
  pendingRtVerificationCount = 0,
  pendingPaguyubanApprovalCount = 0,
  totalBalance,
  settings,
  payments = [],
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
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const authority: UserAuthority = activeUser ? activeUser.authority : 'Anggota';
  const isBendahara = authority === 'Bendahara';
  const isBendaharaOrAdmin = authority === 'Bendahara' || authority === 'Admin';
  // Tombol ganti peran hanya untuk Admin
  const canSwitchRole = authority === 'Admin';
  // Tombol laporan di header untuk Admin, Bendahara, Ketua Paguyuban, dan Ketua DKM
  const canAccessReport =
    authority === 'Admin' ||
    authority === 'Bendahara' ||
    authority === 'Ketua Paguyuban' ||
    authority === 'Ketua DKM';
  const pendingPayments = payments.filter((p) => p.status === 'Pending');
  const graceSummary = getGracePeriodSummary(payments);

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

  const totalPendingNotifications =
    authority === 'Ketua Paguyuban'
      ? pendingPaguyubanApprovalCount
      : authority === 'Ketua RT (Cluster)'
      ? pendingRtVerificationCount
      : authority === 'Bendahara'
      ? pendingCount
      : pendingCount + pendingRtVerificationCount + pendingPaguyubanApprovalCount;

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
          {/* Cloud Database Status Badge */}
          <div 
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 border border-slate-700/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl shadow-inner text-xs"
            title={
              cloudStatus === 'connected'
                ? 'Cloud Firestore Database terhubung aktif & tersinkronisasi real-time'
                : cloudStatus === 'connecting'
                ? 'Sedang menghubungkan ke Cloud Firestore...'
                : 'Penyimpanan lokal aktif'
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
                    <span>Firestore</span>
                    <span className="hidden sm:inline">Realtime</span>
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
                <CloudOff className="w-4 h-4 text-slate-400" />
                <div className="leading-tight">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Cloud DB</p>
                  <p className="text-[11px] font-bold text-slate-300">Mode Lokal</p>
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
            /* GUEST MODE LOGIN BUTTON */
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mode Tamu</span>
              </span>
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
              <div className="absolute right-0 mt-2 w-80 sm:w-[420px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Popover Header */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider">Notifikasi Pembayaran</h3>
                      <p className="text-[10px] text-slate-400">Antrean verifikasi & pemantauan kas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {graceSummary.hasOverdue && isBendaharaOrAdmin && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{graceSummary.overdueCount} Kritis &gt;30h</span>
                      </span>
                    )}
                    {pendingCount > 0 ? (
                      <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full">
                        {pendingCount} Pending
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
                  <div className="p-3.5 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white border-b border-rose-800/80 flex items-start gap-2.5 shadow-inner">
                    <div className="p-1.5 bg-rose-500/30 text-rose-300 rounded-lg shrink-0 mt-0.5 border border-rose-500/40">
                      <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-rose-300 uppercase tracking-wider flex items-center gap-1">
                          <span>🚨 Peringatan Masa Tenggang</span>
                        </span>
                        <span className="font-mono text-[10px] font-extrabold text-rose-200 bg-rose-900/80 px-2 py-0.5 rounded border border-rose-700">
                          {formatIDR(graceSummary.overdueTotalAmount)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-snug">
                        Terdapat <strong className="text-white font-black">{graceSummary.overdueCount} pembayaran pending</strong> yang telah tertahan <strong className="text-rose-300">melebihi toleransi 30 hari</strong>. Segera periksa mutasi bank atau kirimkan pesan tindak lanjut.
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={handleNavigateToValidation}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                        >
                          <span>Validasi Transaksi Kritis &gt;30 Hari</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* KETUA PAGUYUBAN APPROVAL ALERT BANNER */}
                {pendingPaguyubanApprovalCount > 0 && (authority === 'Ketua Paguyuban' || authority === 'Admin') && (
                  <div className="p-3 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white border-b border-purple-800/80 flex items-start gap-2.5">
                    <div className="p-1.5 bg-purple-500/30 text-purple-300 rounded-lg shrink-0 mt-0.5 border border-purple-500/40">
                      <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-purple-300 uppercase tracking-wider">
                          Persetujuan Akhir Paguyuban
                        </span>
                        <span className="px-2 py-0.2 bg-purple-600 text-white font-mono text-[10px] font-black rounded-full">
                          {pendingPaguyubanApprovalCount} Warga
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-200">
                        Ada {pendingPaguyubanApprovalCount} warga yang telah lolos RT dan kas terbayar, menunggu persetujuan Ketua Paguyuban untuk penerbitan KTA.
                      </p>
                      <button
                        type="button"
                        onClick={handleNavigateToPaguyubanApproval}
                        className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-black rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm mt-1"
                      >
                        <span>Buka Persetujuan Ketua</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Popover Items List (Hanya untuk Admin / Bendahara yang mengurus kas) */}
                {authority !== 'Ketua Paguyuban' && (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {pendingPayments.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                        <p className="text-xs font-bold text-slate-700">Tidak ada antrean validasi</p>
                        <p className="text-[11px] text-slate-400">
                          Seluruh pembayaran iuran warga telah selesai diproses dan terverifikasi.
                        </p>
                      </div>
                    ) : (
                      pendingPayments.map((payment) => {
                        const graceInfo = calculatePendingGracePeriod(payment);
                        const isOverdue = graceInfo.isExceedingGracePeriod;

                        return (
                          <div
                            key={payment.id}
                            className={`p-3.5 transition-colors flex items-start justify-between gap-3 group ${
                              isOverdue
                                ? 'bg-rose-50/50 hover:bg-rose-50 border-l-4 border-l-rose-500'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-extrabold text-xs text-slate-900 truncate">
                                  {payment.memberName}
                                </span>
                                <span className="font-mono font-bold text-xs text-emerald-700 shrink-0">
                                  {formatIDR(payment.amount)}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600 font-medium">
                                {payment.paymentType} • <span className="font-semibold text-slate-800">{payment.periodMonth}</span>
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                <span className="text-slate-400">{payment.paymentMethod}</span>
                                <span className="text-slate-300">•</span>
                                <span className="flex items-center gap-1 font-mono text-slate-500">
                                  <Clock className="w-3 h-3 text-amber-500" /> {payment.createdAt.split(' ')[0]}
                                </span>

                                {/* Grace period badge */}
                                {isOverdue ? (
                                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 font-black rounded text-[9px] inline-flex items-center gap-0.5 animate-pulse">
                                    <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                                    <span>{graceInfo.daysPending} hari (Lewat +{graceInfo.daysOverdue}h)</span>
                                  </span>
                                ) : graceInfo.isApproachingGracePeriod ? (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded text-[9px]">
                                    {graceInfo.daysPending} hari
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">
                                    ({graceInfo.daysPending} hari)
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleNavigateToValidation}
                              className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg transition-colors border shrink-0 self-center ${
                                isOverdue
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm'
                                  : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border-indigo-200'
                              }`}
                            >
                              {isOverdue ? 'Tindak Lanjuti' : 'Validasi'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {pendingPayments.length > 0 && authority !== 'Ketua Paguyuban' && (
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Butuh persetujuan bendahara
                    </span>
                    <button
                      type="button"
                      onClick={handleNavigateToValidation}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 group"
                    >
                      <span>Buka Menu Validasi</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                )}
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

      {/* 🧭 HORIZONTAL NAVIGATION BAR (MODUL OPERASIONAL UNTUK PENGURUS/ADMIN/BENDAHARA) */}
      {activeUser && (isBendaharaOrAdmin || authority === 'Ketua RT (Cluster)' || authority === 'Ketua RW' || authority === 'Ketua DKM' || authority === 'Ketua Paguyuban') && (
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
              {(isBendaharaOrAdmin || authority === 'Ketua DKM' || authority === 'Ketua Paguyuban') && (
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

              {/* 4. LAPORAN KAS & REKAP (BENDAHARA & ADMIN) */}
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
              {(isBendaharaOrAdmin || authority === 'Ketua RT (Cluster)' || authority === 'Ketua RW') && (
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
