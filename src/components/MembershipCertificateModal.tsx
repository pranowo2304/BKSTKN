import React, { useState, useRef } from 'react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload } from '../lib/ktaUtils';
import { getMemberCertificateInfo } from '../lib/certificateUtils';
import { generateCertificatePdf } from '../lib/certificatePdfGenerator';
import { downloadCertificateImage } from '../lib/certificateImageGenerator';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  Award,
  Printer,
  Download,
  Share2,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Calendar,
  Users,
  Copy,
  Check,
  Building,
  UserCheck,
  ExternalLink,
  Lock,
  Sparkles,
  QrCode
} from 'lucide-react';

interface MembershipCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  payments?: Payment[];
  settings?: SystemSettings;
  onOpenKtaModal?: (member: Member) => void;
}

export const MembershipCertificateModal: React.FC<MembershipCertificateModalProps> = ({
  isOpen,
  onClose,
  member,
  payments = [],
  settings,
  onOpenKtaModal,
}) => {
  const [certTheme, setCertTheme] = useState<'emerald' | 'gold' | 'navy' | 'monochrome'>('emerald');
  const [showDependents, setShowDependents] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !member) return null;

  const certInfo = getMemberCertificateInfo(member, payments, settings);
  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);
  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian Warga Rukun Sejahtera';
  const communityAddress = settings?.communityAddress || 'Sekretariat Rukun Tetangga & Paguyuban Warga';
  const hotline = settings?.treasurerPhone || '0812-3456-7890';

  // Generate QR payload for certificate authenticity verification
  const qrPayload = generateKtaQrPayload(
    member,
    ktaInfo,
    settings || { communityName },
    expiry.expiryDateFormatted,
    'url'
  );

  // Format Join Date
  const joinDateFormatted = member.joinDate
    ? new Date(member.joinDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : certInfo.issueDate;

  // Print Handler
  const handlePrint = () => {
    if (!certInfo.isIssued) {
      alert('Sertifikat keanggotaan resmi belum terbit!\n\nSesuai aturan AD/ART organisasi, sertifikat baru bisa terbit dan dicetak setelah disetujui oleh Ketua Paguyuban.');
      return;
    }
    window.print();
  };

  // Download PDF Handler (Crisp vector PDF directly using jsPDF, 100% immune to html2canvas & oklab errors)
  const handleDownloadPdf = () => {
    if (!certInfo.isIssued) {
      alert('Sertifikat keanggotaan resmi belum terbit!\n\nSesuai aturan AD/ART organisasi, sertifikat resmi baru bisa terbit dan diunduh setelah disetujui oleh Ketua Paguyuban.');
      return;
    }
    setIsExporting(true);
    try {
      let qrDataUrl: string | undefined;
      const qrCanvas = document.getElementById('cert-qr-source-canvas') as HTMLCanvasElement | null;
      if (qrCanvas) {
        qrDataUrl = qrCanvas.toDataURL('image/png');
      }

      const pdf = generateCertificatePdf({
        member,
        payments,
        settings,
        theme: certTheme,
        showDependents,
        showSignatures,
        qrDataUrl,
      });

      const cleanName = (member.name || 'Warga').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanNpa = (member.memberNumber || 'CERT').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`Sertifikat_${cleanNpa}_${cleanName}.pdf`);
    } catch (err) {
      console.error('Failed to export certificate PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Download High-Res Image Handler (Direct Canvas 2D API, 100% immune to html2canvas & oklab errors)
  const handleDownloadImage = async () => {
    if (!certInfo.isIssued) {
      alert('Sertifikat keanggotaan resmi belum terbit!\n\nSertifikat baru bisa terbit setelah disetujui ketua paguyuban.');
      return;
    }
    setIsExporting(true);
    try {
      let qrDataUrl: string | undefined;
      const qrCanvas = document.getElementById('cert-qr-source-canvas') as HTMLCanvasElement | null;
      if (qrCanvas) {
        qrDataUrl = qrCanvas.toDataURL('image/png');
      }

      await downloadCertificateImage({
        member,
        payments,
        settings,
        theme: certTheme,
        showDependents,
        showSignatures,
        qrDataUrl,
      });
    } catch (err) {
      console.error('Failed to export certificate image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // WhatsApp Share Handler
  const handleShareWhatsApp = () => {
    if (!certInfo.isIssued) {
      alert('Sertifikat keanggotaan resmi belum terbit!\n\nSertifikat baru bisa terbit dan dibagikan setelah disetujui ketua paguyuban.');
      return;
    }
    const phone = (member.phone || '').replace(/[^0-9]/g, '');
    const intlPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone.startsWith('62') ? phone : '62' + phone;
    const text = `*SERTIFIKAT KEANGGOTAAN RESMI*\n${communityName}\n\n*Nama:* ${member.name}\n*No. Sertifikat:* ${certInfo.certificateNumber}\n*NPA:* ${member.memberNumber}\n*Status:* RESMI & SAH\n*Masa Berlaku:* ${expiry.expiryDateFormatted}\n*Jumlah Jiwa Terlindungi:* ${(member.dependentsCount || 0) + 1} Jiwa\n\nSertifikat telah disahkan secara resmi oleh Ketua Paguyuban dan tercatat di Sistem Informasi Paguyuban.`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Theme Styling
  const getThemeClasses = () => {
    switch (certTheme) {
      case 'gold':
        return {
          borderOuter: 'border-amber-600',
          borderInner: 'border-amber-400',
          bgColor: 'bg-[#fffdf5]',
          accentText: 'text-amber-800',
          headerBg: 'bg-amber-900',
          sealColor: 'text-amber-600',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'navy':
        return {
          borderOuter: 'border-slate-800',
          borderInner: 'border-blue-400',
          bgColor: 'bg-[#f8fafc]',
          accentText: 'text-blue-900',
          headerBg: 'bg-slate-900',
          sealColor: 'text-blue-700',
          badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
        };
      case 'monochrome':
        return {
          borderOuter: 'border-slate-800',
          borderInner: 'border-slate-400',
          bgColor: 'bg-white',
          accentText: 'text-slate-900',
          headerBg: 'bg-slate-800',
          sealColor: 'text-slate-700',
          badgeBg: 'bg-slate-100 text-slate-900 border-slate-400',
        };
      case 'emerald':
      default:
        return {
          borderOuter: 'border-emerald-800',
          borderInner: 'border-emerald-500',
          bgColor: 'bg-[#fcfdfa]',
          accentText: 'text-emerald-900',
          headerBg: 'bg-emerald-900',
          sealColor: 'text-emerald-700',
          badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      {/* Printable CSS style injected for precise A4 Landscape layout */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #membership-certificate-printable, #membership-certificate-printable * {
            visibility: visible;
          }
          #membership-certificate-printable {
            position: fixed;
            left: 0;
            top: 0;
            width: 297mm;
            height: 210mm;
            margin: 0;
            padding: 10mm;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full my-auto overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-200">
        
        {/* TOP MODAL TOOLBAR */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Sertifikat Keanggotaan Resmi
                </h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                  certInfo.isIssued ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}>
                  {certInfo.isIssued ? 'TERBIT & SAH (DISETUJUI KETUA)' : 'BELUM TERBIT — MENUNGGU PERSETUJUAN KETUA PAGUYUBAN'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">
                No. Registrasi: <strong className="text-amber-300">{certInfo.certificateNumber}</strong> • {member.name}
              </p>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className={`px-3.5 py-2 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                certInfo.isIssued
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white'
                  : 'bg-slate-800 text-amber-300 border border-amber-400/30 hover:bg-slate-700'
              }`}
              title={certInfo.isIssued ? 'Cetak langsung menggunakan printer (A4 Landscape)' : 'Sertifikat bisa terbit setelah disetujui ketua paguyuban'}
            >
              {certInfo.isIssued ? <Printer className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
              <span>{certInfo.isIssued ? 'Cetak (A4)' : 'Cetak (Terkunci)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className={`px-3.5 py-2 font-extrabold text-xs rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                certInfo.isIssued
                  ? 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border-slate-700'
                  : 'bg-slate-800 text-amber-300 border-amber-400/30 hover:bg-slate-700'
              }`}
              title={certInfo.isIssued ? 'Unduh dokumen dalam format PDF Siap Cetak' : 'Sertifikat bisa terbit setelah disetujui ketua paguyuban'}
            >
              {certInfo.isIssued ? <Download className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
              <span>{isExporting ? 'Memproses...' : certInfo.isIssued ? 'Unduh PDF' : 'Unduh PDF (Terkunci)'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className={`px-3 py-2 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                certInfo.isIssued
                  ? 'bg-teal-700 hover:bg-teal-600 active:scale-95 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
              title={certInfo.isIssued ? 'Kirim pemberitahuan sertifikat ke WhatsApp warga' : 'Sertifikat bisa terbit setelah disetujui ketua paguyuban'}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS & STATUS BAR */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700">Tema Sertifikat:</span>
            <div className="inline-flex rounded-xl p-0.5 bg-slate-200/80 border border-slate-300">
              <button
                type="button"
                onClick={() => setCertTheme('emerald')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  certTheme === 'emerald' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Royal Emerald
              </button>
              <button
                type="button"
                onClick={() => setCertTheme('gold')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  certTheme === 'gold' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Golden Piagam
              </button>
              <button
                type="button"
                onClick={() => setCertTheme('navy')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  certTheme === 'navy' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Imperial Navy
              </button>
              <button
                type="button"
                onClick={() => setCertTheme('monochrome')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  certTheme === 'monochrome' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Formal Mono
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={showDependents}
                onChange={(e) => setShowDependents(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="font-medium text-[11px]">Tampilkan Tanggungan</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="font-medium text-[11px]">Kolom Tanda Tangan Tripartit</span>
            </label>
          </div>
        </div>

        {/* ISSUANCE NOTICE BANNER (If not yet fully approved) */}
        {!certInfo.isIssued && (
          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-amber-200 rounded-lg text-amber-800 shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="font-black text-amber-950 text-sm">
                  Sertifikat Belum Terbit — Menunggu Persetujuan Ketua Paguyuban
                </p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Sesuai alur resmi paguyuban: <strong>Pendaftar baru bisa melakukan pembayaran setelah verifikasi dari RT</strong>, dan <strong>sertifikat bisa terbit setelah disetujui ketua paguyuban</strong>. Tampilan di bawah ini merupakan pratinjau draf.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-black bg-amber-200 border border-amber-400 px-2.5 py-1 rounded-lg text-amber-950 uppercase shrink-0">
              DRAF — BELUM TERBIT
            </span>
          </div>
        )}

        {/* CERTIFICATE PREVIEW WORKSPACE */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-200/60 flex items-center justify-center">
          
          {/* Hidden QR Canvas for high-res vector PDF & PNG embedding */}
          <div className="hidden" aria-hidden="true">
            <QRCodeCanvas
              id="cert-qr-source-canvas"
              value={qrPayload || member.memberNumber}
              size={256}
              includeMargin={true}
            />
          </div>

          {/* A4 CERTIFICATE CANVAS CONTAINER */}
          <div
            id="membership-certificate-printable"
            ref={certificateRef}
            className={`w-full max-w-[920px] aspect-[1.414/1] ${theme.bgColor} p-5 sm:p-8 rounded-xl shadow-2xl relative border-[6px] ${theme.borderOuter} overflow-hidden select-none`}
            style={{
              fontFamily: '"Times New Roman", Times, Georgia, serif',
            }}
          >
            {/* INNER GUILLOCHE ORNAMENTAL BORDER */}
            <div className={`w-full h-full border-2 ${theme.borderInner} rounded-lg p-4 sm:p-6 flex flex-col justify-between relative`}>
              
              {/* Corner Ornamental Flourishes */}
              <div className="absolute top-1 left-1 w-6 h-6 border-t-2 border-l-2 border-amber-600" />
              <div className="absolute top-1 right-1 w-6 h-6 border-t-2 border-r-2 border-amber-600" />
              <div className="absolute bottom-1 left-1 w-6 h-6 border-b-2 border-l-2 border-amber-600" />
              <div className="absolute bottom-1 right-1 w-6 h-6 border-b-2 border-r-2 border-amber-600" />

              {/* Watermark in background */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                <ShieldCheck className="w-96 h-96 text-slate-900" />
              </div>

              {!certInfo.isIssued && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <span className="text-3xl sm:text-5xl font-black text-rose-500/25 border-4 border-rose-500/25 p-6 rounded-2xl rotate-[-25deg] uppercase tracking-widest text-center leading-tight">
                    DRAFT • BELUM TERBIT<br /><span className="text-xl sm:text-3xl">MENUNGGU PERSETUJUAN KETUA PAGUYUBAN</span>
                  </span>
                </div>
              )}

              {/* HEADER SECTION: KOP SURAT PAGUYUBAN */}
              <div className="text-center relative z-10 space-y-1">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-900 text-white flex items-center justify-center shadow-md border border-amber-400">
                    <ShieldCheck className="w-7 h-7 text-amber-300" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-base sm:text-xl font-extrabold tracking-wide uppercase text-slate-900 font-sans leading-tight">
                      {communityName}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-600 font-sans">
                      {communityAddress} • Kontak Darurat Pemulasaraan: {hotline}
                    </p>
                  </div>
                </div>

                <div className="w-48 h-0.5 bg-amber-500 mx-auto mt-2 mb-1 rounded-full" />

                {/* CERTIFICATE TITLE */}
                <div className="pt-1">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] text-amber-700 font-sans block">
                    PIAGAM PENETAPAN & PERLINDUNGAN WARGA
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-wider uppercase text-slate-900 font-serif my-0.5">
                    SERTIFIKAT KEANGGOTAAN
                  </h1>
                  <p className="text-[10px] sm:text-xs font-mono font-bold text-slate-600">
                    Nomor Registrasi Resmi: <span className="text-slate-900 font-extrabold">{certInfo.certificateNumber}</span>
                  </p>
                </div>
              </div>

              {/* BODY SECTION: MEMBER DECLARATION */}
              <div className="relative z-10 text-center my-auto py-2 space-y-2 sm:space-y-3">
                <p className="text-xs sm:text-sm italic text-slate-700">
                  Dengan ini Pengurus Paguyuban Dana Kematian menerangkan dan menetapkan secara sah bahwa:
                </p>

                {/* MEMBER NAME (PRESTIGIOUS CALLOUT) */}
                <div className="py-1">
                  <h3 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight font-serif capitalize underline decoration-amber-500/80 decoration-2 underline-offset-4">
                    {member.name}
                  </h3>
                </div>

                {/* MEMBER METADATA GRID */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 font-sans text-xs sm:text-sm">
                  <span className="px-3 py-1 bg-white/90 rounded-lg border border-slate-300 shadow-2xs font-mono">
                    NPA: <strong className="text-emerald-800">{member.memberNumber}</strong>
                  </span>
                  <span className="px-3 py-1 bg-white/90 rounded-lg border border-slate-300 shadow-2xs font-mono">
                    NIK: <strong className="text-slate-900">{member.nik}</strong>
                  </span>
                  <span className="px-3 py-1 bg-white/90 rounded-lg border border-slate-300 shadow-2xs">
                    Cluster / RT: <strong className="text-slate-900">{member.cluster || '-'}</strong>
                  </span>
                  <span className="px-3 py-1 bg-emerald-100/90 text-emerald-900 rounded-lg border border-emerald-300 shadow-2xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Status: Anggota Tetap Sah</span>
                  </span>
                </div>

                {/* FORMAL ATTESTATION STATEMENT */}
                <p className="text-[11px] sm:text-xs text-slate-700 max-w-2xl mx-auto leading-relaxed font-sans px-4">
                  Telah memenuhi seluruh rangkaian proses verifikasi kependudukan oleh <strong>{certInfo.verifiedByRt}</strong>, 
                  pelunasan administrasi gotong royong terverifikasi oleh <strong>{certInfo.verifiedByTreasurer}</strong>, 
                  serta disahkan resmi oleh <strong>{certInfo.approvedByPaguyuban}</strong>. Anggota beserta seluruh keluarga tanggungan 
                  memiliki hak perlindungan fardhu kifayah, santunan duka cita, dan ambulans 24 jam.
                </p>

                {/* COVERED DEPENDENTS SUMMARY (IF CHECKED) */}
                {showDependents && member.dependentsList && member.dependentsList.length > 0 && (
                  <div className="bg-white/80 border border-slate-300 rounded-xl p-2.5 max-w-2xl mx-auto font-sans text-left shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1.5">
                      <span className="flex items-center gap-1 text-emerald-900">
                        <Users className="w-3 h-3 text-emerald-700" />
                        <span>Daftar Anggota Keluarga / Ahli Waris Terlindungi:</span>
                      </span>
                      <span className="text-amber-800 font-extrabold">
                        Total: {(member.dependentsCount || 0) + 1} Jiwa Tercover
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] text-slate-700">
                      {member.dependentsList.map((dep, idx) => (
                        <div key={dep.id || idx} className="truncate bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <span className="font-bold text-slate-900">{dep.name}</span>
                          <span className="text-slate-500 text-[9px] ml-1">({dep.relationship})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER SECTION: TRIPARTITE SIGNATURES & OFFICIAL SEAL */}
              <div className="relative z-10 pt-2 border-t border-slate-300 font-sans">
                {showSignatures ? (
                  <div className="grid grid-cols-3 items-end text-center text-xs">
                    
                    {/* Left: Ketua RT Setempat */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
                        Verifikator Lingkungan
                      </p>
                      <p className="text-[11px] font-bold text-slate-900">
                        {certInfo.verifiedByRt}
                      </p>
                      <div className="h-10 flex items-center justify-center">
                        <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-[9px] font-bold text-emerald-800">
                          ✓ Terverifikasi RT
                        </div>
                      </div>
                      <div className="w-32 h-0.5 bg-slate-400 mx-auto" />
                      <p className="text-[9px] text-slate-500">Ketua RT Setempat</p>
                    </div>

                    {/* Middle: Official Seal & Scannable QR Code */}
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <div className="p-1 bg-white rounded-lg shadow-sm border border-slate-300">
                        <QRCodeSVG
                          value={qrPayload || member.memberNumber}
                          size={52}
                          level="M"
                          bgColor="#FFFFFF"
                          fgColor="#0f172a"
                        />
                      </div>
                      <span className="text-[8px] font-mono font-bold text-slate-600 uppercase">
                        Scan Validasi Keaslian
                      </span>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Ditetapkan: {certInfo.issueDate}
                      </p>
                    </div>

                    {/* Right: Ketua Paguyuban (Official Signer) */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
                        Pengesahan Akhir
                      </p>
                      <p className="text-[11px] font-bold text-slate-900">
                        {certInfo.approvedByPaguyuban}
                      </p>
                      <div className="h-10 flex items-center justify-center">
                        {certInfo.isIssued ? (
                          <div className="px-2 py-0.5 bg-amber-50 border border-amber-300 rounded text-[9px] font-bold text-amber-800">
                            ★ Disahkan & Sah
                          </div>
                        ) : (
                          <div className="px-2 py-0.5 bg-rose-50 border border-rose-300 rounded text-[9px] font-bold text-rose-800">
                            Menunggu Pengesahan Ketua Paguyuban
                          </div>
                        )}
                      </div>
                      <div className="w-32 h-0.5 bg-slate-400 mx-auto" />
                      <p className="text-[9px] text-slate-500">Ketua Paguyuban Dana Kematian</p>
                    </div>

                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>No. Registrasi: {certInfo.certificateNumber}</span>
                    <span>Ditetapkan di: {communityAddress}</span>
                    <span>Masa Berlaku: {expiry.expiryDateFormatted}</span>
                  </div>
                )}

                {/* Subfooter Note */}
                <p className="text-[8px] text-center text-slate-500 mt-2 italic font-serif">
                  * Sertifikat ini adalah bukti sah kepesertaan Paguyuban Dana Kematian yang diterbitkan secara elektronik dan terikat dengan AD/ART Paguyuban.
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* MODAL FOOTER BAR */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Proses terbit sama dengan KTA (Lolos Verifikasi RT ➔ Validasi Kas Bendahara ➔ Pengesahan Ketua Paguyuban).
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenKtaModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenKtaModal(member);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Lihat Format KTA</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Unduh Gambar (PNG)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
