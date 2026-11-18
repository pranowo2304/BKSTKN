import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Save,
  Server,
  FileJson,
  Send,
  Loader2,
  CalendarClock,
  HardDrive,
} from 'lucide-react';
import {
  AppUser,
  BackupAutomationSettings,
  BackupDestination,
  BenefitClaim,
  Member,
  Payment,
  SystemSettings,
  TransactionBackupRecord,
} from '../types';
import {
  downloadBackupJsonFile,
  executeTransactionBackup,
  getEffectiveBackupSettings,
  getNextMidnightWibInfo,
  loadMergedBackupHistory,
  openBackupEmailDraft,
  removeBackupRecord,
} from '../lib/transactionBackup';

interface BackupAutomationManagerProps {
  settings: SystemSettings;
  payments: Payment[];
  claims: BenefitClaim[];
  members: Member[];
  baseFundBalance: number;
  activeUser?: AppUser | null;
  onSaveSettings: (newSettings: SystemSettings) => void;
  onNotifyBackupResult?: (title: string, message: string, isError?: boolean) => void;
}

export const BackupAutomationManager: React.FC<BackupAutomationManagerProps> = ({
  settings,
  payments,
  claims,
  members,
  baseFundBalance,
  activeUser,
  onSaveSettings,
  onNotifyBackupResult,
}) => {
  const effectiveCfg = getEffectiveBackupSettings(settings);

  const [enabled, setEnabled] = useState<boolean>(effectiveCfg.enabled);
  const [destination, setDestination] = useState<BackupDestination>(effectiveCfg.destination);
  const [adminEmail, setAdminEmail] = useState<string>(effectiveCfg.adminEmail);
  const [webhookUrl, setWebhookUrl] = useState<string>(effectiveCfg.webhookUrl || '');
  const [includeMembersSummary, setIncludeMembersSummary] = useState<boolean>(
    effectiveCfg.includeMembersSummary !== false
  );

  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [history, setHistory] = useState<TransactionBackupRecord[]>([]);
  const [serverStatus, setServerStatus] = useState<{
    emailConfigured: boolean;
    emailChannel: string;
    archiveCount: number;
  } | null>(null);
  const [midnightInfo, setMidnightInfo] = useState(() => getNextMidnightWibInfo());

  // Sync local form if settings update externally (e.g. after automated 00:00 run)
  useEffect(() => {
    const latest = getEffectiveBackupSettings(settings);
    setEnabled(latest.enabled);
    setDestination(latest.destination);
    setAdminEmail(latest.adminEmail);
    setWebhookUrl(latest.webhookUrl || '');
    setIncludeMembersSummary(latest.includeMembersSummary !== false);
  }, [settings]);

  // Live countdown to 00:00 WIB
  useEffect(() => {
    const timer = setInterval(() => {
      setMidnightInfo(getNextMidnightWibInfo());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const [records, statusRes] = await Promise.all([
        loadMergedBackupHistory(),
        fetch('/api/backup/status')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setHistory(records);
      if (statusRes) {
        setServerStatus({
          emailConfigured: Boolean(statusRes.emailConfigured),
          emailChannel: statusRes.emailChannel || 'none',
          archiveCount: Number(statusRes.archiveCount || 0),
        });
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const buildUpdatedSettings = (
    overridePartial?: Partial<BackupAutomationSettings>
  ): SystemSettings => {
    const currentAutomation = getEffectiveBackupSettings(settings);
    return {
      ...settings,
      backupAutomation: {
        ...currentAutomation,
        enabled,
        scheduleTimeWib: '00:00',
        destination,
        adminEmail: adminEmail.trim(),
        webhookUrl: webhookUrl.trim(),
        includeMembersSummary,
        ...overridePartial,
      },
    };
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = buildUpdatedSettings();
    onSaveSettings(updated);
    setSaveBanner('Konfigurasi otomatisasi backup JSON harian (00:00 WIB) berhasil disimpan.');
    setTimeout(() => setSaveBanner(null), 4000);
  };

  const handleRunBackupNow = async () => {
    if (isRunningBackup) return;
    setIsRunningBackup(true);
    setActionBanner(null);
    try {
      // Ensure latest config values are used during manual execution
      const stagedSettings = buildUpdatedSettings();
      const { record, updatedAutomationSettings } = await executeTransactionBackup({
        payments,
        claims,
        members,
        settings: stagedSettings,
        baseFundBalance,
        triggerType: 'manual',
        triggeredBy: activeUser?.name || 'Admin Sistem',
      });

      const finalSettings: SystemSettings = {
        ...stagedSettings,
        backupAutomation: updatedAutomationSettings,
      };
      onSaveSettings(finalSettings);

      await refreshData();

      if (updatedAutomationSettings.lastBackupStatus === 'success') {
        const msg = `Salinan JSON berhasil dibuat (${record.summary.paymentCount} transaksi iuran, ${record.summary.claimCount} santunan). ${updatedAutomationSettings.lastBackupMessage || ''}`;
        setActionBanner({ type: 'success', text: msg });
        onNotifyBackupResult?.('Backup Data Transaksi JSON Berhasil', msg, false);
      } else if (updatedAutomationSettings.lastBackupStatus === 'partial') {
        const msg = `Backup JSON tersimpan di Cloud Firestore/Server, namun pengiriman email otomatis belum terkirim: ${record.emailStatusNote || 'Periksa konfigurasi email/webhook.'}`;
        setActionBanner({ type: 'warning', text: msg });
        onNotifyBackupResult?.('Backup JSON Tersimpan di Cloud', msg, false);
      } else {
        const msg = updatedAutomationSettings.lastBackupMessage || 'Gagal menjalankan backup JSON.';
        setActionBanner({ type: 'error', text: msg });
        onNotifyBackupResult?.('Backup Data Transaksi Gagal', msg, true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses backup.';
      setActionBanner({ type: 'error', text: msg });
    } finally {
      setIsRunningBackup(false);
    }
  };

  const handleDeleteRecord = async (backupId: string) => {
    const remaining = await removeBackupRecord(backupId);
    setHistory(remaining);
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Status Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Otomatisasi Backup Transaksi JSON Harian (00:00 WIB)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  {enabled ? 'Aktif • 00:00 WIB' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                Mengarsipkan seluruh riwayat transaksi iuran, santunan duka, dan ringkasan kas dalam format JSON bertanda integritas SHA-256 ke Cloud Firestore serta meneruskannya ke Email Admin / Webhook setiap hari pukul 00:00 WIB.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRunningBackup}
            onClick={handleRunBackupNow}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isRunningBackup ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Backup...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Backup &amp; Kirim Sekarang</span>
              </>
            )}
          </button>
        </div>

        {/* Live Telemetry Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Jadwal Berikutnya (WIB)</span>
            </div>
            <p className="text-xs font-extrabold text-white">{midnightInfo.countdownLabel}</p>
            <p className="text-[10px] font-mono text-slate-400">Saat ini: {midnightInfo.currentTimeWib}</p>
          </div>

          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>Backup Terakhir</span>
            </div>
            <p className="text-xs font-extrabold text-white">
              {effectiveCfg.lastBackupAt || 'Belum pernah dijalankan'}
            </p>
            <p className="text-[10px] text-slate-300 truncate">
              {effectiveCfg.lastBackupMessage || 'Menunggu jadwal otomatis pukul 00:00 WIB'}
            </p>
          </div>

          <div className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>Transport Email Server</span>
            </div>
            <p className="text-xs font-extrabold text-white">
              {serverStatus?.emailConfigured
                ? serverStatus.emailChannel === 'resend_api'
                  ? 'Aktif (Resend API)'
                  : 'Aktif (SMTP Server)'
                : webhookUrl.trim()
                ? 'Aktif via Webhook Cloud'
                : 'Cloud Firestore + Draft Email'}
            </p>
            <p className="text-[10px] text-slate-400">
              {serverStatus?.emailConfigured
                ? `Pengiriman lampiran .json ke ${adminEmail || 'email admin'} otomatis`
                : 'Tambahkan SMTP/Resend di Secrets atau isi URL Webhook di bawah'}
            </p>
          </div>
        </div>
      </div>

      {/* Banners */}
      {saveBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveBanner}</span>
        </div>
      )}

      {actionBanner && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5 border ${
            actionBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : actionBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{actionBanner.text}</span>
        </div>
      )}

      {/* Configuration Form */}
      <form
        onSubmit={handleSaveConfig}
        className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Pengaturan Jadwal &amp; Tujuan Salinan JSON</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Jika sistem tidak sedang dibuka tepat pukul 00:00 WIB, sinkronisasi harian otomatis dijalankan segera saat pengurus membuka aplikasi pada hari tersebut.
            </p>
          </div>

          <label className="inline-flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-800">Aktifkan Jadwal 00:00 WIB</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Tujuan Penyimpanan &amp; Pengiriman Otomatis
            </label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as BackupDestination)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="cloud_and_email">Cloud Firestore + Email Admin (Disarankan)</option>
              <option value="cloud_only">Penyimpanan Cloud Firestore Saja</option>
              <option value="email_only">Email Admin / Webhook Saja</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Email Admin Penerima Salinan JSON
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@paguyuban.org"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              URL Webhook Cloud / Email Automation (Opsional — mis. Google Apps Script / Google Drive / Make)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500">
              Jika diisi, server akan meneruskan payload JSON lengkap (termasuk header checksum SHA-256) via HTTP POST ke endpoint tersebut setiap jadwal backup berjalan.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeMembersSummary}
              onChange={(e) => setIncludeMembersSummary(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
            />
            <span>Sertakan ringkasan status keanggotaan warga di dalam snapshot JSON</span>
          </label>

          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span>Simpan Pengaturan Backup</span>
          </button>
        </div>
      </form>

      {/* Cloud & Local Archive History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-emerald-600" />
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                Riwayat Salinan JSON Tersimpan ({history.length})
              </h4>
              <p className="text-[11px] text-slate-500">
                Tersimpan di Cloud Firestore &amp; arsip lokal. Klik Unduh JSON untuk mengarsipkan secara offline atau kirim manual ke email admin.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoadingHistory}
            onClick={refreshData}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileJson className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Belum ada arsip backup JSON tercatat</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Klik tombol <strong>Backup &amp; Kirim Sekarang</strong> di atas untuk membuat salinan JSON pertama, atau tunggu jadwal otomatis pukul 00:00 WIB.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900">
                      {item.backupDate}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.triggerType === 'scheduled_00_00'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {item.triggerType === 'scheduled_00_00' ? 'Otomatis 00:00 WIB' : 'Manual Admin'}
                    </span>
                    {item.cloudSaved && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <Cloud className="w-3 h-3" /> Cloud Firestore
                      </span>
                    )}
                    {item.emailDispatched && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email Terkirim
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatBytes(item.sizeBytes)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Waktu: <strong className="font-mono">{item.createdAt}</strong> •{' '}
                    <strong>{item.summary?.paymentCount ?? 0}</strong> transaksi iuran •{' '}
                    <strong>{item.summary?.claimCount ?? 0}</strong> santunan • Total Kas Terverifikasi:{' '}
                    <strong className="text-emerald-700 font-mono">
                      Rp {Number(item.summary?.totalVerifiedAmount || 0).toLocaleString('id-ID')}
                    </strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      SHA-256: {(item.checksumSha256 || '-').slice(0, 16)}...
                    </span>
                    {item.emailStatusNote && (
                      <span className="font-sans text-slate-500">• {item.emailStatusNote}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadBackupJsonFile(item)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh JSON</span>
                  </button>

                  {adminEmail.trim() && (
                    <button
                      type="button"
                      onClick={() => openBackupEmailDraft(item, adminEmail.trim())}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      title={`Buka draft email ke ${adminEmail.trim()}`}
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-600" />
                      <span>Email Manual</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Hapus arsip backup ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
