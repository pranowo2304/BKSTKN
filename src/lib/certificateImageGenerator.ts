import { Member, Payment, SystemSettings } from '../types';
import { getMemberCertificateInfo } from './certificateUtils';
import { calculateMemberExpiry } from './expiryUtils';

interface GenerateCertificateImageOptions {
  member: Member;
  payments?: Payment[];
  settings?: SystemSettings;
  theme?: 'emerald' | 'gold' | 'navy' | 'monochrome';
  showDependents?: boolean;
  showSignatures?: boolean;
  qrDataUrl?: string;
}

export async function generateCertificateCanvas(
  options: GenerateCertificateImageOptions
): Promise<HTMLCanvasElement> {
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
  const communityName = settings?.communityName || 'PAGUYUBAN DANA KEMATIAN WARGA';
  const communityAddress = settings?.communityAddress || 'Sekretariat Rukun Tetangga & Paguyuban Warga Rukun Sejahtera';
  const hotline = settings?.treasurerPhone || '0812-3456-7890';

  // Standard A4 Landscape at high resolution (2480 x 1754 px)
  const canvas = document.createElement('canvas');
  canvas.width = 2480;
  canvas.height = 1754;
  const ctx = canvas.getContext('2d')!;

  const width = canvas.width;
  const height = canvas.height;

  // Colors
  let primaryColor = '#064e3b';
  let accentColor = '#d97706';
  let borderOuterColor = '#065f46';
  let borderInnerColor = '#f59e0b';
  let bgColor = '#fdfcf8';

  if (theme === 'gold') {
    primaryColor = '#92400e';
    accentColor = '#d97706';
    borderOuterColor = '#b45309';
    borderInnerColor = '#fbbf24';
    bgColor = '#fffbeb';
  } else if (theme === 'navy') {
    primaryColor = '#0f172a';
    accentColor = '#2563eb';
    borderOuterColor = '#1e293b';
    borderInnerColor = '#60a5fa';
    bgColor = '#f8fafc';
  } else if (theme === 'monochrome') {
    primaryColor = '#1e293b';
    accentColor = '#475569';
    borderOuterColor = '#334155';
    borderInnerColor = '#94a3b8';
    bgColor = '#ffffff';
  }

  // 1. Background Fill
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Certificate Ornamental Borders
  ctx.strokeStyle = borderOuterColor;
  ctx.lineWidth = 16;
  ctx.strokeRect(70, 70, width - 140, height - 140);

  ctx.strokeStyle = borderInnerColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(95, 95, width - 190, height - 190);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(108, 108, width - 216, height - 216);

  // Corner Flourishes
  const cornerSize = 60;
  const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * cornerSize, cy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + dy * cornerSize);
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(cx + dx * 16, cy + dy * 16, 6, 0, Math.PI * 2);
    ctx.fill();
  };

  drawCorner(120, 120, 1, 1);
  drawCorner(width - 120, 120, -1, 1);
  drawCorner(120, height - 120, 1, -1);
  drawCorner(width - 120, height - 120, -1, -1);

  // Watermark if not issued
  if (!certInfo.isIssued) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.35);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.font = '900 85px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DRAFT • MENUNGGU PENGESAHAN KETUA PAGUYUBAN', 0, 0);
    ctx.restore();
  }

  // 3. Header Text
  let y = 190;
  ctx.textAlign = 'center';

  ctx.fillStyle = primaryColor;
  ctx.font = '900 48px "Segoe UI", Arial, sans-serif';
  ctx.fillText(communityName.toUpperCase(), width / 2, y);

  y += 45;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 28px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`${communityAddress}  •  Kontak Layanan: ${hotline}`, width / 2, y);

  y += 35;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 320, y);
  ctx.lineTo(width / 2 + 320, y);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(width / 2, y, 10, 0, Math.PI * 2);
  ctx.fill();

  y += 55;
  ctx.fillStyle = accentColor;
  ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
  ctx.fillText('PIAGAM PENETAPAN & PERLINDUNGAN WARGA', width / 2, y);

  y += 65;
  ctx.fillStyle = primaryColor;
  ctx.font = '900 78px "Times New Roman", Times, Georgia, serif';
  ctx.fillText('SERTIFIKAT KEANGGOTAAN RESMI', width / 2, y);

  y += 45;
  ctx.fillStyle = '#475569';
  ctx.font = '700 28px "Courier New", Courier, monospace';
  ctx.fillText(`Nomor Registrasi: ${certInfo.certificateNumber}`, width / 2, y);

  // 4. Member Statement
  y += 75;
  ctx.fillStyle = '#334155';
  ctx.font = 'italic 500 34px "Times New Roman", Times, serif';
  ctx.fillText('Dengan ini Pengurus Paguyuban menerangkan dan menetapkan secara sah bahwa:', width / 2, y);

  y += 85;
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 84px "Times New Roman", Times, serif';
  ctx.fillText(member.name.toUpperCase(), width / 2, y);

  // Underline
  const textMetrics = ctx.measureText(member.name.toUpperCase());
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - textMetrics.width / 2 - 40, y + 16);
  ctx.lineTo(width / 2 + textMetrics.width / 2 + 40, y + 16);
  ctx.stroke();

  // Badges Bar
  y += 75;
  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  const badgesText = `NPA: ${member.memberNumber}     •     NIK: ${member.nik}     •     Cluster: ${member.cluster || '-'}     •     Status: ${certInfo.isIssued ? 'Anggota Tetap Sah' : 'Proses Verifikasi'}`;
  ctx.fillText(badgesText, width / 2, y);

  // Statement text
  y += 65;
  ctx.fillStyle = '#475569';
  ctx.font = 'normal 27px "Segoe UI", Arial, sans-serif';
  const p1 = 'Telah memenuhi seluruh rangkaian proses verifikasi kependudukan RT, pelunasan iuran gotong royong melalui Bendahara,';
  const p2 = 'serta memperoleh pengesahan resmi dari Ketua Paguyuban. Anggota beserta seluruh keluarga tanggungan memiliki hak';
  const p3 = 'atas santunan duka cita, fardhu kifayah jenazah, dan layanan ambulans 24 jam.';
  ctx.fillText(p1, width / 2, y);
  y += 38;
  ctx.fillText(p2, width / 2, y);
  y += 38;
  ctx.fillText(p3, width / 2, y);

  // Dependents Box
  if (showDependents && member.dependentsList && member.dependentsList.length > 0) {
    y += 50;
    const boxW = 1600;
    const boxH = 90;
    const boxX = (width - boxW) / 2;
    const boxY = y;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = primaryColor;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Tanggungan Terlindungi (${(member.dependentsCount || 0) + 1} Jiwa):`, boxX + 30, boxY + 36);

    ctx.fillStyle = '#334155';
    ctx.font = 'normal 24px "Segoe UI", Arial, sans-serif';
    const depsStr = member.dependentsList.map((d) => `${d.name} (${d.relationship})`).join(', ');
    ctx.fillText(depsStr, boxX + 30, boxY + 70);

    ctx.textAlign = 'center';
  }

  // 5. Signatures & QR Code Section
  if (showSignatures) {
    const sigY = 1380;

    // Divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(180, sigY - 30);
    ctx.lineTo(width - 180, sigY - 30);
    ctx.stroke();

    // Left: Ketua RT
    const leftX = 460;
    ctx.fillStyle = '#64748b';
    ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText('VERIFIKATOR DOMISILI', leftX, sigY);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText(certInfo.verifiedByRt, leftX, sigY + 45);

    // Green stamp box
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(leftX - 160, sigY + 70, 320, 50);
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX - 160, sigY + 70, 320, 50);
    ctx.fillStyle = '#166534';
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('✓ Terverifikasi RT', leftX, sigY + 104);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftX - 180, sigY + 175);
    ctx.lineTo(leftX + 180, sigY + 175);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'normal 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Ketua RT ${member.cluster || ''}`, leftX, sigY + 210);

    // Center: QR Code
    const centerX = width / 2;
    if (qrDataUrl) {
      try {
        const qrImg = new Image();
        qrImg.src = qrDataUrl;
        await new Promise((resolve) => {
          if (qrImg.complete) resolve(true);
          else qrImg.onload = () => resolve(true);
        });
        ctx.drawImage(qrImg, centerX - 80, sigY - 20, 160, 160);
      } catch (e) {
        console.warn('QR render error:', e);
      }
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('SCAN VALIDASI KEASLIAN', centerX, sigY + 175);
    ctx.font = 'normal 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Ditetapkan: ${certInfo.issueDate}`, centerX, sigY + 210);

    // Right: Ketua Paguyuban
    const rightX = width - 460;
    ctx.fillStyle = '#64748b';
    ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PENGESAHAN AKHIR', rightX, sigY);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText(certInfo.approvedByPaguyuban, rightX, sigY + 45);

    // Stamp
    if (certInfo.isIssued) {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(rightX - 180, sigY + 70, 360, 50);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2;
      ctx.strokeRect(rightX - 180, sigY + 70, 360, 50);
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      ctx.fillText('★ Disahkan & Sah Penuh ★', rightX, sigY + 104);
    } else {
      ctx.fillStyle = '#fee2e2';
      ctx.fillRect(rightX - 180, sigY + 70, 360, 50);
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.strokeRect(rightX - 180, sigY + 70, 360, 50);
      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Menunggu Pengesahan', rightX, sigY + 104);
    }

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightX - 180, sigY + 175);
    ctx.lineTo(rightX + 180, sigY + 175);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'normal 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Ketua Paguyuban Dana Kematian', rightX, sigY + 210);
  }

  // Footer Note
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 20px "Times New Roman", Times, serif';
  ctx.fillText(
    '* Dokumen sertifikat keanggotaan ini diterbitkan secara elektronik oleh Sistem Informasi Kas & Anggota Paguyuban Dana Kematian.',
    width / 2,
    height - 85
  );

  return canvas;
}

export async function downloadCertificateImage(
  options: GenerateCertificateImageOptions
): Promise<string> {
  const canvas = await generateCertificateCanvas(options);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const cleanName = (options.member.name || 'Warga').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanNpa = (options.member.memberNumber || 'CERT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Sertifikat_${cleanNpa}_${cleanName}.png`;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return filename;
}
