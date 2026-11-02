import { jsPDF } from 'jspdf';
import { FuneralInventoryItem, FuneralInventoryLoan, SystemSettings } from '../types';

interface ExportInventoryPdfOptions {
  items: FuneralInventoryItem[];
  loans: FuneralInventoryLoan[];
  settings?: SystemSettings;
  generatedBy?: string;
}

export function generateInventoryPdfReport({
  items,
  loans,
  settings,
  generatedBy = 'Petugas Logistik & Inventaris',
}: ExportInventoryPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const orgName = settings?.communityName || settings?.organizationName || 'PAGUYUBAN RUKUN KEMATIAN';
  const orgAddress = settings?.communityAddress || settings?.organizationAddress || 'Sekretariat: Balai Pertemuan Warga RW 05';
  const orgContact = settings?.treasurerPhone || settings?.organizationPhone ? `Telp: ${settings?.treasurerPhone || settings?.organizationPhone}` : 'Pusat Logistik Fardhu Kifayah';
  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const docNumber = `INV-DUKA/LAP/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  let currentY = 14;

  // Header Letterhead
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 2, 'F');
  currentY += 6;

  // Title and Org
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(orgName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`${orgAddress} • ${orgContact}`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 148, 136); // teal-600
  doc.text('LAPORAN OPERASIONAL INVENTARIS DUKA & LOGISTIK', pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  // Decorative double line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 1;
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  // Meta bar (Nomor Dokumen, Tanggal, Dicetak Oleh)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 2, 2, 'D');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`No. Dokumen: ${docNumber}`, margin + 4, currentY + 6);
  doc.text(`Waktu Cetak: ${dateStr}, ${timeStr} WIB`, margin + 70, currentY + 6);
  doc.text(`Petugas: ${generatedBy}`, margin + 140, currentY + 6);
  currentY += 15;

  // KPI Summary Cards
  const totalItemCount = items.length;
  const totalUnits = items.reduce((sum, item) => sum + item.totalStock, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.availableStock, 0);
  const totalBorrowed = items.reduce((sum, item) => sum + item.borrowedStock, 0);
  const activeLoansCount = loans.filter((l) => l.status === 'DIPINJAM').length;

  const kpiWidth = (pageWidth - margin * 2 - 9) / 4;
  const kpiHeight = 14;

  const kpis = [
    { label: 'Total Aset Jenis', val: `${totalItemCount} Barang`, sub: `${totalUnits} total unit`, color: [30, 41, 59] },
    { label: 'Stok Siap / Tersedia', val: `${totalAvailable} Unit`, sub: 'Siaga di gudang', color: [16, 185, 129] },
    { label: 'Sedang Dipinjam', val: `${totalBorrowed} Unit`, sub: `${activeLoansCount} peminjaman aktif`, color: [239, 68, 68] },
    { label: 'Kondisi Baik', val: `${items.filter(i => i.condition === 'Baik').length} Barang`, sub: 'Siap pakai penuh', color: [13, 148, 136] },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(kpiX, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kpiX, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'D');

    // Colored accent left pill
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(kpiX, currentY, 2, kpiHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, kpiX + 5, currentY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.val, kpiX + 5, currentY + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, kpiX + 5, currentY + 12);
  });

  currentY += kpiHeight + 6;

  // SECTION 1: DAFTAR STOK & STATUS INVENTARIS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. DAFTAR STOK & STATUS KONDISI PERALATAN DUKA', margin, currentY);
  currentY += 4;

  // Table Headers
  const itemCols = [
    { title: 'No', width: 8, align: 'center' as const },
    { title: 'Kode', width: 22, align: 'left' as const },
    { title: 'Nama Peralatan', width: 50, align: 'left' as const },
    { title: 'Kategori', width: 24, align: 'left' as const },
    { title: 'Total', width: 13, align: 'center' as const },
    { title: 'Tersedia', width: 14, align: 'center' as const },
    { title: 'Dipinjam', width: 14, align: 'center' as const },
    { title: 'Kondisi', width: 18, align: 'center' as const },
    { title: 'Lokasi Simpan', width: 19, align: 'left' as const },
  ];

  const drawTableHeader = (yPos: number) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, yPos, pageWidth - margin * 2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    itemCols.forEach((col) => {
      const textX = col.align === 'center' ? curX + col.width / 2 : curX + 1.5;
      doc.text(col.title, textX, yPos + 4.2, { align: col.align });
      curX += col.width;
    });
  };

  drawTableHeader(currentY);
  currentY += 6;

  // Table Rows
  items.forEach((item, index) => {
    // Check page break
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = margin;
      drawTableHeader(currentY);
      currentY += 6;
    }

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, pageWidth - margin * 2, 5.5, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 5.5, pageWidth - margin, currentY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    let curX = margin;
    // No
    doc.text(String(index + 1), curX + itemCols[0].width / 2, currentY + 4, { align: 'center' });
    curX += itemCols[0].width;

    // Kode
    doc.setFont('helvetica', 'bold');
    doc.text(item.itemCode, curX + 1.5, currentY + 4);
    curX += itemCols[1].width;

    // Nama
    doc.setFont('helvetica', 'normal');
    const truncatedName = item.name.length > 32 ? item.name.substring(0, 30) + '...' : item.name;
    doc.text(truncatedName, curX + 1.5, currentY + 4);
    curX += itemCols[2].width;

    // Kategori
    doc.text(item.category, curX + 1.5, currentY + 4);
    curX += itemCols[3].width;

    // Total
    doc.text(`${item.totalStock} ${item.unit}`, curX + itemCols[4].width / 2, currentY + 4, { align: 'center' });
    curX += itemCols[4].width;

    // Tersedia (green if > 0)
    if (item.availableStock > 0) {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(`${item.availableStock}`, curX + itemCols[5].width / 2, currentY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    curX += itemCols[5].width;

    // Dipinjam (red if > 0)
    if (item.borrowedStock > 0) {
      doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(`${item.borrowedStock}`, curX + itemCols[6].width / 2, currentY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    curX += itemCols[6].width;

    // Kondisi
    doc.text(item.condition, curX + itemCols[7].width / 2, currentY + 4, { align: 'center' });
    curX += itemCols[7].width;

    // Lokasi
    const truncatedLoc = item.storageLocation.length > 15 ? item.storageLocation.substring(0, 13) + '..' : item.storageLocation;
    doc.text(truncatedLoc, curX + 1.5, currentY + 4);

    currentY += 5.5;
  });

  currentY += 6;

  // SECTION 2: RIWAYAT & CATATAN PEMINJAMAN TERBARU
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DAFTAR PEMINJAMAN & PENGEMBALIAN LOGISTIK', margin, currentY);
  currentY += 4;

  const loanCols = [
    { title: 'No', width: 8, align: 'center' as const },
    { title: 'No. Pinjam', width: 24, align: 'left' as const },
    { title: 'Peminjam / Almarhum', width: 44, align: 'left' as const },
    { title: 'RT', width: 12, align: 'center' as const },
    { title: 'Rincian Peralatan Dipinjam', width: 48, align: 'left' as const },
    { title: 'Tgl Pinjam', width: 16, align: 'center' as const },
    { title: 'Batas / Kembali', width: 16, align: 'center' as const },
    { title: 'Status', width: 14, align: 'center' as const },
  ];

  const drawLoanHeader = (yPos: number) => {
    doc.setFillColor(51, 65, 85);
    doc.rect(margin, yPos, pageWidth - margin * 2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    loanCols.forEach((col) => {
      const textX = col.align === 'center' ? curX + col.width / 2 : curX + 1.5;
      doc.text(col.title, textX, yPos + 4.2, { align: col.align });
      curX += col.width;
    });
  };

  drawLoanHeader(currentY);
  currentY += 6;

  if (loans.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Belum ada data peminjaman logistik yang tercatat.', pageWidth / 2, currentY + 5, { align: 'center' });
    currentY += 10;
  } else {
    loans.forEach((loan, index) => {
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = margin;
        drawLoanHeader(currentY);
        currentY += 6;
      }

      const isEven = index % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, pageWidth - margin * 2, 6, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + 6, pageWidth - margin, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      let curX = margin;
      // No
      doc.text(String(index + 1), curX + loanCols[0].width / 2, currentY + 4.2, { align: 'center' });
      curX += loanCols[0].width;

      // Kode Pinjam
      doc.setFont('helvetica', 'bold');
      doc.text(loan.loanCode, curX + 1.5, currentY + 4.2);
      doc.setFont('helvetica', 'normal');
      curX += loanCols[1].width;

      // Peminjam / Alm
      const borrowerNameStr = loan.borrowerName || loan.familyContactName || 'Warga';
      const contactInfo = loan.deceasedName ? `${loan.deceasedName} (${borrowerNameStr})` : borrowerNameStr;
      const truncatedContact = contactInfo.length > 27 ? contactInfo.substring(0, 25) + '..' : contactInfo;
      doc.text(truncatedContact, curX + 1.5, currentY + 4.2);
      curX += loanCols[2].width;

      // RT
      const borrowerRtStr = loan.borrowerRt || loan.cluster || '-';
      doc.text(borrowerRtStr, curX + loanCols[3].width / 2, currentY + 4.2, { align: 'center' });
      curX += loanCols[3].width;

      // Rincian items summary
      const loanItemsList = loan.items || loan.borrowedItems || [];
      const itemsSummary = loanItemsList.map((i) => `${i.quantity} ${i.itemName}`).join(', ');
      const truncatedSummary = itemsSummary.length > 33 ? itemsSummary.substring(0, 31) + '..' : itemsSummary;
      doc.text(truncatedSummary, curX + 1.5, currentY + 4.2);
      curX += loanCols[4].width;

      // Tgl Pinjam
      const borrowDateStr = loan.borrowDate || loan.loanDate || '';
      const borrowDateSimple = borrowDateStr ? borrowDateStr.split('T')[0] : '-';
      doc.text(borrowDateSimple, curX + loanCols[5].width / 2, currentY + 4.2, { align: 'center' });
      curX += loanCols[5].width;

      // Batas / Kembali
      const returnDateSimple = (loan.actualReturnDate || loan.expectedReturnDate || '').split('T')[0] || '-';
      doc.text(returnDateSimple, curX + loanCols[6].width / 2, currentY + 4.2, { align: 'center' });
      curX += loanCols[6].width;

      // Status
      if (loan.status === 'DIPINJAM') {
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text('DIPINJAM', curX + loanCols[7].width / 2, currentY + 4.2, { align: 'center' });
      } else if (loan.status === 'DIKEMBALIKAN') {
        doc.setTextColor(16, 185, 129);
        doc.setFont('helvetica', 'bold');
        doc.text('KEMBALI', curX + loanCols[7].width / 2, currentY + 4.2, { align: 'center' });
      } else {
        doc.text(loan.status, curX + loanCols[7].width / 2, currentY + 4.2, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      currentY += 6;
    });
  }

  currentY += 8;

  // SECTION 3: LEMBAR TANDA TANGAN / PENGESAHAN
  if (currentY > pageHeight - 48) {
    doc.addPage();
    currentY = margin + 10;
  }

  const signColWidth = (pageWidth - margin * 2) / 3;
  const signY = currentY;

  // Column 1: Petugas Logistik
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Dibuat & Diverifikasi Oleh,', margin + signColWidth / 2, signY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Petugas Logistik / Inventaris', margin + signColWidth / 2, signY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('( .................................................. )', margin + signColWidth / 2, signY + 24, { align: 'center' });
  doc.text('NIP/ID: LOG-001', margin + signColWidth / 2, signY + 28, { align: 'center' });

  // Column 2: Bendahara
  doc.text('Mengetahui / Memeriksa,', margin + signColWidth + signColWidth / 2, signY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Bendahara Paguyuban', margin + signColWidth + signColWidth / 2, signY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('( .................................................. )', margin + signColWidth + signColWidth / 2, signY + 24, { align: 'center' });
  doc.text('Pengelola Dana Kematian', margin + signColWidth + signColWidth / 2, signY + 28, { align: 'center' });

  // Column 3: Ketua Paguyuban
  doc.text('Menyetujui & Mengesahkan,', margin + signColWidth * 2 + signColWidth / 2, signY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('Ketua Paguyuban Rukun Kematian', margin + signColWidth * 2 + signColWidth / 2, signY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('( .................................................. )', margin + signColWidth * 2 + signColWidth / 2, signY + 24, { align: 'center' });
  doc.text('Periode 2025 - 2027', margin + signColWidth * 2 + signColWidth / 2, signY + 28, { align: 'center' });

  // Add page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sistem Administrasi Fardhu Kifayah • Dicetak pada ${dateStr} • Dokumen Resmi Paguyuban`,
      margin,
      pageHeight - 6
    );
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  return doc;
}
