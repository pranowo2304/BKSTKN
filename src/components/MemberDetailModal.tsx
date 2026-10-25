import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Member, Payment, BenefitClaim, SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload, generateKtaSecurityToken } from '../lib/ktaUtils';
import {
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  Users,
  CreditCard,
  HeartHandshake,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  FileText,
  DollarSign,
  ShieldCheck,
  AlertCircle,
  Plus,
  ChevronRight,
  ExternalLink,
  Printer,
  Home,
  QrCode,
  RotateCw,
  Share2,
  Check,
  Lock,
  Eye,
  Download
} from 'lucide-react';
import { FamilyCardModal } from './FamilyCardModal';
import { MemberStatusTimeline } from './MemberStatusTimeline';
import { MemberKtaQrGeneratorModal } from './MemberKtaQrGeneratorModal';

interface MemberDetailModalProps {
  member: Member | null;
  payments: Payment[];
  claims: BenefitClaim[];
  settings?: SystemSettings;
  onClose: () => void;
  onViewReceipt?: (payment: Payment) => void;
  onSelectMemberForPayment?: (member: Member) => void;
  onOpenFullKtaModal?: (member: Member) => void;
  onOpenPrintCardModal?: (member: Member) => void;
  onOpenPreviewKtaModal?: (member: Member) => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  member,
  payments,
  claims,
  settings,
  onClose,
  onViewReceipt,
  onSelectMemberForPayment,
  onOpenFullKtaModal,
  onOpenPrintCardModal,
  onOpenPreviewKtaModal,
}) => {
  if (!member) return null;

  const [activeTab, setActiveTab] = useState<'kta' | 'payments' | 'claims' | 'profile' | 'timeline'>('kta');
  const [isKtaFlipped, setIsKtaFlipped] = useState(false);
  const [copiedKta, setCopiedKta] = useState(false);
  const [isKkViewerOpen, setIsKkViewerOpen] = useState(false);
  const [isQrGeneratorModalOpen, setIsQrGeneratorModalOpen] = useState(false);

  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian Warga';
  const securityToken = generateKtaSecurityToken(member, ktaInfo);

  // Unique QR Code payload for KTA verification
  const qrPayload = generateKtaQrPayload(
    member,
    ktaInfo,
    settings || { communityName },
    expiry.expiryDateFormatted,
    'url'
  );

  // Filter payments for this specific member
  const memberPayments = payments.filter(
    (p) => p.memberId === member.id || p.memberNumber === member.memberNumber
  );

  // Filter claims for this specific member
  const memberClaims = claims.filter(
    (c) => c.memberId === member.id || c.memberNumber === member.memberNumber
  );

  // Payment Stats
  const totalPaidVerified = memberPayments
    .filter((p) => p.status === 'Verified')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingPaymentsCount = memberPayments.filter((p) => p.status === 'Pending').length;
  const verifiedPaymentsCount = memberPayments.filter((p) => p.status === 'Verified').length;

  const lastVerifiedPayment = memberPayments
    .filter((p) => p.status === 'Verified')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Current Month Payment Status Calculation (Agustus 2026)
  const currentMonthName = 'Agustus 2026';
  
  // Check if member has paid annual dues for 2026 or valid rollover
  const hasVerifiedAnnual2026 = memberPayments.some((p) => {
    if (p.status !== 'Verified') return false;
    const period = (p.periodMonth || '').toLowerCase();
    const type = (p.paymentType || '').toLowerCase();
    return (
      type.includes('tahunan') ||
      period.includes('tahun 2026') ||
      period.includes('2025/2026') ||
      p.periodYear === '2026'
    );
  });

  const hasPendingAnnual2026 = memberPayments.some((p) => {
    if (p.status !== 'Pending') return false;
    const period = (p.periodMonth || '').toLowerCase();
    const type = (p.paymentType || '').toLowerCase();
    return (
      type.includes('tahunan') ||
      period.includes('tahun 2026') ||
      p.periodYear === '2026'
    );
  });

  const currentMonthPayment = memberPayments.find((p) => {
    return (
      (p.periodMonth && p.periodMonth.toLowerCase() === currentMonthName.toLowerCase()) ||
      (p.createdAt && p.createdAt.startsWith('2026-08'))
    );
  });

  const isCurrentMonthVerified = hasVerifiedAnnual2026 || currentMonthPayment?.status === 'Verified';
  const isCurrentMonthPending = !isCurrentMonthVerified && (hasPendingAnnual2026 || currentMonthPayment?.status === 'Pending');
  const isCurrentMonthUnpaid = !isCurrentMonthVerified && !isCurrentMonthPending;

  // 2026 Months Tracking (Jan - Aug)
  const months2026 = [
    { key: 'Januari 2026', short: 'Jan', monthNum: '01' },
    { key: 'Februari 2026', short: 'Feb', monthNum: '02' },
    { key: 'Maret 2026', short: 'Mar', monthNum: '03' },
    { key: 'April 2026', short: 'Apr', monthNum: '04' },
    { key: 'Mei 2026', short: 'Mei', monthNum: '05' },
    { key: 'Juni 2026', short: 'Jun', monthNum: '06' },
    { key: 'Juli 2026', short: 'Jul', monthNum: '07' },
    { key: 'Agustus 2026', short: 'Agu (Bulan Ini)', monthNum: '08' },
  ];

  const monthStatusList = months2026.map((m) => {
    const paymentForMonth = memberPayments.find((p) => 
      (p.periodMonth && p.periodMonth.toLowerCase() === m.key.toLowerCase()) ||
      (p.createdAt && p.createdAt.startsWith(`2026-${m.monthNum}`))
    );

    let status = paymentForMonth ? paymentForMonth.status : 'Unpaid';
    let amount = paymentForMonth?.amount;

    if (status === 'Unpaid' && hasVerifiedAnnual2026) {
      status = 'Verified';
      amount = settings.monthlyFeeAmount || 25000;
    } else if (status === 'Unpaid' && hasPendingAnnual2026) {
      status = 'Pending';
      amount = settings.monthlyFeeAmount || 25000;
    }

    return {
      ...m,
      status,
      amount,
    };
  });

  const paidMonthsCount = monthStatusList.filter((m) => m.status === 'Verified').length;
  const progressPercentage = Math.round((paidMonthsCount / months2026.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-2xl font-mono shrink-0 shadow-inner overflow-hidden">
              {member.photoUrl ? (
                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                member.name.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white">{member.name}</h2>
                {member.cluster && (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                    <Home className="w-3 h-3 text-emerald-400" />
                    <span>{member.cluster}</span>
                  </span>
                )}
                {member.status === 'Aktif' || member.verificationStatus === 'Verified' ? (
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span>Aktif (Disetujui RT)</span>
                  </span>
                ) : member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending' ? (
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1 animate-pulse">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Menunggu Verifikasi RT</span>
                  </span>
                ) : member.status === 'Ditolak' || member.verificationStatus === 'Rejected' ? (
                  <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase tracking-wider rounded-full">
                    Ditolak RT
                  </span>
                ) : member.status === 'Meninggal' ? (
                  <span className="px-2.5 py-0.5 bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-extrabold uppercase tracking-wider rounded-full">
                    Meninggal
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-extrabold uppercase tracking-wider rounded-full">
                    Non-Aktif
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                <span>No. Anggota: <strong className="text-emerald-400">{member.memberNumber}</strong></span>
                <span>•</span>
                <span>NIK: {member.nik}</span>
              </div>
            </div>
          </div>

          {/* Quick Action in Header */}
          {onSelectMemberForPayment && member.status === 'Aktif' && (
            <button
              onClick={() => {
                onClose();
                onSelectMemberForPayment(member);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Bayar Iuran Anggota Ini</span>
            </button>
          )}
        </div>

        {/* SUB NAVIGATION TABS */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 pt-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('kta')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'kta'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>KTA & QR Code Resmi</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Pembayaran Iuran ({memberPayments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('claims')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'claims'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <HeartHandshake className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Klaim Manfaat Duka ({memberClaims.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <User className="w-4 h-4 text-emerald-600" />
            <span>Biodata & Tanggungan ({member.dependentsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-white text-indigo-800 border-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Timeline Audit Status</span>
          </button>
        </div>

        {/* MODAL CONTENT BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">

          {/* VISUAL PAYMENT STATUS INDICATOR & PROGRESS BAR (CURRENT MONTH & YTD 2026) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  isCurrentMonthVerified 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : isCurrentMonthPending 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-rose-100 text-rose-700'
                }`}>
                  {isCurrentMonthVerified ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : isCurrentMonthPending ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Status Iuran Periode {currentMonthName}
                    </h3>
                    {isCurrentMonthVerified ? (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase rounded-full inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Lunas (Up-to-Date)</span>
                      </span>
                    ) : isCurrentMonthPending ? (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase rounded-full inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Menunggu Verifikasi Admin</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase rounded-full inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>Belum Bayar (Menunggak)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isCurrentMonthVerified
                      ? `Iuran wajib bulan ${currentMonthName} telah terlunasi secara resmi dengan kwitansi terverifikasi.`
                      : isCurrentMonthPending
                      ? `Bukti transfer sedang dalam antrean peninjauan dan verifikasi bendahara.`
                      : `Anggota belum melunasi iuran wajib gotong royong bulan ${currentMonthName}.`}
                  </p>
                </div>
              </div>

              {/* Action Button if Unpaid */}
              {isCurrentMonthUnpaid && onSelectMemberForPayment && member.status === 'Aktif' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectMemberForPayment(member);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 transition-all inline-flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Bayar Bulan Ini Sekarang</span>
                </button>
              )}
            </div>

            {/* VISUAL PROGRESS BAR & MONTHS BREAKDOWN */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">
                  Kelancaran Iuran Tahun 2026: <strong className="text-emerald-700">{paidMonthsCount}</strong> dari {months2026.length} Bulan Terbayar
                </span>
                <span className="font-mono font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {progressPercentage}% Lunas
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressPercentage === 100
                      ? 'bg-emerald-500'
                      : progressPercentage >= 75
                      ? 'bg-teal-500'
                      : progressPercentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Month-by-Month Status Badges */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-2">
                {monthStatusList.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl text-center border transition-all ${
                      item.status === 'Verified'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : item.status === 'Pending'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider truncate">{item.short}</p>
                    <div className="mt-1 flex items-center justify-center">
                      {item.status === 'Verified' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      ) : item.status === 'Pending' ? (
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* TAB: KTA & QR CODE RESMI */}
          {activeTab === 'kta' && (
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base sm:text-lg font-black text-white">Kartu Tanda Anggota (KTA) Digital</h3>
                      {ktaInfo.isIssued ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold rounded-full">
                          Sah & Terbit
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>{ktaInfo.statusBadge}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ktaInfo.isIssued 
                        ? 'KTA resmi dengan QR Code verifikasi real-time untuk pemulasaraan & ambulans jenazah'
                        : ktaInfo.statusDescription}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsKtaFlipped(!isKtaFlipped)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>{isKtaFlipped ? 'Lihat Depan' : 'Lihat Belakang'}</span>
                    </button>

                    {onOpenPreviewKtaModal && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenPreviewKtaModal(member);
                        }}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95"
                        title="Pratinjau KTA Registrasi (Siap cetak berkas verifikasi)"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Preview KTA</span>
                      </button>
                    )}

                    {onOpenPrintCardModal && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenPrintCardModal(member);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                        title="Buka format kartu presisi siap cetak & potong"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-950" />
                        <span>Cetak Kartu Fisik</span>
                      </button>
                    )}

                    {onOpenFullKtaModal && (
                      <button
                        type="button"
                        onClick={() => onOpenFullKtaModal(member)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Status / Verifikasi</span>
                      </button>
                    )}
                  </div>
                </div>

                {!ktaInfo.isIssued && (
                  <div className="mb-4 p-3.5 bg-amber-950/60 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3 text-amber-200 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-extrabold text-amber-300">{ktaInfo.statusTitle}</p>
                        <p className="text-[11px] text-amber-200/80">{ktaInfo.statusDescription}</p>
                      </div>
                    </div>
                    {onSelectMemberForPayment && (member.status !== 'Menunggu Verifikasi RT' && member.verificationStatus !== 'Pending') && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectMemberForPayment(member);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shrink-0 cursor-pointer"
                      >
                        Proses Iuran
                      </button>
                    )}
                  </div>
                )}

                {/* THE KTA CARD */}
                <div className="flex justify-center my-2">
                  <div className="w-full max-w-[460px]">
                    {!isKtaFlipped ? (
                      /* FRONT SIDE */
                      <div className="w-full aspect-[1.586/1] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/40 shadow-2xl relative overflow-hidden flex flex-col justify-between select-none">
                        <div className="flex items-start justify-between relative z-10 border-b border-emerald-900/80 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
                              <HeartHandshake className="w-5 h-5 text-slate-950" />
                            </div>
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 block">
                                KTA DIGITAL RESMI
                              </span>
                              <h4 className="font-black text-xs text-white leading-tight">{communityName}</h4>
                              <p className="text-[8px] text-slate-300">{member.cluster || 'Cluster'}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold rounded border border-emerald-500/40">
                            {member.memberNumber}
                          </span>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-center my-auto py-1 relative z-10">
                          <div className="col-span-8 space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-11 h-11 rounded-xl bg-emerald-900/60 border border-emerald-500/50 text-white font-black text-sm flex items-center justify-center font-mono shrink-0 overflow-hidden">
                                {member.photoUrl ? (
                                  <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                                ) : (
                                  member.name.substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] text-slate-400">Nama Anggota:</p>
                                <h3 className="font-black text-xs sm:text-sm text-white truncate leading-tight">{member.name}</h3>
                                <p className="text-[9px] font-mono text-slate-300 truncate">NIK: {member.nik}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] font-mono text-emerald-300 bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                              <span>Masa Iuran: {expiry.expiryDateFormatted}</span>
                              <span>•</span>
                              <span>{member.dependentsCount + 1} Jiwa Dilindungi</span>
                            </div>
                          </div>

                          <div className="col-span-4 flex flex-col items-center justify-center">
                            <div className="p-1.5 bg-white rounded-lg shadow border border-emerald-400">
                              <QRCodeSVG
                                value={qrPayload}
                                size={70}
                                level="M"
                                includeMargin={false}
                                bgColor="#FFFFFF"
                                fgColor="#022c22"
                              />
                            </div>
                            <span className="text-[7px] font-mono text-emerald-400 mt-1 uppercase font-bold">
                              Scan QR Verifikasi
                            </span>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-emerald-900/80 flex items-center justify-between text-[8px] relative z-10 text-slate-400">
                          <span>Status: <strong className="text-emerald-400 font-bold">{member.status}</strong></span>
                          <span>{member.verifiedByRt || `Disetujui RT ${member.cluster || ''}`}</span>
                        </div>
                      </div>
                    ) : (
                      /* BACK SIDE */
                      <div className="w-full aspect-[1.586/1] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border-2 border-slate-700 shadow-2xl relative overflow-hidden flex flex-col justify-between select-none">
                        <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
                          <h4 className="font-bold text-[10px] text-emerald-400 uppercase">KETENTUAN HAK ANGGOTA</h4>
                          <span className="font-mono text-[9px] text-slate-400">{member.memberNumber}</span>
                        </div>

                        <div className="text-[9px] text-slate-300 space-y-1 my-auto">
                          <p>1. Perlindungan fardhu kifayah jenazah & kain kafan.</p>
                          <p>2. Pelayanan mobil jenazah / ambulans 24 Jam.</p>
                          <p>3. Santunan dana duka ahli waris.</p>
                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800 text-[8px]">
                            <span className="text-emerald-400 font-bold">Tanggungan ({member.dependentsCount} Jiwa): </span>
                            <span>{member.dependentsList?.map(d => `${d.name} (${d.relationship})`).join(', ') || 'Belum ada tanggungan tambahan'}</span>
                          </div>
                        </div>

                        <div className="pt-1.5 border-t border-slate-800 flex justify-between items-end text-[8px] text-slate-400">
                          <span>Kontak Kas: {settings?.treasurerPhone || '081234567890'}</span>
                          <span className="text-emerald-400 font-bold">✓ Terverifikasi Pengurus</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Share Actions */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsQrGeneratorModalOpen(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-105 active:scale-95"
                    title="Buka Generator QR Code KTA Warga Berdasarkan NPA"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generator QR NPA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = `*KTA RESMI ${communityName}*\nNama: ${member.name}\nNPA: ${member.memberNumber}\nNIK: ${member.nik}\nCluster: ${member.cluster}\nStatus: ${member.status} (${expiry.statusLabel})\nBerlaku: ${expiry.expiryDateFormatted}\nTanggungan: ${member.dependentsCount} Jiwa`;
                      navigator.clipboard.writeText(text);
                      setCopiedKta(true);
                      setTimeout(() => setCopiedKta(false), 2000);
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    {copiedKta ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedKta ? 'Tersalin!' : 'Salin Data KTA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cleanPhone = (member.phone || '').replace(/[^0-9]/g, '');
                      const intl = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone.startsWith('62') ? cleanPhone : '62' + cleanPhone;
                      const msg = encodeURIComponent(`Halo ${member.name}, berikut data KTA Digital Anda:\nNPA: ${member.memberNumber}\nStatus: ${member.status}\nMasa Berlaku: ${expiry.expiryDateFormatted}\nQR Code resmi tercatat aktif.`);
                      window.open(`https://wa.me/${intl}?text=${msg}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Kirim KTA via WA</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: PAYMENTS HISTORY */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Payment Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Total Iuran Disetujui</p>
                  <p className="text-xl font-black font-mono text-emerald-700 mt-1">{formatIDR(totalPaidVerified)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{verifiedPaymentsCount} kali transaksi terverifikasi</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Pembayaran Terakhir</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {lastVerifiedPayment ? lastVerifiedPayment.periodMonth : 'Belum pernah'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lastVerifiedPayment ? `Tgl: ${lastVerifiedPayment.createdAt}` : '-'}
                  </p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Pending Validasi</p>
                  <p className={`text-xl font-black font-mono mt-1 ${pendingPaymentsCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {pendingPaymentsCount} Transaksi
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {pendingPaymentsCount > 0 ? 'Menunggu peninjauan admin' : 'Tidak ada tunggakan verifikasi'}
                  </p>
                </div>
              </div>

              {/* Payments List Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>Daftar Transaksi Pembayaran ({memberPayments.length})</span>
                  </h3>
                </div>

                {memberPayments.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-semibold">Belum ada riwayat pembayaran iuran untuk anggota ini.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">No. Kwitansi</th>
                          <th className="py-3 px-4">Jenis Iuran</th>
                          <th className="py-3 px-4">Periode</th>
                          <th className="py-3 px-4">Nominal</th>
                          <th className="py-3 px-4">Metode</th>
                          <th className="py-3 px-4">Tanggal</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {memberPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {payment.receiptNumber}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">
                              {payment.paymentType}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {payment.periodMonth || '-'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900 whitespace-nowrap">
                              {formatIDR(payment.amount)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                              {payment.paymentMethod}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {payment.createdAt}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {payment.status === 'Verified' ? (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>Lunas / Disetujui</span>
                                </span>
                              ) : payment.status === 'Pending' ? (
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending Admin</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Ditolak</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {payment.status === 'Verified' && onViewReceipt && (
                                <button
                                  onClick={() => onViewReceipt(payment)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                                >
                                  <FileText className="w-3 h-3 text-emerald-400" />
                                  <span>Cetak Kwitansi</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CLAIMS HISTORY */}
          {activeTab === 'claims' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-emerald-400" />
                    <span>Riwayat Realisasi Manfaat Dana Duka ({memberClaims.length})</span>
                  </h3>
                </div>

                {memberClaims.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500/40" />
                    <p className="text-sm font-bold text-slate-800">Belum Ada Pengajuan / Klaim Duka</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Anggota ini dan keluarganya belum pernah mengajukan atau menerima santunan manfaat kematian dari kas paguyuban.
                    </p>
                  </div>
                ) : (
                  <div className="p-5 space-y-4">
                    {memberClaims.map((claim) => (
                      <div key={claim.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-500">{claim.claimNumber}</span>
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-extrabold text-[10px] rounded-full">
                                {claim.relationship}
                              </span>
                            </div>
                            <h4 className="font-black text-slate-900 text-base mt-1">
                              Alm / Almh. {claim.deceasedName}
                            </h4>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-[11px] text-slate-500">Total Manfaat Disalurkan</p>
                            <p className="text-lg font-black font-mono text-emerald-700">{formatIDR(claim.totalAmount)}</p>
                          </div>
                        </div>

                        {/* Claim Metadata */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 font-medium">
                          <div>
                            <span className="text-slate-400 text-[11px] block">Tanggal Meninggal Dunia:</span>
                            <span className="font-mono text-slate-900 font-bold">{claim.dateOfDeath}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px] block">Sebab Meninggal Dunia:</span>
                            <span>{claim.causeOfDeath || 'Sakit / Usia Lanjut'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px] block">Diproses Oleh Admin:</span>
                            <span className="font-semibold text-slate-800">{claim.processedBy}</span>
                          </div>
                        </div>

                        {/* Expense Breakdown */}
                        {claim.expenseDetails && claim.expenseDetails.length > 0 && (
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Rincian Penggunaan Santunan & Fasilitas Duka:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {claim.expenseDetails.map((exp) => (
                                <div key={exp.id} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                                  <span className="text-slate-700">{exp.description}</span>
                                  <span className="font-mono font-bold text-slate-900">{formatIDR(exp.cost)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {claim.notes && (
                          <p className="text-xs text-slate-500 italic bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                            Catatan: "{claim.notes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BIODATA & DEPENDENTS */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Personal Details */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span>Informasi Pribadi Kependudukan</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium">Nama Lengkap</p>
                    <p className="font-extrabold text-slate-900 text-sm mt-0.5">{member.name}</p>
                  </div>

                  <div>
                    <p className="text-slate-400 font-medium">Nomor Induk Kependudukan (NIK)</p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{member.nik}</p>
                  </div>

                  <div>
                    <p className="text-slate-400 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> No. Telepon / WhatsApp
                    </p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{member.phone}</p>
                  </div>

                  <div>
                    <p className="text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Tanggal Bergabung
                    </p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{member.joinDate}</p>
                  </div>

                  <div>
                    <p className="text-slate-400 font-medium flex items-center gap-1">
                      <Home className="w-3 h-3" /> Cluster Wilayah
                    </p>
                    <p className="font-bold text-emerald-800 text-sm mt-0.5">{member.cluster || '-'}</p>
                  </div>

                  <div>
                    <p className="text-slate-400 font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Detail Alamat / Blok & No.
                    </p>
                    <p className="font-semibold text-slate-800 mt-0.5">{member.address}</p>
                  </div>

                  {member.notes && (
                    <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-slate-400 font-medium text-[11px]">Catatan Khusus Admin:</p>
                      <p className="text-slate-700 mt-0.5">{member.notes}</p>
                    </div>
                  )}

                  {/* Status Verifikasi RT / Cluster */}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <p className="text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-2">
                      Status Verifikasi Ketua RT / Cluster:
                    </p>
                    {member.status === 'Aktif' || member.verificationStatus === 'Verified' ? (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Pendaftaran Telah Disetujui Ketua RT</p>
                          <p className="text-[11px] text-emerald-800 mt-0.5">
                            Diverifikasi oleh: <strong>{member.verifiedByRt || `Ketua RT ${member.cluster || 'Cluster'}`}</strong>
                            {member.verifiedAt && ` • ${member.verifiedAt}`}
                          </p>
                          {member.rtNotes && (
                            <p className="text-[11px] text-emerald-700 italic mt-1">"{member.rtNotes}"</p>
                          )}
                        </div>
                      </div>
                    ) : member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending' ? (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Menunggu Verifikasi Ketua RT ({member.cluster || 'Cluster'})</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Calon anggota belum dapat melakukan pembayaran iuran kas kematian sebelum diverifikasi dan disetujui oleh Ketua RT di cluster domisili.
                          </p>
                        </div>
                      </div>
                    ) : member.status === 'Ditolak' || member.verificationStatus === 'Rejected' ? (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 flex items-start gap-2.5">
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Pendaftaran Ditolak oleh Ketua RT</p>
                          <p className="text-[11px] text-rose-800 mt-0.5">
                            Alasan: "{member.rejectionReason || 'Data domisili/NIK tidak valid'}"
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Dependents (Tanggungan Keluarga) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Tanggungan Keluarga Dilindungi ({member.dependentsCount} Jiwa)</span>
                  </h3>
                </div>

                {!member.dependentsList || member.dependentsList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Tidak ada data tanggungan terdaftar.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {member.dependentsList.map((dep, idx) => (
                      <div key={dep.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center">
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{dep.name}</p>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            Hubungan: <span className="text-emerald-700 font-bold">{dep.relationship}</span>
                          </p>
                        </div>
                        {dep.age && (
                          <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-mono text-[11px] font-bold rounded-lg shadow-sm">
                            {dep.age} Th
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DOKUMEN LAMPIRAN KARTU KELUARGA (KK) */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Dokumen Lampiran Kartu Keluarga (KK)</span>
                  </h3>
                  {member.familyCardPhotoUrl ? (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Terlampir Resmi</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Belum Ada Lampiran</span>
                    </span>
                  )}
                </div>

                {member.familyCardPhotoUrl ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        onClick={() => setIsKkViewerOpen(true)}
                        className="w-20 h-16 rounded-xl overflow-hidden border border-emerald-300 shadow-sm bg-white shrink-0 cursor-pointer group relative"
                        title="Klik untuk melihat foto KK penuh & perbesar"
                      >
                        <img
                          src={member.familyCardPhotoUrl}
                          alt={`KK ${member.name}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-extrabold text-slate-900">
                          {member.familyCardFileName || `Kartu_Keluarga_${member.name.replace(/\s+/g, '_')}.jpg`}
                        </p>
                        {member.familyCardNumber && (
                          <p className="text-[11px] font-mono text-emerald-800 font-bold">
                            No. KK: {member.familyCardNumber}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500">
                          Dokumen keabsahan keluarga untuk pertanggungan santunan kematian.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setIsKkViewerOpen(true)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-colors shadow-sm inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat & Perbesar</span>
                      </button>

                      <a
                        href={member.familyCardPhotoUrl}
                        download={member.familyCardFileName || `KK_${member.name.replace(/\s+/g, '_')}.jpg`}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800">Foto Kartu Keluarga belum diunggah</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Anggota ini belum melampirkan berkas foto Kartu Keluarga. Pengurus dapat memperbarui dokumen ini melalui menu Edit Biodata & Keluarga.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: TIMELINE AUDIT STATUS */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <MemberStatusTimeline
                member={member}
                payments={payments}
                isCollapsible={false}
                defaultExpanded={true}
                onNavigateToPayment={onSelectMemberForPayment ? () => {
                  onClose();
                  onSelectMemberForPayment(member);
                } : undefined}
              />
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex justify-between items-center text-xs">
          <p className="text-slate-500 font-mono text-[11px]">
            Profil Anggota • ID: {member.id}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            Tutup Profil
          </button>
        </div>

        {/* FAMILY CARD FULL VIEW MODAL */}
        {member.familyCardPhotoUrl && (
          <FamilyCardModal
            isOpen={isKkViewerOpen}
            onClose={() => setIsKkViewerOpen(false)}
            photoUrl={member.familyCardPhotoUrl}
            memberName={member.name}
            kkNumber={member.familyCardNumber}
            cluster={member.cluster}
            fileName={member.familyCardFileName}
          />
        )}

        {/* MEMBER KTA QR CODE GENERATOR MODAL */}
        {isQrGeneratorModalOpen && member && (
          <MemberKtaQrGeneratorModal
            isOpen={isQrGeneratorModalOpen}
            onClose={() => setIsQrGeneratorModalOpen(false)}
            member={member}
            settings={settings}
            payments={payments}
          />
        )}

      </div>
    </div>
  );
};
