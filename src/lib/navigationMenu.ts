import React from 'react';
import {
  Users,
  ShieldCheck,
  Crown,
  CreditCard,
  CheckSquare,
  HeartHandshake,
  FileSpreadsheet,
  UserCog,
  Settings,
  Globe,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react';
import { AppUser, UserAuthority, Member, Payment, BenefitClaim } from '../types';
import { MobileAppNavAction } from '../components/RoleMobileAppMenu';
import { getPermittedTabsForRole, RolePermissionsMap } from './permissions';

export interface NavigationActionParams {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeUser?: AppUser | null;
  permissions?: RolePermissionsMap;
  pendingRtVerificationCount?: number;
  pendingCount?: number; // Validasi Bendahara
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

/**
 * Menghasilkan seluruh item Menu Cepat Operasional berdasarkan hak akses (Navigation Bar) tiap user.
 * Menjamin SEMUA tab navigasi yang diizinkan untuk peran pengguna dimasukkan ke dalam Menu Cepat Operasional.
 */
export function getAllNavigationActionsForUser(params: NavigationActionParams): MobileAppNavAction[] {
  const {
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
  } = params;

  const authority: UserAuthority = activeUser ? activeUser.authority : 'Anggota';
  const permittedTabs = !activeUser ? ['public'] : getPermittedTabsForRole(authority, permissions);

  const actions: MobileAppNavAction[] = [];

  // 0. Dashboard Utama (Fitur Dashboard untuk Admin, Bendahara, dan Pengurus)
  if (permittedTabs.includes('dashboard')) {
    const isBendahara = authority === 'Bendahara';
    const isAdmin = authority === 'Admin';
    actions.push({
      id: 'dashboard',
      label: isBendahara ? 'Dashboard Kas' : isAdmin ? 'Dashboard Admin' : 'Dashboard Utama',
      subLabel: isBendahara ? 'Ringkasan Kas & Mutasi Realtime' : 'Statistik & Monitoring Wilayah',
      gradient: isBendahara ? 'from-emerald-600 to-teal-500' : 'from-indigo-600 to-purple-600',
      icon: LayoutDashboard,
      badge: isBendahara && pendingCount > 0 ? `${pendingCount} Validasi` : 'Utama',
      badgeColor: isBendahara && pendingCount > 0 ? 'amber' : 'sky',
      isActive: currentTab === 'dashboard',
      onClick: () => setCurrentTab('dashboard'),
    });
  }

  // 1. Halaman Anggota (Khusus Anggota)
  if (permittedTabs.includes('member-portal')) {
    actions.push({
      id: 'member-portal',
      label: 'Halaman Anggota',
      subLabel: 'KTA Digital & Status Keanggotaan',
      gradient: 'from-emerald-600 to-teal-500',
      icon: UserCheck,
      badge: myMember?.isKtaIssued ? 'KTA Aktif' : 'Draft',
      badgeColor: 'emerald',
      onClick: () => {
        if (onOpenDigitalKta && myMember) {
          onOpenDigitalKta(myMember);
        }
        setCurrentTab('member-portal');
      },
    });
  }

  // 3. Verifikasi Berkas RT / Supervisi RT
  if (permittedTabs.includes('rt-verification')) {
    const isRt = authority === 'Ketua RT (Cluster)';
    actions.push({
      id: 'rt-verification',
      label: isRt ? 'Verifikasi RT' : 'Monitoring Berkas RT',
      subLabel: isRt ? 'Verifikasi Berkas Warga Baru' : 'Supervisi Antrean Berkas RT',
      badge: pendingRtVerificationCount > 0 ? `${pendingRtVerificationCount} Baru` : undefined,
      badgeColor: 'amber',
      gradient: 'from-amber-500 to-orange-500',
      icon: ShieldCheck,
      onClick: () => setCurrentTab('rt-verification'),
    });
  }

  // 4. Persetujuan Paguyuban & Terbit KTA
  if (permittedTabs.includes('paguyuban-approval')) {
    actions.push({
      id: 'paguyuban-approval',
      label: authority === 'Ketua Paguyuban' ? 'Persetujuan Ketua' : 'Persetujuan Paguyuban',
      subLabel: 'Pengesahan Akhir & Terbit KTA',
      badge: pendingPaguyubanApprovalCount > 0 ? `${pendingPaguyubanApprovalCount} Berkas` : undefined,
      badgeColor: 'purple',
      gradient: 'from-purple-600 to-indigo-600',
      icon: Crown,
      onClick: () => setCurrentTab('paguyuban-approval'),
    });
  }

  // 5. Validasi Kas Masuk & Kwitansi (Bendahara / Admin)
  if (permittedTabs.includes('validation')) {
    actions.push({
      id: 'validation',
      label: authority === 'Bendahara' ? 'Validasi Kas Masuk' : 'Validasi Admin',
      subLabel: overdueGraceCount > 0 ? `${overdueGraceCount} Kritis >30h` : 'Persetujuan Setoran Kas',
      badge:
        overdueGraceCount > 0
          ? `${overdueGraceCount} Overdue`
          : pendingCount > 0
          ? `${pendingCount} Baru`
          : undefined,
      badgeColor: overdueGraceCount > 0 ? 'rose' : 'emerald',
      gradient: overdueGraceCount > 0 ? 'from-rose-600 to-red-600' : 'from-emerald-600 to-teal-500',
      icon: CheckSquare,
      onClick: () => setCurrentTab('validation'),
    });
  }

  // 6. Bayar / Catat Iuran
  if (permittedTabs.includes('payment')) {
    let label = 'Bayar Iuran';
    let subLabel = 'Setor Iuran Kas Kematian';
    if (authority === 'Ketua RT (Cluster)') {
      label = 'Setor Kas RT';
      subLabel = 'Kolektif / Setor Kas Wilayah';
    } else if (authority === 'Bendahara' || authority === 'Admin') {
      label = 'Terima Iuran';
      subLabel = 'Catat Pembayaran Iuran Baru';
    }

    actions.push({
      id: 'payment',
      label,
      subLabel,
      gradient: 'from-blue-600 to-indigo-500',
      icon: CreditCard,
      onClick: () => {
        if (onSelectMemberForPayment && myMember) {
          onSelectMemberForPayment(myMember);
        }
        setCurrentTab('payment');
      },
    });
  }

  // 7. Pendaftaran Anggota / Direktori Warga
  if (permittedTabs.includes('registration')) {
    let label = 'Data Warga';
    let subLabel = 'Database KK & Anggota';
    if (authority === 'Ketua RT (Cluster)') {
      label = 'Data Warga Cluster';
      subLabel = 'Kelola Warga & Tambah KK';
    } else if (authority === 'Anggota') {
      label = 'Data Diri & Keluarga';
      subLabel = 'Profil & Daftar Tanggungan';
    } else if (authority === 'Ketua RW') {
      label = 'Direktori Warga RW';
      subLabel = 'Data Warga Lintas Cluster';
    } else if (authority === 'Ketua DKM') {
      label = 'Direktori Jamaah';
      subLabel = 'Database Umat & Ahli Waris';
    } else if (authority === 'Admin') {
      label = 'Pendaftaran & Warga';
      subLabel = 'Kelola Semua Data Anggota';
    }

    actions.push({
      id: 'registration',
      label,
      subLabel,
      badge: totalMembersCount > 0 ? `${totalMembersCount} KK` : undefined,
      badgeColor: 'sky',
      gradient: 'from-cyan-600 to-blue-600',
      icon: Users,
      onClick: () => setCurrentTab('registration'),
    });
  }

  // 8. Realisasi Santunan Duka
  if (permittedTabs.includes('realization')) {
    let label = 'Klaim Santunan Duka';
    let subLabel = 'Penyaluran Santunan Warga';
    if (authority === 'Ketua DKM') {
      label = 'Santunan & Jenazah';
      subLabel = 'Fardhu Kifayah & Manfaat Duka';
    } else if (authority === 'Ketua RW') {
      label = 'Klaim Duka RW';
      subLabel = 'Pengawasan Santunan Tingkat RW';
    } else if (authority === 'Anggota') {
      label = 'Klaim Manfaat Duka';
      subLabel = 'Pengajuan Bantuan Duka Cita';
    }

    actions.push({
      id: 'realization',
      label,
      subLabel,
      badge: totalClaimsCount > 0 ? `${totalClaimsCount} Klaim` : undefined,
      badgeColor: 'rose',
      gradient: 'from-rose-600 to-pink-500',
      icon: HeartHandshake,
      onClick: () => setCurrentTab('realization'),
    });
  }

  // 9. Riwayat Transaksi & Pembukuan Kas (CSV)
  if (permittedTabs.includes('history')) {
    let label = 'Riwayat Transaksi';
    let subLabel = 'Kwitansi & Mutasi Pembayaran';
    if (authority === 'Bendahara') {
      label = 'Pembukuan Kas';
      subLabel = 'Rekap Kas, Mutasi & CSV';
    } else if (authority === 'Ketua RW') {
      label = 'Laporan Kas RW';
      subLabel = 'Rekapitulasi Keuangan Seluruh RT';
    } else if (authority === 'Ketua DKM') {
      label = 'Laporan Santunan';
      subLabel = 'Transparansi Penyaluran Jamaah';
    } else if (authority === 'Ketua Paguyuban') {
      label = 'Laporan Kas Paguyuban';
      subLabel = 'Rekapitulasi Keuangan & CSV';
    }

    actions.push({
      id: 'history',
      label,
      subLabel,
      badge: totalPaymentsCount > 0 ? `${totalPaymentsCount} Trx` : undefined,
      badgeColor: 'purple',
      gradient: 'from-purple-600 to-indigo-500',
      icon: FileSpreadsheet,
      onClick: () => setCurrentTab('history'),
    });
  }

  // 10. Pengguna & Otoritas (Admin)
  if (permittedTabs.includes('users')) {
    actions.push({
      id: 'users',
      label: 'Pengguna & Otoritas',
      subLabel: 'Hak Akses & Pengguna Sistem',
      badge: totalUsersCount > 0 ? `${totalUsersCount} Akun` : undefined,
      badgeColor: 'purple',
      gradient: 'from-violet-600 to-purple-600',
      icon: UserCog,
      onClick: () => setCurrentTab('users'),
    });
  }

  // 11. Pengaturan Sistem (Admin)
  if (permittedTabs.includes('settings')) {
    actions.push({
      id: 'settings',
      label: 'Pengaturan Sistem',
      subLabel: 'Iuran, Rekening Bank & Master',
      gradient: 'from-slate-700 to-slate-900',
      icon: Settings,
      onClick: () => setCurrentTab('settings'),
    });
  }

  // 12. Portal Warga (Landing Page Publik)
  if (permittedTabs.includes('public')) {
    actions.push({
      id: 'public',
      label: 'Portal Warga (Publik)',
      subLabel: 'Informasi Terbuka & Formulir',
      gradient: 'from-teal-600 to-emerald-600',
      icon: Globe,
      onClick: () => setCurrentTab('public'),
    });
  }

  return actions;
}
