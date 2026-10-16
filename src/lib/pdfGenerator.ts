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
 * - Guaranteed strict margins preventing text overlap or boundary overflow
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
  const startX = 12;
  const startY = 12;
  const contentWidth = pageWidth - startX * 2; // 186mm
  const contentHeight = 258; // Ends at 270mm, strictly safe on all A4 printers

  // 1. Outer Frame Border (Crisp double-line certificate border)
  doc.setDrawColor(15, 23, 42); // Black / Slate-900
  doc.setLineWidth(0.6);
  doc.roundedRect(startX, startY, contentWidth, contentHeight, 3, 3, 'S');

  // Inner decorative border
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.25);
  doc.roundedRect(startX + 1.5, startY + 1.5, contentWidth - 3, contentHeight - 3, 2, 2, 'S');

  // 2. KOP SURAT KWITANSI: BACKGROUND PUTIH & TULISAN HITAM
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(startX + 2, startY + 2, contentWidth - 4, 34, 2, 2, 'F');

  // Right Badge: "KWITANSI RESMI DIGITAL"
  const badgeWidth = 48;
  const badgeHeight = 20;
  const badgeX = startX + contentWidth - badgeWidth - 4; // ~146mm
  const badgeY = startY + 4.5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0); // Hitam border
  doc.setLineWidth(0.4);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('KWITANSI RESMI DIGITAL', badgeX + badgeWidth / 2, badgeY + 5.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('BUKTI PEMBAYARAN IURAN', badgeX + badgeWidth / 2, badgeY + 11, { align: 'center' });
  doc.setFontSize(5.8);
  doc.setTextColor(50, 50, 50);
  doc.text('TERVERIFIKASI SAH SISTEM', badgeX + badgeWidth / 2, badgeY + 16, { align: 'center' });

  // Left Logo
  let textOffsetX = startX + 6;
  const logoBoxW = 20;
  const logoBoxH = 20;
  const logoY = startY + 4.5;

  let logoRendered = false;
  if (settings.logoUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.roundedRect(startX + 5, logoY, logoBoxW, logoBoxH, 2, 2, 'FD');
      const format = settings.logoUrl.includes('image/jpeg') || settings.logoUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(settings.logoUrl, format, startX + 6, logoY + 1, logoBoxW - 2, logoBoxH - 2);
      textOffsetX = startX + 5 + logoBoxW + 4; // ~41mm
      logoRendered = true;
    } catch {
      logoRendered = false;
    }
  }

  if (!logoRendered) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.roundedRect(startX + 5, logoY, logoBoxW, logoBoxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('PDK', startX + 5 + logoBoxW / 2, logoY + 10, { align: 'center' });
    doc.setFontSize(4.5);
    doc.text('KAS KEMATIAN', startX + 5 + logoBoxW / 2, logoY + 15, { align: 'center' });
    textOffsetX = startX + 5 + logoBoxW + 4;
  }

  // Header Title & Address (Bounded to avoid colliding with right badge!)
  const maxKopTextWidth = badgeX - textOffsetX - 4;
  const communityTitle = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').trim().toUpperCase();

  // Dynamic font sizing for community title to avoid overflow
  let titleFontSize = 11;
  if (communityTitle.length > 40) {
    titleFontSize = 9;
  } else if (communityTitle.length > 26) {
    titleFontSize = 10;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(0, 0, 0);
  const splitTitle = doc.splitTextToSize(communityTitle, maxKopTextWidth);
  let curKopY = startY + 8;
  doc.text(splitTitle, textOffsetX, curKopY);
  curKopY += (splitTitle.length * (titleFontSize * 0.38)) + 1.8;

  // Address (bounded)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  const splitAddress = doc.splitTextToSize(settings.communityAddress || 'Sekretariat Pengurus Paguyuban Warga', maxKopTextWidth);
  const safeAddress = splitAddress.slice(0, 2);
  doc.text(safeAddress, textOffsetX, curKopY);
  curKopY += (safeAddress.length * 3.2) + 1.8;

  // Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Pengelola Kas Dana Kematian • Transparan, Amanah & Akuntabel', textOffsetX, curKopY);
  curKopY += 3.5;

  // Garis Kop Surat Resmi (Hitam ganda)
  const kopBottomY = Math.max(curKopY, startY + 32);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.7);
  doc.line(startX + 3, kopBottomY, startX + contentWidth - 3, kopBottomY);
  doc.setLineWidth(0.2);
  doc.line(startX + 3, kopBottomY + 1.2, startX + contentWidth - 3, kopBottomY + 1.2);

  // 3. Receipt Metadata Bar
  const metaY = kopBottomY + 3.5;
  const metaHeight = 12.5;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(startX + 4, metaY, contentWidth - 8, metaHeight, 1.5, 1.5, 'FD');

  // No. Kwitansi
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('NO. KWITANSI:', startX + 8, metaY + 4.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(payment.receiptNumber || 'KW-OFFICIAL', startX + 8, metaY + 9);

  // Tanggal Transaksi
  const txDate = payment.verifiedAt || payment.createdAt || '-';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TANGGAL VERIFIKASI:', startX + 68, metaY + 4.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(txDate, startX + 68, metaY + 9);

  // Status Badge
  const isVerified = payment.status === 'Verified';
  const statusBadgeW = 38;
  const statusBadgeH = 7.5;
  const statusBadgeX = startX + contentWidth - statusBadgeW - 8;
  const statusBadgeY = metaY + 2.5;

  if (isVerified) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(statusBadgeX, statusBadgeY, statusBadgeW, statusBadgeH, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87);
    doc.text('✓ LUNAS & SAH', statusBadgeX + statusBadgeW / 2, statusBadgeY + 5, { align: 'center' });
  } else {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(statusBadgeX, statusBadgeY, statusBadgeW, statusBadgeH, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9);
    doc.text('⏳ MENUNGGU VALIDASI', statusBadgeX + statusBadgeW / 2, statusBadgeY + 5, { align: 'center' });
  }

  // 4. Main Receipt Content (Data Pembayar & Transaksi)
  let currentY = metaY + metaHeight + 4;

  const colLabelX = startX + 6;
  const colColonX = startX + 48;
  const colValueX = startX + 52;
  const maxValueWidth = (startX + contentWidth - 8) - colValueX; // ~126mm

  const renderFieldRow = (label: string, value: string, yPos: number, isMono: boolean = false): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(80, 80, 80);
    doc.text(label, colLabelX, yPos);
    doc.text(':', colColonX, yPos);

    if (isMono) {
      doc.setFont('courier', 'bold');
    } else {
      doc.setFont('helvetica', 'bold');
    }
    doc.setFontSize(7.8);
    doc.setTextColor(0, 0, 0);

    const lines = doc.splitTextToSize(value || '—', maxValueWidth);
    doc.text(lines, colValueX, yPos);
    return lines.length > 1 ? (lines.length - 1) * 3.8 : 0;
  };

  // Section 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(0, 0, 0);
  doc.text('1. DATA PEMBAYAR / WARGA ANGGOTA:', startX + 6, currentY);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(startX + 6, currentY + 1.2, startX + contentWidth - 6, currentY + 1.2);

  currentY += 5;
  currentY += renderFieldRow('Nama Anggota / Warga', payment.memberName, currentY) + 4.8;
  currentY += renderFieldRow('Nomor Pokok Anggota (NPA)', payment.memberNumber || '—', currentY, true) + 4.8;
  const memberAddr = member?.cluster ? `${member.cluster} • ${member.address || 'Alamat Terdaftar'}` : (member?.address || '—');
  currentY += renderFieldRow('Cluster / Alamat', memberAddr, currentY) + 4.8;
  currentY += renderFieldRow('No. Telepon / WhatsApp', member?.phone || '—', currentY) + 6;

  // Section 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(0, 0, 0);
  doc.text('2. RINCIAN TRANSAKSI PEMBAYARAN:', startX + 6, currentY);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(startX + 6, currentY + 1.2, startX + contentWidth - 6, currentY + 1.2);

  currentY += 5;
  const effectivePeriod = getEffectivePaymentPeriod(payment, settings);
  currentY += renderFieldRow('Jenis Pembayaran', payment.paymentType || 'Iuran Kas Paguyuban', currentY) + 4.8;
  currentY += renderFieldRow('Periode Pembayaran', effectivePeriod, currentY) + 4.8;
  currentY += renderFieldRow('Metode Pembayaran', payment.paymentMethod || 'Transfer / Tunai', currentY) + 4.8;
  const adminNotesText = payment.adminNotes || `Pembayaran Iuran Kas ${settings.communityName || 'Paguyuban'}`;
  currentY += renderFieldRow('Keterangan / Berita', adminNotesText, currentY) + 6;

  // 5. Highlight Amount Box (Strictly bounded so terbilang never overflows box border)
  const terbilangText = `Terbilang: "# ${terbilang(payment.amount)} #"`;
  const splitTerbilang = doc.splitTextToSize(terbilangText, contentWidth - 18);
  const amountBoxH = splitTerbilang.length > 1 ? 24 : 20;

  doc.setFillColor(240, 253, 244); // Emerald-50 / Mint
  doc.setDrawColor(110, 231, 183); // Emerald-300
  doc.setLineWidth(0.5);
  doc.roundedRect(startX + 4, currentY, contentWidth - 8, amountBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(4, 120, 87);
  doc.text('JUMLAH PEMBAYARAN DITERIMA (TOTAL LUNAS):', startX + 8, currentY + 5.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(4, 120, 87);
  doc.text(formatIDR(payment.amount), startX + 8, currentY + 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(splitTerbilang.slice(0, 2), startX + 8, currentY + 16.5);

  currentY += amountBoxH + 4;

  // Divider before signatures
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(startX + 4, currentY, startX + contentWidth - 4, currentY);

  currentY += 3.5;

  // 6. BOTTOM THREE STRICT ISOLATED ZONES (QR Code, Stempel Sah, and TTD)
  // ZONE 1: Left QR Code Box (strictly ends before 80mm)
  const qrX = startX + 6;
  const qrSize = 23;
  if (qrCodeDataUrl) {
    try {
      doc.addImage(qrCodeDataUrl, 'PNG', qrX, currentY + 1, qrSize, qrSize);
    } catch {
      // Fallback
    }
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(qrX, currentY + 1, qrSize, qrSize, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('QR VALIDASI', qrX + qrSize / 2, currentY + 13, { align: 'center' });
  }

  // QR Text info beside QR image (strictly bounded to 30mm width so it NEVER touches Stempel)
  const qrTextX = qrX + qrSize + 3;
  const qrMaxTextW = 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(4, 120, 87);
  doc.text('QR OTENTIKASI RESMI', qrTextX, currentY + 4.8);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0);
  const npaText = doc.splitTextToSize(`NPA: ${payment.memberNumber || '—'}`, qrMaxTextW);
  doc.text(npaText[0] || '', qrTextX, currentY + 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(70, 70, 70);
  const kwText = doc.splitTextToSize(`No: ${payment.receiptNumber || '-'}`, qrMaxTextW);
  doc.text(kwText[0] || '', qrTextX, currentY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(4, 120, 87);
  doc.text('✓ Lunas Terverifikasi', qrTextX, currentY + 18.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(120, 120, 120);
  doc.text('Pindai untuk cek arsip', qrTextX, currentY + 22.8);

  // ZONE 2: Center Stempel Sah (Center at startX + 94 = 106mm, radius 13.5mm, strictly bounded chords)
  const sealCenterX = startX + 94;
  const sealCenterY = currentY + 13.5;
  const sealRadius = 13.5;

  doc.setDrawColor(5, 150, 105); // Emerald-600 ink
  doc.setLineWidth(0.6);
  doc.circle(sealCenterX, sealCenterY, sealRadius, 'S');
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.setLineWidth(0.2);
  doc.circle(sealCenterX, sealCenterY, sealRadius - 1.2, 'S');

  // Community name on top of seal (auto-scaled and wrapped inside circle chord, max width 19mm)
  const communityNameStamp = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').trim().toUpperCase();
  let sealTitleFont = 4.2;
  if (communityNameStamp.length > 36) {
    sealTitleFont = 3.2;
  } else if (communityNameStamp.length > 24) {
    sealTitleFont = 3.7;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(sealTitleFont);
  doc.setTextColor(5, 150, 105);

  const sealSplitTitle = doc.splitTextToSize(communityNameStamp, 19);
  if (sealSplitTitle.length > 1) {
    doc.text(sealSplitTitle[0], sealCenterX, sealCenterY - 7.8, { align: 'center' });
    doc.text(sealSplitTitle[1], sealCenterX, sealCenterY - 4.8, { align: 'center' });
  } else {
    doc.text(`★ ${sealSplitTitle[0]} ★`, sealCenterX, sealCenterY - 6.2, { align: 'center' });
  }

  // Inner horizontal divider lines in seal (strictly safe inside chord, length 17mm)
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.25);
  doc.line(sealCenterX - 8.5, sealCenterY - 2.8, sealCenterX + 8.5, sealCenterY - 2.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(4, 120, 87);
  doc.text('LUNAS & SAH', sealCenterX, sealCenterY + 1.2, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.3);
  doc.setTextColor(15, 23, 42);
  doc.text('KAS DANA KEMATIAN', sealCenterX, sealCenterY + 4.8, { align: 'center' });

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.25);
  doc.line(sealCenterX - 8.5, sealCenterY + 6.8, sealCenterX + 8.5, sealCenterY + 6.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(5, 150, 105);
  doc.text('★ TERVERIFIKASI RESMI ★', sealCenterX, sealCenterY + 10.2, { align: 'center' });

  // ZONE 3: Right Signature Box (Strictly bounded so NO TEXT or UNDERLINE crosses right border!)
  const sigX = startX + 130;
  const maxSigWidth = (startX + contentWidth - 6) - sigX; // Exactly 50mm safe width!
  const cityName = settings.communityAddress ? settings.communityAddress.split(',')[0].replace(/jl\.|jalan|rt|rw/gi, '').trim() || 'Jakarta' : 'Jakarta';
  const payDateOnly = payment.verifiedAt ? payment.verifiedAt.split(' ')[0] : (payment.createdAt ? payment.createdAt.split(' ')[0] : '-');

  let sigCurY = currentY + 3.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const dateStr = `${cityName}, ${payDateOnly}`;
  const splitDate = doc.splitTextToSize(dateStr, maxSigWidth);
  doc.text(splitDate[0] || dateStr, sigX, sigCurY);
  sigCurY += 4.2;

  const signerTitle = payment.adminSignerTitle || 'Bendahara Paguyuban';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const splitSignerTitle = doc.splitTextToSize(signerTitle + ',', maxSigWidth);
  doc.text(splitSignerTitle[0] || signerTitle, sigX, sigCurY);
  sigCurY += 2.2;

  // Digital Signature Image
  const signatureDataUrl = payment.adminSignature || settings.defaultAdminSignature;
  let signatureRendered = false;
  if (signatureDataUrl) {
    try {
      const format = signatureDataUrl.includes('image/jpeg') || signatureDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(signatureDataUrl, format, sigX, sigCurY, Math.min(34, maxSigWidth), 11);
      signatureRendered = true;
      sigCurY += 12.5;
    } catch {
      signatureRendered = false;
    }
  }

  if (!signatureRendered) {
    const badgeW = Math.min(38, maxSigWidth);
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.3);
    doc.roundedRect(sigX, sigCurY + 1, badgeW, 6.5, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(4, 120, 87);
    doc.text('✓ TERVERIFIKASI SAH', sigX + badgeW / 2, sigCurY + 5.2, { align: 'center' });
    sigCurY += 9.5;
  }

  // Treasurer Name Underlined (Strictly bounded so underline line never touches or crosses right border!)
  doc.setFont('helvetica', 'bold');
  const treasName = payment.adminSignerName || settings.treasurerName || 'Bendahara Paguyuban';
  let nameFontSize = 8;
  let splitName = doc.splitTextToSize(treasName, maxSigWidth);
  if (splitName.length > 1) {
    nameFontSize = 7.2;
    doc.setFontSize(nameFontSize);
    splitName = doc.splitTextToSize(treasName, maxSigWidth);
  } else {
    doc.setFontSize(nameFontSize);
  }
  doc.setTextColor(0, 0, 0);
  const displayName = splitName[0] || treasName;
  doc.text(displayName, sigX, sigCurY);

  const actualLineWidth = Math.min(doc.getTextWidth(displayName), maxSigWidth);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(sigX, sigCurY + 0.8, sigX + actualLineWidth, sigCurY + 0.8);
  sigCurY += 4.2;

  if (settings?.treasurerPhone) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const splitPhone = doc.splitTextToSize(settings.treasurerPhone, maxSigWidth);
    doc.text(splitPhone[0] || settings.treasurerPhone, sigX, sigCurY);
  }

  // 7. Footer disclaimer at bottom of certificate frame (strictly wrapped to contentWidth - 16 so it NEVER exceeds borders!)
  const footerY = startY + contentHeight - 11;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 100, 100);

  const disclaimer = `Dokumen ini diterbitkan otomatis secara elektronik oleh Sistem Informasi ${settings.communityName || 'Paguyuban'} dan berlaku sebagai bukti pembayaran yang sah.`;
  const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth - 16);
  doc.text(splitDisclaimer, pageWidth / 2, footerY, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(140, 140, 140);
  const printTimestamp = new Date().toLocaleString('id-ID');
  const auditLine = `Keaslian Dokumen: #${(payment.receiptNumber || 'KW').toUpperCase()}-${(payment.memberNumber || 'NPA').toUpperCase()} • Dicetak: ${printTimestamp}`;
  const splitAudit = doc.splitTextToSize(auditLine, contentWidth - 16);
  doc.text(splitAudit, pageWidth / 2, footerY + (splitDisclaimer.length * 3) + 0.8, { align: 'center' });

  return doc;
}
