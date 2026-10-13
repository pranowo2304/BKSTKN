import React, { useState } from 'react';
import { SystemSettings, MembershipPeriodSettings, MembershipPeriodMode, FixedPeriodType } from '../types';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  HelpCircle, 
  Sparkles, 
  ShieldCheck, 
  CalendarRange, 
  RotateCcw, 
  AlertCircle,
  Save,
  Check,
  Info,
  ArrowRight
} from 'lucide-react';

interface MembershipPeriodManagerProps {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
}

export const MembershipPeriodManager: React.FC<MembershipPeriodManagerProps> = ({
  settings,
  onSaveSettings,
}) => {
  const currentPeriodConfig: MembershipPeriodSettings = settings.membershipPeriod || {
    mode: 'payment_date',
    durationMonths: 12,
    durationDays: 365,
    fixedType: 'calendar_year',
    activePeriodYear: '2026',
    customPeriodName: 'Tahun Kalender 2026',
    customStartDate: '2026-01-01',
    customEndDate: '2026-12-31',
    allowGracePeriodDays: 14,
    policyNotes: 'Masa keanggotaan berlaku selama 1 tahun penuh sejak tanggal pembayaran terverifikasi.',
  };

  const [periodConfig, setPeriodConfig] = useState<MembershipPeriodSettings>(currentPeriodConfig);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Simulation test state
  const [simTestDate, setSimTestDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [simPaidYear, setSimPaidYear] = useState<string>(periodConfig.activePeriodYear || '2026');

  const handleModeChange = (mode: MembershipPeriodMode) => {
    setPeriodConfig((prev) => ({
      ...prev,
      mode,
    }));
  };

  const handleFixedTypeChange = (fixedType: FixedPeriodType) => {
    setPeriodConfig((prev) => ({
      ...prev,
      fixedType,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: SystemSettings = {
      ...settings,
      membershipPeriod: periodConfig,
    };
    onSaveSettings(updatedSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  };

  // Calculate live simulation outcome
  const getSimulationResult = () => {
    if (periodConfig.mode === 'payment_date') {
      const baseDate = new Date(simTestDate);
      const expiry = new Date(baseDate);
      const months = periodConfig.durationMonths || 12;
      expiry.setMonth(expiry.getMonth() + months);
      
      const today = new Date();
      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        expiryFormatted: expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        rule: `Dihitung ${months} bulan bergulir (${periodConfig.durationDays || 365} hari) sejak tanggal pembayaran`,
        status: diffDays > 0 ? `Aktif (${diffDays} hari lagi)` : 'Jatuh Tempo',
      };
    } else {
      if (periodConfig.fixedType === 'custom_range') {
        const endDate = new Date(`${periodConfig.customEndDate || '2026-12-31'}T23:59:59`);
        const today = new Date();
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const grace = periodConfig.allowGracePeriodDays || 0;
        const inGrace = diffDays <= 0 && Math.abs(diffDays) <= grace;

        return {
          expiryFormatted: endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
          rule: `Serempak sesuai rentang kepengurusan: ${periodConfig.customPeriodName || 'Periode Kustom'} (${periodConfig.customStartDate} s/d ${periodConfig.customEndDate})`,
          status: inGrace ? `Masa Tenggang (${grace - Math.abs(diffDays)} hari tersisa)` : diffDays > 0 ? `Aktif (${diffDays} hari lagi)` : 'Jatuh Tempo',
        };
      } else {
        const year = Number(simPaidYear) || Number(periodConfig.activePeriodYear) || new Date().getFullYear();
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        const today = new Date();
        const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const grace = periodConfig.allowGracePeriodDays || 0;
        const inGrace = diffDays <= 0 && Math.abs(diffDays) <= grace;

        return {
          expiryFormatted: `31 Desember ${year}`,
          rule: `Serempak Tahun Kalender (1 Jan - 31 Des ${year})`,
          status: inGrace ? `Masa Tenggang (${grace - Math.abs(diffDays)} hari tersisa)` : diffDays > 0 ? `Aktif (${diffDays} hari lagi)` : 'Jatuh Tempo',
        };
      }
    }
  };

  const simulation = getSimulationResult();

  return (
    <div className="space-y-6">
      {saveSuccess && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-sm animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Kebijakan periode keanggotaan berhasil diperbarui dan diterapkan ke seluruh sistem!</span>
        </div>
      )}

      {/* Header Info Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-emerald-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              <Calendar className="w-3 h-3" />
              <span>Otoritas Khusus Admin</span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
              Aturan & Masa Berlaku Periode Keanggotaan
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Tentukan bagaimana sistem menghitung masa aktif KTA dan hak santunan warga: 
              apakah dihitung <strong>bergulir sejak tanggal pembayaran</strong> atau <strong>serempak berdasarkan periode tertentu yang diberlakukan pengurus</strong> (misal 1 tahun kalender).
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 shrink-0 text-center sm:text-right">
            <span className="text-[10px] text-emerald-200 block font-semibold uppercase tracking-wider">Kebijakan Aktif Saat Ini:</span>
            <span className="text-xs sm:text-sm font-black text-amber-300">
              {periodConfig.mode === 'payment_date' 
                ? '📅 Tanggal Pembayaran (Rolling 1 Tahun)' 
                : periodConfig.fixedType === 'custom_range'
                ? `📆 Rentang Kustom (${periodConfig.customStartDate} s/d ${periodConfig.customEndDate})`
                : `🗓️ Tahun Kalender (1 Jan - 31 Des ${periodConfig.activePeriodYear})`}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* PILIHAN MODE UTAMA (2 KARTU INTERAKTIF) */}
        <div className="space-y-3">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
            Pilih Model Penentuan Periode Keanggotaan:
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPSI 1: BERDASARKAN TANGGAL PEMBAYARAN */}
            <div
              onClick={() => handleModeChange('payment_date')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                periodConfig.mode === 'payment_date'
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      periodConfig.mode === 'payment_date' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">1. Berdasarkan Tanggal Pembayaran</h4>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        Masa Berlaku Bergulir (Rolling)
                      </span>
                    </div>
                  </div>

                  <input
                    type="radio"
                    name="periodMode"
                    checked={periodConfig.mode === 'payment_date'}
                    onChange={() => handleModeChange('payment_date')}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Masa aktif anggota dihitung maju selama <strong>1 tahun (12 bulan)</strong> sejak hari ketika transaksi iuran warga diverifikasi oleh bendahara.
                </p>

                <div className="bg-white p-3 rounded-xl border border-slate-200/90 text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider text-emerald-800">
                    💡 Contoh Kasus:
                  </span>
                  <p className="text-[11px]">
                    Jika warga membayar pada <strong>15 Mei 2026</strong>, maka keanggotaan aktif berlaku sampai dengan <strong>15 Mei 2027</strong>.
                  </p>
                </div>
              </div>

              {periodConfig.mode === 'payment_date' && (
                <div className="mt-4 pt-3 border-t border-emerald-200/80 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Mode ini sedang dipilih</span>
                </div>
              )}
            </div>

            {/* OPSI 2: BERDASARKAN PERIODE TERTENTU PENGURUS */}
            <div
              onClick={() => handleModeChange('fixed_period')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                periodConfig.mode === 'fixed_period'
                  ? 'border-indigo-500 bg-indigo-50/70 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      periodConfig.mode === 'fixed_period' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">2. Berdasarkan Periode Pengurus</h4>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                        Masa Berlaku Serempak (Tahun Buku)
                      </span>
                    </div>
                  </div>

                  <input
                    type="radio"
                    name="periodMode"
                    checked={periodConfig.mode === 'fixed_period'}
                    onChange={() => handleModeChange('fixed_period')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Masa berlaku keanggotaan terikat seragam pada <strong>tahun buku atau rentang periode resmi</strong> yang ditetapkan pengurus (misal: 1 Januari s/d 31 Desember).
                </p>

                <div className="bg-white p-3 rounded-xl border border-slate-200/90 text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider text-indigo-800">
                    💡 Contoh Kasus:
                  </span>
                  <p className="text-[11px]">
                    Warga yang membayar iuran tahun 2026 (baik di Januari maupun September 2026) akan sama-sama berlaku sampai <strong>31 Desember 2026</strong>.
                  </p>
                </div>
              </div>

              {periodConfig.mode === 'fixed_period' && (
                <div className="mt-4 pt-3 border-t border-indigo-200/80 flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                  <Check className="w-4 h-4 text-indigo-600" />
                  <span>Mode ini sedang dipilih</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DETAIL PARAMETER SESUAI MODE YANG DIPILIH */}
        {periodConfig.mode === 'payment_date' ? (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-emerald-200 shadow-sm space-y-4 animate-in fade-in">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Detail Aturan Mode Tanggal Pembayaran</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Durasi Masa Berlaku (Bulan)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={periodConfig.durationMonths || 12}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 12;
                      setPeriodConfig((prev) => ({
                        ...prev,
                        durationMonths: val,
                        durationDays: val * 30,
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Bulan</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Standar paguyuban: 12 Bulan (1 Tahun penuh).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Preset Pilihan Cepat
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPeriodConfig((prev) => ({ ...prev, durationMonths: 12, durationDays: 365 }))}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      periodConfig.durationMonths === 12
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    1 Tahun (12 Bulan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodConfig((prev) => ({ ...prev, durationMonths: 6, durationDays: 180 }))}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      periodConfig.durationMonths === 6
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Semester (6 Bulan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodConfig((prev) => ({ ...prev, durationMonths: 24, durationDays: 730 }))}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      periodConfig.durationMonths === 24
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    2 Tahun (24 Bulan)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-indigo-200 shadow-sm space-y-4 animate-in fade-in">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <CalendarRange className="w-4 h-4 text-indigo-600" />
              <span>Detail Aturan Mode Periode Pengurus</span>
            </h4>

            {/* Pilihan Tipe Periode Pengurus: Calendar Year vs Custom Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                onClick={() => handleFixedTypeChange('calendar_year')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                  periodConfig.fixedType === 'calendar_year'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="text-xs font-black text-slate-900 block">A. Tahun Kalender (1 Jan - 31 Des)</span>
                  <span className="text-[11px] text-slate-500">Masa berlaku berakhir pada akhir tahun kalender terkait</span>
                </div>
                <input
                  type="radio"
                  name="fixedType"
                  checked={periodConfig.fixedType === 'calendar_year'}
                  onChange={() => handleFixedTypeChange('calendar_year')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label
                onClick={() => handleFixedTypeChange('custom_range')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                  periodConfig.fixedType === 'custom_range'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="text-xs font-black text-slate-900 block">B. Rentang Tanggal Kustom</span>
                  <span className="text-[11px] text-slate-500">Tentukan tanggal mulai dan selesai secara manual</span>
                </div>
                <input
                  type="radio"
                  name="fixedType"
                  checked={periodConfig.fixedType === 'custom_range'}
                  onChange={() => handleFixedTypeChange('custom_range')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>

            {/* Parameter Input Sesuai Fixed Type */}
            {periodConfig.fixedType === 'calendar_year' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tahun Kalender Aktif Saat Ini
                  </label>
                  <input
                    type="text"
                    value={periodConfig.activePeriodYear || '2026'}
                    onChange={(e) => setPeriodConfig((prev) => ({ ...prev, activePeriodYear: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="2026"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Warga yang membayar iuran tahun ini berlaku s/d 31 Desember {periodConfig.activePeriodYear || '2026'}.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Toleransi Masa Tenggang (*Grace Period*)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={periodConfig.allowGracePeriodDays ?? 14}
                      onChange={(e) => setPeriodConfig((prev) => ({ ...prev, allowGracePeriodDays: Number(e.target.value) }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Hari</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Kelonggaran sebelum KTA terkunci jika terlambat memperbarui di tahun berikutnya.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Periode Kepengurusan
                    </label>
                    <input
                      type="text"
                      value={periodConfig.customPeriodName || ''}
                      onChange={(e) => setPeriodConfig((prev) => ({ ...prev, customPeriodName: e.target.value }))}
                      placeholder="e.g. Periode 2026-2027"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Mulai Periode
                    </label>
                    <input
                      type="date"
                      value={periodConfig.customStartDate || '2026-01-01'}
                      onChange={(e) => setPeriodConfig((prev) => ({ ...prev, customStartDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tanggal Berakhir Periode
                    </label>
                    <input
                      type="date"
                      value={periodConfig.customEndDate || '2026-12-31'}
                      onChange={(e) => setPeriodConfig((prev) => ({ ...prev, customEndDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-1/3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Toleransi Masa Tenggang (*Grace Period*)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={periodConfig.allowGracePeriodDays ?? 14}
                      onChange={(e) => setPeriodConfig((prev) => ({ ...prev, allowGracePeriodDays: Number(e.target.value) }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Hari</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CATATAN KEBIJAKAN PENGURUS (DITAMPILKAN KE WARGA) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-2">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600" />
            <span>Dasar Hukum / Keterangan Aturan Pengurus (Ditampilkan di Info KTA & Kwitansi)</span>
          </label>
          <textarea
            rows={2}
            value={periodConfig.policyNotes || ''}
            onChange={(e) => setPeriodConfig((prev) => ({ ...prev, policyNotes: e.target.value }))}
            placeholder="Contoh: Berdasarkan Keputusan Musyawarah Pengurus, masa berlaku keanggotaan terikat tahun buku 1 Jan - 31 Des."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <p className="text-[11px] text-slate-500">
            Penjelasan ini akan tampil sebagai catatan transparansi pada rincian KTA warga dan portal mandiri.
          </p>
        </div>

        {/* SIMULATOR INTERAKTIF PENGECEKAN ATURAN */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Simulasi Hasil Perhitungan Kebijakan
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              Uji Coba Langsung
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Simulasi Tanggal Transaksi / Pembayaran
              </label>
              <input
                type="date"
                value={simTestDate}
                onChange={(e) => setSimTestDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none font-bold"
              />
            </div>

            {periodConfig.mode === 'fixed_period' && periodConfig.fixedType === 'calendar_year' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Tahun Iuran yang Dibayar
                </label>
                <input
                  type="text"
                  value={simPaidYear}
                  onChange={(e) => setSimPaidYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none font-bold"
                  placeholder="2026"
                />
              </div>
            )}

            <div className="sm:col-span-1 bg-slate-800/90 p-3 rounded-xl border border-slate-700 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Hasil Tanggal Berakhir:</span>
              <p className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{simulation.expiryFormatted}</span>
              </p>
              <span className="text-[10px] text-amber-300 font-medium block">
                Status: {simulation.status}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * {simulation.rule}
          </p>
        </div>

        {/* TOMBOL SIMPAN KEBIJAKAN */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-emerald-950/30 inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Terapkan & Simpan Kebijakan Periode</span>
          </button>
        </div>
      </form>
    </div>
  );
};
