import React, { useState, useMemo } from 'react';
import { UserAuthority, USER_AUTHORITIES } from '../types';
import {
  PermissionKey,
  PermissionCategory,
  GranularPermissionDef,
  GRANULAR_PERMISSION_DEFS,
  RolePermissionsMap,
  DEFAULT_ROLE_PERMISSIONS,
  getStoredRolePermissions,
  saveStoredRolePermissions,
  resetStoredRolePermissions,
  hasPermission,
} from '../lib/permissions';
import {
  Shield,
  ShieldCheck,
  Check,
  X,
  Search,
  Filter,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Sparkles,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  Building2,
  HeartHandshake,
  User,
  Users,
  CreditCard,
  FileText,
  Settings,
  Receipt,
  Download,
  Activity,
  Heart,
  Eye,
  UserPlus,
  ArrowRight,
  Crown,
} from 'lucide-react';

interface GranularAccessControlProps {
  activeUserAuthority?: UserAuthority;
  onPermissionsChange?: (permissions: RolePermissionsMap) => void;
}

export const GranularAccessControl: React.FC<GranularAccessControlProps> = ({
  activeUserAuthority = 'Admin',
  onPermissionsChange,
}) => {
  // State for permissions matrix
  const [permissions, setPermissions] = useState<RolePermissionsMap>(() => getStoredRolePermissions());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canConfigureAuthority =
    activeUserAuthority === 'Admin' ||
    hasPermission(activeUserAuthority as UserAuthority, 'configure_authority', permissions);

  // Filters
  const [selectedRoleTab, setSelectedRoleTab] = useState<'all' | UserAuthority>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | PermissionCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Toggle single permission for a role
  const handleTogglePermission = (role: UserAuthority, key: PermissionKey) => {
    if (!canConfigureAuthority) {
      showToast('Wewenang Terbatas: Hanya Administrator yang dapat mengubah hak akses granular.');
      return;
    }

    // Safety guard: prevent disabling vital admin access if role is Admin
    if (role === 'Admin' && (key === 'manage_users' || key === 'configure_authority')) {
      if (permissions.Admin[key]) {
        const confirmMsg =
          'Peringatan: Menonaktifkan izin ini untuk Administrator dapat membatasi kemampuan pengelolaan sistem Anda. Yakin ingin menonaktifkannya?';
        if (!window.confirm(confirmMsg)) return;
      }
    }

    setPermissions((prev) => {
      const nextRolePerms = {
        ...prev[role],
        [key]: !prev[role][key],
      };
      const updated = {
        ...prev,
        [role]: nextRolePerms,
      };
      setHasUnsavedChanges(true);
      return updated;
    });
  };

  // Bulk check / uncheck for a role
  const handleBulkSetRole = (role: UserAuthority, grantAll: boolean) => {
    if (!canConfigureAuthority) {
      showToast('Wewenang Terbatas: Hanya Administrator yang dapat mengubah hak akses granular.');
      return;
    }

    setPermissions((prev) => {
      const newRolePerms = { ...prev[role] };
      GRANULAR_PERMISSION_DEFS.forEach((p) => {
        // If category filter is active, only toggle filtered category
        if (selectedCategory === 'all' || p.category === selectedCategory) {
          if (role === 'Admin' && !grantAll && (p.key === 'manage_users' || p.key === 'configure_authority')) {
            // keep core admin controls enabled for safety
            newRolePerms[p.key] = true;
          } else {
            newRolePerms[p.key] = grantAll;
          }
        }
      });

      setHasUnsavedChanges(true);
      return {
        ...prev,
        [role]: newRolePerms,
      };
    });

    showToast(
      grantAll
        ? `Semua izin untuk ${role} berhasil dicentang (Diaktifkan)!`
        : `Semua izin untuk ${role} berhasil dibatalkan (Dinonaktifkan)!`
    );
  };

  // Bulk check / uncheck for a specific permission across all roles
  const handleBulkSetPermissionAcrossRoles = (key: PermissionKey, grantAll: boolean) => {
    if (!canConfigureAuthority) {
      showToast('Wewenang Terbatas: Hanya Administrator yang dapat mengubah hak akses granular.');
      return;
    }

    setPermissions((prev) => {
      const updated: RolePermissionsMap = { ...prev };
      USER_AUTHORITIES.forEach((role) => {
        if (role === 'Admin' && !grantAll && (key === 'manage_users' || key === 'configure_authority')) {
          updated[role] = { ...updated[role], [key]: true };
        } else {
          updated[role] = { ...updated[role], [key]: grantAll };
        }
      });
      setHasUnsavedChanges(true);
      return updated;
    });

    const permDef = GRANULAR_PERMISSION_DEFS.find((p) => p.key === key);
    showToast(
      grantAll
        ? `Izin "${permDef?.label || key}" diaktifkan untuk semua peran!`
        : `Izin "${permDef?.label || key}" dinonaktifkan untuk semua peran!`
    );
  };

  // Save changes to storage
  const handleSave = () => {
    if (!canConfigureAuthority) {
      showToast('Wewenang Terbatas: Anda tidak memiliki izin untuk menyimpan perubahan hak akses.');
      return;
    }

    saveStoredRolePermissions(permissions);
    setHasUnsavedChanges(false);
    if (onPermissionsChange) {
      onPermissionsChange(permissions);
    }
    showToast('Konfigurasi Hak Akses Granular berhasil disimpan dan aktif di seluruh sistem!');
  };

  // Reset to default
  const handleReset = () => {
    if (!canConfigureAuthority) {
      showToast('Wewenang Terbatas: Anda tidak memiliki izin untuk mereset hak akses.');
      return;
    }

    if (window.confirm('Kembalikan seluruh hak akses granular ke pengaturan standar rekomendasi paguyuban?')) {
      const defaultPerms = resetStoredRolePermissions();
      setPermissions(defaultPerms);
      setHasUnsavedChanges(false);
      if (onPermissionsChange) {
        onPermissionsChange(defaultPerms);
      }
      showToast('Hak akses granular telah dikembalikan ke standar rekomendasi sistem.');
    }
  };

  // Filtered permission items
  const filteredPermissions = useMemo(() => {
    return GRANULAR_PERMISSION_DEFS.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = p.label.toLowerCase().includes(q);
        const matchIdo = p.indonesianLabel.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchCat = p.categoryLabel.toLowerCase().includes(q);
        if (!matchLabel && !matchIdo && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Active counts per role
  const roleStats = useMemo(() => {
    const stats: Record<UserAuthority, { enabled: number; total: number }> = {} as any;
    USER_AUTHORITIES.forEach((role) => {
      const enabled = GRANULAR_PERMISSION_DEFS.filter((p) => permissions[role]?.[p.key]).length;
      stats[role] = { enabled, total: GRANULAR_PERMISSION_DEFS.length };
    });
    return stats;
  }, [permissions]);

  // Helper icons
  const renderPermissionIcon = (iconName: string) => {
    switch (iconName) {
      case 'file-text':
        return <FileText className="w-4 h-4" />;
      case 'download':
        return <Download className="w-4 h-4" />;
      case 'activity':
        return <Activity className="w-4 h-4" />;
      case 'check-circle':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'x-circle':
        return <AlertCircle className="w-4 h-4" />;
      case 'credit-card':
        return <CreditCard className="w-4 h-4" />;
      case 'receipt':
        return <Receipt className="w-4 h-4" />;
      case 'heart':
        return <Heart className="w-4 h-4" />;
      case 'eye':
        return <Eye className="w-4 h-4" />;
      case 'user-plus':
        return <UserPlus className="w-4 h-4" />;
      case 'shield-check':
        return <ShieldCheck className="w-4 h-4" />;
      case 'crown':
        return <Crown className="w-4 h-4" />;
      case 'users':
        return <Users className="w-4 h-4" />;
      case 'user-cog':
        return <User className="w-4 h-4" />;
      case 'settings':
        return <Settings className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getAuthorityBadgeColor = (auth: UserAuthority) => {
    switch (auth) {
      case 'Ketua Paguyuban':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Admin':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Bendahara':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Ketua RT (Cluster)':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Ketua RW':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Ketua DKM':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'Anggota':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getAuthorityIcon = (auth: UserAuthority) => {
    switch (auth) {
      case 'Ketua Paguyuban':
        return <Crown className="w-3.5 h-3.5 text-purple-700" />;
      case 'Admin':
        return <Shield className="w-3.5 h-3.5 text-indigo-700" />;
      case 'Bendahara':
        return <CreditCard className="w-3.5 h-3.5 text-emerald-700" />;
      case 'Ketua RT (Cluster)':
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />;
      case 'Ketua RW':
        return <Building2 className="w-3.5 h-3.5 text-purple-600" />;
      case 'Ketua DKM':
        return <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />;
      case 'Anggota':
        return <User className="w-3.5 h-3.5 text-slate-600" />;
      default:
        return <User className="w-3.5 h-3.5" />;
    }
  };

  // Group filtered permissions by category for card view
  const categoriesList: { key: PermissionCategory; label: string; color: string }[] = [
    { key: 'reports', label: 'Laporan & Transparansi (Reports)', color: 'border-sky-200 bg-sky-50/50 text-sky-900' },
    { key: 'payments', label: 'Keuangan & Validasi Iuran (Payments)', color: 'border-emerald-200 bg-emerald-50/50 text-emerald-900' },
    { key: 'claims', label: 'Santunan & Klaim Duka (Claims)', color: 'border-rose-200 bg-rose-50/50 text-rose-900' },
    { key: 'members', label: 'Keanggotaan & Warga (Members)', color: 'border-indigo-200 bg-indigo-50/50 text-indigo-900' },
    { key: 'system', label: 'Administrasi & Pengaturan Sistem (System)', color: 'border-amber-200 bg-amber-50/50 text-amber-900' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Hero / Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Granular Access Control Interface</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Kontrol Hak Akses & Perizinan Terperinci
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Atur hak operasional (centang/batalkan izin) secara granular untuk setiap level wewenang seperti{' '}
              <strong className="text-purple-300">Ketua Paguyuban</strong>,{' '}
              <strong className="text-amber-300">Ketua RT</strong>,{' '}
              <strong className="text-emerald-300">Bendahara</strong>, dan{' '}
              <strong className="text-indigo-300">Admin</strong> (misal: <em>View Reports</em>,{' '}
              <em>Approve Payments</em>, <em>Paguyuban Final Approval</em>, <em>Register Members</em>).
            </p>
          </div>

          {/* Action Buttons: Save & Reset */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canConfigureAuthority ? (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  title="Kembalikan semua izin ke standar rekomendasi"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset Default</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                    hasUnsavedChanges
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300/40 shadow-amber-950/30 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/30'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{hasUnsavedChanges ? 'Simpan Perubahan *' : 'Simpan Izin Akses'}</span>
                </button>
              </>
            ) : (
              <span className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800/90 text-slate-300 border border-slate-700 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Mode Hanya Lihat (Admin Only)</span>
              </span>
            )}
          </div>
        </div>

        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>
              Ada perubahan centang izin yang belum disimpan. Klik tombol <strong>"Simpan Perubahan"</strong> di atas agar berlaku di sistem.
            </span>
          </div>
        )}
      </div>

      {!canConfigureAuthority && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-indigo-900">
              Mode Supervisi & Monitoring Otoritas (Hanya Lihat)
            </p>
            <p className="text-indigo-800/90 leading-relaxed">
              Anda masuk dengan peran <strong>{activeUserAuthority}</strong>. Anda dapat melihat dan meninjau matriks perizinan granular yang sedang aktif di seluruh sistem secara transparan. Perubahan centang izin hanya dapat dilakukan oleh Administrator sistem.
            </p>
          </div>
        </div>
      )}

      {/* Role Summary Badges Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {USER_AUTHORITIES.map((role) => {
          const isSelected = selectedRoleTab === role;
          const stat = roleStats[role];
          const isCoreRequested = role === 'Ketua Paguyuban' || role === 'Ketua RT (Cluster)' || role === 'Bendahara' || role === 'Admin';
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRoleTab(selectedRoleTab === role ? 'all' : role)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${getAuthorityBadgeColor(
                    role
                  )}`}
                >
                  {getAuthorityIcon(role)}
                  <span className="truncate">{role}</span>
                </span>
                {isCoreRequested && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" title="Level Wewenang Utama" />
                )}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[11px] text-slate-500 font-medium">Izin Aktif:</span>
                <span className="text-xs font-black text-slate-800 font-mono">
                  {stat.enabled}/{stat.total}
                </span>
              </div>

              {/* Progress mini bar */}
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${(stat.enabled / stat.total) * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari perizinan (cth: Reports, Payments, Register, Verifikasi, Kwitansi...)"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode & Role Filter Selector */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Matriks
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartu Kategori
              </button>
            </div>

            {selectedRoleTab !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedRoleTab('all')}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 inline-flex items-center gap-1"
              >
                <span>Fokus: {selectedRoleTab}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Kategori ({GRANULAR_PERMISSION_DEFS.length})
          </button>
          {categoriesList.map((c) => {
            const count = GRANULAR_PERMISSION_DEFS.filter((p) => p.category === c.key).length;
            const isSelected = selectedCategory === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedCategory(c.key)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label.split('(')[0].trim()} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Guide Note */}
      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-start gap-3 text-xs text-indigo-950">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Panduan Kontrol Izin Granular:</p>
          <p className="text-slate-600 leading-relaxed">
            Klik pada kotak centang (<CheckSquare className="w-3.5 h-3.5 text-emerald-600 inline mx-0.5" /> diizinkan / <Square className="w-3.5 h-3.5 text-slate-400 inline mx-0.5" /> dinonaktifkan) untuk mengaktifkan atau mencabut hak operasional spesifik per level wewenang. Anda juga dapat menggunakan tombol <strong>Centang Semua</strong> atau <strong>Batal Semua</strong> di setiap kolom peran.
          </p>
        </div>
      </div>

      {/* VIEW MODE 1: INTERACTIVE TABLE MATRIX */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-800">
                  <th className="p-4 sm:p-5 font-black uppercase tracking-wider text-[11px] min-w-[280px]">
                    Hak Akses Granular (Permission Name)
                  </th>
                  {USER_AUTHORITIES.map((role) => {
                    const isFocus = selectedRoleTab === 'all' || selectedRoleTab === role;
                    if (!isFocus) return null;
                    return (
                      <th
                        key={role}
                        className="p-3 sm:p-4 text-center font-black min-w-[130px] border-l border-slate-800"
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${getAuthorityBadgeColor(
                              role
                            )}`}
                          >
                            {getAuthorityIcon(role)}
                            <span>{role}</span>
                          </span>

                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-300">
                            <span>{roleStats[role].enabled}/{roleStats[role].total}</span>
                          </div>

                          {/* Bulk Actions for this role */}
                          <div className="flex items-center gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => handleBulkSetRole(role, true)}
                              className="px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[9px] font-bold rounded transition-colors"
                              title={`Centang semua izin untuk ${role}`}
                            >
                              Semua
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkSetRole(role, false)}
                              className="px-1.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[9px] font-bold rounded transition-colors"
                              title={`Batalkan semua izin untuk ${role}`}
                            >
                              Kosong
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100">
                {filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Tidak ada izin granular yang cocok dengan kata kunci &quot;{searchQuery}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredPermissions.map((item, idx) => {
                    return (
                      <tr
                        key={item.key}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        {/* Permission Description Cell */}
                        <td className="p-4 sm:p-4.5 align-middle">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                              {renderPermissionIcon(item.iconName)}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                  {item.label}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                  {item.categoryLabel}
                                </span>
                              </div>
                              <p className="font-semibold text-indigo-950 text-xs">
                                {item.indonesianLabel}
                              </p>
                              <p className="text-[11px] text-slate-500 leading-snug">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Interactive Checkbox Cell for Each Authority Level */}
                        {USER_AUTHORITIES.map((role) => {
                          const isFocus = selectedRoleTab === 'all' || selectedRoleTab === role;
                          if (!isFocus) return null;

                          const isGranted = !!permissions[role]?.[item.key];
                          const isCoreAdminProtected =
                            role === 'Admin' &&
                            (item.key === 'manage_users' || item.key === 'configure_authority');

                          return (
                            <td
                              key={role}
                              className="p-3 sm:p-4 text-center align-middle border-l border-slate-100"
                            >
                              <button
                                type="button"
                                onClick={() => handleTogglePermission(role, item.key)}
                                className={`w-full min-h-[44px] py-2 px-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                  isGranted
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                                }`}
                                title={`Klik untuk ${isGranted ? 'mencabut' : 'memberikan'} izin "${item.label}" untuk ${role}`}
                              >
                                {isGranted ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[3]" />
                                    <span className="font-black text-[11px]">Diizinkan</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="text-[11px]">Dibatasi</span>
                                  </>
                                )}
                              </button>

                              {isCoreAdminProtected && (
                                <span className="block text-[9px] text-indigo-600 font-semibold mt-1">
                                  Kunci Sistem
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CATEGORY CARDS / ACCORDION VIEW */}
      {viewMode === 'cards' && (
        <div className="space-y-6">
          {categoriesList.map((cat) => {
            const catPerms = filteredPermissions.filter((p) => p.category === cat.key);
            if (catPerms.length === 0) return null;

            return (
              <div
                key={cat.key}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-4"
              >
                {/* Category Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-indigo-600" />
                    <h4 className="text-base font-black text-slate-900">{cat.label}</h4>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                      {catPerms.length} Izin
                    </span>
                  </div>
                </div>

                {/* Grid of Permission Items */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {catPerms.map((item) => {
                    return (
                      <div
                        key={item.key}
                        className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3.5 hover:bg-slate-50 transition-all"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                              {renderPermissionIcon(item.iconName)}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-sm">{item.label}</p>
                              <p className="text-xs font-semibold text-indigo-900">
                                {item.indonesianLabel}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const allGranted = USER_AUTHORITIES.every((r) => permissions[r]?.[item.key]);
                              handleBulkSetPermissionAcrossRoles(item.key, !allGranted);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded-lg shrink-0 cursor-pointer"
                            title="Toggle izin ini untuk semua peran sekaligus"
                          >
                            Toggle Semua Peran
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-snug">
                          {item.description}
                        </p>

                        {/* Authority Checkboxes Grid for This Permission */}
                        <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {USER_AUTHORITIES.map((role) => {
                            const isGranted = !!permissions[role]?.[item.key];
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => handleTogglePermission(role, item.key)}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                                  isGranted
                                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 ring-1 ring-emerald-400/20'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                <div className="truncate">
                                  <span className="text-[10px] font-black truncate block">
                                    {role === 'Ketua RT (Cluster)' ? 'Ketua RT' : role}
                                  </span>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                    isGranted ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                                  }`}
                                >
                                  {isGranted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Sticky-like Action Card */}
      <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-black text-slate-900">
              Penyimpanan Hak Akses Granular
            </p>
            <p className="text-[11px] text-slate-500">
              Konfigurasi tersimpan secara lokal dan sinkron dengan sesi akun aktif Anda.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
          >
            Reset Standar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan Hak Akses</span>
          </button>
        </div>
      </div>
    </div>
  );
};
