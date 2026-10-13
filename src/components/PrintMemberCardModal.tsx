import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Member, Payment, SystemSettings } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload } from '../lib/ktaUtils';
import { formatIDR } from '../lib/storage';
import {
  X,
  Printer,
  Share2,
  Check,
  QrCode,
  ShieldCheck,
  Scissors,
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
} from 'lucide-react';

interface PrintMemberCardModalProps {
  member: Member | null;
  payments?: Payment[];
  settings?: SystemSettings;
  isOpen: boolean;
  onClose: () => void;
  onSelectMemberForPayment?: (member: Member) => void;
}

export const PrintMemberCardModal: React.FC<PrintMemberCardModalProps> = ({
  member,
  payments = [],
  settings,
  isOpen,
  onClose,
  onSelectMemberForPayment,
}) => {
  if (!isOpen || !member) return null;

  const [printLayout, setPrintLayout] = useState<'both' | 'front' | 'back'>('both');
  const [colorTheme, setColorTheme] = useState<'emerald' | 'monochrome' | 'navy'>('emerald');
  const [includeCutGuides, setIncludeCutGuides] = useState(true);
  const [includeDependents, setIncludeDependents] = useState(true);
  const [copied, setCopied] = useState(false);

  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian Warga';
  const communityAddress = settings?.communityAddress || 'Sekretariat Paguyuban Warga';
  const treasurerPhone = settings?.treasurerPhone || '0812-3456-7890';

  // QR Code payload containing verifiable member identity
  const qrPayload = generateKtaQrPayload(
    member,
    ktaInfo,
    settings,
    expiry.expiryDateFormatted
  );

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = (member.phone || '').replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0')
      ? '62' + cleanPhone.slice(1)
      : cleanPhone.startsWith('62')
      ? cleanPhone
      : '62' + cleanPhone;

    const message = encodeURIComponent(
      `*KARTU ANGGOTA RESMI (CETAK / DIGITAL)*\n${communityName}\n\n` +
      `• Nama: *${member.name}*\n` +
      `• No. Pokok Anggota (NPA): *${member.memberNumber}*\n` +
      `• NIK: ${member.nik}\n` +
      `• Cluster: ${member.cluster || '-'}\n` +
      `• Tanggal Gabung: ${member.joinDate}\n` +
      `• Status: *${member.status}* (${expiry.statusLabel})\n` +
      `• Masa Berlaku: *${expiry.expiryDateFormatted}*\n` +
      `• Tanggungan Terdaftar: *${member.dependentsCount} Jiwa*\n` +
      `• Pengesahan: ${ktaInfo.issuedBy || 'Bendahara'} (${ktaInfo.receiptNumber || 'LUNAS'})\n\n` +
      `_Kartu fisik dapat dicetak dan dilaminating untuk keperluan verifikasi darurat dan santunan rukun kematian._`
    );

    window.open(`https://wa.me/${intlPhone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyCardData = () => {
    const text = `*KARTU TANDA ANGGOTA PAGUYUBAN*\n${communityName}\n\n• Nama: ${member.name}\n• NPA: ${member.memberNumber}\n• NIK: ${member.nik}\n• Cluster: ${member.cluster}\n• Status: ${member.status} (${expiry.statusLabel})\n• Masa Berlaku: ${expiry.expiryDateFormatted}\n• Tanggungan: ${member.dependentsCount} Jiwa\n• Disahkan Oleh: ${ktaInfo.issuedBy || 'Bendahara'} (${ktaInfo.receiptNumber || 'LUNAS'})\n• Kontak Bantuan: ${treasurerPhone}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Dynamic Theme Styling Classes
  const getThemeFrontStyles = () => {
    if (colorTheme === 'monochrome') {
      return {
        cardBg: 'bg-white text-slate-900 border-2 border-slate-900',
        headerBg: 'bg-slate-900 text-white',
        headerSub: 'text-slate-300',
        badgeBg: 'bg-slate-100 text-slate-900 border-slate-400',
        accentText: 'text-slate-900',
        qrBorder: 'border-slate-800',
        chipBg: 'bg-slate-200 border-slate-400 text-slate-700',
        footerBg: 'bg-slate-100 border-t border-slate-300 text-slate-700',
        stripColor: 'bg-slate-900',
      };
    }
    if (colorTheme === 'navy') {
      return {
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white border-2 border-blue-600/50',
        headerBg: 'bg-blue-950/80 text-white border-b border-blue-900',
        headerSub: 'text-blue-200',
        badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
        accentText: 'text-blue-400',
        qrBorder: 'border-blue-400',
        chipBg: 'bg-amber-400 border-amber-300 text-amber-950',
        footerBg: 'bg-slate-950/80 border-t border-blue-900/60 text-slate-300',
        stripColor: 'bg-blue-600',
      };
    }
    // Default: Emerald Paguyuban
    return {
      cardBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500/50',
      headerBg: 'bg-emerald-950/90 text-white border-b border-emerald-900',
      headerSub: 'text-emerald-200',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      accentText: 'text-emerald-400',
      qrBorder: 'border-emerald-400',
      chipBg: 'bg-amber-400 border-amber-300 text-amber-950',
      footerBg: 'bg-slate-950/90 border-t border-emerald-900/60 text-slate-300',
      stripColor: 'bg-emerald-600',
    };
  };

  const getThemeBackStyles = () => {
    if (colorTheme === 'monochrome') {
      return {
        cardBg: 'bg-white text-slate-900 border-2 border-slate-900',
        headerBg: 'bg-slate-900 text-white',
        accentText: 'text-slate-900',
        innerBox: 'bg-slate-50 border-slate-300 text-slate-800',
        footerBg: 'bg-slate-100 border-t border-slate-300 text-slate-700',
      };
    }
    if (colorTheme === 'navy') {
      return {
        cardBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white border-2 border-blue-600/50',
        headerBg: 'bg-blue-950/80 text-white border-b border-blue-900',
        accentText: 'text-blue-400',
        innerBox: 'bg-slate-950/70 border-blue-950 text-slate-200',
        footerBg: 'bg-slate-950/80 border-t border-blue-900/60 text-slate-300',
      };
    }
    // Default: Emerald
    return {
      cardBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500/50',
      headerBg: 'bg-emerald-950/90 text-white border-b border-emerald-900',
      accentText: 'text-emerald-400',
      innerBox: 'bg-slate-950/70 border-emerald-950 text-slate-200',
      footerBg: 'bg-slate-950/90 border-t border-emerald-900/60 text-slate-300',
    };
  };

  const frontTheme = getThemeFrontStyles();
  const backTheme = getThemeBackStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-w-none print:w-full print:bg-white print:max-h-none">
        
        {/* MODAL HEADER (Hidden in Print) */}
        <div className="bg-slate-950 text-white p-4 sm:p-5 px-6 border-b border-slate-800 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">
                  Cetak Kartu Tanda Anggota (KTA)
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
                Tata letak kartu presisi siap cetak (Standar ID Card / CR80 85.6mm × 54mm) dengan QR Code verifikasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CUSTOMIZATION TOOLBAR (Hidden in Print) */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          {/* Layout Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Sisi Kartu:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPrintLayout('both')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  printLayout === 'both'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Depan & Belakang
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('front')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  printLayout === 'front'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Depan Saja
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('back')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  printLayout === 'back'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Belakang Saja
              </button>
            </div>
          </div>

          {/* Color Theme Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-emerald-400" /> Tema Tinta:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setColorTheme('emerald')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  colorTheme === 'emerald'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Warna Resmi Paguyuban (Hijau Elegan)"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Hijau Resmi</span>
              </button>
              <button
                type="button"
                onClick={() => setColorTheme('navy')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  colorTheme === 'navy'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Warna Biru Navy Modern"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span>Navy</span>
              </button>
              <button
                type="button"
                onClick={() => setColorTheme('monochrome')}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  colorTheme === 'monochrome'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Format Hemat Tinta Hitam Putih"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>Monokrom (Eco)</span>
              </button>
            </div>
          </div>

          {/* Options Switches */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-300 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={includeCutGuides}
                onChange={(e) => setIncludeCutGuides(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Garis Potong (Cut Guide)</span>
            </label>
            <label className="flex items-center gap-1.5 text-slate-300 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={includeDependents}
                onChange={(e) => setIncludeDependents(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Tampilkan Tanggungan</span>
            </label>
          </div>
        </div>

        {/* MODAL MAIN PREVIEW CONTAINER (PRINTABLE AREA) */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 bg-slate-950 print:p-0 print:bg-white print:overflow-visible">
          
          {/* Informational Guidance Notice (Hidden in Print) */}
          <div className="max-w-3xl mx-auto mb-6 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-start justify-between gap-3 print:hidden">
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white text-[13px]">
                  Petunjuk Pencetakan Kartu Fisik:
                </p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Pilih ukuran kertas <strong>A4</strong> atau kertas foto tebal / PVC Card. Atur <strong>Scale: 100%</strong> dan aktifkan <strong>"Background Graphics"</strong> pada jendela cetak browser agar warna dan QR Code tampil tajam.
                </p>
              </div>
            </div>
            {!ktaInfo.isIssued && (
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-lg shrink-0">
                ⚠️ Status Draft
              </span>
            )}
          </div>

          {/* PRINTABLE SHEET CONTAINER (Target of window.print) */}
          <div id="member-card-printable" className="max-w-3xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-none">
            
            <div className={`grid ${printLayout === 'both' ? 'grid-cols-1 md:grid-cols-2 print:grid-cols-2' : 'grid-cols-1'} gap-6 items-start justify-center`}>
              
              {/* ==================== SISI DEPAN (FRONT CARD) ==================== */}
              {(printLayout === 'both' || printLayout === 'front') && (
                <div className="flex flex-col items-center">
                  <div className="w-full text-center mb-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-600">
                    SISI DEPAN (FRONT SIDE)
                  </div>
                  
                  {/* Card Container with precise CR80 / ID-1 Aspect Ratio */}
                  <div
                    className={`relative w-full max-w-[420px] aspect-[1.586/1] rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-2xl select-none transition-all duration-200 ${frontTheme.cardBg} ${
                      includeCutGuides ? 'border-dashed' : 'border-solid'
                    } print:shadow-none print:border-slate-800`}
                    style={{ minHeight: '250px' }}
                  >
                    {/* Background Security Watermark */}
                    <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
                    <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                    {/* CARD HEADER */}
                    <div className="flex items-start justify-between relative z-10 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2.5">
                        {settings.logoUrl ? (
                          <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-slate-200 shrink-0">
                            <img
                              src={settings.logoUrl}
                              alt={communityName}
                              className="max-h-full max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0 font-bold">
                            <HeartHandshake className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[7.5px] font-black uppercase tracking-widest text-emerald-400">
                              KARTU TANDA ANGGOTA RESMI
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          </div>
                          <h4 className="font-black text-xs sm:text-sm tracking-tight leading-tight">
                            {communityName}
                          </h4>
                          <p className="text-[8px] opacity-80 truncate max-w-[200px]">
                            {member.cluster || 'Cluster Warga'} • {communityAddress}
                          </p>
                        </div>
                      </div>

                      {/* Chip RFID Hologram */}
                      <div className="flex flex-col items-end shrink-0">
                        <div className="w-8 h-6 rounded-md bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 border border-amber-300 shadow-inner flex items-center justify-center relative overflow-hidden">
                          <div className="w-full h-[1px] bg-amber-700/60 my-0.5" />
                          <div className="absolute inset-0 border border-amber-600/40 rounded-sm" />
                        </div>
                        <span className="text-[6.5px] font-mono text-emerald-400/90 mt-0.5 tracking-tighter">
                          KTA SECURE ID
                        </span>
                      </div>
                    </div>

                    {/* CARD BODY: Profile, NPA, NIK, QR Code */}
                    <div className="grid grid-cols-12 gap-2.5 items-center my-auto py-1 relative z-10">
                      
                      {/* Left Info: Avatar & Main Details (8 cols) */}
                      <div className="col-span-8 space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-800 to-slate-800 border-2 border-emerald-400/60 text-white font-black text-base flex items-center justify-center shadow-md shrink-0 font-mono overflow-hidden">
                            {member.photoUrl ? (
                              <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              member.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] text-slate-400 font-medium leading-none mb-0.5">Nama Anggota:</p>
                            <h3 className="font-black text-xs sm:text-sm truncate leading-tight tracking-wide">
                              {member.name}
                            </h3>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[8.5px] font-extrabold rounded border border-emerald-500/40 font-mono">
                                {member.memberNumber}
                              </span>
                              <span className="px-1 py-0.2 bg-emerald-500 text-slate-950 text-[7px] font-black rounded uppercase">
                                Sah
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Metadata Box */}
                        <div className="grid grid-cols-2 gap-1 text-[8.5px] bg-black/40 p-1.5 rounded-lg border border-white/10 font-mono">
                          <div>
                            <span className="opacity-60 block text-[6.5px]">NIK KTP:</span>
                            <span className="font-bold truncate block">{member.nik}</span>
                          </div>
                          <div>
                            <span className="opacity-60 block text-[6.5px]">Cluster / RT:</span>
                            <span className="font-bold text-emerald-300 truncate block">{member.cluster || '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Info: QR Code (4 cols) */}
                      <div className="col-span-4 flex flex-col items-center justify-center">
                        <div className="p-1 bg-white rounded-lg shadow-md border-2 border-emerald-400/80 flex flex-col items-center">
                          <QRCodeSVG
                            value={qrPayload}
                            size={64}
                            level="H"
                            includeMargin={false}
                            bgColor="#FFFFFF"
                            fgColor="#022c22"
                          />
                        </div>
                        <span className="text-[6.5px] font-bold text-emerald-400 text-center mt-1 uppercase tracking-tighter">
                          Scan Validasi KTA
                        </span>
                      </div>

                    </div>

                    {/* CARD FOOTER */}
                    <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[7.5px] relative z-10">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="opacity-60 block text-[6.5px]">Pengesahan:</span>
                          <span className="font-mono font-semibold truncate max-w-[85px] block">
                            {ktaInfo.issuedBy || 'Bendahara'}
                          </span>
                        </div>
                        <div>
                          <span className="opacity-60 block text-[6.5px]">Masa Iuran:</span>
                          <span className={`font-mono font-bold ${expiry.isExpired ? 'text-rose-400' : 'text-emerald-300'}`}>
                            {expiry.expiryDateFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-emerald-400 font-bold text-[7.5px]">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{member.dependentsCount + 1} Jiwa Terlindungi</span>
                      </div>
                    </div>

                    {/* Cut Guide Scissors Indicator */}
                    {includeCutGuides && (
                      <div className="absolute top-1 right-2 text-[7px] font-mono text-slate-400 flex items-center gap-0.5 opacity-60">
                        <Scissors className="w-2.5 h-2.5" />
                        <span>potong</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== SISI BELAKANG (BACK CARD) ==================== */}
              {(printLayout === 'both' || printLayout === 'back') && (
                <div className="flex flex-col items-center">
                  <div className="w-full text-center mb-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-600">
                    SISI BELAKANG (BACK SIDE)
                  </div>

                  {/* Card Container */}
                  <div
                    className={`relative w-full max-w-[420px] aspect-[1.586/1] rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-2xl select-none transition-all duration-200 ${backTheme.cardBg} ${
                      includeCutGuides ? 'border-dashed' : 'border-solid'
                    } print:shadow-none print:border-slate-800`}
                    style={{ minHeight: '250px' }}
                  >
                    {/* Header: Title & NPA */}
                    <div className="border-b border-white/10 pb-1 flex justify-between items-center">
                      <h4 className="font-black text-[10px] text-emerald-400 uppercase tracking-wider">
                        KETENTUAN HAK & LAYANAN SANTUNAN
                      </h4>
                      <span className="text-[7.5px] font-mono opacity-75">
                        NPA: {member.memberNumber}
                      </span>
                    </div>

                    {/* Benefit Rules List */}
                    <div className="space-y-1 text-[7.5px] sm:text-[8px] opacity-90 leading-relaxed my-auto py-1">
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>
                          Kartu ini adalah bukti keanggotaan sah pada <strong>{communityName}</strong>.
                        </li>
                        <li>
                          Hak santunan meliputi <strong>Fardhu Kifayah, Kain Kafan Lengkap, dan Ambulans Jenazah 24 Jam</strong>.
                        </li>
                        <li>
                          Dana duka disalurkan langsung kepada ahli waris sah sesuai data terverifikasi.
                        </li>
                      </ol>

                      {/* Covered Dependents */}
                      {includeDependents && (
                        <div className="bg-black/30 p-1.5 rounded-lg border border-white/10 mt-1">
                          <p className="font-bold text-emerald-400 text-[7px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            <span>Tanggungan Terdaftar ({member.dependentsList?.length || 0} Jiwa):</span>
                          </p>
                          {member.dependentsList && member.dependentsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {member.dependentsList.map((dep, idx) => (
                                <span key={idx} className="px-1 py-0.2 bg-white/10 text-white rounded text-[6.5px] border border-white/10">
                                  {dep.name} ({dep.relationship})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[6.5px] opacity-60 italic">Belum ada daftar tanggungan tambahan.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Digital Signature & Stamp Footer */}
                    <div className="pt-1.5 border-t border-white/10 flex justify-between items-end text-[7px]">
                      <div>
                        <p className="opacity-60 text-[6.5px]">Layanan Ambulans & Bantuan:</p>
                        <p className="font-mono font-bold">{treasurerPhone}</p>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <div className="flex items-center gap-1 text-emerald-400 font-extrabold text-[7.5px]">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Disahkan Bendahara</span>
                        </div>
                        <p className="opacity-60 text-[6.5px] mt-0.5">
                          {ktaInfo.issuedBy || 'Bendahara Paguyuban'}
                        </p>
                      </div>
                    </div>

                    {/* Cut Guide Indicator */}
                    {includeCutGuides && (
                      <div className="absolute top-1 right-2 text-[7px] font-mono text-slate-400 flex items-center gap-0.5 opacity-60">
                        <Scissors className="w-2.5 h-2.5" />
                        <span>potong</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* FOLD & LAMINATE INSTRUCTION GUIDE (Print Only) */}
            {includeCutGuides && printLayout === 'both' && (
              <div className="text-center pt-3 text-[10px] text-slate-500 font-mono print:block hidden">
                ----------------------------- ✂️ Gunting mengikuti garis putus-putus lalu lipat dua dan laminating ✂️ -----------------------------
              </div>
            )}

          </div>
        </div>

        {/* MODAL FOOTER ACTIONS (Hidden in Print) */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>KTA Sah Digital • Format ID-1 Siap Cetak & Laminating</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopyCardData}
              className="px-3.5 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5"
              title="Salin rincian data kartu ke clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Data'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95"
              title="Kirim rincian KTA ke WhatsApp anggota"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Kirim WA</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-950/50 inline-flex items-center gap-2 hover:scale-105 active:scale-95"
              title="Buka dialog cetak browser (Ctrl+P / Cmd+P)"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Cetak Kartu Sekarang</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
