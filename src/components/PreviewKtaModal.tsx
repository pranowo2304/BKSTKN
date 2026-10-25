import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, buildKtaValidationUrl, generateKtaSecurityToken } from '../lib/ktaUtils';
import { formatIDR } from '../lib/storage';
import {
  X,
  Printer,
  Share2,
  Check,
  QrCode,
  ShieldCheck,
  Users,
  Building,
  Phone,
  HeartHandshake,
  CheckCircle2,
  Sparkles,
  Layers,
  Palette,
  FileText,
  AlertTriangle,
  Lock,
  Calendar,
  CreditCard,
  Eye,
  Clock,
  UserCheck,
  Info,
  CheckCircle,
  FileCheck2,
  PenTool,
  Download
} from 'lucide-react';
import { downloadKtaCardAsImage, KtaCardSide } from '../lib/ktaImageGenerator';

interface PreviewKtaModalProps {
  member: Member | null;
  payments?: Payment[];
  settings?: SystemSettings;
  isOpen: boolean;
  onClose: () => void;
  onSelectMemberForPayment?: (member: Member) => void;
}

export const PreviewKtaModal: React.FC<PreviewKtaModalProps> = ({
  member,
  payments = [],
  settings,
  isOpen,
  onClose,
  onSelectMemberForPayment,
}) => {
  if (!isOpen || !member) return null;

  const [printLayout, setPrintLayout] = useState<'card-and-dossier' | 'cards-both' | 'front-only' | 'back-only'>('card-and-dossier');
  const [colorTheme, setColorTheme] = useState<'emerald' | 'navy' | 'monochrome'>('emerald');
  const [showDraftWatermark, setShowDraftWatermark] = useState<boolean>(true);
  const [includeDependents, setIncludeDependents] = useState(true);
  const [includeSignatureBoxes, setIncludeSignatureBoxes] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian Warga';
  const communityAddress = settings?.communityAddress || 'Sekretariat Paguyuban Warga Rukun Sejahtera';
  const treasurerPhone = settings?.treasurerPhone || '0812-3456-7890';
  const currentYear = new Date().getFullYear();

  // Determine the candidate status phase
  const isFullyVerifiedAndPaid = ktaInfo.isIssued;
  const isAwaitingRt = member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending';
  const isAwaitingPayment = member.status === 'Menunggu Pembayaran';
  const isAwaitingTreasurer = member.status === 'Menunggu Validasi Bendahara';

  // Unique security verification token
  const securityToken = generateKtaSecurityToken(member, ktaInfo);

  // QR Code payload with direct verification URL for phone cameras & scanners
  const previewQrPayload = buildKtaValidationUrl(member.memberNumber, securityToken);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async (side: KtaCardSide = 'front') => {
    if (!member) return;
    try {
      setDownloadingPng(true);
      await downloadKtaCardAsImage({
        member,
        side,
        theme: colorTheme === 'navy' ? 'navy' : colorTheme === 'monochrome' ? 'slate' : 'emerald',
        settings: settings || { communityName },
        payments,
        qrPayload: previewQrPayload,
      });
    } catch (err) {
      console.error('Error downloading KTA PNG:', err);
      alert('Gagal mengunduh gambar KTA. Silakan coba kembali.');
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleCopySummary = () => {
    const text = `*BERKAS VERIFIKASI & PRATINJAU KTA*\n${communityName}\n\n` +
      `• Nama Warga: *${member.name}*\n` +
      `• No. Registrasi/NPA: *${member.memberNumber}*\n` +
      `• NIK: ${member.nik}\n` +
      `• Cluster / RT: ${member.cluster || '-'}\n` +
      `• Status Alur: *${member.status}*\n` +
      `• Tgl Daftar: ${member.joinDate}\n` +
      `• Tanggungan: ${member.dependentsCount} Jiwa\n` +
      `• Verifikasi RT: ${member.rtVerifiedBy || (isAwaitingRt ? 'Menunggu' : 'Disetujui')}\n` +
      `• Lampiran KK: ${member.familyCardPhotoUrl ? 'Sudah Diunggah' : 'Belum Ada'}\n\n` +
      `_Dokumen ini digunakan untuk verifikasi pendaftaran calon anggota._`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Color theme styles
  const getThemeStyles = () => {
    if (colorTheme === 'monochrome') {
      return {
        cardFrontBg: 'bg-white text-slate-900 border-2 border-slate-900',
        cardBackBg: 'bg-white text-slate-900 border-2 border-slate-900',
        headerBg: 'bg-slate-900 text-white',
        accentBadge: 'bg-slate-100 text-slate-900 border-slate-400',
        watermarkText: 'text-slate-300',
        chipBg: 'bg-slate-200 border-slate-400 text-slate-800',
        divider: 'border-slate-300',
        innerBox: 'bg-slate-50 border-slate-300 text-slate-900',
      };
    }
    if (colorTheme === 'navy') {
      return {
        cardFrontBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white border-2 border-blue-600/60 shadow-2xl',
        cardBackBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white border-2 border-blue-600/60 shadow-2xl',
        headerBg: 'bg-blue-950/90 text-white border-b border-blue-800',
        accentBadge: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
        watermarkText: 'text-blue-500/15',
        chipBg: 'bg-amber-400 border-amber-300 text-amber-950',
        divider: 'border-blue-900/60',
        innerBox: 'bg-slate-950/70 border-blue-900/80 text-slate-200',
      };
    }
    // Default: Emerald
    return {
      cardFrontBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500/60 shadow-2xl',
      cardBackBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500/60 shadow-2xl',
      headerBg: 'bg-emerald-950/90 text-white border-b border-emerald-800',
      accentBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      watermarkText: 'text-emerald-500/15',
      chipBg: 'bg-amber-400 border-amber-300 text-amber-950',
      divider: 'border-emerald-900/60',
      innerBox: 'bg-slate-950/70 border-emerald-900/80 text-slate-200',
    };
  };

  const theme = getThemeStyles();

  return (
    <>
      {/* Specific CSS to ensure clean, isolated, high-resolution printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #preview-kta-printable-container,
          #preview-kta-printable-container * {
            visibility: visible !important;
          }
          #preview-kta-printable-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 1.5cm 1cm !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
          .no-print-element {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 1cm;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto print:p-0 print:bg-white print:static">
        <div className="bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-w-none print:w-full print:bg-white print:max-h-none">
          
          {/* MODAL HEADER (Hidden in Print) */}
          <div className="bg-slate-950 text-white p-4 sm:p-5 px-6 border-b border-slate-800 flex justify-between items-center no-print-element">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-base sm:text-lg text-white">
                    Preview & Cetak KTA Calon Anggota
                  </h3>
                  <span className={`px-2 py-0.5 font-mono text-[10px] font-extrabold rounded-full border ${
                    isFullyVerifiedAndPaid
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : isAwaitingRt
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : isAwaitingPayment
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}>
                    {isFullyVerifiedAndPaid
                      ? 'KTA Sah (Terbit)'
                      : isAwaitingRt
                      ? 'Tahap 1: Verifikasi RT'
                      : isAwaitingPayment
                      ? 'Tahap 2: Menunggu Pembayaran'
                      : 'Tahap 3: Menunggu Validasi Kas'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Pratinjau kartu anggota dan berkas registrasi resmi untuk mempermudah verifikasi calon warga
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPng(printLayout === 'back-only' ? 'back' : printLayout === 'cards-both' ? 'both' : 'front')}
                disabled={downloadingPng}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-sky-950/40 flex items-center gap-1.5 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Unduh KTA sebagai gambar PNG presisi dengan QR Code"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingPng ? 'Menyiapkan...' : 'Unduh PNG'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                title="Buka dialog cetak browser (Ctrl+P / Command+P)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Browser</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* VERIFICATION CONTEXT BANNER (Hidden in Print) */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border-b border-slate-800 px-6 py-3 no-print-element">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
                <p className="leading-snug">
                  Fitur ini menampilkan <strong>Pratinjau KTA Berstandar Cetak</strong> bahkan sebelum pembayaran divalidasi penuh, membantu Ketua RT dan pengurus mencocokkan identitas warga.
                </p>
              </div>
              {!isFullyVerifiedAndPaid && onSelectMemberForPayment && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectMemberForPayment(member);
                  }}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg transition-colors shrink-0 flex items-center gap-1"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Input Pembayaran Iuran</span>
                </button>
              )}
            </div>
          </div>

          {/* CUSTOMIZATION TOOLBAR (Hidden in Print) */}
          <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs no-print-element">
            {/* Layout Options */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-sky-400" /> Format Cetak:
              </span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPrintLayout('card-and-dossier')}
                  className={`px-2.5 py-1.2 rounded-lg font-bold transition-all ${
                    printLayout === 'card-and-dossier'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Kartu KTA + Lembar Verifikasi Pendaftaran Lengkap"
                >
                  Kartu + Berkas A4
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLayout('cards-both')}
                  className={`px-2.5 py-1.2 rounded-lg font-bold transition-all ${
                    printLayout === 'cards-both'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hanya Kartu Depan & Belakang"
                >
                  Kartu Saja (Depan & Belakang)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLayout('front-only')}
                  className={`px-2.5 py-1.2 rounded-lg font-bold transition-all ${
                    printLayout === 'front-only'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Depan Saja
                </button>
              </div>
            </div>

            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-sky-400" /> Tema:
              </span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setColorTheme('emerald')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    colorTheme === 'emerald' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hijau Resmi Paguyuban"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Hijau</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorTheme('navy')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    colorTheme === 'navy' ? 'bg-blue-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Navy Modern"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Navy</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorTheme('monochrome')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    colorTheme === 'monochrome' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Hemat Tinta Hitam Putih"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  <span>Monokrom</span>
                </button>
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDraftWatermark}
                  onChange={(e) => setShowDraftWatermark(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-600 focus:ring-sky-500"
                />
                <span>Tanda Air Verifikasi</span>
              </label>

              <label className="flex items-center gap-1.5 text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDependents}
                  onChange={(e) => setIncludeDependents(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-600 focus:ring-sky-500"
                />
                <span>Tanggungan Keluarga</span>
              </label>

              {printLayout === 'card-and-dossier' && (
                <label className="flex items-center gap-1.5 text-slate-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSignatureBoxes}
                    onChange={(e) => setIncludeSignatureBoxes(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Kolom TTD Pengesahan</span>
                </label>
              )}
            </div>
          </div>

          {/* MAIN MODAL SCROLLABLE VIEW (CONTAINING THE PRINTABLE AREA) */}
          <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-950 print:p-0 print:bg-white print:overflow-visible">
            
            {/* PRINTABLE CONTAINER (TARGET FOR WINDOW.PRINT) */}
            <div
              id="preview-kta-printable-container"
              className="max-w-3xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-none bg-white text-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl print:shadow-none print:border-none"
            >
              
              {/* DOSSIER HEADER (WHEN PRINTING CARD + VERIFICATION DOSSIER) */}
              {(printLayout === 'card-and-dossier') && (
                <div className="border-b-2 border-slate-900 pb-4 mb-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {settings.logoUrl ? (
                        <img
                          src={settings.logoUrl}
                          alt={communityName}
                          className="w-12 h-12 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl">
                          <HeartHandshake className="w-6 h-6 text-emerald-400" />
                        </div>
                      )}
                      <div>
                        <h2 className="font-black text-base sm:text-lg uppercase tracking-tight text-slate-900">
                          {communityName}
                        </h2>
                        <p className="text-xs text-slate-600">
                          {communityAddress} • Kontak Pengurus: {treasurerPhone}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                          Formulir & Berkas Verifikasi Calon Anggota (Pratinjau KTA)
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 border border-slate-300 rounded-xl p-2 bg-slate-50">
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Nomor Berkas:</p>
                      <p className="font-mono font-black text-xs sm:text-sm text-slate-900">
                        {member.memberNumber}
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Tgl Daftar: {member.joinDate}
                      </p>
                    </div>
                  </div>

                  {/* VERIFICATION CHECKLIST STRIP */}
                  <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-slate-100 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block font-semibold">1. Data Pendaftaran</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Tercatat Lengkap
                      </span>
                    </div>

                    <div className={`p-2 rounded-lg ${member.verificationStatus === 'Verified' || isAwaitingPayment || isAwaitingTreasurer || isFullyVerifiedAndPaid ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                      <span className="text-[10px] text-slate-500 block font-semibold">2. Verifikasi Ketua RT</span>
                      <span className="font-bold flex items-center gap-1">
                        {member.verificationStatus === 'Verified' || isAwaitingPayment || isAwaitingTreasurer || isFullyVerifiedAndPaid ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>{member.rtVerifiedBy || 'Disetujui RT'}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Menunggu RT</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className={`p-2 rounded-lg ${isFullyVerifiedAndPaid ? 'bg-emerald-50 text-emerald-800' : isAwaitingTreasurer ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-100 text-slate-700'}`}>
                      <span className="text-[10px] text-slate-500 block font-semibold">3. Iuran & Validasi Kas</span>
                      <span className="font-bold flex items-center gap-1">
                        {isFullyVerifiedAndPaid ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Lunas Terverifikasi</span>
                          </>
                        ) : isAwaitingTreasurer ? (
                          <>
                            <Clock className="w-3 h-3 text-indigo-600" />
                            <span>Antrean Kas</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            <span>Menunggu Setoran</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className={`p-2 rounded-lg ${member.familyCardPhotoUrl ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                      <span className="text-[10px] text-slate-500 block font-semibold">4. Lampiran Kartu Keluarga</span>
                      <span className="font-bold flex items-center gap-1">
                        {member.familyCardPhotoUrl ? (
                          <>
                            <FileText className="w-3 h-3 text-emerald-600" />
                            <span>KK Terlampir</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Belum Ada KK</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD PREVIEW TITLE BAR */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-800">
                    Pratinjau Format Kartu Fisik (Standar ID-1 / CR80 85.6mm × 54mm)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!isFullyVerifiedAndPaid && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] rounded-md">
                      Salinan Pratinjau Verifikasi
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 font-mono">Skala Cetak 1:1</span>
                </div>
              </div>

              {/* ===================== KARTU FISIK GRID ===================== */}
              <div className={`grid ${printLayout === 'card-and-dossier' || printLayout === 'cards-both' ? 'grid-cols-1 md:grid-cols-2 print:grid-cols-2' : 'grid-cols-1'} gap-6 items-start justify-center`}>
                
                {/* ---------- FRONT CARD ---------- */}
                {(printLayout === 'card-and-dossier' || printLayout === 'cards-both' || printLayout === 'front-only') && (
                  <div className="flex flex-col items-center">
                    <div className="w-full text-center mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      SISI DEPAN (FRONT CARD)
                    </div>

                    <div
                      className={`relative w-full max-w-[400px] aspect-[1.586/1] rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between overflow-hidden select-none transition-all ${theme.cardFrontBg} print:border-slate-800`}
                      style={{ minHeight: '240px' }}
                    >
                      {/* Optional Diagonal Draft / Verification Watermark */}
                      {showDraftWatermark && !isFullyVerifiedAndPaid && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden">
                          <div className="rotate-[-28deg] text-center font-black text-2xl sm:text-3xl uppercase tracking-widest text-amber-400/25 border-4 border-dashed border-amber-400/30 px-6 py-2 rounded-2xl select-none">
                            PRATINJAU VERIFIKASI
                          </div>
                        </div>
                      )}

                      {/* Micro security pattern */}
                      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_0.8px,transparent_0.8px)] [background-size:14px_14px] opacity-10 pointer-events-none" />

                      {/* CARD HEADER */}
                      <div className="flex items-start justify-between relative z-10 border-b border-white/15 pb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center shadow-xs border border-amber-400/50 shrink-0 overflow-hidden">
                            <img
                              src={settings.logoUrl || '/app-icon.svg'}
                              alt={communityName}
                              className="max-h-full max-w-full object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src && !target.src.includes('app-icon.svg')) {
                                  target.src = '/app-icon.svg';
                                }
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400">
                                KARTU TANDA ANGGOTA
                              </span>
                              {!isFullyVerifiedAndPaid && (
                                <span className="text-[6.5px] px-1 py-0.2 bg-amber-500/30 text-amber-300 font-bold rounded">
                                  DRAFT
                                </span>
                              )}
                            </div>
                            <h4 className={`font-black text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tracking-tight leading-tight break-words uppercase ${
                              communityName.length > 40
                                ? 'text-[9.5px] sm:text-[10.5px]'
                                : communityName.length > 25
                                ? 'text-[11px] sm:text-xs'
                                : 'text-xs sm:text-sm'
                            }`}>
                              {communityName}
                            </h4>
                            <p className="text-[7.5px] opacity-80 truncate max-w-[180px]">
                              {member.cluster || 'Cluster Warga'} • {communityAddress}
                            </p>
                          </div>
                        </div>

                        {/* Gold RFID Hologram Chip */}
                        <div className="flex flex-col items-end shrink-0">
                          <div className="w-7 h-5 rounded bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 border border-amber-300 shadow-inner flex items-center justify-center relative overflow-hidden">
                            <div className="w-full h-[0.5px] bg-amber-700/60 my-0.5" />
                          </div>
                          <span className="text-[6px] font-mono text-emerald-400/90 mt-0.5">
                            SECURE ID
                          </span>
                        </div>
                      </div>

                      {/* CARD BODY */}
                      <div className="grid grid-cols-12 gap-2 items-center my-auto py-1 relative z-10">
                        {/* Profile Info (8 cols) */}
                        <div className="col-span-8 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-800 to-slate-800 border border-emerald-400/50 text-white font-black text-sm flex items-center justify-center shrink-0 font-mono shadow-inner overflow-hidden">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                member.name.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[7.5px] opacity-75 leading-none">Nama Lengkap:</p>
                              <h3 className="font-black text-xs sm:text-sm truncate leading-tight tracking-wide">
                                {member.name}
                              </h3>
                              <p className="font-mono text-[8px] opacity-90">NIK: {member.nik}</p>
                            </div>
                          </div>

                          {/* Metadata Grid */}
                          <div className="grid grid-cols-2 gap-1 text-[8px] bg-black/40 p-1.5 rounded-lg border border-white/10 font-mono">
                            <div>
                              <span className="opacity-60 block text-[6.5px]">NO. REGISTRASI / NPA:</span>
                              <span className="font-bold text-emerald-300">{member.memberNumber}</span>
                            </div>
                            <div>
                              <span className="opacity-60 block text-[6.5px]">CLUSTER / WILAYAH:</span>
                              <span className="font-bold truncate block">{member.cluster || '-'}</span>
                            </div>
                            <div>
                              <span className="opacity-60 block text-[6.5px]">TGL TERDAFTAR:</span>
                              <span>{member.joinDate}</span>
                            </div>
                            <div>
                              <span className="opacity-60 block text-[6.5px]">STATUS VERIFIKASI:</span>
                              <span className={isFullyVerifiedAndPaid ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                                {isFullyVerifiedAndPaid ? 'Aktif & Sah' : 'Tahap Verifikasi'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* QR Code Container (4 cols) */}
                        <div className="col-span-4 flex flex-col items-center justify-center">
                          <div className="p-1.5 bg-white rounded-xl shadow-md border border-white/40">
                            <QRCodeSVG
                              value={previewQrPayload}
                              size={68}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <span className="text-[6.5px] font-mono text-center opacity-80 mt-1 uppercase tracking-tighter">
                            Scan Verifikasi
                          </span>
                        </div>
                      </div>

                      {/* CARD FOOTER */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/15 text-[7.5px] relative z-10">
                        <span className="opacity-80">
                          Tanggungan: <strong className="text-white">{member.dependentsCount} Jiwa</strong>
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {isFullyVerifiedAndPaid
                            ? `Berlaku: ${expiry.expiryDateFormatted}`
                            : 'Status: Pra-Aktivasi Iuran'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------- BACK CARD ---------- */}
                {(printLayout === 'card-and-dossier' || printLayout === 'cards-both' || printLayout === 'back-only') && (
                  <div className="flex flex-col items-center">
                    <div className="w-full text-center mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      SISI BELAKANG (BACK CARD)
                    </div>

                    <div
                      className={`relative w-full max-w-[400px] aspect-[1.586/1] rounded-2xl p-4 sm:p-4.5 flex flex-col justify-between overflow-hidden select-none transition-all ${theme.cardBackBg} print:border-slate-800`}
                      style={{ minHeight: '240px' }}
                    >
                      {/* CARD BACK HEADER */}
                      <div className="flex items-center justify-between border-b border-white/15 pb-1 text-[8.5px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-md bg-white p-0.5 flex items-center justify-center shrink-0 overflow-hidden border border-amber-400/50">
                            <img
                              src={settings.logoUrl || '/app-icon.svg'}
                              alt={communityName}
                              className="max-h-full max-w-full object-contain"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src && !target.src.includes('app-icon.svg')) {
                                  target.src = '/app-icon.svg';
                                }
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-amber-300 drop-shadow-xs uppercase leading-none block truncate">
                              {communityName}
                            </span>
                            <span className="text-[6.5px] font-bold text-emerald-400 uppercase tracking-wider block mt-0.5">
                              KETENTUAN & HAK ANGGOTA
                            </span>
                          </div>
                        </div>
                        <span className="text-[7.5px] opacity-75 font-mono shrink-0 ml-2">
                          NPA: {member.memberNumber}
                        </span>
                      </div>

                      {/* RULES & BENEFITS LIST */}
                      <div className="my-auto space-y-1 text-[7.5px] leading-relaxed">
                        <div className="flex items-start gap-1">
                          <span className="text-emerald-400 font-bold">•</span>
                          <p>Kartu ini merupakan bukti kepesertaan rukun kematian di lingkungan {communityName}.</p>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="text-emerald-400 font-bold">•</span>
                          <p>Fasilitas pemulasaraan jenazah, kain kafan, dan ambulans siaga darurat 24 jam.</p>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="text-emerald-400 font-bold">•</span>
                          <p>Santunan santunan duka cita untuk anggota utama dan tanggungan yang tercatat sah.</p>
                        </div>

                        {/* LIST OF DEPENDENTS PREVIEW */}
                        {includeDependents && member.dependents && member.dependents.length > 0 && (
                          <div className="p-1.5 bg-black/40 rounded-lg border border-white/10 text-[7px]">
                            <span className="font-bold text-emerald-300 block mb-0.5">
                              Tanggungan Terdaftar ({member.dependents.length} Jiwa):
                            </span>
                            <p className="truncate opacity-90">
                              {member.dependents.map((d) => `${d.name} (${d.relationship})`).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* VERIFICATION / SIGNATURE BOXES ON CARD */}
                      <div className="pt-1.5 border-t border-white/15 grid grid-cols-2 gap-2 text-[7.5px]">
                        <div className="text-center bg-black/30 p-1 rounded border border-white/10">
                          <span className="opacity-75 block text-[6.5px]">Verifikasi Ketua RT:</span>
                          <span className="font-bold text-emerald-300">
                            {member.rtVerifiedBy || member.verifiedByRt || (isAwaitingRt ? 'Menunggu Verifikasi' : 'Disetujui RT')}
                          </span>
                        </div>
                        <div className="text-center bg-black/30 p-1 rounded border border-white/10">
                          <span className="opacity-75 block text-[6.5px]">Pengesahan Kas:</span>
                          <span className="font-bold text-emerald-300">
                            {isFullyVerifiedAndPaid ? 'Bendahara (Sah)' : 'Menunggu Validasi Kas'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DOSSIER TABLE: DETAILED BIODATA & DEPENDENTS LIST */}
              {printLayout === 'card-and-dossier' && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      <span>Rincian Data Pendaftaran Warga</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Lampiran KK: {member.familyCardPhotoUrl ? 'Terunggah' : 'Belum Ada'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-1.5">
                      <p><strong>Nama Calon Anggota:</strong> {member.name}</p>
                      <p><strong>Nomor Induk Kependudukan (NIK):</strong> <span className="font-mono">{member.nik}</span></p>
                      <p><strong>Nomor Kartu Keluarga (KK):</strong> <span className="font-mono">{member.familyCardNumber || '-'}</span></p>
                      <p><strong>Cluster / Wilayah RT:</strong> {member.cluster || '-'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p><strong>Alamat Domisili:</strong> {member.address}</p>
                      <p><strong>Nomor Handphone / WhatsApp:</strong> {member.phone}</p>
                      <p><strong>Tanggal Registrasi:</strong> {member.joinDate}</p>
                      <p><strong>Jumlah Tanggungan:</strong> {member.dependentsCount} Jiwa</p>
                    </div>
                  </div>

                  {/* DEPENDENTS TABLE IF PRESENT */}
                  {includeDependents && member.dependents && member.dependents.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-slate-700">Daftar Anggota Keluarga (Tanggungan Terdaftar):</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                          <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                            <tr>
                              <th className="p-2 border-b">No.</th>
                              <th className="p-2 border-b">Nama Tanggungan</th>
                              <th className="p-2 border-b">NIK</th>
                              <th className="p-2 border-b">Hubungan Keluarga</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {member.dependents.map((dep, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 font-mono">{idx + 1}</td>
                                <td className="p-2 font-bold text-slate-900">{dep.name}</td>
                                <td className="p-2 font-mono text-slate-600">{dep.nik || '-'}</td>
                                <td className="p-2 text-slate-700">{dep.relationship}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* OFFICIAL SIGNATURE COLUMNS FOR PRINTING / ARCHIVING */}
                  {includeSignatureBoxes && (
                    <div className="pt-6 mt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs">
                      <div>
                        <p className="text-slate-500 text-[11px] mb-14">Calon Anggota (Pemohon),</p>
                        <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-4">
                          ( {member.name} )
                        </p>
                        <p className="text-[10px] text-slate-500">Tanda Tangan Warga</p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[11px] mb-14">Ketua RT {member.cluster || 'Wilayah'},</p>
                        <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-4">
                          ( {member.rtVerifiedBy || member.verifiedByRt || '................................'} )
                        </p>
                        <p className="text-[10px] text-slate-500">Verifikator Wilayah</p>
                      </div>

                      <div>
                        <p className="text-slate-500 text-[11px] mb-14">Pengurus / Bendahara Kas,</p>
                        <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-4">
                          ( {settings.treasurerName || 'Bendahara Paguyuban'} )
                        </p>
                        <p className="text-[10px] text-slate-500">Pengesahan Kas Masuk</p>
                      </div>
                    </div>
                  )}

                  {/* PRINT FOOTER */}
                  <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono">
                    Dokumen ini dicetak dari Sistem Informasi Dana Kematian Warga • {new Date().toLocaleString('id-ID')}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* MODAL FOOTER ACTION BAR (Hidden in Print) */}
          <div className="bg-slate-950 border-t border-slate-800 p-4 px-6 flex flex-wrap items-center justify-between gap-3 no-print-element">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-slate-400" />}
                <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Ringkasan'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
