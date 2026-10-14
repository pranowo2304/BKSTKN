import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { formatIDR } from '../lib/storage';
import {
  getMemberKtaIssuanceInfo,
  generateKtaQrPayload,
  generateKtaSecurityToken,
  generateKtaStructuredPayload,
  buildKtaValidationUrl,
} from '../lib/ktaUtils';
import {
  X,
  Printer,
  Share2,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  Users,
  HeartHandshake,
  QrCode,
  Check,
  AlertTriangle,
  Info,
  Lock,
  Clock,
  ArrowRight,
  CreditCard,
  Building,
  UserCheck,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Search,
  Award
} from 'lucide-react';
import { KtaCardSkeleton } from './KtaCardSkeleton';
import { KtaAuthenticityVerificationModal } from './KtaAuthenticityVerificationModal';
import { MemberKtaQrGeneratorModal } from './MemberKtaQrGeneratorModal';
import { MembershipCertificateModal } from './MembershipCertificateModal';

interface DigitalKtaModalProps {
  member: Member | null;
  payments?: Payment[];
  settings?: SystemSettings;
  isOpen: boolean;
  onClose: () => void;
  onSelectMemberForPayment?: (member: Member) => void;
  onOpenPrintCardModal?: (member: Member) => void;
  onOpenPreviewKtaModal?: (member: Member) => void;
}

export const DigitalKtaModal: React.FC<DigitalKtaModalProps> = ({
  member,
  payments = [],
  settings,
  isOpen,
  onClose,
  onSelectMemberForPayment,
  onOpenPrintCardModal,
  onOpenPreviewKtaModal,
}) => {
  if (!isOpen || !member) return null;

  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQrVerificationInfo, setShowQrVerificationInfo] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(true);
  const [qrMode, setQrMode] = useState<'url' | 'json'>('url');
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Trigger smooth skeleton loading effect when modal opens or member switches
  useEffect(() => {
    if (isOpen) {
      setIsCardLoading(true);
      const timer = setTimeout(() => {
        setIsCardLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, member?.id]);

  const handleRefreshCard = () => {
    setIsCardLoading(true);
    setTimeout(() => {
      setIsCardLoading(false);
    }, 550);
  };

  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian Warga';
  const securityToken = generateKtaSecurityToken(member, ktaInfo);

  // Unique QR Code payload for the KTA
  const qrPayload = generateKtaQrPayload(
    member,
    ktaInfo,
    settings || { communityName },
    expiry.expiryDateFormatted,
    qrMode
  );

  const handlePrint = () => {
    if (!ktaInfo.isIssued) {
      alert('KTA belum dapat dicetak karena belum disahkan secara resmi oleh Bendahara Paguyuban.');
      return;
    }
    window.print();
  };

  const handleCopyVerificationLink = () => {
    if (!ktaInfo.isIssued) {
      const text = `*INFORMASI STATUS KTA (BELUM RESMI)*\n${communityName}\n\n• Nama: ${member.name}\n• No. Registrasi: ${member.memberNumber}\n• Cluster: ${member.cluster}\n• Status: ${ktaInfo.statusTitle}\n• Catatan: ${ktaInfo.statusDescription}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    }

    const text = `*KARTU TANDA ANGGOTA RESMI*\n${communityName}\n\n• Nama: ${member.name}\n• NPA: ${member.memberNumber}\n• NIK: ${member.nik}\n• Cluster: ${member.cluster}\n• Status: ${member.status} (${expiry.statusLabel})\n• Pengesahan: ${ktaInfo.issuedBy || 'Bendahara'} (${ktaInfo.issuedAt || '-'})\n• No. Kwitansi: ${ktaInfo.receiptNumber || '-'}\n• Masa Berlaku: ${expiry.expiryDateFormatted}\n• Tanggungan Terlindungi: ${member.dependentsCount} Jiwa\n\n_Kartu Tanda Anggota Digital Terverifikasi dengan QR Code Resmi Paguyuban._`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = (member.phone || '').replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0')
      ? '62' + cleanPhone.slice(1)
      : cleanPhone.startsWith('62')
      ? cleanPhone
      : '62' + cleanPhone;

    let message = '';
    if (ktaInfo.isIssued) {
      message = encodeURIComponent(
        `Halo Bapak/Ibu *${member.name}*,\n\nBerikut adalah informasi *KARTU TANDA ANGGOTA (KTA) DIGITAL RESMI* Anda di *${communityName}*:\n\n` +
        `📌 *Nomor Anggota (NPA)*: ${member.memberNumber}\n` +
        `👤 *Nama Lengkap*: ${member.name}\n` +
        `🆔 *NIK*: ${member.nik}\n` +
        `🏡 *Cluster/Alamat*: ${member.cluster || '-'} • ${member.address}\n` +
        `✍️ *Disahkan Oleh*: ${ktaInfo.issuedBy || 'Bendahara'} (${ktaInfo.receiptNumber || 'LUNAS'})\n` +
        `🛡️ *Status Iuran*: ${expiry.statusLabel} (${expiry.expiryDateFormatted})\n` +
        `👨‍👩‍👧‍👦 *Tanggungan Dilindungi*: ${member.dependentsCount} Jiwa\n\n` +
        `_KTA ini resmi dan sah dilengkapi QR Code untuk verifikasi santunan pemakaman & ambulans jenazah._`
      );
    } else {
      message = encodeURIComponent(
        `Halo Bapak/Ibu *${member.name}*,\n\nStatus pengajuan keanggotaan Anda di *${communityName}*:\n` +
        `• No. Registrasi: ${member.memberNumber}\n` +
        `• Status: *${ktaInfo.statusTitle}*\n` +
        `• Keterangan: ${ktaInfo.statusDescription}\n\n` +
        `_KTA resmi akan otomatis terbit setelah verifikasi RT dan pembayaran iuran disahkan oleh Bendahara._`
      );
    }

    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-w-none print:w-full print:bg-white print:max-h-none">
        
        {/* MODAL HEADER (Hidden in Print) */}
        <div className="bg-slate-950 text-white p-5 px-6 border-b border-slate-800 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border ${
              ktaInfo.isIssued
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {ktaInfo.isIssued ? <QrCode className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">
                  {ktaInfo.isIssued ? 'KTA Digital & QR Code Resmi' : 'Status Penerbitan KTA Digital'}
                </h3>
                <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded-full border ${
                  ktaInfo.isIssued
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {ktaInfo.statusBadge}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {ktaInfo.isIssued
                  ? 'Kartu Tanda Anggota Paguyuban dengan QR Code Verifikasi Real-Time'
                  : 'KTA hanya dapat terbit setelah Verifikasi RT dan Pembayaran disahkan Bendahara'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ktaInfo.isIssued && (
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5"
                title="Balik Tampilan Kartu (Depan / Belakang)"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isFlipped ? 'Lihat Sisi Depan' : 'Lihat Sisi Belakang'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 print:p-0 print:bg-white">
          
          {/* 3-STEP ISSUANCE ROADMAP PIPELINE */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Alur Syarat Penerbitan KTA Resmi:
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                ktaInfo.isIssued
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {ktaInfo.isIssued ? '✓ Lengkap & Sah' : '⚠️ Menunggu Persyaratan'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Step 1: RT Verification */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                member.verificationStatus === 'Verified' && member.status !== 'Menunggu Verifikasi RT'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse'
              }`}>
                {member.verificationStatus === 'Verified' && member.status !== 'Menunggu Verifikasi RT' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-[11px]">1. Verifikasi Ketua RT</p>
                  <p className="text-[10px] opacity-80">
                    {member.verificationStatus === 'Verified' && member.status !== 'Menunggu Verifikasi RT'
                      ? `Disetujui RT (${member.verifiedByRt || member.cluster || 'Sah'})`
                      : 'Menunggu Persetujuan RT'}
                  </p>
                </div>
              </div>

              {/* Step 2: Payment Submitted */}
              {(() => {
                const hasAnyPayment = payments.some(
                  (p) => p.memberId === member.id || p.memberNumber === member.memberNumber
                );
                const hasVerifiedPayment = payments.some(
                  (p) => (p.memberId === member.id || p.memberNumber === member.memberNumber) && p.status === 'Verified'
                );

                return (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    hasVerifiedPayment
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : hasAnyPayment
                      ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    {hasVerifiedPayment ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : hasAnyPayment ? (
                      <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold text-[11px]">2. Setor Iuran Kas</p>
                      <p className="text-[10px] opacity-80">
                        {hasVerifiedPayment
                          ? 'Iuran Telah Masuk Kas'
                          : hasAnyPayment
                          ? 'Bukti Transfer Dikirim'
                          : 'Belum Ada Pembayaran'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Step 3: Bendahara Approval & Issuance */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                ktaInfo.isIssued
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                {ktaInfo.isIssued ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-[11px]">3. Pengesahan Bendahara</p>
                  <p className="text-[10px] opacity-80">
                    {ktaInfo.isIssued
                      ? `Disahkan (${ktaInfo.issuedBy || 'Bendahara'})`
                      : 'KTA Belum Terbit'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stage Guidance Note */}
            {!ktaInfo.isIssued && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{ktaInfo.statusTitle}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{ktaInfo.statusDescription}</p>
                  {ktaInfo.stage === 'AWAITING_PAYMENT' && onSelectMemberForPayment && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMemberForPayment(member);
                      }}
                      className="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Input Pembayaran Iuran Anggota</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* INTERACTIVE 3D FLIPPABLE KTA CARD CONTAINER OR SKELETON TRANSITION */}
          <div className="flex flex-col justify-center items-center py-1 print:py-0">
            {isCardLoading ? (
              <div className="w-full max-w-[480px] aspect-[1.586/1] animate-in fade-in duration-300">
                <KtaCardSkeleton
                  side={isFlipped ? 'back' : 'front'}
                  statusText="Memuat data KTA & sinkronisasi QR..."
                />
              </div>
            ) : (
              <div
                className="w-full max-w-[480px] aspect-[1.586/1] relative cursor-pointer select-none group [perspective:1200px] animate-in fade-in duration-300"
                onClick={() => setIsFlipped(!isFlipped)}
                title="Klik untuk membalik kartu (Animasi 3D Flip)"
              >
                <div
                  className="w-full h-full relative rounded-2xl transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d]"
                  style={{
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                {/* SISI DEPAN (FRONT SIDE) */}
                <div
                  id="kta-front-card"
                  className={`absolute inset-0 w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-4 sm:p-5 border-2 shadow-2xl overflow-hidden flex flex-col justify-between select-none transition-all duration-300 print:border-emerald-900 print:shadow-none [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${
                    ktaInfo.isIssued ? 'border-emerald-500/40' : 'border-amber-500/40'
                  }`}
                >
                  {/* Decorative Glowing Elements & Background Watermark */}
                  <div className="absolute top-0 right-0 -translate-y-10 translate-x-10 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 translate-y-10 -translate-x-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

                  {/* UNISSUED WATERMARK OVERLAY */}
                  {!ktaInfo.isIssued && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-2 shadow-lg">
                        <Lock className="w-6 h-6" />
                      </div>
                      <span className="px-3 py-1 bg-amber-950 border border-amber-500/60 text-amber-300 font-mono text-[11px] font-black uppercase rounded-lg tracking-wider mb-1">
                        DRAFT • KTA BELUM DAPAT DITERBITKAN
                      </span>
                      <p className="text-[11px] text-slate-300 max-w-xs leading-tight">
                        {ktaInfo.statusDescription}
                      </p>
                    </div>
                  )}

                  {/* KTA Header */}
                  <div className="flex items-start justify-between relative z-10 border-b border-emerald-900/80 pb-2">
                    <div className="flex items-center gap-2.5">
                      {settings?.logoUrl ? (
                        <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-emerald-950/40 border border-emerald-300/40 shrink-0">
                          <img
                            src={settings.logoUrl}
                            alt={communityName}
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-950/40 border border-emerald-300/40 shrink-0 font-bold">
                          <HeartHandshake className="w-5 h-5 text-slate-950" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">
                            {ktaInfo.isIssued ? 'KARTU TANDA ANGGOTA RESMI' : 'DRAFT KTA WARGA'}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full ${ktaInfo.isIssued ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        </div>
                        <h4 className="font-black text-xs sm:text-sm text-white tracking-tight leading-tight">
                          {communityName}
                        </h4>
                        <p className="text-[8px] text-slate-300 truncate max-w-[210px]">
                          {member.cluster || 'Cluster Warga'} • {settings?.communityAddress || 'Rukun Tetangga & Warga'}
                        </p>
                      </div>
                    </div>

                    {/* Chip Hologram Digital */}
                    <div className="flex flex-col items-end">
                      <div className="w-8 h-6 rounded-md bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 border border-amber-300/80 shadow-inner flex items-center justify-center relative overflow-hidden">
                        <div className="w-full h-[1px] bg-amber-700/60 my-0.5" />
                        <div className="absolute inset-0 border border-amber-600/40 rounded-sm" />
                      </div>
                      <span className="text-[7px] font-mono text-emerald-400/80 mt-0.5 tracking-tighter">
                        {ktaInfo.isIssued ? 'RFID SECURE' : 'UNVERIFIED'}
                      </span>
                    </div>
                  </div>

                  {/* KTA Middle: Photo/Avatar, Name, NPA, NIK & QR Code */}
                  <div className="grid grid-cols-12 gap-3 items-center my-auto py-1.5 relative z-10">
                    
                    {/* Left & Middle Info (8 cols) */}
                    <div className="col-span-8 space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-800 to-slate-800 border-2 border-emerald-400/60 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md shrink-0 font-mono overflow-hidden">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            member.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-400 font-medium">Nama Anggota:</p>
                          <h3 className="font-black text-xs sm:text-sm text-white truncate leading-tight tracking-wide">
                            {member.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-extrabold rounded border border-emerald-500/40 font-mono">
                              {member.memberNumber}
                            </span>
                            {ktaInfo.isIssued && (
                              <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 text-[8px] font-black rounded uppercase">
                                Sah
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[9px] bg-slate-950/60 p-1.5 rounded-xl border border-emerald-950 font-mono">
                        <div>
                          <span className="text-slate-400 block text-[7px]">NIK Warga:</span>
                          <span className="text-slate-200 font-bold truncate block">{member.nik}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[7px]">Cluster:</span>
                          <span className="text-emerald-300 font-bold truncate block">{member.cluster || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Info: High-Contrast QR Code (4 cols) */}
                    <div className="col-span-4 flex flex-col items-center justify-center">
                      <div className="p-1.5 bg-white rounded-xl shadow-lg border-2 border-emerald-400/80 flex flex-col items-center">
                        <QRCodeSVG
                          value={qrPayload}
                          size={70}
                          level="H"
                          includeMargin={false}
                          bgColor="#FFFFFF"
                          fgColor="#022c22"
                        />
                      </div>
                      <span className="text-[7px] font-bold text-emerald-400 text-center mt-1 uppercase tracking-tighter">
                        {ktaInfo.isIssued ? 'Scan QR Sah' : 'Scan Verifikasi'}
                      </span>
                    </div>

                  </div>

                  {/* KTA Footer */}
                  <div className="pt-1.5 border-t border-emerald-900/80 flex items-center justify-between text-[8px] relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div>
                        <span className="text-slate-400 block text-[7px]">Disahkan:</span>
                        <span className="font-mono text-slate-200 font-semibold truncate max-w-[100px] block">
                          {ktaInfo.isIssued ? (ktaInfo.issuedBy || 'Bendahara') : 'Belum Terbit'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[7px]">Masa Iuran:</span>
                        <span className={`font-mono font-bold ${expiry.isExpired ? 'text-rose-400' : 'text-emerald-300'}`}>
                          {ktaInfo.isIssued ? expiry.expiryDateFormatted : 'Menunggu Bayar'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-emerald-400 font-bold text-[8px]">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{member.dependentsCount + 1} Jiwa Terlindungi</span>
                    </div>
                  </div>
                </div>

                {/* SISI BELAKANG (BACK SIDE) */}
                <div
                  id="kta-back-card"
                  className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border-2 border-slate-700 shadow-2xl overflow-hidden flex flex-col justify-between select-none transition-all duration-300 print:border-slate-800 print:shadow-none [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]"
                >
                  {/* Top Bar: Title & Flip indicator */}
                  <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <h4 className="font-black text-xs text-emerald-400 uppercase tracking-wider">
                        PROFIL & KETENTUAN HAK SANTUNAN
                      </h4>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      NPA: {member.memberNumber}
                    </span>
                  </div>

                  {/* Profile Details & Dependents Grid */}
                  <div className="grid grid-cols-12 gap-2 my-auto py-1 items-center">
                    {/* Left: Member Details & Covered Family */}
                    <div className="col-span-7 space-y-1 text-[8px] sm:text-[9px]">
                      <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
                        <span className="text-[7px] text-slate-400 block">Nama Anggota & Alamat:</span>
                        <p className="font-black text-white text-[10px] sm:text-[11px] truncate leading-tight">
                          {member.name}
                        </p>
                        <p className="text-[8px] text-slate-300 truncate">
                          {member.cluster || '-'} • NIK: {member.nik}
                        </p>
                        {member.familyCardNumber && (
                          <p className="text-[7px] text-slate-400 font-mono">
                            No. KK: {member.familyCardNumber}
                          </p>
                        )}
                      </div>

                      {/* Covered Dependents Summary */}
                      <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                        <p className="font-bold text-emerald-400 text-[8px] uppercase tracking-wider mb-0.5 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            <span>Tanggungan Terdaftar:</span>
                          </span>
                          <span className="text-amber-300 font-mono">
                            {(member.dependentsCount || 0) + 1} Jiwa
                          </span>
                        </p>
                        {member.dependentsList && member.dependentsList.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {member.dependentsList.slice(0, 3).map((dep, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-slate-900 text-slate-200 rounded text-[7px] border border-slate-800 truncate max-w-[90px]">
                                {dep.name} ({dep.relationship})
                              </span>
                            ))}
                            {member.dependentsList.length > 3 && (
                              <span className="px-1 py-0.5 bg-emerald-950 text-emerald-300 text-[7px] font-bold rounded">
                                +{member.dependentsList.length - 3} lainnya
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[7px] text-slate-400 italic">No. Kontak: {member.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Protection Clauses & Official QR */}
                    <div className="col-span-5 flex flex-col justify-between space-y-1 text-[7.5px] sm:text-[8px] text-slate-300 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
                      <p className="font-bold text-amber-300 text-[8px]">Hak Pelayanan Jenazah:</p>
                      <ul className="space-y-0.5 leading-tight">
                        <li>✓ Pemulasaraan & kain kafan</li>
                        <li>✓ Mobil ambulans 24 Jam</li>
                        <li>✓ Santunan duka cita tunai</li>
                      </ul>
                      <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[7px] text-slate-400">
                        <span>Verifikasi QR:</span>
                        <span className="font-bold text-emerald-400">Valid</span>
                      </div>
                    </div>
                  </div>

                  {/* Digital Signature & Stamp Footer */}
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between items-end text-[7px]">
                    <div>
                      <p className="text-slate-400">Pusat Bantuan & Kontak:</p>
                      <p className="font-mono text-slate-200 font-bold">{settings?.treasurerPhone || '0812-3456-7890'}</p>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className="flex items-center gap-1 text-emerald-400 font-extrabold text-[8px]">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>{ktaInfo.isIssued ? 'Disahkan Bendahara' : 'Menunggu Pengesahan'}</span>
                      </div>
                      <p className="text-slate-400 mt-0.5">
                        {ktaInfo.isIssued ? (ktaInfo.issuedBy || 'Bendahara Paguyuban') : (member.verifiedByRt || 'Verifikasi RT')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Quick Card Controls below card */}
            <div className="flex items-center justify-center gap-2 mt-3 w-full max-w-[480px] print:hidden">
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                className="flex-1 py-2 px-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700/60 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCw className={`w-3.5 h-3.5 text-emerald-400 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
                <span>{isFlipped ? 'Tampilkan Sisi Depan' : 'Balik 3D (Detail Profil)'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshCard}
                disabled={isCardLoading}
                className="py-2 px-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700/60 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                title="Sinkronkan & Muat Ulang KTA"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isCardLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sinkronkan</span>
              </button>
            </div>
          </div>

          {/* QR CODE DETAILS & INSTANT SCANNER VERIFICATION GUIDE */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 print:hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <span>Verifikasi QR Code KTA Resmi</span>
                    <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono rounded">
                      Unik & Valid
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Dapat dipindai langsung menggunakan kamera HP biasa atau pemindai paguyuban untuk cek keaslian.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsVerificationModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="Lihat hasil sertifikat verifikasi yang muncul saat QR discan"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Uji Cek Keaslian</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQrVerificationInfo(!showQrVerificationInfo)}
                  className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 flex items-center gap-1 shrink-0"
                >
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{showQrVerificationInfo ? 'Sembunyikan' : 'Detail'}</span>
                </button>
              </div>
            </div>

            {/* Token Badge */}
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-slate-400">Security Token:</span>
                <span className="font-mono font-bold text-emerald-400 text-[11px]">
                  {securityToken}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Format QR:</span>
                <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setQrMode('url')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                      qrMode === 'url' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Bisa dipindai langsung oleh kamera HP standar"
                  >
                    URL Kamera HP
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode('json')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                      qrMode === 'json' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Data JSON terenkripsi lengkap"
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>

            {showQrVerificationInfo && (
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span className="font-bold">Isi Payload QR Code:</span>
                  <span className="font-mono text-[10px] text-emerald-400">
                    Mode: {qrMode === 'url' ? 'Direct Mobile URL' : 'Encrypted JSON'}
                  </span>
                </div>
                <pre className="p-2.5 bg-slate-950 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {qrMode === 'json'
                    ? JSON.stringify(JSON.parse(qrPayload), null, 2)
                    : qrPayload}
                </pre>
              </div>
            )}
          </div>

          {/* PRINT-ONLY DUAL SIDED LAYOUT (Tampil Otomatis saat Dicetak) */}
          {ktaInfo.isIssued && (
            <div className="hidden print:block space-y-6">
              <div className="text-center pb-4 border-b border-slate-300">
                <h2 className="text-lg font-black text-slate-900">{communityName}</h2>
                <p className="text-xs text-slate-600">Kartu Tanda Anggota (KTA) Digital Resmi</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Front Preview on Print */}
                <div className="border border-slate-400 p-4 rounded-xl">
                  <p className="text-center font-bold text-xs mb-2 text-slate-700">SISI DEPAN (FRONT)</p>
                  <div className="aspect-[1.586/1] bg-slate-900 text-white p-4 rounded-lg flex flex-col justify-between text-[9px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-[10px] text-emerald-400">{communityName}</p>
                        <p className="text-[8px] text-slate-300">{member.cluster}</p>
                      </div>
                      <span className="font-mono text-emerald-400">{member.memberNumber}</span>
                    </div>
                    <div className="my-auto flex justify-between items-center">
                      <div>
                        <p className="font-black text-xs text-white">{member.name}</p>
                        <p className="font-mono text-[8px] text-slate-300">NIK: {member.nik}</p>
                      </div>
                      <div className="p-1 bg-white rounded">
                        <QRCodeSVG value={qrPayload} size={50} level="M" />
                      </div>
                    </div>
                    <div className="flex justify-between text-[7px] text-slate-400 border-t border-slate-800 pt-1">
                      <span>Gabung: {member.joinDate}</span>
                      <span>Masa Aktif: {expiry.expiryDateFormatted}</span>
                    </div>
                  </div>
                </div>

                {/* Back Preview on Print */}
                <div className="border border-slate-400 p-4 rounded-xl">
                  <p className="text-center font-bold text-xs mb-2 text-slate-700">SISI BELAKANG (BACK)</p>
                  <div className="aspect-[1.586/1] bg-slate-900 text-white p-4 rounded-lg flex flex-col justify-between text-[8px]">
                    <p className="font-bold text-emerald-400 text-[9px]">KETENTUAN HAK SANTUNAN</p>
                    <p className="text-slate-300 text-[8px] leading-tight">
                      1. Fardhu kifayah & kain kafan.<br/>
                      2. Pelayanan mobil jenazah 24 Jam.<br/>
                      3. Santunan dana duka ahli waris.<br/>
                      4. Tanggungan: {member.dependentsCount} Jiwa.
                    </p>
                    <div className="flex justify-between items-end border-t border-slate-800 pt-1 text-[7px] text-slate-400">
                      <span>Kontak: {settings?.treasurerPhone || '0812-3456-7890'}</span>
                      <span className="text-emerald-400 font-bold">Disahkan Bendahara</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL ACTIONS FOOTER (Hidden in Print) */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {ktaInfo.isIssued ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>KTA Sah Digital • Disahkan Bendahara ({ktaInfo.receiptNumber || 'Lunas'})</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>KTA Terkunci • Menunggu Verifikasi Pembayaran Bendahara</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsQrGeneratorOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 cursor-pointer"
              title="Buka Generator QR Code unik KTA warga berdasarkan NPA"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-300" />
              <span>Generator QR NPA</span>
            </button>

            <button
              type="button"
              onClick={handleCopyVerificationLink}
              className="px-3.5 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Data'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95"
              title="Kirim status KTA via WhatsApp ke nomor anggota"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Kirim WhatsApp</span>
            </button>

            {ktaInfo.isIssued ? (
              <button
                type="button"
                onClick={() => {
                  if (onOpenPrintCardModal) {
                    onClose();
                    onOpenPrintCardModal(member);
                  } else {
                    handlePrint();
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95"
                title="Buka format kartu presisi siap cetak & potong"
              >
                <Printer className="w-3.5 h-3.5 text-slate-950" />
                <span>Cetak Kartu Fisik</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsCertModalOpen(true)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer ${
                ktaInfo.isIssued
                  ? 'text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-950/40 hover:scale-105 active:scale-95'
                  : 'text-amber-200 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/40'
              }`}
              title={
                ktaInfo.isIssued
                  ? 'Buka & Cetak Sertifikat Keanggotaan Resmi (A4 Landscape)'
                  : 'Sertifikat bisa terbit setelah disetujui ketua paguyuban'
              }
            >
              {ktaInfo.isIssued ? (
                <Award className="w-3.5 h-3.5 text-amber-200" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{ktaInfo.isIssued ? 'Sertifikat Resmi' : 'Sertifikat (Menunggu Ketua Paguyuban)'}</span>
            </button>

            {!ktaInfo.isIssued && onOpenPreviewKtaModal ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPreviewKtaModal(member);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-all shadow-md shadow-sky-950/40 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95"
                title="Pratinjau KTA Registrasi (Dapat dicetak untuk verifikasi sebelum pembayaran)"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span>Preview KTA (Verifikasi)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-900 rounded-xl border border-slate-800 cursor-not-allowed inline-flex items-center gap-1.5 opacity-60"
                title="KTA hanya dapat dicetak setelah disahkan oleh Bendahara"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak Terkunci</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>

      {/* Official KTA Authenticity Verification Modal */}
      {isVerificationModalOpen && (
        <KtaAuthenticityVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          member={member}
          npaQuery={member.memberNumber}
          securityToken={securityToken}
          members={member ? [member] : []}
          payments={payments}
          settings={settings || { communityName }}
        />
      )}

      {/* Member KTA QR Code Generator Modal */}
      {isQrGeneratorOpen && (
        <MemberKtaQrGeneratorModal
          isOpen={isQrGeneratorOpen}
          onClose={() => setIsQrGeneratorOpen(false)}
          member={member}
          settings={settings}
          payments={payments}
        />
      )}

      {/* Official Membership Certificate Modal */}
      {isCertModalOpen && member && (
        <MembershipCertificateModal
          isOpen={isCertModalOpen}
          onClose={() => setIsCertModalOpen(false)}
          member={member}
          payments={payments}
          settings={settings}
        />
      )}
    </div>
  );
};
