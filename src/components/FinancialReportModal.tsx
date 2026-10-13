import React, { useState, useMemo } from 'react';
import { Member, Payment, BenefitClaim, SystemSettings } from '../types';
import { formatIDR, getBaseBalance } from '../lib/storage';
import {
  exportMonthlyFinancialStatementCSV,
  exportDuesCollectionCSV,
  exportBenefitClaimsCSV,
  exportMemberComplianceCSV,
  MONTHS_LIST,
  isPaymentMatchingPeriod,
  isClaimMatchingPeriod,
} from '../lib/csvExport';
import {
  X,
  Download,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  HeartHandshake,
  Users,
  CheckCircle2,
  Check,
  Copy,
  Table
} from 'lucide-react';

interface FinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: Payment[];
  claims: BenefitClaim[];
  members: Member[];
  settings: SystemSettings;
  financials: {
    totalBalance: number;
    totalIncomeVerified: number;
    totalPendingIncome: number;
    totalBenefitSpent: number;
  };
}

export const FinancialReportModal: React.FC<FinancialReportModalProps> = ({
  isOpen,
  onClose,
  payments,
  claims,
  members,
  settings,
}) => {
  if (!isOpen) return null;

  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('Agustus');
  const [reportType, setReportType] = useState<'financial' | 'payments' | 'claims' | 'compliance'>('financial');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Dynamic available years based on data + standard range
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(2027);
    yearsSet.add(2026);
    yearsSet.add(2025);
    yearsSet.add(2024);
    yearsSet.add(new Date().getFullYear());

    payments.forEach((p) => {
      const match = (p.periodMonth || '').match(/\b(20\d\d)\b/) || (p.createdAt || '').match(/\b(20\d\d)\b/);
      if (match) yearsSet.add(parseInt(match[1], 10));
    });

    claims.forEach((c) => {
      const match = (c.dateOfDeath || '').match(/\b(20\d\d)\b/) || (c.createdAt || '').match(/\b(20\d\d)\b/);
      if (match) yearsSet.add(parseInt(match[1], 10));
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [payments, claims]);

  // Derived selected period string
  const selectedPeriod = useMemo(() => {
    if (selectedYear === 'all') return 'Semua Periode';
    if (selectedMonth === 'all') return `Tahun ${selectedYear}`;
    return `${selectedMonth} ${selectedYear}`;
  }, [selectedYear, selectedMonth]);

  const isAllPeriod = selectedYear === 'all';

  const previewPayments = isAllPeriod
    ? payments.filter((p) => p.status === 'Verified')
    : payments.filter(
        (p) => p.status === 'Verified' && isPaymentMatchingPeriod(p, selectedPeriod)
      );

  const previewClaims = isAllPeriod
    ? claims
    : claims.filter((c) => isClaimMatchingPeriod(c, selectedPeriod));

  const periodIncome = previewPayments.reduce((sum, p) => sum + p.amount, 0);
  const periodExpense = previewClaims.reduce((sum, c) => sum + c.totalAmount, 0);
  const periodNet = periodIncome - periodExpense;

  const handleExport = () => {
    const baseBalance = getBaseBalance();
    if (reportType === 'financial') {
      exportMonthlyFinancialStatementCSV(selectedPeriod, settings, payments, claims, members, baseBalance);
    } else if (reportType === 'payments') {
      exportDuesCollectionCSV(selectedPeriod, payments, members, settings);
    } else if (reportType === 'claims') {
      exportBenefitClaimsCSV(claims, settings, selectedPeriod);
    } else if (reportType === 'compliance') {
      exportMemberComplianceCSV(selectedPeriod, members, payments, settings);
    }

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const handleCopySummary = () => {
    const summaryText = `LAPORAN KEUANGAN DANA KEMATIAN
Paguyuban: ${settings.communityName}
Periode: ${selectedPeriod}
----------------------------------------
Penerimaan Iuran: ${formatIDR(periodIncome)} (${previewPayments.length} transaksi)
Pengeluaran Santunan: ${formatIDR(periodExpense)} (${previewClaims.length} klaim)
Surplus / (Defisit): ${formatIDR(periodNet)}
Total Anggota Aktif: ${members.filter((m) => m.status === 'Aktif').length}
Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between relative border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">Ekspor Laporan Keuangan (.CSV)</h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold rounded-md">
                  Excel & Sheets Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Unduh file spreadsheet format CSV dengan encoding UTF-8 BOM untuk Microsoft Excel & Google Sheets.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">

          {/* STEP 1: Pilih Periode (Tahun & Bulan) & Ringkasan */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Periode Selector (Tahun & Bulan) */}
            <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>1. Pilih Periode Laporan</span>
                </label>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-mono font-bold shadow-xs">
                  {selectedPeriod}
                </span>
              </div>

              {/* Dual Selectors: Tahun & Bulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Pilihan Tahun */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Pilihan Tahun:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={String(yr)}>
                        📅 Tahun {yr}
                      </option>
                    ))}
                    <option value="all">🌟 Semua Tahun (Semua Riwayat)</option>
                  </select>
                </div>

                {/* Pilihan Bulan (Januari s.d. Desember) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Pilihan Bulan:
                  </label>
                  <select
                    value={selectedMonth}
                    disabled={selectedYear === 'all'}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="all">🌟 Semua Bulan (1 Tahun Penuh)</option>
                    {MONTHS_LIST.map((m, idx) => (
                      <option key={m} value={m}>
                        {String(idx + 1).padStart(2, '0')} - {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400 font-semibold text-[10px]">Pilih Cepat:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear('2026');
                    setSelectedMonth('Agustus');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    selectedYear === '2026' && selectedMonth === 'Agustus'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Agustus 2026
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear('2026');
                    setSelectedMonth('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    selectedYear === '2026' && selectedMonth === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Tahun 2026 Penuh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear('2025');
                    setSelectedMonth('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    selectedYear === '2025' && selectedMonth === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Tahun 2025
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear('all');
                    setSelectedMonth('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    selectedYear === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Semua Periode
                </button>
              </div>
            </div>

            {/* Live Financial KPI Preview */}
            <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Ringkasan {selectedPeriod}</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-700">
                  {previewPayments.length + previewClaims.length} Transaksi
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-semibold block flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Pemasukan:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                    {formatIDR(periodIncome)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">
                    {previewPayments.length} transaksi iuran
                  </span>
                </div>

                <div className="p-2.5 bg-rose-50/80 rounded-xl border border-rose-100">
                  <span className="text-[10px] text-rose-700 font-semibold block flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" /> Santunan:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                    {formatIDR(periodExpense)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">
                    {previewClaims.length} realisasi klaim
                  </span>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-slate-600">Surplus / (Defisit):</span>
                <span className={`font-mono font-black text-xs ${periodNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatIDR(periodNet)}
                </span>
              </div>
            </div>
          </div>

          {/* STEP 2: Pilih Jenis Laporan */}
          <div className="space-y-2.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>2. Pilih Jenis Format Laporan CSV</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Financial Ledger */}
              <button
                type="button"
                onClick={() => setReportType('financial')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  reportType === 'financial'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${reportType === 'financial' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      Buku Kas & Laporan Keuangan
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Laporan kas komprehensif memuat ringkasan arus kas, iuran masuk, biaya duka, dan saldo kas berjalan.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: Dues Collection */}
              <button
                type="button"
                onClick={() => setReportType('payments')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  reportType === 'payments'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${reportType === 'payments' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      Laporan Penerimaan Iuran
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Daftar seluruh transaksi pembayaran iuran anggota lengkap dengan no. kwitansi dan status verifikasi.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 3: Benefit Realization Claims */}
              <button
                type="button"
                onClick={() => setReportType('claims')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  reportType === 'claims'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${reportType === 'claims' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      Realisasi Santunan Duka
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Catatan pengeluaran dana santunan duka almarhum, kain kafan, ambulans, dan pemakaman.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 4: Member Compliance Recap */}
              <button
                type="button"
                onClick={() => setReportType('compliance')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  reportType === 'compliance'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${reportType === 'compliance' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      Rekap Kepatuhan Anggota
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Rekap status per anggota (Lunas / Menunggak) untuk periode bulan {selectedPeriod}.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* STEP 3: Preview Table Sample */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-2">
            <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 font-bold">
                <Table className="w-4 h-4 text-emerald-400" />
                <span>Pratinjau Data yang Akan Diekspor ({selectedPeriod})</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Format: UTF-8 CSV
              </span>
            </div>

            <div className="p-3 overflow-x-auto max-h-44 overflow-y-auto">
              <table className="w-full text-left text-[11px] text-slate-700">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[9px] border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Tanggal / ID</th>
                    <th className="py-2 px-3">Nama Anggota</th>
                    <th className="py-2 px-3">Keterangan</th>
                    <th className="py-2 px-3 text-right">Nominal</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportType === 'claims' ? (
                    previewClaims.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          Tidak ada data klaim santunan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      previewClaims.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono">{c.claimNumber}</td>
                          <td className="py-2 px-3 font-bold">{c.deceasedName} ({c.relationship})</td>
                          <td className="py-2 px-3 text-slate-500">Santunan Duka Ahli Waris {c.memberName}</td>
                          <td className="py-2 px-3 font-mono font-bold text-rose-700 text-right">{formatIDR(c.totalAmount)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px]">
                              Terealisasi
                            </span>
                          </td>
                        </tr>
                      ))
                    )
                  ) : reportType === 'compliance' ? (
                    members.slice(0, 5).map((m) => {
                      const isPaid = payments.some(
                        (p) =>
                          (p.memberId === m.id || p.memberNumber === m.memberNumber) &&
                          p.status === 'Verified' &&
                          isPaymentMatchingPeriod(p, selectedPeriod)
                      );
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono">{m.memberNumber}</td>
                          <td className="py-2 px-3 font-bold">{m.name}</td>
                          <td className="py-2 px-3 text-slate-500">Status Iuran {selectedPeriod}</td>
                          <td className="py-2 px-3 font-mono text-right">{formatIDR(settings.monthlyFeeAmount)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isPaid ? 'Lunas' : 'Belum Bayar'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    previewPayments.slice(0, 5).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono">{p.receiptNumber}</td>
                        <td className="py-2 px-3 font-bold">{p.memberName}</td>
                        <td className="py-2 px-3 text-slate-500">{p.paymentType} ({p.periodMonth})</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-right">{formatIDR(p.amount)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px]">
                            Lunas
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Success Notification Banner */}
          {downloadSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">File CSV Berhasil Diunduh!</span> Anda dapat langsung membuka file tersebut di Microsoft Excel, Google Sheets, atau aplikasi akuntansi lainnya.
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Teks Ringkasan Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Ringkasan Teks</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-200/80 border border-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-center"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 text-center"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File CSV Sekarang</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
