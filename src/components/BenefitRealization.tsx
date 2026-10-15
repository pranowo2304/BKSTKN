import React, { useState } from 'react';
import {
  Member,
  BenefitClaim,
  ExpenseDetail,
  SystemSettings,
  AppUser,
  BenefitMaster,
  DEFAULT_BENEFITS,
  BenefitClaimStatus
} from '../types';
import { formatIDR } from '../lib/storage';
import { exportBenefitClaimsCSV } from '../lib/csvExport';
import { useRolePermissions } from '../lib/permissions';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Heart,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  UserMinus,
  ArrowDownRight,
  Wallet,
  Download,
  FileSpreadsheet,
  Sparkles,
  Wand2,
  Eye,
  Clock,
  Check,
  X,
  CreditCard,
  Receipt,
  Upload,
  Camera,
  Image as ImageIcon,
  Building,
  User,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Filter,
  Search,
  RotateCcw,
  Table,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import { DigitalSignaturePad } from './DigitalSignaturePad';

interface BenefitRealizationProps {
  members: Member[];
  claims: BenefitClaim[];
  currentBalance: number;
  settings?: SystemSettings;
  benefits?: BenefitMaster[];
  activeUser?: AppUser;
  onAddClaim: (newClaim: BenefitClaim) => void;
  onUpdateClaim?: (updatedClaim: BenefitClaim) => void;
  onApproveClaim?: (claimId: string, notes?: string, signature?: string) => void;
  onRejectClaim?: (claimId: string, reason: string) => void;
  onOpenExportModal?: () => void;
  onClearClaims?: () => void;
}

export const BenefitRealization: React.FC<BenefitRealizationProps> = ({
  members,
  claims,
  currentBalance,
  settings,
  benefits = DEFAULT_BENEFITS,
  activeUser,
  onAddClaim,
  onUpdateClaim,
  onApproveClaim,
  onRejectClaim,
  onOpenExportModal,
  onClearClaims,
}) => {
  const isAnggota = activeUser?.authority === 'Anggota';
  const isRt =
    activeUser?.authority === 'Ketua RT (Cluster)' ||
    activeUser?.authority === 'Ketua RT' ||
    Boolean(activeUser?.authority?.includes('RT'));
  const isBendahara = activeUser?.authority === 'Bendahara';
  const isKetuaPaguyuban = activeUser?.authority === 'Ketua Paguyuban';
  const isAdmin = activeUser?.authority === 'Admin';
  const isReadOnlyRole = isAnggota || activeUser?.authority === 'Ketua RW' || activeUser?.authority === 'Ketua DKM';

  // Granular permissions hook & strict role segregation
  // Sesuai aturan: Bendahara dan Ketua Paguyuban TIDAK BISA input klaim manfaat
  // Bendahara HANYA merealisasikan manfaat yang diajukan oleh RT
  const { can } = useRolePermissions();
  const canInputRt = !isBendahara && !isKetuaPaguyuban && !isReadOnlyRole && (isRt || isAdmin);
  const canInputTreasurer = isBendahara || isAdmin || can(activeUser?.authority, 'approve_payments');
  const canApproveKetua = isKetuaPaguyuban || isAdmin || can(activeUser?.authority, 'approve_paguyuban');

  // Filter Tab state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'pending_treasurer' | 'pending_ketua' | 'approved' | 'rejected'>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(null);

  // 1. RT SUBMISSION FORM STATE
  const [showRtForm, setShowRtForm] = useState(false);
  const userCluster = activeUser?.cluster;
  const [filterByClusterOnly, setFilterByClusterOnly] = useState(true);

  // Filter members by RT cluster if logged in as RT, with fallback to all members if cluster empty
  const clusterMatchedMembers = isRt && userCluster && filterByClusterOnly
    ? members.filter((m) => m.cluster?.toLowerCase().includes(userCluster.toLowerCase()) || userCluster.toLowerCase().includes(m.cluster?.toLowerCase() || ''))
    : members;
  const displayMembers = clusterMatchedMembers.length > 0 ? clusterMatchedMembers : members;

  const [rtMemberId, setRtMemberId] = useState(displayMembers[0]?.id || members[0]?.id || '');
  const [rtDeceasedName, setRtDeceasedName] = useState('');
  const [rtRelationship, setRtRelationship] = useState<string>('Anggota Utama');
  const [rtDateOfDeath, setRtDateOfDeath] = useState(new Date().toISOString().split('T')[0]);
  const [rtCauseOfDeath, setRtCauseOfDeath] = useState('');
  const [rtNotes, setRtNotes] = useState('Laporan warga berduka. Berkas surat kematian RT/RS telah diverifikasi.');
  const [rtDeathCertFile, setRtDeathCertFile] = useState<string | null>(null);
  const [rtDeathCertName, setRtDeathCertName] = useState<string>('');

  // Keep rtMemberId synchronized if displayMembers change
  React.useEffect(() => {
    if (displayMembers.length > 0 && !displayMembers.some((m) => m.id === rtMemberId)) {
      setRtMemberId(displayMembers[0].id);
    }
  }, [displayMembers, rtMemberId]);

  // 2. BENDAHARA PAYMENT INPUT MODAL STATE
  const [treasurerProcessingClaim, setTreasurerProcessingClaim] = useState<BenefitClaim | null>(null);
  const [treasurerExpenses, setTreasurerExpenses] = useState<ExpenseDetail[]>([]);
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpCost, setNewExpCost] = useState('');
  const [newExpRecipient, setNewExpRecipient] = useState('');
  const [newExpPaidDate, setNewExpPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpTransferProof, setNewExpTransferProof] = useState<string | null>(null);
  const [newExpTransferName, setNewExpTransferName] = useState('');
  const [newExpExternalReceipt, setNewExpExternalReceipt] = useState<string | null>(null);
  const [newExpReceiptName, setNewExpReceiptName] = useState('');
  const [treasurerGlobalProof, setTreasurerGlobalProof] = useState<string | null>(null);
  const [treasurerGlobalReceipt, setTreasurerGlobalReceipt] = useState<string | null>(null);
  const [treasurerNotes, setTreasurerNotes] = useState('');

  // 3. KETUA PAGUYUBAN APPROVAL MODAL STATE
  const [approvingClaim, setApprovingClaim] = useState<BenefitClaim | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('Penyaluran santunan duka cita telah diverifikasi dan disetujui resmi oleh Ketua Paguyuban. Transaksi memotong saldo kas paguyuban.');
  const [includeSignature, setIncludeSignature] = useState(true);
  const [customSignature, setCustomSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // 4. REJECTION MODAL STATE
  const [rejectingClaim, setRejectingClaim] = useState<BenefitClaim | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Klaim ditolak / kelengkapan berkas bukti luar belum memenuhi syarat.');

  // 5. VIEW DETAIL / ATTACHMENT MODAL
  const [selectedClaimDetail, setSelectedClaimDetail] = useState<BenefitClaim | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  // Quick file upload simulation handler
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSetUrl: (url: string) => void,
    onSetName: (name: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      onSetName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onSetUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Preset sample files for quick testing
  const setSampleDeathCert = () => {
    setRtDeathCertFile('https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&auto=format&fit=crop&q=80');
    setRtDeathCertName('surat_kematian_kelurahan_resmi.jpg');
  };

  const setSampleTransferProof = () => {
    setNewExpTransferProof('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80');
    setNewExpTransferName('bukti_transfer_m_banking_resmi.jpg');
  };

  const setSampleExternalReceipt = () => {
    setNewExpExternalReceipt('https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80');
    setNewExpReceiptName('kwitansi_resmi_pihak_luar.jpg');
  };

  // Find matching master benefit for guideline
  const matchedBenefit = benefits.find(
    (b) => b.targetRelationship === rtRelationship || b.categoryName.toLowerCase().includes(rtRelationship.toLowerCase())
  ) || benefits[0];

  // ---------------------------------------------------------------------------
  // 1. SUBMIT RT CLAIM
  // ---------------------------------------------------------------------------
  const handleRtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInputRt || isBendahara || isKetuaPaguyuban) {
      alert('Akses Ditolak: Bendahara dan Ketua Paguyuban tidak berwenang menginput pengajuan klaim baru. Pengajuan santunan duka hanya dapat diajukan oleh Ketua RT setempat.');
      return;
    }

    const activeMember = members.find((m) => m.id === rtMemberId) || displayMembers[0];
    if (!activeMember) {
      alert('Pilih data anggota terdaftar terlebih dahulu!');
      return;
    }

    if (!rtDeceasedName.trim()) {
      alert('Masukkan nama almarhum/almarhumah.');
      return;
    }

    const nextClaimNum = `KLAIM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newClaim: BenefitClaim = {
      id: 'claim-' + Date.now(),
      claimNumber: nextClaimNum,
      memberId: activeMember.id,
      memberName: activeMember.name,
      memberNumber: activeMember.memberNumber,
      cluster: activeMember.cluster || activeUser?.cluster || 'Cluster RT',
      deceasedName: rtDeceasedName.trim(),
      relationship: rtRelationship,
      dateOfDeath: rtDateOfDeath,
      causeOfDeath: rtCauseOfDeath.trim() || 'Sakit / Usia Lanjut',
      deathCertificateUrl: rtDeathCertFile || undefined,
      deathCertificateFileName: rtDeathCertName || undefined,
      status: 'Menunggu Pembayaran Bendahara',
      submittedByRtName: activeUser?.name || 'Ketua RT Setempat',
      submittedByRtCluster: activeUser?.cluster || activeMember.cluster || 'Cluster RT',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      rtNotes: rtNotes.trim() || 'Laporan duka cita warga diajukan oleh RT setempat.',
      expenseDetails: [],
      totalAmount: 0,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      processedBy: `${activeUser?.name || 'Ketua RT'} (Pengajuan Awal RT)`,
      notes: 'Klaim baru diajukan oleh RT. Menunggu Bendahara melakukan input pembayaran ke pihak terkait.',
    };

    onAddClaim(newClaim);

    // Switch status filter to 'all' so new claim is immediately visible in the list
    setStatusFilter('all');

    // Reset Form
    setShowRtForm(false);
    setRtDeceasedName('');
    setRtCauseOfDeath('');
    setRtDeathCertFile(null);
    setRtDeathCertName('');
    setRtNotes('Laporan warga berduka. Berkas surat kematian RT/RS telah diverifikasi.');

    // Success Toast
    setSuccessToastMessage(`Klaim santunan untuk "${newClaim.deceasedName}" (${newClaim.claimNumber}) berhasil diajukan oleh RT! Data telah tersimpan dan kini tampil di daftar antrean.`);
    setTimeout(() => setSuccessToastMessage(null), 7000);
  };

  // ---------------------------------------------------------------------------
  // 2. OPEN & SUBMIT BENDAHARA PAYMENT MODAL
  // ---------------------------------------------------------------------------
  const handleOpenTreasurerModal = (claim: BenefitClaim) => {
    setTreasurerProcessingClaim(claim);
    if (claim.expenseDetails && claim.expenseDetails.length > 0) {
      setTreasurerExpenses(claim.expenseDetails);
    } else {
      // Default recommended package
      setTreasurerExpenses([
        {
          id: `exp-${Date.now()}-1`,
          description: `Santunan Duka Cita Tunai Ahli Waris (${claim.relationship})`,
          cost: 3000000,
          recipientParty: `${claim.memberName} (Keluarga / Ahli Waris)`,
          paidDate: new Date().toISOString().split('T')[0],
          transferProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
          transferProofFileName: 'bukti_transfer_bca_santunan.jpg',
          externalReceiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
          externalReceiptFileName: 'kwitansi_tanda_terima_ahliwaris.jpg'
        },
        {
          id: `exp-${Date.now()}-2`,
          description: 'Pembelian Kain Kafan & Minyak Fardhu Kifayah DKM',
          cost: 750000,
          recipientParty: 'Pengurus Koperasi DKM Masjid',
          paidDate: new Date().toISOString().split('T')[0],
          transferProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
          transferProofFileName: 'bukti_transfer_dkm_kafan.jpg',
          externalReceiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
          externalReceiptFileName: 'nota_pembelian_kain_kafan.jpg'
        },
        {
          id: `exp-${Date.now()}-3`,
          description: 'Sewa Mobil Ambulans Jenazah ke TPU Pemakaman',
          cost: 500000,
          recipientParty: 'Layanan Ambulans Siaga Peduli',
          paidDate: new Date().toISOString().split('T')[0],
          transferProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
          transferProofFileName: 'transfer_ambulans_jenazah.jpg',
          externalReceiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
          externalReceiptFileName: 'kwitansi_resmi_ambulans_091.jpg'
        }
      ]);
    }
    setTreasurerNotes(
      claim.treasurerNotes ||
      'Bendahara telah membayarkan santunan dan pos fardhu kifayah ke pihak terkait dengan bukti transfer bank & kwitansi fisik luar terlampir.'
    );
  };

  const handleApplyTreasurerBenefitTemplate = (benefit: BenefitMaster) => {
    const newItems: ExpenseDetail[] = [
      {
        id: `exp-${Date.now()}-1`,
        description: `Santunan Duka Cita Tunai (${benefit.categoryName})`,
        cost: benefit.maxCashAmount || 3000000,
        recipientParty: 'Ahli Waris / Keluarga Almarhum',
        paidDate: new Date().toISOString().split('T')[0],
        transferProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        transferProofFileName: 'transfer_bank_ahliwaris.jpg',
        externalReceiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
        externalReceiptFileName: 'kwitansi_tanda_terima_ahliwaris.jpg'
      },
    ];

    if (benefit.servicesIncluded && benefit.servicesIncluded.length > 0) {
      benefit.servicesIncluded.slice(0, 4).forEach((svc, i) => {
        if (!svc.toLowerCase().includes('santunan tunai')) {
          newItems.push({
            id: `exp-${Date.now()}-${i + 2}`,
            description: svc,
            cost: 500000,
            recipientParty: svc.toLowerCase().includes('ambulans')
              ? 'Vendor Layanan Ambulans Jenazah'
              : svc.toLowerCase().includes('makam') || svc.toLowerCase().includes('tpu')
              ? 'Petugas Makam TPU'
              : 'Koperasi DKM Fardhu Kifayah',
            paidDate: new Date().toISOString().split('T')[0],
            transferProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
            transferProofFileName: `transfer_${i + 2}.jpg`,
            externalReceiptUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80',
            externalReceiptFileName: `kwitansi_luar_${i + 2}.jpg`
          });
        }
      });
    }

    setTreasurerExpenses(newItems);
  };

  const handleAddExpenseItem = () => {
    if (!newExpDesc.trim() || !newExpCost) {
      alert('Isi nama pos pengeluaran dan nominal biaya.');
      return;
    }
    setTreasurerExpenses([
      ...treasurerExpenses,
      {
        id: 'exp-' + Date.now(),
        description: newExpDesc.trim(),
        cost: Number(newExpCost),
        recipientParty: newExpRecipient.trim() || 'Pihak Terkait / Penyedia Layanan',
        paidDate: newExpPaidDate,
        transferProofUrl: newExpTransferProof || undefined,
        transferProofFileName: newExpTransferName || undefined,
        externalReceiptUrl: newExpExternalReceipt || undefined,
        externalReceiptFileName: newExpReceiptName || undefined,
      },
    ]);
    setNewExpDesc('');
    setNewExpCost('');
    setNewExpRecipient('');
    setNewExpTransferProof(null);
    setNewExpTransferName('');
    setNewExpExternalReceipt(null);
    setNewExpReceiptName('');
  };

  const handleRemoveExpenseItem = (id: string) => {
    setTreasurerExpenses(treasurerExpenses.filter((e) => e.id !== id));
  };

  const totalTreasurerAmount = treasurerExpenses.reduce((sum, item) => sum + item.cost, 0);

  const handleSaveTreasurerPayments = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treasurerProcessingClaim) return;
    if (treasurerExpenses.length === 0 || totalTreasurerAmount <= 0) {
      alert('Masukkan setidaknya satu rincian pembayaran ke pihak terkait.');
      return;
    }

    const updatedClaim: BenefitClaim = {
      ...treasurerProcessingClaim,
      expenseDetails: treasurerExpenses,
      totalAmount: totalTreasurerAmount,
      treasurerName: activeUser?.name || 'Ibu Hj. Siti Aminah (Bendahara)',
      treasurerProcessedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      treasurerNotes: treasurerNotes.trim() || 'Pembayaran telah disalurkan dengan bukti transfer dan kwitansi pihak luar terlampir.',
      transferProofUrls: treasurerGlobalProof
        ? [treasurerGlobalProof]
        : treasurerProcessingClaim.transferProofUrls,
      externalReceiptUrls: treasurerGlobalReceipt
        ? [treasurerGlobalReceipt]
        : treasurerProcessingClaim.externalReceiptUrls,
      status: 'Menunggu Persetujuan Ketua',
      processedBy: `${treasurerProcessingClaim.submittedByRtName || 'RT'} & ${activeUser?.name || 'Bendahara'}`,
      notes: `Pembayaran sebesar ${formatIDR(totalTreasurerAmount)} telah dicatat oleh Bendahara. Menunggu persetujuan Ketua Paguyuban untuk memotong saldo kas.`,
    };

    if (onUpdateClaim) {
      onUpdateClaim(updatedClaim);
    }
    setTreasurerProcessingClaim(null);
  };

  // ---------------------------------------------------------------------------
  // 3. KETUA PAGUYUBAN APPROVAL & REJECTION
  // ---------------------------------------------------------------------------
  const handleApproveByKetua = () => {
    if (!approvingClaim) return;
    const finalSignature = includeSignature
      ? customSignature || settings?.defaultAdminSignature
      : undefined;

    if (onApproveClaim) {
      onApproveClaim(approvingClaim.id, approvalNotes, finalSignature);
    }
    setApprovingClaim(null);
  };

  const handleRejectByKetua = () => {
    if (!rejectingClaim) return;
    if (onRejectClaim) {
      onRejectClaim(rejectingClaim.id, rejectionReason);
    }
    setRejectingClaim(null);
  };

  // ---------------------------------------------------------------------------
  // FILTERING LOGIC
  // ---------------------------------------------------------------------------
  const filteredClaims = claims.filter((claim) => {
    // Status Filter
    if (statusFilter === 'pending') {
      const isPending =
        claim.status === 'Diajukan RT' ||
        claim.status === 'Menunggu Pembayaran Bendahara' ||
        claim.status === 'Menunggu Persetujuan Ketua' ||
        (!claim.status && claim.status !== 'Disetujui' && claim.status !== 'Ditolak');
      if (!isPending) return false;
    } else if (statusFilter === 'pending_treasurer') {
      if (claim.status !== 'Diajukan RT' && claim.status !== 'Menunggu Pembayaran Bendahara') return false;
    } else if (statusFilter === 'pending_ketua') {
      if (claim.status !== 'Menunggu Persetujuan Ketua') return false;
    } else if (statusFilter === 'approved') {
      if (claim.status !== 'Disetujui' && Boolean(claim.status)) return false;
    } else if (statusFilter === 'rejected') {
      if (claim.status !== 'Ditolak') return false;
    }

    // Cluster Filter
    if (clusterFilter !== 'all') {
      if (claim.cluster?.toLowerCase() !== clusterFilter.toLowerCase()) {
        return false;
      }
    }

    // Search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNum = claim.claimNumber?.toLowerCase().includes(q);
      const matchDec = claim.deceasedName?.toLowerCase().includes(q);
      const matchMem = claim.memberName?.toLowerCase().includes(q);
      const matchClu = claim.cluster?.toLowerCase().includes(q);
      const matchRel = claim.relationship?.toLowerCase().includes(q);
      const matchNotes = claim.rtNotes?.toLowerCase().includes(q) || claim.notes?.toLowerCase().includes(q);
      const matchStatus = claim.status?.toLowerCase().includes(q);
      if (!matchNum && !matchDec && !matchMem && !matchClu && !matchRel && !matchNotes && !matchStatus) return false;
    }

    return true;
  });

  const countPendingTreasurer = claims.filter((c) => c.status === 'Diajukan RT' || c.status === 'Menunggu Pembayaran Bendahara').length;
  const countPendingKetua = claims.filter((c) => c.status === 'Menunggu Persetujuan Ketua').length;
  const countPendingAll = countPendingTreasurer + countPendingKetua;
  const countApproved = claims.filter((c) => !c.status || c.status === 'Disetujui').length;
  const countRejected = claims.filter((c) => c.status === 'Ditolak').length;

  const uniqueClusters = Array.from(
    new Set(
      claims
        .map((c) => c.cluster)
        .filter((cl): cl is string => Boolean(cl && cl.trim()))
    )
  ).sort();

  const totalApprovedAmount = claims
    .filter((c) => !c.status || c.status === 'Disetujui')
    .reduce((sum, c) => sum + c.totalAmount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* 1. HEADER BANNER */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 p-6 rounded-2xl border border-rose-900/60 shadow-lg text-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-xs font-semibold border border-rose-500/30 mb-2">
            <Heart className="w-3.5 h-3.5" />
            <span>Alur Klaim & Penyaluran Santunan Kas Kematian</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isAnggota ? 'Transparansi Realisasi Santunan Duka' : 'Realisasi Manfaat & Persetujuan Klaim'}
          </h2>
          <p className="text-xs text-rose-200 mt-1 max-w-2xl leading-relaxed">
            Sistem tata kelola 3 pintu gotong royong: <strong>1. Input Pengajuan RT</strong> ➜ <strong>2. Input Pembayaran Bendahara</strong> (lampirkan bukti transfer & kwitansi luar) ➜ <strong>3. Persetujuan Ketua Paguyuban</strong> (secara resmi memotong Saldo Kas Paguyuban).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isAnggota && (
            <button
              onClick={() => {
                if (onOpenExportModal) {
                  onOpenExportModal();
                } else if (settings) {
                  exportBenefitClaimsCSV(claims, settings);
                }
              }}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-rose-800/80 transition-all inline-flex items-center gap-1.5 shadow-sm"
              title="Unduh Laporan Realisasi Santunan CSV"
            >
              <Download className="w-4 h-4 text-rose-400" />
              <span>Ekspor CSV</span>
            </button>
          )}

          {isAdmin && onClearClaims && claims.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Kosongkan seluruh data realisasi (${claims.length} klaim)? Seluruh data klaim santunan duka akan dihapus agar bersih untuk pelaporan riil.`)) {
                  onClearClaims();
                }
              }}
              className="px-3.5 py-2.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-rose-800/80 transition-all inline-flex items-center gap-1.5 shadow-sm"
              title="Kosongkan data klaim santunan duka"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Kosongkan Realisasi ({claims.length})</span>
            </button>
          )}

          {canInputRt && (
            <button
              onClick={() => setShowRtForm(!showRtForm)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-rose-950/50 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{showRtForm ? 'Tutup Formulir RT' : '+ Input Pengajuan Klaim (RT)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS TOAST MESSAGE */}
      {successToastMessage && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg border border-emerald-400 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{successToastMessage}</span>
          </div>
          <button
            onClick={() => setSuccessToastMessage(null)}
            className="text-emerald-200 hover:text-white font-black text-sm p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THREE-STEP INTERACTIVE WORKFLOW STEPPER CARD */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Alur Standar Operasional Klaim Santunan & Pemotongan Saldo Kas
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            SOP Akuntabilitas 100% Sah
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
          {/* Step 1: RT */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-start gap-3 relative overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              1
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                <h4 className="text-xs font-extrabold text-slate-900">Input Pengajuan oleh RT</h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Ketua RT menginput warga/keluarga yang meninggal dunia & melampirkan Surat Keterangan Kematian RT.
              </p>
              <div className="pt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                  Status: Menunggu Bendahara ({countPendingTreasurer})
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: Bendahara */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-start gap-3 relative overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              2
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <h4 className="text-xs font-extrabold text-slate-900">Input Pembayaran Bendahara</h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Bendahara menginput pembayaran ke pihak terkait (ahli waris, ambulans, TPU, kafan DKM) + Bukti Transfer & Kwitansi Pihak Luar.
              </p>
              <div className="pt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md">
                  Status: Menunggu Persetujuan Ketua ({countPendingKetua})
                </span>
              </div>
            </div>
          </div>

          {/* Step 3: Ketua Paguyuban */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-start gap-3 relative overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              3
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <h4 className="text-xs font-extrabold text-slate-900">Persetujuan Ketua Paguyuban</h4>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                Ketua memeriksa kelayakan berkas, menandatangani digital, dan <strong>resmi memotong saldo kas</strong>.
              </p>
              <div className="pt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  Disetujui: Memotong Saldo ({countApproved})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROLE-BASED WORKFLOW GUIDANCE BANNER */}
      {isBendahara && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-extrabold text-emerald-950 flex items-center gap-1.5">
              <span>Wewenang Bendahara: Realisasi Pembayaran Klaim Warga</span>
              <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md text-[10px] font-black">Tahap 2</span>
            </h4>
            <p className="text-emerald-800 leading-relaxed">
              Sesuai SOP Paguyuban, <strong>Bendahara tidak dapat menginput pengajuan klaim baru</strong>. Wewenang Bendahara adalah <strong>merealisasikan pembayaran santunan</strong> untuk pengajuan warga yang diajukan oleh Ketua RT (melakukan transfer ke ahli waris/vendor, mengunggah bukti transfer, dan kwitansi luar) sebelum diteruskan ke Ketua Paguyuban.
            </p>
          </div>
        </div>
      )}

      {isKetuaPaguyuban && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <div className="p-2 bg-purple-100 text-purple-800 rounded-xl shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-extrabold text-purple-950 flex items-center gap-1.5">
              <span>Wewenang Ketua Paguyuban: Otorisasi & Persetujuan Akhir Kas</span>
              <span className="px-2 py-0.5 bg-purple-200/80 text-purple-900 rounded-md text-[10px] font-black">Tahap 3</span>
            </h4>
            <p className="text-purple-800 leading-relaxed">
              Sesuai SOP Paguyuban, <strong>Ketua Paguyuban tidak menginput pengajuan klaim baru</strong>. Wewenang Ketua Paguyuban adalah memeriksa berkas santunan yang telah direalisasikan pembayarannya oleh Bendahara dan membubuhkan <strong>tanda tangan digital resmi untuk mengesahkan pemotongan kas paguyuban</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STEP 1 FORM: INPUT PENGAJUAN KLAIM OLEH RT */}
      {/* ========================================================================= */}
      {showRtForm && canInputRt && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-indigo-500 shadow-xl animate-in slide-in-from-top duration-200 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded-md mb-1.5">
                <Building className="w-3 h-3 text-indigo-600" />
                <span>Tahap 1: Formulir Pengajuan Kematian oleh Ketua RT</span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Formulir Pengajuan Santunan Kematian Warga (RT)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketua RT melaporkan peristiwa duka cita warga dan mengunggah Surat Keterangan Kematian resmi RT/RS.
              </p>
            </div>
            <button
              onClick={() => setShowRtForm(false)}
              className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleRtSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Anggota Terdaftar <span className="text-rose-500">*</span>
                  </label>
                  {isRt && userCluster && (
                    <button
                      type="button"
                      onClick={() => setFilterByClusterOnly(!filterByClusterOnly)}
                      className="text-[10px] text-indigo-600 hover:underline font-bold"
                    >
                      {filterByClusterOnly ? `Tampilkan Semua Warga` : `Hanya ${userCluster}`}
                    </button>
                  )}
                </div>
                <select
                  value={rtMemberId}
                  onChange={(e) => setRtMemberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {displayMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.memberNumber}) - {m.cluster || 'Cluster'}
                    </option>
                  ))}
                </select>
                {displayMembers.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">Belum ada anggota terdaftar.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Almarhum / Almarhumah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bpk. H. Supardi"
                  value={rtDeceasedName}
                  onChange={(e) => setRtDeceasedName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori Manfaat Santunan (Sesuai Master) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={rtRelationship}
                  onChange={(e) => setRtRelationship(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {benefits.filter((b) => b.isActive).map((b) => (
                    <option key={b.id} value={b.targetRelationship || b.categoryName}>
                      {b.categoryName} — Paket: {formatIDR(b.defaultTotalPackage)} (Tunai: {formatIDR(b.maxCashAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Meninggal Dunia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={rtDateOfDeath}
                  onChange={(e) => setRtDateOfDeath(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Penyebab Meninggal / Keterangan Medis
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Sakit di RS / Usia Lanjut"
                  value={rtCauseOfDeath}
                  onChange={(e) => setRtCauseOfDeath(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pengaju / Verifikator RT
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${activeUser?.name || 'Ketua RT'} (${activeUser?.cluster || 'Cluster RT'})`}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* ATTACHMENT: SURAT KETERANGAN KEMATIAN RT / RS */}
            <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Lampiran Surat Keterangan Kematian RT / Rumah Sakit</span>
                  </h4>
                  <p className="text-[11px] text-indigo-800">
                    Wajib diunggah atau gunakan sampel simulasi untuk pengajuan cepat.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={setSampleDeathCert}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-900 text-[10px] font-bold rounded-lg border border-indigo-300 transition-colors inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Gunakan Dokumen Contoh (Simulasi)</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="flex-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl cursor-pointer transition-colors text-xs text-indigo-900 font-medium">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>{rtDeathCertName || 'Pilih File Surat Kematian (JPG / PNG / PDF)'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, setRtDeathCertFile, setRtDeathCertName)}
                  />
                </label>
                {rtDeathCertFile && (
                  <button
                    type="button"
                    onClick={() => setZoomedImage({ url: rtDeathCertFile, title: 'Surat Keterangan Kematian RT' })}
                    className="px-3 py-2.5 bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Berkas</span>
                  </button>
                )}
              </div>
            </div>

            {/* RT NOTES */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Pengajuan dari RT
              </label>
              <textarea
                rows={2}
                value={rtNotes}
                onChange={(e) => setRtNotes(e.target.value)}
                placeholder="Catatan tambahan mengenai kondisi keluarga duka..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRtForm(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-lg shadow-indigo-900/30 inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Kirim Pengajuan ke Bendahara</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CLAIMS LIST TABLE & STATUS FILTER TABS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* TAB FILTER HEADER */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          {/* Row 1: Status Filter Tabs & Kas Summary */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* All Status */}
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Semua Status ({claims.length})
              </button>

              {/* All Pending (Menunggu) */}
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-300'
                }`}
                title="Tampilkan semua klaim berstatus menunggu (Bendahara / Ketua)"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Menunggu ({countPendingAll})</span>
              </button>

              {/* 1. Menunggu Pembayaran Bendahara */}
              <button
                type="button"
                onClick={() => setStatusFilter('pending_treasurer')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === 'pending_treasurer'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                <span>1. Menunggu Bendahara</span>
                <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[10px] flex items-center justify-center font-black">
                  {countPendingTreasurer}
                </span>
              </button>

              {/* 2. Menunggu Persetujuan Ketua */}
              <button
                type="button"
                onClick={() => setStatusFilter('pending_ketua')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === 'pending_ketua'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-sky-700 hover:bg-sky-50 border border-sky-200'
                }`}
              >
                <span>2. Menunggu Ketua</span>
                <span className="w-4 h-4 rounded-full bg-sky-200 text-sky-900 text-[10px] flex items-center justify-center font-black">
                  {countPendingKetua}
                </span>
              </button>

              {/* 3. Disetujui */}
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Disetujui ({countApproved})</span>
              </button>

              {/* 4. Ditolak (Always available so user can view/monitor rejected claims) */}
              <button
                type="button"
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5 ${
                  statusFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>Ditolak ({countRejected})</span>
              </button>
            </div>

            <div className="text-xs text-slate-600 shrink-0">
              Kas Terpakai Resmi: <strong className="text-rose-700 font-mono text-sm">{formatIDR(totalApprovedAmount)}</strong>
            </div>
          </div>

          {/* Row 2: Search input, Status select, Cluster filter & Reset */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari no klaim, almarhum, nama anggota, RT..."
                  className="w-full pl-8.5 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Select dropdown */}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 hidden md:inline">
                  Status:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Status ({claims.length})</option>
                  <option value="pending">⏳ Menunggu (Semua: {countPendingAll})</option>
                  <option value="pending_treasurer">🟡 1. Menunggu Pembayaran Bendahara ({countPendingTreasurer})</option>
                  <option value="pending_ketua">🔵 2. Menunggu Persetujuan Ketua ({countPendingKetua})</option>
                  <option value="approved">🟢 3. Disetujui (Kas Terpotong) ({countApproved})</option>
                  <option value="rejected">🔴 Ditolak ({countRejected})</option>
                </select>
              </div>

              {/* Cluster filter dropdown if clusters available */}
              {uniqueClusters.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 hidden md:inline">
                    Cluster:
                  </label>
                  <select
                    value={clusterFilter}
                    onChange={(e) => setClusterFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="all">Semua Cluster RT</option>
                    {uniqueClusters.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset filter button */}
              {(statusFilter !== 'all' || clusterFilter !== 'all' || searchTerm.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setClusterFilter('all');
                    setSearchTerm('');
                  }}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
                  title="Reset semua filter"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Total Results Count */}
            <div className="text-[11px] font-medium text-slate-500 self-end sm:self-center">
              Menampilkan <span className="font-bold text-slate-800">{filteredClaims.length}</span> dari {claims.length} klaim
            </div>
          </div>
        </div>

        {/* CLAIMS LIST */}
        <div className="divide-y divide-slate-100">
          {claims.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center border border-rose-100">
                <Heart className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 text-sm">
                  Data Realisasi Santunan Duka Bersih (Kosong)
                </h4>
                <p className="font-medium text-slate-500 max-w-md mx-auto leading-relaxed">
                  Belum ada data pengajuan santunan kematian yang tercatat. Seluruh riwayat transaksi santunan bersih sehingga sistem siap digunakan untuk pelaporan riil dari Ketua RT setempat.
                </p>
              </div>
              {canInputRt && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRtForm(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Buat Pengajuan Santunan Pertama (RT)</span>
                  </button>
                </div>
              )}
              {isBendahara && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Menunggu pengajuan klaim baru dari Ketua RT untuk direalisasikan pembayarannya.</span>
                  </span>
                </div>
              )}
              {isKetuaPaguyuban && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    <span>Menunggu klaim yang telah diajukan RT dan direalisasikan Bendahara untuk disahkan.</span>
                  </span>
                </div>
              )}
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-3">
              <Filter className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-medium text-slate-600">
                Tidak ada data klaim santunan duka yang sesuai dengan filter yang dipilih.
              </p>
              {(statusFilter !== 'all' || clusterFilter !== 'all' || searchTerm.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setClusterFilter('all');
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 inline-flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tampilkan Semua Klaim</span>
                </button>
              )}
            </div>
          ) : (
            [...filteredClaims]
              .sort((a, b) => {
                const timeA = new Date(a.submittedAt || a.createdAt).getTime() || 0;
                const timeB = new Date(b.submittedAt || b.createdAt).getTime() || 0;
                return timeB - timeA;
              })
              .map((claim) => {
              const isWaitingTreasurer =
                claim.status === 'Diajukan RT' || claim.status === 'Menunggu Pembayaran Bendahara';
              const isWaitingKetua = claim.status === 'Menunggu Persetujuan Ketua';
              const isApproved = !claim.status || claim.status === 'Disetujui';
              const isRejected = claim.status === 'Ditolak';

              return (
                <div
                  key={claim.id}
                  className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row justify-between gap-4 items-start lg:items-center"
                >
                  {/* Left Column: Claim Identity & Workflow Audit */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-700 px-2 py-0.5 bg-slate-100 rounded-md">
                        {claim.claimNumber}
                      </span>
                      <span className="font-black text-slate-900 text-base">
                        {claim.deceasedName}
                      </span>
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-900 font-extrabold text-[10px] rounded-md">
                        {claim.relationship}
                      </span>

                      {/* Status Badges */}
                      {isWaitingTreasurer && (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full border border-amber-300 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Menunggu Pembayaran Bendahara</span>
                        </span>
                      )}
                      {isWaitingKetua && (
                        <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 font-bold text-[10px] rounded-full border border-sky-300 inline-flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>Menunggu Persetujuan Ketua Paguyuban</span>
                        </span>
                      )}
                      {isApproved && (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full border border-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Disetujui (Kas Terpotong Sah)</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 font-extrabold text-[10px] rounded-full border border-rose-300 inline-flex items-center gap-1">
                          <X className="w-3 h-3 text-rose-600" />
                          <span>Ditolak</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600">
                      Anggota: <strong>{claim.memberName}</strong> ({claim.memberNumber}) • Cluster: <strong>{claim.cluster}</strong> • Wafat: <span className="font-mono">{claim.dateOfDeath}</span> ({claim.causeOfDeath || 'Usia lanjut'})
                    </p>

                    {/* Multi-role Audit Mini Trail */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                      {/* 1. RT */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">1. Pengajuan RT</span>
                        <span className="font-semibold text-slate-800">{claim.submittedByRtName || 'Ketua RT'}</span>
                        {claim.deathCertificateUrl && (
                          <button
                            type="button"
                            onClick={() => setZoomedImage({ url: claim.deathCertificateUrl!, title: `Surat Kematian RT - ${claim.deceasedName}` })}
                            className="text-[10px] text-indigo-600 font-bold hover:underline block mt-0.5 flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Lihat Surat Kematian</span>
                          </button>
                        )}
                      </div>

                      {/* 2. Bendahara */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">2. Pembayaran Bendahara</span>
                        {claim.treasurerName ? (
                          <>
                            <span className="font-semibold text-slate-800">{claim.treasurerName}</span>
                            <span className="text-[10px] text-emerald-700 block mt-0.5 font-bold">
                              {claim.expenseDetails?.length || 0} Pembayaran ke pihak terkait
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-600 italic">Belum diinput Bendahara</span>
                        )}
                      </div>

                      {/* 3. Ketua Paguyuban */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">3. Otorisasi Ketua</span>
                        {claim.approvedByKetuaName ? (
                          <>
                            <span className="font-semibold text-slate-800">{claim.approvedByKetuaName}</span>
                            <span className="text-[10px] text-emerald-700 block mt-0.5 font-bold">
                              Disahkan & Potong Kas
                            </span>
                          </>
                        ) : isRejected ? (
                          <span className="text-rose-600 font-bold">Ditolak</span>
                        ) : (
                          <span className="text-slate-400 italic">Menunggu persetujuan</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Financial Amount & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    <div className="text-left sm:text-right lg:text-right w-full sm:w-auto">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        {isApproved ? 'Nominal Resmi Terpotong' : 'Estimasi Pengeluaran Kas'}
                      </span>
                      <span className={`text-xl font-black font-mono ${isApproved ? 'text-rose-700' : 'text-slate-700'}`}>
                        {formatIDR(claim.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                      {/* Step 2 Trigger: Bendahara Input Payment */}
                      {isWaitingTreasurer && canInputTreasurer && (
                        <button
                          onClick={() => handleOpenTreasurerModal(claim)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Realisasikan Santunan (Input Pembayaran)</span>
                        </button>
                      )}

                      {/* Step 3 Trigger: Ketua Paguyuban Approval */}
                      {isWaitingKetua && canApproveKetua && (
                        <button
                          onClick={() => {
                            setApprovingClaim(claim);
                            setApprovalNotes('Disetujui resmi oleh Ketua Paguyuban. Transaksi memotong total saldo dana kas duka.');
                          }}
                          className="px-3.5 py-2 bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 animate-pulse"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Tinjau & Setujui Kas</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedClaimDetail(claim)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Rincian & Bukti</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL STEP 2: BENDAHARA INPUT PEMBAYARAN KE PIHAK TERKAIT */}
      {/* ========================================================================= */}
      {treasurerProcessingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md mb-1.5">
                  <CreditCard className="w-3 h-3 text-emerald-600" />
                  <span>Tahap 2: Input Pembayaran oleh Bendahara Paguyuban</span>
                </div>
                <h3 className="font-black text-slate-900 text-lg sm:text-xl">
                  Pencatatan Pembayaran ke Pihak Terkait & Berkas Bukti
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klaim <strong>{treasurerProcessingClaim.claimNumber}</strong> • Almarhum/ah <strong>{treasurerProcessingClaim.deceasedName}</strong> ({treasurerProcessingClaim.relationship} dari {treasurerProcessingClaim.memberName})
                </p>
              </div>
              <button
                onClick={() => setTreasurerProcessingClaim(null)}
                className="text-slate-400 hover:text-slate-800 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* RT Submission Summary Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-800">
                <span>Data Laporan RT Pengaju:</span>
                <span className="text-indigo-600">{treasurerProcessingClaim.submittedByRtName} ({treasurerProcessingClaim.submittedByRtCluster})</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                "{treasurerProcessingClaim.rtNotes || 'Tidak ada catatan tambahan dari RT.'}"
              </p>
              {treasurerProcessingClaim.deathCertificateUrl && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setZoomedImage({ url: treasurerProcessingClaim.deathCertificateUrl!, title: 'Surat Keterangan Kematian RT' })}
                    className="text-indigo-600 hover:underline font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Buka Lampiran Surat Kematian RT</span>
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveTreasurerPayments} className="space-y-6">
              {/* Itemized Payment Table Builder */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>Rincian Pembayaran ke Pihak Terkait (Vendor / Ahli Waris / Makam)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Setiap pos harus mencantumkan pihak penerima, bukti transfer, dan kwitansi pihak luar.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-bold">Template Cepat:</span>
                    {benefits.filter((b) => b.isActive).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleApplyTreasurerBenefitTemplate(b)}
                        className="px-2 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-800 text-[10px] font-bold rounded-lg border border-slate-300 transition-colors inline-flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3 text-emerald-600" />
                        <span>{b.code || b.categoryName.slice(0, 10)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Expense Line Form */}
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Nama Pos Pembayaran
                      </label>
                      <input
                        type="text"
                        placeholder="Santunan Ahli Waris / Kain Kafan / dll"
                        value={newExpDesc}
                        onChange={(e) => setNewExpDesc(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Pihak Terkait Penerima
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Ahli Waris / Petugas TPU"
                        value={newExpRecipient}
                        onChange={(e) => setNewExpRecipient(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Biaya (Rp)
                      </label>
                      <input
                        type="number"
                        placeholder="Biaya (Rp)"
                        value={newExpCost}
                        onChange={(e) => setNewExpCost(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-700 mb-1">
                        Tgl Bayar
                      </label>
                      <input
                        type="date"
                        value={newExpPaidDate}
                        onChange={(e) => setNewExpPaidDate(e.target.value)}
                        className="w-full px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  {/* Attachment selectors for this item */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-emerald-500 rounded-lg cursor-pointer text-slate-700">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="truncate">{newExpTransferName || 'Lampirkan Bukti Transfer Bank'}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, setNewExpTransferProof, setNewExpTransferName)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={setSampleTransferProof}
                        className="px-2 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-bold shrink-0"
                        title="Isi sampel bukti transfer"
                      >
                        Sampel
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-emerald-500 rounded-lg cursor-pointer text-slate-700">
                        <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="truncate">{newExpReceiptName || 'Lampirkan Kwitansi Pihak Luar'}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, setNewExpExternalReceipt, setNewExpReceiptName)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={setSampleExternalReceipt}
                        className="px-2 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-bold shrink-0"
                        title="Isi sampel kwitansi luar"
                      >
                        Sampel
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddExpenseItem}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambahkan Pos Pembayaran</span>
                    </button>
                  </div>
                </div>

                {/* List of Entered Payments */}
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {treasurerExpenses.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      Belum ada rincian pos pembayaran. Gunakan template atau tambahkan di atas.
                    </div>
                  ) : (
                    treasurerExpenses.map((exp, idx) => (
                      <div key={exp.id || idx} className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{exp.description}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md">
                              {exp.recipientParty || 'Pihak Terkait'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span>Tgl Bayar: {exp.paidDate || 'Hari ini'}</span>
                            {exp.transferProofUrl && (
                              <button
                                type="button"
                                onClick={() => setZoomedImage({ url: exp.transferProofUrl!, title: `Bukti Transfer - ${exp.description}` })}
                                className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Bukti Transfer</span>
                              </button>
                            )}
                            {exp.externalReceiptUrl && (
                              <button
                                type="button"
                                onClick={() => setZoomedImage({ url: exp.externalReceiptUrl!, title: `Kwitansi Luar - ${exp.description}` })}
                                className="text-sky-700 font-bold hover:underline inline-flex items-center gap-1"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>Kwitansi Luar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className="font-mono font-black text-rose-700 text-sm">
                            {formatIDR(exp.cost)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExpenseItem(exp.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* TOTAL AMOUNT BOX */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">
                      Total Pembayaran ke Pihak Terkait
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      {formatIDR(totalTreasurerAmount)}
                    </span>
                  </div>

                  <div className="text-xs text-amber-200 bg-amber-950/70 border border-amber-500/40 p-2.5 rounded-lg max-w-sm flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Data pembayaran & lampiran bukti akan diajukan ke <strong>Ketua Paguyuban</strong> untuk mendapatkan persetujuan akhir sebelum saldo kas dipotong.
                    </span>
                  </div>
                </div>
              </div>

              {/* TREASURER NOTES */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Bendahara Paguyuban
                </label>
                <textarea
                  rows={2}
                  value={treasurerNotes}
                  onChange={(e) => setTreasurerNotes(e.target.value)}
                  placeholder="Catatan pelunasan, nomor rekening penerima, atau keterangan verifikasi..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTreasurerProcessingClaim(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-lg shadow-emerald-950/30 inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Kirim ke Ketua Paguyuban untuk Persetujuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL STEP 3: KETUA PAGUYUBAN APPROVAL MODAL */}
      {/* ========================================================================= */}
      {approvingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-100 text-purple-800 font-bold text-[10px] rounded-md mb-1.5">
                  <ShieldCheck className="w-3 h-3 text-purple-600" />
                  <span>Tahap 3: Persetujuan Akhir oleh Ketua Paguyuban</span>
                </div>
                <h3 className="font-black text-slate-900 text-lg sm:text-xl">
                  Persetujuan Realisasi Santunan & Pengesahan Pemotongan Kas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nomor Berkas: <strong>{approvingClaim.claimNumber}</strong>
                </p>
              </div>
              <button
                onClick={() => setApprovingClaim(null)}
                className="text-slate-400 hover:text-slate-800 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Comprehensive Dossier Review */}
            <div className="space-y-4">
              {/* Member & Deceased */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Almarhum/ah</span>
                  <span className="font-extrabold text-slate-900 text-sm">{approvingClaim.deceasedName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Hubungan Keluarga</span>
                  <span className="font-bold text-slate-800">{approvingClaim.relationship}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Anggota Terdaftar</span>
                  <span className="font-medium text-slate-800">{approvingClaim.memberName} ({approvingClaim.memberNumber})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cluster RT</span>
                  <span className="font-bold text-slate-800">{approvingClaim.cluster}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Pengaju RT</span>
                  <span className="font-medium text-slate-800">{approvingClaim.submittedByRtName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Bendahara Pemroses</span>
                  <span className="font-medium text-slate-800">{approvingClaim.treasurerName}</span>
                </div>
              </div>

              {/* Rincian Biaya & Bukti Lampiran */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 font-bold text-xs text-slate-800 flex justify-between">
                  <span>Rincian Pembayaran ke Pihak Terkait:</span>
                  <span>Nominal</span>
                </div>
                <div className="divide-y divide-slate-100 p-2 text-xs">
                  {approvingClaim.expenseDetails?.map((exp, i) => (
                    <div key={i} className="py-2 px-2 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900">{exp.description}</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>Penerima: {exp.recipientParty || '-'}</span>
                          {exp.transferProofUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomedImage({ url: exp.transferProofUrl!, title: `Bukti Transfer - ${exp.description}` })}
                              className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Bukti Transfer</span>
                            </button>
                          )}
                          {exp.externalReceiptUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomedImage({ url: exp.externalReceiptUrl!, title: `Kwitansi Luar - ${exp.description}` })}
                              className="text-sky-700 font-bold hover:underline inline-flex items-center gap-0.5"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Kwitansi Luar</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatIDR(exp.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* IMPACT ON SALDO KAS PAGUYUBAN */}
              <div className="bg-gradient-to-r from-rose-950 to-slate-900 p-4 rounded-xl text-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-rose-300">
                    TOTAL KLAIM YANG AKAN MEMOTONG KAS
                  </span>
                  <span className="text-2xl font-black font-mono text-rose-400">
                    {formatIDR(approvingClaim.totalAmount)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 pt-1 border-t border-rose-900/60 flex justify-between">
                  <span>Saldo Kas Paguyuban Saat Ini: <strong className="font-mono text-white">{formatIDR(currentBalance)}</strong></span>
                  <span>Saldo Setelah Disetujui: <strong className="font-mono text-emerald-300">{formatIDR(Math.max(0, currentBalance - approvingClaim.totalAmount))}</strong></span>
                </div>
              </div>

              {/* Approval Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Pengesahan Ketua Paguyuban
                </label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              {/* Digital Signature Pad */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Bubuhkan Tanda Tangan Digital Ketua Paguyuban</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSignaturePad(!showSignaturePad)}
                    className="text-[11px] text-purple-700 hover:underline font-bold"
                  >
                    {showSignaturePad ? 'Sembunyikan Pad' : 'Tanda Tangan Manual'}
                  </button>
                </div>

                {showSignaturePad ? (
                  <DigitalSignaturePad
                    title="Tanda Tangan Digital Ketua Paguyuban"
                    defaultSignerName={activeUser?.name || 'Bpk. H. Ahmad Fauzi'}
                    defaultSignerRole="Ketua Paguyuban Dana Kematian"
                    onSave={(sigData) => {
                      setCustomSignature(sigData.signatureDataUrl);
                      setShowSignaturePad(false);
                    }}
                    onCancel={() => setShowSignaturePad(false)}
                  />
                ) : (
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Tanda tangan resmi tersimpan akan otomatis dibubuhkan pada berita acara digital.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setRejectingClaim(approvingClaim);
                  setApprovingClaim(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-300 rounded-xl transition-colors"
              >
                Tolak / Minta Revisi Berkas
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setApprovingClaim(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApproveByKetua}
                  className="px-6 py-2.5 text-xs font-black text-white bg-purple-700 hover:bg-purple-600 rounded-xl transition-colors shadow-lg shadow-purple-950/30 inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui Santunan & Sahkan Pemotongan Kas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. REJECTION MODAL */}
      {/* ========================================================================= */}
      {rejectingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-rose-700 text-lg">Tolak Pengajuan Klaim Santunan</h3>
                <p className="text-xs text-slate-500">{rejectingClaim.claimNumber} • {rejectingClaim.deceasedName}</p>
              </div>
              <button onClick={() => setRejectingClaim(null)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Penolakan / Catatan Revisi ke RT & Bendahara <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Bukti transfer tidak terbaca / kwitansi pihak luar belum ada stempel resmi..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingClaim(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRejectByKetua}
                className="px-5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs"
              >
                Konfirmasi Tolak Klaim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. CLAIM DETAIL & BERITA ACARA MODAL */}
      {/* ========================================================================= */}
      {selectedClaimDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] text-rose-600 font-extrabold uppercase tracking-wider">
                  BERITA ACARA REALISASI DANA KEMATIAN
                </span>
                <h3 className="font-black text-slate-900 text-lg sm:text-xl">
                  {selectedClaimDetail.claimNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedClaimDetail(null)}
                className="text-slate-400 hover:text-slate-800 text-sm font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Audit Status Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Status Berkas:</span>
                <span className="font-bold text-slate-900">{selectedClaimDetail.status || 'Disetujui'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Almarhum/ah:</span>
                <span className="font-extrabold text-slate-900">{selectedClaimDetail.deceasedName} ({selectedClaimDetail.relationship})</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Keluarga Anggota:</span>
                <span className="font-medium text-slate-900">{selectedClaimDetail.memberName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Cluster RT:</span>
                <span className="font-medium text-slate-900">{selectedClaimDetail.cluster}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Tgl Meninggal:</span>
                <span className="font-mono text-slate-900">{selectedClaimDetail.dateOfDeath}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Pengaju RT:</span>
                <span className="font-medium text-slate-900">{selectedClaimDetail.submittedByRtName || '-'}</span>
              </div>
            </div>

            {/* Itemized Expenses */}
            <div>
              <p className="text-xs font-bold text-slate-800 mb-2">Rincian Pembayaran ke Pihak Terkait & Berkas Lampiran:</p>
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 text-xs overflow-hidden">
                {selectedClaimDetail.expenseDetails?.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">Belum ada rincian pembayaran.</div>
                ) : (
                  selectedClaimDetail.expenseDetails?.map((exp, i) => (
                    <div key={i} className="p-3 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800">{exp.description}</span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span>Penerima: {exp.recipientParty || '-'}</span>
                          {exp.transferProofUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomedImage({ url: exp.transferProofUrl!, title: `Bukti Transfer - ${exp.description}` })}
                              className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Bukti Transfer</span>
                            </button>
                          )}
                          {exp.externalReceiptUrl && (
                            <button
                              type="button"
                              onClick={() => setZoomedImage({ url: exp.externalReceiptUrl!, title: `Kwitansi Luar - ${exp.description}` })}
                              className="text-sky-700 font-bold hover:underline inline-flex items-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Kwitansi Luar</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatIDR(exp.cost)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-rose-950 text-white p-4 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-rose-300 uppercase font-bold block">TOTAL SALDO KAS TERPAKAI</span>
                <span className="text-xs text-rose-200">
                  {selectedClaimDetail.status === 'Disetujui' || !selectedClaimDetail.status
                    ? 'Telah resmi mengurangi saldo kas paguyuban'
                    : 'Belum memotong saldo kas (menunggu persetujuan)'}
                </span>
              </div>
              <span className="text-xl font-black font-mono text-rose-300">
                {formatIDR(selectedClaimDetail.totalAmount)}
              </span>
            </div>

            {/* Signatures */}
            {selectedClaimDetail.approvedByKetuaName && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Otorisasi & Pengesahan</span>
                <p className="text-slate-800">
                  Disetujui oleh: <strong>{selectedClaimDetail.approvedByKetuaName}</strong> pada{' '}
                  <span className="font-mono text-slate-600">{selectedClaimDetail.approvedAt}</span>
                </p>
                <p className="text-[11px] text-slate-500 italic">"{selectedClaimDetail.approvalNotes}"</p>
              </div>
            )}

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedClaimDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Tutup Berita Acara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. IMAGE ZOOM MODAL */}
      {/* ========================================================================= */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl space-y-3 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 text-sm">{zoomedImage.title}</h4>
              <button
                onClick={() => setZoomedImage(null)}
                className="text-slate-400 hover:text-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh]">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>
            <div className="text-right">
              <button
                onClick={() => setZoomedImage(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold text-xs rounded-lg"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
