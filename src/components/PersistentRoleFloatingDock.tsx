import React from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  Settings as SettingsIcon,
  UserCog,
  HeartHandshake,
  FileSpreadsheet,
  UserPlus,
  Crown,
  Users,
  Building2,
  Globe,
  UserCheck,
  QrCode,
} from 'lucide-react';
import { AppUser } from '../types';
import { useRolePermissions } from '../lib/permissions';

export interface PersistentRoleFloatingDockProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeUser?: AppUser | null;
  isAdminRole?: boolean;
  pendingRtVerificationCount?: number;
  pendingCount?: number; // Validasi Kas Bendahara
  pendingPaguyubanApprovalCount?: number;
  userCount?: number;
  onOpenRegistration?: () => void;
}

export interface DockItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  isCenterFloating?: boolean;
  isActive: boolean;
  onClick: () => void;
}

export const PersistentRoleFloatingDock: React.FC<PersistentRoleFloatingDockProps> = ({
  currentTab,
  setCurrentTab,
  activeUser,
  isAdminRole = false,
  pendingRtVerificationCount = 0,
  pendingCount = 0,
  pendingPaguyubanApprovalCount = 0,
  userCount = 0,
  onOpenRegistration,
}) => {
  const authority = activeUser?.authority;
  const { can } = useRolePermissions();

  // Bangun daftar item navigasi bawah sesuai peran (Role) pengguna
  let dockItems: DockItemDef[] = [];

  // 0. Untuk Publik Portal / Tamu (Belum Login atau di Tab Publik)
  // Menunya : Registrasi, KTA Digital, Iuran
  // Dengan urutan dari kiri ke kanan : Iuran, Registrasi, KTA Digital
  if (currentTab === 'public' || !activeUser) {
    dockItems = [
      {
        id: 'dock-public-bayar',
        label: 'Iuran',
        icon: CreditCard,
        isActive: currentTab === 'public',
        onClick: () => {
          if (currentTab === 'public') {
            const el = document.getElementById('section-informasi-pengumuman');
            if (el) {
              const navOffset = 100;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - navOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
              });
              return;
            }
          }
          setCurrentTab('public');
          setTimeout(() => {
            const el = document.getElementById('section-informasi-pengumuman');
            if (el) {
              const navOffset = 100;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - navOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
              });
            }
          }, 120);
        },
      },
      {
        id: 'dock-public-registrasi',
        label: 'Registrasi',
        icon: UserPlus,
        isActive: currentTab === 'registration',
        onClick: () => {
          if (onOpenRegistration) {
            onOpenRegistration();
            return;
          }
          if (currentTab !== 'public') {
            setCurrentTab('public');
          }
          const trigger = () => {
            window.dispatchEvent(new CustomEvent('open-public-registration'));
          };
          trigger();
          setTimeout(trigger, 80);
          setTimeout(trigger, 220);
        },
      },
      {
        id: 'dock-public-kta',
        label: 'KTA Digital',
        icon: QrCode,
        isActive: currentTab === 'member-portal',
        onClick: () => {
          setCurrentTab('member-portal');
        },
      },
    ];
  } else if (isAdminRole || authority === 'Admin') {
    // 1. Role: ADMIN
    dockItems = [
      {
        id: 'dock-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-verifikasi',
        label: 'Verifikasi',
        icon: ShieldCheck,
        badge: pendingRtVerificationCount > 0 ? pendingRtVerificationCount : undefined,
        isActive: currentTab === 'rt-verification' || currentTab === 'validation' || currentTab === 'paguyuban-approval',
        onClick: () => setCurrentTab('rt-verification'),
      },
      {
        id: 'dock-payment',
        label: 'Input Iuran',
        icon: CreditCard,
        isCenterFloating: true,
        isActive: currentTab === 'payment',
        onClick: () => setCurrentTab('payment'),
      },
      {
        id: 'dock-settings',
        label: 'Atur Sistem',
        icon: SettingsIcon,
        isActive: currentTab === 'settings',
        onClick: () => setCurrentTab('settings'),
      },
      {
        id: 'dock-users',
        label: 'Otoritas',
        icon: UserCog,
        badge: userCount > 0 ? userCount : undefined,
        isActive: currentTab === 'users',
        onClick: () => setCurrentTab('users'),
      },
    ];
  } else if (authority === 'Ketua RT (Cluster)') {
    // 2. Role: KETUA RT (CLUSTER)
    dockItems = [
      {
        id: 'dock-beranda',
        label: 'Dashboard RT',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-verifikasi',
        label: 'Verifikasi',
        icon: ShieldCheck,
        badge: pendingRtVerificationCount > 0 ? pendingRtVerificationCount : undefined,
        isActive: currentTab === 'rt-verification',
        onClick: () => setCurrentTab('rt-verification'),
      },
      {
        id: 'dock-payment',
        label: 'Setor Kas',
        icon: CreditCard,
        isCenterFloating: true,
        isActive: currentTab === 'payment',
        onClick: () => setCurrentTab('payment'),
      },
      {
        id: 'dock-klaim',
        label: 'Klaim Manfaat',
        icon: HeartHandshake,
        isActive: currentTab === 'realization',
        onClick: () => setCurrentTab('realization'),
      },
      {
        id: 'dock-registration',
        label: 'Tambah Warga',
        icon: UserPlus,
        isActive: currentTab === 'registration',
        onClick: () => setCurrentTab('registration'),
      },
    ];
  } else if (authority === 'Bendahara') {
    // 3. Role: BENDAHARA
    dockItems = [
      {
        id: 'dock-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-validation',
        label: 'Validasi Kas',
        icon: ShieldCheck,
        badge: pendingCount > 0 ? pendingCount : undefined,
        isActive: currentTab === 'validation',
        onClick: () => setCurrentTab('validation'),
      },
      {
        id: 'dock-payment',
        label: 'Terima Iuran',
        icon: CreditCard,
        isCenterFloating: true,
        isActive: currentTab === 'payment',
        onClick: () => setCurrentTab('payment'),
      },
      {
        id: 'dock-klaim',
        label: 'Realisasi Duka',
        icon: HeartHandshake,
        isActive: currentTab === 'realization',
        onClick: () => setCurrentTab('realization'),
      },
      {
        id: 'dock-history',
        label: 'Laporan Kas',
        icon: FileSpreadsheet,
        isActive: currentTab === 'history',
        onClick: () => setCurrentTab('history'),
      },
    ];
  } else if (authority === 'Ketua Paguyuban') {
    // 4. Role: KETUA PAGUYUBAN
    dockItems = [
      {
        id: 'dock-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-persetujuan',
        label: 'Persetujuan',
        icon: Crown,
        badge: pendingPaguyubanApprovalCount > 0 ? pendingPaguyubanApprovalCount : undefined,
        isActive: currentTab === 'paguyuban-approval',
        onClick: () => setCurrentTab('paguyuban-approval'),
      },
      {
        id: 'dock-klaim',
        label: 'Otorisasi Kas',
        icon: HeartHandshake,
        isCenterFloating: true,
        isActive: currentTab === 'realization',
        onClick: () => setCurrentTab('realization'),
      },
      {
        id: 'dock-verifikasi-rt',
        label: can(authority, 'verify_rt_members') ? 'Verifikasi RT' : 'Pantau RT',
        icon: ShieldCheck,
        badge: pendingRtVerificationCount > 0 ? pendingRtVerificationCount : undefined,
        isActive: currentTab === 'rt-verification',
        onClick: () => setCurrentTab('rt-verification'),
      },
      {
        id: 'dock-history',
        label: 'Laporan Kas',
        icon: FileSpreadsheet,
        isActive: currentTab === 'history',
        onClick: () => setCurrentTab('history'),
      },
    ];
  } else if (authority === 'Anggota') {
    // 5. Role: ANGGOTA (Persistent di semua menu pembayaran, riwayat, dsb)
    dockItems = [
      {
        id: 'dock-dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-portal',
        label: 'Kartu KTA',
        icon: UserCheck,
        isActive: currentTab === 'member-portal',
        onClick: () => setCurrentTab('member-portal'),
      },
      {
        id: 'dock-payment',
        label: 'Iuran',
        icon: CreditCard,
        isCenterFloating: true,
        isActive: currentTab === 'payment',
        onClick: () => {
          if (currentTab === 'public') {
            const el = document.getElementById('section-informasi-pengumuman');
            if (el) {
              const navOffset = 100;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - navOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
              });
              return;
            }
          }
          setCurrentTab('public');
          setTimeout(() => {
            const el = document.getElementById('section-informasi-pengumuman');
            if (el) {
              const navOffset = 100;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - navOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
              });
            }
          }, 120);
        },
      },
      {
        id: 'dock-history',
        label: 'Riwayat Saya',
        icon: FileSpreadsheet,
        isActive: currentTab === 'history',
        onClick: () => setCurrentTab('history'),
      },
      {
        id: 'dock-klaim',
        label: 'Santunan Duka',
        icon: HeartHandshake,
        isActive: currentTab === 'realization',
        onClick: () => setCurrentTab('realization'),
      },
    ];
  } else if (authority === 'Ketua RW') {
    // 6. Role: KETUA RW (Supervisi Kas Lintas RT, Monitoring Berkas RT, Santunan RW, Direktori Warga RW)
    dockItems = [
      {
        id: 'dock-dashboard-rw',
        label: 'Beranda RW',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-verifikasi-rw',
        label: 'Verifikasi RT',
        icon: ShieldCheck,
        badge: pendingRtVerificationCount > 0 ? pendingRtVerificationCount : undefined,
        isActive: currentTab === 'rt-verification',
        onClick: () => setCurrentTab('rt-verification'),
      },
      {
        id: 'dock-history-rw',
        label: 'Laporan Kas',
        icon: FileSpreadsheet,
        isCenterFloating: true,
        isActive: currentTab === 'history',
        onClick: () => setCurrentTab('history'),
      },
      {
        id: 'dock-klaim-rw',
        label: 'Santunan RW',
        icon: HeartHandshake,
        isActive: currentTab === 'realization',
        onClick: () => setCurrentTab('realization'),
      },
      {
        id: 'dock-warga-rw',
        label: 'Warga RW',
        icon: Users,
        isActive: currentTab === 'registration',
        onClick: () => setCurrentTab('registration'),
      },
    ];
  } else if (authority === 'Ketua DKM') {
    // 7. Role: KETUA DKM (Fardhu Kifayah & Santunan Duka Umat, Database Jamaah, Laporan Santunan)
    dockItems = [
      {
        id: 'dock-dashboard-dkm',
        label: 'Beranda DKM',
        icon: LayoutDashboard,
        isActive: currentTab === 'dashboard',
        onClick: () => setCurrentTab('dashboard'),
      },
      {
        id: 'dock-jamaah-dkm',
        label: 'Jamaah',
        icon: Users,
        isActive: currentTab === 'registration',
        onClick: () => setCurrentTab('registration'),
      },
      {
        id: 'dock-klaim-dkm',
        label: 'Santunan Duka',
        icon: HeartHandshake,
        isCenterFloating: true,
        isActive: currentTab === 'realization',
        onClick: () => setCurrentTab('realization'),
      },
      {
        id: 'dock-history-dkm',
        label: 'Laporan',
        icon: FileSpreadsheet,
        isActive: currentTab === 'history',
        onClick: () => setCurrentTab('history'),
      },
      {
        id: 'dock-public-dkm',
        label: 'Info Duka',
        icon: Building2,
        isActive: currentTab === 'public',
        onClick: () => setCurrentTab('public'),
      },
    ];
  } else {
    // 8. Role: Guest / Mode Publik (Belum Login)
    // Urutan dari kiri ke kanan : Iuran, Registrasi, KTA Digital
    dockItems = [
      {
        id: 'dock-public-bayar',
        label: 'Iuran',
        icon: CreditCard,
        isActive: currentTab === 'public',
        onClick: () => {
          if (currentTab === 'public') {
            const el = document.getElementById('section-informasi-pengumuman');
            if (el) {
              const navOffset = 100;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - navOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
              });
              return;
            }
          }
          setCurrentTab('public');
          setTimeout(() => {
            const el = document.getElementById('section-informasi-pengumuman');
            if (el) {
              const navOffset = 100;
              const elementPosition = el.getBoundingClientRect().top;
              const offsetPosition = elementPosition + window.pageYOffset - navOffset;
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth',
              });
            }
          }, 120);
        },
      },
      {
        id: 'dock-public-registrasi',
        label: 'Registrasi',
        icon: UserPlus,
        isActive: currentTab === 'registration',
        onClick: () => {
          if (onOpenRegistration) {
            onOpenRegistration();
            return;
          }
          if (currentTab !== 'public') {
            setCurrentTab('public');
          }
          const trigger = () => {
            window.dispatchEvent(new CustomEvent('open-public-registration'));
          };
          trigger();
          setTimeout(trigger, 80);
          setTimeout(trigger, 220);
        },
      },
      {
        id: 'dock-public-kta',
        label: 'KTA Digital',
        icon: QrCode,
        isActive: currentTab === 'member-portal',
        onClick: () => {
          setCurrentTab('member-portal');
        },
      },
    ];
  }

  // Jika bukan salah satu role yang terdaftar, tidak merender dock
  if (dockItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Menu Navigasi Mobile Bawah Persisten"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pt-1 pb-1 sm:pb-1.5 px-3 sm:px-6"
      style={{ bottom: 0, left: 0, right: 0 }}
    >
      <div className="max-w-md sm:max-w-lg mx-auto flex items-center justify-around relative">
        {dockItems.map((item) => {
          const IconComp = item.icon;

          if (item.isCenterFloating) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="flex flex-col items-center justify-center -mt-2.5 sm:-mt-3 py-1 px-2 group cursor-pointer min-h-[44px]"
                title={item.label}
              >
                <div
                  className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shadow-lg transition-all group-hover:scale-110 active:scale-95 text-white ${
                    item.isActive
                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-900/30 ring-4 ring-purple-100'
                      : 'bg-gradient-to-tr from-sky-600 to-blue-500 shadow-sky-900/30 ring-4 ring-sky-100'
                  }`}
                >
                  <IconComp className="w-6 h-6" />
                </div>
                <span
                  className={`text-[10px] mt-1 font-black ${
                    item.isActive ? 'text-purple-900' : 'text-sky-800'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] min-h-[44px] cursor-pointer ${
                item.isActive
                  ? 'text-purple-800 font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title={item.label}
            >
              <div
                className={`p-1 rounded-xl transition-colors relative ${
                  item.isActive ? 'bg-purple-100/80 text-purple-900' : ''
                }`}
              >
                <IconComp className="w-5 h-5" />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-mono font-black bg-rose-600 text-white flex items-center justify-center ring-1 ring-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {item.label}
              </span>
              {item.isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
