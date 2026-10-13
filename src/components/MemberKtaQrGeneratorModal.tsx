import React, { useState, useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  X,
  QrCode,
  Share2,
  Download,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  Maximize2,
  Minimize2,
  Sparkles,
  Info,
  CheckCircle2,
  HeartHandshake,
  MessageCircle,
} from 'lucide-react';
import { Member, Payment, SystemSettings } from '../types';
import {
  getMemberKtaIssuanceInfo,
  generateKtaSecurityToken,
  buildKtaValidationUrl,
  generateKtaStructuredPayload,
} from '../lib/ktaUtils';
import { calculateMemberExpiry } from '../lib/expiryUtils';

export interface MemberKtaQrGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  payments?: Payment[];
  settings?: SystemSettings;
}

export const MemberKtaQrGeneratorModal: React.FC<MemberKtaQrGeneratorModalProps> = ({
  isOpen,
  onClose,
  member,
  payments = [],
  settings,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNpa, setCopiedNpa] = useState(false);
  const [qrMode, setQrMode] = useState<'url' | 'npa' | 'json'>('url');
  const [isFullscreenScan, setIsFullscreenScan] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen || !member) return null;

  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);
  const expiryInfo = calculateMemberExpiry(member, payments, new Date(), settings);
  const securityToken = generateKtaSecurityToken(member, ktaInfo);
  const validationUrl = buildKtaValidationUrl(member.memberNumber, securityToken);

  // Generate QR payload according to selected format
  let qrPayload = validationUrl;
  if (qrMode === 'npa') {
    qrPayload = member.memberNumber;
  } else if (qrMode === 'json') {
    qrPayload = JSON.stringify(
      generateKtaStructuredPayload(
        member,
        ktaInfo,
        settings || {
          communityName: 'Paguyuban Warga',
          annualFeeAmount: 300000,
          currency: 'IDR',
          bankAccountName: 'KAS PAGUYUBAN',
          bankAccountNumber: '1234567890',
          bankName: 'BCA',
        },
        expiryInfo.expiryDateFormatted,
        securityToken
      )
    );
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(validationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyNpa = async () => {
    try {
      await navigator.clipboard.writeText(member.memberNumber);
      setCopiedNpa(true);
      setTimeout(() => setCopiedNpa(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadQrImage = () => {
    // Build a nicely framed badge image on a hidden canvas and trigger download
    const qrCanvas = canvasRef.current;
    if (!qrCanvas) return;

    try {
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      const width = 600;
      const height = 800;
      exportCanvas.width = width;
      exportCanvas.height = height;

      // 1. Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#064e3b'); // Dark emerald
      bgGrad.addColorStop(0.3, '#022c22');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. White Card Container for QR
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(40, 160, width - 80, 500, 24);
      ctx.fill();

      // 3. Header Text on dark background
      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        (settings?.communityName || 'PAGUYUBAN DANA KEMATIAN').toUpperCase(),
        width / 2,
        60
      );

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px sans-serif';
      ctx.fillText('KARTU TANDA ANGGOTA DIGITAL RESMI', width / 2, 90);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Pindai menggunakan kamera smartphone untuk verifikasi', width / 2, 115);

      // 4. Draw QR Canvas into card
      const qrSize = 340;
      const qrX = (width - qrSize) / 2;
      const qrY = 195;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // 5. Member Info on Card
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(member.name, width / 2, 580);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`NPA: ${member.memberNumber}`, width / 2, 615);

      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.fillText(
        `${member.cluster || 'Cluster Warga'} • Status: ${ktaInfo.isIssued ? 'KTA Resmi Terbit' : 'Terdaftar'}`,
        width / 2,
        642
      );

      // 6. Security token footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(`Token Keamanan: ${securityToken}`, width / 2, 720);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText('Sistem Administrasi Rukun Warga & Paguyuban Terpadu', width / 2, 745);

      // Trigger download
      const link = document.createElement('a');
      const safeName = member.name.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `QR_KTA_${member.memberNumber}_${safeName}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    } catch {
      // Direct fallback
      const dataUrl = qrCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `QR_KTA_${member.memberNumber}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleShareWhatsApp = () => {
    const orgName = settings?.communityName || 'Paguyuban Dana Kematian';
    const message = `*KARTU TANDA ANGGOTA (KTA) DIGITAL RESMI*
*${orgName}*

Halo Bapak/Ibu, berikut adalah KTA Digital resmi:
• *Nama Warga:* ${member.name}
• *No. Pokok Anggota (NPA):* ${member.memberNumber}
• *Wilayah/Cluster:* ${member.cluster || '-'}
• *Status KTA:* ${ktaInfo.isIssued ? '✅ Resmi Terbit & Aktif' : '⏳ Dalam Verifikasi'}
• *Token Validasi:* ${securityToken}

Pindai QR Code atau buka tautan verifikasi keaslian KTA berikut:
${validationUrl}

_Disimpan dan diterbitkan secara digital oleh Sistem Administrasi Paguyuban._`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isFullscreenScan) onClose();
      }}
    >
      {/* Hidden high-res canvas for image downloads */}
      <div className="hidden">
        <QRCodeCanvas
          ref={canvasRef}
          value={qrPayload}
          size={512}
          level="H"
          includeMargin={true}
          bgColor="#ffffff"
          fgColor="#022c22"
        />
      </div>

      {isFullscreenScan ? (
        /* ================= FULLSCREEN QUICK SCAN DISPLAY ================= */
        <div className="w-full max-w-sm sm:max-w-md bg-white text-slate-950 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center justify-center text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between w-full">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mode Scan Layar Penuh</span>
            </span>
            <button
              type="button"
              onClick={() => setIsFullscreenScan(false)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              title="Tutup Mode Layar Penuh"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {member.name}
            </h3>
            <p className="font-mono text-sm font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl inline-block border border-emerald-200">
              NPA: {member.memberNumber}
            </p>
          </div>

          {/* Oversized QR Code with high contrast white padding */}
          <div className="p-5 sm:p-6 bg-white rounded-3xl border-4 border-slate-900 shadow-xl flex items-center justify-center">
            <QRCodeSVG
              value={qrPayload}
              size={260}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#022c22"
            />
          </div>

          <div className="space-y-2 max-w-xs">
            <p className="text-xs text-slate-600 font-medium">
              Arahkan kamera smartphone lain langsung ke QR Code ini untuk membuka KTA Digital secara instan.
            </p>
            <button
              type="button"
              onClick={() => setIsFullscreenScan(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
            >
              Kembali ke Pengaturan QR
            </button>
          </div>
        </div>
      ) : (
        /* ================= STANDARD GENERATOR MODAL ================= */
        <div className="w-full max-w-lg bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>Generator QR Code KTA</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                    Berdasarkan NPA
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  QR Code unik resmi untuk scan & bagikan KTA Digital
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Member Profile Badge */}
            <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white text-base shadow shrink-0">
                  {member.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-sm text-white truncate">{member.name}</p>
                    {ktaInfo.isIssued ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                        KTA Aktif
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                        {ktaInfo.statusBadge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={handleCopyNpa}
                      className="font-mono text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group cursor-pointer"
                      title="Salin NPA Warga"
                    >
                      <span>NPA: {member.memberNumber}</span>
                      {copiedNpa ? (
                        <Check className="w-3 h-3 text-emerald-300" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500 group-hover:text-emerald-300 transition-colors" />
                      )}
                    </button>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-400 truncate">{member.cluster || 'Cluster Warga'}</span>
                  </div>
                </div>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreenScan(true)}
                className="p-2 sm:px-3 sm:py-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-600 shrink-0 flex items-center gap-1.5 cursor-pointer"
                title="Tampilkan Layar Penuh untuk Di-scan"
              >
                <Maximize2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Layar Penuh</span>
              </button>
            </div>

            {/* Format Selection Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Pilih Format Konten QR Code:</span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {qrMode === 'url' ? 'Scan Kamera HP' : qrMode === 'npa' ? 'NPA Saja' : 'JSON Sistem'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setQrMode('url')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    qrMode === 'url'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  Tautan KTA (Rekomendasi)
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('npa')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    qrMode === 'npa'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  Kode NPA Saja
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('json')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    qrMode === 'json'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  Data Digital Lengkap
                </button>
              </div>
            </div>

            {/* QR Card Presentation */}
            <div className="bg-gradient-to-b from-slate-800 to-slate-900/90 rounded-2xl p-5 border border-slate-700/80 shadow-inner flex flex-col items-center text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] tracking-wider uppercase font-black text-emerald-400">
                  {settings?.communityName || 'PAGUYUBAN DANA KEMATIAN'}
                </p>
                <p className="text-xs text-slate-300 font-medium">
                  Scan untuk mengakses KTA Digital Resmi
                </p>
              </div>

              {/* The QR Code Graphic with White Border */}
              <div className="p-3.5 bg-white rounded-2xl shadow-xl border-2 border-emerald-500/40 relative group">
                <QRCodeSVG
                  value={qrPayload}
                  size={190}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#022c22"
                />
              </div>

              {/* Security signature & NPA indicator */}
              <div className="w-full bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-left space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Nomor Pokok Anggota (NPA):</span>
                  <span className="font-mono font-black text-emerald-400">{member.memberNumber}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Token Tanda Tangan:</span>
                  <span className="font-mono text-[10px] text-slate-300 truncate max-w-[180px]">
                    {securityToken}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Grid (WhatsApp, Download PNG, Copy Link) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Share WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer"
                title="Kirim KTA ke WhatsApp warga atau pengurus"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Bagikan WhatsApp</span>
              </button>

              {/* 2. Download PNG */}
              <button
                type="button"
                onClick={handleDownloadQrImage}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 cursor-pointer"
                title="Unduh Kartu QR Code beresolusi tinggi"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Unduh Gambar</span>
              </button>

              {/* 3. Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className={`py-2.5 px-3 font-bold text-xs rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  copiedLink
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600 hover:text-white'
                }`}
                title="Salin tautan resmi KTA"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Salin Tautan</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Education / Instructions */}
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/40 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
              <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold text-emerald-300">
                  Cara Warga Membagikan KTA Digital:
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Cukup perlihatkan QR Code ini ke petugas, warga lain, atau rumah sakit. Kamera ponsel standar (iPhone / Android / Google Lens) dapat langsung memindai QR ini tanpa memerlukan aplikasi khusus, untuk memverifikasi hak santunan secara real-time.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verifikasi Keaslian Terenkripsi</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
