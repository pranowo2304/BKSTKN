import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Database,
  Eye,
  FileSpreadsheet,
  HardDriveDownload,
  HardDriveUpload,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  DailyFirebaseTelemetry,
  FIRESTORE_DAILY_FREE_READ_QUOTA,
  FIRESTORE_DAILY_FREE_WRITE_QUOTA,
  getDailyTelemetryHistory,
  getTodayDateKey,
  getTodayTelemetry,
  subscribeToTelemetry,
  resetTodayTelemetry,
  exportTelemetryCSV,
  getCloudConnectionDiagnostics,
  CloudConnectionDiagnostics,
} from '../lib/firebaseTelemetry';
import { testConnection } from '../lib/firebase';

const COLLECTION_LABELS: Record<string, string> = {
  members: 'Data Warga (members)',
  payments: 'Iuran & Kas (payments)',
  claims: 'Santunan Duka (claims)',
  users: 'Pengguna & Otoritas (users)',
  settings: 'Pengaturan Sistem (settings)',
  clusters: 'Master RT/Cluster (clusters)',
  benefits: 'Master Manfaat (benefits)',
  meta: 'Saldo & Metadata (meta)',
  ambulance_orders: 'Layanan Ambulans (ambulance_orders)',
  funeral_schedules: 'Jadwal Pemulasaraan (funeral_schedules)',
  funeral_inventory: 'Inventaris Duka (funeral_inventory)',
  funeral_inventory_loans: 'Peminjaman Inventaris (funeral_inventory_loans)',
};

function formatShortDateIndo(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

function formatFullDateIndo(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const AdminFirebaseStatsPanel: React.FC = () => {
  const [selectedDays, setSelectedDays] = useState<7 | 14>(7);
  const [chartView, setChartView] = useState<'all' | 'firebase' | 'visits'>('all');
  const [history, setHistory] = useState<DailyFirebaseTelemetry[]>(() =>
    getDailyTelemetryHistory(7)
  );
  const [todayStats, setTodayStats] = useState<DailyFirebaseTelemetry>(() =>
    getTodayTelemetry()
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [cloudDiag, setCloudDiag] = useState<CloudConnectionDiagnostics>(() =>
    getCloudConnectionDiagnostics()
  );
  const [isTestingPing, setIsTestingPing] = useState(false);

  const refreshTelemetry = () => {
    setHistory(getDailyTelemetryHistory(selectedDays));
    setTodayStats(getTodayTelemetry());
    setCloudDiag(getCloudConnectionDiagnostics());
  };

  useEffect(() => {
    refreshTelemetry();
    const unsub = subscribeToTelemetry(() => {
      setHistory(getDailyTelemetryHistory(selectedDays));
      setTodayStats(getTodayTelemetry());
      setCloudDiag(getCloudConnectionDiagnostics());
    });
    return unsub;
  }, [selectedDays]);

  const handlePingCloudServer = async () => {
    setIsTestingPing(true);
    try {
      await testConnection();
      setCloudDiag(getCloudConnectionDiagnostics());
    } finally {
      setIsTestingPing(false);
    }
  };

  const todayKey = getTodayDateKey();

  const summary = useMemo(() => {
    const totalVisits = history.reduce((acc, d) => acc + (d.visits || 0), 0);
    const totalSessions = history.reduce((acc, d) => acc + (d.uniqueSessions || 0), 0);
    const totalReads = history.reduce((acc, d) => acc + (d.reads || 0), 0);
    const totalWrites = history.reduce((acc, d) => acc + (d.writes || 0), 0);
    const totalDeletes = history.reduce((acc, d) => acc + (d.deletes || 0), 0);

    const daysCount = Math.max(1, history.length);
    const avgVisitsPerDay = Math.round(totalVisits / daysCount);
    const avgReadsPerDay = Math.round(totalReads / daysCount);
    const avgWritesPerDay = Math.round(totalWrites / daysCount);

    const readQuotaPct = Math.min(
      100,
      (todayStats.reads / FIRESTORE_DAILY_FREE_READ_QUOTA) * 100
    );
    const writeQuotaPct = Math.min(
      100,
      (todayStats.writes / FIRESTORE_DAILY_FREE_WRITE_QUOTA) * 100
    );

    const yesterdayStats =
      history.length >= 2 ? history[history.length - 2] : null;
    const visitDiff = yesterdayStats
      ? todayStats.visits - yesterdayStats.visits
      : 0;

    return {
      totalVisits,
      totalSessions,
      totalReads,
      totalWrites,
      totalDeletes,
      avgVisitsPerDay,
      avgReadsPerDay,
      avgWritesPerDay,
      readQuotaPct,
      writeQuotaPct,
      visitDiff,
    };
  }, [history, todayStats]);

  const chartData = useMemo(() => {
    return history.map((item) => ({
      dateKey: item.date,
      label:
        item.date === todayKey
          ? `${formatShortDateIndo(item.date)} (Hari Ini)`
          : formatShortDateIndo(item.date),
      Kunjungan: item.visits || 0,
      SesiUnik: item.uniqueSessions || 0,
      ReadFirebase: item.reads || 0,
      WriteFirebase: item.writes || 0,
      TotalOperasi: (item.reads || 0) + (item.writes || 0),
    }));
  }, [history, todayKey]);

  const collectionBreakdown = useMemo(() => {
    const readsMap = todayStats.readsByCollection || {};
    const writesMap = todayStats.writesByCollection || {};
    const allKeys = Array.from(
      new Set([...Object.keys(readsMap), ...Object.keys(writesMap)])
    );

    return allKeys
      .map((col) => {
        const r = readsMap[col] || 0;
        const w = writesMap[col] || 0;
        return {
          collection: col,
          label: COLLECTION_LABELS[col] || col,
          reads: r,
          writes: w,
          total: r + w,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [todayStats]);

  const roleVisitsBreakdown = useMemo(() => {
    const rolesMap = todayStats.visitsByRole || {};
    return Object.entries(rolesMap)
      .map(([role, count]) => ({
        role,
        count: Number(count) || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [todayStats]);

  const tableRowsDesc = useMemo(() => {
    return [...history].reverse();
  }, [history]);

  const handleResetToday = () => {
    resetTodayTelemetry();
    setConfirmReset(false);
  };

  return (
    <div
      id="section-admin-firebase-stats"
      className="bg-white rounded-3xl border border-slate-200/90 shadow-lg overflow-hidden transition-all"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 sm:px-7 py-5 sm:py-6 text-white border-b border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0 mt-0.5">
              <Database className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Khusus Admin • Real-Time Telemetry
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                  Zero-Quota Overhead
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1.5 tracking-tight">
                Statistik Kunjungan Aplikasi & Operasi Firebase (Per Hari)
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5 leading-relaxed">
                Monitoring harian jumlah kunjungan warga/pengurus serta pemakaian pembacaan (Read) dan penulisan (Write) Cloud Firestore per hari.
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="inline-flex rounded-xl bg-slate-800/90 p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedDays(7)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDays === 7
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setSelectedDays(14)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedDays === 14
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                14 Hari
              </button>
            </div>

            <button
              type="button"
              onClick={() => exportTelemetryCSV(selectedDays)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="Unduh Laporan Statistik Harian (CSV)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh CSV</span>
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                title="Reset penghitung statistik hari ini"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Hari Ini</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-rose-950/90 border border-rose-500/50 px-2.5 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-rose-200">Reset hari ini?</span>
                <button
                  type="button"
                  onClick={handleResetToday}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded-md cursor-pointer"
                >
                  Ya
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[11px] font-bold rounded-md cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5 sm:p-7 space-y-6">
        {/* Cloud Connection & Quota Diagnostic Banner */}
        <div
          className={`rounded-2xl border p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            cloudDiag.reason === 'connected'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : cloudDiag.reason === 'quota_exceeded'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                cloudDiag.reason === 'connected'
                  ? 'bg-emerald-600 text-white'
                  : cloudDiag.reason === 'quota_exceeded'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-amber-300'
              }`}
            >
              {cloudDiag.reason === 'connected' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm">
                  {cloudDiag.reason === 'connected'
                    ? 'Status Cloud DB: Terhubung Realtime ke Server Google Cloud Firestore'
                    : cloudDiag.reason === 'quota_exceeded'
                    ? 'Status Cloud DB: Mode Lokal Aktif (Kuota Harian Server Google Cloud Tercapai)'
                    : 'Status Cloud DB: Mode Lokal Aktif (Cache Offline / Gangguan Jaringan Sementara)'}
                </span>
              </div>
              <p className="leading-relaxed text-slate-700">
                {cloudDiag.reason === 'connected' ? (
                  <>
                    Penghitung di bawah mencatat operasi dari perangkat/browser ini sejak <strong>00:00 WIB</strong> (tanpa membebani kuota tulis database). Kuota harian server Google Cloud berlaku gabungan untuk seluruh perangkat dan di-reset setiap pukul <strong>14:00–15:00 WIB (00:00 Waktu Pasifik)</strong>.
                  </>
                ) : (
                  <>
                    <strong>Mengapa persentase di bawah masih &lt; 1% tetapi status beralih ke Mode Lokal?</strong> Angka pada kartu di bawah adalah penghitung lokal pada browser perangkat ini sejak pukul <strong>00:00 WIB</strong>, sedangkan server Google Cloud Firestore menghitung <strong>total gabungan seluruh perangkat/tab/sesi</strong> dan baru me-reset kuota harian pada pukul <strong>14:00–15:00 WIB (00:00 Waktu Pasifik AS)</strong>, atau koneksi seluler ke server mengalami *timeout* sementara.
                  </>
                )}
              </p>
              {cloudDiag.errorMessage && cloudDiag.reason !== 'connected' && (
                <p className="text-[11px] font-mono text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg inline-block mt-1">
                  Info Diagnostik: {cloudDiag.errorMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="https://console.firebase.google.com/project/green-canto-3mbw7/firestore/databases/ai-studio-aplikasidanakema-30bdbfbd-1e3f-4c3f-84d1-a065a143bb83/data?openUpgradeDialog=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
              title="Buka dialog Upgrade Blaze Plan langsung di Firebase Console untuk proyek green-canto-3mbw7"
            >
              <span>Upgrade Blaze Plan</span>
            </a>

            <a
              href="https://console.cloud.google.com/billing/linkedaccount?project=green-canto-3mbw7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Kelola Billing & Budget Alert di Google Cloud Console untuk proyek green-canto-3mbw7"
            >
              <span>Google Cloud Billing</span>
            </a>

            <button
              type="button"
              onClick={handlePingCloudServer}
              disabled={isTestingPing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-black shrink-0 shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingPing ? 'animate-spin' : ''}`} />
              <span>{isTestingPing ? 'Mengecek Server...' : 'Cek / Hubungkan Ulang Cloud DB'}</span>
            </button>
          </div>
        </div>

        {/* 4 Primary KPI Cards (Today's Live Metrics & Daily Averages) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Kunjungan Aplikasi Hari Ini */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
                  Kunjungan Hari Ini
                </span>
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {todayStats.visits.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold text-slate-500">kunjungan</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Sesi Unik Hari Ini:{' '}
                <strong className="text-indigo-700 font-mono">
                  {todayStats.uniqueSessions.toLocaleString('id-ID')}
                </strong>{' '}
                perangkat/sesi
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-indigo-100/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">
                Total {selectedDays} Hari:{' '}
                <strong className="text-slate-800 font-mono">
                  {summary.totalVisits.toLocaleString('id-ID')}
                </strong>
              </span>
              <span
                className={`font-black px-2 py-0.5 rounded-md ${
                  summary.visitDiff >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                Rata-rata {summary.avgVisitsPerDay}/hari
              </span>
            </div>
          </div>

          {/* Card 2: Pembacaan (Read) Firebase Hari Ini */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  Pembacaan (Read) Hari Ini
                </span>
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                  <HardDriveDownload className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {todayStats.reads.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold text-slate-500">dokumen</span>
              </div>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">
                    Kuota Gratis Harian (50.000)
                  </span>
                  <span className="font-mono font-black text-emerald-700">
                    {summary.readQuotaPct.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      summary.readQuotaPct > 80
                        ? 'bg-rose-500'
                        : summary.readQuotaPct > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(2, summary.readQuotaPct)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-100/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">
                Total {selectedDays} Hari:{' '}
                <strong className="text-slate-800 font-mono">
                  {summary.totalReads.toLocaleString('id-ID')}
                </strong>
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                Rata-rata {summary.avgReadsPerDay.toLocaleString('id-ID')}/hari
              </span>
            </div>
          </div>

          {/* Card 3: Penulisan (Write) Firebase Hari Ini */}
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-slate-50 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                  Penulisan (Write) Hari Ini
                </span>
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                  <HardDriveUpload className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {todayStats.writes.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold text-slate-500">operasi tulis</span>
              </div>
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-500 font-medium">
                    Kuota Gratis Harian (20.000)
                  </span>
                  <span className="font-mono font-black text-amber-700">
                    {summary.writeQuotaPct.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      summary.writeQuotaPct > 80
                        ? 'bg-rose-500'
                        : summary.writeQuotaPct > 50
                        ? 'bg-amber-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.max(2, summary.writeQuotaPct)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-100/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">
                Total {selectedDays} Hari:{' '}
                <strong className="text-slate-800 font-mono">
                  {summary.totalWrites.toLocaleString('id-ID')}
                </strong>
              </span>
              <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                Rata-rata {summary.avgWritesPerDay.toLocaleString('id-ID')}/hari
              </span>
            </div>
          </div>

          {/* Card 4: Total Operasi & Status Kesehatan Kuota */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Total Operasi DB Hari Ini
                </span>
                <div className="p-2 rounded-xl bg-slate-200/80 text-slate-700">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                  {(todayStats.reads + todayStats.writes).toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-bold text-slate-500">read + write</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Rasio Read : Write ={' '}
                <strong className="text-slate-900 font-mono">
                  {todayStats.writes > 0
                    ? `${Math.round(todayStats.reads / todayStats.writes)} : 1`
                    : `${todayStats.reads} : 0`}
                </strong>
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Kuota Cloud Aman
              </span>
              <span className="text-slate-500 font-mono">
                Update:{' '}
                {todayStats.lastUpdated
                  ? new Date(todayStats.lastUpdated).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Daily Trend Chart Section */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Grafik Harian: Kunjungan Aplikasi & Read/Write Firebase ({selectedDays} Hari Terakhir)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan tren kunjungan harian dengan jumlah operasi pembacaan dan penulisan ke Cloud Firestore.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-xs self-start">
              <button
                type="button"
                onClick={() => setChartView('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartView === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Metrik
              </button>
              <button
                type="button"
                onClick={() => setChartView('firebase')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartView === 'firebase'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Read & Write DB
              </button>
              <button
                type="button"
                onClick={() => setChartView('visits')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartView === 'visits'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kunjungan
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full bg-white rounded-xl border border-slate-200/80 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                {(chartView === 'all' || chartView === 'firebase') && (
                  <Bar
                    dataKey="ReadFirebase"
                    name="Pembacaan (Read)"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  />
                )}
                {(chartView === 'all' || chartView === 'firebase') && (
                  <Bar
                    dataKey="WriteFirebase"
                    name="Penulisan (Write)"
                    fill="#f59e0b"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  />
                )}
                {(chartView === 'all' || chartView === 'visits') && (
                  <Line
                    type="monotone"
                    dataKey="Kunjungan"
                    name="Kunjungan Aplikasi"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#4f46e5' }}
                    activeDot={{ r: 6 }}
                  />
                )}
                {chartView === 'visits' && (
                  <Bar
                    dataKey="SesiUnik"
                    name="Sesi Unik"
                    fill="#818cf8"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Grid: Per Koleksi Firestore & Per Role Kunjungan Hari Ini */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Rincian Operasi per Koleksi Firestore Hari Ini */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Rincian Read & Write per Koleksi Firestore (Hari Ini)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Distribusi aktivitas pembacaan dan penulisan dokumen berdasarkan koleksi tabel.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {collectionBreakdown.length} Koleksi Aktif
              </span>
            </div>

            {collectionBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Belum ada operasi koleksi Firestore yang tercatat hari ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {collectionBreakdown.map((item) => {
                  const maxTotal = Math.max(1, collectionBreakdown[0]?.total || 1);
                  const barWidth = Math.min(100, Math.round((item.total / maxTotal) * 100));
                  return (
                    <div
                      key={item.collection}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-800 truncate">
                          {item.label}
                        </span>
                        <span className="font-mono font-black text-slate-900 shrink-0">
                          {item.total.toLocaleString('id-ID')} ops
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden my-2">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                          style={{ width: `${ Math.max(4, barWidth) }%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Read:{' '}
                          <strong className="text-emerald-700 font-mono">
                            {item.reads.toLocaleString('id-ID')}
                          </strong>
                        </span>
                        <span>
                          Write:{' '}
                          <strong className="text-amber-700 font-mono">
                            {item.writes.toLocaleString('id-ID')}
                          </strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rincian Kunjungan Berdasarkan Role Hari Ini */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Kunjungan per Role (Hari Ini)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Distribusi akses pengguna hari ini berdasarkan otoritas.
                </p>
              </div>
            </div>

            {roleVisitsBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Belum ada rincian kunjungan per role hari ini.
              </div>
            ) : (
              <div className="space-y-2.5">
                {roleVisitsBreakdown.map((r) => {
                  const pct =
                    todayStats.visits > 0
                      ? Math.min(100, Math.round((r.count / todayStats.visits) * 100))
                      : 0;
                  return (
                    <div
                      key={r.role}
                      className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800">{r.role}</span>
                        <span className="font-mono font-black text-indigo-700">
                          {r.count}x ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Daily History Table (Per Hari) */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                Tabel Rekapitulasi Harian: Kunjungan & Read/Write Firebase Per Hari
              </h3>
            </div>
            <span className="text-[11px] text-slate-300 font-medium">
              Menampilkan {tableRowsDesc.length} hari terakhir
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4 text-right">Kunjungan Aplikasi</th>
                  <th className="py-3 px-4 text-right">Sesi Unik</th>
                  <th className="py-3 px-4 text-right">Pembacaan (Read)</th>
                  <th className="py-3 px-4 text-right">Penulisan (Write)</th>
                  <th className="py-3 px-4 text-right">Total Operasi DB</th>
                  <th className="py-3 px-4 text-center">Pemakaian Kuota Gratis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs sm:text-sm">
                {tableRowsDesc.map((row) => {
                  const isToday = row.date === todayKey;
                  const totalOps = (row.reads || 0) + (row.writes || 0);
                  const readPct = (
                    ((row.reads || 0) / FIRESTORE_DAILY_FREE_READ_QUOTA) *
                    100
                  ).toFixed(2);
                  const writePct = (
                    ((row.writes || 0) / FIRESTORE_DAILY_FREE_WRITE_QUOTA) *
                    100
                  ).toFixed(2);

                  return (
                    <tr
                      key={row.date}
                      className={`transition-colors ${
                        isToday
                          ? 'bg-indigo-50/60 hover:bg-indigo-50/90 font-semibold'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {formatFullDateIndo(row.date)}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase">
                              Hari Ini
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {row.date}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                        {(row.visits || 0).toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {(row.uniqueSessions || 0).toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-black text-emerald-700">
                          {(row.reads || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {readPct}% dari 50rb
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-black text-amber-700">
                          {(row.writes || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {writePct}% dari 20rb
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {totalOps.toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Aman ({readPct}% R / {writePct}% W)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
