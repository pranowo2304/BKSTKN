import React, { useState } from 'react';
import { AppUser, UserAuthority, USER_AUTHORITIES, ClusterType, CLUSTERS, ClusterMaster } from '../types';
import {
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  User,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  RotateCcw,
  Sparkles,
  Phone,
  Search,
  Filter,
  Check,
  X,
  LogIn,
  Crown,
  HeartHandshake,
  Landmark,
  BadgeCheck,
  RefreshCw,
  Info,
  Copy,
  MessageCircle,
  SlidersHorizontal,
  Plus,
  Save,
  ShieldAlert,
  CreditCard,
  CheckSquare,
  Receipt,
  Layers,
  ArrowRight,
  Settings,
  HelpCircle
} from 'lucide-react';
import { GranularAccessControl } from './GranularAccessControl';
import { RolePermissionsMap } from '../lib/permissions';

export interface ModulePermissionDef {
  id: string;
  name: string;
  category: 'operasional' | 'keuangan' | 'administrasi' | 'sistem';
  description: string;
  access: Record<UserAuthority, 'full' | 'scoped' | 'view' | 'none'>;
  accessLabels?: Partial<Record<UserAuthority, string>>;
}

export const MODULE_PERMISSIONS: ModulePermissionDef[] = [
  {
    id: 'dashboard',
    name: 'Dashboard Operasional',
    category: 'operasional',
    description: 'Statistik kas, grafik mutasi, antrean validasi, dan data warga',
    access: {
      'Ketua Paguyuban': 'full',
      Admin: 'full',
      Bendahara: 'full',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'full',
      'Ketua DKM': 'view',
      Anggota: 'scoped',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Seluruh Paguyuban & KTA',
      Admin: 'Seluruh Paguyuban',
      Bendahara: 'Fokus Kas & Mutasi',
      'Ketua RT (Cluster)': 'Khusus Cluster Sendiri',
      'Ketua RW': 'Seluruh RW 05',
      'Ketua DKM': 'Monitoring Santunan',
      Anggota: 'Tagihan & Status Mandiri',
    },
  },
  {
    id: 'registration',
    name: 'Pendaftaran & Direktori Anggota',
    category: 'operasional',
    description: 'Input data warga baru, tambah anggota keluarga (KK), cetak KTA, dan direktori warga',
    access: {
      'Ketua Paguyuban': 'full',
      Admin: 'full',
      Bendahara: 'view',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'view',
      'Ketua DKM': 'view',
      Anggota: 'scoped',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Direktori Penuh & Cetak KTA',
      Admin: 'Akses Penuh',
      Bendahara: 'Lihat Data Warga & Tagihan',
      'Ketua RT (Cluster)': 'Data Warga Clusternya',
      'Ketua RW': 'Monitoring Seluruh RT',
      'Ketua DKM': 'Data Jamaah Santunan',
      Anggota: 'Data Keluarga Mandiri',
    },
  },
  {
    id: 'paguyuban-approval',
    name: 'Persetujuan Akhir Ketua Paguyuban & Terbit KTA',
    category: 'administrasi',
    description: 'Persetujuan akhir pendaftaran anggota setelah berkas RT & iuran divalidasi untuk penerbitan KTA resmi',
    access: {
      'Ketua Paguyuban': 'full',
      Admin: 'full',
      Bendahara: 'view',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'view',
      'Ketua DKM': 'none',
      Anggota: 'none',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Wewenang Mutlak Persetujuan Akhir & Terbit KTA',
      Admin: 'Supervisi Sistem',
      Bendahara: 'Pantau Status Penerbitan KTA',
      'Ketua RT (Cluster)': 'Pantau Warga Clusternya',
      'Ketua RW': 'Monitoring Lintas RT',
    },
  },
  {
    id: 'rt-verification',
    name: 'Verifikasi Berkas RT',
    category: 'administrasi',
    description: 'Verifikasi KK warga pendaftar di cluster sebelum bisa bayar iuran',
    access: {
      'Ketua Paguyuban': 'view',
      Admin: 'full',
      Bendahara: 'none',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'view',
      'Ketua DKM': 'none',
      Anggota: 'none',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Monitoring Berkas Warga',
      Admin: 'Supervisi Seluruh RT',
      'Ketua RT (Cluster)': 'Wewenang Utama (Khusus Clusternya)',
      'Ketua RW': 'Monitoring Verifikasi',
    },
  },
  {
    id: 'payment',
    name: 'Pencatatan & Pembayaran Iuran',
    category: 'keuangan',
    description: 'Input iuran tahunan/kas warga dan unggah bukti transfer',
    access: {
      'Ketua Paguyuban': 'view',
      Admin: 'full',
      Bendahara: 'full',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'view',
      'Ketua DKM': 'none',
      Anggota: 'full',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Monitoring Iuran Masuk',
      Admin: 'Input Semua Warga',
      Bendahara: 'Pencatatan Kas Masuk',
      'Ketua RT (Cluster)': 'Bantu Warga Clusternya',
      Anggota: 'Bayar Mandiri & Bukti',
    },
  },
  {
    id: 'validation',
    name: 'Validasi Kas & Kwitansi Resmi',
    category: 'keuangan',
    description: 'Pengecekan mutasi transfer rekening, persetujuan, & stempel kwitansi digital',
    access: {
      'Ketua Paguyuban': 'view',
      Admin: 'full',
      Bendahara: 'full',
      'Ketua RT (Cluster)': 'none',
      'Ketua RW': 'none',
      'Ketua DKM': 'none',
      Anggota: 'none',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Monitoring Mutasi Kas',
      Admin: 'Supervisi & Pengesahan',
      Bendahara: 'Wewenang Utama Kwitansi Digital',
    },
  },
  {
    id: 'realization',
    name: 'Realisasi Santunan Duka',
    category: 'keuangan',
    description: 'Pencatatan klaim kematian, santunan ahli waris, & pengeluaran kas',
    access: {
      'Ketua Paguyuban': 'full',
      Admin: 'full',
      Bendahara: 'full',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'view',
      'Ketua DKM': 'view',
      Anggota: 'view',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Pengesahan Santunan & Kebijakan',
      Admin: 'Penuh',
      Bendahara: 'Kas Keluar & Ahli Waris',
      'Ketua DKM': 'Monitoring Fardhu Kifayah & Santunan Umat',
      'Ketua RW': 'Pengawasan Lintas RT',
      'Ketua RT (Cluster)': 'Info Santunan Clusternya',
      Anggota: 'Transparansi Penyaluran',
    },
  },
  {
    id: 'history',
    name: 'Laporan & Pembukuan Kas',
    category: 'keuangan',
    description: 'Riwayat mutasi, export laporan keuangan, cetak kwitansi',
    access: {
      'Ketua Paguyuban': 'full',
      Admin: 'full',
      Bendahara: 'full',
      'Ketua RT (Cluster)': 'scoped',
      'Ketua RW': 'full',
      'Ketua DKM': 'view',
      Anggota: 'scoped',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Laporan Paripurna & Neraca',
      Admin: 'Ekspor CSV & Cetak Lengkap',
      Bendahara: 'Buku Kas & Mutasi Masuk/Keluar',
      'Ketua RW': 'Laporan Rekapitulasi RW',
      'Ketua RT (Cluster)': 'Laporan Iuran Clusternya',
      'Ketua DKM': 'Laporan Santunan',
      Anggota: 'Riwayat Pembayaran Pribadi',
    },
  },
  {
    id: 'users',
    name: 'Pengaturan User & Otoritas',
    category: 'sistem',
    description: 'Manajemen akun, reset password, dan konfigurasi hak otoritas peran',
    access: {
      'Ketua Paguyuban': 'view',
      Admin: 'full',
      Bendahara: 'none',
      'Ketua RT (Cluster)': 'none',
      'Ketua RW': 'none',
      'Ketua DKM': 'none',
      Anggota: 'none',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Supervisi Daftar Pengurus',
      Admin: 'Atur Otoritas Semua Akun',
    },
  },
  {
    id: 'settings',
    name: 'Pengaturan Sistem & Kas Master',
    category: 'sistem',
    description: 'Konfigurasi master cluster, rekening bank, nominal iuran, santunan, reset data',
    access: {
      'Ketua Paguyuban': 'view',
      Admin: 'full',
      Bendahara: 'none',
      'Ketua RT (Cluster)': 'none',
      'Ketua RW': 'none',
      'Ketua DKM': 'none',
      Anggota: 'none',
    },
    accessLabels: {
      'Ketua Paguyuban': 'Review Konfigurasi Sistem',
      Admin: 'Konfigurasi Master Sistem',
    },
  },
];

interface UserManagementProps {
  users: AppUser[];
  activeUser?: AppUser | null;
  clusters?: ClusterMaster[];
  onAddUser: (newUser: AppUser) => void;
  onUpdateUser: (updatedUser: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  onSwitchActiveUser: (user: AppUser) => void;
  onSyncRtUsersWithClusters?: () => void;
  onPermissionsChange?: (permissions: RolePermissionsMap) => void;
  onNavigateToSettings?: () => void;
  onClose?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  activeUser,
  clusters = [],
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSwitchActiveUser,
  onSyncRtUsersWithClusters,
  onPermissionsChange,
  onNavigateToSettings,
  onClose,
}) => {
  const clusterOptions = clusters.length > 0 ? clusters.map((c) => c.name) : CLUSTERS;

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authority, setAuthority] = useState<UserAuthority>('Ketua RT (Cluster)');
  const [cluster, setCluster] = useState<ClusterType>(clusterOptions[0] || 'Cluster Sanur');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Aktif' | 'Non-Aktif'>('Aktif');
  const [notes, setNotes] = useState('');

  // UI States
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthority, setFilterAuthority] = useState<string>('Semua');
  const [filterCluster, setFilterCluster] = useState<string>('Semua');
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'granular'>('users');
  const [copiedInfo, setCopiedInfo] = useState<string | null>(null);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInfo(label);
    setTimeout(() => setCopiedInfo(null), 2000);
  };

  // Edit Modal State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editAuthority, setEditAuthority] = useState<UserAuthority>('Anggota');
  const [editCluster, setEditCluster] = useState<ClusterType | string>('Cluster Sanur');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<'Aktif' | 'Non-Aktif'>('Aktif');
  const [editNotes, setEditNotes] = useState('');

  // Dedicated Authority Modal State
  const [authorityUserModal, setAuthorityUserModal] = useState<AppUser | null>(null);
  const [selectedAuthority, setSelectedAuthority] = useState<UserAuthority>('Anggota');
  const [selectedCluster, setSelectedCluster] = useState<ClusterType | string>('Cluster Sanur');
  const [authorityNotes, setAuthorityNotes] = useState('');
  const [switchAfterAuthoritySave, setSwitchAfterAuthoritySave] = useState(false);
  const [matrixViewMode, setMatrixViewMode] = useState<'table' | 'cards'>('cards');
  const [matrixRoleFilter, setMatrixRoleFilter] = useState<string>('Semua');

  const handleOpenAuthorityModal = (user: AppUser) => {
    setAuthorityUserModal(user);
    setSelectedAuthority(user.authority);
    setSelectedCluster(user.cluster || clusterOptions[0] || 'Cluster Sanur');
    setAuthorityNotes(user.notes || '');
    setSwitchAfterAuthoritySave(false);
  };

  const handleSaveAuthority = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authorityUserModal) return;

    // Safeguard: Cannot remove admin status from the last active admin
    if (authorityUserModal.authority === 'Admin' && selectedAuthority !== 'Admin') {
      const activeAdmins = users.filter((u) => u.authority === 'Admin' && u.status === 'Aktif');
      if (activeAdmins.length <= 1) {
        alert('Tindakan Ditolak: Tidak dapat mengubah otoritas karena akun ini adalah satu-satunya Admin aktif di sistem paguyuban!');
        return;
      }
    }

    const isClusterRelevant = selectedAuthority === 'Ketua RT (Cluster)' || selectedAuthority === 'Anggota';
    const finalCluster = isClusterRelevant ? (selectedCluster as ClusterType) : undefined;

    const updatedUser: AppUser = {
      ...authorityUserModal,
      authority: selectedAuthority,
      cluster: finalCluster,
      notes: authorityNotes.trim() || authorityUserModal.notes,
    };

    onUpdateUser(updatedUser);
    setToastMessage(`Otoritas pengguna "${updatedUser.name}" berhasil diatur menjadi [${updatedUser.authority}]${finalCluster ? ` (${finalCluster})` : ''}!`);
    setTimeout(() => setToastMessage(null), 5000);

    if (switchAfterAuthoritySave) {
      onSwitchActiveUser(updatedUser);
    }

    setAuthorityUserModal(null);
  };

  const getAccessLevelBadge = (level: 'full' | 'scoped' | 'view' | 'none', label?: string) => {
    switch (level) {
      case 'full':
        return (
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1 shadow-2xs">
            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{label || 'Akses Penuh'}</span>
          </span>
        );
      case 'scoped':
        return (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[10px] rounded-full inline-flex items-center gap-1 shadow-2xs">
            <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
            <span>{label || 'Sesuai Cluster'}</span>
          </span>
        );
      case 'view':
        return (
          <span className="px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[10px] rounded-full inline-flex items-center gap-1 shadow-2xs">
            <Eye className="w-3 h-3 text-sky-600 shrink-0" />
            <span>{label || 'Supervisi / Lihat'}</span>
          </span>
        );
      case 'none':
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-400 font-medium text-[10px] rounded-full inline-flex items-center gap-1">
            <X className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{label || 'Tidak Dapat Akses'}</span>
          </span>
        );
    }
  };

  // Helper for generating random secure password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
    setShowPassword(true);
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
        return <Crown className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Bendahara':
        return <Landmark className="w-3.5 h-3.5 text-emerald-600" />;
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

  const getAuthorityDescription = (auth: UserAuthority) => {
    switch (auth) {
      case 'Ketua Paguyuban':
        return 'Pemegang wewenang mutlak persetujuan akhir registrasi pendaftar, pengesahan penerbitan KTA resmi, supervisi laporan kas, dan kebijakan santunan duka cita.';
      case 'Admin':
        return 'Akses penuh ke seluruh modul, manajemen pengguna, pengaturan kas, dan audit sistem.';
      case 'Bendahara':
        return 'Validasi pembayaran iuran, kwitansi digital, pencatatan klaim duka, & laporan keuangan.';
      case 'Ketua RT (Cluster)':
        return 'Verifikasi pendaftaran warga di wilayah cluster dan supervisi gotong royong tingkat RT.';
      case 'Ketua RW':
        return 'Monitoring kas & transparansi tingkat RW 05, supervisi santunan duka lintas cluster.';
      case 'Ketua DKM':
        return 'Pengawasan pelaksanaan santunan duka umat & koordinasi fardhu kifayah jenazah di masjid.';
      case 'Anggota':
        return 'Pendaftaran mandiri, pembayaran iuran, cek bukti kwitansi resmi, dan kartu anggota.';
    }
  };

  // Submit Handler for Add User
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      alert('Nama, Alamat Email, dan Password wajib diisi!');
      return;
    }

    // Check duplicate email
    const existing = users.find((u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      alert(`Alamat email "${email}" sudah digunakan oleh pengguna ${existing.name}!`);
      return;
    }

    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      authority,
      cluster: authority === 'Ketua RT (Cluster)' || authority === 'Anggota' ? cluster : undefined,
      phone: phone.trim() || undefined,
      status,
      createdAt: new Date().toISOString().substring(0, 10),
      notes: notes.trim() || undefined,
    };

    onAddUser(newUser);
    setToastMessage(`Pengguna "${newUser.name}" dengan otoritas [${newUser.authority}] berhasil ditambahkan!`);
    setTimeout(() => setToastMessage(null), 5000);

    // Reset Form
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setNotes('');
    setShowAddForm(false);
  };

  // Edit Modal Open
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword(user.password || '');
    setEditAuthority(user.authority);
    setEditCluster(user.cluster || 'Cluster Sanur');
    setEditPhone(user.phone || '');
    setEditStatus(user.status);
    setEditNotes(user.notes || '');
  };

  // Edit Submit Handler
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editName.trim() || !editEmail.trim()) {
      alert('Nama User dan Email tidak boleh kosong!');
      return;
    }

    const duplicateEmail = users.find(
      (u) => u.id !== editingUser.id && u.email && u.email.toLowerCase() === editEmail.trim().toLowerCase()
    );
    if (duplicateEmail) {
      alert(`Alamat email "${editEmail}" sudah digunakan oleh pengguna lain (${duplicateEmail.name})!`);
      return;
    }

    const updatedUser: AppUser = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      password: editPassword.trim() || editingUser.password,
      authority: editAuthority,
      cluster: editAuthority === 'Ketua RT (Cluster)' || editAuthority === 'Anggota' ? editCluster : undefined,
      phone: editPhone.trim() || undefined,
      status: editStatus,
      notes: editNotes.trim() || undefined,
    };

    onUpdateUser(updatedUser);
    setToastMessage(`Data pengguna "${updatedUser.name}" berhasil diperbarui!`);
    setTimeout(() => setToastMessage(null), 5000);
    setEditingUser(null);
  };

  // Delete User Handler
  const handleDelete = (user: AppUser) => {
    if (activeUser && user.id === activeUser.id) {
      alert('Anda tidak dapat menghapus akun yang sedang aktif digunakan!');
      return;
    }

    const adminCount = users.filter((u) => u.authority === 'Admin' && u.status === 'Aktif').length;
    if (user.authority === 'Admin' && adminCount <= 1) {
      alert('Tidak dapat menghapus satu-satunya akun Admin aktif di sistem!');
      return;
    }

    if (window.confirm(`Hapus akun pengguna "${user.name}" (${user.email})?`)) {
      onDeleteUser(user.id);
      setToastMessage(`Akun pengguna "${user.name}" telah dihapus.`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    if (filterAuthority !== 'Semua' && u.authority !== filterAuthority) return false;
    if (filterCluster !== 'Semua' && u.cluster !== filterCluster) return false;
    if (filterStatus !== 'Semua' && u.status !== filterStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchPhone = (u.phone || '').includes(q);
      const matchCluster = (u.cluster || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchCluster) return false;
    }

    return true;
  });

  const activeCount = users.filter((u) => u.status === 'Aktif').length;
  const rtCount = users.filter((u) => u.authority === 'Ketua RT (Cluster)').length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-28 sm:pb-32">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Manajemen Akun & Kontrol Otoritas Akses</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Manajemen Pengguna & Otoritas Sistem
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Kelola data akun pengguna, hak otoritas (Admin, Bendahara, Ketua RT Cluster, Ketua RW, Ketua DKM, dan Anggota), serta simulasi pergantian peran (Switch User).
            </p>

            {/* Quick Stats Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="px-3 py-1 bg-white/10 rounded-xl border border-white/10 flex items-center gap-1.5 font-bold">
                <Users className="w-3.5 h-3.5 text-indigo-300" />
                <span>Total: <strong className="text-white">{users.length}</strong> Akun</span>
              </div>
              <div className="px-3 py-1 bg-emerald-500/15 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Aktif: <strong className="text-emerald-200">{activeCount}</strong></span>
              </div>
              <div className="px-3 py-1 bg-amber-500/15 rounded-xl border border-amber-500/20 flex items-center gap-1.5 font-bold text-amber-300">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>RT Terhubung: <strong className="text-amber-200">{rtCount}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Mobile-App Touch Style */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-700 font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-lg inline-flex items-center justify-center gap-2 cursor-pointer order-last sm:order-first"
                title="Tutup Manajemen User & Kembali ke Dashboard"
              >
                <X className="w-4 h-4 text-slate-300 shrink-0" />
                <span>Tutup</span>
              </button>
            )}

            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="min-h-[44px] px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 border border-emerald-500/30 font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-lg inline-flex items-center justify-center gap-2 cursor-pointer"
                title="Buka Pengaturan Sistem, Tarif Iuran, dan Master Data"
              >
                <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pengaturan Sistem</span>
              </button>
            )}

            {onSyncRtUsersWithClusters && (
              <button
                type="button"
                onClick={() => {
                  onSyncRtUsersWithClusters();
                  setToastMessage('Berhasil menyesuaikan seluruh akun Ketua RT dengan Master RT Cluster!');
                  setTimeout(() => setToastMessage(null), 5000);
                }}
                className="min-h-[44px] px-4 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-2xl transition-all shadow-lg shadow-amber-950/40 inline-flex items-center justify-center gap-2 cursor-pointer"
                title="Sesuaikan akun Ketua RT dengan data wilayah & nama di Master RT Cluster"
              >
                <RefreshCw className="w-4 h-4 text-slate-950 shrink-0" />
                <span>Sesuaikan RT dg Master</span>
              </button>
            )}

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="min-h-[44px] px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl transition-all shadow-lg shadow-indigo-900/40 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>{showAddForm ? 'Tutup Form' : 'Tambah Pengguna Baru'}</span>
            </button>
          </div>
        </div>

        {/* Current Active User Status Bar */}
        {activeUser && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow ring-2 ring-indigo-400/30">
                {activeUser.name ? activeUser.name.charAt(0) : 'U'}
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Sedang Masuk Sebagai:</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  {activeUser.name}
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${getAuthorityBadgeColor(activeUser.authority)}`}>
                    {activeUser.authority} {activeUser.cluster ? `(${activeUser.cluster})` : ''}
                  </span>
                </span>
              </div>
            </div>

            <div className="text-slate-400 text-[11px] flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Sesi Aktif
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Copy Notification Toast */}
      {copiedInfo && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900/95 text-white text-xs font-bold rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copiedInfo} berhasil disalin ke clipboard!</span>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-sm animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FORM INPUT USER BARU (COLLAPSIBLE / EXPANDABLE) */}
      {showAddForm && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-indigo-200 shadow-xl space-y-6 animate-in slide-in-from-top-4 duration-300 ring-2 ring-indigo-500/20">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Form Input Pengguna Baru</h3>
                <p className="text-xs text-slate-500">Lengkapi data akun untuk memberikan hak akses ke aplikasi kas kematian.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. Nama User */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama User / Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Pak Sutrisno (Ketua RT)"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {/* 2. Alamat Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Email (Username Login) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: rt.sanur@danakematian.org"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {/* 3. Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Acak Password</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 4. Otoritas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Otoritas / Hak Akses <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={authority}
                    onChange={(e) => setAuthority(e.target.value as UserAuthority)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none cursor-pointer"
                  >
                    {USER_AUTHORITIES.map((auth) => (
                      <option key={auth} value={auth}>
                        {auth}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  {getAuthorityDescription(authority)}
                </p>
              </div>

              {/* 5. Cluster (Conditional for Ketua RT and Anggota) */}
              {(authority === 'Ketua RT (Cluster)' || authority === 'Anggota') && (
                <div className="animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Pilih Wilayah Cluster <span className="text-rose-500">*</span>
                    </label>
                    {authority === 'Ketua RT (Cluster)' && clusters.length > 0 && (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Sinkron Master RT
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={cluster}
                      onChange={(e) => {
                        const selectedClsName = e.target.value as ClusterType;
                        setCluster(selectedClsName);
                        if (authority === 'Ketua RT (Cluster)') {
                          const matched = clusters.find((c) => c.name === selectedClsName);
                          if (matched) {
                            if (matched.leaderName) setName(matched.leaderName);
                            if (matched.leaderEmail) setEmail(matched.leaderEmail);
                            if (matched.leaderPhone) setPhone(matched.leaderPhone);
                          }
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none cursor-pointer"
                    >
                      {clusterOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 6. No. WhatsApp / Telepon */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  No. Telepon / WhatsApp (Opsional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {/* 7. Status Pengguna */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Status Akun
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="radio"
                      name="status"
                      value="Aktif"
                      checked={status === 'Aktif'}
                      onChange={() => setStatus('Aktif')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-emerald-700">Aktif (Dapat Login)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="radio"
                      name="status"
                      value="Non-Aktif"
                      checked={status === 'Non-Aktif'}
                      onChange={() => setStatus('Non-Aktif')}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span className="text-slate-500">Non-Aktif</span>
                  </label>
                </div>
              </div>

              {/* 8. Catatan Tambahan */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan Penugasan / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: SK Pengangkatan Ketua RT Periode 2025-2028."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-h-[44px] px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-900/30 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Simpan Pengguna Baru</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Tabs (Daftar Pengguna vs Matriks Otoritas) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Navigation Sub-Tabs: Mobile-app Segmented Control */}
        <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-white text-slate-900 shadow-sm shadow-slate-300/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Daftar Pengguna ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap ${
                activeTab === 'matrix'
                  ? 'bg-white text-slate-900 shadow-sm shadow-slate-300/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Matriks Hak Otoritas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('granular')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap ${
                activeTab === 'granular'
                  ? 'bg-white text-slate-900 shadow-sm shadow-slate-300/50 ring-1 ring-indigo-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>Kontrol Izin Granular</span>
              <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 text-[9px] font-black">
                Admin
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Klik tombol <strong>"Masuk"</strong> untuk beralih dan mensimulasikan peran akun.</span>
          </div>
        </div>

        {activeTab === 'users' && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Search & Filter Bar */}
            <div className="space-y-3">
              {/* Search Bar Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama pengguna, email, no. WhatsApp, atau cluster..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    title="Hapus pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Mobile-First Authority Filter Chips (Horizontal Scrollable) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {['Semua', ...USER_AUTHORITIES].map((auth) => {
                  const isSelected = filterAuthority === auth;
                  const count = auth === 'Semua' ? users.length : users.filter((u) => u.authority === auth).length;

                  return (
                    <button
                      key={auth}
                      type="button"
                      onClick={() => setFilterAuthority(auth)}
                      className={`min-h-[38px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all active:scale-95 inline-flex items-center gap-2 shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/20 ring-2 ring-indigo-500/20'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70'
                      }`}
                    >
                      <span>{auth}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Secondary Filters: Cluster & Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Cluster Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={filterCluster}
                      onChange={(e) => setFilterCluster(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="Semua">Semua Wilayah Cluster</option>
                      {clusterOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="Semua">Semua Status</option>
                      <option value="Aktif">Aktif</option>
                      <option value="Non-Aktif">Non-Aktif</option>
                    </select>
                  </div>

                  {/* Reset Filter Button */}
                  {(filterAuthority !== 'Semua' || filterCluster !== 'Semua' || filterStatus !== 'Semua' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAuthority('Semua');
                        setFilterCluster('Semua');
                        setFilterStatus('Semua');
                        setSearchQuery('');
                      }}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filter</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] font-medium text-slate-400">
                  Menampilkan <strong>{filteredUsers.length}</strong> dari {users.length} pengguna
                </div>
              </div>
            </div>

            {/* MOBILE APP CARDS VIEW (Dedicated for Mobile Screens: block md:hidden) */}
            <div className="space-y-3.5 block md:hidden">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 p-6">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">Tidak ada pengguna yang cocok</p>
                  <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau reset filter di atas.</p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isActive = !!(activeUser && user.id === activeUser.id);
                  const matchedCluster = clusters.find((c) => c.name === user.cluster);
                  const cleanPhone = user.phone ? user.phone.replace(/[^0-9]/g, '') : '';
                  const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

                  return (
                    <div
                      key={user.id}
                      className={`p-4 bg-white rounded-2xl border transition-all duration-200 shadow-sm space-y-3.5 ${
                        isActive
                          ? 'border-indigo-400 bg-gradient-to-b from-indigo-50/40 to-white ring-2 ring-indigo-500/20'
                          : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Row: Avatar, Name, Badges, Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0 ${
                                user.avatarColor || 'bg-slate-800'
                              }`}
                            >
                              {user.name.charAt(0)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                user.status === 'Aktif' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                              title={user.status}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-black text-sm text-slate-900 truncate">{user.name}</h4>
                              {isActive && (
                                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleOpenAuthorityModal(user)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black border inline-flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${getAuthorityBadgeColor(
                                  user.authority
                                )}`}
                                title="Klik untuk mengatur hak otoritas pengguna ini"
                              >
                                {getAuthorityIcon(user.authority)}
                                <span>{user.authority}</span>
                                <SlidersHorizontal className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                              </button>
                              {user.cluster && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200/80 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                  <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{user.cluster}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Pill */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                            user.status === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {user.status}
                        </span>
                      </div>

                      {/* Contact Details & Info Card */}
                      <div className="bg-slate-50/80 rounded-xl p-2.5 space-y-2 text-xs text-slate-600 border border-slate-100">
                        {/* Email with Tap-to-Copy */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-[11px] text-slate-800 truncate font-semibold">
                              {user.email}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(user.email, `Email ${user.name}`)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                            title="Salin Email"
                          >
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Salin</span>
                          </button>
                        </div>

                        {/* Phone & WhatsApp Quick Action */}
                        {user.phone && (
                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/50">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px] text-slate-700 font-medium">
                                {user.phone}
                              </span>
                            </div>
                            {waNumber && (
                              <a
                                href={`https://wa.me/${waNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>Chat WA</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Notes if present */}
                        {user.notes && (
                          <p className="text-[10px] text-slate-500 italic pt-1.5 border-t border-slate-200/50 line-clamp-2">
                            "{user.notes}"
                          </p>
                        )}

                        {/* Master RT Sync status */}
                        {user.authority === 'Ketua RT (Cluster)' && matchedCluster && (
                          <div className="pt-1.5 border-t border-slate-200/50">
                            {matchedCluster.leaderName === user.name ? (
                              <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Tersinkron dengan Master RT {matchedCluster.rtNumber}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-800 font-bold inline-flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-amber-600" />
                                <span>Master Cluster: {matchedCluster.leaderName}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* MOBILE ACTION BUTTONS: Tidy, Touch-Friendly Mobile Buttons */}
                      <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          {/* Switch / Login Button */}
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => onSwitchActiveUser(user)}
                              className="min-h-[44px] px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-sm shadow-indigo-950/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              title={`Masuk & simulasi sebagai ${user.name}`}
                            >
                              <LogIn className="w-4 h-4 shrink-0" />
                              <span>Masuk Akun</span>
                            </button>
                          ) : (
                            <div className="min-h-[44px] px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 select-none">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Sedang Aktif</span>
                            </div>
                          )}

                          {/* Atur Otoritas Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenAuthorityModal(user)}
                            className="min-h-[44px] px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 active:scale-95 font-black text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Atur Otoritas & Hak Akses Pengguna"
                          >
                            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Atur Otoritas</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="min-h-[40px] px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Edit Data Pengguna"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span>Edit Profil</span>
                          </button>

                          {/* Delete Button */}
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(user)}
                              className="min-h-[40px] px-3 py-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                              title="Hapus Akun Pengguna"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Hapus</span>
                            </button>
                          ) : (
                            <div className="min-h-[40px] px-3 py-2 bg-slate-50 text-slate-400 font-medium text-xs rounded-xl border border-slate-100 flex items-center justify-center select-none">
                              <span>Akun Utama</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (Clean, elevated view for wider screens: hidden md:block) */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Nama User</th>
                    <th className="py-3.5 px-4">Email & Kontak</th>
                    <th className="py-3.5 px-4">Otoritas (Role)</th>
                    <th className="py-3.5 px-4">Wilayah Cluster</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700">Tidak ada pengguna yang cocok</p>
                        <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau reset filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isActive = !!(activeUser && user.id === activeUser.id);

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isActive ? 'bg-indigo-50/50' : ''
                          }`}
                        >
                          {/* Nama User */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm ${
                                user.avatarColor || 'bg-slate-700'
                              }`}>
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {isActive && (
                                    <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-black rounded-md uppercase">
                                      Anda
                                    </span>
                                  )}
                                </p>
                                {user.notes && (
                                  <p className="text-[10px] text-slate-400 italic line-clamp-1">{user.notes}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Email & Kontak */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-800 font-semibold">{user.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(user.email, `Email ${user.name}`)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                                title="Salin Email"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            {user.phone && <p className="text-slate-400 text-[11px]">{user.phone}</p>}
                          </td>

                          {/* Otoritas */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => handleOpenAuthorityModal(user)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black border inline-flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${getAuthorityBadgeColor(
                                user.authority
                              )}`}
                              title="Klik untuk mengubah wewenang & hak otoritas pengguna ini"
                            >
                              {getAuthorityIcon(user.authority)}
                              <span>{user.authority}</span>
                              <SlidersHorizontal className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>
                          </td>

                          {/* Cluster */}
                          <td className="py-3.5 px-4">
                            {user.cluster ? (
                              <div className="space-y-1">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-md font-bold text-[11px] inline-flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-slate-500" />
                                  <span>{user.cluster}</span>
                                </span>
                                {user.authority === 'Ketua RT (Cluster)' && (
                                  <div>
                                    {(() => {
                                      const matchedCluster = clusters.find((c) => c.name === user.cluster);
                                      if (matchedCluster) {
                                        const isMatchingLeader = matchedCluster.leaderName === user.name;
                                        return isMatchingLeader ? (
                                          <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                                            <span>Sinkron Master {matchedCluster.rtNumber || 'RT'}</span>
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5 text-amber-600" />
                                            <span>Master: {matchedCluster.leaderName}</span>
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">- (Seluruh Wilayah)</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {user.status === 'Aktif' ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Aktif</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold text-[10px] rounded-full">
                                Non-Aktif
                              </span>
                            )}
                          </td>

                          {/* Aksi Desktop: Clean, rounded buttons with hover states */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                               {!isActive ? (
                                <button
                                  type="button"
                                  onClick={() => onSwitchActiveUser(user)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl shadow-xs text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                                  title={`Masuk sebagai ${user.name}`}
                                >
                                  <LogIn className="w-3.5 h-3.5" />
                                  <span>Masuk</span>
                                </button>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl inline-flex items-center gap-1 select-none">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Aktif</span>
                                </span>
                              )}

                              {/* Atur Otoritas Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenAuthorityModal(user)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 font-bold text-xs rounded-xl border border-amber-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Atur Hak Otoritas & Peran Pengguna"
                              >
                                <Shield className="w-3.5 h-3.5 text-amber-700" />
                                <span className="hidden xl:inline">Atur</span>
                                <span>Otoritas</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(user)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Edit Pengguna"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span className="hidden lg:inline">Edit</span>
                              </button>

                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(user)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span className="hidden lg:inline">Hapus</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTHORITY MATRIX & USER ROLES EXPLANATION */}
        {activeTab === 'matrix' && (
          <div className="p-4 sm:p-6 space-y-6">
            {/* Top Banner & Sub-View Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">Manajemen Hak Otoritas & Peran Paguyuban</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Role-Based Access Control (RBAC) untuk transparansi keuangan dan kepastian operasional kas kematian.
                  </p>
                </div>
              </div>

              {/* View Mode Toggle Buttons & Granular Shortcut */}
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('cards')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    matrixViewMode === 'cards'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Daftar Pengguna per Peran</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('table')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    matrixViewMode === 'table'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Matriks Modul & Hak Akses</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('granular')}
                  className="px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs active:scale-95"
                  title="Buka kontrol izin centang/batalkan per level peran"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Kontrol Izin Granular</span>
                </button>
              </div>
            </div>

            {/* VIEW 1: USER ASSIGNMENT CARDS */}
            {matrixViewMode === 'cards' && (
              <div className="space-y-4">
                {/* Role quick filter pill buttons */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <span className="text-slate-500 font-bold shrink-0">Filter:</span>
                  {['Semua', ...USER_AUTHORITIES].map((auth) => {
                    const isSelected = matrixRoleFilter === auth;
                    const count = auth === 'Semua' ? users.length : users.filter((u) => u.authority === auth).length;
                    return (
                      <button
                        key={auth}
                        type="button"
                        onClick={() => setMatrixRoleFilter(auth)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{auth}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isSelected ? 'bg-white/25' : 'bg-slate-200'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {USER_AUTHORITIES.filter((a) => matrixRoleFilter === 'Semua' || matrixRoleFilter === a).map((auth) => {
                    const roleUsers = users.filter((u) => u.authority === auth);

                    return (
                      <div
                        key={auth}
                        className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all"
                      >
                        <div className="space-y-3">
                          {/* Role Header */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-black border inline-flex items-center gap-1.5 ${getAuthorityBadgeColor(
                                auth
                              )}`}
                            >
                              {getAuthorityIcon(auth)}
                              <span>{auth}</span>
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-black">
                              {roleUsers.length} Akun
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed font-medium">
                            {getAuthorityDescription(auth)}
                          </p>

                          {/* Focus bullets */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
                            <p className="font-bold text-slate-800">Wewenang Pokok:</p>
                            {auth === 'Ketua Paguyuban' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Persetujuan akhir pendaftaran & pengesahan KTA digital</li>
                                <li>Supervisi pembukuan kas paripurna & audit mutasi</li>
                                <li>Pengesahan santunan duka cita & kebijakan paguyuban</li>
                              </ul>
                            )}
                            {auth === 'Admin' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Pengaturan akun, otoritas, & reset password</li>
                                <li>Konfigurasi master rekening bank & nominal kas</li>
                                <li>Akses penuh seluruh modul paguyuban</li>
                              </ul>
                            )}
                            {auth === 'Bendahara' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Validasi mutasi transfer rekening</li>
                                <li>Penerbitan kwitansi pembayaran resmi</li>
                                <li>Pencatatan klaim & realisasi santunan</li>
                              </ul>
                            )}
                            {auth === 'Ketua RT (Cluster)' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Verifikasi berkas pendaftar warga clusternya</li>
                                <li>Pemberian catatan & persetujuan RT</li>
                                <li>Syarat sah sebelum warga bayar iuran</li>
                              </ul>
                            )}
                            {auth === 'Ketua RW' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Supervisi laporan kas seluruh cluster RT</li>
                                <li>Monitoring santunan duka tingkat RW</li>
                                <li>Audit berkala & cetak rekapitulasi</li>
                              </ul>
                            )}
                            {auth === 'Ketua DKM' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Koordinasi fardhu kifayah & pemakaman</li>
                                <li>Pengawasan dana santunan duka umat</li>
                                <li>Transparansi laporan kas untuk jamaah</li>
                              </ul>
                            )}
                            {auth === 'Anggota' && (
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                <li>Pendaftaran warga & anggota keluarga (KK)</li>
                                <li>Pembayaran iuran mandiri & upload transfer</li>
                                <li>Unduh kwitansi & pantau status santunan</li>
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* List of Users in this Authority with instant Atur Otoritas button */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                            <span>Pengguna dengan Otoritas Ini:</span>
                            <span className="text-slate-400 font-semibold">{roleUsers.length} orang</span>
                          </div>

                          {roleUsers.length === 0 ? (
                            <div className="p-3 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                              Belum ada akun dengan otoritas ini.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {roleUsers.map((u) => {
                                const isCurrentUser = !!(activeUser && u.id === activeUser.id);
                                return (
                                  <div
                                    key={u.id}
                                    className="p-2 bg-slate-50/90 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[10px] shrink-0 ${
                                          u.avatarColor || 'bg-slate-700'
                                        }`}
                                      >
                                        {u.name.charAt(0)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-900 truncate flex items-center gap-1">
                                          <span>{u.name}</span>
                                          {isCurrentUser && (
                                            <span className="text-[8px] bg-indigo-600 text-white px-1 py-0.2 rounded font-black">
                                              Anda
                                            </span>
                                          )}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {u.cluster ? u.cluster : u.email}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Quick Atur Otoritas Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAuthorityModal(u)}
                                      className="px-2.5 py-1 bg-white hover:bg-amber-50 active:scale-95 text-amber-900 border border-amber-200/80 rounded-lg text-[10px] font-black inline-flex items-center gap-1 transition-all shadow-2xs shrink-0 cursor-pointer"
                                      title={`Atur Otoritas Pengguna ${u.name}`}
                                    >
                                      <Shield className="w-3 h-3 text-amber-600" />
                                      <span>Atur</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 2: FULL MODULE PERMISSIONS MATRIX TABLE */}
            {matrixViewMode === 'table' && (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4 min-w-[200px]">Modul & Layanan</th>
                        <th className="py-3 px-3 text-center min-w-[130px]">
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-500/40">
                            Ketua Paguyuban
                          </span>
                        </th>
                        <th className="py-3 px-3 text-center min-w-[120px]">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-500/40">
                            Admin
                          </span>
                        </th>
                        <th className="py-3 px-3 text-center min-w-[120px]">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                            Bendahara
                          </span>
                        </th>
                        <th className="py-3 px-3 text-center min-w-[140px]">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-500/40">
                            Ketua RT
                          </span>
                        </th>
                        <th className="py-3 px-3 text-center min-w-[120px]">
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-500/40">
                            Ketua RW
                          </span>
                        </th>
                        <th className="py-3 px-3 text-center min-w-[120px]">
                          <span className="px-2 py-0.5 rounded-full bg-teal-500/30 text-teal-200 border border-teal-500/40">
                            Ketua DKM
                          </span>
                        </th>
                        <th className="py-3 px-3 text-center min-w-[120px]">
                          <span className="px-2 py-0.5 rounded-full bg-slate-500/30 text-slate-200 border border-slate-500/40">
                            Anggota
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {MODULE_PERMISSIONS.map((mod) => (
                        <tr key={mod.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Modul Description */}
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <p className="font-black text-slate-900 flex items-center gap-1.5">
                                <span>{mod.name}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">
                                  {mod.category}
                                </span>
                              </p>
                              <p className="text-[11px] text-slate-500">{mod.description}</p>
                            </div>
                          </td>

                          {/* Ketua Paguyuban */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access['Ketua Paguyuban'], mod.accessLabels?.['Ketua Paguyuban'])}
                            </div>
                          </td>

                          {/* Admin */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access.Admin, mod.accessLabels?.Admin)}
                            </div>
                          </td>

                          {/* Bendahara */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access.Bendahara, mod.accessLabels?.Bendahara)}
                            </div>
                          </td>

                          {/* Ketua RT */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access['Ketua RT (Cluster)'], mod.accessLabels?.['Ketua RT (Cluster)'])}
                            </div>
                          </td>

                          {/* Ketua RW */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access['Ketua RW'], mod.accessLabels?.['Ketua RW'])}
                            </div>
                          </td>

                          {/* Ketua DKM */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access['Ketua DKM'], mod.accessLabels?.['Ketua DKM'])}
                            </div>
                          </td>

                          {/* Anggota */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {getAccessLevelBadge(mod.access.Anggota, mod.accessLabels?.Anggota)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-bold text-slate-700">Keterangan Tingkat Akses:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 font-medium">Akses Penuh (Create, Read, Update, Delete)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600 font-medium">Sesuai Cluster (Terbatas pada wilayah warga RT binaan)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-slate-600 font-medium">Supervisi / Monitoring (Melihat ringkasan & cetak)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span className="text-slate-400 font-medium">Tidak Dapat Akses</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GRANULAR ACCESS CONTROL (CHECK / UNCHECK PERMISSIONS PER AUTHORITY LEVEL) */}
        {activeTab === 'granular' && (
          <div className="p-4 sm:p-6">
            <GranularAccessControl
              activeUserAuthority={activeUser?.authority}
              onPermissionsChange={onPermissionsChange}
            />
          </div>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 my-8">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Edit Data Pengguna</h3>
                  <p className="text-xs text-slate-500">Perbarui nama, otoritas, email, atau reset password.</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Nama User */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama User / Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                />
              </div>

              {/* Alamat Email */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alamat Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                />
              </div>

              {/* Reset Password */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password Baru (Kosongkan jika tidak ingin mengubah)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Masukkan password baru..."
                    className="w-full px-3.5 py-2 pr-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Otoritas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Otoritas / Hak Akses <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editAuthority}
                  onChange={(e) => setEditAuthority(e.target.value as UserAuthority)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none cursor-pointer"
                >
                  {USER_AUTHORITIES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cluster (Conditional) */}
              {(editAuthority === 'Ketua RT (Cluster)' || editAuthority === 'Anggota') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Wilayah Cluster
                  </label>
                  <select
                    value={editCluster}
                    onChange={(e) => setEditCluster(e.target.value as ClusterType)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none cursor-pointer"
                  >
                    {clusterOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Phone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Pengguna</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="editStatus"
                      value="Aktif"
                      checked={editStatus === 'Aktif'}
                      onChange={() => setEditStatus('Aktif')}
                      className="text-emerald-600"
                    />
                    <span className="text-emerald-700">Aktif</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="editStatus"
                      value="Non-Aktif"
                      checked={editStatus === 'Non-Aktif'}
                      onChange={() => setEditStatus('Non-Aktif')}
                      className="text-slate-600"
                    />
                    <span className="text-slate-500">Non-Aktif</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                />
              </div>

              {/* Modal Actions: Mobile-app Touch Friendly */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED AUTHORITY MODAL (PENGATURAN OTORITAS & HAK AKSES PENGGUNA) */}
      {authorityUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 space-y-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 my-6 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-900/20 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Pengaturan Hak Otoritas Pengguna
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Atur peran, kewenangan modul, dan wilayah penugasan akun
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthorityUserModal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Snapshot Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm ${
                    authorityUserModal.avatarColor || 'bg-slate-800'
                  }`}
                >
                  {authorityUserModal.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{authorityUserModal.name}</span>
                    {activeUser && authorityUserModal.id === activeUser.id && (
                      <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-black rounded">
                        Akun Aktif Anda
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono block">{authorityUserModal.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-[11px] text-slate-400 font-semibold">Otoritas Saat Ini:</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${getAuthorityBadgeColor(
                    authorityUserModal.authority
                  )}`}
                >
                  {getAuthorityIcon(authorityUserModal.authority)}
                  <span>{authorityUserModal.authority}</span>
                </span>
              </div>
            </div>

            {/* Active Admin Safety Notice */}
            {authorityUserModal.authority === 'Admin' &&
              selectedAuthority !== 'Admin' &&
              users.filter((u) => u.authority === 'Admin' && u.status === 'Aktif').length <= 1 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-900">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Peringatan Keamanan Administrator</p>
                    <p className="text-rose-800 mt-0.5 leading-relaxed">
                      Akun ini adalah <strong>satu-satunya Administrator aktif</strong> di sistem. Anda tidak dapat mengubah otoritas akun ini menjadi peran lain karena akan mengunci akses sistem administrasi.
                    </p>
                  </div>
                </div>
              )}

            {/* Active User Changing Own Authority Notice */}
            {activeUser && authorityUserModal.id === activeUser.id && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Anda sedang mengubah otoritas akun yang sedang digunakan saat ini. Hak akses menu dan dashboard akan langsung diperbarui.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveAuthority} className="space-y-5">
              {/* Role / Authority Selection: 6 Interactive Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Pilih Hak Otoritas Baru <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {USER_AUTHORITIES.map((auth) => {
                    const isSelected = selectedAuthority === auth;
                    return (
                      <button
                        key={auth}
                        type="button"
                        onClick={() => setSelectedAuthority(auth)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/30 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border inline-flex items-center gap-1.5 ${getAuthorityBadgeColor(
                              auth
                            )}`}
                          >
                            {getAuthorityIcon(auth)}
                            <span>{auth}</span>
                          </span>

                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-snug">
                          {getAuthorityDescription(auth)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cluster Assignment (If relevant for RT or Anggota) */}
              {(selectedAuthority === 'Ketua RT (Cluster)' || selectedAuthority === 'Anggota') && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <label className="block text-xs font-black text-slate-800">
                    Penugasan Wilayah Cluster
                  </label>
                  <select
                    value={selectedCluster}
                    onChange={(e) => setSelectedCluster(e.target.value as ClusterType)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-xs cursor-pointer"
                  >
                    {clusterOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {selectedAuthority === 'Ketua RT (Cluster)' && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-1">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Ketua RT bertanggung jawab memverifikasi pendaftaran warga di wilayah <strong>{selectedCluster}</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Live Preview: Access Levels for Selected Role */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pratinjau Hak Akses Modul ({selectedAuthority}):</span>
                  </span>
                  <span className="text-[10px] text-slate-500">8 Modul Terkonfigurasi</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {MODULE_PERMISSIONS.slice(0, 4).map((mod) => (
                    <div key={mod.id} className="p-2 bg-white rounded-xl border border-slate-200/80 text-[11px] space-y-1">
                      <p className="font-bold text-slate-800 truncate">{mod.name}</p>
                      <div>
                        {getAccessLevelBadge(mod.access[selectedAuthority], mod.accessLabels?.[selectedAuthority])}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Perlu hak spesifik per peran (View Reports, Approve Payments, Register)?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorityUserModal(null);
                      setActiveTab('granular');
                    }}
                    className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>Buka Kontrol Granular</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Notes / Penugasan SK */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Dasar Penugasan (SK atau Memo)
                </label>
                <textarea
                  rows={2}
                  value={authorityNotes}
                  onChange={(e) => setAuthorityNotes(e.target.value)}
                  placeholder="Contoh: SK Pengurus No. 05/RW-05/2026 atau Catatan pelimpahan wewenang..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                />
              </div>

              {/* Option to simulate login immediately */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-indigo-950">
                  <input
                    type="checkbox"
                    checked={switchAfterAuthoritySave}
                    onChange={(e) => setSwitchAfterAuthoritySave(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <span>Simpan & Langsung Masuk Sebagai Akun Ini (Simulasi Hak Akses)</span>
                </label>
                <LogIn className="w-4 h-4 text-indigo-500 shrink-0" />
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAuthorityUserModal(null)}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    authorityUserModal.authority === 'Admin' &&
                    selectedAuthority !== 'Admin' &&
                    users.filter((u) => u.authority === 'Admin' && u.status === 'Aktif').length <= 1
                  }
                  className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-amber-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Simpan Hak Otoritas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for Instant User Creation */}
      {!showAddForm && (
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="fixed bottom-24 right-5 z-30 md:hidden flex items-center gap-2 px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 active:scale-95 text-white font-black text-xs rounded-full shadow-2xl shadow-indigo-950/50 border border-white/20 transition-all cursor-pointer"
          title="Tambah Pengguna Baru"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tambah Pengguna</span>
        </button>
      )}
    </div>
  );
};
