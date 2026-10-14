import jsPDF from 'jspdf';
import { Member, Payment, SystemSettings } from '../types';
import { getMemberCertificateInfo } from './certificateUtils';
import { calculateMemberExpiry } from './expiryUtils';

export interface GenerateCertificatePdfOptions {
  member: Member;
  payments?: Payment[];
  settings?: SystemSettings;
  theme?: 'emerald' | 'gold' | 'navy' | 'monochrome';
  showDependents?: boolean;
  showSignatures?: boolean;
  qrDataUrl?: string;
}

export function generateCertificatePdf(options: GenerateCertificatePdfOptions): jsPDF {
  const {
    member,
    payments = [],
    settings,
    theme = 'emerald',
    showDependents = true,
    showSignatures = true,
    qrDataUrl,
  } = options;

  const certInfo = getMemberCertificateInfo(member, payments, settings);
  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const communityName = settings?.communityName || 'PAGUYUBAN DANA KEMATIAN WARGA';
  const communityAddress = settings?.communityAddress || 'Sekretariat Rukun Tetangga & Paguyuban Warga Rukun Sejahtera';
  const hotline = settings?.treasurerPhone || '0812-3456-7890';

  // Create A4 Landscape document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const width = 297;
  const height = 210;

  // Theme color definitions in RGB
  let primaryColor: [number, number, number] = [6, 78, 59]; // Emerald 900
  let accentColor: [number, number, number] = [217, 119, 6]; // Amber 600
  let borderOuterColor: [number, number, number] = [6, 95, 70]; // Emerald 800
  let borderInnerColor: [number, number, number] = [245, 158, 11]; // Amber 500
  let bgRgb: [number, number, number] = [253, 252, 248]; // Warm parchment

  if (theme === 'gold') {
    primaryColor = [146, 64, 14]; // Amber 800
    accentColor = [217, 119, 6];
    borderOuterColor = [180, 83, 9];
    borderInnerColor = [251, 191, 36];
    bgRgb = [255, 251, 235];
  } else if (theme === 'navy') {
    primaryColor = [15, 23, 42]; // Slate 900
    accentColor = [37, 99, 235]; // Blue 600
    borderOuterColor = [30, 41, 59];
    borderInnerColor = [96, 165, 250];
    bgRgb = [248, 250, 252];
  } else if (theme === 'monochrome') {
    primaryColor = [30, 41, 59];
    accentColor = [71, 85, 105];
    borderOuterColor = [51, 65, 85];
    borderInnerColor = [148, 163, 184];
    bgRgb = [255, 255, 255];
  }

  // 1. Background Fill
  doc.setFillColor(...bgRgb);
  doc.rect(0, 0, width, height, 'F');

  // 2. Guilloche / Certificate Double Border
  // Outer Border
  doc.setDrawColor(...borderOuterColor);
  doc.setLineWidth(1.8);
  doc.rect(10, 10, width - 20, height - 20, 'S');

  // Inner Border
  doc.setDrawColor(...borderInnerColor);
  doc.setLineWidth(0.6);
  doc.rect(13, 13, width - 26, height - 26, 'S');

  // Thin Accent Border
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(14.5, 14.5, width - 29, height - 29, 'S');

  // Corner Ornaments
  const cornerSize = 7;
  const drawCornerFlourish = (cx: number, cy: number, dx: number, dy: number) => {
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(1.0);
    doc.line(cx, cy, cx + dx * cornerSize, cy);
    doc.line(cx, cy, cx, cy + dy * cornerSize);
    doc.setFillColor(...accentColor);
    doc.circle(cx + dx * 2, cy + dy * 2, 0.8, 'F');
  };

  drawCornerFlourish(16, 16, 1, 1);
  drawCornerFlourish(width - 16, 16, -1, 1);
  drawCornerFlourish(16, height - 16, 1, -1);
  drawCornerFlourish(width - 16, height - 16, -1, -1);

  // Watermark for draft if not issued
  if (!certInfo.isIssued) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(239, 68, 68); // Red
    doc.text('DRAFT - MENUNGGU PENGESAHAN KETUA PAGUYUBAN', width / 2, height / 2 + 10, {
      align: 'center',
      angle: 25,
    });
  }

  // 3. Header Section (Kop Lembaga)
  let currentY = 23;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text(communityName.toUpperCase(), width / 2, currentY, { align: 'center' });

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${communityAddress}  •  Kontak Layanan: ${hotline}`, width / 2, currentY, { align: 'center' });

  currentY += 4;
  // Center Ornamental Gold Divider Line
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.6);
  doc.line(width / 2 - 40, currentY, width / 2 + 40, currentY);
  doc.setFillColor(...accentColor);
  doc.circle(width / 2, currentY, 1.2, 'F');

  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentColor);
  doc.text('PIAGAM PENETAPAN & PERLINDUNGAN WARGA', width / 2, currentY, { align: 'center' });

  currentY += 7;
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text('SERTIFIKAT KEANGGOTAAN RESMI', width / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nomor Registrasi: ${certInfo.certificateNumber}`, width / 2, currentY, { align: 'center' });

  // 4. Member Declaration Body
  currentY += 8;
  doc.setFont('times', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Dengan ini Pengurus Paguyuban menerangkan dan menetapkan secara sah bahwa:', width / 2, currentY, { align: 'center' });

  // Member Name (Callout)
  currentY += 9;
  doc.setFont('times', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(15, 23, 42);
  doc.text(member.name.toUpperCase(), width / 2, currentY, { align: 'center' });

  // Underline for name
  const nameWidth = doc.getTextWidth(member.name.toUpperCase());
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.6);
  doc.line(width / 2 - nameWidth / 2 - 5, currentY + 1.8, width / 2 + nameWidth / 2 + 5, currentY + 1.8);

  // Metadata Badges (NPA, NIK, Cluster, Status)
  currentY += 7.5;
  const badges = [
    `NPA: ${member.memberNumber}`,
    `NIK: ${member.nik}`,
    `Cluster: ${member.cluster || '-'}`,
    `Status: ${certInfo.isIssued ? 'Anggota Tetap Sah' : 'Proses Verifikasi'}`,
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const badgeText = badges.join('     •     ');
  doc.setTextColor(...primaryColor);
  doc.text(badgeText, width / 2, currentY, { align: 'center' });

  // Attestation Statement Paragraph
  currentY += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const attestationText = `Telah memenuhi seluruh rangkaian proses verifikasi kependudukan RT, pelunasan iuran gotong royong melalui Bendahara, serta memperoleh pengesahan resmi dari Ketua Paguyuban. Anggota beserta seluruh keluarga tanggungan memiliki hak atas santunan duka cita, fardhu kifayah jenazah, dan layanan ambulans 24 jam.`;
  const splitAttestation = doc.splitTextToSize(attestationText, 210);
  doc.text(splitAttestation, width / 2, currentY, { align: 'center' });

  currentY += splitAttestation.length * 4.2;

  // Dependents List Table (If enabled & has dependents)
  if (showDependents && member.dependentsList && member.dependentsList.length > 0) {
    const depBoxWidth = 200;
    const depBoxX = (width - depBoxWidth) / 2;
    const depBoxY = currentY + 1;
    const depBoxHeight = 11;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(depBoxX, depBoxY, depBoxWidth, depBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryColor);
    doc.text(`Tanggungan Terlindungi (${(member.dependentsCount || 0) + 1} Jiwa):`, depBoxX + 4, depBoxY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    const depNames = member.dependentsList
      .slice(0, 4)
      .map((d) => `${d.name} (${d.relationship})`)
      .join(', ');
    const moreCount = member.dependentsList.length > 4 ? ` +${member.dependentsList.length - 4} lainnya` : '';
    doc.text(`${depNames}${moreCount}`, depBoxX + 4, depBoxY + 8);

    currentY += depBoxHeight + 2;
  } else {
    currentY += 4;
  }

  // 5. Tripartite Signatures & Seal Section
  if (showSignatures) {
    const sigY = 160;

    // Divider Line above signatures
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(25, sigY - 4, width - 25, sigY - 4);

    // Left: Ketua RT
    const leftColX = 55;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('VERIFIKATOR DOMISILI', leftColX, sigY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(certInfo.verifiedByRt, leftColX, sigY + 5, { align: 'center' });

    // Checkmark Stamp Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(leftColX - 20, sigY + 8, 40, 6, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52);
    doc.text('✓ Terverifikasi RT', leftColX, sigY + 12.2, { align: 'center' });

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(leftColX - 25, sigY + 22, leftColX + 25, sigY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Ketua RT ${member.cluster || ''}`, leftColX, sigY + 25.5, { align: 'center' });

    // Center: Official QR Code & Seal
    const centerColX = width / 2;
    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, 'PNG', centerColX - 11, sigY - 2, 22, 22);
      } catch (e) {
        console.warn('Could not insert QR image into PDF:', e);
      }
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('SCAN VALIDASI KEASLIAN', centerColX, sigY + 22.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Ditetapkan: ${certInfo.issueDate}`, centerColX, sigY + 25.5, { align: 'center' });

    // Right: Ketua Paguyuban (Primary Authority)
    const rightColX = width - 55;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PENGESAHAN AKHIR', rightColX, sigY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(certInfo.approvedByPaguyuban, rightColX, sigY + 5, { align: 'center' });

    // Certified badge
    if (certInfo.isIssued) {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(0.3);
      doc.roundedRect(rightColX - 22, sigY + 8, 44, 6, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('★ Disahkan & Sah Penuh ★', rightColX, sigY + 12.2, { align: 'center' });
    } else {
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(248, 113, 113);
      doc.setLineWidth(0.3);
      doc.roundedRect(rightColX - 22, sigY + 8, 44, 6, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(153, 27, 27);
      doc.text('Menunggu Pengesahan', rightColX, sigY + 12.2, { align: 'center' });
    }

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(rightColX - 25, sigY + 22, rightColX + 25, sigY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Ketua Paguyuban Dana Kematian', rightColX, sigY + 25.5, { align: 'center' });
  }

  // 6. Subfooter
  doc.setFont('times', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    '* Dokumen sertifikat keanggotaan ini diterbitkan secara elektronik oleh Sistem Informasi Kas & Anggota Paguyuban Dana Kematian dan memiliki kekuatan hukum internal paguyuban.',
    width / 2,
    height - 12.5,
    { align: 'center' }
  );

  return doc;
}
