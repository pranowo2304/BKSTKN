import React, { useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  Crown,
  Building2,
  Landmark,
  User,
  ArrowRight,
} from 'lucide-react';
import { AppUser, Member, UserAuthority } from '../types';
import { getAllNavigationActionsForUser } from '../lib/navigationMenu';
import { RolePermissionsMap } from '../lib/permissions';

interface QuickOperationalMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeUser?: AppUser | null;
  permissions?: RolePermissionsMap;
  pendingRtVerificationCount?: number;
  pendingCount?: number;
  pendingPaguyubanApprovalCount?: number;
  overdueGraceCount?: number;
  totalMembersCount?: number;
  totalPaymentsCount?: number;
  totalClaimsCount?: number;
  totalUsersCount?: number;
  onOpenExportModal?: () => void;
  onSelectMemberForPayment?: (member: Member) => void;
  onOpenDigitalKta?: (member: Member) => void;
  myMember?: Member | null;
}

export const QuickOperationalMenuModal: React.FC<QuickOperationalMenuModalProps> = ({
  isOpen,
  onClose,
  currentTab,
  setCurrentTab,
  activeUser,
  permissions,
  pendingRtVerificationCount = 0,
  pendingCount = 0,
  pendingPaguyubanApprovalCount = 0,
  overdueGraceCount = 0,
  totalMembersCount = 0,
  totalPaymentsCount = 0,
  totalClaimsCount = 0,
  totalUsersCount = 0,
  onOpenExportModal,
  onSelectMemberForPayment,
  onOpenDigitalKta,
  myMember,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const authority: UserAuthority = activeUser ? activeUser.authority : 'Anggota';

  // Dapatkan seluruh tab navigasi yang diizinkan untuk peran ini dalam bentuk aksi menu cepat
  const actions = getAllNavigationActionsForUser({
    currentTab,
    setCurrentTab: (tab) => {
      setCurrentTab(tab);
      onClose();
    },
    activeUser,
    permissions,
    pendingRtVerificationCount,
    pendingCount,
    pendingPaguyubanApprovalCount,
    overdueGraceCount,
    totalMembersCount,
    totalPaymentsCount,
    totalClaimsCount,
    totalUsersCount,
    onOpenExportModal: () => {
      onClose();
      if (onOpenExportModal) onOpenExportModal();
    },
    onSelectMemberForPayment,
    onOpenDigitalKta,
    myMember,
  });

  const getRoleIcon = () => {
    if (authority === 'Admin' || authority === 'Ketua Paguyuban') {
      return <Crown className="w-5 h-5 text-amber-300" />;
    }
    if (authority === 'Bendahara') {
      return <Landmark className="w-5 h-5 text-emerald-300" />;
    }
    if (authority === 'Ketua RT (Cluster)' || authority === 'Ketua RW') {
      return <Building2 className="w-5 h-5 text-blue-300" />;
    }
    return <User className="w-5 h-5 text-purple-300" />;
  };

  const getCounterInfo = () => {
    if (authority === 'Bendahara') {
      return {
        label: 'PERLU VALIDASI KAS',
        value: `${pendingCount} Transaksi`,
        highlight: pendingCount > 0,
      };
    }
    if (authority === 'Ketua Paguyuban') {
      return {
        label: 'PERLU PENGESAHAN',
        value: `${pendingPaguyubanApprovalCount} Warga`,
        highlight: pendingPaguyubanApprovalCount > 0,
      };
    }
    if (authority === 'Ketua RT (Cluster)') {
      return {
        label: 'PERLU VERIFIKASI RT',
        value: `${pendingRtVerificationCount} Berkas`,
        highlight: pendingRtVerificationCount > 0,
      };
    }
    if (authority === 'Admin') {
      const totalPending = pendingCount + pendingRtVerificationCount + pendingPaguyubanApprovalCount;
      return {
        label: 'TOTAL ANTREAN SISTEM',
        value: `${totalPending} Antrean`,
        highlight: totalPending > 0,
      };
    }
    return {
      label: 'STATUS KEPESERTAAN',
      value: myMember?.isKtaIssued ? 'Aktif' : 'Terdaftar',
      highlight: false,
    };
  };

  const counter = getCounterInfo();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-menu-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#4c1d95] via-[#2e1065] to-[#1e1b4b] text-white px-5 sm:px-7 py-5 relative overflow-hidden shrink-0">
          <div className="absolute -right-8 -top-8 w-44 h-44 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-28 -bottom-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            {/* User Identity */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400/80 via-purple-500 to-indigo-500 p-0.5 shadow-lg shadow-purple-950/60 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-[#120d2d] rounded-[14px] flex items-center justify-center">
                  {getRoleIcon()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-600/40 text-purple-200 border border-purple-400/30 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                    {authority} {activeUser?.cluster ? `• ${activeUser.cluster}` : ''}
                  </span>
                </div>
                <h2 id="quick-menu-modal-title" className="text-base sm:text-xl font-black text-white tracking-tight mt-0.5">
                  {activeUser?.name || 'Pengguna Sistem'}
                </h2>
                <p className="text-xs text-purple-200/80 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Seluruh Menu Navigasi Terpadu Sesuai Hak Akses</span>
                </p>
              </div>
            </div>

            {/* Right: Counter Box & Close Button */}
            <div className="flex items-center gap-3">
              <div
                className={`hidden sm:block px-3.5 py-1.5 rounded-2xl text-right border transition-all ${
                  counter.highlight
                    ? 'bg-amber-500/25 border-amber-400/50 animate-pulse'
                    : 'bg-black/35 backdrop-blur-xs border-amber-500/30'
                }`}
              >
                <p className="text-[9px] font-bold text-amber-200/80 uppercase tracking-wider">
                  {counter.label}
                </p>
                <p className="text-sm font-black leading-tight font-mono text-amber-300">
                  {counter.value}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tutup Menu Cepat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="px-5 sm:px-7 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              MENU CEPAT OPERASIONAL ({actions.length} MODUL)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Ketuk salah satu modul untuk berpindah halaman secara langsung
          </span>
        </div>

        {/* Action Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {actions.map((act) => {
              const IconComp = act.icon;
              const isCurrent = act.id === currentTab;

              const badgeBg =
                act.badgeColor === 'rose'
                  ? 'bg-rose-600 text-white'
                  : act.badgeColor === 'amber'
                  ? 'bg-amber-500 text-slate-950'
                  : act.badgeColor === 'emerald'
                  ? 'bg-emerald-600 text-white'
                  : act.badgeColor === 'purple'
                  ? 'bg-purple-600 text-white'
                  : act.badgeColor === 'sky'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-900 text-white';

              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.onClick}
                  className={`group relative flex flex-col items-center text-center p-4 rounded-2xl transition-all active:scale-95 cursor-pointer text-left ${
                    isCurrent
                      ? 'bg-purple-50/90 border-2 border-purple-600 shadow-md ring-2 ring-purple-400/30'
                      : 'bg-white hover:bg-purple-50/40 border border-slate-200/90 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div
                    className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr ${act.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2.5`}
                  >
                    <IconComp className="w-6 h-6" />
                    {act.badge !== undefined && (
                      <span
                        className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full ${badgeBg} text-[9px] font-black font-mono shadow-xs border border-white`}
                      >
                        {act.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold leading-tight ${
                      isCurrent ? 'text-purple-900 font-extrabold' : 'text-slate-800 group-hover:text-purple-700'
                    }`}
                  >
                    {act.label}
                  </span>
                  {act.subLabel && (
                    <span className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                      {act.subLabel}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      <span>Sedang Aktif</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Semua wewenang operasional disinkronkan secara otomatis sesuai peran akun.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
