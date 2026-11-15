import { useState, useEffect, useCallback } from 'react';
import { AppNotification, UserAuthority, USER_AUTHORITIES, AppUser } from '../types';

export type PermissionKey =
  // Laporan & Rekapitulasi (Reports)
  | 'view_reports'
  | 'export_reports'
  | 'view_audit_logs'
  // Keuangan & Validasi Iuran (Payments)
  | 'approve_payments'
  | 'reject_payments'
  | 'record_payments'
  | 'issue_receipts'
  // Santunan & Realisasi Klaim Duka (Claims)
  | 'process_claims'
  | 'view_claims'
  // Keanggotaan & Warga (Members)
  | 'register_members'
  | 'verify_rt_members'
  | 'approve_paguyuban'
  | 'manage_dependents'
  | 'view_member_directory'
  // Administrasi & Pengaturan Sistem (System & Admin)
  | 'manage_users'
  | 'configure_authority'
  | 'configure_settings'
  | 'switch_simulation';

export type PermissionCategory = 'reports' | 'payments' | 'claims' | 'members' | 'system';

export interface GranularPermissionDef {
  key: PermissionKey;
  label: string; // e.g. 'View Reports', 'Approve Payments', 'Register Members'
  indonesianLabel: string;
  description: string;
  category: PermissionCategory;
  categoryLabel: string;
  iconName: 'file-text' | 'download' | 'activity' | 'check-circle' | 'x-circle' | 'credit-card' | 'receipt' | 'heart' | 'eye' | 'user-plus' | 'shield-check' | 'crown' | 'users' | 'id-card' | 'user-cog' | 'shield' | 'settings' | 'log-in';
  badgeColor: string;
}

export const GRANULAR_PERMISSION_DEFS: GranularPermissionDef[] = [
  // 1. Reports & Transparency
  {
    key: 'view_reports',
    label: 'View Reports',
    indonesianLabel: 'Lihat Laporan & Rekapitulasi Kas',
    description: 'Melihat ringkasan pembukuan kas, rekapitulasi iuran warga, dan mutasi saldo paguyuban.',
    category: 'reports',
    categoryLabel: 'Laporan & Transparansi',
    iconName: 'file-text',
    badgeColor: 'sky',
  },
  {
    key: 'export_reports',
    label: 'Export Reports',
    indonesianLabel: 'Ekspor Laporan PDF & CSV',
    description: 'Mengunduh rekapitulasi keuangan kas kematian dalam format file CSV / dokumen cetak.',
    category: 'reports',
    categoryLabel: 'Laporan & Transparansi',
    iconName: 'download',
    badgeColor: 'sky',
  },
  {
    key: 'view_audit_logs',
    label: 'View Audit Logs',
    indonesianLabel: 'Lihat Log Aktivitas & Notifikasi',
    description: 'Memantau riwayat aktivitas transaksi, verifikasi pendaftaran, dan notifikasi sistem.',
    category: 'reports',
    categoryLabel: 'Laporan & Transparansi',
    iconName: 'activity',
    badgeColor: 'sky',
  },

  // 2. Payments & Treasury
  {
    key: 'approve_payments',
    label: 'Approve Payments',
    indonesianLabel: 'Validasi & Setujui Pembayaran Iuran',
    description: 'Menyetujui bukti transfer pembayaran iuran dan mengesahkan status aktif keanggotaan (Wewenang Bendahara).',
    category: 'payments',
    categoryLabel: 'Keuangan & Kas Iuran',
    iconName: 'check-circle',
    badgeColor: 'emerald',
  },
  {
    key: 'reject_payments',
    label: 'Reject Payments',
    indonesianLabel: 'Tolak Pembayaran Bermasalah',
    description: 'Menolak transaksi iuran yang tidak sesuai dengan menyertakan alasan penolakan ke warga (Wewenang Bendahara).',
    category: 'payments',
    categoryLabel: 'Keuangan & Kas Iuran',
    iconName: 'x-circle',
    badgeColor: 'emerald',
  },
  {
    key: 'record_payments',
    label: 'Record Payments',
    indonesianLabel: 'Input & Catat Pembayaran Iuran',
    description: 'Mengunggah bukti bayar atau mencatat pembayaran iuran tahunan secara manual.',
    category: 'payments',
    categoryLabel: 'Keuangan & Kas Iuran',
    iconName: 'credit-card',
    badgeColor: 'emerald',
  },
  {
    key: 'issue_receipts',
    label: 'Issue Official Receipts',
    indonesianLabel: 'Penerbitan Kwitansi Resmi Digital',
    description: 'Menerbitkan kwitansi resmi dengan nomor bukti, tanda tangan digital, dan stempel bendahara.',
    category: 'payments',
    categoryLabel: 'Keuangan & Kas Iuran',
    iconName: 'receipt',
    badgeColor: 'emerald',
  },

  // 3. Benefit & Claims
  {
    key: 'process_claims',
    label: 'Process Benefit Claims',
    indonesianLabel: 'Proses & Realisasi Santunan Duka',
    description: 'Mencatat santunan duka cita, rincian biaya fardhu kifayah jenazah, dan pengeluaran kas.',
    category: 'claims',
    categoryLabel: 'Santunan & Klaim Duka',
    iconName: 'heart',
    badgeColor: 'rose',
  },
  {
    key: 'view_claims',
    label: 'View Benefit Claims',
    indonesianLabel: 'Lihat Riwayat Penyaluran Santunan',
    description: 'Melihat transparansi penyaluran bantuan duka dan rincian santunan kepada ahli waris.',
    category: 'claims',
    categoryLabel: 'Santunan & Klaim Duka',
    iconName: 'eye',
    badgeColor: 'rose',
  },

  // 4. Membership & Residents
  {
    key: 'register_members',
    label: 'Register Members',
    indonesianLabel: 'Pendaftaran Warga & Anggota Baru',
    description: 'Mendaftarkan kepala keluarga baru, mengisi data NIK, alamat, dan mengunggah foto KK.',
    category: 'members',
    categoryLabel: 'Keanggotaan & Warga',
    iconName: 'user-plus',
    badgeColor: 'indigo',
  },
  {
    key: 'verify_rt_members',
    label: 'Verify RT Members',
    indonesianLabel: 'Verifikasi Berkas Warga Cluster RT',
    description: 'Wewenang Ketua RT untuk memeriksa keabsahan domisili dan dokumen Kartu Keluarga warga sebelum bayar.',
    category: 'members',
    categoryLabel: 'Keanggotaan & Warga',
    iconName: 'shield-check',
    badgeColor: 'indigo',
  },
  {
    key: 'approve_paguyuban',
    label: 'Paguyuban Final Approval',
    indonesianLabel: 'Persetujuan Akhir & Terbit KTA (Ketua Paguyuban)',
    description: 'Wewenang mutlak persetujuan akhir registrasi anggota dan pengesahan penerbitan KTA resmi setelah divalidasi bendahara.',
    category: 'members',
    categoryLabel: 'Keanggotaan & Warga',
    iconName: 'crown',
    badgeColor: 'purple',
  },
  {
    key: 'manage_dependents',
    label: 'Manage Dependents',
    indonesianLabel: 'Kelola Anggota Keluarga & Tanggungan',
    description: 'Menambah, mengubah, atau memperbarui daftar tanggungan istri/anak/orang tua serumah.',
    category: 'members',
    categoryLabel: 'Keanggotaan & Warga',
    iconName: 'users',
    badgeColor: 'indigo',
  },
  {
    key: 'view_member_directory',
    label: 'View Member Directory',
    indonesianLabel: 'Akses Direktori Anggota & KTA Digital',
    description: 'Melihat kartu tanda anggota digital, status kepesertaan, dan direktori keanggotaan warga.',
    category: 'members',
    categoryLabel: 'Keanggotaan & Warga',
    iconName: 'id-card',
    badgeColor: 'indigo',
  },

  // 5. System Administration & Access
  {
    key: 'manage_users',
    label: 'Manage Users',
    indonesianLabel: 'Kelola Akun & Kredensial Pengguna',
    description: 'Menambah akun login baru, mereset password, dan mengaktifkan/menonaktifkan akun.',
    category: 'system',
    categoryLabel: 'Administrasi & Pengaturan',
    iconName: 'user-cog',
    badgeColor: 'amber',
  },
  {
    key: 'configure_authority',
    label: 'Configure Authority',
    indonesianLabel: 'Atur Hak Otoritas & Kontrol Izin Granular',
    description: 'Mengubah level otoritas akun dan mengonfigurasi centang izin granular tiap peran.',
    category: 'system',
    categoryLabel: 'Administrasi & Pengaturan',
    iconName: 'shield',
    badgeColor: 'amber',
  },
  {
    key: 'configure_settings',
    label: 'Configure Settings',
    indonesianLabel: 'Pengaturan Master Kas & Sistem Paguyuban',
    description: 'Mengubah nominal iuran tahunan, nomor rekening bank, master cluster RT, dan paket santunan.',
    category: 'system',
    categoryLabel: 'Administrasi & Pengaturan',
    iconName: 'settings',
    badgeColor: 'amber',
  },
  {
    key: 'switch_simulation',
    label: 'Simulate User Roles',
    indonesianLabel: 'Simulasi Peran Pengguna (Switch User)',
    description: 'Kemampuan untuk beralih sesi login sementara guna menguji pengalaman pengguna lain.',
    category: 'system',
    categoryLabel: 'Administrasi & Pengaturan',
    iconName: 'log-in',
    badgeColor: 'amber',
  },
];

export type RolePermissionsMap = Record<UserAuthority, Record<PermissionKey, boolean>>;

// Baseline Default Role-Based Access Control Setup
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  'Ketua Paguyuban': {
    view_reports: true,
    export_reports: true,
    view_audit_logs: true,
    approve_payments: false, // Wewenang Bendahara
    reject_payments: false,  // Wewenang Bendahara
    record_payments: false,
    issue_receipts: false,   // Wewenang Bendahara
    process_claims: true,    // Wewenang pengesahan santunan duka cita
    view_claims: true,
    register_members: true,
    verify_rt_members: false, // Wewenang Ketua RT
    approve_paguyuban: true, // Wewenang mutlak Ketua Paguyuban (Persetujuan Akhir & KTA)
    manage_dependents: true,
    view_member_directory: true,
    manage_users: false,     // Wewenang Admin
    configure_authority: false, // Wewenang Admin
    configure_settings: false,  // Wewenang Admin
    switch_simulation: true,
  },
  Admin: {
    view_reports: true,
    export_reports: true,
    view_audit_logs: true,
    approve_payments: true,
    reject_payments: true,
    record_payments: true,
    issue_receipts: true,
    process_claims: true,
    view_claims: true,
    register_members: true,
    verify_rt_members: true,
    approve_paguyuban: true,
    manage_dependents: true,
    view_member_directory: true,
    manage_users: true,
    configure_authority: true,
    configure_settings: true,
    switch_simulation: true,
  },
  Bendahara: {
    view_reports: true,
    export_reports: true,
    view_audit_logs: true,
    approve_payments: true,
    reject_payments: true,
    record_payments: true,
    issue_receipts: true,
    process_claims: true,
    view_claims: true,
    register_members: true,
    verify_rt_members: false,
    approve_paguyuban: false,
    manage_dependents: true,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: true,
  },
  'Ketua RT (Cluster)': {
    view_reports: true,
    export_reports: true,
    view_audit_logs: false,
    approve_payments: false,
    reject_payments: false,
    record_payments: true,
    issue_receipts: false,
    process_claims: true, // Wewenang input & pengajuan klaim santunan duka warga RT
    view_claims: true,
    register_members: true,
    verify_rt_members: true,
    approve_paguyuban: false,
    manage_dependents: true,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: true,
  },
  'Ketua RW': {
    view_reports: true,
    export_reports: true,
    view_audit_logs: true,
    approve_payments: false,
    reject_payments: false,
    record_payments: false,
    issue_receipts: false,
    process_claims: false,
    view_claims: true,
    register_members: false,
    verify_rt_members: false,
    approve_paguyuban: false,
    manage_dependents: false,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: true,
  },
  'Ketua DKM': {
    view_reports: true,
    export_reports: false,
    view_audit_logs: false,
    approve_payments: false,
    reject_payments: false,
    record_payments: false,
    issue_receipts: false,
    process_claims: false,
    view_claims: true,
    register_members: false,
    verify_rt_members: false,
    approve_paguyuban: false,
    manage_dependents: false,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: true,
  },
  Anggota: {
    view_reports: true,
    export_reports: false,
    view_audit_logs: false,
    approve_payments: false,
    reject_payments: false,
    record_payments: true,
    issue_receipts: false,
    process_claims: false,
    view_claims: true,
    register_members: true,
    verify_rt_members: false,
    approve_paguyuban: false,
    manage_dependents: true,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: false,
  },
  'Petugas Staf': {
    view_reports: true,
    export_reports: true,
    view_audit_logs: true,
    approve_payments: false,
    reject_payments: false,
    record_payments: false,
    issue_receipts: false,
    process_claims: false,
    view_claims: true,
    register_members: false,
    verify_rt_members: false,
    approve_paguyuban: false,
    manage_dependents: false,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: true,
  },
  Driver: {
    view_reports: false,
    export_reports: false,
    view_audit_logs: false,
    approve_payments: false,
    reject_payments: false,
    record_payments: false,
    issue_receipts: false,
    process_claims: false,
    view_claims: false,
    register_members: false,
    verify_rt_members: false,
    approve_paguyuban: false,
    manage_dependents: false,
    view_member_directory: true,
    manage_users: false,
    configure_authority: false,
    configure_settings: false,
    switch_simulation: true,
  },
};

const STORAGE_KEY = 'dana_kematian_granular_permissions_v2';
export const PERMISSION_UPDATED_EVENT = 'dana_kematian_permissions_updated';

export const getStoredRolePermissions = (): RolePermissionsMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check legacy v1 and migrate if present
      const rawLegacy = localStorage.getItem('dana_kematian_granular_permissions_v1');
      if (rawLegacy) {
        try {
          const parsedLegacy = JSON.parse(rawLegacy);
          const migrated: RolePermissionsMap = { ...DEFAULT_ROLE_PERMISSIONS };
          USER_AUTHORITIES.forEach((auth) => {
            migrated[auth] = {
              ...DEFAULT_ROLE_PERMISSIONS[auth],
              ...(parsedLegacy[auth] || {}),
              // Ensure Ketua Paguyuban uses clean role boundaries
              ...(auth === 'Ketua Paguyuban'
                ? {
                    approve_paguyuban: true,
                    approve_payments: false,
                    reject_payments: false,
                    issue_receipts: false,
                    verify_rt_members: false,
                    manage_users: false,
                    configure_authority: false,
                    configure_settings: false,
                  }
                : {}),
            };
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        } catch {
          // fallback to defaults
        }
      }
      return DEFAULT_ROLE_PERMISSIONS;
    }
    const parsed = JSON.parse(raw);

    // Merge with defaults in case of missing keys
    const merged: RolePermissionsMap = { ...DEFAULT_ROLE_PERMISSIONS };
    USER_AUTHORITIES.forEach((auth) => {
      merged[auth] = {
        ...DEFAULT_ROLE_PERMISSIONS[auth],
        ...(parsed[auth] || {}),
      };
      if (typeof merged[auth].approve_paguyuban === 'undefined') {
        merged[auth].approve_paguyuban = DEFAULT_ROLE_PERMISSIONS[auth].approve_paguyuban;
      }
      // Ensure Ketua RT always has process_claims & view_claims enabled
      if (auth === 'Ketua RT (Cluster)') {
        merged[auth].process_claims = true;
        merged[auth].view_claims = true;
        merged[auth].verify_rt_members = true;
      }
      if (auth === 'Anggota') {
        merged[auth].record_payments = true;
      }
    });
    return merged;
  } catch (err) {
    console.error('Failed to read granular permissions from storage:', err);
    return DEFAULT_ROLE_PERMISSIONS;
  }
};

export const saveStoredRolePermissions = (perms: RolePermissionsMap): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PERMISSION_UPDATED_EVENT, { detail: perms }));
    }
  } catch (err) {
    console.error('Failed to save granular permissions to storage:', err);
  }
};

export const resetStoredRolePermissions = (): RolePermissionsMap => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('dana_kematian_granular_permissions_v1');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PERMISSION_UPDATED_EVENT, { detail: DEFAULT_ROLE_PERMISSIONS }));
    }
  } catch (err) {
    console.error('Failed to reset granular permissions:', err);
  }
  return DEFAULT_ROLE_PERMISSIONS;
};

export const hasPermission = (
  role: UserAuthority | string | undefined,
  permKey: PermissionKey,
  customPerms?: RolePermissionsMap
): boolean => {
  if (!role) return false;
  const effectiveRole: UserAuthority =
    role === 'Ketua RT' || (typeof role === 'string' && role.includes('RT'))
      ? 'Ketua RT (Cluster)'
      : (role as UserAuthority);
  const perms = customPerms || getStoredRolePermissions();
  return !!perms[effectiveRole]?.[permKey];
};

/**
 * Memeriksa apakah pengguna/otoritas memiliki hak akses ke modul Inventaris Duka.
 * Aturan Kebijakan: Inventaris Duka HANYA dapat diakses oleh Admin, Bendahara, Ketua (Ketua Paguyuban & Ketua RW), dan DKM (Ketua DKM).
 */
export const isAuthorizedForFuneralInventory = (
  authorityOrUser?: AppUser | UserAuthority | string | null
): boolean => {
  if (!authorityOrUser) return false;
  const authority: string =
    typeof authorityOrUser === 'string'
      ? authorityOrUser
      : (authorityOrUser as AppUser).authority;
  if (!authority) return false;

  const normalized = authority.toLowerCase().trim();

  // 1. Admin
  if (normalized === 'admin' || normalized.includes('admin')) {
    return true;
  }

  // 2. Bendahara
  if (normalized === 'bendahara' || normalized.includes('bendahara')) {
    return true;
  }

  // 3. DKM (Ketua DKM Masjid)
  if (normalized === 'ketua dkm' || normalized.includes('dkm')) {
    return true;
  }

  // 4. Ketua (Ketua Paguyuban dan Ketua RW, selain RT)
  if (
    normalized === 'ketua paguyuban' ||
    normalized === 'ketua rw' ||
    (normalized.includes('ketua') && !normalized.includes('rt'))
  ) {
    return true;
  }

  return false;
};

export const getPermittedTabsForRole = (
  role: UserAuthority | string | undefined,
  permsMap?: RolePermissionsMap
): string[] => {
  if (!role) {
    return ['public', 'registration'];
  }
  const effectiveRole: UserAuthority =
    role === 'Ketua RT' || (typeof role === 'string' && role.includes('RT'))
      ? 'Ketua RT (Cluster)'
      : (role as UserAuthority);
  const perms = permsMap || getStoredRolePermissions();
  const rolePerms = perms[effectiveRole] || DEFAULT_ROLE_PERMISSIONS[effectiveRole] || DEFAULT_ROLE_PERMISSIONS['Anggota'];

  if (effectiveRole === 'Anggota') {
    const tabs = ['member-portal', 'public', 'payment', 'registration'];
    if (rolePerms.view_reports) tabs.push('history');
    if (rolePerms.view_claims || rolePerms.process_claims) tabs.push('realization');
    return Array.from(new Set(tabs));
  }

  const tabs: string[] = ['dashboard'];

  // Registration / Direktori Warga
  if (rolePerms.register_members || rolePerms.view_member_directory) {
    tabs.push('registration');
  }

  // Persetujuan Ketua Paguyuban & Terbit KTA
  if (rolePerms.approve_paguyuban) {
    tabs.push('paguyuban-approval');
  }

  // Verifikasi RT (Cluster)
  // Pengguna dengan izin verify_rt_members, atau pengawas (Ketua Paguyuban/RW/Admin) jika memiliki view_member_directory (mode monitoring)
  if (
    rolePerms.verify_rt_members ||
    (rolePerms.view_member_directory && (effectiveRole === 'Ketua Paguyuban' || effectiveRole === 'Ketua RW' || effectiveRole === 'Admin'))
  ) {
    tabs.push('rt-verification');
  }

  // Pembayaran Iuran
  if (rolePerms.record_payments) {
    tabs.push('payment');
  }

  // Validasi Kas & Kwitansi
  if (rolePerms.approve_payments || rolePerms.reject_payments || rolePerms.issue_receipts) {
    tabs.push('validation');
  }

  // Audit Status (Khusus Admin)
  if (effectiveRole === 'Admin') {
    tabs.push('audit-status');
  }

  // Realisasi Santunan Duka
  if (rolePerms.process_claims || rolePerms.view_claims) {
    tabs.push('realization');
  }

  // Laporan & Rekapitulasi Kas
  if (rolePerms.view_reports) {
    tabs.push('history');
  }

  // Pengguna & Otoritas
  if (rolePerms.manage_users || rolePerms.configure_authority) {
    tabs.push('users');
  }

  // Pengaturan Kas & Sistem
  if (rolePerms.configure_settings) {
    tabs.push('settings');
  }

  // Layanan Ambulans Siaga & Jadwal Pemakaman
  tabs.push('ambulance');
  tabs.push('funeral-schedule');

  // Modul Inventaris Duka & Logistik Operasional (HANYA Admin, Bendahara, Ketua, dan DKM)
  if (isAuthorizedForFuneralInventory(effectiveRole)) {
    tabs.push('inventory');
  }

  return tabs;
};

export const useRolePermissions = () => {
  const [permissions, setPermissions] = useState<RolePermissionsMap>(() => getStoredRolePermissions());

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<RolePermissionsMap>;
      if (customEvent.detail) {
        setPermissions(customEvent.detail);
      } else {
        setPermissions(getStoredRolePermissions());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || !e.key) {
        setPermissions(getStoredRolePermissions());
      }
    };

    window.addEventListener(PERMISSION_UPDATED_EVENT, handleUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(PERMISSION_UPDATED_EVENT, handleUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const can = useCallback(
    (role: UserAuthority | undefined, permKey: PermissionKey): boolean => {
      return hasPermission(role, permKey, permissions);
    },
    [permissions]
  );

  return {
    permissions,
    can,
    refreshPermissions: () => setPermissions(getStoredRolePermissions()),
  };
};

/**
 * Normalizes legacy notification linkTab identifiers to valid App currentTab IDs.
 */
export const resolveNotificationTargetTab = (
  linkTab: string | undefined,
  role: UserAuthority | string | undefined,
  permsMap?: RolePermissionsMap
): string | null => {
  if (!linkTab || !role) return null;
  const raw = linkTab.trim().toLowerCase();
  const normalized =
    raw === 'payments'
      ? hasPermission(role, 'approve_payments', permsMap)
        ? 'validation'
        : 'history'
      : raw === 'funeral'
      ? 'funeral-schedule'
      : raw;

  const permitted = getPermittedTabsForRole(role, permsMap);
  return permitted.includes(normalized) ? normalized : null;
};

/**
 * Determines whether an AppNotification is relevant and authorized for the given activeUser.
 * Enforces strict Role/Authority RBAC, Ketua RT cluster isolation, Anggota self-only scope,
 * and Admin-only visibility for Audit Status & administrative system logs.
 */
export const isNotificationRelevantToUser = (
  notif: AppNotification,
  activeUser: AppUser | null | undefined,
  myMemberId?: string,
  permsMap?: RolePermissionsMap
): boolean => {
  // Unauthenticated guests have zero authority to see internal notifications
  if (!activeUser) return false;

  const rawAuthStr = String(activeUser.authority || 'Anggota');
  const effectiveRole: UserAuthority =
    rawAuthStr === 'Ketua RT' || rawAuthStr.includes('RT')
      ? 'Ketua RT (Cluster)'
      : (rawAuthStr as UserAuthority);

  // Admin has full system oversight authority
  if (effectiveRole === 'Admin') {
    return true;
  }

  const perms = permsMap || getStoredRolePermissions();
  const rolePerms =
    perms[effectiveRole] ||
    DEFAULT_ROLE_PERMISSIONS[effectiveRole] ||
    DEFAULT_ROLE_PERMISSIONS['Anggota'];

  const titleLower = (notif.title || '').toLowerCase();
  const linkTab = (notif.linkTab || '').toLowerCase();

  // Admin-only system audit, deletion, and admin configuration alerts
  const isAdminOnlyNotif =
    linkTab === 'audit-status' ||
    linkTab === 'users' ||
    linkTab === 'settings' ||
    titleLower.includes('audit status') ||
    titleLower.includes('audit npa') ||
    titleLower.includes('dihapus oleh admin') ||
    titleLower.includes('record registrasi anggota dihapus') ||
    titleLower.includes('transaksi telah dikosongkan');

  if (isAdminOnlyNotif) {
    return false;
  }

  // Anggota: ONLY notifications tied directly to their own memberId (and not internal officer logs)
  if (effectiveRole === 'Anggota') {
    const resolvedOwnMemberId = myMemberId || activeUser.memberId;
    if (!resolvedOwnMemberId || !notif.memberId || notif.memberId !== resolvedOwnMemberId) {
      return false;
    }
    if (notif.category === 'system') {
      return false;
    }
    if (
      linkTab === 'validation' ||
      linkTab === 'rt-verification' ||
      linkTab === 'paguyuban-approval' ||
      linkTab === 'inventory'
    ) {
      return (
        titleLower.includes('disetujui') ||
        titleLower.includes('terverifikasi') ||
        titleLower.includes('divalidasi') ||
        titleLower.includes('ditolak') ||
        titleLower.includes('diterbitkan')
      );
    }
    return true;
  }

  // Cluster isolation for Ketua RT (Cluster)
  if (effectiveRole === 'Ketua RT (Cluster)' && activeUser.cluster) {
    if (
      notif.cluster &&
      notif.cluster.trim().toLowerCase() !== activeUser.cluster.trim().toLowerCase()
    ) {
      return false;
    }
  }

  // LinkTab authorization guard (prevent officers seeing notifications for tabs they cannot access)
  if (linkTab) {
    if (linkTab === 'inventory' && !isAuthorizedForFuneralInventory(effectiveRole)) {
      return false;
    }
    if (
      linkTab === 'validation' &&
      !(rolePerms.approve_payments || rolePerms.reject_payments || rolePerms.issue_receipts)
    ) {
      return false;
    }
    if (
      linkTab === 'rt-verification' &&
      !(
        rolePerms.verify_rt_members ||
        effectiveRole === 'Ketua Paguyuban' ||
        effectiveRole === 'Ketua RW'
      )
    ) {
      return false;
    }
    if (linkTab === 'paguyuban-approval' && !rolePerms.approve_paguyuban) {
      return false;
    }
    if (linkTab === 'realization' && !(rolePerms.process_claims || rolePerms.view_claims)) {
      return false;
    }
    if (
      (linkTab === 'history' || linkTab === 'payments') &&
      !(
        rolePerms.approve_payments ||
        rolePerms.reject_payments ||
        rolePerms.record_payments ||
        effectiveRole === 'Ketua Paguyuban' ||
        effectiveRole === 'Ketua RW'
      )
    ) {
      return false;
    }
  }

  const isAmbulanceNotif =
    notif.category === 'ambulance' ||
    linkTab === 'ambulance' ||
    titleLower.includes('ambulans');
  const isFuneralNotif =
    notif.category === 'funeral' ||
    linkTab === 'funeral-schedule' ||
    linkTab === 'funeral' ||
    linkTab === 'inventory';

  if (isAmbulanceNotif) {
    return (
      effectiveRole === 'Bendahara' ||
      effectiveRole === 'Ketua Paguyuban' ||
      effectiveRole === 'Ketua RW' ||
      effectiveRole === 'Petugas Staf' ||
      effectiveRole === 'Driver' ||
      effectiveRole === 'Ketua RT (Cluster)'
    );
  }

  if (isFuneralNotif) {
    if (linkTab === 'inventory') {
      return isAuthorizedForFuneralInventory(effectiveRole);
    }
    return (
      effectiveRole === 'Bendahara' ||
      effectiveRole === 'Ketua Paguyuban' ||
      effectiveRole === 'Ketua RW' ||
      effectiveRole === 'Ketua DKM' ||
      effectiveRole === 'Petugas Staf' ||
      effectiveRole === 'Ketua RT (Cluster)'
    );
  }

  if (notif.category === 'payment') {
    return Boolean(
      rolePerms.approve_payments ||
        rolePerms.reject_payments ||
        rolePerms.record_payments ||
        effectiveRole === 'Ketua Paguyuban' ||
        effectiveRole === 'Ketua RW'
    );
  }

  if (notif.category === 'registration') {
    return Boolean(
      rolePerms.verify_rt_members ||
        rolePerms.approve_paguyuban ||
        rolePerms.register_members ||
        effectiveRole === 'Ketua RW'
    );
  }

  if (notif.category === 'claim') {
    return Boolean(rolePerms.process_claims || rolePerms.view_claims);
  }

  if (notif.category === 'system') {
    return Boolean(rolePerms.view_audit_logs);
  }

  return false;
};

export const filterNotificationsForUser = <T extends AppNotification>(
  notifications: T[] = [],
  activeUser: AppUser | null | undefined,
  myMemberId?: string,
  permsMap?: RolePermissionsMap
): T[] => {
  if (!activeUser || !notifications || notifications.length === 0) return [];
  return notifications.filter((n) =>
    isNotificationRelevantToUser(n, activeUser, myMemberId, permsMap)
  );
};
