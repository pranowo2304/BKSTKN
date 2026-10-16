import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Payment, Member, SystemSettings, AppUser } from '../types';
import { formatIDR } from '../lib/storage';
import { terbilang } from '../lib/terbilang';
import { generateReceiptPdf } from '../lib/pdfGenerator';
import {
  cleanPhoneNumberForWhatsApp,
  formatPhoneDisplay,
  findMemberForPayment,
  generateReceiptTextMessage,
  generateReceiptWhatsAppUrl,
  generateReceiptQrPayload,
  buildReceiptValidationUrl,
  getEffectivePaymentPeriod,
  getSystemConfiguredPeriod,
} from '../lib/receiptUtils';
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  ShieldCheck,
  Send,
  Copy,
  Check,
  Phone,
  Edit3,
  User,
  ExternalLink,
  MessageSquare,
  QrCode,
  ArrowLeft,
  Download,
  Loader2,
  FileDown,
  HeartHandshake,
  PenTool,
} from 'lucide-react';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { SignatureData } from './DigitalSignaturePad';

interface ReceiptModalProps {
  isOpen?: boolean;
  payment: Payment | null;
  members?: Member[];
  member?: Member | null;
  settings: SystemSettings;
  activeUser?: AppUser;
  onClose: () => void;
  onUpdatePayment?: (payment: Payment) => void;
  onSaveDefaultSignature?: (signatureUrl: string, signerName: string, signerTitle: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  members = [],
  member,
  settings,
  activeUser,
  onClose,
  onUpdatePayment,
  onSaveDefaultSignature,
}) => {
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(payment);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureSuccessNotice, setSignatureSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPayment(payment);
  }, [payment]);

  // If payment prop is null or closed, modal should not render
  if (!payment) return null;

  const activePayment = currentPayment || payment;

  const [copied, setCopied] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharingFile, setIsSharingFile] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const isBendahara = activeUser?.authority === 'Bendahara';
  const isPaymentVerified = activePayment.status === 'Verified';

  // Ketentuan wewenang:
  // Yang bisa mengirim kwitansi setelah diverifikasi pembayaran oleh bendahara, HANYA bendahara.
  // Anggota hanya bisa download kwitansi.
  const canSendReceipt = isBendahara && isPaymentVerified;
  const isAnggota = activeUser?.authority === 'Anggota';

  // Automatically find registered member corresponding to this payment
  const targetMember = member || (activePayment ? findMemberForPayment(activePayment, members) : undefined);

  useEffect(() => {
    if (activePayment) {
      const foundPhone = targetMember?.phone || '';
      setTargetPhone(foundPhone);
      setIsEditingPhone(!foundPhone);
      setSendFeedback(null);
    }
  }, [activePayment?.id, targetMember?.id, targetMember?.phone]);

  const handleSaveSignature = (data: SignatureData) => {
    if (!activePayment) return;
    const updated: Payment = {
      ...activePayment,
      adminSignature: data.signatureUrl,
      adminSignerName: data.signerName,
      adminSignerTitle: data.signerTitle,
      adminSignatureDate: data.signedAt,
      verifiedAt: activePayment.verifiedAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
      verifiedBy: activePayment.verifiedBy || data.signerName,
    };
    setCurrentPayment(updated);
    if (onUpdatePayment) {
      onUpdatePayment(updated);
    }
    if (data.saveAsDefault && onSaveDefaultSignature) {
      onSaveDefaultSignature(data.signatureUrl, data.signerName, data.signerTitle);
    }
    setIsSignatureModalOpen(false);
    setSignatureSuccessNotice('Tanda tangan digital verifikasi berhasil dibubuhkan pada Kwitansi.');
    setTimeout(() => setSignatureSuccessNotice(null), 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activePayment) return null;

  const handlePrint = () => {
    window.print();
  };

  const getPdfBlobAndFilename = () => {
    const qrDataUrl = qrCanvasRef.current ? qrCanvasRef.current.toDataURL('image/png') : undefined;

    const doc = generateReceiptPdf({
      payment: activePayment,
      member: targetMember,
      settings,
      qrCodeDataUrl: qrDataUrl,
    });

    const effectivePeriod = getEffectivePaymentPeriod(activePayment, settings);
    const safeReceipt = (activePayment.receiptNumber || 'KW').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeNpa = (activePayment.memberNumber || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = (activePayment.memberName || 'Warga').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const safePeriod = effectivePeriod.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `Kwitansi-${safeReceipt}-${safeNpa}-${safeName}-${safePeriod}.pdf`;

    return { doc, blob: doc.output('blob'), filename };
  };

  const handleDownloadPdf = () => {
    if (!activePayment) return;
    try {
      setIsGeneratingPdf(true);
      const { doc, filename } = getPdfBlobAndFilename();
      doc.save(filename);
    } catch (error) {
      console.error('Error creating PDF:', error);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const receiptTextMessage = generateReceiptTextMessage(activePayment, targetMember, settings);

  /**
   * Share actual PDF file directly to WhatsApp using Web Share API (mobile/supported browsers)
   * or fallback to WhatsApp URL + instant PDF download
   * KHUSUS BENDAHARA setelah verifikasi
   */
  const handleSharePdfToWhatsApp = async () => {
    if (!activePayment) return;
    if (!canSendReceipt) {
      alert('Wewenang Terbatas: Pengiriman kwitansi via WhatsApp hanya dapat dilakukan oleh Bendahara setelah pembayaran diverifikasi sah.');
      return;
    }
    try {
      setIsSharingFile(true);
      const { blob, filename, doc } = getPdfBlobAndFilename();
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      // Check if Web Share API with file support is available (e.g. mobile Chrome / Safari)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        setSendFeedback('Membuka menu bagikan WhatsApp dengan file PDF terlampir...');
        await navigator.share({
          files: [pdfFile],
          title: `Kwitansi Pembayaran ${activePayment.receiptNumber}`,
          text: receiptTextMessage,
        });
        setSendFeedback('File PDF kwitansi berhasil dibagikan.');
      } else {
        // Fallback for Desktop / Unsupported browsers:
        // 1. Trigger instant download of PDF
        doc.save(filename);
        // 2. Open WhatsApp Web / App with formatted text
        const waUrl = generateReceiptWhatsAppUrl(activePayment, targetMember, settings, targetPhone);
        setSendFeedback('File PDF otomatis terunduh. Membuka WhatsApp untuk melampirkan file...');
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing PDF file:', error);
        // Fallback to text WhatsApp
        handleWhatsAppSend();
      }
    } finally {
      setIsSharingFile(false);
      setTimeout(() => setSendFeedback(null), 5000);
    }
  };

  const handleWhatsAppSend = () => {
    if (!canSendReceipt) {
      alert('Wewenang Terbatas: Pengiriman kwitansi via WhatsApp hanya dapat dilakukan oleh Bendahara setelah pembayaran diverifikasi sah.');
      return;
    }
    const waUrl = generateReceiptWhatsAppUrl(activePayment, targetMember, settings, targetPhone);
    const cleaned = cleanPhoneNumberForWhatsApp(targetPhone);

    if (cleaned) {
      setSendFeedback(`Membuka WhatsApp ke nomor +${cleaned}...`);
    } else {
      setSendFeedback(`Membuka WhatsApp...`);
    }

    setTimeout(() => {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }, 150);

    setTimeout(() => {
      setSendFeedback(null);
    }, 4000);
  };

  const handleCopyText = () => {
    if (!canSendReceipt) {
      alert('Wewenang Terbatas: Salin teks rincian kwitansi untuk pengiriman hanya dapat dilakukan oleh Bendahara.');
      return;
    }
    navigator.clipboard.writeText(receiptTextMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const cleanPhone = cleanPhoneNumberForWhatsApp(targetPhone);
  const displayPhone = targetPhone ? formatPhoneDisplay(targetPhone) : '';
  const receiptQrPayload = generateReceiptQrPayload(activePayment, targetMember, settings);
  const receiptValidationUrl = buildReceiptValidationUrl(activePayment.receiptNumber);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          /* Hide background page elements */
          body * {
            visibility: hidden !important;
          }
          /* Only make printable receipt and its children visible */
          #receipt-printable,
          #receipt-printable * {
            visibility: visible !important;
          }
          #receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          #receipt-printable-card {
            border: 2px solid #0f172a !important;
            box-shadow: none !important;
            border-radius: 12px !important;
            padding: 24px !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print\\:hidden,
          .no-print-receipt {
            display: none !important;
            visibility: hidden !important;
          }
          @page {
            size: auto;
            margin: 12mm 15mm;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200 my-6 sm:my-8 print:my-0 print:border-none print:shadow-none print:max-w-none print:w-full">
        
        {/* Top Control Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between print:hidden border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
              title="Kembali ke tampilan sebelumnya (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Kembali</span>
            </button>
            <div className="hidden sm:block h-5 w-px bg-slate-700 mx-1" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-xs sm:text-sm block leading-tight">Kwitansi Pembayaran Resmi</span>
                <span className="text-[10px] text-slate-400 font-mono">No. {activePayment.receiptNumber}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {canSendReceipt && (
              <>
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95"
                  title="Bubuhkan atau perbarui tanda tangan digital verifikasi admin pada kwitansi"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{activePayment.adminSignature ? 'Ubah TTD' : 'Tanda Tangan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSharePdfToWhatsApp}
                  disabled={isSharingFile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                  title="Kirim dokumen file PDF Kwitansi langsung ke WhatsApp warga"
                >
                  {isSharingFile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span>Kirim PDF ke WA</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppSend}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl transition-all border border-emerald-600/60"
                  title="Kirim teks rincian kwitansi resmi langsung ke WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Kirim Teks WA</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md shadow-emerald-950/40 border border-emerald-400/40 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Unduh Kwitansi resmi berformat PDF bersih & profesional"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-white" />
              )}
              <span>Unduh PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 shadow-xs hover:border-slate-600"
              title="Cetak Kwitansi Fisik (Print / Simpan PDF)"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cetak Kwitansi</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-900/40 hover:text-rose-200 transition-colors rounded-xl border border-slate-700"
              title="Tutup Modal Kwitansi"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Tutup</span>
            </button>
          </div>
        </div>

        {/* RECIPIENT WHATSAPP BANNER (Khusus Admin / Pengurus / Bendahara) */}
        {canSendReceipt ? (
          <div className="bg-emerald-950 text-white px-4 sm:px-6 py-3.5 border-b border-emerald-900 print:hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm border border-emerald-400/40">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200">Kirim Kwitansi via WhatsApp:</span>
                    {cleanPhone ? (
                      <span className="font-mono font-bold text-emerald-200 bg-emerald-900/90 px-2.5 py-0.5 rounded-md border border-emerald-700 inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        {displayPhone}
                      </span>
                    ) : (
                      <span className="text-amber-300 font-medium italic bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80">
                        Belum ada nomor HP tersimpan
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-emerald-800/80 text-emerald-200 text-[10px] font-bold rounded-full border border-emerald-700">
                      {targetMember?.phone ? '✓ Terhubung Data Anggota' : 'Input Manual'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Anggota Penerima: <strong className="text-white">{activePayment.memberName}</strong> ({activePayment.memberNumber}) {targetMember?.cluster ? `• ${targetMember.cluster}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                {!isEditingPhone ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="text-[11px] font-bold text-emerald-300 hover:text-emerald-100 inline-flex items-center gap-1 hover:underline px-2.5 py-1.5 bg-emerald-900/80 rounded-lg border border-emerald-700/80 transition-colors"
                    title="Ganti nomor tujuan WhatsApp manual jika diperlukan"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Ubah No. HP</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in">
                    <input
                      type="text"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="e.g. 081234567890"
                      className="px-2.5 py-1.5 bg-emerald-900 border border-emerald-500 rounded-lg text-xs text-white placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono w-40"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(false)}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg transition-colors"
                    >
                      Simpan
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleWhatsAppSend}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-lg transition-all shadow-sm hover:scale-105 active:scale-95 inline-flex items-center gap-1.5"
                  title={`Kirim teks kwitansi langsung ke nomor WhatsApp ${targetPhone || activePayment.memberName}`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pesan WA</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-emerald-950 text-xs font-black rounded-lg transition-all shadow-sm hover:scale-105 active:scale-95 inline-flex items-center gap-1.5 border border-emerald-300 disabled:opacity-50 cursor-pointer"
                  title="Unduh berkas dokumen PDF Kwitansi resmi ke komputer / perangkat"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                  <span>Unduh PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleSharePdfToWhatsApp}
                  disabled={isSharingFile}
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 hover:text-white text-xs font-bold rounded-lg border border-emerald-600 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  title="Bagikan dokumen PDF kwitansi ke WhatsApp"
                >
                  {isSharingFile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                  <span>Kirim PDF</span>
                </button>
              </div>
            </div>

            {sendFeedback && (
              <div className="mt-2.5 text-xs font-bold text-emerald-200 bg-emerald-900/90 px-3 py-1.5 rounded-lg border border-emerald-700 animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{sendFeedback}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 text-slate-200 px-5 py-3 sm:px-6 text-xs border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="font-bold text-white block">
                  Kwitansi Digital Resmi • {isPaymentVerified ? 'Diverifikasi oleh Bendahara' : 'Menunggu Verifikasi'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {isPaymentVerified
                    ? `Disahkan oleh ${activePayment.adminSignerName || settings.treasurerName || 'Bendahara'}. Anggota dapat mengunduh berkas kwitansi resmi PDF untuk arsip pribadi.`
                    : 'Kwitansi resmi dapat diunduh setelah diverifikasi oleh Bendahara.'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 font-mono text-[11px] font-bold rounded-lg border ${
                isPaymentVerified
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {isPaymentVerified ? '✓ Lunas Terverifikasi' : '⏳ Menunggu Verifikasi'}
              </span>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
                title="Unduh kwitansi resmi dalam bentuk dokumen PDF"
              >
                {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        )}

        {signatureSuccessNotice && (
          <div className="bg-indigo-900 text-white px-4 sm:px-6 py-2.5 text-xs font-bold border-b border-indigo-700 flex items-center gap-2 print:hidden animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{signatureSuccessNotice}</span>
          </div>
        )}

        {/* PRINTABLE RECEIPT CONTENT */}
        <div className="p-4 sm:p-8 bg-slate-50/50 print:p-0 print:bg-white" id="receipt-printable">
          {/* Quick Print & Download Action Banner (Screen only) */}
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs print:hidden text-xs">
            <div className="flex items-center gap-2.5 text-slate-700">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0 border border-emerald-300">
                <FileDown className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block leading-tight">
                  Format Cetak Kwitansi Resmi Bersih & Profesional (A4)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Dilengkapi QR otentikasi digital, stempel kas paguyuban, dan tanda tangan sah.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                title="Unduh berkas dokumen PDF Kwitansi Resmi"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>Unduh PDF Resmi</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer"
                title="Cetak langsung ke printer fisik atau simpan PDF browser"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Cetak Kwitansi</span>
              </button>
            </div>
          </div>

          <div 
            id="receipt-printable-card"
            className="bg-white border-2 border-slate-300 rounded-xl p-5 sm:p-8 relative shadow-sm overflow-hidden print:border-none print:shadow-none"
          >
            
            {/* Watermark Seal */}
            <div className="absolute right-4 top-20 opacity-5 pointer-events-none select-none">
              <ShieldCheck className="w-64 h-64 text-emerald-800" />
            </div>

            {/* Receipt Header (Kop Surat Resmi: Background Putih, Tulisan Hitam) */}
            <div className="bg-white pb-3 sm:pb-4 border-b-2 border-black">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  {settings.logoUrl ? (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border-2 border-black p-1 flex items-center justify-center shrink-0 shadow-2xs">
                      <img
                        src={settings.logoUrl}
                        alt={settings.communityName}
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black shrink-0">
                      <HeartHandshake className="w-6 h-6 text-black" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-base sm:text-xl font-black text-black tracking-tight uppercase leading-tight">
                      {settings.communityName}
                    </h2>
                    <p className="text-xs text-black font-semibold mt-1 max-w-md">{settings.communityAddress}</p>
                    <p className="text-[11px] text-black font-medium mt-0.5">Pengelola Dana Kematian Masyarakat • Transparan, Amanah & Akuntabel</p>
                  </div>
                </div>
                <div className="text-left sm:text-right border-t sm:border-t-0 pt-2.5 sm:pt-0 w-full sm:w-auto border-black shrink-0">
                  <div className="inline-block px-3 py-1 bg-white border-2 border-black text-black text-xs font-black rounded-md uppercase tracking-wider mb-1">
                    KWITANSI RESMI
                  </div>
                  <p className="font-mono text-sm font-black text-black">No. {activePayment.receiptNumber}</p>
                  <p className="text-[11px] text-black font-semibold mt-0.5">Tgl: {activePayment.verifiedAt || activePayment.createdAt}</p>
                </div>
              </div>

              {/* Garis Ganda Kop Surat Resmi Indonesia (Hitam) */}
              <div className="mt-3.5 sm:mt-4">
                <div className="h-[2.5px] bg-black w-full"></div>
                <div className="h-[1px] bg-black w-full mt-[2px]"></div>
              </div>
            </div>

            {/* Receipt Body Table */}
            <div className="py-5 sm:py-6 space-y-3.5 text-xs sm:text-sm text-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-medium">Telah Diterima Dari</span>
                <span className="sm:col-span-2 font-bold text-slate-900 text-sm sm:text-base">
                  {activePayment.memberName} <span className="font-normal text-xs text-slate-500">({activePayment.memberNumber})</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-medium">Uang Sejumlah</span>
                <span className="sm:col-span-2 font-semibold text-emerald-700 italic bg-emerald-50/70 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs sm:text-sm">
                  "{terbilang(activePayment.amount)}"
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-medium">Untuk Pembayaran</span>
                <div className="sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                    <span>{activePayment.paymentType}</span>
                    <span>—</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {getEffectivePaymentPeriod(activePayment, settings)}
                    </span>
                    {settings?.membershipPeriod && (
                      <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200 print:hidden">
                        ✓ Sesuai Pengaturan Sistem
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-medium">Metode Pembayaran</span>
                <span className="sm:col-span-2 text-slate-800 font-mono text-xs bg-slate-100 inline-block px-2.5 py-1 rounded w-fit font-bold">
                  {activePayment.paymentMethod}
                </span>
              </div>
            </div>

            {/* Total Amount Box */}
            <div className="my-4 bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-300 font-medium uppercase tracking-wider">Total Nominal Terbayar</p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-0.5">
                  {formatIDR(activePayment.amount)}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>LUNAS & TERVERIFIKASI</span>
              </div>
            </div>

            {/* Footer Signature, Stempel Sah & QR Code */}
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t-2 border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
              <div>
                {/* Real QR Code of Member Number (NPA) & Transaction Verification */}
                <div className="flex items-center gap-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="p-1.5 bg-white rounded-lg border border-slate-300 shadow-xs shrink-0 flex items-center justify-center">
                    <QRCodeSVG
                      value={receiptQrPayload}
                      size={68}
                      level="M"
                      includeMargin={false}
                      bgColor="#FFFFFF"
                      fgColor="#022c22"
                    />
                    {/* High-res off-screen canvas used for direct vector PDF export */}
                    <div style={{ position: 'fixed', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
                      <QRCodeCanvas
                        ref={qrCanvasRef}
                        value={receiptQrPayload}
                        size={256}
                        level="M"
                        includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#022c22"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <QrCode className="w-3 h-3 text-emerald-700" />
                      <span className="font-bold uppercase tracking-wider text-emerald-800 text-[9px]">
                        QR Code Validasi Resmi
                      </span>
                    </div>
                    <p className="font-mono font-bold text-slate-900 text-xs">
                      NPA: {activePayment.memberNumber}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono">
                      No. Kwitansi: {activePayment.receiptNumber}
                    </p>
                    <p className="text-emerald-700 font-bold text-[9px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      Status: Lunas & Terverifikasi
                    </p>
                  </div>
                </div>
              </div>

              {/* STEMPEL SAH RESMI (NAMA PAGUYUBAN SESUAI PENGATURAN SYSTEM) */}
              <div className="flex flex-col items-center justify-center py-1 sm:py-2">
                <div className="relative w-32 h-32 rounded-full border-[2.5px] border-emerald-600 p-1 flex items-center justify-center shadow-xs -rotate-3 transition-transform hover:rotate-0 select-none bg-emerald-50/30">
                  {/* Inner ring */}
                  <div className="w-full h-full rounded-full border border-emerald-500/80 flex flex-col items-center justify-center p-1.5 text-center">
                    {/* Nama Paguyuban dari Pengaturan System */}
                    <span className="text-[9px] font-black text-emerald-800 tracking-tight leading-tight uppercase px-1 line-clamp-2">
                      ★ {settings.communityName || 'PAGUYUBAN DANA KEMATIAN'} ★
                    </span>
                    <div className="w-4/5 h-[1.5px] bg-emerald-600 my-1"></div>
                    <span className="text-xs font-black text-emerald-700 tracking-wider">
                      LUNAS & SAH
                    </span>
                    <span className="text-[8px] font-bold text-slate-900 uppercase tracking-tighter mt-0.5">
                      KAS DANA KEMATIAN
                    </span>
                    <div className="w-4/5 h-[1.5px] bg-emerald-600 my-1"></div>
                    <span className="text-[7.5px] font-bold text-emerald-800 tracking-wider">
                      TERVERIFIKASI RESMI
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-extrabold text-emerald-800 mt-1 uppercase tracking-wider print:hidden">
                  Stempel Sah Kas Paguyuban
                </span>
              </div>

              <div className="text-right flex flex-col items-end min-w-[200px]">
                <p className="text-[11px] text-slate-500">
                  {settings.communityAddress ? settings.communityAddress.split(',')[0] : 'Jakarta'}, {activePayment.verifiedAt ? activePayment.verifiedAt.split(' ')[0] : (activePayment.createdAt ? activePayment.createdAt.split(' ')[0] : '—')}
                </p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  {activePayment.adminSignerTitle || 'Bendahara / Pengurus Dana'}
                </p>

                {/* Digital Signature Container */}
                <div className="my-1.5 flex flex-col items-end">
                  {activePayment.adminSignature || settings.defaultAdminSignature ? (
                    <div className="flex flex-col items-end">
                      <div className="h-16 sm:h-20 w-40 flex items-center justify-center p-1 border border-dashed border-slate-300 rounded-lg bg-slate-50/60 overflow-hidden">
                        <img
                          src={activePayment.adminSignature || settings.defaultAdminSignature}
                          alt="Tanda Tangan Digital Verifikasi"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-1 justify-end mt-1 text-[9px] font-black text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>TTD DIGITAL RESMI TERVERIFIKASI</span>
                      </div>

                      {canSendReceipt && (
                        <button
                          type="button"
                          onClick={() => setIsSignatureModalOpen(true)}
                          className="print:hidden text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 mt-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                          title="Klik untuk mengubah atau memperbarui tanda tangan digital"
                        >
                          <PenTool className="w-2.5 h-2.5" />
                          <span>Ubah TTD</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-1 flex flex-col items-end">
                      {canSendReceipt && (
                        <button
                          type="button"
                          onClick={() => setIsSignatureModalOpen(true)}
                          className="print:hidden mb-1 px-3 py-1.5 border-2 border-dashed border-indigo-400 hover:border-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 rounded-lg text-[11px] font-black transition-all inline-flex items-center gap-1.5 shadow-xs hover:scale-105 active:scale-95"
                          title="Klik untuk membubuhkan tanda tangan digital pada kwitansi ini"
                        >
                          <PenTool className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                          <span>+ Bubuhkan Tanda Tangan Digital</span>
                        </button>
                      )}

                      <div className="h-9 flex items-center justify-end my-1">
                        <div className="border-2 border-emerald-600 bg-emerald-50 text-emerald-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider rotate-[-2deg] shadow-xs">
                          ✓ TERVERIFIKASI SAH
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs font-bold text-slate-900 underline">
                  {activePayment.adminSignerName || settings?.treasurerName}
                </p>
                {settings?.treasurerPhone && (
                  <p className="text-[10px] text-slate-500 font-mono">{settings.treasurerPhone}</p>
                )}
                {activePayment.adminSignatureDate && (
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Disahkan: {activePayment.adminSignatureDate}
                  </p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {canSendReceipt ? (
              <>
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] sm:text-xs">
                  Kirim langsung ke WA <strong className="text-slate-900">{activePayment.memberName}</strong> ({displayPhone || 'Nomor Anggota'})
                </span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] sm:text-xs text-slate-600">
                  Kwitansi Digital Terverifikasi Sah • Klik <strong className="text-emerald-700">Download PDF</strong> untuk menyimpan arsip bukti bayar
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-200 rounded-xl transition-all border border-slate-300 inline-flex items-center gap-1.5 shadow-2xs"
              title="Tutup kwitansi dan kembali ke tampilan sebelumnya"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Kembali</span>
            </button>

            {canSendReceipt && (
              <>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors border border-slate-300 bg-white inline-flex items-center gap-1.5 shadow-2xs"
                  title="Salin teks format WhatsApp"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Teks</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppSend}
                  className="px-4 py-2 text-xs sm:text-sm font-extrabold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-md hover:scale-105 active:scale-95"
                  title={`Kirim teks kwitansi via API WhatsApp ke ${targetPhone || activePayment.memberName}`}
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                  <span>Kirim Pesan WA</span>
                </button>

                <button
                  type="button"
                  onClick={handleSharePdfToWhatsApp}
                  disabled={isSharingFile}
                  className="px-3.5 py-2 text-xs sm:text-sm font-extrabold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-sm border border-emerald-500/50 hover:scale-105 active:scale-95 disabled:opacity-50"
                  title={`Kirim dokumen PDF Kwitansi resmi ke WhatsApp ${activePayment.memberName} (${displayPhone})`}
                >
                  {isSharingFile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyiapkan PDF...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Kirim PDF ke WA</span>
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20 border border-emerald-400/30 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Unduh kwitansi pembayaran resmi dalam bentuk dokumen PDF format bersih & profesional"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyiapkan PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-emerald-100" />
                  <span>Unduh PDF Resmi</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
              title="Cetak Kwitansi Fisik / Buka Dialog Cetak window.print()"
            >
              <Printer className="w-4 h-4 text-emerald-200" />
              <span>Cetak Kwitansi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Digital Signature Modal for Admin / Bendahara Verification */}
      <DigitalSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
        initialSignature={activePayment.adminSignature || settings.defaultAdminSignature}
        defaultSignerName={activePayment.adminSignerName || activeUser?.name || settings.defaultAdminSignerName || settings.treasurerName}
        defaultSignerTitle={activePayment.adminSignerTitle || settings.defaultAdminSignerTitle || 'Bendahara Paguyuban'}
        documentTitle={`Kwitansi Pembayaran ${activePayment.receiptNumber || ''} (${activePayment.memberName})`}
      />
    </div>
  );
};
