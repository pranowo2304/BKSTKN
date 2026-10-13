import React, { useState } from 'react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaSecurityToken } from '../lib/ktaUtils';
import { formatIDR } from '../lib/storage';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  HeartHandshake,
  Calendar,
  Home,
  UserCheck,
  CreditCard,
  Printer,
  Share2,
  Phone,
  ExternalLink,
  QrCode,
  X,
  Lock,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  Ambulance,
  FileCheck,
} from 'lucide-react';

interface KtaAuthenticityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  npaQuery?: string;
  securityToken?: string;
  member?: Member | null;
  members: Member[];
  payments: Payment[];
  settings: SystemSettings;
  onOpenScanner?: () => void;
  onOpenFullKtaModal?: (member: Member) => void;
}

export const KtaAuthenticityVerificationModal: React.FC<KtaAuthenticityVerificationModalProps> = ({
  isOpen,
  onClose,
  npaQuery,
  securityToken,
  member: directMember,
  members,
  payments,
  settings,
  onOpenScanner,
  onOpenFullKtaModal,
}) => {
  if (!isOpen) return null;

  const [showFullNik, setShowFullNik] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Resolve target member
  const resolvedMember: Member | null = React.useMemo(() => {
    if (directMember) return directMember;
    if (!npaQuery) return null;

    const query = npaQuery.trim().toLowerCase();
    return (
      members.find(
        (m) =>
          (m.memberNumber && m.memberNumber.toLowerCase() === query) ||
          (m.id && m.id.toLowerCase() === query) ||
          (m.nik && m.nik === query) ||
          (m.name && m.name.toLowerCase() === query)
      ) || null
    );
  }, [directMember, npaQuery, members]);

  const communityName = settings?.communityName || 'Paguyuban Dana Kematian Warga';
  const communityAddress = settings?.communityAddress || 'Sekretariat Paguyuban Rukun Warga';
  const hotlinePhone = settings?.treasurerPhone || '0812-3456-7890';

  const ktaInfo = resolvedMember ? getMemberKtaIssuanceInfo(resolvedMember, payments) : null;
  const expiry = resolvedMember ? calculateMemberExpiry(resolvedMember, payments, new Date(), settings) : null;
  const token = resolvedMember
    ? securityToken || generateKtaSecurityToken(resolvedMember, ktaInfo || undefined)
    : null;

  // Masked NIK for public privacy
  const formatMaskedNik = (nik?: string) => {
    if (!nik) return '-';
    if (showFullNik) return nik;
    if (nik.length < 8) return nik;
    const start = nik.slice(0, 6);
    const end = nik.slice(-4);
    return `${start}******${end}`;
  };

  const handleCopyVerificationUrl = () => {
    if (!resolvedMember) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const url = `${origin}${path}?verify=kta&npa=${encodeURIComponent(resolvedMember.memberNumber)}&sig=${encodeURIComponent(token || '')}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintVerificationCertificate = () => {
    window.print();
  };

  const isAuthenticAndValid = Boolean(
    resolvedMember &&
    ktaInfo?.isIssued &&
    resolvedMember.status === 'Aktif' &&
    expiry &&
    !expiry.isExpired
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-900 text-white rounded-3xl border border-slate-700/80 shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-w-none print:w-full print:bg-white print:text-slate-900 print:max-h-none">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-950 p-5 px-6 border-b border-slate-800 flex justify-between items-center print:border-slate-300">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold border shadow-md ${
              isAuthenticAndValid
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : resolvedMember
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}>
              {isAuthenticAndValid ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              ) : resolvedMember ? (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  SISTEM VERIFIKASI KEASLIAN RESMI
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  QR Real-Time
                </span>
              </div>
              <h3 className="font-black text-base sm:text-lg text-white print:text-slate-900">
                Verifikasi Keaslian KTA Warga
              </h3>
              <p className="text-xs text-slate-400 print:text-slate-600">
                {communityName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors print:hidden"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 print:bg-white print:text-slate-900 print:p-0">
          
          {/* 1. STATUS BANNER */}
          {resolvedMember ? (
            isAuthenticAndValid ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-slate-900 border-2 border-emerald-500/60 shadow-lg flex items-start gap-3.5 print:bg-emerald-50 print:border-emerald-600">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-black text-[10px] tracking-wider uppercase">
                      TERVERIFIKASI ASLI & SAH
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">
                      Aktif Penuh
                    </span>
                  </div>
                  <h4 className="font-black text-sm sm:text-base text-white print:text-slate-900 mt-0.5">
                    KTA Resmi Terdaftar & Dilindungi Penuh
                  </h4>
                  <p className="text-xs text-emerald-200/90 print:text-emerald-900 mt-1 leading-relaxed">
                    Kartu Tanda Anggota ini sah dan terdaftar resmi di database Paguyuban. Berhak menerima layanan mobil jenazah 24 jam, pemulasaraan fardhu kifayah, dan santunan duka cita.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-slate-900 border-2 border-amber-500/60 shadow-lg flex items-start gap-3.5 print:bg-amber-50 print:border-amber-600">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                  <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase">
                      STATUS: {ktaInfo?.statusBadge || 'TAHAP VERIFIKASI'}
                    </span>
                  </div>
                  <h4 className="font-black text-sm sm:text-base text-white print:text-slate-900 mt-0.5">
                    {ktaInfo?.statusTitle || 'KTA Belum Resmi Terbit'}
                  </h4>
                  <p className="text-xs text-amber-200/90 print:text-amber-900 mt-1 leading-relaxed">
                    {ktaInfo?.statusDescription || 'Data anggota ditemukan, namun KTA belum menyelesaikan seluruh alur verifikasi resmi (Persetujuan RT, Pembayaran Iuran, atau Pengesahan Ketua Paguyuban).'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="p-5 rounded-2xl bg-rose-950/60 border-2 border-rose-500/60 shadow-lg flex items-start gap-3.5 text-center flex-col sm:flex-row sm:text-left print:bg-rose-50 print:border-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 mx-auto sm:mx-0 shadow-md">
                <XCircle className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded bg-rose-500 text-white font-black text-[10px] tracking-wider uppercase inline-block">
                  KTA TIDAK TERDAFTAR / TIDAK VALID
                </span>
                <h4 className="font-black text-base text-white print:text-slate-900">
                  Data Anggota Tidak Ditemukan
                </h4>
                <p className="text-xs text-rose-200 print:text-rose-900 leading-relaxed">
                  Kode QR atau Nomor Anggota <strong>&quot;{npaQuery || '-'}&quot;</strong> tidak ditemukan di dalam sistem resmi kami. Harap waspada terhadap kartu tanda anggota palsu atau yang belum terdaftar.
                </p>
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer print:hidden"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Pindai Ulang Kode QR</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. MEMBER DETAILS CARD (When Member is Found) */}
          {resolvedMember && (
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-5 space-y-4 print:bg-white print:border-slate-300 print:p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-800 to-slate-800 border-2 border-emerald-400/50 text-white font-black text-base flex items-center justify-center font-mono overflow-hidden shadow-md">
                    {resolvedMember.photoUrl ? (
                      <img
                        src={resolvedMember.photoUrl}
                        alt={resolvedMember.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      resolvedMember.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Nama Anggota:</span>
                    <h3 className="font-black text-base sm:text-lg text-white print:text-slate-900 leading-tight">
                      {resolvedMember.name}
                    </h3>
                    <p className="font-mono text-xs text-emerald-400 font-bold">
                      NPA: {resolvedMember.memberNumber}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-mono">Status Keanggotaan:</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold font-mono inline-block mt-0.5 ${
                    resolvedMember.status === 'Aktif'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 print:bg-emerald-100 print:text-emerald-900'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 print:bg-amber-100 print:text-amber-900'
                  }`}>
                    {resolvedMember.status}
                  </span>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1 print:bg-slate-50 print:border-slate-200">
                  <span className="text-[10px] text-slate-400 block flex items-center justify-between">
                    <span>Nomor Induk Kependudukan (NIK):</span>
                    <button
                      type="button"
                      onClick={() => setShowFullNik(!showFullNik)}
                      className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-mono text-[9px] print:hidden cursor-pointer"
                    >
                      {showFullNik ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showFullNik ? 'Samarkan' : 'Tampilkan'}</span>
                    </button>
                  </span>
                  <p className="font-mono text-sm font-bold text-white print:text-slate-900">
                    {formatMaskedNik(resolvedMember.nik)}
                  </p>
                  {resolvedMember.familyCardNumber && (
                    <p className="text-[11px] font-mono text-slate-400">
                      No. KK: {resolvedMember.familyCardNumber}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1 print:bg-slate-50 print:border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Cluster & Wilayah Domisili:</span>
                  <p className="font-bold text-sm text-emerald-300 print:text-emerald-800 flex items-center gap-1">
                    <Home className="w-3.5 h-3.5 shrink-0" />
                    <span>{resolvedMember.cluster || '-'}</span>
                  </p>
                  <p className="text-[11px] text-slate-300 truncate">
                    {resolvedMember.address || 'Alamat terdaftar di paguyuban'}
                  </p>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1 print:bg-slate-50 print:border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Masa Berlaku Iuran:</span>
                  <p className={`font-mono text-sm font-bold ${expiry?.isExpired ? 'text-rose-400' : 'text-white print:text-slate-900'}`}>
                    {expiry?.expiryDateFormatted || 'Menunggu Pembayaran'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Status Iuran: <span className="text-emerald-400 font-semibold">{expiry?.statusLabel || '-'}</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1 print:bg-slate-50 print:border-slate-200">
                  <span className="text-[10px] text-slate-400 block">Jumlah Jiwa Terlindungi:</span>
                  <p className="font-black text-sm text-amber-300 print:text-amber-800 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>{(resolvedMember.dependentsCount || 0) + 1} Jiwa Dilindungi</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    1 Anggota Utama + {resolvedMember.dependentsCount || 0} Tanggungan Keluarga
                  </p>
                </div>
              </div>

              {/* Tanggungan Keluarga List if available */}
              {resolvedMember.dependentsList && resolvedMember.dependentsList.length > 0 && (
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-200">
                  <p className="font-bold text-[11px] text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Daftar Tanggungan Keluarga Sah:</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {resolvedMember.dependentsList.map((dep, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex justify-between items-center print:bg-white print:border-slate-300"
                      >
                        <span className="font-bold text-white print:text-slate-900">{dep.name}</span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900">
                          {dep.relationship}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. TRIPLE-GATE OFFICIAL AUDIT TRAIL */}
              <div className="pt-2">
                <p className="font-black text-xs text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Jalur Pengesahan Resmi (Triple Gate Validation):</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Step 1: RT */}
                  <div className={`p-3 rounded-xl border ${
                    resolvedMember.verificationStatus === 'Verified'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 print:bg-emerald-50'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>1. Verifikasi RT</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-300">
                      {resolvedMember.verifiedByRt || resolvedMember.rtVerifiedBy || `Ketua RT ${resolvedMember.cluster || ''}`}
                    </p>
                    <span className="text-[9px] text-emerald-400 block font-semibold mt-0.5">
                      ✓ Berkas KTP/KK Terverifikasi
                    </span>
                  </div>

                  {/* Step 2: Bendahara */}
                  <div className={`p-3 rounded-xl border ${
                    ktaInfo?.receiptNumber
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 print:bg-emerald-50'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>2. Validasi Kas Bendahara</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-300">
                      {ktaInfo?.treasurerVerifiedName || 'Bendahara Paguyuban'}
                    </p>
                    <span className="text-[9px] text-emerald-400 block font-mono font-bold mt-0.5">
                      {ktaInfo?.receiptNumber ? `Kwitansi: ${ktaInfo.receiptNumber}` : 'Menunggu Validasi'}
                    </span>
                  </div>

                  {/* Step 3: Ketua Paguyuban */}
                  <div className={`p-3 rounded-xl border ${
                    ktaInfo?.isIssued
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 print:bg-emerald-50'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>3. Pengesahan Ketua</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-300">
                      {ktaInfo?.approvedByPaguyubanName || resolvedMember.approvedByPaguyuban || 'Bpk. H. Ahmad Fauzi'}
                    </p>
                    <span className="text-[9px] text-emerald-400 block font-semibold mt-0.5">
                      {ktaInfo?.isIssued ? `Sah: ${ktaInfo.issuedAt || 'Terbit'}` : 'Menunggu Persetujuan'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. DIGITAL SECURITY TOKEN & FINGERPRINT */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">KODE DIGITAL KEAMANAN QR KTA:</span>
                    <span className="font-bold text-emerald-400 tracking-wider">
                      {token}
                    </span>
                  </div>
                </div>

                <div className="text-right sm:self-auto self-end text-[10px] text-slate-400">
                  <span className="block">Timestamp Verifikasi:</span>
                  <span className="text-slate-300 font-mono">
                    {new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 5. EMERGENCY HOTLINE CONTACT */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs print:bg-slate-50 print:border-slate-300">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Ambulance className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-white print:text-slate-900 text-xs">
                  Pusat Layanan Ambulans & Santunan 24 Jam
                </p>
                <p className="text-[10px] text-slate-400">
                  {communityAddress} • Hotline: {hotlinePhone}
                </p>
              </div>
            </div>

            <a
              href={`https://wa.me/${hotlinePhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `Halo Pengurus ${communityName}, saya ingin mengonfirmasi verifikasi KTA Warga atas nama: ${resolvedMember?.name || '-'} (NPA: ${resolvedMember?.memberNumber || '-'})`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-colors shrink-0 print:hidden"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hubungi Pengurus</span>
            </a>
          </div>

        </div>

        {/* MODAL ACTIONS FOOTER */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-3 print:hidden">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verifikasi Resmi Paguyuban Dana Kematian</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {resolvedMember && (
              <>
                <button
                  type="button"
                  onClick={handleCopyVerificationUrl}
                  className="px-3.5 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Tautan Tersalin!' : 'Salin Tautan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintVerificationCertificate}
                  className="px-3.5 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Sertifikat</span>
                </button>

                {onOpenFullKtaModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFullKtaModal(resolvedMember);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka KTA Digital Lengkap</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
