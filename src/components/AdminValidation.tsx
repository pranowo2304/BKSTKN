import React, { useState } from 'react';
import { Payment, Member, SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';
import {
  findMemberForPayment,
  generateReceiptWhatsAppUrl,
  formatPhoneDisplay,
} from '../lib/receiptUtils';
import {
  calculatePendingGracePeriod,
  getGracePeriodSummary,
  generateGracePeriodWhatsAppUrl,
  parsePaymentDate,
} from '../lib/gracePeriodUtils';
import {
  CheckSquare,
  ShieldCheck,
  XCircle,
  Eye,
  CheckCircle2,
  Clock,
  Search,
  AlertCircle,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Share2,
  Phone,
  MessageSquare,
  ArrowRight,
  Send,
  CalendarDays,
  Table as TableIcon,
  LayoutGrid,
  Info,
  PenTool,
} from 'lucide-react';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { SignatureData } from './DigitalSignaturePad';
import { PostVerifyWhatsAppModal } from './PostVerifyWhatsAppModal';
import { RoleMobileAppMenu } from './RoleMobileAppMenu';
import { Landmark, Users, Receipt, FileSpreadsheet, CreditCard } from 'lucide-react';
import { AppUser } from '../types';
import { useRolePermissions } from '../lib/permissions';

interface AdminValidationProps {
  payments: Payment[];
  members?: Member[];
  settings: SystemSettings;
  activeUser?: AppUser;
  onVerifyPayment: (
    paymentId: string,
    adminNotes?: string,
    adminSignature?: string,
    adminSignerName?: string,
    adminSignerTitle?: string
  ) => void;
  onRejectPayment: (paymentId: string, adminNotes: string) => void;
  onViewReceipt: (payment: Payment) => void;
  onSaveDefaultSignature?: (signatureUrl: string, signerName: string, signerTitle: string) => void;
}

export const AdminValidation: React.FC<AdminValidationProps> = ({
  payments,
  members = [],
  settings,
  activeUser,
  onVerifyPayment,
  onRejectPayment,
  onViewReceipt,
  onSaveDefaultSignature,
}) => {
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'OverdueGrace' | 'Verified' | 'Rejected' | 'Semua'>('Pending');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [verifySignaturePayment, setVerifySignaturePayment] = useState<Payment | null>(null);
  const [postVerifyPayment, setPostVerifyPayment] = useState<Payment | null>(null);

  const { can } = useRolePermissions();
  const canApprovePayments = can(activeUser?.authority, 'approve_payments');
  const canRejectPayments = can(activeUser?.authority, 'reject_payments');
  const canIssueReceipts = can(activeUser?.authority, 'issue_receipts');
  // Wewenang pengiriman kwitansi: HANYA Bendahara atau role dengan izin issue_receipts
  const isBendahara = activeUser?.authority === 'Bendahara' || canIssueReceipts;
  const isReadOnlyRole = !canApprovePayments;

  const handleSignatureVerify = (data: SignatureData) => {
    if (!verifySignaturePayment || !canApprovePayments) return;
    const paymentToVerify = verifySignaturePayment;
    onVerifyPayment(
      paymentToVerify.id,
      'Disetujui dan disahkan secara resmi oleh Bendahara',
      data.signatureUrl,
      data.signerName,
      data.signerTitle
    );
    if (data.saveAsDefault && onSaveDefaultSignature) {
      onSaveDefaultSignature(data.signatureUrl, data.signerName, data.signerTitle);
    }
    setVerifySignaturePayment(null);

    // Setelah verifikasi, bendahara langsung diberikan opsi mengirim kwitansi resmi ke WA anggota
    if (isBendahara) {
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const verifiedObj: Payment = {
        ...paymentToVerify,
        status: 'Verified',
        verifiedAt: nowIso,
        verifiedBy: data.signerName || activeUser?.name || settings.treasurerName || 'Bendahara',
        adminNotes: 'Disetujui dan disahkan secara resmi oleh Bendahara',
        adminSignature: data.signatureUrl,
        adminSignerName: data.signerName,
        adminSignerTitle: data.signerTitle,
        adminSignatureDate: nowIso,
      };
      setPostVerifyPayment(verifiedObj);
    }
  };

  const handleQuickVerify = (payment: Payment) => {
    const verifierName = activeUser?.name || settings.treasurerName || 'Bendahara';
    onVerifyPayment(payment.id, 'Disetujui dan disahkan oleh Bendahara');

    // Setelah verifikasi cepat, bendahara langsung diberikan opsi mengirim kwitansi resmi ke WA anggota
    if (isBendahara) {
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const verifiedObj: Payment = {
        ...payment,
        status: 'Verified',
        verifiedAt: nowIso,
        verifiedBy: verifierName,
        adminNotes: 'Disetujui dan disahkan oleh Bendahara',
        adminSignerName: verifierName,
      };
      setPostVerifyPayment(verifiedObj);
    }
  };

  const pendingPayments = payments.filter((p) => p.status === 'Pending');
  const verifiedPayments = payments.filter((p) => p.status === 'Verified');
  const graceSummary = getGracePeriodSummary(payments);

  const filteredPayments = payments.filter((p) => {
    let matchesStatus = true;
    if (filterStatus === 'Semua') {
      matchesStatus = true;
    } else if (filterStatus === 'OverdueGrace') {
      const gInfo = calculatePendingGracePeriod(p);
      matchesStatus = p.status === 'Pending' && gInfo.isExceedingGracePeriod;
    } else {
      matchesStatus = p.status === filterStatus;
    }

    const matchesSearch =
      (p.memberName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.memberNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.receiptNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.paymentMethod ? p.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()) : false);

    return matchesStatus && matchesSearch;
  });

  const handleConfirmReject = () => {
    if (!rejectModalPayment || !rejectReason.trim()) return;
    onRejectPayment(rejectModalPayment.id, rejectReason);
    setRejectModalPayment(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-32">
      {/* ========================================================================= */}
      {/* MOBILE APP STYLE OPERATIONAL MENU & DASHBOARD (KHUSUS BENDAHARA)          */}
      {/* ========================================================================= */}
      <RoleMobileAppMenu
        activeUser={activeUser}
        roleTitle="BENDAHARA PAGUYUBAN"
        userName={activeUser?.name || settings.treasurerName || 'Bendahara Paguyuban'}
        roleSubtitle="Bendahara Paguyuban • Validasi Kas, Kwitansi & Mutasi Iuran"
        counterLabel="ANTREAN STRUK"
        counterValue={`${pendingPayments.length} Bukti`}
        counterHighlight={pendingPayments.length > 0}
        sectionTitle="MENU CEPAT BENDAHARA"
        sectionSubtitle="Kelola verifikasi mutasi rekening & kwitansi kas"
        actions={[
          {
            id: 'antrean-kas',
            label: 'Validasi Struk',
            subLabel: 'Menunggu Dicek',
            badge: pendingPayments.length > 0 ? pendingPayments.length : undefined,
            gradient: 'from-amber-500 to-orange-500',
            icon: CheckSquare,
            onClick: () => {
              setFilterStatus('Pending');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'kas-kritis',
            label: 'Lewat 30 Hari',
            subLabel: 'Masa Tenggang Kritis',
            badge: graceSummary.overdueCount > 0 ? graceSummary.overdueCount : undefined,
            gradient: 'from-rose-600 to-red-600',
            icon: AlertTriangle,
            onClick: () => {
              setFilterStatus('OverdueGrace');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'kas-lolos',
            label: 'Kas Terverifikasi',
            subLabel: 'Dana Masuk Kas',
            badge: verifiedPayments.length,
            gradient: 'from-emerald-600 to-teal-500',
            icon: CheckCircle2,
            onClick: () => {
              setFilterStatus('Verified');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'semua-mutasi',
            label: 'Semua Transaksi',
            subLabel: 'Arsip & Kwitansi',
            badge: payments.length,
            gradient: 'from-purple-600 to-indigo-500',
            icon: Receipt,
            onClick: () => {
              setFilterStatus('Semua');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
        ]}
        pills={[
          {
            id: 'pill-antrean',
            label: 'Antrean Validasi',
            count: pendingPayments.length,
            isActive: filterStatus === 'Pending',
            icon: Clock,
            onClick: () => setFilterStatus('Pending'),
          },
          ...(graceSummary.hasOverdue ? [{
            id: 'pill-kritis',
            label: 'Kritis >30 Hari',
            count: graceSummary.overdueCount,
            isActive: filterStatus === 'OverdueGrace',
            icon: AlertTriangle,
            onClick: () => setFilterStatus('OverdueGrace'),
          }] : []),
          {
            id: 'pill-berhasil',
            label: 'Disetujui',
            count: verifiedPayments.length,
            isActive: filterStatus === 'Verified',
            icon: CheckCircle2,
            onClick: () => setFilterStatus('Verified'),
          },
          {
            id: 'pill-semua',
            label: 'Semua Transaksi',
            count: payments.length,
            isActive: filterStatus === 'Semua',
            icon: Receipt,
            onClick: () => setFilterStatus('Semua'),
          },
        ]}
        dockItems={[
          {
            id: 'dock-antrean',
            label: 'Validasi',
            icon: CheckSquare,
            badge: pendingPayments.length > 0 ? pendingPayments.length : undefined,
            isActive: filterStatus === 'Pending',
            onClick: () => {
              setFilterStatus('Pending');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-kritis',
            label: 'Kritis >30h',
            icon: AlertTriangle,
            badge: graceSummary.overdueCount > 0 ? graceSummary.overdueCount : undefined,
            isActive: filterStatus === 'OverdueGrace',
            onClick: () => {
              setFilterStatus('OverdueGrace');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-kas',
            label: 'Rekap Kas',
            icon: Landmark,
            isCenterFloating: true,
            onClick: () => {
              setFilterStatus('Verified');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-berhasil',
            label: 'Lunas',
            icon: CheckCircle2,
            isActive: filterStatus === 'Verified',
            onClick: () => {
              setFilterStatus('Verified');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-riwayat',
            label: 'Riwayat',
            icon: Receipt,
            isActive: filterStatus === 'Semua',
            onClick: () => {
              setFilterStatus('Semua');
              const el = document.getElementById('validation-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
        ]}
      />

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-2xl border border-slate-800 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold border border-indigo-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Portal Bendahara & Administrasi Kas</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Validasi Bukti Pembayaran Iuran Warga</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Verifikasi kesesuaian mutasi transfer rekening paguyuban. Transaksi disetujui akan otomatis menambah saldo kas resmi, memperbarui masa berlaku keanggotaan (KTA), dan menerbitkan kwitansi digital.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {graceSummary.hasOverdue && (
            <div className="flex items-center gap-3 bg-rose-950/80 px-4 py-3 rounded-xl border border-rose-600/80 shadow-lg shadow-rose-950/40 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
              <div>
                <p className="text-[10px] text-rose-300 uppercase font-black tracking-wider">Lewat 30 Hari</p>
                <p className="text-lg sm:text-xl font-black text-white font-mono leading-none">
                  {graceSummary.overdueCount} <span className="text-xs text-rose-300 font-bold">Kritis</span>
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 bg-slate-800 px-4 py-3 rounded-xl border border-slate-700">
            <Clock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Total Antrean</p>
              <p className="text-lg sm:text-xl font-black text-amber-400 font-mono leading-none">{pendingPayments.length} Struk</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🚨 BENDAHARA GRACE PERIOD SYSTEM ALERT BOX */}
      {graceSummary.hasOverdue && (
        <div className="bg-gradient-to-br from-rose-900 via-slate-900 to-rose-950 rounded-2xl p-5 sm:p-6 text-white border-2 border-rose-500/80 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-rose-800/80 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/40 shrink-0 mt-0.5 animate-bounce">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Peringatan Bendahara: {graceSummary.overdueCount} Pembayaran Melebihi Toleransi 30 Hari (Grace Period)
                  </h3>
                  <span className="px-2.5 py-0.5 bg-rose-500 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                    Tindakan Prioritas
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Bukti transfer ini telah diajukan lebih dari 30 hari yang lalu dan belum disahkan. Mohon segera validasi mutasi atau hubungi warga terkait agar pencatatan kas tetap akuntabel.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus('OverdueGrace')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all shadow-md inline-flex items-center gap-1.5 ${
                  filterStatus === 'OverdueGrace'
                    ? 'bg-white text-rose-950 ring-2 ring-rose-400'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Lihat {graceSummary.overdueCount} Transaksi Kritis &gt;30 Hari</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-rose-800/50 flex justify-between items-center">
              <span className="text-slate-400">Total Transaksi Tertahan:</span>
              <span className="font-mono font-black text-rose-300 text-sm">{graceSummary.overdueCount} Bukti</span>
            </div>
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-rose-800/50 flex justify-between items-center">
              <span className="text-slate-400">Nominal Dana Tertahan:</span>
              <span className="font-mono font-black text-white text-sm">{formatIDR(graceSummary.overdueTotalAmount)}</span>
            </div>
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-rose-800/50 flex justify-between items-center">
              <span className="text-slate-400">Batas Toleransi Sistem:</span>
              <span className="font-mono font-bold text-amber-300">Maks. 30 Hari Kalender</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs, Search & View Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama warga, NPA, metode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs w-full sm:w-auto">
            <button
              onClick={() => setFilterStatus('Pending')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterStatus === 'Pending'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Pending ({pendingPayments.length})
            </button>

            {graceSummary.hasOverdue && (
              <button
                onClick={() => setFilterStatus('OverdueGrace')}
                className={`px-3 py-1.5 rounded-lg font-black transition-all inline-flex items-center gap-1.5 ${
                  filterStatus === 'OverdueGrace'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-700 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>🚨 Lewat 30 Hari ({graceSummary.overdueCount})</span>
              </button>
            )}

            <button
              onClick={() => setFilterStatus('Verified')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterStatus === 'Verified'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Verified
            </button>

            <button
              onClick={() => setFilterStatus('Rejected')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterStatus === 'Rejected'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Rejected
            </button>

            <button
              onClick={() => setFilterStatus('Semua')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterStatus === 'Semua'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Semua ({payments.length})
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Tampilan Tabel (dengan highlight merah lembut untuk >30 hari)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Tampilan Kartu"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kartu</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONDITIONAL COLOR LEGEND */}
      <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-bold text-slate-700">Panduan Warna Baris:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-300 text-rose-900 font-bold rounded-lg text-[11px] shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            Baris Merah Lembut: Pembayaran berumur lebih dari 30 hari (&gt; 30 Hari)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-[11px]">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            Baris Normal (≤ 30 Hari)
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Menampilkan {filteredPayments.length} transaksi
        </span>
      </div>

      {/* PAYMENTS VALIDATION LIST / TABLE */}
      {filteredPayments.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
          <CheckSquare className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">Tidak ada transaksi ditemukan.</p>
          <p className="text-xs text-slate-400 mt-1">Gunakan filter di atas untuk melihat status lainnya.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW WITH CONDITIONAL SOFT-RED BACKGROUND ON TABLE ROWS */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <th className="py-3.5 px-4">Warga & No. Anggota</th>
                  <th className="py-3.5 px-4">Jenis & Periode</th>
                  <th className="py-3.5 px-4">Nominal</th>
                  <th className="py-3.5 px-4">Metode & Waktu</th>
                  <th className="py-3.5 px-4">Umur / Grace Period</th>
                  <th className="py-3.5 px-4 text-center">Bukti Struk</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((payment) => {
                  const targetMember = findMemberForPayment(payment, members);
                  const memberPhone = targetMember?.phone || '';
                  const waReceiptUrl = generateReceiptWhatsAppUrl(payment, targetMember, settings);
                  const graceInfo = calculatePendingGracePeriod(payment);

                  // Calculate exact age in days for this payment
                  const createdAtDate = parsePaymentDate(payment.createdAt);
                  const diffDays = Math.max(0, Math.floor((new Date().getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)));
                  const isOlderThan30Days = diffDays > 30 || (payment.status === 'Pending' && graceInfo.isExceedingGracePeriod);
                  const isOverduePending = payment.status === 'Pending' && isOlderThan30Days;
                  const waGraceUrl = generateGracePeriodWhatsAppUrl(payment, targetMember, graceInfo, settings);

                  return (
                    <tr
                      key={payment.id}
                      className={`transition-colors duration-150 ${
                        isOlderThan30Days
                          ? 'bg-rose-50/90 hover:bg-rose-100/90 text-slate-900 border-l-4 border-l-rose-500 border-b border-rose-200/80'
                          : 'bg-white hover:bg-slate-50/90 text-slate-800 border-l-4 border-l-transparent border-b border-slate-100'
                      }`}
                    >
                      {/* Warga & NPA */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{payment.memberName}</span>
                          {isOlderThan30Days && (
                            <span
                              className="px-1.5 py-0.2 bg-rose-200 text-rose-950 text-[10px] font-black rounded border border-rose-300 inline-flex items-center gap-0.5"
                              title={`Pembayaran ini telah diajukan ${diffDays} hari yang lalu (> 30 hari)`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
                              <span>&gt;30 Hari</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            {payment.memberNumber}
                          </span>
                          {targetMember?.cluster && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                              {targetMember.cluster}
                            </span>
                          )}
                        </div>
                        {memberPhone && (
                          <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                            <span>{memberPhone}</span>
                          </p>
                        )}
                      </td>

                      {/* Jenis & Periode */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="font-bold text-slate-800 block">{payment.paymentType}</span>
                        <span className="text-xs text-slate-500">{payment.periodMonth}</span>
                        {payment.receiptNumber && (
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                            {payment.receiptNumber}
                          </span>
                        )}
                      </td>

                      {/* Nominal */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="font-black font-mono text-sm text-emerald-700 block">
                          {formatIDR(payment.amount)}
                        </span>
                      </td>

                      {/* Metode & Waktu */}
                      <td className="py-3.5 px-4 align-middle text-xs">
                        <span className="font-semibold text-slate-700 block">{payment.paymentMethod}</span>
                        <span className="font-mono text-[11px] text-slate-500 block">{payment.createdAt}</span>
                      </td>

                      {/* Umur & Grace Period */}
                      <td className="py-3.5 px-4 align-middle">
                        {isOlderThan30Days ? (
                          <div className="space-y-1">
                            <span className="px-2.5 py-1 bg-rose-600 text-white font-black text-[11px] rounded-lg inline-flex items-center gap-1 shadow-xs animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-rose-200" />
                              <span>{diffDays} Hari</span>
                            </span>
                            {payment.status === 'Pending' && graceInfo.daysOverdue > 0 && (
                              <p className="text-[10px] text-rose-800 font-bold leading-tight">
                                Lewat +{graceInfo.daysOverdue} hari toleransi
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded text-[11px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{diffDays} Hari</span>
                          </span>
                        )}
                      </td>

                      {/* Bukti Struk */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        {payment.proofImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProofUrl(payment.proofImageUrl || null)}
                            className="group relative w-12 h-12 rounded-lg border-2 border-slate-300 overflow-hidden bg-slate-100 inline-block hover:border-emerald-500 transition-colors shadow-2xs"
                            title="Klik untuk zoom bukti transfer"
                          >
                            <img src={payment.proofImageUrl} alt="Struk" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Tidak ada struk</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-middle">
                        {payment.status === 'Pending' ? (
                          <span className={`px-2.5 py-1 font-bold text-xs rounded-full inline-flex items-center gap-1 ${
                            isOlderThan30Days ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-amber-100 text-amber-900'
                          }`}>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        ) : payment.status === 'Verified' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-xs rounded-full inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Aksi Validasi */}
                      <td className="py-3.5 px-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {payment.status === 'Pending' && (
                            isReadOnlyRole ? (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-semibold border border-slate-200">
                                Pantau
                              </span>
                            ) : (
                              <>
                                {isOverduePending && memberPhone && (
                                  <button
                                    type="button"
                                    onClick={() => window.open(waGraceUrl, '_blank', 'noopener,noreferrer')}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs inline-flex items-center gap-1"
                                    title="Kirim pesan WhatsApp tindak lanjut toleransi 30 hari"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>WA</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setRejectModalPayment(payment)}
                                  className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1"
                                  title="Tolak bukti transfer ini"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Tolak</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setVerifySignaturePayment(payment)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-lg transition-all shadow-sm shadow-emerald-950/20 inline-flex items-center gap-1 hover:scale-105 active:scale-95"
                                  title="Setujui dan bubuhkan tanda tangan digital pada Kwitansi & KTA"
                                >
                                  <PenTool className="w-3 h-3" />
                                  <span>Setujui & TTD</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickVerify(payment)}
                                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors inline-flex items-center gap-1"
                                  title="Setujui cepat tanpa input tanda tangan"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Cepat</span>
                                </button>
                              </>
                            )
                          )}

                          {payment.status === 'Verified' && (
                            <>
                              {payment.adminSignature && (
                                <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded" title="Kwitansi ber-tanda tangan digital resmi">
                                  <PenTool className="w-2.5 h-2.5" />
                                  <span>TTD</span>
                                </span>
                              )}
                              {isBendahara && (
                                <button
                                  type="button"
                                  onClick={() => window.open(waReceiptUrl, '_blank', 'noopener,noreferrer')}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-[11px] rounded-lg transition-all border border-emerald-300 inline-flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95"
                                  title={`Kirim kwitansi via WhatsApp ke nomor ${memberPhone || payment.memberName} (Khusus Bendahara)`}
                                >
                                  <Share2 className="w-3 h-3" />
                                  <span>Kirim WA</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onViewReceipt(payment)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs"
                                title="Buka kwitansi resmi"
                              >
                                <FileText className="w-3 h-3 text-emerald-400" />
                                <span>Kwitansi</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW WITH CONDITIONAL SOFT-RED BACKGROUND */
        <div className="space-y-4">
          {filteredPayments.map((payment) => {
            const targetMember = findMemberForPayment(payment, members);
            const memberPhone = targetMember?.phone || '';
            const waReceiptUrl = generateReceiptWhatsAppUrl(payment, targetMember, settings);
            const graceInfo = calculatePendingGracePeriod(payment);

            const createdAtDate = parsePaymentDate(payment.createdAt);
            const diffDays = Math.max(0, Math.floor((new Date().getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)));
            const isOlderThan30Days = diffDays > 30 || (payment.status === 'Pending' && graceInfo.isExceedingGracePeriod);
            const isOverduePending = payment.status === 'Pending' && isOlderThan30Days;
            const waGraceUrl = generateGracePeriodWhatsAppUrl(payment, targetMember, graceInfo, settings);

            return (
              <div
                key={payment.id}
                className={`rounded-2xl p-5 sm:p-6 border transition-all shadow-sm ${
                  isOlderThan30Days
                    ? 'border-2 border-rose-400 bg-rose-50/80 ring-2 ring-rose-500/20'
                    : payment.status === 'Pending'
                    ? 'border-2 border-amber-400/80 bg-amber-50/10'
                    : payment.status === 'Verified'
                    ? 'border-slate-200 bg-white'
                    : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  {/* Member & Payment Details */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-base sm:text-lg">{payment.memberName}</span>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded-md border border-slate-200">
                        {payment.memberNumber}
                      </span>
                      {targetMember?.cluster && (
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-mono text-xs font-bold rounded-md border border-emerald-200">
                          {targetMember.cluster}
                        </span>
                      )}
                      {memberPhone && (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded-md border border-slate-200 inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{memberPhone}</span>
                        </span>
                      )}

                      {/* Status Badges */}
                      {isOlderThan30Days ? (
                        <span className="px-3 py-1 bg-rose-600 text-white font-black text-xs rounded-full inline-flex items-center gap-1.5 shadow-sm animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-white" />
                          <span>🚨 Melebihi 30 Hari ({diffDays} hari • Lewat +{graceInfo.daysOverdue}h)</span>
                        </span>
                      ) : payment.status === 'Pending' ? (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-bold text-xs rounded-full inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Menunggu Validasi ({diffDays} hari)</span>
                        </span>
                      ) : payment.status === 'Verified' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Verifikasi LUNAS</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 font-bold text-xs rounded-full inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Ditolak</span>
                        </span>
                      )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Jenis Iuran</span>
                        <span className="font-semibold text-slate-800">{payment.paymentType}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Periode</span>
                        <span className="font-semibold text-slate-800">{payment.periodMonth}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Metode Transfer</span>
                        <span className="font-mono text-slate-800">{payment.paymentMethod}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Waktu Submit</span>
                        <span className="font-mono text-slate-800">{payment.createdAt}</span>
                      </div>
                    </div>

                    {/* Grace Period Detailed Timeline Note for Overdue items */}
                    {isOlderThan30Days && (
                      <div className="p-3 bg-rose-100/90 border border-rose-300 rounded-xl text-rose-950 text-xs flex items-start gap-2">
                        <CalendarDays className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            Tenggang Waktu Terlampaui ({diffDays} hari):
                          </p>
                          <p className="text-[11px] text-rose-900 mt-0.5">
                            Batas toleransi 30 hari telah berakhir pada <strong>{graceInfo.graceDeadlineFormatted}</strong>. Baris ini ditandai latar merah lembut untuk tindakan prioritas.
                          </p>
                        </div>
                      </div>
                    )}

                    {payment.adminNotes && (
                      <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-lg italic border border-slate-200">
                        <strong>Catatan Admin:</strong> {payment.adminNotes}
                      </p>
                    )}
                  </div>

                  {/* Amount & Proof Image Preview + Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200 justify-between">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Nominal Transfer</p>
                      <p className="text-2xl font-black font-mono text-emerald-700">{formatIDR(payment.amount)}</p>
                    </div>

                    {/* Proof Thumbnail */}
                    {payment.proofImageUrl && (
                      <button
                        onClick={() => setSelectedProofUrl(payment.proofImageUrl || null)}
                        className="group relative w-16 h-16 rounded-xl border-2 border-slate-300 overflow-hidden bg-slate-100 shrink-0 hover:border-emerald-500 transition-colors"
                        title="Klik untuk zoom bukti transfer"
                      >
                        <img src={payment.proofImageUrl} alt="Struk" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </button>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {payment.status === 'Pending' && (
                        isReadOnlyRole ? (
                          <div className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold text-center w-full">
                            Mode Monitoring: Hanya Bendahara yang berwenang memvalidasi setoran kas.
                          </div>
                        ) : (
                          <>
                            {/* Dedicated WhatsApp Follow-Up Button for Overdue Payments */}
                            {isOverduePending && memberPhone && (
                              <button
                                type="button"
                                onClick={() => window.open(waGraceUrl, '_blank', 'noopener,noreferrer')}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-950/20 inline-flex items-center justify-center gap-1.5"
                                title="Kirim pesan WhatsApp pengingat konfirmasi transfer yang tertahan"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Hubungi Warga (WA)</span>
                              </button>
                            )}

                            <button
                              onClick={() => setRejectModalPayment(payment)}
                              className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Tolak</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setVerifySignaturePayment(payment)}
                              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-900/20 inline-flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95"
                              title="Setujui dan bubuhkan tanda tangan digital pada Kwitansi & KTA"
                            >
                              <PenTool className="w-4 h-4" />
                              <span>Setujui & TTD</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickVerify(payment)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1"
                              title="Setujui cepat tanpa input tanda tangan"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Cepat</span>
                            </button>
                          </>
                        )
                      )}

                      {payment.status === 'Verified' && (
                        <div className="inline-flex items-center gap-2 w-full sm:w-auto">
                          {payment.adminSignature && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg" title="Kwitansi ber-tanda tangan digital resmi">
                              <PenTool className="w-3 h-3" />
                              <span>Ber-TTD</span>
                            </span>
                          )}
                          {isBendahara && (
                            <button
                              type="button"
                              onClick={() => window.open(waReceiptUrl, '_blank', 'noopener,noreferrer')}
                              className="flex-1 sm:flex-none px-3 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-extrabold text-xs rounded-xl transition-all border border-emerald-300 inline-flex items-center justify-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95"
                              title={`Kirim kwitansi via WA ke nomor ${memberPhone || payment.memberName} (Khusus Bendahara)`}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Kirim WA</span>
                            </button>
                          )}

                          <button
                            onClick={() => onViewReceipt(payment)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 shadow-sm"
                            title="Buka kwitansi resmi"
                          >
                            <FileText className="w-4 h-4 text-emerald-400" />
                            <span>Kwitansi</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PROOF IMAGE ZOOM MODAL */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>Foto Struk / Bukti Transfer</span>
              </span>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex justify-center max-h-[75vh] overflow-auto">
              <img src={selectedProofUrl} alt="Bukti Transfer Zoom" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
            <div className="p-3 bg-slate-100 text-right">
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg"
              >
                Tutup Zoom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {rejectModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-base">Alasan Penolakan Pembayaran</h3>
            <p className="text-xs text-slate-500">
              Jelaskan alasan bukti transfer atas nama <strong>{rejectModalPayment.memberName}</strong> ditolak.
            </p>
            <textarea
              rows={3}
              placeholder="Contoh: Foto struk buram / nominal tidak sesuai mutasi bank"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE VERIFICATION MODAL */}
      {verifySignaturePayment && (
        <DigitalSignatureModal
          isOpen={!!verifySignaturePayment}
          onClose={() => setVerifySignaturePayment(null)}
          onSave={handleSignatureVerify}
          initialSignature={verifySignaturePayment.adminSignature || settings.defaultAdminSignature}
          defaultSignerName={verifySignaturePayment.adminSignerName || activeUser?.name || settings.defaultAdminSignerName || settings.treasurerName}
          defaultSignerTitle={verifySignaturePayment.adminSignerTitle || settings.defaultAdminSignerTitle || (activeUser?.authority === 'Bendahara' ? 'Bendahara Paguyuban' : 'Pengurus / Admin')}
          documentTitle={`Verifikasi Iuran: ${verifySignaturePayment.memberName} (${verifySignaturePayment.periodMonth} - ${formatIDR(verifySignaturePayment.amount)})`}
        />
      )}

      {/* POST-VERIFICATION WHATSAPP SEND RECEIPT MODAL (KHUSUS BENDAHARA) */}
      <PostVerifyWhatsAppModal
        isOpen={Boolean(postVerifyPayment)}
        payment={postVerifyPayment}
        targetMember={postVerifyPayment ? findMemberForPayment(postVerifyPayment, members) : undefined}
        settings={settings}
        onClose={() => setPostVerifyPayment(null)}
        onViewReceipt={onViewReceipt}
      />
    </div>
  );
};
