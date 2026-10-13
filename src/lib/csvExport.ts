import { Member, Payment, BenefitClaim, SystemSettings } from '../types';
import { formatIDR } from './storage';

// Helper to escape CSV cell fields safely (handles quotes, commas, newlines)
export const escapeCSV = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

// Helper to trigger browser CSV download with UTF-8 BOM (\uFEFF)
export const downloadCSVFile = (filename: string, csvContent: string) => {
  const bom = '\uFEFF'; // Ensures Excel in Windows/Mac renders UTF-8 and Indonesian characters properly
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface FinancialSummaryData {
  periodLabel: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  verifiedPaymentsCount: number;
  claimsCount: number;
  activeMembersCount: number;
}

export const MONTHS_LIST = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const MONTH_TO_NUMBER: Record<string, string> = {
  januari: '01',
  februari: '02',
  maret: '03',
  april: '04',
  mei: '05',
  juni: '06',
  juli: '07',
  agustus: '08',
  september: '09',
  oktober: '10',
  november: '11',
  desember: '12',
};

export const parsePeriod = (period: string) => {
  const isAll = !period || period === 'Semua Periode' || period.toLowerCase() === 'semua' || period.toLowerCase().includes('semua periode');
  if (isAll) return { isAll: true, year: null, monthNum: null, monthName: null };

  const yearMatch = period.match(/\b(20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : null;

  const lower = period.toLowerCase();
  let monthName: string | null = null;
  let monthNum: string | null = null;

  for (const [mName, mNum] of Object.entries(MONTH_TO_NUMBER)) {
    if (lower.includes(mName)) {
      monthName = mName.charAt(0).toUpperCase() + mName.slice(1);
      monthNum = mNum;
      break;
    }
  }

  return { isAll: false, year, monthNum, monthName };
};

export const isPaymentMatchingPeriod = (p: Payment, period: string): boolean => {
  const { isAll, year, monthNum, monthName } = parsePeriod(period);
  if (isAll) return true;

  const pPeriod = (p.periodMonth || '').toLowerCase();
  const pCreated = p.createdAt || '';
  const pVerified = p.verifiedAt || '';
  const dateStr = pVerified || pCreated;

  // Exact period string match (e.g. "Agustus 2026" === "Agustus 2026")
  if (pPeriod === period.toLowerCase()) return true;

  // If specific month and year requested (e.g. "Januari 2026")
  if (year && monthNum && monthName) {
    const yearMonth = `${year}-${monthNum}`;
    // 1. Payment marked specifically for that month and year
    if (pPeriod.includes(monthName.toLowerCase()) && pPeriod.includes(year)) return true;
    // 2. Annual payment covering this entire year
    if (pPeriod.includes('tahun') && pPeriod.includes(year)) return true;
    // 3. Payment date falls within that year-month
    if (dateStr.includes(yearMonth)) return true;
    return false;
  }

  // If year only (e.g. "Tahun 2026" or year === '2026')
  if (year) {
    if (pPeriod.includes(year)) return true;
    if (dateStr.includes(year)) return true;
    return false;
  }

  // Fallback string matching
  return pPeriod.includes(period.toLowerCase()) || dateStr.includes(period);
};

export const isClaimMatchingPeriod = (c: BenefitClaim, period: string): boolean => {
  const { isAll, year, monthNum } = parsePeriod(period);
  if (isAll) return true;

  const dateStr = c.dateOfDeath || c.createdAt || '';

  if (year && monthNum) {
    const yearMonth = `${year}-${monthNum}`;
    return dateStr.includes(yearMonth);
  }

  if (year) {
    return dateStr.includes(year);
  }

  return dateStr.toLowerCase().includes(period.toLowerCase());
};

// 1. Comprehensive Monthly Financial Statement & General Ledger CSV
export const exportMonthlyFinancialStatementCSV = (
  period: string, // e.g. 'Agustus 2026' or 'Semua Periode' or 'Januari 2026'
  settings: SystemSettings,
  payments: Payment[],
  claims: BenefitClaim[],
  members: Member[],
  baseBalance: number = 0
) => {
  const isAllPeriod = !period || period === 'Semua Periode' || period.toLowerCase().includes('semua');

  // Filter payments by period
  const filteredPayments = isAllPeriod
    ? payments.filter((p) => p.status === 'Verified')
    : payments.filter((p) => p.status === 'Verified' && isPaymentMatchingPeriod(p, period));

  // Filter claims by period
  const filteredClaims = isAllPeriod
    ? claims
    : claims.filter((c) => isClaimMatchingPeriod(c, period));

  const totalIncome = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpense = filteredClaims.reduce((sum, c) => sum + c.totalAmount, 0);
  const netCashflow = totalIncome - totalExpense;

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rows: string[][] = [
    ['LAPORAN KEUANGAN KAS DANA KEMATIAN', ''],
    ['PAGUYUBAN', settings?.communityName || 'Paguyuban Warga'],
    ['ALAMAT', settings?.communityAddress || '-'],
    ['BENDAHARA / PENGURUS', `${settings?.treasurerName || 'Bendahara'} (${settings?.treasurerPhone || '-'})`],
    ['PERIODE LAPORAN', isAllPeriod ? 'SEMUA PERIODE TRANSAKSI' : period.toUpperCase()],
    ['TANGGAL UNDUH / CETAK', dateStr],
    [''],
    ['=== RINGKASAN ARUS KAS (CASH FLOW SUMMARY) ===', ''],
    ['Total Penerimaan Iuran (Terverifikasi)', String(totalIncome)],
    ['Total Realisasi Pengeluaran Santunan Duka', String(totalExpense)],
    ['Surplus / (Defisit) Kas Periode', String(netCashflow)],
    ['Jumlah Transaksi Iuran Terverifikasi', String(filteredPayments.length)],
    ['Jumlah Klaim Santunan Terealisasi', String(filteredClaims.length)],
    ['Total Anggota Aktif', String(members.filter((m) => m.status === 'Aktif').length)],
    [''],
    ['=== BUKU KAS TRANSAKSI RINCI (GENERAL CASH LEDGER) ===', ''],
    [
      'No',
      'Tanggal Transaksi',
      'Tipe Transaksi',
      'No. Dokumen / Kwitansi / Klaim',
      'Nama Anggota / Penerima',
      'Uraian / Keterangan',
      'Metode Pembayaran',
      'Status',
      'Pemasukan (IDR)',
      'Pengeluaran (IDR)',
      'Saldo Berjalan (IDR)',
    ],
  ];

  // Combine and sort ledger entries chronologically
  type LedgerEntry = {
    date: string;
    type: 'Penerimaan Iuran' | 'Pengeluaran Santunan Duka';
    docNo: string;
    personName: string;
    description: string;
    method: string;
    status: string;
    income: number;
    expense: number;
  };

  const ledger: LedgerEntry[] = [];

  filteredPayments.forEach((p) => {
    ledger.push({
      date: p.verifiedAt || p.createdAt,
      type: 'Penerimaan Iuran',
      docNo: p.receiptNumber,
      personName: p.memberName,
      description: `${p.paymentType} (${p.periodMonth || '-'}) - No. Anggota: ${p.memberNumber}`,
      method: p.paymentMethod,
      status: 'Lunas / Terverifikasi',
      income: p.amount,
      expense: 0,
    });
  });

  filteredClaims.forEach((c) => {
    ledger.push({
      date: c.createdAt || c.dateOfDeath,
      type: 'Pengeluaran Santunan Duka',
      docNo: c.claimNumber,
      personName: `Alm/Almh. ${c.deceasedName} (Ahli Waris: ${c.memberName})`,
      description: `Santunan Duka (${c.relationship}) - Sebab: ${c.causeOfDeath || 'Sakit/Usia Lanjut'}`,
      method: 'Kas Tunai / Kas Paguyuban',
      status: 'Terealisasi',
      income: 0,
      expense: c.totalAmount,
    });
  });

  // Sort ascending by date
  ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = isAllPeriod ? baseBalance : 0;

  ledger.forEach((item, index) => {
    runningBalance += item.income - item.expense;
    rows.push([
      String(index + 1),
      item.date,
      item.type,
      item.docNo,
      item.personName,
      item.description,
      item.method,
      item.status,
      String(item.income),
      String(item.expense),
      String(runningBalance),
    ]);
  });

  // Total summary row
  rows.push(['']);
  rows.push([
    '',
    '',
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    '',
    String(totalIncome),
    String(totalExpense),
    String(runningBalance),
  ]);

  const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  const safePeriodName = isAllPeriod ? 'Semua_Periode' : period.replace(/\s+/g, '_');
  const filename = `Laporan_Keuangan_Dana_Kematian_${safePeriodName}.csv`;

  downloadCSVFile(filename, csvContent);
};

// 2. Dues Collection Detailed CSV
export const exportDuesCollectionCSV = (
  period: string,
  payments: Payment[],
  members: Member[],
  settings: SystemSettings
) => {
  const isAllPeriod = !period || period === 'Semua Periode' || period.toLowerCase().includes('semua');
  const filtered = isAllPeriod
    ? payments
    : payments.filter((p) => isPaymentMatchingPeriod(p, period));

  const rows: string[][] = [
    ['LAPORAN PENERIMAAN IURAN ANGGOTA DANA KEMATIAN', ''],
    ['PAGUYUBAN', settings.communityName],
    ['PERIODE', isAllPeriod ? 'SEMUA PERIODE' : period.toUpperCase()],
    ['TANGGAL CETAK', new Date().toLocaleDateString('id-ID')],
    [''],
    [
      'No',
      'No. Kwitansi',
      'No. Anggota',
      'Nama Anggota',
      'NIK',
      'Jenis Iuran',
      'Periode Bulan',
      'Nominal Iuran (IDR)',
      'Metode Pembayaran',
      'Tanggal Pengajuan',
      'Tanggal Verifikasi',
      'Status Pembayaran',
      'Diverifikasi Oleh',
    ],
  ];

  filtered.forEach((p, idx) => {
    const member = members.find((m) => m.id === p.memberId || m.memberNumber === p.memberNumber);
    rows.push([
      String(idx + 1),
      p.receiptNumber,
      p.memberNumber,
      p.memberName,
      member ? member.nik : '-',
      p.paymentType,
      p.periodMonth || '-',
      String(p.amount),
      p.paymentMethod,
      p.createdAt,
      p.verifiedAt || '-',
      p.status === 'Verified' ? 'LUNAS (Terverifikasi)' : p.status === 'Pending' ? 'PENDING (Menunggu Validasi)' : 'DITOLAK',
      p.verifiedBy || (p.status === 'Verified' ? 'Admin Paguyuban' : '-'),
    ]);
  });

  const totalAmount = filtered
    .filter((p) => p.status === 'Verified')
    .reduce((sum, p) => sum + p.amount, 0);

  rows.push(['']);
  rows.push(['', '', '', 'TOTAL IURAN TERVERIFIKASI', '', '', '', String(totalAmount), '', '', '', '', '']);

  const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  const safePeriodName = isAllPeriod ? 'Semua_Periode' : period.replace(/\s+/g, '_');
  const filename = `Laporan_Penerimaan_Iuran_${safePeriodName}.csv`;

  downloadCSVFile(filename, csvContent);
};

// 3. Claims & Benefit Realizations Detailed CSV
export const exportBenefitClaimsCSV = (
  claims: BenefitClaim[],
  settings: SystemSettings,
  period?: string
) => {
  const isAllPeriod = !period || period === 'Semua Periode' || period.toLowerCase().includes('semua');
  const filteredClaims = isAllPeriod
    ? claims
    : claims.filter((c) => isClaimMatchingPeriod(c, period));

  const rows: string[][] = [
    ['LAPORAN REALISASI SANTUNAN & MANFAAT DANA DUKA', ''],
    ['PAGUYUBAN', settings.communityName],
    ['PERIODE LAPORAN', isAllPeriod ? 'SEMUA PERIODE' : period.toUpperCase()],
    ['TANGGAL CETAK', new Date().toLocaleDateString('id-ID')],
    [''],
    [
      'No',
      'No. Klaim / Dokumen',
      'No. Anggota',
      'Nama Anggota (Ahli Waris)',
      'Nama Almarhum / Almarhumah',
      'Hubungan Keluarga',
      'Tanggal Meninggal',
      'Penyebab Meninggal',
      'Rincian Pemakaian Biaya',
      'Total Manfaat Disalurkan (IDR)',
      'Tanggal Realisasi',
      'Petugas / Pengurus',
      'Catatan Khusus',
    ],
  ];

  filteredClaims.forEach((c, idx) => {
    const expenseBreakdown = (c.expenseDetails || [])
      .map((e) => `${e.description}: ${formatIDR(e.cost)}`)
      .join('; ');

    rows.push([
      String(idx + 1),
      c.claimNumber,
      c.memberNumber,
      c.memberName,
      c.deceasedName,
      c.relationship,
      c.dateOfDeath,
      c.causeOfDeath || 'Sakit / Usia Lanjut',
      expenseBreakdown,
      String(c.totalAmount),
      c.createdAt,
      c.processedBy || 'Pengurus Paguyuban',
      c.notes || '-',
    ]);
  });

  const totalSpent = filteredClaims.reduce((sum, c) => sum + c.totalAmount, 0);
  rows.push(['']);
  rows.push(['', '', '', '', '', '', '', '', 'TOTAL SANTUNAN TEREALISASI', String(totalSpent), '', '', '']);

  const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  const safePeriodName = isAllPeriod ? 'Semua_Periode' : period.replace(/\s+/g, '_');
  const filename = `Laporan_Realisasi_Santunan_Duka_${safePeriodName}.csv`;

  downloadCSVFile(filename, csvContent);
};

// 4. Monthly Member Compliance Recap CSV
export const exportMemberComplianceCSV = (
  periodMonth: string,
  members: Member[],
  payments: Payment[],
  settings: SystemSettings
) => {
  const rows: string[][] = [
    ['REKAPITULASI KEPATUHAN IURAN BULANAN ANGGOTA', ''],
    ['PAGUYUBAN', settings.communityName],
    ['PERIODE BULAN', periodMonth.toUpperCase()],
    ['BESARAN IURAN WAJIB', formatIDR(settings.monthlyFeeAmount)],
    ['TANGGAL CETAK', new Date().toLocaleDateString('id-ID')],
    [''],
    [
      'No',
      'No. Anggota',
      'Nama Anggota',
      'NIK',
      'No. HP / WA',
      'Alamat',
      'Status Anggota',
      'Jumlah Tanggungan',
      'Status Iuran Periode Ini',
      'Nominal Terbayar (IDR)',
      'No. Kwitansi',
      'Tanggal Bayar',
      'Metode Bayar',
    ],
  ];

  let totalPaid = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  members.forEach((m, idx) => {
    // Find verified payment for this member for this month
    const verifiedPayment = payments.find(
      (p) =>
        (p.memberId === m.id || p.memberNumber === m.memberNumber) &&
        p.status === 'Verified' &&
        isPaymentMatchingPeriod(p, periodMonth)
    );

    const pendingPayment = payments.find(
      (p) =>
        (p.memberId === m.id || p.memberNumber === m.memberNumber) &&
        p.status === 'Pending' &&
        isPaymentMatchingPeriod(p, periodMonth)
    );

    let statusText = 'BELUM BAYAR / MENUNGGAK';
    let amount = 0;
    let receiptNo = '-';
    let payDate = '-';
    let payMethod = '-';

    if (m.status !== 'Aktif') {
      statusText = `TIDAK AKTIF (${m.status.toUpperCase()})`;
    } else if (verifiedPayment) {
      statusText = 'LUNAS (Terverifikasi)';
      amount = verifiedPayment.amount;
      receiptNo = verifiedPayment.receiptNumber;
      payDate = verifiedPayment.verifiedAt || verifiedPayment.createdAt;
      payMethod = verifiedPayment.paymentMethod;
      totalPaid += amount;
      paidCount++;
    } else if (pendingPayment) {
      statusText = 'PENDING (Menunggu Validasi Admin)';
      amount = pendingPayment.amount;
      receiptNo = pendingPayment.receiptNumber;
      payDate = pendingPayment.createdAt;
      payMethod = pendingPayment.paymentMethod;
    } else {
      unpaidCount++;
    }

    rows.push([
      String(idx + 1),
      m.memberNumber,
      m.name,
      m.nik,
      m.phone,
      m.address,
      m.status,
      String(m.dependentsCount || 0),
      statusText,
      String(amount),
      receiptNo,
      payDate,
      payMethod,
    ]);
  });

  const activeCount = members.filter((m) => m.status === 'Aktif').length;
  const compliancePct = activeCount > 0 ? Math.round((paidCount / activeCount) * 100) : 0;

  rows.push(['']);
  rows.push(['RINGKASAN KEPATUHAN', '']);
  rows.push(['Total Anggota Aktif', String(activeCount)]);
  rows.push(['Anggota Lunas', `${paidCount} Orang`]);
  rows.push(['Anggota Belum Bayar / Menunggak', `${unpaidCount} Orang`]);
  rows.push(['Persentase Kepatuhan', `${compliancePct}%`]);
  rows.push(['Total Iuran Terkumpul (IDR)', String(totalPaid)]);

  const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  const safePeriodName = periodMonth.replace(/\s+/g, '_');
  const filename = `Rekap_Kepatuhan_Iuran_${safePeriodName}.csv`;

  downloadCSVFile(filename, csvContent);
};
