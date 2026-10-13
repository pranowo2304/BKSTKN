import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Share2,
  FileText,
  X,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Printer,
} from 'lucide-react';
import { Payment, Member, SystemSettings } from '../types';
import {
  generateReceiptWhatsAppUrl,
  generateReceiptTextMessage,
  cleanPhoneNumberForWhatsApp,
  formatPhoneDisplay,
} from '../lib/receiptUtils';
import { formatIDR } from '../lib/storage';
import {
  dispatchWhatsAppNotification,
  buildPaymentValidatedActiveMessage,
} from '../lib/whatsappService';
import { Zap, RotateCw } from 'lucide-react';

interface PostVerifyWhatsAppModalProps {
  payment: Payment | null;
  targetMember?: Member | null;
  settings: SystemSettings;
  isOpen: boolean;
  onClose: () => void;
  onViewReceipt: (payment: Payment) => void;
}

export const PostVerifyWhatsAppModal: React.FC<PostVerifyWhatsAppModalProps> = ({
  payment,
  targetMember,
  settings,
  isOpen,
  onClose,
  onViewReceipt,
}) => {
  const [targetPhone, setTargetPhone] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [hasOpenedWa, setHasOpenedWa] = useState<boolean>(false);
  const [isSendingViaApi, setIsSendingViaApi] = useState<boolean>(false);
  const [apiSendResult, setApiSendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (payment) {
      setTargetPhone(targetMember?.phone || '');
      setCopied(false);
      setShowPreview(false);
      setHasOpenedWa(false);
      setApiSendResult(null);
    }
  }, [payment, targetMember]);

  if (!isOpen || !payment) return null;

  const receiptTextMessage = generateReceiptTextMessage(payment, targetMember, settings);
  const waUrl = generateReceiptWhatsAppUrl(payment, targetMember, settings, targetPhone);
  const cleanedPhone = cleanPhoneNumberForWhatsApp(targetPhone);
  const hasValidPhone = cleanedPhone.length >= 9;

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptTextMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenWhatsApp = () => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setHasOpenedWa(true);
  };

  const handleSendViaApiGateway = async () => {
    if (!payment || !cleanedPhone) return;
    setIsSendingViaApi(true);
    setApiSendResult(null);
    try {
      const msg = targetMember
        ? buildPaymentValidatedActiveMessage({
            member: targetMember,
            payment,
            settings,
            expiryDateStr: payment.periodMonth ? `${payment.periodMonth} (1 Tahun)` : undefined,
          })
        : receiptTextMessage;

      const log = await dispatchWhatsAppNotification({
        phone: cleanedPhone,
        recipientName: targetMember?.name || payment.memberName,
        memberNumber: targetMember?.memberNumber || payment.memberNumber || 'ADK-WARGA',
        message: msg,
        triggerType: 'status_active',
        settings,
      });

      if (log.status === 'sent') {
        setApiSendResult({ success: true, message: `Pesan berhasil dikirim via WhatsApp Gateway ke +${cleanedPhone}!` });
      } else {
        setApiSendResult({
          success: false,
          message: log.responseInfo || 'Belum ada Token API terkonfigurasi. Silakan gunakan tombol WhatsApp Web.',
        });
      }
    } catch (err: any) {
      setApiSendResult({ success: false, message: err?.message || 'Gagal memproses pengiriman API.' });
    } finally {
      setIsSendingViaApi(false);
    }
  };

  const handleOpenFullReceipt = () => {
    onClose();
    onViewReceipt(payment);
  };

  return (
    <div
      id="post-verify-wa-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="post-verify-wa-modal"
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] transform transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Top Header Badge */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono tracking-wider uppercase font-extrabold px-2 py-0.5 bg-emerald-950/40 rounded-full border border-emerald-400/40 text-emerald-200">
                  Verifikasi Berhasil
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight mt-0.5">
                Kirim Kwitansi ke WhatsApp
              </h3>
            </div>
          </div>
          <button
            id="close-post-verify-modal-btn"
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Success Notification Alert */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="font-extrabold block text-emerald-950 text-sm mb-0.5">
                Pembayaran Resmi Disahkan oleh Bendahara!
              </strong>
              Status pembayaran iuran telah diperbarui menjadi{' '}
              <span className="font-bold text-emerald-800">Lunas Terverifikasi</span> dan saldo kas telah
              tercatat. Silakan kirim kwitansi digital resmi ini langsung ke WhatsApp anggota bersangkutan.
            </div>
          </div>

          {/* Payment & Member Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Penerima Kwitansi (Warga)
                </span>
                <span className="font-extrabold text-slate-900 text-base">
                  {targetMember?.name || payment.memberName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  No. Pokok Anggota
                </span>
                <span className="font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300 text-xs">
                  {targetMember?.memberNumber || payment.memberNumber || '-'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-[11px]">Jenis Pembayaran:</span>
                <span className="font-bold text-slate-800">{payment.paymentType}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Periode Iuran:</span>
                <span className="font-bold text-slate-800">{payment.periodMonth || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Nomor Kwitansi:</span>
                <span className="font-mono font-bold text-emerald-700">{payment.receiptNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Total Diterima:</span>
                <span className="font-black text-emerald-800 text-sm">{formatIDR(payment.amount)}</span>
              </div>
            </div>
          </div>

          {/* WhatsApp Phone Number Configuration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="target-wa-phone" className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nomor WhatsApp Anggota:</span>
              </label>
              {cleanedPhone && (
                <span className="text-[11px] text-slate-500 font-mono">
                  Format WA: <strong className="text-emerald-700 font-bold">+{cleanedPhone}</strong>
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="target-wa-phone"
                type="tel"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="Contoh: 08123456789 atau 628123456789"
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border font-mono transition-all outline-hidden ${
                  !targetPhone.trim()
                    ? 'border-amber-300 bg-amber-50/50 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                    : 'border-slate-300 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                }`}
              />
            </div>
            {!targetPhone.trim() ? (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <span>⚠️</span>
                <span>Nomor HP belum terdaftar. Masukkan nomor WhatsApp anggota untuk mengirimkan kwitansi.</span>
              </p>
            ) : !hasValidPhone ? (
              <p className="text-[11px] text-amber-700">
                Nomor terlalu pendek. Pastikan format nomor WhatsApp valid (minimal 9 digit).
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Kwitansi resmi akan langsung dibuka di obrolan chat WhatsApp nomor tersebut.
              </p>
            )}
          </div>

          {/* WhatsApp Automation & Gateway Status */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Otomatisasi WhatsApp API:</span>
              </span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  settings.whatsappApiToken && settings.whatsappApiEnabled !== false
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {settings.whatsappApiToken && settings.whatsappApiEnabled !== false
                  ? `Gateway ${settings.whatsappProvider || 'Fonnte'} Aktif`
                  : 'Mode Direct Link (wa.me)'}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-snug">
              {settings.whatsappApiToken && settings.whatsappApiEnabled !== false
                ? 'Sistem secara otomatis mengirimkan rincian aktivasi status KTA ke nomor HP anggota begitu pembayaran divalidasi.'
                : 'Pesan kwitansi dan KTA digital siap dikirimkan langsung ke nomor WhatsApp anggota dengan tombol di bawah.'}
            </p>

            {apiSendResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  apiSendResult.success
                    ? 'bg-emerald-100 border border-emerald-300 text-emerald-900'
                    : 'bg-amber-100 border border-amber-300 text-amber-900'
                }`}
              >
                {apiSendResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <RotateCw className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="text-[11px]">{apiSendResult.message}</span>
              </div>
            )}

            {settings.whatsappApiToken && (
              <button
                type="button"
                onClick={handleSendViaApiGateway}
                disabled={isSendingViaApi || !hasValidPhone}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isSendingViaApi ? 'Sedang Mengirim via Gateway...' : 'Kirim / Kirim Ulang via WhatsApp Gateway'}</span>
              </button>
            )}
          </div>

          {/* Message Preview Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left text-slate-700 font-bold transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pratinjau Format Pesan Kwitansi WhatsApp</span>
              </div>
              <span className="text-[11px] text-slate-500">{showPreview ? 'Sembunyikan ▲' : 'Buka ▼'}</span>
            </button>
            {showPreview && (
              <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                {receiptTextMessage}
              </div>
            )}
          </div>

          {hasOpenedWa && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-emerald-900">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>WhatsApp berhasil dibuka di tab/aplikasi baru!</span>
              </div>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] text-emerald-700 font-bold hover:underline shrink-0"
              >
                {copied ? 'Teks Tersalin!' : 'Salin Teks Cadangan'}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              id="copy-wa-receipt-text-btn"
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              title="Salin isi pesan kwitansi ke clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>

            <button
              id="view-full-receipt-btn"
              type="button"
              onClick={handleOpenFullReceipt}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 inline-flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              title="Buka tampilan kwitansi grafis penuh dan cetak PDF"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Buka Kwitansi (PDF)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              id="dismiss-post-verify-modal-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Tutup
            </button>

            <button
              id="send-wa-receipt-now-btn"
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-950/20 inline-flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Kirim pesan kwitansi langsung ke WhatsApp anggota"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>Kirim Kwitansi ke WA</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
