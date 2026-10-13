import React, { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Member, Payment, SystemSettings, AppUser } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload } from '../lib/ktaUtils';
import { downloadKtaCardAsImage, KtaCardTheme, KtaCardSide } from '../lib/ktaImageGenerator';
import { KtaCardSkeleton } from './KtaCardSkeleton';
import {
  QrCode,
  Download,
  RotateCw,
  Eye,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Share2,
  Users,
  Check,
  X,
  Palette,
  Sparkles,
  ChevronDown,
  Maximize2,
  Calendar,
  Lock,
  Shield,
  CreditCard,
  Phone,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  UserCheck,
  Award
} from 'lucide-react';
import { MembershipCertificateModal } from './MembershipCertificateModal';

interface MemberKtaGalleryProps {
  members: Member[];
  payments?: Payment[];
  settings: SystemSettings;
  activeUser?: AppUser | null;
  currentMember?: Member | null;
  onNavigateToPayment?: (member: Member) => void;
  onOpenPrintModal?: (member: Member) => void;
}

export const MemberKtaGallery: React.FC<MemberKtaGalleryProps> = ({
  members = [],
  payments = [],
  settings,
  activeUser,
  currentMember,
  onNavigateToPayment,
  onOpenPrintModal,
}) => {
  // Sesuai aturan: "Galery KTA hanya bisa melihat masing masing KTA dari anggota yang login."
  // Cari anggota yang sesuai dengan user yang sedang login
  const loggedInMember: Member | null = useMemo(() => {
    if (currentMember) return currentMember;
    if (activeUser) {
      return (
        members.find(
          (m) =>
            (m.id && activeUser.memberId && m.id === activeUser.memberId) ||
            (m.memberNumber && activeUser.memberNumber && m.memberNumber === activeUser.memberNumber) ||
            (m.email && activeUser.email && m.email.toLowerCase() === activeUser.email.toLowerCase()) ||
            (m.name && activeUser.name && m.name.toLowerCase() === activeUser.name.toLowerCase())
        ) || members[0] || null
      );
    }
    return members[0] || null;
  }, [currentMember, activeUser, members]);

  // State
  const [selectedTheme, setSelectedTheme] = useState<KtaCardTheme>('emerald');
  const [viewSide, setViewSide] = useState<'all' | 'both' | 'front' | 'back'>('all');
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);
  const [downloadingSide, setDownloadingSide] = useState<KtaCardSide | null>(null);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isCardLoading, setIsCardLoading] = useState<boolean>(true);
  const [isCertModalOpen, setIsCertModalOpen] = useState<boolean>(false);

  // Smooth skeleton transition when theme changes or member mounts
  useEffect(() => {
    setIsCardLoading(true);
    const timer = setTimeout(() => {
      setIsCardLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [selectedTheme, loggedInMember?.id]);

  // Expiry & KTA details calculation
  const expiry = useMemo(() => {
    if (!loggedInMember) return null;
    return calculateMemberExpiry(loggedInMember, payments, new Date(), settings);
  }, [loggedInMember, payments, settings]);

  const ktaInfo = useMemo(() => {
    if (!loggedInMember) return null;
    return getMemberKtaIssuanceInfo(loggedInMember, payments);
  }, [loggedInMember, payments]);

  // QR Code Payload
  const qrPayload = useMemo(() => {
    if (!loggedInMember || !ktaInfo || !expiry) return '';
    return generateKtaQrPayload(loggedInMember, ktaInfo, settings, expiry.expiryDateFormatted);
  }, [loggedInMember, ktaInfo, settings, expiry]);

  const isMemberActive = Boolean(
    loggedInMember && (loggedInMember.status === 'Aktif' || loggedInMember.isKtaIssued)
  );

  // Download Handler (PNG High-Definition)
  const handleDownload = async (side: KtaCardSide = 'front') => {
    if (!loggedInMember) return;
    try {
      setDownloadingSide(side);
      setIsDownloadMenuOpen(false);

      // Get QR code data URL from hidden canvas
      const qrCanvas = document.getElementById(`qr-canvas-${loggedInMember.id}`) as HTMLCanvasElement;
      const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : undefined;

      const filename = await downloadKtaCardAsImage({
        member: loggedInMember,
        side,
        theme: selectedTheme,
        settings,
        payments,
        qrDataUrl,
      });

      const sideLabel = side === 'front' ? 'Sisi Depan' : side === 'back' ? 'Sisi Belakang' : '2 Sisi Lengkap';
      setDownloadSuccessToast(`KTA ${sideLabel} (${loggedInMember.name}) berhasil diunduh sebagai gambar PNG.`);
      setTimeout(() => setDownloadSuccessToast(null), 4500);
    } catch (error) {
      console.error('Error downloading KTA card image:', error);
      alert('Gagal mengunduh gambar KTA. Silakan coba kembali.');
    } finally {
      setDownloadingSide(null);
    }
  };

  // WhatsApp Share
  const handleShareWhatsApp = () => {
    if (!loggedInMember || !expiry || !ktaInfo) return;
    const cleanPhone = (loggedInMember.phone || '').replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0')
      ? '62' + cleanPhone.slice(1)
      : cleanPhone.startsWith('62')
      ? cleanPhone
      : '62' + cleanPhone;

    const message = encodeURIComponent(
      `*KARTU TANDA ANGGOTA (KTA) DIGITAL RESMI*\n${settings.communityName || 'Paguyuban Dana Kematian'}\n\n` +
      `• Nama: *${loggedInMember.name}*\n` +
      `• No. Pokok Anggota (NPA): *${loggedInMember.memberNumber}*\n` +
      `• NIK: ${loggedInMember.nik}\n` +
      `• Cluster / RT: ${loggedInMember.cluster || '-'}\n` +
      `• Status: *KTA SAH & AKTIF* (${expiry.statusLabel})\n` +
      `• Masa Perlindungan: *${expiry.expiryDateFormatted}*\n` +
      `• Tanggungan: *${(loggedInMember.dependentsCount || 0) + 1} Jiwa Terlindungi*\n` +
      `• Pengesahan: ${ktaInfo.issuedBy || 'Bendahara Paguyuban'} (${ktaInfo.receiptNumber || 'Lunas'})\n\n` +
      `_KTA ini resmi terdaftar dan terverifikasi digital. Unduh kartu Anda di Portal Warga Paguyuban._`
    );

    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  // Copy card text
  const handleCopyCard = () => {
    if (!loggedInMember || !expiry) return;
    const text = `*KARTU TANDA ANGGOTA PAGUYUBAN*\n${settings.communityName}\n• Nama: ${loggedInMember.name}\n• NPA: ${loggedInMember.memberNumber}\n• NIK: ${loggedInMember.nik}\n• Cluster: ${loggedInMember.cluster || '-'}\n• Status: ${loggedInMember.status} (${expiry.expiryDateFormatted})\n• Tanggungan: ${(loggedInMember.dependentsCount || 0) + 1} Jiwa`;
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  // Card Background Gradient based on Theme
  const cardBgStyle =
    selectedTheme === 'navy'
      ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0284c7 100%)'
      : selectedTheme === 'slate'
      ? 'linear-gradient(135deg, #090d16 0%, #1e293b 60%, #0f172a 100%)'
      : selectedTheme === 'maroon'
      ? 'linear-gradient(135deg, #4c0519 0%, #881337 55%, #9f1239 100%)'
      : 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #022c22 100%)';

  // Sub-component to render KTA Front Face
  const renderKtaFront = (member: Member) => (
    <div className="h-full flex flex-col justify-between relative z-10 select-none">
      {/* Header */}
      <div className="flex justify-between items-start gap-2 border-b border-white/15 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-amber-300 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-200">
              KARTU TANDA ANGGOTA RESMI
            </p>
            <h4 className="text-xs sm:text-sm font-black tracking-tight text-white line-clamp-1">
              {settings.communityName || 'PAGUYUBAN DANA KEMATIAN'}
            </h4>
          </div>
        </div>

        {/* Status Chip */}
        <span
          className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase shrink-0 flex items-center gap-1 ${
            member.status === 'Aktif' || member.isKtaIssued
              ? 'bg-emerald-400/25 text-emerald-200 border border-emerald-400/40'
              : 'bg-amber-400/25 text-amber-200 border border-amber-400/40'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              member.status === 'Aktif' || member.isKtaIssued ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{member.status === 'Aktif' || member.isKtaIssued ? 'AKTIF' : member.status}</span>
        </span>
      </div>

      {/* Middle: Data Warga & QR Code */}
      <div className="grid grid-cols-12 gap-2 my-auto py-1 items-center">
        <div className="col-span-8 space-y-1">
          <span className="text-[9px] font-mono tracking-wider text-emerald-200/80 block">
            NOMOR POKOK ANGGOTA (NPA):
          </span>
          <p className="text-base sm:text-lg font-mono font-black tracking-widest text-white drop-shadow-sm leading-none">
            {member.memberNumber}
          </p>
          <h3 className="text-sm sm:text-base font-black text-white line-clamp-1">
            {member.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-emerald-100">
            <span>RT / Cluster: {member.cluster || '-'}</span>
            <span>•</span>
            <span className="font-mono">NIK: {member.nik}</span>
          </div>
        </div>

        {/* QR Code thumbnail */}
        <div className="col-span-4 flex flex-col items-center justify-center">
          <div className="p-1.5 bg-white rounded-xl shadow-md border-2 border-emerald-400/80">
            <QRCodeSVG
              value={qrPayload || member.memberNumber}
              size={64}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#064e3b"
            />
          </div>
          <span className="text-[8px] font-bold text-emerald-300 mt-1 uppercase tracking-tighter">
            QR Verifikasi
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end text-[9px] text-emerald-200/90 pt-1.5 border-t border-white/15">
        <div>
          <span className="block text-[8px] text-emerald-300/70">MASA PERLINDUNGAN:</span>
          <span className="font-mono font-bold text-white">
            {expiry?.expiryDateFormatted || '31 Des 2026'}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[8px] text-emerald-300/70">TERLINDUNGI:</span>
          <span className="font-bold text-white">
            {(member.dependentsCount || 0) + 1} Jiwa Santunan
          </span>
        </div>
      </div>
    </div>
  );

  // Sub-component to render KTA Back Face (Member Profile & Additional Legal Details)
  const renderKtaBack = (member: Member) => (
    <div className="h-full flex flex-col justify-between relative z-10 select-none">
      {/* Back Header */}
      <div className="flex justify-between items-center border-b border-white/15 pb-1">
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-teal-300" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-teal-300">
            PROFIL ANGGOTA & INFORMASI RESMI
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
            {member.memberNumber}
          </span>
        </div>
      </div>

      {/* Back Body: 2 Columns */}
      <div className="grid grid-cols-12 gap-2 my-auto py-1 items-center">
        {/* Profile Info */}
        <div className="col-span-7 space-y-1 text-[8.5px] sm:text-[9.5px]">
          <div>
            <span className="text-[7px] text-teal-300/80 uppercase font-mono block">Nama Anggota:</span>
            <p className="font-black text-white text-[11px] sm:text-xs truncate leading-tight">{member.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-1 font-mono text-[8px] bg-black/20 p-1 rounded-lg border border-white/10">
            <div>
              <span className="text-teal-300/70 block text-[7px]">NIK:</span>
              <span className="text-white font-bold truncate block">{member.nik}</span>
            </div>
            <div>
              <span className="text-teal-300/70 block text-[7px]">No. KK:</span>
              <span className="text-white font-bold truncate block">{member.familyCardNumber || 'Terdaftar'}</span>
            </div>
            <div className="col-span-2 pt-0.5 border-t border-white/10 flex items-center justify-between text-[7px]">
              <span className="text-teal-300/70">RT/Cluster:</span>
              <span className="text-emerald-300 font-bold">{member.cluster || '-'}</span>
            </div>
          </div>

          <div className="bg-emerald-950/40 p-1 rounded-lg border border-emerald-500/20">
            <div className="flex items-center justify-between text-[7.5px]">
              <span className="text-emerald-200 font-bold flex items-center gap-1">
                <Users className="w-2.5 h-2.5 text-emerald-400" />
                <span>Tanggungan Jiwa:</span>
              </span>
              <span className="font-bold text-amber-300">{(member.dependentsCount || 0) + 1} Jiwa</span>
            </div>
            {member.dependentsList && member.dependentsList.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {member.dependentsList.slice(0, 3).map((dep, idx) => (
                  <span key={idx} className="px-1 rounded text-[6.5px] bg-white/10 text-emerald-100 truncate max-w-[100px]">
                    {dep.name} ({dep.relationship})
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[7px] text-teal-200/70 italic">Kontak: {member.phone}</span>
            )}
          </div>
        </div>

        {/* QR & Protection summary */}
        <div className="col-span-5 flex flex-col items-center justify-between space-y-1 text-center">
          <div className="p-1 bg-white rounded-xl shadow-md border-2 border-emerald-400/80 shrink-0">
            <QRCodeSVG
              value={qrPayload || member.memberNumber}
              size={54}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#022c22"
            />
          </div>
          <div className="text-[7px] text-emerald-100/90 leading-tight space-y-0.5 w-full bg-black/25 p-1 rounded-lg border border-white/10 text-left">
            <p className="font-bold text-amber-300 text-[7.5px] flex items-center gap-1">
              <CheckCircle2 className="w-2 h-2 text-emerald-400 shrink-0" />
              <span>Hak Santunan:</span>
            </p>
            <p>• Ambulans Jenazah 24 Jam</p>
            <p>• Santunan Dana Duka Cepat</p>
            <p>• Fardhu Kifayah & Kain Kafan</p>
          </div>
        </div>
      </div>

      {/* Back Footer */}
      <div className="flex justify-between items-end text-[8px] text-emerald-200/80 pt-1 border-t border-white/15">
        <div>
          <span>Pengesahan:</span>
          <p className="font-bold text-white leading-tight">
            {ktaInfo?.issuedBy || 'Bendahara Paguyuban'}
          </p>
        </div>
        <div className="text-center hidden sm:block">
          <span>Layanan Duka:</span>
          <p className="font-bold text-amber-300 leading-tight">
            {settings.treasurerPhone || '0812-3456-7890'}
          </p>
        </div>
        <div className="text-right">
          <span>Status Perlindungan:</span>
          <p className="font-bold text-white leading-tight">
            {expiry?.expiryDateFormatted || '31 Des 2026'}
          </p>
        </div>
      </div>
    </div>
  );

  // Fallback jika tidak ada anggota terhubung
  if (!loggedInMember) {
    return (
      <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-black text-slate-900">Data KTA Belum Ditemukan</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Akun Anda belum terhubung dengan data anggota aktif paguyuban. Silakan hubungi Pengurus RT atau Bendahara
          untuk sinkronisasi keanggotaan Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. GALLERY HEADER BANNER (FOCUSED ON LOGGED-IN MEMBER) */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden border border-emerald-500/20 shadow-lg">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>KTA Digital Resmi Anda</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-slate-200 border border-white/10">
                NPA: {loggedInMember.memberNumber}
              </span>
              {isMemberActive ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>KTA Aktif & Sah</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  {loggedInMember.status}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Galeri KTA Digital: {loggedInMember.name}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Kartu Tanda Anggota resmi paguyuban dengan QR Code keaslian digital, masa berlaku perlindungan santunan,
              dan tanda tangan elektronik Bendahara. Anda dapat mengganti tema warna, memeriksa sisi depan/belakang, serta
              mengunduhnya langsung ke format gambar (PNG) berkualitas tinggi.
            </p>

            {/* Privacy Protection Notice */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-[11px] text-emerald-200">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  <strong>Akses Privat:</strong> Sesuai kebijakan privasi data, Anda hanya dapat melihat dan mengunduh
                  KTA resmi milik akun Anda.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Member Mini Badge */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 shrink-0 max-w-xs w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-md shrink-0">
                {loggedInMember.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide block">
                  Kepala Keluarga / Utama
                </span>
                <h4 className="font-extrabold text-sm text-white truncate">{loggedInMember.name}</h4>
                <p className="text-[11px] font-mono text-slate-300">
                  {loggedInMember.cluster || 'Cluster Warga'}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload('front')}
                disabled={Boolean(downloadingSide)}
                className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingSide ? 'Menyiapkan...' : 'Unduh Gambar (.png)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS DOWNLOAD TOAST */}
      {downloadSuccessToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <Check className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-bold">{downloadSuccessToast}</p>
          </div>
          <button
            type="button"
            onClick={() => setDownloadSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. STUDIO TOOLBAR: TEMA & MODE TAMPILAN */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          {/* Left: Theme Palette Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Palette className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-700 font-bold">Tema KTA:</span>
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={() => setSelectedTheme('emerald')}
                  className={`w-6 h-6 rounded-lg bg-emerald-700 transition-transform cursor-pointer ${
                    selectedTheme === 'emerald' ? 'ring-2 ring-emerald-500 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title="Emerald Paguyuban"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTheme('navy')}
                  className={`w-6 h-6 rounded-lg bg-blue-900 transition-transform cursor-pointer ${
                    selectedTheme === 'navy' ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title="Royal Navy Blue"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTheme('slate')}
                  className={`w-6 h-6 rounded-lg bg-slate-900 transition-transform cursor-pointer ${
                    selectedTheme === 'slate' ? 'ring-2 ring-amber-400 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title="Executive Slate & Gold"
                />
                <button
                  type="button"
                  onClick={() => setSelectedTheme('maroon')}
                  className={`w-6 h-6 rounded-lg bg-rose-950 transition-transform cursor-pointer ${
                    selectedTheme === 'maroon' ? 'ring-2 ring-rose-500 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title="Classic Maroon"
                />
              </div>
            </div>

            {/* View Mode: Interactive / Both / Front / Back */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewSide('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewSide === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Flip Interaktif
              </button>
              <button
                type="button"
                onClick={() => setViewSide('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewSide === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2 Sisi Berdampingan
              </button>
              <button
                type="button"
                onClick={() => setViewSide('front')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewSide === 'front' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sisi Depan
              </button>
              <button
                type="button"
                onClick={() => setViewSide('back')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewSide === 'back' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sisi Belakang
              </button>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Download Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                disabled={Boolean(downloadingSide)}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingSide ? 'Menyiapkan...' : 'Unduh Gambar (.png)'}</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-80" />
              </button>

              {/* Dropdown Menu */}
              {isDownloadMenuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-30 w-56 space-y-1 animate-in fade-in slide-in-from-top-2">
                  <button
                    type="button"
                    onClick={() => handleDownload('front')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 rounded-xl transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Unduh Sisi Depan</span>
                    <span className="text-[10px] text-slate-400 font-mono">1050x660</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('back')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 rounded-xl transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Unduh Sisi Belakang</span>
                    <span className="text-[10px] text-slate-400 font-mono">1050x660</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('both')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Unduh 2 Sisi Lengkap</span>
                    <span className="text-[10px] text-emerald-700 font-mono">HD</span>
                  </button>
                </div>
              )}
            </div>

            {/* Print KTA Button */}
            {onOpenPrintModal && (
              <button
                type="button"
                onClick={() => onOpenPrintModal(loggedInMember)}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Cetak KTA Resmi / PDF"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Cetak PDF</span>
              </button>
            )}

            {/* View Official Certificate Button */}
            <button
              type="button"
              onClick={() => setIsCertModalOpen(true)}
              className="py-2.5 px-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Buka & Cetak Sertifikat Keanggotaan Resmi (A4 Landscape)"
            >
              <Award className="w-3.5 h-3.5 text-amber-200" />
              <span>Sertifikat Anggota</span>
            </button>

            {/* Share WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer border border-emerald-200"
              title="Bagikan Data KTA ke WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Fullscreen Zoom */}
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
              title="Pratinjau Layar Penuh"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. CARD PRESENTATION CONTAINER */}
      {viewSide === 'both' ? (
        /* BOTH SIDES DISPLAY (SIDE-BY-SIDE) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SISI DEPAN */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sisi Depan (Identitas & QR)</span>
              </span>
              <button
                type="button"
                onClick={() => handleDownload('front')}
                disabled={Boolean(downloadingSide)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Unduh Sisi Ini</span>
              </button>
            </div>

            <div className="relative w-full aspect-[1.586/1] rounded-2xl p-4 sm:p-5 text-white shadow-lg overflow-hidden border border-white/20 select-none">
              <div className="absolute inset-0" style={{ background: cardBgStyle }} />
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
              {renderKtaFront(loggedInMember)}
            </div>
          </div>

          {/* SISI BELAKANG */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                <span>Sisi Belakang (Ketentuan & Pengesahan)</span>
              </span>
              <button
                type="button"
                onClick={() => handleDownload('back')}
                disabled={Boolean(downloadingSide)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Unduh Sisi Ini</span>
              </button>
            </div>

            <div className="relative w-full aspect-[1.586/1] rounded-2xl p-4 sm:p-5 text-white shadow-lg overflow-hidden border border-white/20 select-none">
              <div className="absolute inset-0" style={{ background: cardBgStyle }} />
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
              {renderKtaBack(loggedInMember)}
            </div>
          </div>
        </div>
      ) : (
        /* SINGLE CARD DISPLAY WITH INTERACTIVE FLIP */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                {loggedInMember.memberNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>KTA Pribadi Anda</span>
              </span>
            </div>

            {/* Flip & Sync toggle button */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                {(viewSide === 'back' || (viewSide === 'all' && isCardFlipped)) ? 'Sisi Belakang' : 'Sisi Depan'}
              </span>
              <button
                type="button"
                onClick={() => setIsCardFlipped(!isCardFlipped)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Balik Kartu"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Balik 3D</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCardLoading(true);
                  setTimeout(() => setIsCardLoading(false), 450);
                }}
                disabled={isCardLoading}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                title="Muat Ulang Transisi Kartu"
              >
                <RotateCw className={`w-3.5 h-3.5 text-emerald-600 ${isCardLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sinkronkan</span>
              </button>
            </div>
          </div>

          {/* SKELETON TRANSITION OR 3D FLIPPABLE CARD CONTAINER */}
          {isCardLoading ? (
            <div className="w-full aspect-[1.586/1] animate-in fade-in duration-300">
              <KtaCardSkeleton
                side={(viewSide === 'back' || (viewSide === 'all' && isCardFlipped)) ? 'back' : 'front'}
                statusText="Menyiapkan tema & memvalidasi data KTA..."
              />
            </div>
          ) : viewSide === 'all' ? (
            <div
              onClick={() => setIsCardFlipped(!isCardFlipped)}
              className="w-full aspect-[1.586/1] relative cursor-pointer select-none group [perspective:1200px] animate-in fade-in duration-300"
              title="Klik untuk membalik kartu (Animasi 3D Flip)"
            >
              <div
                className="w-full h-full relative rounded-2xl shadow-xl group-hover:shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d]"
                style={{
                  transform: isCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* SISI DEPAN (FRONT FACE) */}
                <div
                  className="absolute inset-0 w-full h-full rounded-2xl p-5 sm:p-6 text-white overflow-hidden border border-white/20 flex flex-col justify-between shadow-md [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
                >
                  <div className="absolute inset-0 transition-all duration-300" style={{ background: cardBgStyle }} />
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  {renderKtaFront(loggedInMember)}
                </div>

                {/* SISI BELAKANG (BACK FACE) */}
                <div
                  className="absolute inset-0 w-full h-full rounded-2xl p-4 sm:p-5 text-white overflow-hidden border border-teal-400/40 flex flex-col justify-between shadow-md [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]"
                >
                  <div className="absolute inset-0 transition-all duration-300" style={{ background: cardBgStyle }} />
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                  {renderKtaBack(loggedInMember)}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="relative w-full aspect-[1.586/1] rounded-2xl p-5 sm:p-6 text-white shadow-xl overflow-hidden border border-white/20 select-none animate-in fade-in duration-300"
            >
              <div className="absolute inset-0 transition-all duration-300" style={{ background: cardBgStyle }} />
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
              {viewSide === 'back' ? renderKtaBack(loggedInMember) : renderKtaFront(loggedInMember)}
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleDownload('front')}
              disabled={Boolean(downloadingSide)}
              className="flex-1 w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingSide ? 'Sedang Memproses...' : 'Unduh Gambar KTA (.png)'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCard}
              className="flex-1 w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedText ? 'Teks Tersalin!' : 'Bagikan Data KTA'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. DETAIL LEGALITAS & MANFAAT ANGGOTA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Status Masa Perlindungan */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <div className="p-2 rounded-xl bg-emerald-50">
              <Calendar className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider">Masa Perlindungan</h4>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-black text-slate-900">
              {expiry?.expiryDateFormatted || '31 Desember 2026'}
            </p>
            <p className="text-xs text-slate-500">
              Status:{' '}
              <strong className={isMemberActive ? 'text-emerald-700' : 'text-amber-700'}>
                {expiry?.statusLabel || loggedInMember.status}
              </strong>
            </p>
            {expiry && (
              <p className="text-[11px] text-slate-400">
                Sisa masa aktif: {expiry.daysRemaining} hari ke depan.
              </p>
            )}
          </div>
        </div>

        {/* Jiwa yang Terlindungi */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-teal-800">
            <div className="p-2 rounded-xl bg-teal-50">
              <Users className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider">Jiwa Terlindungi</h4>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-black text-slate-900">
              {(loggedInMember.dependentsCount || 0) + 1} Jiwa
            </p>
            <p className="text-xs text-slate-500">
              1 Kepala Keluarga + {loggedInMember.dependentsCount || 0} Tanggungan Terdaftar
            </p>
            <p className="text-[11px] text-slate-400">
              Nomor KK: {loggedInMember.familyCardNumber || 'Terlampir dalam sistem'}
            </p>
          </div>
        </div>

        {/* Hak Fasilitas & Layanan */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-800">
            <div className="p-2 rounded-xl bg-indigo-50">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider">Fasilitas Berhak</h4>
          </div>
          <ul className="text-xs space-y-1 text-slate-600">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Ambulans Jenazah 24 Jam Siap Antar</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Santunan Duka Cepat Ahli Waris</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Fasilitas Tenda & Kursi Duka</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 5. FULLSCREEN PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-slate-200 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    KTA Digital: {loggedInMember.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{loggedInMember.memberNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Front Card Preview */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Tampak Depan:</span>
              <div className="relative w-full aspect-[1.586/1] rounded-2xl p-4 sm:p-5 text-white shadow-lg overflow-hidden border border-white/20 select-none">
                <div className="absolute inset-0" style={{ background: cardBgStyle }} />
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                {renderKtaFront(loggedInMember)}
              </div>
            </div>

            {/* Back Card Preview */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Tampak Belakang:</span>
              <div className="relative w-full aspect-[1.586/1] rounded-2xl p-4 sm:p-5 text-white shadow-lg overflow-hidden border border-white/20 select-none">
                <div className="absolute inset-0" style={{ background: cardBgStyle }} />
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
                {renderKtaBack(loggedInMember)}
              </div>
            </div>

            {/* Modal Download Actions */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDownload('front')}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Depan</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload('back')}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Belakang</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload('both')}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>2 Sisi (HD)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. HIDDEN QR CANVAS FOR HIGH-RES EXPORT */}
      <div className="hidden" aria-hidden="true">
        <QRCodeCanvas
          id={`qr-canvas-${loggedInMember.id}`}
          value={qrPayload || loggedInMember.memberNumber}
          size={256}
          includeMargin={true}
        />
      </div>

      {/* 7. OFFICIAL MEMBERSHIP CERTIFICATE MODAL */}
      {isCertModalOpen && loggedInMember && (
        <MembershipCertificateModal
          isOpen={isCertModalOpen}
          onClose={() => setIsCertModalOpen(false)}
          member={loggedInMember}
          payments={payments}
          settings={settings}
        />
      )}
    </div>
  );
};
