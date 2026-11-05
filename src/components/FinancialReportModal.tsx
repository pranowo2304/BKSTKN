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
  buildTreasurerReportRows,
  downloadTreasurerPdfReport,
  formatIndonesianPrintDate,
  formatNominalIdrDecimal,
  getDefaultPeriodHeaderText,
  resolveTreasurerName,
} from '../lib/treasurerPdfReport';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
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
  Table,
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

  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [reportType, setReportType] = useState<
    'treasurer_pdf' | 'financial' | 'payments' | 'claims' | 'compliance'
  >('treasurer_pdf');
  const [periodHeaderText, setPeriodHeaderText] = useState<string>(() =>
    getDefaultPeriodHeaderText(settings)
  );
  const [treasurerNameInput, setTreasurerNameInput] = useState<string>(() =>
    resolveTreasurerName(settings)
  );
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadedFileName, setDownloadedFileName] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const printDateInfo = useMemo(() => formatIndonesianPrintDate(new Date()), []);

  // Dynamic available years based on data + standard range
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(2027);
    yearsSet.add(2026);
    yearsSet.add(2025);
    yearsSet.add(2024);
    yearsSet.add(new Date().getFullYear());

    payments.forEach((p) => {
      const match =
        (p.periodMonth || '').match(/\b(20\d\d)\b/) ||
        (p.createdAt || '').match(/\b(20\d\d)\b/);
      if (match) yearsSet.add(parseInt(match[1], 10));
    });

    claims.forEach((c) => {
      const match =
        (c.dateOfDeath || '').match(/\b(20\d\d)\b/) ||
        (c.createdAt || '').match(/\b(20\d\d)\b/);
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

  // Rows for the Treasurer PDF Report
  const treasurerRows = useMemo(() => {
    return buildTreasurerReportRows({
      members,
      payments,
      settings,
      periodFilter: selectedPeriod,
      includeActiveWithoutPayment: true,
    });
  }, [members, payments, settings, selectedPeriod]);

  const treasurerTotalNominal = useMemo(() => {
    return treasurerRows.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [treasurerRows]);

  const periodIncome =
    reportType === 'treasurer_pdf'
      ? treasurerTotalNominal
      : previewPayments.reduce((sum, p) => sum + p.amount, 0);
  const periodExpense = previewClaims.reduce((sum, c) => sum + c.totalAmount, 0);

  const handleExport = async () => {
    if (reportType === 'treasurer_pdf') {
      const fname = await downloadTreasurerPdfReport({
        members,
        payments,
        settings,
        periodFilter: selectedPeriod,
        periodHeaderText,
        treasurerName: treasurerNameInput,
        includeActiveWithoutPayment: true,
      });
      setDownloadedFileName(fname);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
      return;
    }

    const baseBalance = getBaseBalance();
    if (reportType === 'financial') {
      exportMonthlyFinancialStatementCSV(
        selectedPeriod,
        settings,
        payments,
        claims,
        members,
        baseBalance
      );
      setDownloadedFileName(`Laporan_Keuangan_Dana_Kematian.csv`);
    } else if (reportType === 'payments') {
      exportDuesCollectionCSV(selectedPeriod, payments, members, settings);
      setDownloadedFileName(`Laporan_Penerimaan_Iuran.csv`);
    } else if (reportType === 'claims') {
      exportBenefitClaimsCSV(claims, settings, selectedPeriod);
      setDownloadedFileName(`Laporan_Realisasi_Santunan_Duka.csv`);
    } else if (reportType === 'compliance') {
      exportMemberComplianceCSV(selectedPeriod, members, payments, settings);
      setDownloadedFileName(`Rekap_Kepatuhan_Iuran.csv`);
    }

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  const handleCopySummary = () => {
    const summaryText = `DAFTAR ANGGOTA KEPESERTAAN DANA KEMATIAN
PERIODE : ${periodHeaderText.toUpperCase()}
Organisasi: ${settings.communityName}
----------------------------------------
Jumlah Anggota Tercatat: ${treasurerRows.length} Warga
Total Penerimaan Iuran: Rp ${formatNominalIdrDecimal(treasurerTotalNominal)}
Pengeluaran Santunan: ${formatIDR(periodExpense)} (${previewClaims.length} klaim)
Tanggal Cetak: ${printDateInfo.dateTime}
Bendahara: ${treasurerNameInput || resolveTreasurerName(settings)}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between relative border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
              {reportType === 'treasurer_pdf' ? (
                <FileText className="w-6 h-6" />
              ) : (
                <FileSpreadsheet className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Laporan Bendahara & Ekspor Keuangan (PDF / CSV)
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold rounded-md">
                  PDF & Excel Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cetak Laporan Bendahara Daftar Anggota Kepesertaan Dana Kematian (.PDF) lengkap dengan logo organisasi, tanggal cetak, dan nama bendahara.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors ml-2 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">
          {/* STEP 1: Pilih Jenis Laporan */}
          <div className="space-y-2.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>1. Pilih Jenis & Format Laporan</span>
            </label>

            {/* Primary Featured Option: Laporan Bendahara PDF */}
            <button
              type="button"
              onClick={() => setReportType('treasurer_pdf')}
              className={`w-full p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                reportType === 'treasurer_pdf'
                  ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/25 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      reportType === 'treasurer_pdf'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                        Laporan Bendahara — Daftar Anggota Kepesertaan Dana Kematian (PDF)
                      </h4>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase">
                        Format Resmi PDF
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Tabel resmi dilengkapi <strong>Logo Organisasi</strong>, kolom <strong>No</strong>, <strong>Nama Warga dan Nomor Anggota</strong>, <strong>Nominal (Rp)</strong>, <strong>Keterangan</strong>, <strong>Total Kas Berwarna Kuning</strong>, serta <strong>Tanggal Cetak & Nama Bendahara</strong> di bagian bawah.
                    </p>
                  </div>
                </div>
              </div>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {/* Option 1: Financial Ledger CSV */}
              <button
                type="button"
                onClick={() => setReportType('financial')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  reportType === 'financial'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <h4 className="font-extrabold text-xs text-slate-900 truncate">
                    Buku Kas (.CSV)
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2">
                  Arus kas masuk, santunan duka & saldo berjalan.
                </p>
              </button>

              {/* Option 2: Dues Collection CSV */}
              <button
                type="button"
                onClick={() => setReportType('payments')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  reportType === 'payments'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                  <h4 className="font-extrabold text-xs text-slate-900 truncate">
                    Penerimaan Iuran (.CSV)
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2">
                  Daftar transaksi iuran & nomor kwitansi.
                </p>
              </button>

              {/* Option 3: Benefit Realization Claims CSV */}
              <button
                type="button"
                onClick={() => setReportType('claims')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  reportType === 'claims'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <HeartHandshake className="w-4 h-4 text-rose-700 shrink-0" />
                  <h4 className="font-extrabold text-xs text-slate-900 truncate">
                    Santunan Duka (.CSV)
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2">
                  Catatan pengeluaran santunan duka.
                </p>
              </button>

              {/* Option 4: Member Compliance Recap CSV */}
              <button
                type="button"
                onClick={() => setReportType('compliance')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  reportType === 'compliance'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-700 shrink-0" />
                  <h4 className="font-extrabold text-xs text-slate-900 truncate">
                    Rekap Kepatuhan (.CSV)
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2">
                  Status lunas / belum bayar per anggota.
                </p>
              </button>
            </div>
          </div>

          {/* STEP 2: Pilih Periode & Pengaturan Judul Periode / Nama Bendahara */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>2. Pengaturan Periode & Penandatangan</span>
                </label>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-mono font-bold shadow-xs">
                  {selectedPeriod}
                </span>
              </div>

              {reportType === 'treasurer_pdf' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Teks Sub-Judul Periode pada Header PDF:
                    </label>
                    <input
                      type="text"
                      value={periodHeaderText}
                      onChange={(e) => setPeriodHeaderText(e.target.value)}
                      placeholder="TGL. 01 NOVEMBER 2026 S/D 31 OKTOBER 2027"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Bendahara (Kanan Bawah PDF):
                    </label>
                    <input
                      type="text"
                      value={treasurerNameInput}
                      onChange={(e) => setTreasurerNameInput(e.target.value)}
                      placeholder="Nama Bendahara"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Dual Selectors: Tahun & Bulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Filter Tahun Transaksi:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="all">🌟 Semua Tahun (Semua Peserta Aktif)</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={String(yr)}>
                        📅 Tahun {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Filter Bulan Transaksi:
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
            </div>

            {/* Live Financial KPI Preview */}
            <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Ringkasan Laporan</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-700">
                  {reportType === 'treasurer_pdf'
                    ? `${treasurerRows.length} Peserta`
                    : `${previewPayments.length + previewClaims.length} Transaksi`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Total Nominal:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                    {formatIDR(periodIncome)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">
                    {reportType === 'treasurer_pdf'
                      ? `${treasurerRows.length} warga kepesertaan`
                      : `${previewPayments.length} transaksi iuran`}
                  </span>
                </div>

                <div className="p-2.5 bg-rose-50/80 rounded-xl border border-rose-100">
                  <span className="text-[10px] text-rose-700 font-semibold flex items-center gap-1">
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
                <span className="text-[10px] font-bold text-slate-600">Total Kas Tercatat:</span>
                <span className="font-mono font-black text-xs text-slate-950 bg-[#ffff00] px-2 py-0.5 rounded">
                  Rp {formatNominalIdrDecimal(periodIncome)}
                </span>
              </div>
            </div>
          </div>

          {/* STEP 3: Pratinjau Tabel Laporan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 font-bold">
                <Table className="w-4 h-4 text-emerald-400" />
                <span>
                  {reportType === 'treasurer_pdf'
                    ? 'Pratinjau Cetakan PDF Laporan Bendahara'
                    : `Pratinjau Data CSV (${selectedPeriod})`}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {reportType === 'treasurer_pdf' ? 'Format: A4 PDF' : 'Format: UTF-8 CSV'}
              </span>
            </div>

            {reportType === 'treasurer_pdf' ? (
              /* EXACT PREVIEW OF THE PDF DOCUMENT WITH LOGO, TABLE, TOTAL, PRINT DATE & TREASURER */
              <div className="p-4 sm:p-6 bg-white overflow-x-auto max-h-96 overflow-y-auto">
                <div className="min-w-[640px] text-black font-sans">
                  {/* Header with Organization Logo & Title */}
                  <div className="relative flex items-center justify-center mb-3 min-h-[56px]">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center">
                      <img
                        src={settings.logoUrl || '/app-icon.svg'}
                        alt="Logo Organisasi"
                        className="w-12 h-12 object-contain rounded-lg"
                      />
                    </div>
                    <div className="text-center px-16">
                      <p className="text-xs font-bold uppercase text-black">
                        {settings.communityName || 'PAGUYUBAN DANA KEMATIAN'}
                      </p>
                      <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-black">
                        DAFTAR ANGGOTA KEPESERTAAN DANA KEMATIAN
                      </h3>
                      <p className="text-xs sm:text-sm font-bold uppercase text-black mt-0.5">
                        {periodHeaderText.toUpperCase().startsWith('PERIODE')
                          ? periodHeaderText.toUpperCase()
                          : `PERIODE : ${periodHeaderText.toUpperCase()}`}
                      </p>
                    </div>
                  </div>

                  {/* Separated Header Box */}
                  <table className="w-full border-collapse border-2 border-black text-xs mb-1.5">
                    <thead>
                      <tr>
                        <th className="border border-black py-1.5 px-2 text-center font-bold w-[7%]">
                          No
                        </th>
                        <th className="border border-black py-1.5 px-3 text-center font-bold w-[37%]">
                          Nama Warga dan Nomor Anggota
                        </th>
                        <th className="border border-black py-1.5 px-3 text-center font-bold w-[18%]">
                          Nominal
                        </th>
                        <th className="border border-black py-1.5 px-3 text-center font-bold w-[38%]">
                          Keterangan
                        </th>
                      </tr>
                    </thead>
                  </table>

                  {/* Body Rows Box */}
                  <table className="w-full border-collapse border border-black text-xs">
                    <tbody>
                      {treasurerRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="border border-black py-6 text-center text-slate-500"
                          >
                            Belum ada data anggota kepesertaan terverifikasi pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        treasurerRows.map((row) => (
                          <tr key={`${row.memberId}-${row.no}`}>
                            <td className="border border-black py-2 px-2 text-center align-top w-[7%]">
                              {row.no}
                            </td>
                            <td className="border border-black py-2 px-3 align-top w-[37%] leading-snug">
                              <div>{row.memberName}</div>
                              <div>
                                {row.memberNumber}
                                {row.cluster}
                              </div>
                              <div>{row.phone}</div>
                            </td>
                            <td className="border border-black py-2 px-3 align-middle w-[18%]">
                              <div className="flex items-center justify-between gap-2">
                                <span>Rp</span>
                                <span>{formatNominalIdrDecimal(row.amount)}</span>
                              </div>
                            </td>
                            <td className="border border-black py-2 px-3 text-center align-middle w-[38%]">
                              {row.keterangan}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Total Yellow Highlight Box under Nominal column */}
                  <div className="flex w-full mt-2.5 text-xs">
                    <div className="w-[44%]" />
                    <div className="w-[18%] bg-[#ffff00] px-3 py-1 font-bold text-black flex items-center justify-between">
                      <span>Rp</span>
                      <span>{formatNominalIdrDecimal(treasurerTotalNominal)}</span>
                    </div>
                    <div className="w-[38%]" />
                  </div>

                  {/* Bottom Footer: Tanggal Cetak (Left) & Bendahara Signature (Right) */}
                  <div className="flex items-start justify-between mt-4 pt-2 text-xs text-black">
                    <div>
                      <p>Tanggal Cetak : {printDateInfo.dateTime}</p>
                    </div>
                    <div className="text-center min-w-[180px]">
                      <p>Dicetak tanggal, {printDateInfo.dateOnly}</p>
                      <p className="font-bold mt-0.5">Bendahara,</p>
                      {settings.defaultAdminSignature ? (
                        <img
                          src={settings.defaultAdminSignature}
                          alt="TTD Bendahara"
                          className="h-10 mx-auto my-1 object-contain"
                        />
                      ) : (
                        <div className="h-10" />
                      )}
                      <p className="font-bold underline">
                        ( {treasurerNameInput || resolveTreasurerName(settings)} )
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
                            <td className="py-2 px-3 font-bold">
                              {c.deceasedName} ({c.relationship})
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              Santunan Duka Ahli Waris {c.memberName}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-rose-700 text-right">
                              {formatIDR(c.totalAmount)}
                            </td>
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
                            <td className="py-2 px-3 text-slate-500">
                              Status Iuran {selectedPeriod}
                            </td>
                            <td className="py-2 px-3 font-mono text-right">
                              {formatIDR(settings.monthlyFeeAmount)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
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
                          <td className="py-2 px-3 text-slate-500">
                            {p.paymentType} ({p.periodMonth})
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-right">
                            {formatIDR(p.amount)}
                          </td>
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
            )}
          </div>

          {/* Success Notification Banner */}
          {downloadSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">
                  File {reportType === 'treasurer_pdf' ? 'PDF' : 'CSV'} Berhasil Diunduh!
                </span>{' '}
                {downloadedFileName && (
                  <span className="font-mono text-[11px]">({downloadedFileName})</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-200/80 border border-slate-300 text-slate-700 font-bold rounded-xl transition-colors text-center cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 text-center cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {reportType === 'treasurer_pdf'
                  ? 'Unduh Laporan Bendahara (.PDF)'
                  : 'Unduh File CSV Sekarang'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
