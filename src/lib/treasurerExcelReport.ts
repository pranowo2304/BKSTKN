import * as XLSXNamespace from 'xlsx-js-style';
import {
  GenerateTreasurerPdfOptions,
  TreasurerReportRow,
  buildTreasurerReportRows,
  formatIndonesianPrintDate,
  getDefaultPeriodHeaderText,
  resolveTreasurerName,
} from './treasurerPdfReport';
import { getIndonesiaDateString } from './indonesianTime';

const XLSX =
  (XLSXNamespace as unknown as { default?: typeof XLSXNamespace }).default || XLSXNamespace;

type CellStyle = {
  font?: {
    name?: string;
    sz?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: { rgb: string };
  };
  fill?: {
    patternType?: 'solid';
    fgColor?: { rgb: string };
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'center' | 'bottom';
    wrapText?: boolean;
  };
  border?: {
    top?: { style: 'thin' | 'medium'; color: { rgb: string } };
    bottom?: { style: 'thin' | 'medium'; color: { rgb: string } };
    left?: { style: 'thin' | 'medium'; color: { rgb: string } };
    right?: { style: 'thin' | 'medium'; color: { rgb: string } };
  };
  numFmt?: string;
};

const BLACK_THIN_BORDER = { style: 'thin' as const, color: { rgb: '000000' } };
const BLACK_MEDIUM_BORDER = { style: 'medium' as const, color: { rgb: '000000' } };

const FULL_THIN_BORDER = {
  top: BLACK_THIN_BORDER,
  bottom: BLACK_THIN_BORDER,
  left: BLACK_THIN_BORDER,
  right: BLACK_THIN_BORDER,
};

const HEADER_BORDER = {
  top: BLACK_MEDIUM_BORDER,
  bottom: BLACK_MEDIUM_BORDER,
  left: BLACK_THIN_BORDER,
  right: BLACK_THIN_BORDER,
};

function setStyledCell(
  ws: XLSXNamespace.WorkSheet,
  rowIdx: number,
  colIdx: number,
  value: string | number,
  style?: CellStyle,
  options?: { formula?: string; numFmt?: string }
): void {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  const isNumber = typeof value === 'number';
  const cell: XLSXNamespace.CellObject = {
    t: isNumber ? 'n' : 's',
    v: value,
  };
  if (options?.formula) {
    cell.f = options.formula;
  }
  if (options?.numFmt) {
    cell.z = options.numFmt;
  }
  if (style) {
    cell.s = {
      ...style,
      ...(options?.numFmt ? { numFmt: options.numFmt } : {}),
    };
  }
  ws[addr] = cell;
}

function buildOfficialSheet(
  rows: TreasurerReportRow[],
  orgName: string,
  formattedPeriodLine: string,
  treasurerName: string,
  dateOnly: string,
  dateTime: string
): XLSXNamespace.WorkSheet {
  const ws: XLSXNamespace.WorkSheet = {};
  const rowHeights: XLSXNamespace.RowInfo[] = [];
  const merges: XLSXNamespace.Range[] = [];

  // Title Block (Rows 0..2)
  setStyledCell(ws, 0, 0, orgName.toUpperCase(), {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
  rowHeights[0] = { hpt: 20 };

  setStyledCell(ws, 1, 0, 'DAFTAR ANGGOTA KEPESERTAAN DANA KEMATIAN', {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 3 } });
  rowHeights[1] = { hpt: 24 };

  setStyledCell(ws, 2, 0, formattedPeriodLine, {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 3 } });
  rowHeights[2] = { hpt: 20 };

  // Spacer row 3
  rowHeights[3] = { hpt: 10 };

  // Table Header (Row 4)
  const headerRowIdx = 4;
  const headers = ['No', 'Nama Warga dan Nomor Anggota', 'Nominal', 'Keterangan'];
  headers.forEach((title, colIdx) => {
    setStyledCell(ws, headerRowIdx, colIdx, title, {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: HEADER_BORDER,
    });
  });
  rowHeights[headerRowIdx] = { hpt: 24 };

  // Data Rows
  const dataStartRowIdx = 5;
  let currentRowIdx = dataStartRowIdx;

  if (rows.length === 0) {
    setStyledCell(
      ws,
      currentRowIdx,
      0,
      'Belum ada data pembayaran anggota terverifikasi pada periode ini.',
      {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '64748B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: FULL_THIN_BORDER,
      }
    );
    for (let c = 1; c <= 3; c++) {
      setStyledCell(ws, currentRowIdx, c, '', { border: FULL_THIN_BORDER });
    }
    merges.push({ s: { r: currentRowIdx, c: 0 }, e: { r: currentRowIdx, c: 3 } });
    rowHeights[currentRowIdx] = { hpt: 28 };
    currentRowIdx += 1;
  } else {
    rows.forEach((row) => {
      setStyledCell(ws, currentRowIdx, 0, row.no, {
        font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'top' },
        border: FULL_THIN_BORDER,
      });

      const memberBlock = `${row.memberName || '-'}\n${row.memberNumber || ''}${row.cluster || ''}\n${row.phone || '-'}`;
      setStyledCell(ws, currentRowIdx, 1, memberBlock, {
        font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
        border: FULL_THIN_BORDER,
      });

      setStyledCell(
        ws,
        currentRowIdx,
        2,
        row.amount || 0,
        {
          font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: FULL_THIN_BORDER,
        },
        { numFmt: '"Rp "#,##0.00' }
      );

      setStyledCell(ws, currentRowIdx, 3, row.keterangan || '-', {
        font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: FULL_THIN_BORDER,
      });

      rowHeights[currentRowIdx] = { hpt: 48 };
      currentRowIdx += 1;
    });
  }

  // Total Row (Yellow Highlight #FFFF00 under Nominal column)
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const dataEndRowIdx = Math.max(dataStartRowIdx, currentRowIdx - 1);
  const totalRowIdx = currentRowIdx;

  setStyledCell(ws, totalRowIdx, 1, 'TOTAL NOMINAL', {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'right', vertical: 'center' },
  });

  const sumFormula =
    rows.length > 0
      ? `SUM(C${dataStartRowIdx + 1}:C${dataEndRowIdx + 1})`
      : undefined;

  setStyledCell(
    ws,
    totalRowIdx,
    2,
    totalAmount,
    {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: FULL_THIN_BORDER,
    },
    { formula: sumFormula, numFmt: '"Rp "#,##0.00' }
  );
  rowHeights[totalRowIdx] = { hpt: 24 };

  // Footer: Tanggal Cetak (kiri) & Signature Bendahara (kanan)
  const footerStartRow = totalRowIdx + 2;
  rowHeights[totalRowIdx + 1] = { hpt: 12 };

  setStyledCell(ws, footerStartRow, 0, `Tanggal Cetak : ${dateTime}`, {
    font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  merges.push({ s: { r: footerStartRow, c: 0 }, e: { r: footerStartRow, c: 1 } });

  setStyledCell(ws, footerStartRow, 3, `Dicetak tanggal, ${dateOnly}`, {
    font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  rowHeights[footerStartRow] = { hpt: 18 };

  setStyledCell(ws, footerStartRow + 1, 3, 'Bendahara,', {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  rowHeights[footerStartRow + 1] = { hpt: 18 };

  // Signature spacing
  rowHeights[footerStartRow + 2] = { hpt: 22 };
  rowHeights[footerStartRow + 3] = { hpt: 22 };

  const sigNameRow = footerStartRow + 4;
  setStyledCell(ws, sigNameRow, 3, `( ${treasurerName} )`, {
    font: { name: 'Calibri', sz: 10, bold: true, underline: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  rowHeights[sigNameRow] = { hpt: 20 };

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: sigNameRow, c: 3 },
  });
  ws['!cols'] = [
    { wch: 7 },  // No
    { wch: 42 }, // Nama Warga dan Nomor Anggota
    { wch: 22 }, // Nominal
    { wch: 44 }, // Keterangan
  ];
  ws['!rows'] = rowHeights;
  ws['!merges'] = merges;

  return ws;
}

function buildStructuredSheet(
  rows: TreasurerReportRow[],
  orgName: string,
  formattedPeriodLine: string,
  treasurerName: string,
  dateTime: string
): XLSXNamespace.WorkSheet {
  const ws: XLSXNamespace.WorkSheet = {};
  const rowHeights: XLSXNamespace.RowInfo[] = [];
  const merges: XLSXNamespace.Range[] = [];

  setStyledCell(ws, 0, 0, `${orgName.toUpperCase()} — DATA TERSTRUKTUR LAPORAN BENDAHARA`, {
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } });
  rowHeights[0] = { hpt: 22 };

  setStyledCell(ws, 1, 0, `${formattedPeriodLine}  |  Dicetak: ${dateTime}  |  Bendahara: ${treasurerName}`, {
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '475569' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } });
  rowHeights[1] = { hpt: 18 };

  rowHeights[2] = { hpt: 8 };

  const headerRowIdx = 3;
  const headers = [
    'No',
    'Nama Warga',
    'Nomor Anggota',
    'Cluster / RT',
    'No. HP / WhatsApp',
    'Nominal (Rp)',
    'Metode Pembayaran',
    'Waktu Transaksi / Catatan (WIB)',
    'Keterangan Lengkap',
  ];

  headers.forEach((h, colIdx) => {
    setStyledCell(ws, headerRowIdx, colIdx, h, {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: FULL_THIN_BORDER,
    });
  });
  rowHeights[headerRowIdx] = { hpt: 24 };

  const dataStartRowIdx = 4;
  let currentRowIdx = dataStartRowIdx;

  rows.forEach((row) => {
    setStyledCell(ws, currentRowIdx, 0, row.no, {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(ws, currentRowIdx, 1, row.memberName || '-', {
      font: { name: 'Calibri', sz: 10, bold: true },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(ws, currentRowIdx, 2, row.memberNumber || '-', {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(ws, currentRowIdx, 3, row.cluster || '-', {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(ws, currentRowIdx, 4, row.phone || '-', {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(
      ws,
      currentRowIdx,
      5,
      row.amount || 0,
      {
        font: { name: 'Calibri', sz: 10 },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: FULL_THIN_BORDER,
      },
      { numFmt: '"Rp "#,##0' }
    );
    setStyledCell(ws, currentRowIdx, 6, row.paymentMethod || '-', {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(ws, currentRowIdx, 7, row.timestamp ? `${row.timestamp} WIB` : '-', {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });
    setStyledCell(ws, currentRowIdx, 8, row.keterangan || '-', {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: FULL_THIN_BORDER,
    });

    rowHeights[currentRowIdx] = { hpt: 20 };
    currentRowIdx += 1;
  });

  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalRowIdx = currentRowIdx;

  setStyledCell(ws, totalRowIdx, 0, 'TOTAL KESELURUHAN', {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: FULL_THIN_BORDER,
  });
  for (let c = 1; c <= 4; c++) {
    setStyledCell(ws, totalRowIdx, c, '', {
      fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
      border: FULL_THIN_BORDER,
    });
  }
  merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 4 } });

  const sumFormula =
    rows.length > 0
      ? `SUM(F${dataStartRowIdx + 1}:F${currentRowIdx})`
      : undefined;

  setStyledCell(
    ws,
    totalRowIdx,
    5,
    totalAmount,
    {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: FULL_THIN_BORDER,
    },
    { formula: sumFormula, numFmt: '"Rp "#,##0' }
  );

  for (let c = 6; c <= 8; c++) {
    setStyledCell(ws, totalRowIdx, c, '', {
      fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
      border: FULL_THIN_BORDER,
    });
  }
  rowHeights[totalRowIdx] = { hpt: 22 };

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRowIdx, c: 8 },
  });
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 28 }, // Nama Warga
    { wch: 16 }, // Nomor Anggota
    { wch: 14 }, // Cluster
    { wch: 16 }, // No HP
    { wch: 18 }, // Nominal
    { wch: 24 }, // Metode
    { wch: 26 }, // Waktu Transaksi
    { wch: 42 }, // Keterangan Lengkap
  ];
  ws['!rows'] = rowHeights;
  ws['!merges'] = merges;

  if (rows.length > 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIdx, c: 0 },
        e: { r: currentRowIdx - 1, c: 8 },
      }),
    };
  }

  return ws;
}

export function generateTreasurerExcelWorkbook(
  options: GenerateTreasurerPdfOptions
): XLSXNamespace.WorkBook {
  const rows = buildTreasurerReportRows(options);
  const periodText = (options.periodHeaderText || getDefaultPeriodHeaderText(options.settings)).trim();
  const formattedPeriodLine = periodText.toUpperCase().startsWith('PERIODE')
    ? periodText.toUpperCase()
    : `PERIODE : ${periodText.toUpperCase()}`;
  const orgName = (
    options.settings?.communityName ||
    options.settings?.organizationName ||
    'PAGUYUBAN DANA KEMATIAN'
  ).trim();
  const treasurerName = resolveTreasurerName(options.settings, options.treasurerName);
  const { dateOnly, dateTime } = formatIndonesianPrintDate(new Date());

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: 'Laporan Bendahara Kepesertaan Dana Kematian',
    Subject: formattedPeriodLine,
    Author: treasurerName,
    Company: orgName,
  };

  const officialSheet = buildOfficialSheet(
    rows,
    orgName,
    formattedPeriodLine,
    treasurerName,
    dateOnly,
    dateTime
  );
  const structuredSheet = buildStructuredSheet(
    rows,
    orgName,
    formattedPeriodLine,
    treasurerName,
    dateTime
  );

  XLSX.utils.book_append_sheet(wb, officialSheet, 'Laporan Bendahara');
  XLSX.utils.book_append_sheet(wb, structuredSheet, 'Data Terstruktur');

  return wb;
}

export function downloadTreasurerExcelReport(
  options: GenerateTreasurerPdfOptions
): string {
  const wb = generateTreasurerExcelWorkbook(options);
  const dateTag = getIndonesiaDateString().replace(/-/g, '');
  const filename = `Laporan_Bendahara_Kepesertaan_Dana_Kematian_${dateTag}.xlsx`;

  const wbArray = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  });

  const blob = new Blob([wbArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}
