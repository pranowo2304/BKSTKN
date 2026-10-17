import React, { useState, useMemo } from 'react';
import { Member, Payment, SystemSettings, AppUser } from '../types';
import { formatIDR } from '../lib/storage';
import {
  Crown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Users,
  Search,
  Filter,
  CreditCard,
  FileText,
  AlertCircle,
  Eye,
  Printer,
  ChevronDown,
  Sparkles,
  Award,
  Check,
  X,
  Lock,
  Phone,
  MapPin,
  Calendar,
  PenTool,
  QrCode
} from 'lucide-react';
import { FamilyCardModal } from './FamilyCardModal';
import { PreviewKtaModal } from './PreviewKtaModal';
import { MembershipCertificateModal } from './MembershipCertificateModal';
import { MemberDetailModal } from './MemberDetailModal';
import { DigitalKtaModal } from './DigitalKtaModal';
import { MemberStatusTimeline } from './MemberStatusTimeline';
import { DigitalSignaturePad, SignatureData } from './DigitalSignaturePad';
import { FinancialReportModal } from './FinancialReportModal';
import { KtaScannerModal } from './KtaScannerModal';
import { BenefitRealization } from './BenefitRealization';
import { MemberRegistration } from './MemberRegistration';
import { BenefitClaim, BenefitMaster } from '../types';
import { RoleMobileAppMenu } from './RoleMobileAppMenu';
import { useRolePermissions } from '../lib/permissions';
import {
  FileSpreadsheet,
  Scan,
  Heart,
  UserCheck,
  ChevronRight,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Wallet
} from 'lucide-react';

interface PaguyubanApprovalProps {
  members: Member[];
  payments: Payment[];
  settings: SystemSettings;
  activeUser?: AppUser | null;
  claims?: BenefitClaim[];
  financials?: {
    totalBalance: number;
    totalIncomeVerified: number;
    totalPendingIncome: number;
    totalBenefitSpent: number;
  };
  benefits?: BenefitMaster[];
  onApproveMember: (memberId: string, notes?: string, signature?: string) => void;
  onRejectMember: (memberId: string, reason: string) => void;
  onViewReceipt?: (payment: Payment) => void;
  onAddClaim?: (newClaim: BenefitClaim) => void;
  onUpdateClaim?: (updatedClaim: BenefitClaim) => void;
  onApproveClaim?: (claimId: string, notes?: string, signature?: string) => void;
  onRejectClaim?: (claimId: string, reason: string) => void;
}

export const PaguyubanApproval: React.FC<PaguyubanApprovalProps> = ({
  members,
  payments,
  settings,
  activeUser,
  claims = [],
  financials = {
    totalBalance: 0,
    totalIncomeVerified: 0,
    totalPendingIncome: 0,
    totalBenefitSpent: 0,
  },
  benefits = [],
  onApproveMember,
  onRejectMember,
  onViewReceipt,
  onAddClaim,
  onUpdateClaim,
  onApproveClaim,
  onRejectClaim,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCluster, setSelectedCluster] = useState('Semua');

  // Operational Menu Modal States for Ketua Paguyuban
  const [isMemberListModalOpen, setIsMemberListModalOpen] = useState(false);
  const [isFinancialReportModalOpen, setIsFinancialReportModalOpen] = useState(false);
  const [isKtaScannerModalOpen, setIsKtaScannerModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  // Modal states
  const [selectedMemberForApproval, setSelectedMemberForApproval] = useState<Member | null>(null);
  const [selectedMemberForRejection, setSelectedMemberForRejection] = useState<Member | null>(null);
  const [selectedKkMember, setSelectedKkMember] = useState<Member | null>(null);
  const [selectedPreviewMember, setSelectedPreviewMember] = useState<Member | null>(null);
  const [selectedDetailMember, setSelectedDetailMember] = useState<Member | null>(null);
  const [selectedDigitalKtaMember, setSelectedDigitalKtaMember] = useState<Member | null>(null);
  const [selectedCertificateMember, setSelectedCertificateMember] = useState<Member | null>(null);
  const [expandedTimelineMemberIds, setExpandedTimelineMemberIds] = useState<Set<string>>(new Set());

  // Approval Form State
  const [approvalNotes, setApprovalNotes] = useState('Disetujui dan disahkan secara resmi oleh Ketua Paguyuban. KTA Digital resmi diterbitkan.');
  const [includeSignature, setIncludeSignature] = useState(true);
  const [customSignature, setCustomSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rejection Form State
  const [rejectionReason, setRejectionReason] = useState('');

  const { can } = useRolePermissions();
  const canApprovePaguyuban = can(activeUser?.authority, 'approve_paguyuban');
  const isReadOnlyRole = !canApprovePaguyuban;
  const hasAuthority = canApprovePaguyuban;

  // --- METRIK KESEHATAN FISKAL PAGUYUBAN ---
  const netCashflow = financials.totalIncomeVerified - financials.totalBenefitSpent;
  const isNetPositive = netCashflow >= 0;

  // Santunan pokok duka anggota
  const primaryBenefitAmount = benefits.find((b) => b.isActive)?.amount || settings.benefitAmount || 2500000;
  const solvencyCoverageCount = primaryBenefitAmount > 0 ? Math.floor(financials.totalBalance / primaryBenefitAmount) : 0;

  // Rasio Kepatuhan Warga (Compliance Ratio)
  const paidActiveMembers = members.filter((m) => m.status === 'Aktif' || m.isKtaIssued || m.isPaguyubanApproved);
  const compliancePct = members.length > 0 ? Math.round((paidActiveMembers.length / members.length) * 100) : 0;

  // Breakdown Kepatuhan & Keuangan per Wilayah Cluster RT
  const clusterFiscalStats = useMemo(() => {
    const clusterMap: Record<
      string,
      { name: string; total: number; paid: number; pendingApproval: number; totalCollected: number }
    > = {};

    members.forEach((m) => {
      const c = m.cluster || 'Cluster Lainnya';
      if (!clusterMap[c]) {
        clusterMap[c] = { name: c, total: 0, paid: 0, pendingApproval: 0, totalCollected: 0 };
      }
      clusterMap[c].total += 1;
      if (m.status === 'Aktif' || m.isKtaIssued || m.isPaguyubanApproved) {
        clusterMap[c].paid += 1;
      }
      if (!m.isPaguyubanApproved && (m.status === 'Menunggu Persetujuan Paguyuban' || m.approvalStatus === 'Pending')) {
        clusterMap[c].pendingApproval += 1;
      }
    });

    payments.forEach((p) => {
      if (p.status === 'Verified') {
        const mem = members.find((m) => m.id === p.memberId || m.memberNumber === p.memberNumber);
        const c = mem?.cluster || 'Cluster Lainnya';
        if (clusterMap[c]) {
          clusterMap[c].totalCollected += p.amount;
        }
      }
    });

    return Object.values(clusterMap);
  }, [members, payments]);

  // Toggle audit timeline
  const toggleTimeline = (memberId: string) => {
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

  // Helper to find latest verified payment for a member
  const getMemberVerifiedPayment = (member: Member): Payment | undefined => {
    return payments.find(
      (p) => (p.memberId === member.id || p.memberNumber === member.memberNumber) && p.status === 'Verified'
    );
  };

  // Filter lists: HANYA YANG SUDAH DIVALIDASI PEMBAYARAN OLEH BENDAHARA
  const pendingMembers = useMemo(() => {
    return members.filter((m) => {
      // 1. Belum disetujui Ketua Paguyuban dan bukan berstatus Aktif atau Ditolak
      if (m.isPaguyubanApproved || m.status === 'Aktif' || m.status === 'Ditolak') {
        return false;
      }
      // 2. Wajib sudah lolos verifikasi RT
      if (m.status === 'Menunggu Verifikasi RT' || m.verificationStatus !== 'Verified') {
        return false;
      }
      // 3. SYARAT MUTLAK: Wajib sudah ada validasi pembayaran dari bendahara
      const hasVerifiedPayment = payments.some(
        (p) => (p.memberId === m.id || p.memberNumber === m.memberNumber) && p.status === 'Verified'
      );
      return hasVerifiedPayment;
    });
  }, [members, payments]);

  const approvedMembers = useMemo(() => {
    return members.filter((m) => m.isPaguyubanApproved === true && m.status === 'Aktif');
  }, [members]);

  // Filtered by Search & Cluster
  const displayedMembers = useMemo(() => {
    let list: Member[] = [];
    if (activeTab === 'pending') {
      list = pendingMembers;
    } else if (activeTab === 'approved') {
      list = approvedMembers;
    } else {
      // Tab Semua: hanya tampilkan warga yang sudah divalidasi kas bendahara (antrean pending atau sudah disetujui)
      list = members.filter((m) => {
        if (m.isPaguyubanApproved && m.status === 'Aktif') return true;
        if (m.verificationStatus === 'Verified' && m.status !== 'Menunggu Verifikasi RT' && m.status !== 'Ditolak') {
          return payments.some(
            (p) => (p.memberId === m.id || p.memberNumber === m.memberNumber) && p.status === 'Verified'
          );
        }
        return false;
      });
    }

    if (selectedCluster !== 'Semua') {
      list = list.filter((m) => m.cluster === selectedCluster);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.memberNumber.toLowerCase().includes(q) ||
          m.nik.includes(q) ||
          (m.cluster && m.cluster.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeTab, pendingMembers, approvedMembers, members, payments, selectedCluster, searchTerm]);

  // Clusters list
  const clusterOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.cluster) set.add(m.cluster);
    });
    return Array.from(set);
  }, [members]);

  // Handle Approve Submission
  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForApproval) return;

    // VALIDASI KETAT: Wajib sudah ada pembayaran yang divalidasi Bendahara
    const verifiedPayment = getMemberVerifiedPayment(selectedMemberForApproval);
    if (!verifiedPayment) {
      alert('Persetujuan ketua paguyuban hanya bisa dilakukan apabila sudah ada validasi pembayaran dari bendahara!');
      return;
    }

    setIsSubmitting(true);
    try {
      const sigToUse = includeSignature
        ? customSignature || settings.defaultAdminSignature || undefined
        : undefined;
      onApproveMember(selectedMemberForApproval.id, approvalNotes.trim(), sigToUse);
      setSelectedMemberForApproval(null);
      setApprovalNotes('Disetujui dan disahkan secara resmi oleh Ketua Paguyuban. KTA Digital resmi diterbitkan.');
      setCustomSignature(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reject Submission
  const handleConfirmRejection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForRejection || !rejectionReason.trim()) {
      alert('Mohon masukkan alasan penolakan atau perbaikan berkas!');
      return;
    }
    setIsSubmitting(true);
    try {
      onRejectMember(selectedMemberForRejection.id, rejectionReason.trim());
      setSelectedMemberForRejection(null);
      setRejectionReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-32">
      {/* ========================================================================= */}
      {/* MOBILE APP STYLE OPERATIONAL MENU & DASHBOARD (SESUAI GAMBAR)             */}
      {/* ========================================================================= */}
      <RoleMobileAppMenu
        activeUser={activeUser}
        roleTitle="KETUA PAGUYUBAN"
        userName={activeUser?.name || 'H. Rusydi Helmi'}
        roleSubtitle="Ketua Paguyuban • Hak Pengesahan Akhir & KTA"
        counterLabel="PERLU PENGESAHAN"
        counterValue={`${pendingMembers.length} Warga`}
        counterHighlight={pendingMembers.length > 0}
        sectionTitle="MENU CEPAT OPERASIONAL"
        sectionSubtitle="Ketuk ikon untuk membuka modul"
        actions={[
          {
            id: 'kesehatan-fiskal',
            label: 'Kesehatan Fiskal',
            subLabel: 'Arus Kas & Solvensi',
            badge: isNetPositive ? 'Surplus' : 'Defisit',
            gradient: 'from-emerald-600 to-teal-500',
            icon: Activity,
            onClick: () => {
              const el = document.getElementById('section-kesehatan-fiskal');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'daftar-anggota',
            label: 'Daftar Anggota',
            subLabel: 'Database Warga',
            badge: members.length,
            gradient: 'from-purple-600 to-indigo-500',
            icon: Users,
            onClick: () => setIsMemberListModalOpen(true),
          },
          {
            id: 'laporan-kas',
            label: 'Laporan Kas',
            subLabel: 'Rekap Keuangan',
            badge: 'Kas',
            gradient: 'from-blue-600 to-cyan-500',
            icon: FileSpreadsheet,
            onClick: () => setIsFinancialReportModalOpen(true),
          },
          {
            id: 'scan-kta',
            label: 'Scan KTA',
            subLabel: 'Cek Validitas',
            badge: 'QR',
            gradient: 'from-sky-600 to-blue-500',
            icon: Scan,
            onClick: () => setIsKtaScannerModalOpen(true),
          },
          {
            id: 'klaim-duka',
            label: 'Klaim Duka',
            subLabel: 'Santunan Warga',
            badge: claims.length > 0 ? claims.length : undefined,
            gradient: 'from-rose-600 to-pink-500',
            icon: Heart,
            onClick: () => setIsClaimModalOpen(true),
          },
        ]}
        pills={[
          {
            id: 'antrean',
            label: 'Antrean Pengesahan',
            count: pendingMembers.length,
            isActive: true,
            icon: Crown,
            onClick: () => {
              const el = document.getElementById('section-antrean-persetujuan');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'pill-fiskal',
            label: 'Kesehatan Fiskal',
            count: isNetPositive ? 'Kas Surplus' : 'Defisit',
            icon: Activity,
            onClick: () => {
              const el = document.getElementById('section-kesehatan-fiskal');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'semua-anggota',
            label: 'Semua Anggota',
            icon: Users,
            onClick: () => setIsMemberListModalOpen(true),
          },
        ]}
        dockItems={[
          {
            id: 'persetujuan',
            label: 'Persetujuan',
            icon: Crown,
            badge: pendingMembers.length > 0 ? pendingMembers.length : undefined,
            isActive: true,
            onClick: () => {
              const el = document.getElementById('section-antrean-persetujuan');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'anggota',
            label: 'Anggota',
            icon: Users,
            onClick: () => setIsMemberListModalOpen(true),
          },
          {
            id: 'scan-kta-dock',
            label: 'Scan KTA',
            icon: Scan,
            isCenterFloating: true,
            onClick: () => setIsKtaScannerModalOpen(true),
          },
          {
            id: 'laporan-dock',
            label: 'Laporan',
            icon: FileSpreadsheet,
            onClick: () => setIsFinancialReportModalOpen(true),
          },
          {
            id: 'klaim-dock',
            label: 'Klaim Duka',
            icon: Heart,
            badge: claims.length > 0 ? claims.length : undefined,
            onClick: () => setIsClaimModalOpen(true),
          },
        ]}
      />
      {/* HEADER BANNER WITH AUTHORITY EMPHASIS */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-purple-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/40">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Otoritas Pengesahan Akhir & Penerbitan KTA Resmi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>Persetujuan Akhir Ketua Paguyuban</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Sesuai AD/ART Paguyuban Dana Kematian, calon anggota baru yang telah lolos{' '}
              <strong className="text-amber-300">Verifikasi Berkas RT</strong> dan menyelesaikan{' '}
              <strong className="text-emerald-300">Validasi Iuran Kas Bendahara</strong> wajib mendapatkan{' '}
              <strong className="text-purple-300">Persetujuan Akhir Ketua Paguyuban</strong> sebelum KTA Digital resmi diterbitkan.
            </p>
          </div>

          {/* Officer Identity Card */}
          <div className="bg-slate-800/90 border border-purple-500/30 p-4 rounded-2xl shrink-0 w-full md:w-auto shadow-inner text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-purple-300 font-bold uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Pejabat Berwenang</span>
            </div>
            <p className="font-black text-sm text-white flex items-center gap-1.5">
              <span>{activeUser?.name || 'Bpk. H. Ahmad Fauzi'}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded-md font-bold text-[10px]">
                {activeUser?.authority || 'Ketua Paguyuban'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Hak Terbit KTA Aktif</span>
            </div>
          </div>
        </div>

        {/* STATS STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Menunggu Persetujuan</p>
              <p className="text-2xl font-black text-amber-400 mt-0.5">{pendingMembers.length} Warga</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">KTA Resmi Terbit</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{approvedMembers.length} Anggota</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-purple-500/30 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Status Validasi</p>
              <p className="text-xs font-bold text-slate-200 mt-1">
                {pendingMembers.length > 0 ? (
                  <span className="text-amber-300">Ada antrean pengesahan</span>
                ) : (
                  <span className="text-emerald-300">Seluruh antrean tuntas</span>
                )}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EKSEKUTIF KESEHATAN FISKAL & SOLVENSI PAGUYUBAN (MENU KESEHATAN FISKAL)*/}
      {/* ========================================================================= */}
      <section
        id="section-kesehatan-fiskal"
        className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-5 sm:p-7 space-y-6 overflow-hidden transition-all"
      >
        {/* Header Bar Kesehatan Fiskal */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl border border-emerald-500/20">
              <Activity className="w-6 h-6 text-emerald-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  Kesehatan Fiskal & Ketahanan Dana Santunan
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Executive Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengawasan likuiditas kas, solvensi klaim duka, dan kepatuhan iuran seluruh cluster RT se-paguyuban.
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs ${
                isNetPositive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isNetPositive ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
              <span>{isNetPositive ? 'Arus Kas Surplus' : 'Defisit Terkendali'}</span>
            </span>

            <button
              type="button"
              onClick={() => setIsFinancialReportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
              <span>Laporan CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Kartu Metrik Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Saldo Kas Bersih */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-700/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Saldo Kas
              </span>
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                {formatIDR(financials.totalBalance)}
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300">
                <span>Daya Lindung Kas:</span>
                <span className="font-extrabold text-amber-300">
                  {solvencyCoverageCount}x Santunan Duka
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Penerimaan Iuran */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Iuran Masuk Terverifikasi
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-blue-700 tracking-tight">
                {formatIDR(financials.totalIncomeVerified)}
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Setoran Warga</span>
                {financials.totalPendingIncome > 0 ? (
                  <span className="text-amber-600 font-bold">
                    +{formatIDR(financials.totalPendingIncome)} antre
                  </span>
                ) : (
                  <span className="text-emerald-600 font-bold">Tervalidasi Semua</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Penyaluran Santunan */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Santunan Tersalurkan
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-rose-700 tracking-tight">
                {formatIDR(financials.totalBenefitSpent)}
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>{claims.length} Peristiwa Duka</span>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(true)}
                  className="text-rose-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  {claims.filter((c) => c.status === 'Menunggu Persetujuan Ketua').length > 0 ? (
                    <span className="text-rose-700 font-black animate-pulse">
                      ★ {claims.filter((c) => c.status === 'Menunggu Persetujuan Ketua').length} Butuh Persetujuan →
                    </span>
                  ) : (
                    <span>Detail Klaim →</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Kepatuhan Iuran Warga */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Kepatuhan Iuran
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black font-mono text-purple-800 tracking-tight">
                  {compliancePct}%
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {paidActiveMembers.length}/{members.length} KK Lunas
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${compliancePct}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                <span>Seluruh Wilayah</span>
                <span className="text-emerald-700 font-bold">KTA Sah</span>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown Kolektibilitas per Cluster RT */}
        <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Monitoring Kepatuhan & Iuran per Wilayah Cluster RT
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">
              {clusterFiscalStats.length} Wilayah Terdaftar
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {clusterFiscalStats.map((cluster) => {
              const clusterPct = cluster.total > 0 ? Math.round((cluster.paid / cluster.total) * 100) : 0;
              return (
                <div
                  key={cluster.name}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:border-purple-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">{cluster.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        clusterPct >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : clusterPct >= 50
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {clusterPct}% Lunas
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        clusterPct >= 80 ? 'bg-emerald-500' : clusterPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${clusterPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    <span>{cluster.paid} dari {cluster.total} KK</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatIDR(cluster.totalCollected)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TABS & SEARCH BAR */}
      <div id="section-antrean-persetujuan" className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Main Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'pending'
                  ? 'bg-purple-700 text-white shadow-md shadow-purple-950/20 ring-2 ring-purple-400'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Antrean Persetujuan Akhir</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'pending' ? 'bg-purple-900 text-purple-200' : 'bg-amber-100 text-amber-900'
              }`}>
                {pendingMembers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Telah Disetujui & KTA Terbit</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-200 text-slate-800">
                {approvedMembers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Semua Riwayat Validasi</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClaimModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs"
            >
              <Heart className="w-3.5 h-3.5 text-rose-600" />
              <span>Persetujuan Klaim Santunan (Kas)</span>
              {claims.filter((c) => c.status === 'Menunggu Persetujuan Ketua').length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black bg-rose-600 text-white animate-pulse">
                  {claims.filter((c) => c.status === 'Menunggu Persetujuan Ketua').length} Butuh Persetujuan
                </span>
              )}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 md:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau NIK warga..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            />
          </div>
        </div>

        {/* Sub-filter Cluster Dropdown */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-[11px] text-slate-500 uppercase">Cluster / RT:</span>
          <select
            value={selectedCluster}
            onChange={(e) => setSelectedCluster(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none"
          >
            <option value="Semua">Semua Cluster Warga</option>
            {clusterOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400 ml-auto">
            Menampilkan <strong>{displayedMembers.length}</strong> calon anggota
          </span>
        </div>
      </div>

      {/* MAIN CARDS LIST */}
      {displayedMembers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            {activeTab === 'pending' ? 'Tidak Ada Antrean Persetujuan' : 'Tidak Ditemukan Data Anggota'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {activeTab === 'pending'
              ? 'Seluruh pendaftaran warga yang telah menyelesaikan verifikasi RT dan pembayaran kas telah disetujui atau belum ada pendaftaran baru yang siap disahkan.'
              : 'Tidak ada data anggota yang sesuai dengan kriteria pencarian atau filter cluster yang dipilih.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedMembers.map((member) => {
            const verifiedPayment = getMemberVerifiedPayment(member);
            const isTimelineExpanded = expandedTimelineMemberIds.has(member.id);
            const isAwaitingApproval =
              !member.isPaguyubanApproved &&
              member.status !== 'Aktif' &&
              member.status !== 'Ditolak' &&
              Boolean(verifiedPayment);

            return (
              <div
                key={member.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs hover:shadow-md ${
                  isAwaitingApproval
                    ? 'border-purple-300 ring-1 ring-purple-200/80 bg-gradient-to-r from-purple-50/20 via-white to-white'
                    : 'border-slate-200'
                }`}
              >
                {/* TOP STRIP OF THE CARD */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                      isAwaitingApproval
                        ? 'bg-gradient-to-tr from-purple-700 to-indigo-600 text-white'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {member.name.charAt(0)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                          {member.memberNumber}
                        </span>
                        <h3 className="font-black text-base text-slate-900 flex items-center gap-1.5">
                          <span>{member.name}</span>
                        </h3>
                        {member.cluster && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 font-bold text-[10px] rounded-md">
                            {member.cluster}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                        <span>NIK: <strong className="text-slate-700 font-mono">{member.nik}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{member.phone}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-xs">{member.address}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* STATUS BADGE & KTA ISSUANCE INDICATOR */}
                  <div className="flex items-center gap-2 shrink-0">
                    {member.isPaguyubanApproved ? (
                      <div className="text-right space-y-0.5">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-xs rounded-xl inline-flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Disetujui & KTA Terbit</span>
                        </span>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Oleh {member.approvedByPaguyuban || 'Ketua Paguyuban'}
                        </p>
                      </div>
                    ) : (
                      <div className="text-right space-y-0.5">
                        <span className="px-3 py-1 bg-purple-100 text-purple-900 border border-purple-300 font-black text-xs rounded-xl inline-flex items-center gap-1.5 shadow-2xs animate-pulse">
                          <Clock className="w-3.5 h-3.5 text-purple-700" />
                          <span>Menunggu Persetujuan Ketua</span>
                        </span>
                        <p className="text-[10px] text-purple-700 font-bold">
                          KTA Belum Diterbitkan
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3-STEP VERIFICATION SUMMARY BOX */}
                <div className="p-4 sm:p-5 bg-slate-50/70 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-slate-100 text-xs">
                  {/* Step 1: RT Verification */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tahap 1: Verifikasi RT</span>
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-black text-[9px]">
                        Lolos RT
                      </span>
                    </div>
                    <p className="font-extrabold text-slate-800">{member.verifiedByRt || 'Ketua RT Cluster'}</p>
                    <p className="text-[10px] text-slate-500">
                      {member.verifiedAt ? `Tgl: ${member.verifiedAt}` : 'Berkas kependudukan valid'}
                    </p>
                    {member.rtNotes && (
                      <p className="text-[10px] text-slate-600 italic bg-slate-50 p-1 rounded border border-slate-100">
                        "{member.rtNotes}"
                      </p>
                    )}
                  </div>

                  {/* Step 2: Bendahara Payment Validation */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tahap 2: Validasi Kas</span>
                      {verifiedPayment ? (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-black text-[9px]">
                          Lunas & Masuk Kas
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-bold text-[9px]">
                          Menunggu Validasi
                        </span>
                      )}
                    </div>
                    {verifiedPayment ? (
                      <>
                        <p className="font-extrabold text-emerald-700 flex items-center justify-between">
                          <span>{verifiedPayment.paymentType}</span>
                          <span className="font-mono">{formatIDR(verifiedPayment.amount)}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {verifiedPayment.receiptNumber} • Oleh {verifiedPayment.verifiedBy || 'Bendahara'}
                        </p>
                        {onViewReceipt && (
                          <button
                            type="button"
                            onClick={() => onViewReceipt(verifiedPayment)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer pt-0.5"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span>Lihat Kwitansi Digital Resmi</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-500">Pembayaran belum divalidasi oleh Bendahara.</p>
                    )}
                  </div>

                  {/* Step 3: Kartu Keluarga & Tanggungan */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dokumen & Tanggungan</span>
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded font-bold text-[9px]">
                        {member.dependentsCount || 0} Tanggungan
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-extrabold text-slate-800">No. KK: {member.familyCardNumber || '-'}</p>
                      {member.familyCardPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setSelectedKkMember(member)}
                          className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Cek Foto KK</span>
                        </button>
                      )}
                    </div>
                    {member.familyCardQualityScore !== undefined && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span>Skor Kualitas:</span>
                        <span className={`font-bold px-1 rounded ${
                          member.familyCardQualityScore >= 70 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                        }`}>
                          {member.familyCardQualityScore}%
                        </span>
                        <span>({member.familyCardQualityStatus === 'warning_blur' ? 'Buram' : 'Terbaca Jelas'})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTTOM ACTION BAR */}
                <div className="p-4 sm:p-5 flex flex-wrap items-center justify-end gap-3">

                  {/* Ketua Paguyuban Action Buttons */}
                  <div className="flex items-center gap-2 ml-auto">
                    {isReadOnlyRole ? (
                      <span className="px-3.5 py-2 bg-purple-50 text-purple-700 border border-purple-200 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs">
                        <Eye className="w-3.5 h-3.5 text-purple-500" />
                        <span>Hanya Monitoring Pengesahan ({activeUser?.authority})</span>
                      </span>
                    ) : isAwaitingApproval ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedMemberForRejection(member)}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span>Tolak / Kembalikan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedMemberForApproval(member)}
                          className="px-5 py-2 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-purple-950/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer"
                        >
                          <Crown className="w-4 h-4 text-amber-400" />
                          <span>Setujui & Terbitkan KTA serta Sertifikat</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedDigitalKtaMember(member)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4 text-emerald-200" />
                        <span>Buka KTA Digital Resmi</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* APPROVAL CONFIRMATION MODAL */}
      {selectedMemberForApproval && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/30 border border-purple-400/40 text-amber-400 flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black leading-tight">Pengesahan Akhir & Penerbitan KTA</h3>
                  <p className="text-xs text-slate-300">Otoritas Ketua Paguyuban Dana Kematian</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberForApproval(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConfirmApproval} className="p-6 space-y-5">
              {/* Member Summary Card */}
              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-purple-900 bg-white px-2.5 py-0.5 rounded border border-purple-200">
                    {selectedMemberForApproval.memberNumber}
                  </span>
                  <span className="text-xs font-bold text-purple-800">{selectedMemberForApproval.cluster}</span>
                </div>
                <h4 className="text-lg font-black text-slate-900">{selectedMemberForApproval.name}</h4>
                <div className="text-xs text-slate-600 grid grid-cols-2 gap-2 pt-1 border-t border-purple-200/60 font-medium">
                  <div>NIK: <span className="font-mono font-bold text-slate-800">{selectedMemberForApproval.nik}</span></div>
                  <div>Tanggungan: <span className="font-bold text-slate-800">{selectedMemberForApproval.dependentsCount} Jiwa</span></div>
                </div>
              </div>

              {/* Validated Payment Confirmation Card */}
              {(() => {
                const modalPay = getMemberVerifiedPayment(selectedMemberForApproval);
                return (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Pembayaran Telah Divalidasi Bendahara</span>
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono font-black text-[10px] rounded">
                        {modalPay?.receiptNumber || 'LUNAS KAS'}
                      </span>
                    </div>
                    {modalPay && (
                      <p className="text-[11px] text-emerald-800 leading-tight">
                        Jenis: <strong>{modalPay.paymentType}</strong> ({modalPay.periodMonth}) • Nominal: <strong>{formatIDR(modalPay.amount)}</strong> • Divalidasi oleh: <strong>{modalPay.verifiedBy || 'Bendahara'}</strong>
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Approval Notice */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Konsekuensi Pengesahan Ketua Paguyuban:</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Sesuai ketentuan, <strong>sertifikat keanggotaan resmi dan KTA baru dapat terbit setelah disetujui Ketua Paguyuban</strong>. Setelah pengesahan ini, status anggota otomatis berubah menjadi{' '}
                    <strong>"Aktif"</strong>, <strong>KTA Digital & Sertifikat Sah langsung diterbitkan</strong>, dan notifikasi WhatsApp resmi akan otomatis dikirimkan ke nomor ponsel anggota.
                  </p>
                </div>
              </div>

              {/* Notes Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan Pengesahan Ketua Paguyuban:
                </label>
                <textarea
                  rows={3}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Tuliskan catatan persetujuan atau amanat ketua paguyuban..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none font-medium"
                />
              </div>

              {/* Digital Signature Option */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tanda Tangan Digital Pengesahan Ketua</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSignaturePad(true)}
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{customSignature ? 'Ubah Tanda Tangan' : 'Buat Tanda Tangan'}</span>
                  </button>
                </div>

                {customSignature ? (
                  <div className="p-3 bg-slate-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={customSignature}
                        alt="Tanda Tangan Ketua"
                        className="h-10 max-w-[120px] object-contain border border-slate-200 bg-white rounded p-0.5"
                      />
                      <div className="text-[11px]">
                        <p className="font-bold text-slate-900">{activeUser?.name || 'Ketua Paguyuban'}</p>
                        <p className="text-slate-500 text-[10px]">Tanda tangan digital terlampir</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomSignature(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold"
                    >
                      Hapus
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Menggunakan stempel dan tanda tangan digital terdaftar Paguyuban.
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForApproval(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-purple-950/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Memproses...' : 'Sahkan & Terbitkan KTA serta Sertifikat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {selectedMemberForRejection && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-auto">
            <div className="p-5 bg-rose-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-5 h-5 text-rose-200" />
                <h3 className="font-black text-base">Tolak / Kembalikan Registrasi</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberForRejection(null)}
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRejection} className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Calon Anggota: <strong>{selectedMemberForRejection.name}</strong> ({selectedMemberForRejection.memberNumber})
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Masukkan alasan penolakan atau perbaikan yang harus dipenuhi oleh calon anggota.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penolakan / Catatan Perbaikan <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  required
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Berkas foto KK buram dan data NIK anak tidak sesuai dengan nama di formulir..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForRejection(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Memproses...' : 'Kirim Penolakan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIGNATURE PAD MODAL */}
      {showSignaturePad && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl my-auto">
            <DigitalSignaturePad
              defaultSignerName={activeUser?.name || 'Bpk. H. Ahmad Fauzi'}
              defaultSignerTitle="Ketua Paguyuban Dana Kematian"
              savedDefaultSignature={settings.defaultAdminSignature}
              onSave={(data: SignatureData) => {
                setCustomSignature(data.signatureUrl);
                setShowSignaturePad(false);
              }}
              onCancel={() => setShowSignaturePad(false)}
              title="Tanda Tangan Pengesahan Ketua Paguyuban"
              subtitle="Tanda tangan ini akan dicantumkan secara resmi pada Kartu Tanda Anggota (KTA) Digital."
            />
          </div>
        </div>
      )}

      {/* FAMILY CARD VIEWER MODAL */}
      {selectedKkMember && (
        <FamilyCardModal
          isOpen={true}
          onClose={() => setSelectedKkMember(null)}
          photoUrl={selectedKkMember.familyCardPhotoUrl || ''}
          fileName={selectedKkMember.familyCardFileName}
          memberName={selectedKkMember.name}
          kkNumber={selectedKkMember.familyCardNumber}
          cluster={selectedKkMember.cluster}
          qualityScore={selectedKkMember.familyCardQualityScore}
          qualityStatus={selectedKkMember.familyCardQualityStatus}
        />
      )}

      {/* PREVIEW KTA MODAL */}
      {selectedPreviewMember && (
        <PreviewKtaModal
          isOpen={true}
          onClose={() => setSelectedPreviewMember(null)}
          member={selectedPreviewMember}
          payments={payments}
          settings={settings}
        />
      )}

      {/* OFFICIAL MEMBERSHIP CERTIFICATE MODAL */}
      {selectedCertificateMember && (
        <MembershipCertificateModal
          isOpen={true}
          onClose={() => setSelectedCertificateMember(null)}
          member={selectedCertificateMember}
          payments={payments}
          settings={settings}
          onOpenKtaModal={(mem) => {
            setSelectedCertificateMember(null);
            setSelectedDigitalKtaMember(mem);
          }}
        />
      )}

      {/* DIGITAL KTA MODAL */}
      {selectedDigitalKtaMember && (
        <DigitalKtaModal
          isOpen={true}
          onClose={() => setSelectedDigitalKtaMember(null)}
          member={selectedDigitalKtaMember}
          payments={payments}
          settings={settings}
        />
      )}

      {/* MEMBER DETAIL MODAL */}
      {selectedDetailMember && (
        <MemberDetailModal
          isOpen={true}
          onClose={() => setSelectedDetailMember(null)}
          member={selectedDetailMember}
          payments={payments}
          claims={claims}
          settings={settings}
        />
      )}

      {/* 1. OPERATIONAL MODAL: DAFTAR ANGGOTA */}
      {isMemberListModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-100 rounded-3xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>Daftar Anggota & Warga Paguyuban</span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-purple-500/30 text-purple-200 rounded-full border border-purple-500/40">
                      {members.length} Terdata
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mode Pemantauan Ketua Paguyuban: Lihat data anggota, riwayat keluarga, dan status verifikasi KTA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMemberListModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <MemberRegistration
                members={members}
                payments={payments}
                claims={claims}
                settings={settings}
                activeUser={activeUser || undefined}
                onAddMember={() => {}}
                onViewReceipt={onViewReceipt}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Daftar anggota disinkronkan secara real-time dengan seluruh cluster RT
              </span>
              <button
                type="button"
                onClick={() => setIsMemberListModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. OPERATIONAL MODAL: LAPORAN LAPORAN KEUANGAN */}
      <FinancialReportModal
        isOpen={isFinancialReportModalOpen}
        onClose={() => setIsFinancialReportModalOpen(false)}
        payments={payments}
        claims={claims}
        members={members}
        settings={settings}
        financials={financials}
      />

      {/* 3. OPERATIONAL MODAL: SCAN KTA */}
      <KtaScannerModal
        isOpen={isKtaScannerModalOpen}
        onClose={() => setIsKtaScannerModalOpen(false)}
        members={members}
        payments={payments}
        settings={settings}
        onOpenKtaModal={(mem) => {
          setSelectedDigitalKtaMember(mem);
        }}
        onSelectMember={(mem) => {
          setSelectedDetailMember(mem);
        }}
      />

      {/* 4. OPERATIONAL MODAL: KLAIM DUKA */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-100 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>Manajemen Klaim & Santunan Duka</span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-rose-500/30 text-rose-200 rounded-full border border-rose-500/40">
                      {claims.length} Kasus Disalurkan
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pencatatan dan transparansi penyaluran dana santunan kematian bagi warga dan keluarga yang berduka
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <BenefitRealization
                members={members}
                claims={claims}
                currentBalance={financials.totalBalance}
                settings={settings}
                benefits={benefits}
                activeUser={activeUser || undefined}
                onAddClaim={(newClaim) => {
                  if (onAddClaim) {
                    onAddClaim(newClaim);
                  }
                }}
                onUpdateClaim={(updatedClaim) => {
                  if (onUpdateClaim) {
                    onUpdateClaim(updatedClaim);
                  }
                }}
                onApproveClaim={(claimId, notes, signature) => {
                  if (onApproveClaim) {
                    onApproveClaim(claimId, notes, signature);
                  }
                }}
                onRejectClaim={(claimId, reason) => {
                  if (onRejectClaim) {
                    onRejectClaim(claimId, reason);
                  }
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Setiap klaim yang disalurkan otomatis terakumulasi dalam Laporan Keuangan Paguyuban
              </span>
              <button
                type="button"
                onClick={() => setIsClaimModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

          </div>
  );
};
