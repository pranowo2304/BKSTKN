import { Member, SystemSettings } from '../types';
import { calculateMemberExpiry } from './expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload } from './ktaUtils';

export type KtaCardTheme = 'emerald' | 'navy' | 'slate' | 'maroon';
export type KtaCardSide = 'front' | 'back' | 'both';

interface GenerateKtaImageOptions {
  member: Member;
  side: KtaCardSide;
  theme?: KtaCardTheme;
  settings: SystemSettings;
  payments?: any[];
  qrDataUrl?: string;
}

// Colors for themes
const THEME_PALETTES = {
  emerald: {
    bgStart: '#064e3b',
    bgMid: '#065f46',
    bgEnd: '#022c22',
    accent: '#10b981',
    accentLight: '#6ee7b7',
    gold: '#fbbf24',
    border: '#047857',
    chip: '#d97706',
  },
  navy: {
    bgStart: '#0f172a',
    bgMid: '#1e3a8a',
    bgEnd: '#0284c7',
    accent: '#38bdf8',
    accentLight: '#bae6fd',
    gold: '#fbbf24',
    border: '#1d4ed8',
    chip: '#d97706',
  },
  slate: {
    bgStart: '#090d16',
    bgMid: '#1e293b',
    bgEnd: '#0f172a',
    accent: '#fbbf24',
    accentLight: '#fef08a',
    gold: '#f59e0b',
    border: '#334155',
    chip: '#b45309',
  },
  maroon: {
    bgStart: '#4c0519',
    bgMid: '#881337',
    bgEnd: '#9f1239',
    accent: '#fb7185',
    accentLight: '#fecdd3',
    gold: '#fbbf24',
    border: '#be123c',
    chip: '#d97706',
  },
};

/**
 * Helper to draw a rounded rectangle on a canvas context
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw the front side of the KTA Card on canvas
 */
function drawKtaFront(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  member: Member,
  theme: KtaCardTheme,
  settings: SystemSettings,
  expiryDateFormatted: string,
  qrImage?: HTMLImageElement | null
) {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.emerald;
  const radius = 32;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // 1. Card Clipping & Base Shadow
  drawRoundedRect(ctx, 0, 0, width, height, radius);
  ctx.clip();

  // 2. Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.5, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Subtle Geometric Anti-Counterfeit Background Patterns
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let i = -width; i < width * 2; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  // Soft Radial Glow
  const glow = ctx.createRadialGradient(width * 0.85, height * 0.15, 10, width * 0.85, height * 0.15, 300);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 4. Header Top Stripe
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, width, 8);

  // 5. Header Content
  // Paguyuban Emblem Circle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  drawRoundedRect(ctx, 36, 26, 68, 68, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Emblem Symbol
  ctx.fillStyle = palette.gold;
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 70, 60);

  // Organization Title & Labels
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = palette.accentLight;
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('KARTU TANDA ANGGOTA DIGITAL RESMI', 120, 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0.5px';
  const orgName = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').toUpperCase();
  // Truncate if too long
  const truncatedOrgName = orgName.length > 36 ? orgName.substring(0, 34) + '...' : orgName;
  ctx.fillText(truncatedOrgName, 120, 50);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(`${member.cluster || 'Cluster Warga'} • ${settings.communityAddress || 'Sekretariat Paguyuban'}`, 120, 80);

  // Header Right: Chip & Official Status Badge
  // Digital Chip
  ctx.fillStyle = '#fbbf24';
  drawRoundedRect(ctx, width - 110, 28, 74, 48, 8);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chip inner metallic pattern
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width - 110 + 24, 28);
  ctx.lineTo(width - 110 + 24, 28 + 48);
  ctx.moveTo(width - 110 + 50, 28);
  ctx.lineTo(width - 110 + 50, 28 + 48);
  ctx.moveTo(width - 110, 28 + 24);
  ctx.lineTo(width - 110 + 74, 28 + 24);
  ctx.stroke();

  // "KTA RESMI • AKTIF" Status Pill
  ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
  drawRoundedRect(ctx, width - 158, 84, 122, 24, 12);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = palette.accentLight;
  ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('● KTA RESMI • AKTIF', width - 97, 96);

  // Divider Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 118);
  ctx.lineTo(width - 36, 118);
  ctx.stroke();

  // 6. Member Identity Section (Center)
  // Avatar / Photo Box
  const photoSize = 136;
  const photoX = 36;
  const photoY = 138;

  // Outer frame
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 20);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Photo Inner Gradient
  const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoSize, photoY + photoSize);
  photoGrad.addColorStop(0, '#064e3b');
  photoGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = photoGrad;
  drawRoundedRect(ctx, photoX + 4, photoY + 4, photoSize - 8, photoSize - 8, 16);
  ctx.fill();

  // Initials in Avatar
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = member.name.substring(0, 2).toUpperCase();
  ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2);

  // Middle Data Fields
  const textX = photoX + photoSize + 28;

  // NPA Tag
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = palette.accentLight;
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('NOMOR POKOK ANGGOTA (NPA)', textX, 138);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px "Courier New", Courier, monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText(member.memberNumber || 'PDK-2026-000', textX, 156);

  // Full Name
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0px';
  const memberName = member.name.length > 26 ? member.name.substring(0, 24) + '...' : member.name;
  ctx.fillText(memberName, textX, 194);

  // Info Pills Grid: NIK, Cluster, Status, Masa Berlaku
  const infoBoxY = 236;
  const infoBoxW = 460;
  const infoBoxH = 90;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  drawRoundedRect(ctx, textX, infoBoxY, infoBoxW, infoBoxH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Grid items inside Info Box
  // Row 1: NIK & Cluster
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('NIK / KTP:', textX + 16, infoBoxY + 12);
  ctx.fillText('CLUSTER / RT:', textX + 240, infoBoxY + 12);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillText(member.nik || '-', textX + 16, infoBoxY + 28);

  ctx.fillStyle = palette.accentLight;
  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(member.cluster || 'Cluster Warga', textX + 240, infoBoxY + 28);

  // Row 2: Masa Berlaku & Tanggungan
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('MASA PERLINDUNGAN:', textX + 16, infoBoxY + 52);
  ctx.fillText('TANGGUNGAN JIWA:', textX + 240, infoBoxY + 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Berlaku s/d ${expiryDateFormatted || '31 Des 2026'}`, textX + 16, infoBoxY + 68);

  ctx.fillStyle = palette.gold;
  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${(member.dependentsCount || 0) + 1} Jiwa Terlindungi`, textX + 240, infoBoxY + 68);

  // Right Side: QR Code Area
  const qrBoxSize = 168;
  const qrBoxX = width - qrBoxSize - 36;
  const qrBoxY = 138;

  // White background for QR code
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 32, 16);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw QR Image if provided
  if (qrImage) {
    try {
      ctx.drawImage(qrImage, qrBoxX + 14, qrBoxY + 14, qrBoxSize - 28, qrBoxSize - 28);
    } catch (e) {
      console.warn('Could not draw QR image on front card:', e);
    }
  } else {
    // Fallback QR placeholder text
    ctx.fillStyle = '#064e3b';
    ctx.font = '900 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QR KTA', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize / 2);
  }

  // Label under QR Code
  ctx.fillStyle = '#064e3b';
  ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCAN VERIFIKASI', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 16);

  // 7. Footer Bottom Strip
  const footerY = height - 52;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, footerY, width, 52);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(width, footerY);
  ctx.stroke();

  // Footer Left: Verification text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PENGESAHAN: BENDAHARA PAGUYUBAN • STATUS SAH DIVERIFIKASI', 36, footerY + 26);

  // Footer Right: Digital Hash / Serial
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.accentLight;
  ctx.font = '700 11px "Courier New", monospace';
  ctx.fillText(`DIGITAL-ID: ${member.memberNumber} • VALID`, width - 36, footerY + 26);

  // Outer Border for Card
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 1.5, 1.5, width - 3, height - 3, radius);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw the back side of the KTA Card on canvas
 */
function drawKtaBack(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  member: Member,
  theme: KtaCardTheme,
  settings: SystemSettings,
  qrImage?: HTMLImageElement | null
) {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.emerald;
  const radius = 32;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // 1. Card Clipping & Base
  drawRoundedRect(ctx, 0, 0, width, height, radius);
  ctx.clip();

  // 2. Background Gradient (Darker tone for backside)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, palette.bgStart);
  bgGrad.addColorStop(1, '#021814');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle Pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = -width; i < width * 2; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  // Top Accent Stripe
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, width, 8);

  // 3. Back Header
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '1px';
  ctx.fillText('KETENTUAN & SYARAT PENGGUNAAN KTA RESMI', 36, 28);

  ctx.fillStyle = palette.accentLight;
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(`NPA: ${member.memberNumber} • ${settings.communityName || 'Paguyuban Dana Kematian'}`, 36, 52);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 78);
  ctx.lineTo(width - 36, 78);
  ctx.stroke();

  // 4. Content Grid: Left (Terms list), Right (Large QR & Stamp)
  const contentY = 96;

  // Terms (Left 600px)
  const terms = [
    '1. Kartu Tanda Anggota (KTA) ini merupakan bukti sah keanggotaan Paguyuban Dana Kematian Warga.',
    '2. Pemegang KTA berhak atas fasilitas ambulans jenazah, pemulasaran fardhu kifayah, dan santunan duka cita.',
    '3. Hak santunan berlaku bagi kepala keluarga dan seluruh tanggungan yang telah terdaftar resmi.',
    '4. Wajib ditunjukkan saat pelaporan warga duka cita kepada pengurus RT atau Bendahara Paguyuban.',
    '5. Keabsahan kartu dapat diverifikasi seketika dengan memindai QR Code resmi menggunakan kamera HP.',
    '6. Iuran wajib dibayarkan tepat waktu setiap periode tahunan demi menjaga status keaktifan hak santunan.',
  ];

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let currentTermY = contentY;
  terms.forEach((term) => {
    ctx.fillText(term, 36, currentTermY);
    currentTermY += 26;
  });

  // Right Side: QR Code + Digital Verification Seal Box
  const qrBackSize = 150;
  const qrBackX = width - qrBackSize - 50;
  const qrBackY = contentY;

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBackX, qrBackY, qrBackSize, qrBackSize, 16);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (qrImage) {
    try {
      ctx.drawImage(qrImage, qrBackX + 12, qrBackY + 12, qrBackSize - 24, qrBackSize - 24);
    } catch (e) {
      console.warn('Could not draw QR image on back card:', e);
    }
  }

  // Verification Seal / Stempel Digital Box
  const stampY = qrBackY + qrBackSize + 16;
  const stampW = qrBackSize;
  const stampH = 72;

  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  drawRoundedRect(ctx, qrBackX, stampY, stampW, stampH, 12);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = palette.accentLight;
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('TERVERIFIKASI SAH', qrBackX + stampW / 2, stampY + 10);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Bendahara Paguyuban', qrBackX + stampW / 2, stampY + 28);

  ctx.fillStyle = palette.gold;
  ctx.font = '700 9px "Courier New", monospace';
  ctx.fillText('SISTEM RESMI DIGITAL', qrBackX + stampW / 2, stampY + 48);

  // 5. Contact & Secretariat Box at Bottom Left
  const contactY = 270;
  const contactW = 580;
  const contactH = 68;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  drawRoundedRect(ctx, 36, contactY, contactW, contactH, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = palette.accentLight;
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('LAYANAN BANTUAN & PENGURUS:', 52, contactY + 12);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Sekretariat: ${settings.communityAddress || 'Kantor Paguyuban Warga'}`, 52, contactY + 30);
  ctx.fillText(`Kontak Pengurus: ${settings.treasurerPhone || '0812-3456-7890'} • Pelayanan 24 Jam Ambulans Jenazah`, 52, contactY + 48);

  // 6. Footer Bottom
  const footerY = height - 48;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, footerY, width, 48);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(width, footerY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Hak Cipta Dilindungi Undang-Undang • Sistem Informasi Manajemen Dana Kematian Warga', width / 2, footerY + 24);

  // Outer Border for Card
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 1.5, 1.5, width - 3, height - 3, radius);
  ctx.stroke();

  ctx.restore();
}

/**
 * Load an image from a Data URL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Generates a high-definition Canvas for the KTA Card
 */
export async function generateKtaCardCanvas({
  member,
  side,
  theme = 'emerald',
  settings,
  payments = [],
  qrDataUrl,
}: GenerateKtaImageOptions): Promise<HTMLCanvasElement> {
  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const cardWidth = 1050;
  const cardHeight = 660;

  // Pre-load QR Code image if data URL is provided
  let qrImg: HTMLImageElement | null = null;
  if (qrDataUrl) {
    try {
      qrImg = await loadImage(qrDataUrl);
    } catch (e) {
      console.warn('Failed to pre-load QR image for canvas:', e);
    }
  }

  const canvas = document.createElement('canvas');

  if (side === 'front') {
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d')!;
    drawKtaFront(ctx, 0, 0, cardWidth, cardHeight, member, theme, settings, expiry.expiryDateFormatted, qrImg);
  } else if (side === 'back') {
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d')!;
    drawKtaBack(ctx, 0, 0, cardWidth, cardHeight, member, theme, settings, qrImg);
  } else {
    // Both sides on one single image (vertical layout with divider)
    const gap = 48;
    canvas.width = cardWidth;
    canvas.height = cardHeight * 2 + gap + 80;
    const ctx = canvas.getContext('2d')!;

    // Background Canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title banner on top
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`KARTU TANDA ANGGOTA DIGITAL (DEPAN & BELAKANG) - ${member.name.toUpperCase()}`, canvas.width / 2, 24);

    // Draw Front
    drawKtaFront(ctx, 0, 68, cardWidth, cardHeight, member, theme, settings, expiry.expiryDateFormatted, qrImg);

    // Draw Back
    drawKtaBack(ctx, 0, 68 + cardHeight + gap, cardWidth, cardHeight, member, theme, settings, qrImg);
  }

  return canvas;
}

/**
 * Downloads the KTA card as a PNG image file directly to the user's computer or mobile phone
 */
export async function downloadKtaCardAsImage(options: GenerateKtaImageOptions): Promise<string> {
  const canvas = await generateKtaCardCanvas(options);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const cleanName = (options.member.name || 'Warga').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanNpa = (options.member.memberNumber || 'KTA').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sideLabel = options.side === 'front' ? 'Depan' : options.side === 'back' ? 'Belakang' : 'Lengkap';
  const filename = `KTA_${cleanNpa}_${cleanName}_${sideLabel}.png`;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return filename;
}
