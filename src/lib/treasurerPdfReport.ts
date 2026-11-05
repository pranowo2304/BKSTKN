import { jsPDF } from 'jspdf';
import { Member, Payment, SystemSettings } from '../types';
import { getStoredUsers } from './storage';
import { isPaymentMatchingPeriod } from './csvExport';

export interface TreasurerReportRow {
  no: number;
  memberId: string;
  memberName: string;
  memberNumber: string;
  cluster: string;
  phone: string;
  amount: number;
  paymentMethod: string;
  timestamp: string;
  keterangan: string;
}

export interface GenerateTreasurerPdfOptions {
  members: Member[];
  payments: Payment[];
  settings: SystemSettings;
  periodFilter?: string; // e.g. 'Semua Periode' or 'Oktober 2026'
  periodHeaderText?: string; // e.g. 'TGL. 01 NOVEMBER 2026 S/D 31 OKTOBER 2027'
  clusterFilter?: string; // e.g. 'Semua' or specific cluster
  includeActiveWithoutPayment?: boolean;
  treasurerName?: string;
  logoPngDataUrl?: string | null;
}

const INDONESIAN_MONTHS_UPPER = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

const INDONESIAN_MONTHS_TITLE = [
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
];

export function formatDateToIndonesianUpper(dateStr?: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = match[3];
  if (monthIdx < 0 || monthIdx > 11) return null;
  return `${day} ${INDONESIAN_MONTHS_UPPER[monthIdx]} ${year}`;
}

export function formatIndonesianPrintDate(date: Date = new Date()): {
  dateOnly: string;
  dateTime: string;
} {
  const day = String(date.getDate()).padStart(2, '0');
  const month = INDONESIAN_MONTHS_TITLE[date.getMonth()] || '';
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const dateOnly = `${day} ${month} ${year}`;
  const dateTime = `${dateOnly}, ${hours}:${minutes} WIB`;
  return { dateOnly, dateTime };
}

export function resolveTreasurerName(settings?: SystemSettings, overrideName?: string): string {
  if (overrideName && overrideName.trim()) {
    return overrideName.trim();
  }
  try {
    const users = getStoredUsers();
    const bendaharaUser = users.find(
      (u) => u && u.authority === 'Bendahara' && u.status !== 'Non-Aktif' && u.name?.trim()
    );
    if (bendaharaUser?.name?.trim()) {
      return bendaharaUser.name.trim();
    }
  } catch {
    // ignore storage errors
  }
  if (settings?.defaultAdminSignerName?.trim()) {
    return settings.defaultAdminSignerName.trim();
  }
  if (settings?.treasurerName?.trim()) {
    return settings.treasurerName.trim();
  }
  return 'Bendahara Paguyuban';
}

export async function loadLogoAsPngDataUrl(logoUrl?: string): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const targetUrl = logoUrl?.trim() || '/app-icon.svg';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, size, size);
        // Preserve aspect ratio centered inside 256x256
        const iw = img.naturalWidth || size;
        const ih = img.naturalHeight || size;
        const scale = Math.min(size / iw, size / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (size - dw) / 2;
        const dy = (size - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = targetUrl;
  });
}

export function getDefaultPeriodHeaderText(settings?: SystemSettings): string {
  const mp = settings?.membershipPeriod;
  if (mp?.customStartDate && mp?.customEndDate) {
    if (!(mp.customStartDate === '2026-01-01' && mp.customEndDate === '2026-12-31')) {
      const startFormatted = formatDateToIndonesianUpper(mp.customStartDate);
      const endFormatted = formatDateToIndonesianUpper(mp.customEndDate);
      if (startFormatted && endFormatted) {
        return `TGL. ${startFormatted} S/D ${endFormatted}`;
      }
    }
  }
  return 'TGL. 01 NOVEMBER 2026 S/D 31 OKTOBER 2027';
}

export function formatNominalIdrDecimal(amount: number): string {
  const num = Math.round(Number(amount) || 0);
  const formattedInt = String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${num < 0 ? '-' : ''}${formattedInt},00`;
}

export function formatReportPhone(phone?: string): string {
  if (!phone) return '-';
  let cleaned = phone.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+62')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('62') && cleaned.length > 9) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned || phone.trim();
}

export function resolveBankTransferLabel(paymentMethod?: string, settings?: SystemSettings): string {
  const raw = (paymentMethod || '').trim();
  const primaryBank = settings?.bankAccounts?.[0]?.bankName?.trim();

  if (!raw || raw.toLowerCase() === 'transfer' || raw.toLowerCase() === 'transfer bank') {
    if (primaryBank) {
      return primaryBank.toLowerCase().startsWith('bank')
        ? `Transfer ${primaryBank}`
        : `Transfer Bank ${primaryBank}`;
    }
    return 'Transfer Bank Muamalat';
  }

  return raw;
}

export function buildTreasurerReportRows({
  members,
  payments,
  settings,
  periodFilter = 'Semua Periode',
  clusterFilter = 'Semua',
  includeActiveWithoutPayment = true,
}: GenerateTreasurerPdfOptions): TreasurerReportRow[] {
  const isAllPeriod =
    !periodFilter ||
    periodFilter === 'Semua Periode' ||
    periodFilter.toLowerCase() === 'semua' ||
    periodFilter.toLowerCase().includes('semua periode');

  const memberById = new Map<string, Member>();
  const memberByNumber = new Map<string, Member>();
  const memberByName = new Map<string, Member>();

  members.forEach((m) => {
    if (m.id) memberById.set(m.id, m);
    if (m.memberNumber) memberByNumber.set(m.memberNumber.trim().toLowerCase(), m);
    if (m.name) memberByName.set(m.name.trim().toLowerCase(), m);
  });

  const verifiedPayments = payments.filter((p) => {
    if (p.status !== 'Verified') return false;
    if (!isAllPeriod && !isPaymentMatchingPeriod(p, periodFilter)) return false;
    return true;
  });

  const rawEntries: Omit<TreasurerReportRow, 'no'>[] = [];
  const coveredMemberIds = new Set<string>();
  const coveredMemberNumbers = new Set<string>();

  verifiedPayments.forEach((p) => {
    const matchedMember =
      (p.memberId ? memberById.get(p.memberId) : undefined) ||
      (p.memberNumber ? memberByNumber.get(p.memberNumber.trim().toLowerCase()) : undefined) ||
      (p.memberName ? memberByName.get(p.memberName.trim().toLowerCase()) : undefined);

    const cluster = matchedMember?.cluster || '';
    if (clusterFilter && clusterFilter !== 'Semua' && cluster !== clusterFilter) {
      return;
    }

    if (matchedMember?.id) coveredMemberIds.add(matchedMember.id);
    if (p.memberId) coveredMemberIds.add(p.memberId);
    if (matchedMember?.memberNumber) coveredMemberNumbers.add(matchedMember.memberNumber.trim().toLowerCase());
    if (p.memberNumber) coveredMemberNumbers.add(p.memberNumber.trim().toLowerCase());

    const memberName = matchedMember?.name || p.memberName || '-';
    const memberNumber = matchedMember?.memberNumber || p.memberNumber || '-';
    const phone = formatReportPhone(matchedMember?.phone || '');
    const methodLabel = resolveBankTransferLabel(p.paymentMethod, settings);
    const timestamp = (p.createdAt || p.verifiedAt || matchedMember?.joinDate || '').trim();

    rawEntries.push({
      memberId: matchedMember?.id || p.memberId || p.id,
      memberName,
      memberNumber,
      cluster,
      phone,
      amount: p.amount || settings?.annualFeeAmount || 250000,
      paymentMethod: methodLabel,
      timestamp,
      keterangan: `${methodLabel}${timestamp}`,
    });
  });

  if (includeActiveWithoutPayment && isAllPeriod) {
    members.forEach((m) => {
      const isCovered =
        (m.id && coveredMemberIds.has(m.id)) ||
        (m.memberNumber && coveredMemberNumbers.has(m.memberNumber.trim().toLowerCase()));

      if (isCovered) return;
      if (m.status !== 'Aktif') return;
      if (clusterFilter && clusterFilter !== 'Semua' && m.cluster !== clusterFilter) return;

      const methodLabel = resolveBankTransferLabel(undefined, settings);
      const timestamp = (m.ktaIssuedAt || m.approvedByPaguyubanAt || m.verifiedAt || m.joinDate || '').trim();

      rawEntries.push({
        memberId: m.id,
        memberName: m.name,
        memberNumber: m.memberNumber,
        cluster: m.cluster || '',
        phone: formatReportPhone(m.phone),
        amount: settings?.annualFeeAmount || 250000,
        paymentMethod: methodLabel,
        timestamp,
        keterangan: `${methodLabel}${timestamp}`,
      });
    });
  }

  rawEntries.sort((a, b) => {
    const timeA = a.timestamp || '';
    const timeB = b.timestamp || '';
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    return a.memberNumber.localeCompare(b.memberNumber);
  });

  return rawEntries.map((item, idx) => ({
    ...item,
    no: idx + 1,
  }));
}

export function generateTreasurerPdfDocument(options: GenerateTreasurerPdfOptions): jsPDF {
  const rows = buildTreasurerReportRows(options);
  const periodText = (options.periodHeaderText || getDefaultPeriodHeaderText(options.settings)).trim();
  const orgName = (options.settings?.communityName || options.settings?.organizationName || 'PAGUYUBAN DANA KEMATIAN').trim();
  const treasurerName = resolveTreasurerName(options.settings, options.treasurerName);
  const { dateOnly, dateTime } = formatIndonesianPrintDate(new Date());

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 18;
  const marginTop = 15;
  const tableWidth = pageWidth - marginX * 2; // 261 mm

  // Column widths matching the uploaded image proportions
  const col0Width = 14; // No
  const col1Width = 96; // Nama Warga dan Nomor Anggota
  const col2Width = 45; // Nominal
  const col3Width = tableWidth - col0Width - col1Width - col2Width; // Keterangan (106 mm)

  const x0 = marginX;
  const x1 = x0 + col0Width;
  const x2 = x1 + col1Width;
  const x3 = x2 + col2Width;

  let currentY = marginTop;

  const drawTitleAndTableHeader = (startY: number, includeMainTitle: boolean): number => {
    let y = startY;

    if (includeMainTitle) {
      // Draw Organization Logo on the left of the header
      const logoSize = 16;
      const logoX = x0;
      const logoY = y - 3;
      let logoDrawn = false;

      const candidateLogo = options.logoPngDataUrl || options.settings?.logoUrl;
      if (candidateLogo && candidateLogo.startsWith('data:image/')) {
        try {
          const fmt =
            candidateLogo.includes('image/jpeg') || candidateLogo.includes('image/jpg')
              ? 'JPEG'
              : 'PNG';
          doc.addImage(candidateLogo, fmt, logoX, logoY, logoSize, logoSize);
          logoDrawn = true;
        } catch {
          logoDrawn = false;
        }
      }

      if (!logoDrawn) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text('PDK', logoX + logoSize / 2, logoY + 7.5, { align: 'center' });
        doc.setFontSize(4.5);
        doc.text('LOGO', logoX + logoSize / 2, logoY + 11.5, { align: 'center' });
      }

      // Centered Title Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(orgName.toUpperCase(), pageWidth / 2, y + 1, {
        align: 'center',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('DAFTAR ANGGOTA KEPESERTAAN DANA KEMATIAN', pageWidth / 2, y + 6.5, {
        align: 'center',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const formattedPeriodLine = periodText.toUpperCase().startsWith('PERIODE')
        ? periodText.toUpperCase()
        : `PERIODE : ${periodText.toUpperCase()}`;
      doc.text(formattedPeriodLine, pageWidth / 2, y + 12, {
        align: 'center',
      });

      y += 17;
    }

    // Header Box (separated from body table by a small gap, matching screenshot)
    const headerHeight = 9.5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(x0, y, tableWidth, headerHeight);

    // Column vertical dividers in header
    doc.setLineWidth(0.5);
    doc.line(x1, y, x1, y + headerHeight);
    doc.line(x2, y, x2, y + headerHeight);
    doc.line(x3, y, x3, y + headerHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const textY = y + 6.2;
    doc.text('No', x0 + col0Width / 2, textY, { align: 'center' });
    doc.text('Nama Warga dan Nomor Anggota', x1 + col1Width / 2, textY, { align: 'center' });
    doc.text('Nominal', x2 + col2Width / 2, textY, { align: 'center' });
    doc.text('Keterangan', x3 + col3Width / 2, textY, { align: 'center' });

    // Small gap between header box and body rows, as shown in the uploaded image
    return y + headerHeight + 2.5;
  };

  currentY = drawTitleAndTableHeader(currentY, true);

  const rowHeight = 19;

  if (rows.length === 0) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(x0, currentY, tableWidth, rowHeight);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Belum ada data pembayaran anggota terverifikasi pada periode ini.', pageWidth / 2, currentY + 10.5, {
      align: 'center',
    });
    currentY += rowHeight;
  } else {
    rows.forEach((row) => {
      if (currentY + rowHeight > pageHeight - 24) {
        doc.addPage();
        currentY = drawTitleAndTableHeader(marginTop, false);
      }

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(x0, currentY, tableWidth, rowHeight);
      doc.line(x1, currentY, x1, currentY + rowHeight);
      doc.line(x2, currentY, x2, currentY + rowHeight);
      doc.line(x3, currentY, x3, currentY + rowHeight);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);

      const yLine1 = currentY + 5.2;
      const yLine2 = currentY + 10.5;
      const yLine3 = currentY + 15.8;

      // Col 0: No
      doc.text(String(row.no), x0 + col0Width / 2, yLine1, { align: 'center' });

      // Col 1: Nama Warga dan Nomor Anggota (3 lines)
      doc.text(row.memberName || '-', x1 + 2.5, yLine1);
      doc.text(`${row.memberNumber || ''}${row.cluster || ''}`, x1 + 2.5, yLine2);
      doc.text(row.phone || '-', x1 + 2.5, yLine3);

      // Col 2: Nominal
      doc.text('Rp', x2 + 2.5, yLine2);
      doc.text(formatNominalIdrDecimal(row.amount), x3 - 2.5, yLine2, { align: 'right' });

      // Col 3: Keterangan
      doc.text(row.keterangan || '-', x3 + col3Width / 2, yLine2, { align: 'center' });

      currentY += rowHeight;
    });
  }

  // Total Box underneath the Nominal column (yellow highlight #FFFF00)
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  currentY += 4.5;

  if (currentY + 36 > pageHeight - 10) {
    doc.addPage();
    currentY = marginTop;
  }

  const totalBoxHeight = 7.5;
  doc.setFillColor(255, 255, 0); // Yellow highlight (#FFFF00)
  doc.rect(x2, currentY, col2Width, totalBoxHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Rp', x2 + 2.5, currentY + 5.2);
  doc.text(formatNominalIdrDecimal(totalAmount), x3 - 2.5, currentY + 5.2, { align: 'right' });

  // FOOTER: Tanggal Cetak (kiri bawah) & Nama Bendahara (kanan bawah)
  const footerStartY = currentY + totalBoxHeight + 6;

  // Left: Tanggal Cetak
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(`Tanggal Cetak : ${dateTime}`, x0, footerStartY);

  // Right: Signature block for Bendahara
  const sigCenterX = x0 + tableWidth - 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Dicetak tanggal, ${dateOnly}`, sigCenterX, footerStartY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Bendahara,', sigCenterX, footerStartY + 5, { align: 'center' });

  let nameY = footerStartY + 21;
  const sigDataUrl = options.settings?.defaultAdminSignature;
  if (sigDataUrl && sigDataUrl.startsWith('data:image/')) {
    try {
      const sigFmt =
        sigDataUrl.includes('image/jpeg') || sigDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(sigDataUrl, sigFmt, sigCenterX - 16, footerStartY + 6.5, 32, 12);
    } catch {
      // ignore signature image error
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const displayTreasurer = `( ${treasurerName} )`;
  doc.text(displayTreasurer, sigCenterX, nameY, { align: 'center' });

  const nameWidth = doc.getTextWidth(displayTreasurer);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(sigCenterX - nameWidth / 2, nameY + 1, sigCenterX + nameWidth / 2, nameY + 1);

  return doc;
}

export async function downloadTreasurerPdfReport(options: GenerateTreasurerPdfOptions): Promise<string> {
  const logoPngDataUrl =
    options.logoPngDataUrl !== undefined
      ? options.logoPngDataUrl
      : await loadLogoAsPngDataUrl(options.settings?.logoUrl || '/app-icon.svg');

  const doc = generateTreasurerPdfDocument({
    ...options,
    logoPngDataUrl,
  });

  const now = new Date();
  const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const filename = `Laporan_Bendahara_Kepesertaan_Dana_Kematian_${dateTag}.pdf`;
  doc.save(filename);
  return filename;
}
