import React, { useState, useEffect, useMemo } from 'react';
import { Member, Dependent, Payment, BenefitClaim, SystemSettings, ClusterType, CLUSTERS, AppUser, BenefitMaster, DEFAULT_BENEFITS } from '../types';
import { DocumentQualityReport } from '../lib/documentQualityValidator';
import { MemberDetailModal } from './MemberDetailModal';
import { DigitalKtaModal } from './DigitalKtaModal';
import { PrintMemberCardModal } from './PrintMemberCardModal';
import { PreviewKtaModal } from './PreviewKtaModal';
import { CsvMemberImportModal } from './CsvMemberImportModal';
import { EarlyOutreachModal } from './EarlyOutreachModal';
import { EditMemberBiodataModal } from './EditMemberBiodataModal';
import { ContactAdminModal } from './ContactAdminModal';
import { FamilyCardUploader } from './FamilyCardUploader';
import { FamilyCardModal } from './FamilyCardModal';
import { MemberPhotoCaptureModal } from './MemberPhotoCaptureModal';
import { calculateMemberExpiry, MemberAnnualExpiryInfo } from '../lib/expiryUtils';
import { checkDuplicateMember, findDuplicateNikMember, findDuplicateKkMember } from '../lib/duplicateValidator';
import { formatIDR, getMemberForUser } from '../lib/storage';
import { MessageTopic } from '../lib/contactAdminUtils';
import { getMemberKtaIssuanceInfo } from '../lib/ktaUtils';
import { MemberStatusTimeline } from './MemberStatusTimeline';
import { KtaQrScannerModal } from './KtaQrScannerModal';
import { 
  UserPlus, 
  Search, 
  Users, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  UserCheck,
  Filter,
  ArrowUpDown,
  X,
  RotateCcw,
  UploadCloud,
  FileSpreadsheet,
  Home,
  Clock,
  ArrowRight,
  AlertTriangle,
  XCircle,
  Send,
  MessageSquare,
  Sparkles,
  User,
  CreditCard,
  HeartHandshake,
  Lock,
  ExternalLink,
  ShieldAlert,
  Edit3,
  QrCode,
  Printer,
  FileText,
  ChevronDown,
  ChevronUp,
  Mail,
  EyeOff,
  Camera,
  Upload,
  Check
} from 'lucide-react';
import { useRolePermissions } from '../lib/permissions';

interface MemberRegistrationProps {
  members: Member[];
  payments?: Payment[];
  claims?: BenefitClaim[];
  settings?: SystemSettings;
  benefits?: BenefitMaster[];
  users?: AppUser[];
  activeUser?: AppUser;
  initialMode?: 'form' | 'directory';
  onAddMember: (newMember: Member) => void;
  onUpdateMember?: (updatedMember: Member) => void;
  onImportBatchMembers?: (newMembers: Member[]) => void;
  onSelectMemberForPayment?: (member: Member) => void;
  onViewReceipt?: (payment: Payment) => void;
  onNavigateToVerification?: () => void;
  onNavigateToDashboard?: () => void;
}

export const MemberRegistration: React.FC<MemberRegistrationProps> = ({
  members,
  payments = [],
  claims = [],
  settings = {
    communityName: 'Paguyuban Warga Rukun Sejahtera',
    communityAddress: 'Jl. Mawar Raya No. 12 RT 05 / RW 03, Jakarta Selatan',
    contactPerson: 'Bpk. Ahmad Fauzi (Ketua RW)',
    contactPhone: '0812-3456-7890',
    treasurerName: 'Ibu Hj. Siti Aminah',
    treasurerPhone: '0813-9876-5432',
    monthlyFeeAmount: 25000,
    annualFeeAmount: 300000,
    registrationFeeAmount: 0,
    mainMemberBenefitAmount: 10000000,
    dependentBenefitAmount: 6000000,
    bankAccounts: [],
  },
  benefits = DEFAULT_BENEFITS,
  users = [],
  activeUser,
  initialMode = 'form',
  onAddMember,
  onUpdateMember,
  onImportBatchMembers,
  onSelectMemberForPayment,
  onViewReceipt,
  onNavigateToVerification,
  onNavigateToDashboard,
}) => {
  const { can } = useRolePermissions();
  const canRegisterMembers = can(activeUser?.authority, 'register_members');
  const canManageDependents = can(activeUser?.authority, 'manage_dependents');
  const canRecordPayments = can(activeUser?.authority, 'record_payments');
  const isKetuaRt = activeUser?.authority === 'Ketua RT (Cluster)';
  const isReadOnlyRole = !canRegisterMembers;
  const userRtCluster = activeUser?.cluster;
  const userCluster = (activeUser?.cluster as ClusterType) || 'Cluster Sanur';

  // Active view: 'form' for dedicated full-page form, 'directory' for table
  const [activeView, setActiveView] = useState<'form' | 'directory'>(() => initialMode || 'form');
  const [submittedMember, setSubmittedMember] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(true);

  // Listen for open registration request event
  useEffect(() => {
    const handleOpen = () => {
      setActiveView('form');
      setSubmittedMember(null);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('open-public-registration', handleOpen);
    return () => {
      window.removeEventListener('open-public-registration', handleOpen);
    };
  }, []);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditBiodataModalOpen, setIsEditBiodataModalOpen] = useState(false);
  const [isContactAdminModalOpen, setIsContactAdminModalOpen] = useState(false);
  const [contactAdminRole, setContactAdminRole] = useState<'Admin' | 'Bendahara' | 'RT' | undefined>(undefined);
  const [contactTopic, setContactTopic] = useState<MessageTopic>('keluarga');
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [showInlineQuickAddDep, setShowInlineQuickAddDep] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [clusterFilter, setClusterFilter] = useState<string>(() => (isKetuaRt && activeUser?.cluster ? activeUser.cluster : 'Semua'));
  const [dateFilter, setDateFilter] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'number-asc'>('date-desc');
  const [selectedDetailMember, setSelectedDetailMember] = useState<Member | null>(null);
  const [selectedKtaMember, setSelectedKtaMember] = useState<Member | null>(null);
  const [selectedPrintCardMember, setSelectedPrintCardMember] = useState<Member | null>(null);
  const [selectedPreviewKtaMember, setSelectedPreviewKtaMember] = useState<Member | null>(null);
  const [outreachMember, setOutreachMember] = useState<Member | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [expandedTimelineMemberIds, setExpandedTimelineMemberIds] = useState<Set<string>>(new Set());

  // Quick lookup handler when a member's KTA QR code is scanned using camera
  const handleMemberIdentifiedByQr = (scannedMember: Member) => {
    // 1. Focus filter/search to this member
    setSearchTerm(scannedMember.memberNumber || scannedMember.name);
    if (scannedMember.cluster && (!isKetuaRt || userRtCluster === scannedMember.cluster)) {
      setClusterFilter(scannedMember.cluster);
    }
    setStatusFilter('Semua');
    setDateFilter('Semua');

    // 2. Open full MemberDetailModal immediately for complete verification
    setSelectedDetailMember(scannedMember);

    // 3. Inform user with notification banner
    setNotification(
      `QR Code KTA Terverifikasi: Menampilkan data lengkap untuk ${scannedMember.name} (${scannedMember.memberNumber || scannedMember.nik}).`
    );
    setTimeout(() => {
      setNotification(null);
    }, 7000);
  };

  const toggleMemberTimeline = (memberId: string) => {
    setExpandedTimelineMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleExpandAllTimelines = () => {
    const allIds = new Set(filteredMembers.map((m) => m.id));
    setExpandedTimelineMemberIds(allIds);
  };

  const handleCollapseAllTimelines = () => {
    setExpandedTimelineMemberIds(new Set());
  };

  // Form State & Draft Persistence
  const ADMIN_DRAFT_KEY = 'dana_kematian_admin_reg_draft_v2';
  const initialDraft = useMemo(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_DRAFT_KEY) || localStorage.getItem(ADMIN_DRAFT_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const [name, setName] = useState<string>(() => initialDraft?.name || '');
  const [nik, setNik] = useState<string>(() => initialDraft?.nik || '');
  const [phone, setPhone] = useState<string>(() => initialDraft?.phone || '');
  const [email, setEmail] = useState<string>(() => initialDraft?.email || '');
  const [password, setPassword] = useState<string>(() => initialDraft?.password || '');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [cluster, setCluster] = useState<ClusterType>(() => {
    if (isKetuaRt && activeUser?.cluster) return activeUser.cluster as ClusterType;
    return (initialDraft?.cluster as ClusterType) || 'Cluster Sanur';
  });
  const [address, setAddress] = useState<string>(() => initialDraft?.address || '');
  const [joinDate, setJoinDate] = useState<string>(() => initialDraft?.joinDate || new Date().toISOString().split('T')[0]);
  const [dependents, setDependents] = useState<Dependent[]>(() => (Array.isArray(initialDraft?.dependents) ? initialDraft.dependents : []));
  const [depName, setDepName] = useState('');
  const [depRel, setDepRel] = useState('Suami/Istri');
  const [depAge, setDepAge] = useState('');
  const [familyCardFile, setFamilyCardFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>(() => initialDraft?.photoUrl || '');
  const [isPhotoCaptureModalOpen, setIsPhotoCaptureModalOpen] = useState<boolean>(false);
  const [familyCardPhotoUrl, setFamilyCardPhotoUrl] = useState<string>(() => initialDraft?.familyCardPhotoUrl || '');
  const [familyCardFileName, setFamilyCardFileName] = useState<string>(() => initialDraft?.familyCardFileName || '');
  const [familyCardNumber, setFamilyCardNumber] = useState<string>(() => initialDraft?.familyCardNumber || '');
  const [familyCardQualityReport, setFamilyCardQualityReport] = useState<DocumentQualityReport | null>(null);
  const [selectedKkViewerMember, setSelectedKkViewerMember] = useState<Member | null>(null);

  // Real-time Duplicate Checking for NIK and Nomor KK
  const duplicateNikMember = useMemo(() => {
    return findDuplicateNikMember(members, nik);
  }, [members, nik]);

  const duplicateKkMember = useMemo(() => {
    return findDuplicateKkMember(members, familyCardNumber);
  }, [members, familyCardNumber]);

  // Auto-save admin draft
  useEffect(() => {
    const hasData = Boolean(name || nik || phone || email || address || photoUrl || familyCardPhotoUrl || dependents.length > 0);
    if (hasData) {
      try {
        const draftObj = {
          name,
          nik,
          phone,
          email,
          password,
          cluster,
          address,
          joinDate,
          dependents,
          photoUrl: photoUrl && photoUrl.length < 120000 ? photoUrl : '',
          // Guard against localStorage quota exceeded by not storing multi-MB base64 dataUrls
          familyCardPhotoUrl: familyCardPhotoUrl && familyCardPhotoUrl.length < 120000 ? familyCardPhotoUrl : '',
          familyCardFileName,
          familyCardNumber,
        };
        const serializedDraft = JSON.stringify(draftObj);
        try {
          sessionStorage.setItem(ADMIN_DRAFT_KEY, serializedDraft);
        } catch {
          // ignore session quota warning
        }
        try {
          localStorage.setItem(ADMIN_DRAFT_KEY, serializedDraft);
        } catch {
          // ignore local quota warning
        }
      } catch (e) {
        console.warn('Admin draft save warning:', e);
      }
    }
  }, [name, nik, phone, email, password, cluster, address, joinDate, dependents, photoUrl, familyCardPhotoUrl, familyCardFileName, familyCardNumber]);

  // Open form if draft exists on mount
  useEffect(() => {
    if (initialDraft && (initialDraft.name || initialDraft.nik || initialDraft.photoUrl || initialDraft.familyCardPhotoUrl)) {
      setShowForm(true);
    }
  }, [initialDraft]);

  // Sync cluster filter and form cluster if activeUser switches
  useEffect(() => {
    if (activeUser?.authority === 'Ketua RT (Cluster)' && activeUser.cluster) {
      setClusterFilter(activeUser.cluster);
      setCluster(activeUser.cluster as ClusterType);
    }
  }, [activeUser]);

  const handleCloseForm = () => {
    setShowForm(false);
  };

  const handleResetAdminDraft = () => {
    if (window.confirm('Hapus draf formulir dan mulai isian baru?')) {
      try {
        sessionStorage.removeItem(ADMIN_DRAFT_KEY);
        localStorage.removeItem(ADMIN_DRAFT_KEY);
      } catch {
        // ignore
      }
      setName('');
      setNik('');
      setPhone('');
      setEmail('');
      setPassword('');
      setAddress('');
      setDependents([]);
      setPhotoUrl('');
      setFamilyCardFile(null);
      setFamilyCardPhotoUrl('');
      setFamilyCardFileName('');
      setFamilyCardNumber('');
    }
  };

  // Quick form for Anggota to add dependent inline
  const [myQuickDepName, setMyQuickDepName] = useState('');
  const [myQuickDepRel, setMyQuickDepRel] = useState('Suami/Istri');
  const [myQuickDepAge, setMyQuickDepAge] = useState('');

  const handleAddDependent = () => {
    if (!depName.trim()) return;
    setDependents([
      ...dependents,
      {
        id: 'dep-' + Date.now(),
        name: depName.trim(),
        relationship: depRel,
        age: depAge ? parseInt(depAge, 10) : undefined,
      },
    ]);
    setDepName('');
    setDepAge('');
  };

  const handleRemoveDependent = (id: string) => {
    setDependents(dependents.filter((d) => d.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nik.trim() || !phone.trim() || !address.trim()) {
      alert('Mohon isi semua field utama (Nama, NIK, No. Telepon, Cluster, Alamat)');
      return;
    }

    // Validasi Data Double NIK & Nomor KK
    const dupCheck = checkDuplicateMember(members, nik, familyCardNumber);
    if (dupCheck.isDuplicate) {
      alert(`PENDAFTARAN DITOLAK (DATA DOUBLE TERDETEKSI):\n\n${dupCheck.message}`);
      return;
    }

    if (!email.trim() || !password.trim()) {
      alert('Mohon lengkapi Email dan Kata Sandi untuk akun portal warga!');
      return;
    }

    if (!familyCardPhotoUrl) {
      alert('Registrasi anggota wajib melampirkan foto Kartu Keluarga (KK). Silakan unggah foto Kartu Keluarga terlebih dahulu.');
      return;
    }

    // Real-time Document Quality Warning Confirmation
    if (familyCardQualityReport && !familyCardQualityReport.isAcceptable) {
      const confirmSubmit = window.confirm(
        `PERINGATAN KUALITAS DOKUMEN:\n\n` +
        `Foto Kartu Keluarga terdeteksi memiliki catatan:\n` +
        `• ${familyCardQualityReport.headline}: ${familyCardQualityReport.feedbackMessage}\n` +
        `• Skor Kualitas: ${familyCardQualityReport.overallScore}%\n\n` +
        `Apakah Anda yakin ingin tetap menyimpan berkas ini, atau ingin memfoto ulang dengan kamera dokumen real-time agar tidak ditolak Ketua RT?`
      );
      if (!confirmSubmit) {
        return;
      }
    }

    const nextNumber = members.length + 1;
    const padNum = nextNumber.toString().padStart(3, '0');
    const memberNumber = `ADK-2026-${padNum}`;

    const finalCluster: ClusterType = (isKetuaRt && userRtCluster) ? (userRtCluster as ClusterType) : cluster;

    const newMember: Member = {
      id: 'mem-' + Date.now(),
      memberNumber,
      name: name.trim(),
      nik: nik.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      photoUrl: photoUrl || undefined,
      familyCardNumber: familyCardNumber.trim() || undefined,
      familyCardPhotoUrl,
      familyCardFileName: familyCardFileName || `Kartu_Keluarga_${name.trim().replace(/\s+/g, '_')}.jpg`,
      familyCardQualityScore: familyCardQualityReport ? familyCardQualityReport.overallScore : undefined,
      familyCardQualityStatus: familyCardQualityReport ? familyCardQualityReport.status : undefined,
      phone: phone.trim(),
      cluster: finalCluster,
      address: address.trim(),
      joinDate,
      status: 'Menunggu Verifikasi RT',
      verificationStatus: 'Pending',
      dependentsCount: dependents.length,
      dependentsList: dependents,
    };

    onAddMember(newMember);

    // Clear form state including photo
    setPhotoUrl('');

    // Clear saved admin draft
    try {
      sessionStorage.removeItem(ADMIN_DRAFT_KEY);
      localStorage.removeItem(ADMIN_DRAFT_KEY);
    } catch {
      // ignore
    }

    setNotification(
      `Pendaftaran Terkirim! Warga atas nama "${name.trim()}" (${finalCluster}) berhasil didaftarkan dengan akun login email "${email.trim()}". Status saat ini: "Menunggu Verifikasi Ketua RT/Cluster". Pembayaran iuran akan dibuka setelah disetujui Ketua RT.`
    );
    setTimeout(() => setNotification(null), 8000);

    // Reset Form
    setName('');
    setNik('');
    setPhone('');
    setEmail('');
    setPassword('');
    setCluster(isKetuaRt && userRtCluster ? (userRtCluster as ClusterType) : 'Cluster Sanur');
    setAddress('');
    setDependents([]);
    setFamilyCardFile(null);
    setFamilyCardPhotoUrl('');
    setFamilyCardFileName('');
    setFamilyCardNumber('');
    setFamilyCardQualityReport(null);
    setSubmittedMember(newMember);
    setShowForm(true);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('Semua');
    setClusterFilter(isKetuaRt && userRtCluster ? userRtCluster : 'Semua');
    setDateFilter('Semua');
    setSortBy('date-desc');
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'Semua' || (!isKetuaRt && clusterFilter !== 'Semua') || dateFilter !== 'Semua' || sortBy !== 'date-desc';

  // BASE ACCESSIBLE MEMBERS: Ketua RT can strictly only see data belonging to their RT cluster
  const accessibleMembers = React.useMemo(() => {
    if (isKetuaRt && userRtCluster) {
      return members.filter((m) => m.cluster === userRtCluster);
    }
    return members;
  }, [members, isKetuaRt, userRtCluster]);

  // Calculate expiry info for accessible active members
  const memberExpiryMap = React.useMemo(() => {
    const map = new Map<string, MemberAnnualExpiryInfo>();
    accessibleMembers.forEach((m) => {
      map.set(m.id, calculateMemberExpiry(m, payments, new Date(), settings));
    });
    return map;
  }, [accessibleMembers, payments]);

  const expiringSoonMembers = accessibleMembers.filter((m) => {
    const exp = memberExpiryMap.get(m.id);
    return exp?.isExpiringSoon;
  });

  const expiredMembers = accessibleMembers.filter((m) => {
    const exp = memberExpiryMap.get(m.id);
    return exp?.isExpired && m.status !== 'Meninggal' && m.status !== 'Menunggu Verifikasi RT';
  });

  const activeMembers = React.useMemo(() => {
    return accessibleMembers.filter((m) => m.status === 'Aktif' || m.verificationStatus === 'Verified');
  }, [accessibleMembers]);

  const pendingRtMembers = React.useMemo(() => {
    return accessibleMembers.filter((m) => m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending');
  }, [accessibleMembers]);

  const filteredMembers = accessibleMembers
    .filter((m) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        m.nik.includes(query) ||
        m.memberNumber.toLowerCase().includes(query) ||
        m.phone.toLowerCase().includes(query) ||
        (m.cluster && m.cluster.toLowerCase().includes(query)) ||
        m.address.toLowerCase().includes(query) ||
        (m.dependentsList && m.dependentsList.some((d) => d.name.toLowerCase().includes(query)));

      const exp = memberExpiryMap.get(m.id);

      let matchesStatus = true;
      if (statusFilter === 'Semua') {
        matchesStatus = true;
      } else if (statusFilter === 'Segera Habis') {
        matchesStatus = !!exp?.isExpiringSoon;
      } else if (statusFilter === 'Kedaluwarsa') {
        matchesStatus = !!exp?.isExpired && m.status !== 'Meninggal' && m.status !== 'Menunggu Verifikasi RT';
      } else if (statusFilter === 'Aktif') {
        matchesStatus = m.status === 'Aktif' || m.verificationStatus === 'Verified';
      } else {
        matchesStatus = m.status === statusFilter;
      }

      const matchesCluster = isKetuaRt ? true : (clusterFilter === 'Semua' ? true : m.cluster === clusterFilter);

      let matchesDate = true;
      if (dateFilter === '2026') {
        matchesDate = m.joinDate.startsWith('2026');
      } else if (dateFilter === '2025') {
        matchesDate = m.joinDate.startsWith('2025');
      } else if (dateFilter === 'BulanIni') {
        matchesDate = m.joinDate.startsWith('2026-08');
      } else if (dateFilter === 'Q1-2026') {
        matchesDate = m.joinDate.startsWith('2026-01') || m.joinDate.startsWith('2026-02') || m.joinDate.startsWith('2026-03');
      }

      return matchesSearch && matchesStatus && matchesCluster && matchesDate;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime();
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'number-asc') {
        return a.memberNumber.localeCompare(b.memberNumber);
      }
      return 0;
    });

  const handleBatchImport = (newMembers: Member[]) => {
    if (onImportBatchMembers) {
      onImportBatchMembers(newMembers);
    } else {
      newMembers.forEach((m) => onAddMember(m));
    }
    setNotification(`Berhasil! ${newMembers.length} anggota baru berhasil diimpor ke sistem secara massal.`);
    setTimeout(() => setNotification(null), 6000);
  };

  const handleSaveMemberBiodata = (updated: Member) => {
    if (onUpdateMember) {
      onUpdateMember(updated);
    }
    setNotification(`Biodata dan data keluarga ${updated.name} berhasil diperbarui!`);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleQuickAddDependentToMyMember = (myMem: Member) => {
    if (!myQuickDepName.trim()) return;
    const newDep: Dependent = {
      id: 'dep-' + Date.now(),
      name: myQuickDepName.trim(),
      relationship: myQuickDepRel,
      age: myQuickDepAge ? parseInt(myQuickDepAge, 10) : undefined,
    };
    const currentList = myMem.dependentsList || [];
    const updatedList = [...currentList, newDep];
    const updated: Member = {
      ...myMem,
      dependentsList: updatedList,
      dependentsCount: updatedList.length,
    };
    if (onUpdateMember) {
      onUpdateMember(updated);
    }
    setMyQuickDepName('');
    setMyQuickDepAge('');
    setShowInlineQuickAddDep(false);
    setNotification(`Anggota keluarga "${newDep.name}" (${newDep.relationship}) berhasil ditambahkan ke daftar tanggungan!`);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleQuickRemoveDependentFromMyMember = (myMem: Member, depId: string) => {
    const currentList = myMem.dependentsList || [];
    const targetDep = currentList.find((d) => d.id === depId);
    const updatedList = currentList.filter((d) => d.id !== depId);
    const updated: Member = {
      ...myMem,
      dependentsList: updatedList,
      dependentsCount: updatedList.length,
    };
    if (onUpdateMember) {
      onUpdateMember(updated);
    }
    setNotification(`Data ${targetDep?.name || 'tanggungan'} telah dihapus.`);
    setTimeout(() => setNotification(null), 4000);
  };

  const isAnggota = activeUser?.authority === 'Anggota';
  const myMember = isAnggota 
    ? (getMemberForUser(activeUser, members) || members.find(m => m?.name && activeUser?.name && m.name.toLowerCase() === activeUser.name.toLowerCase()) || members[0])
    : null;

  if (isAnggota && myMember && activeView !== 'form') {
    const expiry = calculateMemberExpiry(myMember, payments, new Date(), settings);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Notification Banner */}
        {notification && (
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-in zoom-in-95 shadow-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-emerald-800 hover:text-emerald-950 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Profile Title */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Profil Data Diri & Keluarga Terdaftar</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>{myMember.name}</span>
              <span className="font-mono text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-bold">
                {myMember.memberNumber}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data diri, kontak darurat, dan daftar tanggungan keluarga yang mendapatkan jaminan santunan duka.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* BUTTON BUKA FORM DAFTAR WARGA BARU */}
            <button
              type="button"
              onClick={() => {
                setActiveView('form');
                setSubmittedMember(null);
                setShowForm(true);
              }}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20 inline-flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
              title="Buka Formulir Pendaftaran Warga Baru"
            >
              <UserPlus className="w-4 h-4 text-emerald-200" />
              <span>+ Form Pendaftaran Baru</span>
            </button>

            {/* BUTTON HUBUNGI PENGURUS VIA WA */}
            <button
              type="button"
              onClick={() => {
                setContactAdminRole('RT');
                setContactTopic('keluarga');
                setIsContactAdminModalOpen(true);
              }}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm rounded-xl border border-emerald-300 transition-all inline-flex items-center gap-1.5 shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
              title="Hubungi Ketua RT / Admin via WhatsApp otomatis"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Hubungi Pengurus (WA)</span>
            </button>

            {/* BUTTON UBAH BIODATA & DATA KELUARGA */}
            <button
              type="button"
              onClick={() => {
                setMemberToEdit(myMember);
                setIsEditBiodataModalOpen(true);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              title="Buka form ubah biodata diri & tambah anggota keluarga"
            >
              <Edit3 className="w-4 h-4 text-emerald-400" />
              <span>Ubah Biodata & Keluarga</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDetailMember(myMember)}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm rounded-xl border border-slate-300 transition-all shadow-xs inline-flex items-center gap-2"
            >
              <Eye className="w-4 h-4 text-slate-600" />
              <span>Lihat KTA Digital</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onSelectMemberForPayment) {
                  onSelectMemberForPayment(myMember);
                }
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20 inline-flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Bayar Iuran</span>
            </button>
          </div>
        </div>

        {/* Status Verification & Protection Alert */}
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          myMember.status === 'Aktif' || myMember.verificationStatus === 'Verified'
            ? expiry.isExpiringSoon
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : expiry.isExpired
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : myMember.status === 'Menunggu Verifikasi RT'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-slate-50 border-slate-300 text-slate-800'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl font-black shrink-0 ${
              myMember.status === 'Aktif' || myMember.verificationStatus === 'Verified'
                ? expiry.isExpiringSoon
                  ? 'bg-amber-500 text-slate-950'
                  : expiry.isExpired
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-slate-950'
            }`}>
              {myMember.status === 'Aktif' || myMember.verificationStatus === 'Verified' ? (
                expiry.isExpiringSoon || expiry.isExpired ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base">
                  {myMember.status === 'Aktif' || myMember.verificationStatus === 'Verified'
                    ? expiry.statusLabel
                    : 'Pendaftaran Menunggu Persetujuan Ketua RT'}
                </span>
                <span className="px-2 py-0.5 bg-white/80 font-mono font-bold text-xs rounded-full border border-black/10">
                  {myMember.status}
                </span>
              </div>
              <p className="text-xs mt-0.5 leading-relaxed opacity-90">
                {myMember.status === 'Aktif' || myMember.verificationStatus === 'Verified'
                  ? `Masa perlindungan santunan aktif s/d ${expiry.expiryDateFormatted}. Anggota utama dan seluruh keluarga terdaftar berhak atas santunan dana kematian & ambulans jenazah.`
                  : `Data pendaftaran Anda sedang diproses verifikasi oleh Ketua RT ${myMember.cluster || 'Cluster'}. Segera setelah disetujui, Anda dapat melakukan pembayaran iuran tahunan.`}
              </p>
            </div>
          </div>

          {(expiry.isExpiringSoon || expiry.isExpired) && (
            <button
              type="button"
              onClick={() => {
                if (onSelectMemberForPayment) {
                  onSelectMemberForPayment(myMember);
                }
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shrink-0"
            >
              Perpanjang Sekarang
            </button>
          )}
        </div>

        {/* 2-Column Details: Data Diri & Data Tanggungan */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Informasi Pribadi (Biodata) */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                <span>Data Identitas Anggota Utama</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setMemberToEdit(myMember);
                  setIsEditBiodataModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95"
                title="Edit nama, NIK, No. HP, atau alamat"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ubah Biodata</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block text-[11px]">Nama Lengkap:</span>
                <span className="font-bold text-slate-900 text-sm">{myMember.name}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block text-[11px]">Nomor NIK:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{myMember.nik || '-'}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block text-[11px]">Nomor Pokok Anggota:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">{myMember.memberNumber}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block text-[11px]">No. WhatsApp / HP:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{myMember.phone}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Cluster Perumahan:</span>
                <span className="font-bold text-slate-900 text-sm">{myMember.cluster}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Alamat Lengkap Rumah:</span>
                <span className="font-medium text-slate-800 leading-relaxed">{myMember.address}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block text-[11px]">Tanggal Terdaftar:</span>
                <span className="font-mono font-bold text-slate-800">{myMember.joinDate}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500 block text-[11px]">Verifikator RT:</span>
                <span className="font-bold text-slate-800">{myMember.verifiedByRt || `Ketua RT ${myMember.cluster}`}</span>
              </div>
            </div>

            {myMember.rtNotes && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
                <span className="font-bold text-amber-900 block">Catatan Verifikasi RT:</span>
                <p className="text-amber-800 mt-0.5">{myMember.rtNotes}</p>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Tanggungan Keluarga Terdaftar */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-600" />
                <span>Daftar Tanggungan Keluarga ({myMember.dependentsList?.length || 0})</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInlineQuickAddDep(!showInlineQuickAddDep)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5 hover:scale-105 active:scale-95"
                  title="Tambah tanggungan anggota keluarga"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showInlineQuickAddDep ? 'Tutup Form' : '+ Tambah Keluarga'}</span>
                </button>
              </div>
            </div>

            {/* FORM INLINE TAMBAH KELUARGA CEPAT */}
            {showInlineQuickAddDep && (
              <div className="p-4 bg-slate-50 border border-emerald-300 rounded-2xl space-y-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Input Data Anggota Keluarga Baru</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowInlineQuickAddDep(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Lengkap *</label>
                    <input
                      type="text"
                      placeholder="Nama istri / anak / ortu..."
                      value={myQuickDepName}
                      onChange={(e) => setMyQuickDepName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Hubungan *</label>
                    <select
                      value={myQuickDepRel}
                      onChange={(e) => setMyQuickDepRel(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="Suami/Istri">Suami / Istri</option>
                      <option value="Anak Kandung">Anak Kandung</option>
                      <option value="Orang Tua">Orang Tua</option>
                      <option value="Mertua">Mertua</option>
                      <option value="Saudara Kandung">Saudara Kandung</option>
                      <option value="Lainnya">Lainnya (Serumah)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Usia (Thn)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      placeholder="Usia"
                      value={myQuickDepAge}
                      onChange={(e) => setMyQuickDepAge(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInlineQuickAddDep(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddDependentToMyMember(myMember)}
                    disabled={!myQuickDepName.trim()}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Simpan Anggota Keluarga</span>
                  </button>
                </div>
              </div>
            )}

            {/* DAFTAR ANGGOTA KELUARGA */}
            {(!myMember.dependentsList || myMember.dependentsList.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-3">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Belum ada tanggungan keluarga terdaftar</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Daftarkan anggota keluarga serumah yang tercatat dalam Kartu Keluarga (KK). Hak santunan duka cita diberikan sesuai paket Master Hak & Manfaat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInlineQuickAddDep(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Data Keluarga Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {myMember.dependentsList.map((dep, idx) => (
                  <div key={dep.id || idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-extrabold text-xs text-slate-900">{dep.name}</p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold text-emerald-700">{dep.relationship}</span>
                          {dep.age ? ` • ${dep.age} Tahun` : ''}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-md border border-emerald-200">
                        Tercatat di KK
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickRemoveDependentFromMyMember(myMember, dep.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title={`Hapus ${dep.name} dari daftar keluarga`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Hak Manfaat Santunan Terdaftar (Sesuai Master Hak & Manfaat)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Keluarga yang tercatat resmi mendapatkan hak santunan duka cita dan fasilitas pemakaman sesuai paket aktif yang terdaftar pada Master Hak & Manfaat Paguyuban:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {benefits.filter(b => b.isActive).map(b => (
                  <div key={b.id} className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">{b.categoryName}</span>
                      <span className="text-[10px] text-slate-500">Target: {b.targetRelationship}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-700 block">{formatIDR(b.defaultTotalPackage)}</span>
                      <span className="text-[10px] text-slate-400">Tunai: {formatIDR(b.maxCashAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Security & Privacy Notification */}
        <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-slate-600 text-xs flex items-start gap-3">
          <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p>
            <strong>Privasi & Keamanan Data Warga:</strong> Sebagai akun dengan otoritas <em>Anggota</em>, sistem secara otomatis mengunci tampilan hanya pada data diri dan keluarga Anda. Anda tidak dapat melihat atau mengakses data warga lain.
          </p>
        </div>

        {/* Detail Modal */}
        {selectedDetailMember && (
          <MemberDetailModal
            member={selectedDetailMember}
            payments={payments}
            claims={claims}
            onClose={() => setSelectedDetailMember(null)}
            onViewReceipt={onViewReceipt}
            onSelectMemberForPayment={onSelectMemberForPayment}
          />
        )}

        {/* EDIT BIODATA & FAMILY MODAL */}
        <EditMemberBiodataModal
          isOpen={isEditBiodataModalOpen}
          member={memberToEdit || myMember}
          members={members}
          settings={settings}
          benefits={benefits}
          onClose={() => {
            setIsEditBiodataModalOpen(false);
            setMemberToEdit(null);
          }}
          onSave={handleSaveMemberBiodata}
        />

        {/* HUBUNGI ADMIN / PENGURUS VIA WA MODAL */}
        <ContactAdminModal
          users={users}
          member={myMember}
          settings={settings}
          isOpen={isContactAdminModalOpen}
          onClose={() => setIsContactAdminModalOpen(false)}
          defaultAdminRole={contactAdminRole}
          defaultTopic={contactTopic}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Dynamic Header Banner with Navigation and View Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {activeView === 'form' ? (
                <>
                  <UserPlus className="w-6 h-6 text-emerald-600" />
                  <span>Formulir Pendaftaran Warga Baru</span>
                </>
              ) : (
                <>
                  <Users className="w-6 h-6 text-emerald-600" />
                  <span>Direktori & Data Anggota Paguyuban</span>
                </>
              )}
            </h2>
            {isKetuaRt && userRtCluster && (
              <span className="px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black rounded-lg">
                Wilayah {userRtCluster}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeView === 'form'
              ? 'Lengkapi biodata calon anggota dan susunan tanggungan keluarga untuk mendapatkan jaminan santunan kematian paguyuban.'
              : isKetuaRt && userRtCluster 
              ? `Menampilkan data warga terdaftar khusus lingkungan RT ${userRtCluster}.`
              : 'Kelola direktori warga terdaftar, verifikasi KTA, dan status keanggotaan.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Tombol Kembali ke Beranda / Dashboard */}
          {onNavigateToDashboard && (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
              title="Kembali ke Beranda"
            >
              <ArrowRight className="w-4 h-4 rotate-180 text-emerald-600" />
              <span>{activeUser ? (activeUser.authority === 'Anggota' ? 'Ke Portal Warga' : 'Ke Dashboard') : '← Kembali ke Beranda'}</span>
            </button>
          )}

          {/* Segmented View Switcher untuk Pengurus/Admin/RT */}
          {canRegisterMembers && (
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setActiveView('form');
                  setSubmittedMember(null);
                  setShowForm(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'form'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Form Pendaftaran</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('directory')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'directory'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Direktori Warga ({accessibleMembers.length})</span>
              </button>
            </div>
          )}

          {/* Aksi Khusus Mode Direktori */}
          {activeView === 'directory' && (
            <>
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Pindai QR KTA Warga"
              >
                <QrCode className="w-4 h-4 text-emerald-200" />
                <span>Pindai QR</span>
              </button>

              {canRegisterMembers && (
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  title="Impor CSV Massal"
                >
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Impor CSV</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-in zoom-in-95">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button type="button" onClick={() => setNotification(null)} className="text-emerald-800 hover:text-emerald-950 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN PENUH 1 HALAMAN: FORMULIR PENDAFTARAN WARGA BARU                */}
      {/* ========================================================================= */}
      {activeView === 'form' && (
        <div className="space-y-6">
          {submittedMember ? (
            /* SUCCESS CONFIRMATION PANEL */
            <div className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-emerald-500/40 shadow-xl text-center space-y-6 animate-in zoom-in-95 max-w-2xl mx-auto">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider">
                  PENDAFTARAN BERHASIL TERCATAT
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-3">
                  Selamat Datang, {submittedMember.name}!
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto mt-2 leading-relaxed">
                  Data pendaftaran warga baru Anda telah berhasil dikirim ke database paguyuban dan sedang menunggu verifikasi serta persetujuan dari Ketua RT {submittedMember.cluster}.
                </p>
              </div>

              {/* Data Ringkasan Pendaftaran */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5 font-mono max-w-lg mx-auto">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Nomor Pokok Anggota (NPA):</span>
                  <span className="font-extrabold text-emerald-700 text-sm">{submittedMember.memberNumber}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Nomor NIK:</span>
                  <span className="font-bold text-slate-900">{submittedMember.nik}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Cluster / RT:</span>
                  <span className="font-bold text-slate-900">{submittedMember.cluster}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Tanggungan Keluarga:</span>
                  <span className="font-bold text-slate-900">{submittedMember.dependentsCount} Jiwa Terdaftar</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">Status Verifikasi:</span>
                  <span className="font-bold text-amber-600 uppercase">Menunggu Verifikasi RT</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left max-w-lg mx-auto leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Tahapan Selanjutnya:</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-800 pl-1">
                  <li>Ketua RT {submittedMember.cluster} akan memverifikasi keabsahan data kependudukan & berkas KK Anda.</li>
                  <li>Setelah diverifikasi RT, Anda dapat melakukan pembayaran iuran paguyuban melalui menu Pembayaran.</li>
                  <li>Setelah divalidasi bendahara, KTA Digital resmi Anda akan langsung aktif.</li>
                </ol>
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedMember(null);
                    setShowForm(true);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20 flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Daftarkan Warga Lain</span>
                </button>

                {canRegisterMembers && (
                  <button
                    type="button"
                    onClick={() => setActiveView('directory')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>Lihat di Direktori Warga</span>
                  </button>
                )}

                {onNavigateToDashboard && (
                  <button
                    type="button"
                    onClick={onNavigateToDashboard}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-all border border-slate-300 cursor-pointer"
                  >
                    <span>{activeUser ? 'Kembali ke Dashboard' : '← Selesai / Ke Beranda'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-emerald-500/30 shadow-lg animate-in slide-in-from-top duration-200">
              <div className="border-b border-slate-200 pb-4 mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    <span>Formulir Lengkap Pendaftaran Calon Anggota</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Isi data lengkap sesuai KTP & Kartu Keluarga untuk pendaftaran anggota paguyuban dana kematian.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="Tutup Formulir dan Batal Mendaftar"
                >
                  <X className="w-4 h-4 text-slate-500" />
                  <span>Batal / Tutup</span>
                </button>
              </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Draft Auto-save Indicator */}
            {(name || nik || phone || photoUrl || familyCardPhotoUrl) && (
              <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Draf data registrasi tersimpan otomatis di perangkat. Data tidak akan hilang jika Anda berpindah tab atau memilih foto.</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetAdminDraft}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline shrink-0 cursor-pointer"
                >
                  Reset Formulir
                </button>
              </div>
            )}

            {/* SEKSI FOTO PROFIL KTA WARGA (PENGAMBILAN KAMERA LANGSUNG) */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 sm:p-5 transition-all shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-300">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Foto Profil KTA Warga</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Pasfoto Resmi Kartu Anggota (KTA)</span>
                    <span className="text-[11px] font-medium text-slate-500 font-sans">
                      (Bisa Difoto Langsung via Kamera Laptop/HP)
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admin dapat memotret warga langsung menggunakan kamera perangkat. Foto ini akan otomatis tampil di KTA Digital dan kartu fisik.
                  </p>
                </div>

                {photoUrl && (
                  <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pasfoto Siap Disimpan</span>
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                {/* Photo Preview Box (3:4 ratio) */}
                <div className="relative shrink-0">
                  <div className="w-28 h-36 sm:w-32 sm:h-42 rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 bg-white shadow-sm flex flex-col items-center justify-center relative group">
                    {photoUrl ? (
                      <>
                        <img
                          src={photoUrl}
                          alt="Foto KTA Anggota"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsPhotoCaptureModalOpen(true)}
                            className="p-2 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform cursor-pointer shadow-md"
                            title="Foto Ulang via Kamera"
                          >
                            <Camera className="w-4 h-4 text-emerald-600" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                        <User className="w-12 h-12 mb-1.5 text-slate-300" />
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                          Pasfoto KTA
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">3 x 4 Rasio</span>
                      </div>
                    )}
                  </div>

                  {photoUrl && (
                    <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full shadow-xs flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" />
                      <span>KTA</span>
                    </span>
                  )}
                </div>

                {/* Photo Action Controls */}
                <div className="flex-1 space-y-2.5 text-center sm:text-left w-full">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    {/* Primary Button: Open Camera */}
                    <button
                      type="button"
                      onClick={() => setIsPhotoCaptureModalOpen(true)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{photoUrl ? 'Ambil Ulang via Kamera' : 'Ambil Foto via Kamera (Langsung)'}</span>
                    </button>

                    {/* Secondary Button: Upload File */}
                    <label className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Unggah dari Berkas</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const res = ev.target?.result as string;
                            if (res) setPhotoUrl(res);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* Delete Photo Button */}
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="px-3 py-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Foto</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                    <p className="flex items-center gap-1.5 font-medium text-slate-700">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Panduan Pengambilan Pasfoto KTA:</span>
                    </p>
                    <ul className="list-disc list-inside text-slate-500 space-y-0.5 pl-1">
                      <li>Posisikan wajah dan bahu tegak di tengah bingkai kamera.</li>
                      <li>Pastikan pencahayaan cukup dan wajah terlihat jelas tanpa bayangan gelap.</li>
                      <li>Kamera dilengkapi garis bantu oval dan pemotong otomatis ke rasio resmi 3:4.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nomor Induk Kependudukan (NIK) <span className="text-rose-500">*</span></span>
                  {duplicateNikMember && (
                    <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      Data Double Terdeteksi
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="16 digit angka KTP"
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono transition-all outline-none ${
                    duplicateNikMember
                      ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-500 font-bold'
                      : nik && nik.length === 16
                      ? 'border-emerald-400 bg-emerald-50/50 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white'
                  }`}
                />
                {duplicateNikMember && (
                  <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Data Double NIK Terdeteksi!</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed font-normal">
                      NIK ini sudah terdaftar atas nama <strong className="text-rose-950 font-bold">{duplicateNikMember.name}</strong> ({duplicateNikMember.cluster || 'Cluster'}, No. Anggota: {duplicateNikMember.memberNumber || '-'}). Satu NIK KTP hanya boleh terdaftar satu kali.
                    </p>
                  </div>
                )}
                {!duplicateNikMember && nik && nik.length === 16 && (
                  <p className="mt-1 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>NIK Unik & Belum Terdaftar (16 Digit Lengkap)</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nomor Kartu Keluarga (KK) <span className="text-slate-400 font-normal">(16 Digit)</span></span>
                  {duplicateKkMember && (
                    <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      Data Double Terdeteksi
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="16 digit angka No. KK"
                  value={familyCardNumber}
                  onChange={(e) => setFamilyCardNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono transition-all outline-none ${
                    duplicateKkMember
                      ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-500 font-bold'
                      : familyCardNumber && familyCardNumber.length === 16
                      ? 'border-emerald-400 bg-emerald-50/50 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white'
                  }`}
                />
                {duplicateKkMember && (
                  <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-semibold space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Data Double Nomor KK Terdeteksi!</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed font-normal">
                      Nomor KK ini sudah terdaftar atas nama Kepala Keluarga <strong className="text-rose-950 font-bold">{duplicateKkMember.name}</strong> ({duplicateKkMember.cluster || 'Cluster'}, No. Anggota: {duplicateKkMember.memberNumber || '-'}).
                    </p>
                  </div>
                )}
                {!duplicateKkMember && familyCardNumber && familyCardNumber.length === 16 && (
                  <p className="mt-1 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nomor KK Unik & Belum Terdaftar (16 Digit Lengkap)</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. HP / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0812xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Bergabung
                </label>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilihan Cluster / Lingkungan RT <span className="text-rose-500">*</span>
                  {isKetuaRt && userRtCluster && <span className="text-amber-600 font-semibold ml-1">(Otomatis Wilayah RT Anda)</span>}
                </label>
                <select
                  value={isKetuaRt && userRtCluster ? userRtCluster : cluster}
                  disabled={isKetuaRt && !!userRtCluster}
                  onChange={(e) => setCluster(e.target.value as ClusterType)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-bold transition-all outline-none ${
                    isKetuaRt && userRtCluster
                      ? 'bg-amber-50/70 border-amber-300 text-amber-950 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer'
                  }`}
                >
                  {isKetuaRt && userRtCluster ? (
                    <option value={userRtCluster}>{userRtCluster} (Wilayah RT Anda)</option>
                  ) : (
                    CLUSTERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detail Alamat / Blok & No. Rumah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Blok A-03 No. 12, RT 05/RW 03"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                />
              </div>

              {/* AKUN LOGIN PORTAL WARGA (EMAIL & PASSWORD) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Email (Akun Login Warga) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="contoh: budi.santoso@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Disimpan sebagai akun user untuk login anggota.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Akun (Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Kata sandi masuk ke Halaman Anggota (KTA Digital, nilai manfaat, dan riwayat).</p>
              </div>
            </div>

            {/* Tanggungan Keluarga Section */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Tanggungan Keluarga (Suami/Istri, Anak, Orang Tua)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    placeholder="Nama Tanggungan"
                    value={depName}
                    onChange={(e) => setDepName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <select
                    value={depRel}
                    onChange={(e) => setDepRel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="Suami/Istri">Suami/Istri</option>
                    <option value="Anak">Anak</option>
                    <option value="Orang Tua">Orang Tua</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    placeholder="Usia"
                    value={depAge}
                    onChange={(e) => setDepAge(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddDependent}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* Dependents list badge */}
              {dependents.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <p className="text-[11px] font-medium text-slate-500">Daftar Tanggungan Ditambahkan ({dependents.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {dependents.map((dep) => (
                      <span key={dep.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg shadow-sm">
                        <span><strong>{dep.name}</strong> ({dep.relationship}{dep.age ? `, ${dep.age} th` : ''})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDependent(dep.id)}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* LAMPIRAN FOTO KARTU KELUARGA (KK) */}
              <div className="pt-4 border-t border-slate-200 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                <FamilyCardUploader
                  file={familyCardFile}
                  onFileSelect={(f) => setFamilyCardFile(f)}
                  photoUrl={familyCardPhotoUrl}
                  fileName={familyCardFileName}
                  kkNumber={familyCardNumber}
                  memberName={name || 'Calon Anggota'}
                  cluster={cluster}
                  required={true}
                  initialQualityReport={familyCardQualityReport}
                  onChange={({ photoUrl: pUrl, fileName: fName, kkNumber: kNum, file: fObj, qualityReport: qReport }) => {
                    if (fObj !== undefined) setFamilyCardFile(fObj);
                    setFamilyCardPhotoUrl(pUrl);
                    setFamilyCardFileName(fName);
                    if (kNum !== undefined) setFamilyCardNumber(kNum);
                    if (qReport !== undefined) setFamilyCardQualityReport(qReport || null);
                  }}
                  onClear={() => {
                    setFamilyCardFile(null);
                    setFamilyCardPhotoUrl('');
                    setFamilyCardFileName('');
                    setFamilyCardQualityReport(null);
                  }}
                  onKkNumberChange={(num) => setFamilyCardNumber(num)}
                  duplicateKkError={
                    duplicateKkMember
                      ? `Nomor KK ini sudah terdaftar atas nama Kepala Keluarga "${duplicateKkMember.name}" (${duplicateKkMember.cluster || 'Cluster'}, No. Anggota: ${duplicateKkMember.memberNumber || '-'}).`
                      : null
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-5 py-2.5 text-xs font-bold text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <X className="w-4 h-4 text-slate-500" />
                <span>Batal Mendaftar</span>
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-md shadow-emerald-900/20"
              >
                Simpan & Terbit Nomor Anggota
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )}

  {/* ========================================================================= */}
  {/* TAMPILAN DIREKTORI DATA WARGA & ANGGOTA (KHUSUS PENGURUS/ADMIN/RT)        */}
  {/* ========================================================================= */}
  {activeView === 'directory' && (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* EARLY OUTREACH NOTICE BANNER (≤ 30 Hari Expiring Alert) */}
      {expiringSoonMembers.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border-2 border-amber-400/80 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl font-black shrink-0 shadow-sm flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-950">
                  Pemberitahuan Outreach: {expiringSoonMembers.length} Anggota Segera Habis Masa Iuran
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black text-[11px] rounded-full shadow-xs">
                  ≤ 30 Hari Lagi
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1 max-w-2xl leading-relaxed">
                Masa berlaku perlindungan iuran tahunan anggota berikut akan berakhir dalam 30 hari ke depan. Lakukan penjangkauan awal (early outreach via WhatsApp) agar santunan dan hak fardhu kifayah keluarga warga tetap aktif tanpa terputus.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {statusFilter === 'Segera Habis' ? (
              <button
                type="button"
                onClick={() => setStatusFilter('Semua')}
                className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                Tampilkan Semua Anggota
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatusFilter('Segera Habis')}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md inline-flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Lihat {expiringSoonMembers.length} Warga Ini</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* SEARCH AND FILTER TOOLBAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
          
          {/* Search Input Bar & Quick QR Scanner Trigger */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari berdasarkan Nama atau NIK anggota (misal: 'Siti' atau '317101...')..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 shadow-2xs hover:scale-[1.02] active:scale-95 cursor-pointer"
              title="Pindai QR Code Kartu Tanda Anggota (KTA) dengan kamera"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Pindai QR KTA</span>
              <span className="sm:hidden">Scan QR</span>
            </button>
          </div>

          {/* Filter and Sort Controls Group */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            
            {/* Cluster Filter Dropdown or Locked RT Badge */}
            {isKetuaRt && userRtCluster ? (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5 w-full sm:w-auto shrink-0 shadow-2xs">
                <Home className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider shrink-0">
                  RT:
                </span>
                <span className="text-xs font-black text-amber-950">
                  {userRtCluster}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
                <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <label htmlFor="member-cluster-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                  Cluster:
                </label>
                <select
                  id="member-cluster-filter"
                  value={clusterFilter}
                  onChange={(e) => setClusterFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
                >
                  <option value="Semua">Semua Cluster</option>
                  {CLUSTERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="member-status-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Status:
              </label>
              <select
                id="member-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="Semua">Semua Status ({members.length})</option>
                {expiringSoonMembers.length > 0 && (
                  <option value="Segera Habis" className="text-amber-700 font-bold">
                    ⚠️ Segera Habis ≤ 30 Hari ({expiringSoonMembers.length})
                  </option>
                )}
                {expiredMembers.length > 0 && (
                  <option value="Kedaluwarsa" className="text-rose-700 font-bold">
                    ⛔ Jatuh Tempo / Kedaluwarsa ({expiredMembers.length})
                  </option>
                )}
                <option value="Aktif">Aktif (Resmi & Terbit KTA)</option>
                <option value="Menunggu Persetujuan Ketua Paguyuban">Menunggu Persetujuan Ketua Paguyuban</option>
                <option value="Menunggu Verifikasi RT">Menunggu Verifikasi RT</option>
                <option value="Ditolak">Ditolak</option>
                <option value="Meninggal">Meninggal</option>
                <option value="Non-Aktif">Non-Aktif</option>
              </select>
            </div>

            {/* Registration Date Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="member-date-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Tgl Daftar:
              </label>
              <select
                id="member-date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="Semua">Semua Tanggal</option>
                <option value="BulanIni">Bulan Ini (Agu 2026)</option>
                <option value="2026">Tahun 2026</option>
                <option value="2025">Tahun 2025</option>
                <option value="Q1-2026">Q1 2026 (Jan - Mar)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="member-sort-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Urutan:
              </label>
              <select
                id="member-sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="date-desc">Daftar Terbaru</option>
                <option value="date-asc">Daftar Terlama</option>
                <option value="name-asc">Nama (A - Z)</option>
                <option value="name-desc">Nama (Z - A)</option>
                <option value="number-asc">No. Anggota</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1 shrink-0"
                title="Reset semua filter pencarian"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Filter Pills (especially for Bendahara to quickly filter 'Aktif' for valid beneficiaries) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-100 no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Filter Status:</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter('Semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'Semua'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Semua</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 rounded-full font-mono">{members.length}</span>
          </button>

          {/* HANYA AKTIF - DEDICATED FOR BENDAHARA / ADMIN */}
          <button
            type="button"
            onClick={() => setStatusFilter('Aktif')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'Aktif'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20 ring-2 ring-emerald-400'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
            title="Filter hanya anggota aktif (penerima manfaat santunan yang valid)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hanya Status 'Aktif' (Penerima Manfaat Sah)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${statusFilter === 'Aktif' ? 'bg-black/25 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
              {activeMembers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Menunggu Verifikasi RT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'Menunggu Verifikasi RT'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Menunggu RT</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/10 rounded-full font-mono">{pendingRtMembers.length}</span>
          </button>

          {expiringSoonMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('Segera Habis')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'Segera Habis'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Segera Habis</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full font-mono">{expiringSoonMembers.length}</span>
            </button>
          )}

          {expiredMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('Kedaluwarsa')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'Kedaluwarsa'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Kedaluwarsa</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded-full font-mono">{expiredMembers.length}</span>
            </button>
          )}
        </div>

        {/* Quick Cluster Filter Pills (for quick admin scanning) */}
        {!isKetuaRt && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-100 no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0 mr-1">
              Filter Cepat Cluster:
            </span>
            <button
              type="button"
              onClick={() => setClusterFilter('Semua')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                clusterFilter === 'Semua'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Cluster
            </button>
            {CLUSTERS.map((cl) => (
              <button
                key={cl}
                type="button"
                onClick={() => setClusterFilter(cl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  clusterFilter === cl
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cl}
              </button>
            ))}
          </div>
        )}

        {/* Filter Summary & Count Header */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">
              Menampilkan <span className="font-bold text-emerald-700">{filteredMembers.length}</span> dari {members.length} Anggota
            </span>
            {statusFilter === 'Aktif' && (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 font-extrabold text-[10px] rounded-full border border-emerald-300 inline-flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>Filter Penerima Manfaat Valid (Aktif)</span>
              </span>
            )}
            {hasActiveFilters && statusFilter !== 'Aktif' && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full">
                Filter Aktif
              </span>
            )}
            {/* Quick Toggle All Audit Timelines Button */}
            {filteredMembers.length > 0 && (
              <button
                type="button"
                onClick={expandedTimelineMemberIds.size > 0 ? handleCollapseAllTimelines : handleExpandAllTimelines}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  expandedTimelineMemberIds.size > 0
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                }`}
                title="Buka atau tutup seluruh riwayat status audit untuk semua anggota yang ditampilkan"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {expandedTimelineMemberIds.size > 0
                    ? `Tutup Semua Timeline (${expandedTimelineMemberIds.size})`
                    : 'Buka Semua Timeline Audit'}
                </span>
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {searchTerm && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Cari: <strong>"{searchTerm}"</strong>
                  <button onClick={() => setSearchTerm('')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {clusterFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Cluster: <strong>{clusterFilter}</strong>
                  <button onClick={() => setClusterFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {statusFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Status: <strong>{statusFilter}</strong>
                  <button onClick={() => setStatusFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {dateFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Periode: <strong>{dateFilter === 'BulanIni' ? 'Bulan Ini' : dateFilter}</strong>
                  <button onClick={() => setDateFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MEMBERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900 text-white uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">No. Anggota</th>
                <th className="py-3.5 px-4">Nama Lengkap & NIK</th>
                <th className="py-3.5 px-4">Cluster & Alamat</th>
                <th className="py-3.5 px-4">No. Telepon</th>
                <th className="py-3.5 px-4">Tanggungan</th>
                <th className="py-3.5 px-4">Tgl Bergabung</th>
                <th className="py-3.5 px-4">Status & Masa Berlaku</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                      <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
                        <Users className="w-8 h-8" />
                      </div>
                      {members.length === 0 ? (
                        <>
                          <p className="text-sm font-bold text-slate-800">Basis Data Anggota Masih Bersih</p>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Belum ada warga yang didaftarkan. Gunakan tombol di atas untuk mendaftarkan warga pertama.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Daftarkan Anggota Baru</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-slate-700">Tidak ada anggota yang cocok</p>
                          <p className="text-xs text-slate-400">
                            Pencarian dengan kata kunci atau filter yang dipilih tidak menemukan hasil.
                          </p>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={handleResetFilters}
                              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Hapus Semua Filter</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  let clusterBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (member.cluster?.includes('Sanur')) {
                    clusterBadgeClass = 'bg-teal-50 text-teal-800 border-teal-200';
                  } else if (member.cluster?.includes('Mataram')) {
                    clusterBadgeClass = 'bg-amber-50 text-amber-900 border-amber-200';
                  } else if (member.cluster?.includes('Pasundan')) {
                    clusterBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  } else if (member.cluster?.includes('Minang')) {
                    clusterBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                  }

                  const exp = memberExpiryMap.get(member.id);
                  const isTimelineExpanded = expandedTimelineMemberIds.has(member.id);

                  return (
                    <React.Fragment key={member.id}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          exp?.isExpiringSoon ? 'bg-amber-50/30' : ''
                        } ${isTimelineExpanded ? 'bg-indigo-50/30 font-medium' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div className="space-y-1">
                            <div>{member.memberNumber}</div>
                            <button
                              type="button"
                              onClick={() => toggleMemberTimeline(member.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold rounded-md border transition-all cursor-pointer ${
                                isTimelineExpanded
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title="Buka / Tutup Riwayat Perubahan Status (Audit Timeline)"
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>Timeline Audit</span>
                              <ChevronDown
                                className={`w-2.5 h-2.5 transition-transform duration-200 ${
                                  isTimelineExpanded ? 'rotate-180 text-white' : 'text-indigo-600'
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.name}
                              className="w-10 h-10 rounded-xl object-cover border border-emerald-300 shadow-xs shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center border border-slate-200 shrink-0 font-mono shadow-2xs">
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              onClick={() => setSelectedDetailMember(member)}
                              className="font-extrabold text-slate-900 text-sm hover:text-emerald-700 transition-colors text-left flex items-center gap-1.5 group"
                            >
                              <span className="truncate">{member.name}</span>
                              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
                            </button>
                            <p className="font-mono text-[11px] text-slate-500">NIK: {member.nik}</p>
                            {member.familyCardPhotoUrl ? (
                              <div className="flex items-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedKkViewerMember(member);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md transition-colors group/kk cursor-pointer"
                              title="Klik untuk melihat lampiran foto Kartu Keluarga (KK)"
                            >
                              <FileText className="w-2.5 h-2.5 text-emerald-600 group-hover/kk:scale-110 transition-transform" />
                              <span>KK Terlampir</span>
                            </button>

                            {member.familyCardQualityScore !== undefined && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                  member.familyCardQualityStatus === 'warning_blur' ||
                                  member.familyCardQualityScore < 50
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                                title={`Skor Kualitas Dokumen: ${member.familyCardQualityScore}% (${
                                  member.familyCardQualityStatus === 'warning_blur'
                                    ? 'Perhatian: Gambar Buram'
                                    : 'Tajam & Terbaca'
                                })`}
                              >
                                {member.familyCardQualityScore}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-1">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                            <span>KK Belum Ada</span>
                          </span>
                        )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {member.cluster && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${clusterBadgeClass} inline-flex items-center gap-1`}>
                              <Home className="w-2.5 h-2.5 shrink-0" />
                              <span>{member.cluster}</span>
                            </span>
                          )}
                          <p className="text-[11px] text-slate-600 flex items-center gap-1 max-w-xs truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{member.address}</span>
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-800 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{member.phone}</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg text-[11px]">
                          {member.dependentsCount} Jiwa
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {member.joinDate}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {member.status === 'Meninggal' ? (
                          <span className="px-2.5 py-1 bg-slate-200 text-slate-800 font-bold text-[10px] rounded-full">
                            Meninggal
                          </span>
                        ) : member.status === 'Ditolak' || member.verificationStatus === 'Rejected' ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full" title={member.paguyubanRejectionReason || member.rtVerificationNotes || 'Ditolak'}>
                            Ditolak
                          </span>
                        ) : member.status === 'Menunggu Persetujuan Ketua Paguyuban' ? (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1 animate-pulse" title="Pembayaran telah divalidasi Bendahara, menunggu persetujuan akhir Ketua Paguyuban sebelum KTA terbit">
                            <Clock className="w-3 h-3 text-purple-700" />
                            <span>Menunggu Ketua Paguyuban</span>
                          </span>
                        ) : member.status === 'Menunggu Validasi Bendahara' ? (
                          <span className="px-2.5 py-1 bg-sky-100 text-sky-900 border border-sky-300 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1 animate-pulse" title="Bukti pembayaran diunggah, menunggu validasi Bendahara">
                            <Clock className="w-3 h-3 text-sky-700" />
                            <span>Menunggu Validasi Kas</span>
                          </span>
                        ) : member.status === 'Menunggu Pembayaran' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1" title="Lolos verifikasi RT, menunggu pembayaran iuran oleh warga">
                            <CreditCard className="w-3 h-3 text-amber-700" />
                            <span>Menunggu Pembayaran</span>
                          </span>
                        ) : (!member.isPaguyubanApproved && member.verificationStatus === 'Verified') ? (
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-300 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1" title="Menunggu persetujuan pengesahan Ketua Paguyuban">
                            <Clock className="w-3 h-3 text-purple-700" />
                            <span>Menunggu Ketua Paguyuban</span>
                          </span>
                        ) : member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Menunggu RT</span>
                          </span>
                        ) : exp?.isExpiringSoon ? (
                          <div className="space-y-1">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-950 border-2 border-amber-400 font-black text-[10px] rounded-full inline-flex items-center gap-1 shadow-sm animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Habis dlm {exp.daysRemaining} hari</span>
                            </span>
                            <p className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Jatuh tempo: {exp.expiryDateFormatted}</span>
                            </p>
                          </div>
                        ) : exp?.isExpired ? (
                          <div className="space-y-1">
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-900 border border-rose-300 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Jatuh Tempo</span>
                            </span>
                            <p className="text-[10px] text-rose-700 font-medium">Habis: {exp.expiryDateFormatted}</p>
                          </div>
                        ) : member.status === 'Aktif' || member.verificationStatus === 'Verified' ? (
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Aktif</span>
                            </span>
                            {exp?.expiryDateFormatted && (
                              <p className="text-[10px] text-slate-500 font-medium">s/d {exp.expiryDateFormatted}</p>
                            )}
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full">
                            Non-Aktif
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleMemberTimeline(member.id)}
                          className="text-[10px] text-indigo-700 font-bold hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                        >
                          <Clock className="w-2.5 h-2.5 text-indigo-600" />
                          <span>{isTimelineExpanded ? 'Tutup Audit' : 'Audit Timeline'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* TIMELINE AUDIT TOGGLE BUTTON */}
                          <button
                            type="button"
                            onClick={() => toggleMemberTimeline(member.id)}
                            className={`px-2.5 py-1.5 font-bold rounded-lg transition-all text-xs flex items-center gap-1 border shadow-2xs cursor-pointer ${
                              isTimelineExpanded
                                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            }`}
                            title="Buka / Tutup Jejak Audit Kronologis Status Anggota"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Timeline</span>
                          </button>

                          {/* EARLY OUTREACH REMINDER BUTTON */}
                          {(exp?.isExpiringSoon || exp?.isExpired) && member.status !== 'Meninggal' && (
                            <button
                              type="button"
                              onClick={() => setOutreachMember(member)}
                              className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg transition-all text-xs inline-flex items-center gap-1 shadow-sm hover:scale-105 active:scale-95 border border-amber-300"
                              title="Kirim pengingat perpanjangan iuran via WhatsApp (Early Outreach)"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-slate-950" />
                              <span>Ingatkan WA</span>
                            </button>
                          )}

                          {/* EDIT MEMBER BUTTON (Only for roles with edit rights) */}
                          {!isReadOnlyRole && (
                            <button
                              type="button"
                              onClick={() => {
                                setMemberToEdit(member);
                                setIsEditBiodataModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 border border-slate-200"
                              title="Ubah Biodata & Keluarga"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                              <span>Edit</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedDetailMember(member)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-sm"
                            title="Lihat Profil & Riwayat Lengkap"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Profil</span>
                          </button>

                          {/* KTA BUTTON WITH ISSUANCE STATUS ACCURACY */}
                          {(() => {
                            const kta = getMemberKtaIssuanceInfo(member, payments);
                            if (kta.isIssued) {
                              return (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPreviewKtaMember(member)}
                                    className="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 border border-sky-200 shadow-2xs"
                                    title="Pratinjau & Cetak KTA Berkas Verifikasi"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-sky-600" />
                                    <span>Preview</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedKtaMember(member)}
                                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-sm"
                                    title="Buka / Preview KTA Digital & QR Code Resmi"
                                  >
                                    <QrCode className="w-3.5 h-3.5 text-emerald-200" />
                                    <span>KTA</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPrintCardMember(member)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 border border-slate-300 shadow-sm"
                                    title="Cetak Kartu Anggota Fisik Presisi (Depan & Belakang)"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-slate-700" />
                                    <span>Cetak</span>
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPreviewKtaMember(member)}
                                  className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95"
                                  title="Pratinjau KTA Registrasi (Bisa dicetak untuk verifikasi berkas sebelum pembayaran)"
                                >
                                  <Printer className="w-3.5 h-3.5 text-sky-600" />
                                  <span>Preview KTA</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedKtaMember(member)}
                                  className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-sm"
                                  title={`KTA Belum Terbit: ${kta.statusTitle}`}
                                >
                                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                                  <span className="hidden sm:inline">Status</span>
                                </button>
                              </div>
                            );
                          })()}
                          
                          {(member.status === 'Aktif' || member.verificationStatus === 'Verified') && onSelectMemberForPayment && (
                            <button
                              onClick={() => onSelectMemberForPayment(member)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 transition-colors text-xs"
                              title="Input pembayaran iuran tahunan"
                            >
                              Bayar
                            </button>
                          )}
                          
                          {(member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending') && onNavigateToVerification && (
                            <button
                              onClick={onNavigateToVerification}
                              className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg border border-amber-200 transition-colors text-xs inline-flex items-center gap-1"
                              title="Buka Menu Verifikasi RT"
                            >
                              <span>Verifikasi RT</span>
                              <ArrowRight className="w-3 h-3 text-amber-700" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE TIMELINE SECTION FOR MEMBER STATUS AUDIT */}
                    {isTimelineExpanded && (
                      <tr key={`${member.id}-timeline-row`} className="bg-slate-50/70 border-b border-indigo-100">
                        <td colSpan={8} className="p-3 sm:p-5 bg-gradient-to-b from-indigo-50/40 via-slate-50 to-white border-y-2 border-indigo-200/90 shadow-inner">
                          <MemberStatusTimeline
                            member={member}
                            payments={payments}
                            isCollapsible={true}
                            defaultExpanded={true}
                            onNavigateToPayment={onSelectMemberForPayment ? () => onSelectMemberForPayment(member) : undefined}
                            onNavigateToRtVerification={onNavigateToVerification}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* MEMBER DETAIL MODAL */}
      <MemberDetailModal
        member={selectedDetailMember}
        payments={payments}
        claims={claims}
        settings={settings}
        onClose={() => setSelectedDetailMember(null)}
        onViewReceipt={onViewReceipt}
        onSelectMemberForPayment={onSelectMemberForPayment}
        onOpenFullKtaModal={(mem) => {
          setSelectedKtaMember(mem);
        }}
        onOpenPrintCardModal={(mem) => {
          setSelectedPrintCardMember(mem);
        }}
        onOpenPreviewKtaModal={(mem) => {
          setSelectedPreviewKtaMember(mem);
        }}
      />

      {/* FULL DIGITAL KTA MODAL */}
      {selectedKtaMember && (
        <DigitalKtaModal
          member={selectedKtaMember}
          payments={payments}
          settings={settings}
          isOpen={!!selectedKtaMember}
          onClose={() => setSelectedKtaMember(null)}
          onSelectMemberForPayment={onSelectMemberForPayment}
          onOpenPrintCardModal={(mem) => {
            setSelectedPrintCardMember(mem);
          }}
          onOpenPreviewKtaModal={(mem) => {
            setSelectedPreviewKtaMember(mem);
          }}
        />
      )}

      {/* PRINT MEMBER CARD MODAL */}
      {selectedPrintCardMember && (
        <PrintMemberCardModal
          member={selectedPrintCardMember}
          payments={payments}
          settings={settings}
          isOpen={!!selectedPrintCardMember}
          onClose={() => setSelectedPrintCardMember(null)}
        />
      )}

      {/* PREVIEW KTA MODAL (FOR REGISTRATION & VERIFICATION PHASE) */}
      {selectedPreviewKtaMember && (
        <PreviewKtaModal
          member={selectedPreviewKtaMember}
          payments={payments}
          settings={settings}
          isOpen={!!selectedPreviewKtaMember}
          onClose={() => setSelectedPreviewKtaMember(null)}
          onSelectMemberForPayment={onSelectMemberForPayment}
        />
      )}

      {/* EARLY OUTREACH MODAL */}
      <EarlyOutreachModal
        isOpen={!!outreachMember}
        member={outreachMember}
        payments={payments}
        settings={settings}
        onClose={() => setOutreachMember(null)}
        onSelectMemberForPayment={onSelectMemberForPayment}
      />

      {/* CSV MEMBER IMPORT MODAL */}
      <CsvMemberImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportMembers={handleBatchImport}
        existingMembers={members}
        settings={settings}
      />

      {/* EDIT BIODATA & FAMILY MODAL */}
      {memberToEdit && (
        <EditMemberBiodataModal
          isOpen={isEditBiodataModalOpen}
          member={memberToEdit}
          members={members}
          settings={settings}
          benefits={benefits}
          onClose={() => {
            setIsEditBiodataModalOpen(false);
            setMemberToEdit(null);
          }}
          onSave={handleSaveMemberBiodata}
        />
      )}

      {/* FAMILY CARD VIEWER MODAL */}
      {selectedKkViewerMember && selectedKkViewerMember.familyCardPhotoUrl && (
        <FamilyCardModal
          isOpen={!!selectedKkViewerMember}
          onClose={() => setSelectedKkViewerMember(null)}
          photoUrl={selectedKkViewerMember.familyCardPhotoUrl}
          memberName={selectedKkViewerMember.name}
          kkNumber={selectedKkViewerMember.familyCardNumber}
          cluster={selectedKkViewerMember.cluster}
          fileName={selectedKkViewerMember.familyCardFileName}
          qualityScore={selectedKkViewerMember.familyCardQualityScore}
          qualityStatus={selectedKkViewerMember.familyCardQualityStatus}
        />
      )}

      {/* MEMBER PHOTO CAPTURE CAMERA MODAL */}
      <MemberPhotoCaptureModal
        isOpen={isPhotoCaptureModalOpen}
        onClose={() => setIsPhotoCaptureModalOpen(false)}
        onPhotoCaptured={(capturedUrl) => setPhotoUrl(capturedUrl)}
        memberName={name.trim() || 'Calon Anggota'}
        currentPhotoUrl={photoUrl}
      />

      {/* QR CODE SCANNER MODAL (CAMERA LOOKUP) */}
      <KtaQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        members={members}
        settings={settings}
        onMemberIdentified={handleMemberIdentifiedByQr}
        title="Pindai QR KTA Warga"
        subtitle="Arahkan kamera ke QR Code pada kartu fisik / KTA digital warga untuk melihat detail profil"
        actionButtonText="Buka Detail Lengkap Anggota"
        helperText="Data warga teridentifikasi! Klik tombol di bawah untuk langsung membuka rincian identitas, tanggungan keluarga, dan riwayat status keanggotaan."
      />
    </div>
  );
};
