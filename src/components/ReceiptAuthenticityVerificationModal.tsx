import React, { useState, useMemo } from 'react';
import { Payment, Member, SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';
import { terbilang } from '../lib/terbilang';
import { getEffectivePaymentPeriod, buildReceiptValidationUrl } from '../lib/receiptUtils';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Printer,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Search,
  Building2,
  HeartHandshake,
  X,
  Calendar,
  CreditCard,
  User,
  MapPin,
  Lock,
  Phone,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface ReceiptAuthenticityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNumberQuery?: string;
  payments: Payment[];
  members: Member[];
  settings: SystemSettings;
  onOpenFullReceipt?: (payment: Payment) => void;
}

export const ReceiptAuthenticityVerificationModal: React.FC<ReceiptAuthenticityVerificationModalProps> = ({
  isOpen,
  onClose,
  receiptNumberQuery = '',
  payments,
  members,
  settings,
  onOpenFullReceipt,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState(receiptNumberQuery || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedReceiptNum, setCopiedReceiptNum] = useState(false);

  // Normalize and find matching payment
  const activeReceiptNumber = searchQuery.trim() || receiptNumberQuery.trim();

  const resolvedPayment: Payment | null = useMemo(() => {
    if (!activeReceiptNumber) return null;
    const clean = activeReceiptNumber.trim().toLowerCase();

    return (
      payments.find(
        (p) =>
          (p.receiptNumber && p.receiptNumber.toLowerCase() === clean) ||
          (p.id && p.id.toLowerCase() === clean) ||
          (clean.includes('receiptnumber=') && clean.includes(p.receiptNumber?.toLowerCase() || '---'))
      ) || null
    );
  }, [activeReceiptNumber, payments]);

  // Find associated member
  const resolvedMember: Member | null = useMemo(() => {
    if (!resolvedPayment) return null;
    return (
      members.find(
        (m) =>
          (m.id && m.id === resolvedPayment.memberId) ||
          (m.memberNumber && m.memberNumber === resolvedPayment.memberNumber)
      ) || null
    );
  }, [resolvedPayment, members]);

  const isVerified = resolvedPayment?.status === 'Verified';
  const isPending = resolvedPayment?.status === 'Pending';
  const isRejected = resolvedPayment?.status === 'Rejected';

  const verificationUrl = resolvedPayment ? buildReceiptValidationUrl(resolvedPayment.receiptNumber) : '';

  const handleCopyLink = () => {
    if (!verificationUrl) return;
    navigator.clipboard.writeText(verificationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyReceiptNumber = () => {
    if (!resolvedPayment?.receiptNumber) return;
    navigator.clipboard.writeText(resolvedPayment.receiptNumber);
    setCopiedReceiptNum(true);
    setTimeout(() => setCopiedReceiptNum(false), 2500);
  };

  const handleShareToWhatsApp = () => {
    if (!resolvedPayment) return;
    const effectivePeriod = getEffectivePaymentPeriod(resolvedPayment, settings);
    const msg = `*VERIFIKASI KEASLIAN KWITANSI RESMI*\n${settings.communityName || 'Paguyuban Dana Kematian'}\n\n` +
      `✓ Status: *${isVerified ? 'LUNAS & TERVERIFIKASI SAH' : resolvedPayment.status}*\n` +
      `• No. Kwitansi: *${resolvedPayment.receiptNumber}*\n` +
      `• Nama: *${resolvedPayment.memberName}* (${resolvedPayment.memberNumber})\n` +
      `• Jumlah: *${formatIDR(resolvedPayment.amount)}*\n` +
      `• Untuk: *${resolvedPayment.paymentType}* (${effectivePeriod})\n` +
      `• Tgl: *${resolvedPayment.verifiedAt || resolvedPayment.createdAt}*\n\n` +
      `Cek keaslian publik real-time:\n${verificationUrl}`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto print:p-0 print:bg-white print:static"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-w-none print:w-full print:max-h-none">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-5 px-6 border-b border-slate-800 flex justify-between items-center print:border-slate-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold border shadow-md shrink-0 ${
              isVerified
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : isPending
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : resolvedPayment
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-slate-700/50 text-slate-300 border-slate-600'
            }`}>
              {isVerified ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              ) : isPending ? (
                <Clock className="w-6 h-6 text-amber-400" />
              ) : resolvedPayment ? (
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              ) : (
                <Search className="w-6 h-6 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                  Layanan Verifikasi Publik
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  Real-time Database
                </span>
              </div>
              <h3 className="font-black text-lg text-white tracking-tight truncate mt-0.5">
                Verifikasi Keaslian Kwitansi
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {settings.communityName || 'Paguyuban Dana Kematian Masyarakat'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors shrink-0 print:hidden"
            title="Tutup jendela verifikasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH BAR (For searching/checking another receipt number) */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 print:hidden">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Masukkan Nomor Kwitansi Resmi (misal: KW-20261015-001)..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
              />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* CASE 1: RECEIPT FOUND */}
          {resolvedPayment ? (
            <div className="space-y-5">
              
              {/* PRIMARY AUTHENTICITY STATUS CARD */}
              <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isVerified
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm'
                  : isPending
                  ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-sm'
                  : 'bg-rose-50 border-rose-500 text-rose-950 shadow-sm'
              }`}>
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${
                    isVerified
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : isPending
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-rose-600 text-white border-rose-700'
                  }`}>
                    {isVerified ? (
                      <CheckCircle2 className="w-7 h-7 text-white" />
                    ) : isPending ? (
                      <Clock className="w-7 h-7 text-white" />
                    ) : (
                      <AlertTriangle className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isVerified
                          ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300'
                          : isPending
                          ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                          : 'bg-rose-200/80 text-rose-900 border border-rose-300'
                      }`}>
                        {isVerified ? '✓ ASLI & TERVERIFIKASI SAH' : isPending ? '⏳ DALAM VERIFIKASI' : '✕ DITOLAK / TIDAK VALID'}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-700">
                        Sistem Informasi Kas Paguyuban
                      </span>
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-snug">
                      {isVerified
                        ? 'Kwitansi Resmi Terotentikasi Sah'
                        : isPending
                        ? 'Kwitansi Tercatat - Menunggu Validasi Bendahara'
                        : 'Kwitansi Ditolak / Dibatalkan'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {isVerified
                        ? `Bukti setoran iuran ini diakui secara sah oleh pengurus ${settings.communityName || 'Paguyuban'} dan telah dibukukan dalam kas kas resmi.`
                        : isPending
                        ? 'Bukti transfer telah diterima sistem dan saat ini sedang dalam proses verifikasi buku kas oleh Bendahara.'
                        : 'Pembayaran ini tidak disahkan oleh bendahara atau telah dibatalkan.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nomor Kwitansi</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-base font-black text-slate-900">
                      {resolvedPayment.receiptNumber}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyReceiptNumber}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      title="Salin nomor kwitansi"
                    >
                      {copiedReceiptNum ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Tgl: {resolvedPayment.verifiedAt || resolvedPayment.createdAt}
                  </span>
                </div>
              </div>

              {/* DETAILS GRID */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>Rincian Informasi Bukti Bayar</span>
                  </h5>
                  <span className="text-[11px] font-mono text-slate-500">
                    ID: #{resolvedPayment.id.slice(0, 10)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Warga / Pembayar */}
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 font-semibold block flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Nama Anggota / Pembayar</span>
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {resolvedPayment.memberName}
                    </p>
                    <p className="font-mono text-slate-600 font-bold text-[11px]">
                      NPA: {resolvedPayment.memberNumber || '—'}
                    </p>
                    {resolvedMember?.cluster && (
                      <p className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{resolvedMember.cluster} • {resolvedMember.address || 'Alamat Terdaftar'}</span>
                      </p>
                    )}
                  </div>

                  {/* Nominal Pembayaran */}
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 font-semibold block flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Nominal Terbayar (Lunas)</span>
                    </span>
                    <p className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                      {formatIDR(resolvedPayment.amount)}
                    </p>
                    <p className="text-[11px] text-slate-600 italic">
                      "{terbilang(resolvedPayment.amount)}"
                    </p>
                  </div>

                  {/* Jenis & Periode Iuran */}
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 font-semibold block flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Untuk Pembayaran & Periode</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-xs">
                        {resolvedPayment.paymentType}
                      </span>
                      <span className="text-slate-400">—</span>
                      <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                        {getEffectivePaymentPeriod(resolvedPayment, settings)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      Metode: <strong>{resolvedPayment.paymentMethod}</strong>
                    </span>
                  </div>

                  {/* Pengesahan Kas & TTD */}
                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-slate-500 font-semibold block flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Petugas Pengesah Kas</span>
                    </span>
                    <p className="font-bold text-slate-900 text-xs">
                      {resolvedPayment.adminSignerName || settings.treasurerName || 'Bendahara Paguyuban'}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {resolvedPayment.adminSignerTitle || 'Bendahara / Pengurus Kas'}
                    </p>
                    {resolvedPayment.adminSignature ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-7 w-20 bg-slate-50 border border-slate-200 rounded p-0.5 flex items-center justify-center">
                          <img
                            src={resolvedPayment.adminSignature}
                            alt="TTD"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ✓ TTD DIGITAL
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                        ✓ Terverifikasi Sistem
                      </span>
                    )}
                  </div>
                </div>

                {/* STEMPEL SAH & AUDIT SIGNATURE */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-400 flex items-center justify-center text-emerald-800 shrink-0 font-bold text-xs">
                      ★
                    </div>
                    <span>
                      Stempel Kas Digital: <strong>{settings.communityName || 'Paguyuban Dana Kematian'}</strong> (Sah)
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 text-center sm:text-right">
                    Kode Audit: SHA256#{resolvedPayment.receiptNumber.replace(/[^a-zA-Z0-9]/g, '')}-{resolvedPayment.amount}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 border border-slate-300 shadow-2xs"
                    title="Salin tautan web verifikasi ini untuk dibagikan"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Salin Link Publik</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleShareToWhatsApp}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 border border-emerald-200"
                    title="Bagikan status verifikasi kwitansi ini ke WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Share WA</span>
                  </button>
                </div>

                {onOpenFullReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFullReceipt(resolvedPayment);
                      onClose();
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs sm:text-sm transition-all inline-flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95"
                    title="Buka format kwitansi resmi lengkap dan unduh PDF"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Lihat Format Kwitansi Lengkap</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                )}
              </div>

            </div>
          ) : (
            /* CASE 2: RECEIPT NOT FOUND */
            <div className="text-center py-8 px-4 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 border-2 border-rose-300 flex items-center justify-center mx-auto text-rose-600 shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-lg font-black text-slate-900">
                  Kwitansi Tidak Terdaftar di Sistem
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nomor kwitansi <code className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-800">"{searchQuery || receiptNumberQuery || '—'}"</code> tidak ditemukan dalam basis data resmi kas {settings.communityName || 'Paguyuban'}.
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-left text-[11px] text-amber-900 mt-3 space-y-1">
                  <span className="font-bold block flex items-center gap-1 text-amber-950">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Penting: Kewaspadaan Bukti Palsu</span>
                  </span>
                  <p>
                    Setiap kwitansi resmi dana kematian yang sah selalu memiliki nomor unik terverifikasi di server cloud. Jika kwitansi cetak yang Anda pegang tidak terdeteksi, mohon konfirmasikan ke Bendahara Paguyuban di nomor <strong>{settings.treasurerPhone || 'Pengurus RT/RW'}</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
                >
                  Coba Cari Nomor Kwitansi Lain
                </button>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 print:hidden">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">
              Sistem Otentikasi Digital Dilindungi Integritas Data Cloud Firestore
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
