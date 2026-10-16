import jsPDF from 'jspdf';
import { Payment, Member, SystemSettings } from '../types';
import { formatIDR } from './storage';
import { terbilang } from './terbilang';
import { getEffectivePaymentPeriod } from './receiptUtils';

interface GenerateReceiptPdfParams {
  payment: Payment;
  member?: Member | null;
  settings: SystemSettings;
  qrCodeDataUrl?: string;
}

/**
 * Generates an authentic, crisp vector PDF receipt directly using jsPDF.
 * Clean, prestigious, and official financial document layout with:
 * - White kop background with black text (Kop Surat Resmi Indonesia)
 * - Dynamic official stamp seal matching community name from system settings
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
  const startX = 14;
  const startY = 14;
  const contentWidth = pageWidth - startX * 2; // 182mm

  // 1. Outer Frame Border (Crisp double-line certificate border)
  doc.setDrawColor(15, 23, 42); // Black / Slate-900
  doc.setLineWidth(0.6);
  doc.roundedRect(startX, startY, contentWidth, 266, 3, 3, 'S');

  // Inner decorative border
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.25);
  doc.roundedRect(startX + 2, startY + 2, contentWidth - 4, 262, 2, 2, 'S');

  // 2. KOP SURAT KWITANSI: BACKGROUND PUTIH & TULISAN HITAM
  // Background white fill inside frame
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(startX + 3, startY + 3, contentWidth - 6, 38, 2, 2, 'F');

  let textOffsetX = startX + 8;
  let logoRendered = false;

  // Render Paguyuban Logo in Kop Surat on White Background
  if (settings.logoUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0); // Hitam
      doc.setLineWidth(0.3);
      doc.roundedRect(startX + 7, startY + 7.5, 23, 23, 2.5, 2.5, 'FD');
      
      const format = settings.logoUrl.includes('image/jpeg') || settings.logoUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(settings.logoUrl, format, startX + 8, startY + 8.5, 21, 21);
      textOffsetX = startX + 34;
      logoRendered = true;
    } catch {
      logoRendered = false;
    }
  }

  if (!logoRendered) {
    // Official Logo Badge Fallback on White
    doc.setFillColor(255, 255, 255); // Putih
    doc.setDrawColor(0, 0, 0); // Hitam
    doc.setLineWidth(0.5);
    doc.roundedRect(startX + 7, startY + 7.5, 23, 23, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0); // Hitam
    doc.text('PDK', startX + 18.5, startY + 18, { align: 'center' });
    doc.setFontSize(5);
    doc.setTextColor(0, 0, 0); // Hitam
    doc.text('KAS KEMATIAN', startX + 18.5, startY + 23, { align: 'center' });
    textOffsetX = startX + 34;
  }

  // Header Title - WARNA TULISAN HITAM (Black & Bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(0, 0, 0); // Hitam murni
  const communityTitle = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').toUpperCase();
  doc.text(communityTitle, textOffsetX, startY + 14);

  // Header Subtitle & Address - HITAM MURNI
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(0, 0, 0); // Hitam murni
  const splitAddress = doc.splitTextToSize(
    settings.communityAddress || 'Sekretariat Pengurus Paguyuban Warga',
    contentWidth - 78 - (textOffsetX - startX)
  );
  doc.text(splitAddress, textOffsetX, startY + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0); // Hitam murni
  doc.text('Pengelola Kas Dana Kematian • Transparan, Amanah & Akuntabel', textOffsetX, startY + 31);

  // Badge on the right of Kop Surat (White box with Black border & Black text)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0); // Hitam border
  doc.setLineWidth(0.4);
  doc.roundedRect(startX + contentWidth - 58, startY + 7.5, 51, 23, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text('KWITANSI RESMI DIGITAL', startX + contentWidth - 54, startY + 14);
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text('BUKTI PEMBAYARAN IURAN', startX + contentWidth - 54, startY + 20);
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text('TERVERIFIKASI SAH SISTEM', startX + contentWidth - 54, startY + 25.5);

  // Garis Kop Surat Resmi Indonesia (Garis ganda tebal & tipis warna hitam)
  const kopBottomY = startY + 37;
  doc.setDrawColor(0, 0, 0); // Hitam
  doc.setLineWidth(0.8);
  doc.line(startX + 4, kopBottomY, startX + contentWidth - 4, kopBottomY);

  doc.setLineWidth(0.25);
  doc.line(startX + 4, kopBottomY + 1.2, startX + contentWidth - 4, kopBottomY + 1.2);

  // 3. Receipt Metadata Bar
  const metaY = kopBottomY + 6;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(startX + 6, metaY, contentWidth - 12, 16, 2, 2, 'FD');

  // No. Kwitansi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('NO. KWITANSI:', startX + 10, metaY + 6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text(payment.receiptNumber || 'KW-OFFICIAL', startX + 10, metaY + 11.5);

  // Tanggal Transaksi
  const txDate = payment.verifiedAt || payment.createdAt || '-';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TANGGAL & WAKTU VERIFIKASI:', startX + 70, metaY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text(txDate, startX + 70, metaY + 11.5);

  // Status Badge
  const isVerified = payment.status === 'Verified';
  if (isVerified) {
    doc.setFillColor(236, 253, 245); // Emerald-50
    doc.setDrawColor(16, 185, 129); // Emerald-500
    doc.roundedRect(startX + contentWidth - 48, metaY + 3.5, 40, 9, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87); // Emerald-700
    doc.text('✓ LUNAS & SAH', startX + contentWidth - 40, metaY + 9.5);
  } else {
    doc.setFillColor(254, 243, 199); // Amber-50
    doc.setDrawColor(245, 158, 11); // Amber-500
    doc.roundedRect(startX + contentWidth - 52, metaY + 3.5, 44, 9, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text('⏳ MENUNGGU VALIDASI', startX + contentWidth - 50, metaY + 9.5);
  }

  // 4. Main Receipt Content
  let currentY = metaY + 23;

  const renderFieldRow = (label: string, value: string, yPos: number, isMono: boolean = false): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, startX + 8, yPos);
    doc.text(':', startX + 50, yPos);

    if (isMono) {
      doc.setFont('courier', 'bold');
    } else {
      doc.setFont('helvetica', 'bold');
    }
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0); // Hitam

    const maxTextWidth = contentWidth - 62;
    const lines = doc.splitTextToSize(value || '—', maxTextWidth);
    doc.text(lines, startX + 54, yPos);
    const extraHeight = Math.max(0, (lines.length - 1) * 4.5);
    return extraHeight;
  };

  // Section 1: Telah Diterima Dari
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text('1. DATA PEMBAYAR / WARGA ANGGOTA:', startX + 6, currentY);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(startX + 6, currentY + 1.5, startX + contentWidth - 6, currentY + 1.5);

  currentY += 7.5;
  currentY += renderFieldRow('Nama Anggota / Warga', payment.memberName, currentY) + 6;
  currentY += renderFieldRow('Nomor Pokok Anggota (NPA)', payment.memberNumber || '—', currentY, true) + 6;
  currentY += renderFieldRow('Cluster / Alamat', member?.cluster ? `${member.cluster} • ${member.address || 'Alamat Terdaftar'}` : (member?.address || '—'), currentY) + 6;
  currentY += renderFieldRow('No. Telepon / WhatsApp', member?.phone || '—', currentY) + 8;

  // Section 2: Untuk Pembayaran
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text('2. RINCIAN TRANSAKSI PEMBAYARAN:', startX + 6, currentY);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(startX + 6, currentY + 1.5, startX + contentWidth - 6, currentY + 1.5);

  currentY += 7.5;
  const effectivePeriod = getEffectivePaymentPeriod(payment, settings);
  currentY += renderFieldRow('Jenis Pembayaran', payment.paymentType || 'Iuran Kas Paguyuban', currentY) + 6;
  currentY += renderFieldRow('Periode Pembayaran', effectivePeriod, currentY) + 6;
  currentY += renderFieldRow('Metode Pembayaran', payment.paymentMethod || 'Transfer / Tunai', currentY) + 6;
  currentY += renderFieldRow('Keterangan / Berita', payment.adminNotes || `Pembayaran Iuran Kas ${settings.communityName || 'Paguyuban'}`, currentY) + 9;

  // 5. Highlight Amount Box (Clean, prominent emerald styling)
  const amountBoxY = currentY;
  doc.setFillColor(240, 253, 244); // Emerald-50 / Mint
  doc.setDrawColor(110, 231, 183); // Emerald-300
  doc.setLineWidth(0.5);
  doc.roundedRect(startX + 6, amountBoxY, contentWidth - 12, 28, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87); // Emerald-700
  doc.text('JUMLAH PEMBAYARAN DITERIMA (TOTAL LUNAS):', startX + 10, amountBoxY + 7);

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
  doc.setDrawColor(0, 0, 0); // Hitam
  doc.setLineWidth(0.5);
  doc.line(startX + 6, currentY, startX + contentWidth - 6, currentY);

  currentY += 6;

  // Left: QR Code Box
  if (qrCodeDataUrl) {
    try {
      doc.addImage(qrCodeDataUrl, 'PNG', startX + 8, currentY, 32, 32);
    } catch (e) {
      console.warn('Could not render QR code in PDF', e);
    }
  } else {
    // Placeholder QR Box if canvas is not yet ready
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(startX + 8, currentY, 32, 32, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('[ QR CODE ]', startX + 24, currentY + 14, { align: 'center' });
    doc.setFontSize(5);
    doc.text('VERIFIKASI SAH', startX + 24, currentY + 19, { align: 'center' });
  }

  // QR Code details text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text('QR OTENTIKASI KEANGGOTAAN', startX + 44, currentY + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text(`NPA: ${payment.memberNumber || '—'}`, startX + 44, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`No. Kwitansi : ${payment.receiptNumber || '-'}`, startX + 44, currentY + 17);
  doc.text('Status      : Terverifikasi Sah di Database', startX + 44, currentY + 22);
  doc.text('Pindai QR untuk memeriksa keaslian arsip.', startX + 44, currentY + 27);

  // Center: STEMPEL SAH RESMI (NAMA PAGUYUBAN DINAMIS SESUAI PENGATURAN SYSTEM)
  const sealCenterX = startX + 104;
  const sealCenterY = currentY + 16;
  const sealRadius = 14;

  doc.setDrawColor(5, 150, 105); // Emerald-600 ink
  doc.setLineWidth(0.7);
  doc.circle(sealCenterX, sealCenterY, sealRadius, 'S');
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.setLineWidth(0.25);
  doc.circle(sealCenterX, sealCenterY, sealRadius - 1.2, 'S');

  // Inner divider lines
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.3);
  doc.line(sealCenterX - 10.5, sealCenterY - 3, sealCenterX + 10.5, sealCenterY - 3);
  doc.line(sealCenterX - 10.5, sealCenterY + 7, sealCenterX + 10.5, sealCenterY + 7);

  // Nama Paguyuban dari pengaturan system (settings.communityName)
  const communityNameStamp = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').trim().toUpperCase();
  const stampTitle = `★ ${communityNameStamp} ★`;

  // Hitung ukuran font adaptif agar selalu proporsional di dalam stempel
  let titleFontSize = 5.2;
  if (stampTitle.length > 34) {
    titleFontSize = 3.6;
  } else if (stampTitle.length > 25) {
    titleFontSize = 4.2;
  } else if (stampTitle.length > 18) {
    titleFontSize = 4.8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(5, 150, 105);

  if (communityNameStamp.length > 28) {
    const splitTitle = doc.splitTextToSize(communityNameStamp, 22);
    doc.text(splitTitle[0] || communityNameStamp, sealCenterX, sealCenterY - 7.5, { align: 'center' });
    if (splitTitle[1]) {
      doc.text(splitTitle[1], sealCenterX, sealCenterY - 4.5, { align: 'center' });
    }
  } else {
    doc.text(stampTitle, sealCenterX, sealCenterY - 5.5, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87);
  doc.text('LUNAS & SAH', sealCenterX, sealCenterY + 1.2, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text('KAS DANA KEMATIAN', sealCenterX, sealCenterY + 5.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.2);
  doc.setTextColor(100, 116, 139);
  doc.text('TERVERIFIKASI RESMI', sealCenterX, sealCenterY + 10.2, { align: 'center' });

  // Right: Signature Box
  const sigX = startX + contentWidth - 58;
  const cityName = settings.communityAddress ? settings.communityAddress.split(',')[0].replace(/jl\.|jalan|rt|rw/gi, '').trim() || 'Jakarta' : 'Jakarta';
  const payDateOnly = payment.verifiedAt ? payment.verifiedAt.split(' ')[0] : (payment.createdAt ? payment.createdAt.split(' ')[0] : '-');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`${cityName}, ${payDateOnly}`, sigX, currentY + 4);

  const signerTitle = payment.adminSignerTitle || 'Bendahara Paguyuban';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0); // Hitam
  doc.text(signerTitle + ',', sigX, currentY + 9);

  // Digital Signature Image
  const signatureDataUrl = payment.adminSignature || settings.defaultAdminSignature;
  let signatureRendered = false;

  if (signatureDataUrl) {
    try {
      const format = signatureDataUrl.includes('image/jpeg') || signatureDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(signatureDataUrl, format, sigX - 1, currentY + 11, 44, 14);
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
    doc.roundedRect(sigX - 2, currentY + 13, 46, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text('✓ TERVERIFIKASI SAH', sigX + 4, currentY + 18.5);
  } else {
    // Security verification subline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(16, 185, 129);
    doc.text('✓ TTD DIGITAL TERVERIFIKASI SISTEM', sigX, currentY + 26.5);
  }

  // Treasurer Name (Underlined)
  const treasY = currentY + 31;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0); // Hitam
  const treasName = payment.adminSignerName || settings.treasurerName || 'Bendahara Paguyuban';
  doc.text(treasName, sigX, treasY);
  const textWidth = doc.getTextWidth(treasName);
  doc.setDrawColor(0, 0, 0); // Hitam
  doc.setLineWidth(0.3);
  doc.line(sigX, treasY + 1, sigX + textWidth, treasY + 1);

  if (settings?.treasurerPhone) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(settings.treasurerPhone, sigX, treasY + 5);
  }

  // 7. Footer disclaimer & hash
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(
    `Dokumen ini dicetak otomatis secara elektronik oleh Sistem Informasi ${settings.communityName || 'Paguyuban'}. Berfungsi sebagai bukti pembayaran yang sah.`,
    pageWidth / 2,
    startY + 258,
    { align: 'center' }
  );

  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(160, 174, 192);
  const printTimestamp = new Date().toLocaleString('id-ID');
  doc.text(
    `Keaslian Dokumen: #${(payment.receiptNumber || 'KW').toUpperCase()}-${(payment.memberNumber || 'NPA').toUpperCase()} • Dicetak: ${printTimestamp}`,
    pageWidth / 2,
    startY + 262,
    { align: 'center' }
  );

  return doc;
}
