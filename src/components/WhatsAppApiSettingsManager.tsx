import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  RotateCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  Eye,
  EyeOff,
  Phone,
  Server,
  Sparkles,
  Sliders,
  CheckCheck,
  Clock,
  ChevronRight,
  Info,
} from 'lucide-react';
import { SystemSettings, WhatsAppNotificationLog, Member } from '../types';
import {
  getWhatsAppLogs,
  clearWhatsAppLogs,
  testWhatsAppApiConnection,
} from '../lib/whatsappService';
import { formatPhoneDisplay } from '../lib/receiptUtils';

interface WhatsAppApiSettingsManagerProps {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  members?: Member[];
}

export const WhatsAppApiSettingsManager: React.FC<WhatsAppApiSettingsManagerProps> = ({
  settings,
  onSaveSettings,
  members = [],
}) => {
  const [formData, setFormData] = useState<SystemSettings>({
    ...settings,
    whatsappApiEnabled: settings.whatsappApiEnabled !== false,
    whatsappProvider: settings.whatsappProvider || 'fonnte',
    whatsappApiEndpoint: settings.whatsappApiEndpoint || 'https://api.fonnte.com/send',
    whatsappApiToken: settings.whatsappApiToken || '',
    autoNotifyOnPaymentValidated: settings.autoNotifyOnPaymentValidated !== false,
    autoNotifyOnRtVerification: settings.autoNotifyOnRtVerification !== false,
    autoNotifyOnMemberStatusChange: settings.autoNotifyOnMemberStatusChange !== false,
    whatsappCustomFooter: settings.whatsappCustomFooter || `_Sistem Informasi Paguyuban Dana Kematian ${settings.communityName}_`,
  });

  const [showToken, setShowToken] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Test Sandbox State
  const [testPhone, setTestPhone] = useState<string>(settings.treasurerPhone || '081234567890');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    directLink?: string;
    rawResponse?: string;
  } | null>(null);

  // Notification Logs
  const [logs, setLogs] = useState<WhatsAppNotificationLog[]>([]);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const refreshLogs = () => {
    setLogs(getWhatsAppLogs());
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleProviderChange = (provider: 'fonnte' | 'waha' | 'custom_webhook' | 'direct_link') => {
    let defaultEndpoint = formData.whatsappApiEndpoint;
    if (provider === 'fonnte') {
      defaultEndpoint = 'https://api.fonnte.com/send';
    } else if (provider === 'waha') {
      defaultEndpoint = 'http://localhost:3000/api/sendText';
    } else if (provider === 'custom_webhook') {
      defaultEndpoint = defaultEndpoint || 'https://your-api-gateway.com/webhook';
    }

    setFormData((prev) => ({
      ...prev,
      whatsappProvider: provider,
      whatsappApiEndpoint: defaultEndpoint,
    }));
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testWhatsAppApiConnection({
        testPhone,
        settings: formData,
      });
      setTestResult({
        success: res.success,
        message: res.message,
        directLink: res.directLink,
        rawResponse: res.log?.responseInfo,
      });
      refreshLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Terjadi kesalahan saat memproses pengujian API.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyLogMessage = (log: WhatsAppNotificationLog) => {
    navigator.clipboard.writeText(log.message);
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2500);
  };

  const handleClearLogs = () => {
    if (window.confirm('Hapus seluruh riwayat log notifikasi WhatsApp?')) {
      clearWhatsAppLogs();
      refreshLogs();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Status */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>Otomatisasi Notifikasi WhatsApp API</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Gateway Notifikasi Status & KTA Anggota
            </h3>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Setiap perubahan status kepesertaan warga (seperti status <strong>Aktif</strong> setelah pembayaran iuran divalidasi Bendahara, atau persetujuan pendaftaran oleh Ketua RT) akan langsung terkirim secara otomatis ke nomor WhatsApp anggota yang terdaftar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-3 rounded-2xl flex items-center justify-between sm:justify-start gap-4">
              <div>
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Status Fitur</p>
                <p className="text-sm font-black text-emerald-300 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${formData.whatsappApiEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  {formData.whatsappApiEnabled ? 'Aktif Otomatis' : 'Non-Aktif'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.whatsappApiEnabled}
                  onChange={(e) => setFormData({ ...formData, whatsappApiEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Form Konfigurasi Gateway */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-base">Pilihan Provider & Kredensial API</h4>
              <p className="text-xs text-slate-500">Pilih penyedia WhatsApp Gateway yang digunakan oleh Paguyuban.</p>
            </div>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan WhatsApp Tersimpan!</span>
            </div>
          )}
        </div>

        {/* Provider Cards Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Fonnte API */}
          <div
            onClick={() => handleProviderChange('fonnte')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              formData.whatsappProvider === 'fonnte'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            {formData.whatsappProvider === 'fonnte' && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Rekomendasi
                </span>
              </div>
              <h5 className="font-black text-slate-900 text-sm">Fonnte API</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Layanan gateway WhatsApp Indonesia. Stabil, tanpa instalasi server, cukup masukkan Token API Fonnte.
              </p>
            </div>
            <p className="text-[10px] text-emerald-700 font-bold mt-3">api.fonnte.com/send</p>
          </div>

          {/* WAHA (WhatsApp HTTP API) */}
          <div
            onClick={() => handleProviderChange('waha')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              formData.whatsappProvider === 'waha'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            {formData.whatsappProvider === 'waha' && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
            <div>
              <h5 className="font-black text-slate-900 text-sm">WAHA (Self-Hosted)</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                WhatsApp HTTP API berbasis Docker / VPS mandiri untuk organisasi dengan server pribadi.
              </p>
            </div>
            <p className="text-[10px] text-slate-600 font-bold mt-3">localhost / VPS Gateway</p>
          </div>

          {/* Custom Webhook */}
          <div
            onClick={() => handleProviderChange('custom_webhook')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              formData.whatsappProvider === 'custom_webhook'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            {formData.whatsappProvider === 'custom_webhook' && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
            <div>
              <h5 className="font-black text-slate-900 text-sm">Custom Webhook</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Meneruskan payload JSON data notifikasi ke endpoint API / microservice internal Paguyuban.
              </p>
            </div>
            <p className="text-[10px] text-slate-600 font-bold mt-3">Custom JSON Endpoint</p>
          </div>

          {/* Direct Link (wa.me) */}
          <div
            onClick={() => handleProviderChange('direct_link')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              formData.whatsappProvider === 'direct_link'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            {formData.whatsappProvider === 'direct_link' && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
            <div>
              <h5 className="font-black text-slate-900 text-sm">Mode Tautan Langsung (wa.me)</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Tanpa API Gateway pihak ketiga. Menyediakan tautan 1-klik yang otomatis membuka WhatsApp dengan draf pesan resmi.
              </p>
            </div>
            <p className="text-[10px] text-slate-600 font-bold mt-3">100% Gratis / Tanpa Biaya</p>
          </div>
        </div>

        {/* Input Form Fields */}
        {formData.whatsappProvider !== 'direct_link' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* API Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>API Token / Secret Key</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showToken ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={formData.whatsappApiToken || ''}
                  onChange={(e) => setFormData({ ...formData, whatsappApiToken: e.target.value })}
                  placeholder={
                    formData.whatsappProvider === 'fonnte'
                      ? 'Contoh: xK9_BLa7y... (Dapatkan dari fonnte.com)'
                      : 'Masukkan Token API Gateway'
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                {formData.whatsappProvider === 'fonnte' ? (
                  <span>
                    Daftar di{' '}
                    <a
                      href="https://fonnte.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-bold underline inline-flex items-center gap-0.5"
                    >
                      fonnte.com <ExternalLink className="w-2.5 h-2.5" />
                    </a>{' '}
                    untuk mendapatkan token perangkat WhatsApp Paguyuban.
                  </span>
                ) : (
                  'Kunci otentikasi untuk otorisasi permintaan ke gateway WhatsApp Anda.'
                )}
              </p>
            </div>

            {/* API Endpoint URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>URL Endpoint API</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.whatsappApiEndpoint || ''}
                  onChange={(e) => setFormData({ ...formData, whatsappApiEndpoint: e.target.value })}
                  placeholder="https://api.fonnte.com/send"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (formData.whatsappProvider === 'fonnte') {
                      setFormData({ ...formData, whatsappApiEndpoint: 'https://api.fonnte.com/send' });
                    } else if (formData.whatsappProvider === 'waha') {
                      setFormData({ ...formData, whatsappApiEndpoint: 'http://localhost:3000/api/sendText' });
                    }
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                  title="Reset ke endpoint default"
                >
                  Reset
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Alamat URL tujuan pengiriman pesan HTTP POST dari aplikasi.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Mode Tautan Langsung Aktif</p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Pada mode ini, pesan tidak dikirim otomatis di latar belakang melalui server gateway, melainkan sistem akan menyiapkan tautan langsung WhatsApp resmi (wa.me) yang dapat diklik oleh Bendahara atau Admin dengan sekali klik untuk membuka pesan terformat ke nomor anggota.
              </p>
            </div>
          </div>
        )}

        {/* Automation Triggers Switches */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pemicu Pengiriman Otomatis (Automation Triggers)</span>
          </h5>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Trigger 1: Payment Validated -> Member Status: Aktif */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900">Pembayaran Divalidasi (Status: Aktif)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kirim kwitansi, masa perlindungan, dan KTA Digital saat Bendahara mengesahkan iuran.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.autoNotifyOnPaymentValidated !== false}
                onChange={(e) => setFormData({ ...formData, autoNotifyOnPaymentValidated: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Trigger 2: RT Verification Approved / Rejected */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900">Verifikasi Wilayah / RT</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kirim notifikasi pendaftaran disetujui (info transfer) atau ditolak oleh Ketua RT.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.autoNotifyOnRtVerification !== false}
                onChange={(e) => setFormData({ ...formData, autoNotifyOnRtVerification: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Trigger 3: General Status Changes */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900">Perubahan Status Anggota Lainnya</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kirim notifikasi saat status berubah ke Masa Tenggang, Non-Aktif, atau Pengurus.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.autoNotifyOnMemberStatusChange !== false}
                onChange={(e) => setFormData({ ...formData, autoNotifyOnMemberStatusChange: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer Text */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-700">Teks Penutup Pesan (Footer WhatsApp)</label>
          <input
            type="text"
            value={formData.whatsappCustomFooter || ''}
            onChange={(e) => setFormData({ ...formData, whatsappCustomFooter: e.target.value })}
            placeholder="Contoh: _Sistem Informasi Paguyuban Dana Kematian_"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Konfigurasi WhatsApp API</span>
          </button>
        </div>
      </form>

      {/* 3. Kotak Uji Coba Langsung (Live Test Sandbox) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-base">Uji Coba Pengiriman Notifikasi WhatsApp</h4>
            <p className="text-xs text-slate-500">
              Kirimkan pesan uji coba langsung ke nomor Anda untuk memastikan Token API dan nomor tujuan berfungsi normal.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-slate-700">Nomor WhatsApp Tujuan Uji Coba</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="sm:self-end">
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isTesting}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-bounce' : ''}`} />
              <span>{isTesting ? 'Sedang Mengirim Uji Coba...' : 'Kirim Pesan Uji Coba'}</span>
            </button>
          </div>
        </div>

        {/* Live Result Feedback */}
        {testResult && (
          <div
            className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row items-start justify-between gap-3 animate-in fade-in duration-200 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-sm">
                  {testResult.success ? 'Uji Coba WhatsApp Berhasil Terkirim!' : 'Perhatian Hasil Pengujian:'}
                </p>
                <p className="text-xs leading-relaxed">{testResult.message}</p>
                {testResult.rawResponse && (
                  <p className="font-mono text-[10px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200 mt-1.5 max-w-xl break-all">
                    Response Server: {testResult.rawResponse}
                  </p>
                )}
              </div>
            </div>

            {testResult.directLink && (
              <a
                href={testResult.directLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>Buka di WhatsApp Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* 4. Riwayat Pengiriman Notifikasi WhatsApp (Delivery Audit Logs) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-base">Riwayat Pengiriman Notifikasi WhatsApp</h4>
              <p className="text-xs text-slate-500">
                Catatan log pengiriman otomatis notifikasi perubahan status dan validasi iuran ke nomor warga ({logs.length} riwayat).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshLogs}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Segarkan Log"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Hapus Seluruh Riwayat Log"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan</span>
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Belum ada riwayat notifikasi WhatsApp</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Notifikasi akan otomatis tercatat di sini setiap kali ada pengesahan pembayaran warga, pendaftaran baru, atau pengujian pesan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Waktu</th>
                  <th className="py-3 px-3">Penerima & No. HP</th>
                  <th className="py-3 px-3">Peristiwa / Trigger</th>
                  <th className="py-3 px-3">Status Pengiriman</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {new Date(log.timestamp).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{log.recipientName}</div>
                        <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                          <span>{formatPhoneDisplay(log.recipientPhone)}</span>
                          <span className="text-[10px] text-slate-400">({log.memberNumber})</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.triggerType === 'status_active' || log.triggerType === 'payment_validated'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.triggerType === 'rt_approved'
                              ? 'bg-blue-100 text-blue-800'
                              : log.triggerType === 'test_message'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {log.triggerType === 'status_active'
                            ? 'KTA Aktif (Bayar Lunas)'
                            : log.triggerType === 'payment_validated'
                            ? 'Validasi Kas'
                            : log.triggerType === 'rt_approved'
                            ? 'Verifikasi RT Disetujui'
                            : log.triggerType === 'rt_rejected'
                            ? 'Verifikasi RT Ditolak'
                            : log.triggerType === 'test_message'
                            ? 'Uji Coba API'
                            : 'Status Diperbarui'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Terkirim Otomatis (API)</span>
                          </span>
                        ) : log.status === 'fallback_ready' ? (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                            <span>Siap Kirim (Direct WA)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Gagal</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyLogMessage(log)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Salin Teks Pesan"
                          >
                            {copiedLogId === log.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {log.directWaLink && (
                            <a
                              href={log.directWaLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                              title="Buka Pesan di WhatsApp Web"
                            >
                              <span>Buka WA</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
