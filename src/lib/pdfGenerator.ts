import jsPDF from 'jspdf';
import { Payment, Member, SystemSettings } from '../types';
import { formatIDR } from './storage';
import { terbilang } from './terbilang';

interface GenerateReceiptPdfParams {
  payment: Payment;
  member?: Member | null;
  settings: SystemSettings;
  qrCodeDataUrl?: string;
}

/**
 * Generates an authentic, crisp vector PDF receipt directly using jsPDF.
 * This completely avoids html2canvas and oklch CSS color parsing errors.
 */
export function generateReceiptPdf({
  payment,
  member,
  settings,
  qrCodeDataUrl,
}: GenerateReceiptPdfParams): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const startX = 15;
  const startY = 15;
  const contentWidth = pageWidth - startX * 2; // 180mm

  // 1. Outer Frame Border
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.5);
  doc.roundedRect(startX, startY, contentWidth, 260, 4, 4, 'S');

  // Inner border
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.2);
  doc.roundedRect(startX + 2, startY + 2, contentWidth - 4, 256, 3, 3, 'S');

  // 2. Header Background Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(startX + 3, startY + 3, contentWidth - 6, 36, 2, 2, 'F');

  // Decorative top accent line
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(startX + 3, startY + 3, contentWidth - 6, 2, 'F');

  let textOffsetX = startX + 8;

  // Render Paguyuban Logo in PDF Header if available
  if (settings.logoUrl) {
    try {
      // Draw a subtle white circular/rounded badge for the logo
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(startX + 7, startY + 8, 22, 22, 3, 3, 'F');
      
      const format = settings.logoUrl.includes('image/jpeg') || settings.logoUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(settings.logoUrl, format, startX + 8, startY + 9, 20, 20);
      textOffsetX = startX + 33;
    } catch {
      textOffsetX = startX + 8;
    }
  }

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text((settings.communityName || 'PAGUYUBAN DANA KEMATIAN').toUpperCase(), textOffsetX, startY + 14);

  // Header Subtitle & Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate-300
  const splitAddress = doc.splitTextToSize(
    settings.communityAddress || 'Sekretariat Pengurus Paguyuban Warga',
    contentWidth - 75 - (textOffsetX - startX)
  );
  doc.text(
    splitAddress,
    textOffsetX,
    startY + 21
  );

  // Badge on the right of header
  doc.setFillColor(6, 78, 59); // Emerald-900
  doc.setDrawColor(52, 211, 153); // Emerald-400
  doc.setLineWidth(0.3);
  doc.roundedRect(startX + contentWidth - 58, startY + 10, 50, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 231, 183); // Emerald-300
  doc.text('KWITANSI RESMI DIGITAL', startX + contentWidth - 54, startY + 16);
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PAGUYUBAN RUKUN KEMATIAN', startX + contentWidth - 54, startY + 22);

  // 3. Receipt Metadata Bar
  const metaY = startY + 44;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(startX + 6, metaY, contentWidth - 12, 16, 2, 2, 'FD');

  // No. Kwitansi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('NO. KWITANSI:', startX + 10, metaY + 6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(payment.receiptNumber || 'KW-OFFICIAL', startX + 10, metaY + 11.5);

  // Tanggal Transaksi
  const txDate = payment.verifiedAt || payment.createdAt || '-';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TANGGAL & WAKTU:', startX + 72, metaY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(txDate, startX + 72, metaY + 11.5);

  // Status Badge
  doc.setFillColor(236, 253, 245); // Emerald-50
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.roundedRect(startX + contentWidth - 48, metaY + 3.5, 40, 9, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87); // Emerald-700
  doc.text('LUNAS & SAH', startX + contentWidth - 39, metaY + 9.5);

  // 4. Main Receipt Content
  let currentY = metaY + 23;

  // Section 1: Telah Diterima Dari
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('TELAH DITERIMA DARI:', startX + 6, currentY);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(startX + 6, currentY + 1.5, startX + contentWidth - 6, currentY + 1.5);

  currentY += 8;

  const renderFieldRow = (label: string, value: string, yPos: number, isMono: boolean = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, startX + 8, yPos);
    doc.text(':', startX + 46, yPos);

    if (isMono) {
      doc.setFont('courier', 'bold');
    } else {
      doc.setFont('helvetica', 'bold');
    }
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(value || '—', startX + 50, yPos);
  };

  renderFieldRow('Nama Anggota / Warga', payment.memberName, currentY);
  currentY += 6.5;
  renderFieldRow('Nomor Pokok Anggota (NPA)', payment.memberNumber || '—', currentY, true);
  currentY += 6.5;
  renderFieldRow('Cluster / Alamat', member?.cluster ? `${member.cluster} • ${member.address || ''}` : (member?.address || '—'), currentY);
  currentY += 6.5;
  renderFieldRow('No. Telepon / WhatsApp', member?.phone || '—', currentY);

  currentY += 10;

  // Section 2: Untuk Pembayaran
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('UNTUK PEMBAYARAN:', startX + 6, currentY);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(startX + 6, currentY + 1.5, startX + contentWidth - 6, currentY + 1.5);

  currentY += 8;
  renderFieldRow('Jenis Pembayaran', payment.paymentType || 'Iuran Paguyuban', currentY);
  currentY += 6.5;
  renderFieldRow('Periode Iuran', payment.periodMonth || '—', currentY);
  currentY += 6.5;
  renderFieldRow('Metode Pembayaran', payment.paymentMethod || 'Transfer / Tunai', currentY);
  currentY += 6.5;
  renderFieldRow('Keterangan', payment.adminNotes || 'Pembayaran Iuran Paguyuban Dana Kematian', currentY);

  currentY += 11;

  // 5. Highlight Amount Box
  const amountBoxY = currentY;
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.setLineWidth(0.5);
  doc.roundedRect(startX + 6, amountBoxY, contentWidth - 12, 28, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text('JUMLAH NOMINAL DITERIMA (TOTAL):', startX + 10, amountBoxY + 7);

  // Big Amount text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(4, 120, 87); // Emerald-700
  doc.text(formatIDR(payment.amount), startX + 10, amountBoxY + 16);

  // Terbilang text
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // Slate-700
  const terbilangText = `Terbilang: "# ${terbilang(payment.amount)} #"`;
  const splitTerbilang = doc.splitTextToSize(terbilangText, contentWidth - 24);
  doc.text(splitTerbilang, startX + 10, amountBoxY + 22);

  currentY = amountBoxY + 34;

  // 6. Bottom Signatures & QR Code Section
  doc.setDrawColor(15, 23, 42); // Slate-900
  doc.setLineWidth(0.6);
  doc.line(startX + 6, currentY, startX + contentWidth - 6, currentY);

  currentY += 6;

  // Left: QR Code Box
  if (qrCodeDataUrl) {
    try {
      doc.addImage(qrCodeDataUrl, 'PNG', startX + 8, currentY, 32, 32);
    } catch (e) {
      console.warn('Could not render QR code in PDF', e);
    }
  }

  // QR Code details text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text('QR CODE NO. ANGGOTA (NPA)', startX + 44, currentY + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`NPA: ${payment.memberNumber || '—'}`, startX + 44, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Kwitansi: ${payment.receiptNumber || '-'}`, startX + 44, currentY + 17);
  doc.text('Status: Otentik & Terverifikasi', startX + 44, currentY + 22);
  doc.text('Scan untuk memvalidasi keaslian dokumen.', startX + 44, currentY + 27);

  // Right: Signature Box
  const sigX = startX + contentWidth - 60;
  const cityName = settings.communityAddress ? settings.communityAddress.split(',')[0] : 'Jakarta';
  const payDateOnly = payment.verifiedAt ? payment.verifiedAt.split(' ')[0] : (payment.createdAt ? payment.createdAt.split(' ')[0] : '-');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`${cityName}, ${payDateOnly}`, sigX, currentY + 4);

  const signerTitle = payment.adminSignerTitle || 'Bendahara / Pengurus Dana';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(signerTitle + ',', sigX, currentY + 9);

  // Digital Signature Image
  const signatureDataUrl = payment.adminSignature || settings.defaultAdminSignature;
  let signatureRendered = false;

  if (signatureDataUrl) {
    try {
      const format = signatureDataUrl.includes('image/jpeg') || signatureDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(signatureDataUrl, format, sigX - 1, currentY + 11, 44, 15);
      signatureRendered = true;
    } catch {
      signatureRendered = false;
    }
  }

  if (!signatureRendered) {
    // Stempel Badge Fallback
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.roundedRect(sigX - 2, currentY + 13, 48, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text('✓ TERVERIFIKASI SAH', sigX + 4, currentY + 18.5);
  } else {
    // Security verification subline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(16, 185, 129);
    doc.text('✓ TTD DIGITAL TERVERIFIKASI SISTEM', sigX, currentY + 27);
  }

  // Treasurer Name (Underlined)
  const treasY = currentY + 31;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const treasName = payment.adminSignerName || settings.treasurerName || 'Bendahara Paguyuban';
  doc.text(treasName, sigX, treasY);
  const textWidth = doc.getTextWidth(treasName);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(sigX, treasY + 1, sigX + textWidth, treasY + 1);

  if (settings?.treasurerPhone) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(settings.treasurerPhone, sigX, treasY + 5);
  }

  // 7. Footer disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(
    'Dokumen ini dicetak otomatis oleh Sistem Informasi Paguyuban Dana Kematian. Berfungsi sebagai bukti pembayaran yang sah.',
    pageWidth / 2,
    startY + 254,
    { align: 'center' }
  );

  return doc;
}
