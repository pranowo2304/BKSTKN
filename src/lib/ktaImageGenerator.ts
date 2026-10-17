import QRCode from 'qrcode';
import { Member, SystemSettings, Payment } from '../types';
import { calculateMemberExpiry } from './expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload } from './ktaUtils';

export type KtaCardTheme = 'emerald' | 'navy' | 'slate' | 'maroon';
export type KtaCardSide = 'front' | 'back' | 'both';

export interface GenerateKtaImageOptions {
  member: Member;
  side: KtaCardSide;
  theme?: KtaCardTheme;
  settings: SystemSettings;
  payments?: Payment[];
  qrDataUrl?: string;
  qrPayload?: string;
}

// Color schemes aligned with preview
const THEME_PALETTES = {
  emerald: {
    frontGradStart: '#064e3b',
    frontGradMid: '#047857',
    frontGradEnd: '#0f172a',
    backGradStart: '#091e17',
    backGradMid: '#064e3b',
    backGradEnd: '#022c22',
    accent: '#10b981',
    accentMid: '#34d399',
    accentLight: '#a7f3d0',
    accentTeal: '#5eead4',
    gold: '#fbbf24',
    border: 'rgba(52, 211, 153, 0.4)',
    backBorder: 'rgba(45, 212, 191, 0.45)',
    qrDark: '#064e3b',
  },
  navy: {
    frontGradStart: '#0f172a',
    frontGradMid: '#1e3a8a',
    frontGradEnd: '#0369a1',
    backGradStart: '#090d16',
    backGradMid: '#0f172a',
    backGradEnd: '#1e293b',
    accent: '#38bdf8',
    accentMid: '#60a5fa',
    accentLight: '#bae6fd',
    accentTeal: '#7dd3fc',
    gold: '#fbbf24',
    border: 'rgba(96, 165, 250, 0.45)',
    backBorder: 'rgba(56, 189, 248, 0.45)',
    qrDark: '#0f172a',
  },
  slate: {
    frontGradStart: '#090d16',
    frontGradMid: '#1e293b',
    frontGradEnd: '#0f172a',
    backGradStart: '#030712',
    backGradMid: '#0f172a',
    backGradEnd: '#1e293b',
    accent: '#fbbf24',
    accentMid: '#f59e0b',
    accentLight: '#fef08a',
    accentTeal: '#fde047',
    gold: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.45)',
    backBorder: 'rgba(251, 191, 36, 0.45)',
    qrDark: '#090d16',
  },
  maroon: {
    frontGradStart: '#4c0519',
    frontGradMid: '#881337',
    frontGradEnd: '#9f1239',
    backGradStart: '#27030e',
    backGradMid: '#4c0519',
    backGradEnd: '#1a040b',
    accent: '#fb7185',
    accentMid: '#f43f5e',
    accentLight: '#fecdd3',
    accentTeal: '#fda4af',
    gold: '#fbbf24',
    border: 'rgba(251, 113, 133, 0.45)',
    backBorder: 'rgba(244, 63, 94, 0.45)',
    qrDark: '#4c0519',
  },
};

/**
 * Draw rounded rectangle helper
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
 * Draw subtle dot pattern matching the preview's bg-[radial-gradient(#fff_1px,transparent_1px)]
 */
function drawDotPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string = 'rgba(255, 255, 255, 0.08)'
) {
  ctx.fillStyle = color;
  const spacing = 16;
  const dotRadius = 1.2;
  for (let x = 16; x < width; x += spacing) {
    for (let y = 16; y < height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw shield checkmark icon matching ShieldCheck in preview
 */
function drawShieldCheckIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string = '#fbbf24'
) {
  ctx.save();
  ctx.translate(cx, cy);
  const scale = size / 24;
  ctx.scale(scale, scale);

  // Shield contour
  ctx.beginPath();
  ctx.moveTo(12, 2.5);
  ctx.lineTo(20, 5.5);
  ctx.lineTo(20, 11);
  ctx.bezierCurveTo(20, 16.5, 16.5, 20.8, 12, 22);
  ctx.bezierCurveTo(7.5, 20.8, 4, 16.5, 4, 11);
  ctx.lineTo(4, 5.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Checkmark inside shield
  ctx.beginPath();
  ctx.moveTo(8.5, 12);
  ctx.lineTo(11, 14.5);
  ctx.lineTo(15.5, 9.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw UserCheck icon matching preview on back card
 */
function drawUserCheckIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string = '#5eead4'
) {
  ctx.save();
  ctx.translate(cx, cy);
  const scale = size / 24;
  ctx.scale(scale, scale);

  // User head
  ctx.beginPath();
  ctx.arc(9, 7, 4, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // User torso
  ctx.beginPath();
  ctx.moveTo(3, 20);
  ctx.bezierCurveTo(3, 16, 6, 14, 9, 14);
  ctx.bezierCurveTo(12, 14, 15, 16, 15, 20);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Checkmark
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(18.5, 14.5);
  ctx.lineTo(22.5, 9.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw Front Side of KTA (Matching MemberPortal preview 100%)
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
  qrImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null = null
) {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.emerald;
  const radius = 32;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // 1. Clip card boundary
  drawRoundedRect(ctx, 0, 0, width, height, radius);
  ctx.clip();

  // 2. Background Gradient (linear 135deg)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, palette.frontGradStart);
  bgGrad.addColorStop(0.5, palette.frontGradMid);
  bgGrad.addColorStop(1, palette.frontGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Dot Pattern
  drawDotPattern(ctx, width, height, 'rgba(255, 255, 255, 0.08)');

  // 4. Subtle Radial Ambient Lighting
  const ambient = ctx.createRadialGradient(width * 0.8, height * 0.2, 20, width * 0.8, height * 0.2, 450);
  ambient.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
  ambient.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  // 5. Header Bar
  const padX = 44;
  const headerY = 38;

  // 5a. Organization Logo / Emblem (Left)
  const emblemSize = 56;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  drawRoundedRect(ctx, padX, headerY, emblemSize, emblemSize, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (logoImage) {
    ctx.save();
    drawRoundedRect(ctx, padX + 2, headerY + 2, emblemSize - 4, emblemSize - 4, 14);
    ctx.clip();
    // Fill white background for logo clarity
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padX + 2, headerY + 2, emblemSize - 4, emblemSize - 4);

    const pad = 4;
    const drawW = emblemSize - 4 - pad * 2;
    const drawH = emblemSize - 4 - pad * 2;
    const imgAspect = (logoImage.naturalWidth || logoImage.width) / (logoImage.naturalHeight || logoImage.height) || 1;
    let destW = drawW;
    let destH = drawH;
    let destX = padX + 2 + pad;
    let destY = headerY + 2 + pad;
    if (imgAspect > 1) {
      destH = drawW / imgAspect;
      destY += (drawH - destH) / 2;
    } else {
      destW = drawH * imgAspect;
      destX += (drawW - destW) / 2;
    }
    ctx.drawImage(logoImage, destX, destY, destW, destH);
    ctx.restore();
  } else {
    drawShieldCheckIcon(ctx, padX + emblemSize / 2, headerY + emblemSize / 2, 28, palette.gold);
  }

  // 5b. Header Titles: Label + FULL Organization Name in Gold
  const textLeft = padX + emblemSize + 18;
  const pillW = 118;
  const pillH = 34;
  const pillX = width - padX - pillW;
  const pillY = headerY + 10;
  const maxOrgWidth = pillX - textLeft - 16; // Maximum horizontal space available for organization name

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Label: KARTU TANDA ANGGOTA RESMI
  ctx.fillStyle = palette.accentLight;
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1.8px';
  const headerSubtitle = member.status === 'Aktif' || member.isKtaIssued
    ? 'KARTU TANDA ANGGOTA RESMI'
    : 'DRAFT KTA WARGA';
  ctx.fillText(headerSubtitle, textLeft, headerY + 4);

  // Full Organization Name - Dynamic Font Sizing & Multi-line Support so it fits completely without truncation
  const orgName = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').trim().toUpperCase();

  // Smart Font Size & Auto-Fitting Algorithm:
  // Dynamically determines single line vs balanced multi-line and calculates optimal font size
  let orgFontSize = 24;
  ctx.font = `900 ${orgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let measured = ctx.measureText(orgName).width;

  let orgLines: string[] = [orgName];

  if (measured > maxOrgWidth) {
    // Check if scaling down to min 16px fits on a single line
    let testSize = 23.5;
    let fitsSingle = false;
    while (testSize >= 15.5) {
      ctx.font = `900 ${testSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      if (ctx.measureText(orgName).width <= maxOrgWidth) {
        orgFontSize = testSize;
        measured = ctx.measureText(orgName).width;
        fitsSingle = true;
        break;
      }
      testSize -= 0.5;
    }

    // If still wider than maxOrgWidth, wrap into 2 balanced lines
    if (!fitsSingle) {
      const words = orgName.split(' ');
      if (words.length > 1) {
        let bestSplit = 1;
        let minDiff = Infinity;
        for (let i = 1; i < words.length; i++) {
          const l1 = words.slice(0, i).join(' ');
          const l2 = words.slice(i).join(' ');
          const diff = Math.abs(l1.length - l2.length);
          if (diff < minDiff) {
            minDiff = diff;
            bestSplit = i;
          }
        }
        const line1 = words.slice(0, bestSplit).join(' ');
        const line2 = words.slice(bestSplit).join(' ');
        orgLines = [line1, line2];

        orgFontSize = 16.5;
        ctx.font = `900 ${orgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        measured = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width);

        while (measured > maxOrgWidth && orgFontSize > 11) {
          orgFontSize -= 0.5;
          ctx.font = `900 ${orgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          measured = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width);
        }
      } else {
        // Single word fallback scale down
        while (measured > maxOrgWidth && orgFontSize > 11) {
          orgFontSize -= 0.5;
          ctx.font = `900 ${orgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          measured = ctx.measureText(orgName).width;
        }
      }
    }
  }

  // Radiant Metallic Gold Color Styling for Organization Name
  const gradTop = orgLines.length === 1 ? headerY + 22 : headerY + 18;
  const gradBottom = gradTop + (orgLines.length * (orgFontSize + 4));
  const goldGrad = ctx.createLinearGradient(textLeft, gradTop, textLeft + Math.min(measured, maxOrgWidth), gradBottom);
  goldGrad.addColorStop(0, '#fffbeb');   // Soft bright highlight gold
  goldGrad.addColorStop(0.2, '#fef08a'); // Luminous yellow gold
  goldGrad.addColorStop(0.5, '#fbbf24'); // Vibrant amber gold
  goldGrad.addColorStop(0.85, '#f59e0b'); // Rich warm gold
  goldGrad.addColorStop(1, '#d97706');   // Deep bronze gold

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1.5;
  ctx.fillStyle = goldGrad;
  ctx.font = `900 ${orgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.letterSpacing = '0.5px';

  if (orgLines.length === 1) {
    ctx.fillText(orgLines[0], textLeft, headerY + 24);
  } else {
    const lineSpacing = orgFontSize + 3.5;
    ctx.fillText(orgLines[0], textLeft, headerY + 20);
    ctx.fillText(orgLines[1], textLeft, headerY + 20 + lineSpacing);
  }
  ctx.restore();

  // 5c. Right: Status Badge Pill ("● RESMI" or Status)
  const isOfficial = member.status === 'Aktif' || member.isKtaIssued;
  const statusLabel = isOfficial ? 'RESMI' : (member.status || 'DRAFT');

  ctx.fillStyle = isOfficial ? 'rgba(52, 211, 153, 0.22)' : 'rgba(251, 191, 36, 0.22)';
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 10);
  ctx.fill();
  ctx.strokeStyle = isOfficial ? 'rgba(52, 211, 153, 0.5)' : 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Status Dot
  ctx.fillStyle = isOfficial ? '#34d399' : '#fbbf24';
  ctx.beginPath();
  ctx.arc(pillX + 22, pillY + pillH / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Status Text
  ctx.fillStyle = isOfficial ? palette.accentLight : '#fef08a';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  ctx.fillText(statusLabel.toUpperCase(), pillX + 36, pillY + pillH / 2);

  // 5d. Header Divider Line (auto adjusted if 2 lines)
  const dividerY = orgLines.length > 1 ? headerY + emblemSize + 26 : headerY + emblemSize + 20;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, dividerY);
  ctx.lineTo(width - padX, dividerY);
  ctx.stroke();

  // 6. Middle Area (Left: Member NPA & Data, Right: QR Code)
  // 6a. Left Information
  const infoX = padX;
  const infoY = dividerY + 36;

  // NPA Tag
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(167, 243, 208, 0.85)';
  ctx.font = '700 13px "Courier New", Courier, monospace';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('NOMOR POKOK ANGGOTA (NPA):', infoX, infoY);

  // NPA Big Monospace Value
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 46px "Courier New", Courier, monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText(member.memberNumber || 'PDK-2026-000', infoX, infoY + 28);

  // Member Full Name
  ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0px';
  const displayName = member.name.length > 28 ? member.name.substring(0, 26) + '...' : member.name;
  ctx.fillText(displayName, infoX, infoY + 98);

  // Cluster & NIK Line
  ctx.fillStyle = '#d1fae5';
  ctx.font = '700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(`Cluster: ${member.cluster || '-'}   •   NIK: ${member.nik || '-'}`, infoX, infoY + 150);

  // 6b. Right Information: High-Contrast QR Code Card
  const qrCardW = 206;
  const qrCardH = 206;
  const qrCardX = width - padX - qrCardW;
  const qrCardY = dividerY + 26;

  // White Card Container
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardW, qrCardH, 22);
  ctx.fill();
  ctx.strokeStyle = palette.accentMid;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Draw QR Image inside
  if (qrImage) {
    const qrPad = 14;
    const qrDrawSize = qrCardW - qrPad * 2;
    try {
      ctx.drawImage(qrImage, qrCardX + qrPad, qrCardY + qrPad, qrDrawSize, qrDrawSize);
    } catch (e) {
      console.warn('Could not draw QR code on canvas:', e);
    }
  }

  // Underneath QR Card: "SCAN VERIFIKASI"
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '1px';
  ctx.fillText('SCAN VERIFIKASI', qrCardX + qrCardW / 2, qrCardY + qrCardH + 14);

  // 7. Bottom Bar (Expiry Date & Protected Dependents)
  const bottomDividerY = height - 90;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, bottomDividerY);
  ctx.lineTo(width - padX, bottomDividerY);
  ctx.stroke();

  // 7a. Left: Masa Perlindungan
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(110, 231, 183, 0.8)';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('MASA PERLINDUNGAN:', padX, bottomDividerY + 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px "Courier New", Courier, monospace';
  ctx.letterSpacing = '0.5px';
  ctx.fillText(expiryDateFormatted || '31 Des 2026', padX, bottomDividerY + 40);

  // 7b. Right: Tanggungan Jiwa
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(110, 231, 183, 0.8)';
  ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('TANGGUNGAN:', width - padX, bottomDividerY + 18);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(`${(member.dependentsCount || 0) + 1} Jiwa Terlindungi`, width - padX, bottomDividerY + 40);

  // Outer Stroke Border of KTA Card
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 1.5, 1.5, width - 3, height - 3, radius);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw Back Side of KTA (Matching MemberPortal preview 100%)
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
  qrImage: HTMLImageElement | null,
  logoImage: HTMLImageElement | null = null
) {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.emerald;
  const radius = 32;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  // 1. Clip card boundary
  drawRoundedRect(ctx, 0, 0, width, height, radius);
  ctx.clip();

  // 2. Background Gradient (Darker rich tone)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, palette.backGradStart);
  bgGrad.addColorStop(0.5, palette.backGradMid);
  bgGrad.addColorStop(1, palette.backGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Dot Pattern (Teal)
  drawDotPattern(ctx, width, height, 'rgba(52, 211, 153, 0.08)');

  const padX = 44;
  const headerY = 36;

  // 4. Header: Logo / UserCheck Icon + Organization Name in Gold & Title
  const logoBadgeSize = 40;
  const logoY = headerY - 6;
  if (logoImage) {
    ctx.save();
    drawRoundedRect(ctx, padX, logoY, logoBadgeSize, logoBadgeSize, 12);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padX, logoY, logoBadgeSize, logoBadgeSize);
    ctx.drawImage(logoImage, padX + 2, logoY + 2, logoBadgeSize - 4, logoBadgeSize - 4);
    ctx.restore();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, padX, logoY, logoBadgeSize, logoBadgeSize, 12);
    ctx.stroke();
  } else {
    drawShieldCheckIcon(ctx, padX + logoBadgeSize / 2, logoY + logoBadgeSize / 2, 26, palette.gold);
  }

  const backTextLeft = padX + logoBadgeSize + 14;
  const backOrgName = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').trim().toUpperCase();
  const maxBackOrgW = width - padX - 220 - backTextLeft;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Subtitle
  ctx.fillStyle = palette.accentTeal;
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1.2px';
  ctx.fillText('DETAIL PROFIL & INFORMASI ANGGOTA', backTextLeft, headerY - 6);

  // Full Org Name in Gold
  let backOrgFontSize = 16;
  ctx.font = `900 ${backOrgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let backMeasured = ctx.measureText(backOrgName).width;
  while (backMeasured > maxBackOrgW && backOrgFontSize > 10.5) {
    backOrgFontSize -= 0.5;
    ctx.font = `900 ${backOrgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    backMeasured = ctx.measureText(backOrgName).width;
  }

  const backGoldGrad = ctx.createLinearGradient(backTextLeft, headerY + 10, backTextLeft + backMeasured, headerY + 30);
  backGoldGrad.addColorStop(0, '#fffbeb');
  backGoldGrad.addColorStop(0.3, '#fef08a');
  backGoldGrad.addColorStop(0.7, '#fbbf24');
  backGoldGrad.addColorStop(1, '#d97706');

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = backGoldGrad;
  ctx.font = `900 ${backOrgFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.letterSpacing = '0.3px';
  ctx.fillText(backOrgName, backTextLeft, headerY + 10);
  ctx.restore();

  // Right Header Badges: NPA
  const npaText = member.memberNumber || 'PDK-2026-000';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = '800 13px "Courier New", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`NPA: ${npaText}`, width - padX, headerY + 10);

  // Divider Line
  const dividerY = headerY + 44;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, dividerY);
  ctx.lineTo(width - padX, dividerY);
  ctx.stroke();

  // 5. Middle Body (Left 60%: Profile & Dependents; Right 40%: QR & Protection Benefits)
  const bodyY = dividerY + 22;
  const leftColW = 570;

  // 5a. Member Full Name
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.85)';
  ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText('NAMA LENGKAP ANGGOTA:', padX, bodyY);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const cleanName = member.name.length > 30 ? member.name.substring(0, 28) + '...' : member.name;
  ctx.fillText(cleanName, padX, bodyY + 18);

  // 5b. Box 1: NIK, No. KK & Cluster
  const box1Y = bodyY + 56;
  const box1H = 92;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  drawRoundedRect(ctx, padX, box1Y, leftColW, box1H, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Box 1 Content
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.8)';
  ctx.fillText('NIK WARGA:', padX + 16, box1Y + 12);
  ctx.fillText('NO. KARTU KELUARGA:', padX + 280, box1Y + 12);

  ctx.font = '800 15px "Courier New", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(member.nik || '-', padX + 16, box1Y + 28);
  ctx.fillText(member.familyCardNumber || 'Terdaftar', padX + 280, box1Y + 28);

  // Cluster & RT Row
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(padX + 16, box1Y + 54);
  ctx.lineTo(padX + leftColW - 16, box1Y + 54);
  ctx.stroke();

  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.8)';
  ctx.fillText('CLUSTER / RT:', padX + 16, box1Y + 64);
  ctx.fillStyle = palette.accentMid;
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(member.cluster || 'Cluster Paguyuban Warga', padX + 130, box1Y + 62);

  // 5c. Box 2: Covered Family Dependents
  const box2Y = box1Y + box1H + 16;
  const box2H = 140;
  ctx.fillStyle = 'rgba(6, 78, 59, 0.45)';
  drawRoundedRect(ctx, padX, box2Y, leftColW, box2H, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Box 2 Header
  ctx.fillStyle = palette.gold;
  ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`👨‍👩‍👧‍👦 Tanggungan Jiwa Terlindungi: ${(member.dependentsCount || 0) + 1} Jiwa`, padX + 16, box2Y + 14);

  // Dependents List
  if (member.dependentsList && member.dependentsList.length > 0) {
    let depY = box2Y + 42;
    const maxVisible = 3;
    member.dependentsList.slice(0, maxVisible).forEach((dep, idx) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      drawRoundedRect(ctx, padX + 16, depY, leftColW - 32, 24, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`• ${dep.name} (${dep.relationship})`, padX + 26, depY + 5);

      depY += 28;
    });

    if (member.dependentsList.length > maxVisible) {
      ctx.fillStyle = palette.accentMid;
      ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`+ ${member.dependentsList.length - maxVisible} tanggungan keluarga lainnya terdaftar di sistem`, padX + 16, depY + 2);
    }
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Kepala Keluarga Terdaftar • No. HP: ${member.phone || '-'}`, padX + 16, box2Y + 50);
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Data keluarga otomatis disinkronkan saat pengajuan berkas KK.', padX + 16, box2Y + 76);
  }

  // 5d. Right Column: QR Code + Protection Rights Box
  const rightColX = padX + leftColW + 36;
  const rightColW = width - rightColX - padX;

  // QR Code Box (Matching preview: size 160x160 with teal border)
  const qrBackSize = 160;
  const qrBackX = rightColX + (rightColW - qrBackSize) / 2;
  const qrBackY = bodyY;

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrBackX, qrBackY, qrBackSize, qrBackSize, 20);
  ctx.fill();
  ctx.strokeStyle = palette.accentTeal;
  ctx.lineWidth = 3;
  ctx.stroke();

  if (qrImage) {
    const qrPad = 12;
    try {
      ctx.drawImage(qrImage, qrBackX + qrPad, qrBackY + qrPad, qrBackSize - qrPad * 2, qrBackSize - qrPad * 2);
    } catch (e) {
      console.warn('Could not draw QR image on back card:', e);
    }
  }

  // Hak Perlindungan Card
  const rightsY = qrBackY + qrBackSize + 20;
  const rightsH = 120;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  drawRoundedRect(ctx, rightColX, rightsY, rightColW, rightsH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = palette.gold;
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🛡️ Hak Perlindungan Resmi:', rightColX + 14, rightsY + 14);

  ctx.fillStyle = '#d1fae5';
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('• Ambulans Jenazah 24 Jam', rightColX + 14, rightsY + 38);
  ctx.fillText('• Santunan Duka Cita Cepat', rightColX + 14, rightsY + 62);
  ctx.fillText('• Perlengkapan Fardhu Kifayah', rightColX + 14, rightsY + 86);

  // 6. Bottom Footer
  const footerDividerY = height - 76;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, footerDividerY);
  ctx.lineTo(width - padX, footerDividerY);
  ctx.stroke();

  // Footer Col 1: Pengesahan
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.8)';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PENGESAHAN:', padX, footerDividerY + 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(member.isKtaIssued ? 'Bendahara Paguyuban' : 'Verifikasi Pengurus', padX, footerDividerY + 32);

  // Footer Col 2: Darurat Jenazah (Center)
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.8)';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DARURAT JENAZAH 24 JAM:', width / 2, footerDividerY + 14);
  ctx.fillStyle = palette.gold;
  ctx.font = '800 15px "Courier New", Courier, monospace';
  ctx.fillText(settings.treasurerPhone || '0812-3456-7890', width / 2, footerDividerY + 32);

  // Footer Col 3: Status KTA (Right)
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.8)';
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('STATUS KTA:', width - padX, footerDividerY + 14);
  ctx.fillStyle = palette.accentMid;
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(member.status === 'Aktif' || member.isKtaIssued ? 'Aktif & Sah' : member.status, width - padX, footerDividerY + 32);

  // Outer Stroke Border
  ctx.strokeStyle = palette.backBorder;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 1.5, 1.5, width - 3, height - 3, radius);
  ctx.stroke();

  ctx.restore();
}

/**
 * Helper to safely load an image from a Data URL into an HTMLImageElement
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
 * Generates a high-definition Canvas for the KTA Card matching the live preview
 */
export async function generateKtaCardCanvas({
  member,
  side,
  theme = 'emerald',
  settings,
  payments = [],
  qrDataUrl,
  qrPayload,
}: GenerateKtaImageOptions): Promise<HTMLCanvasElement> {
  const expiry = calculateMemberExpiry(member, payments, new Date(), settings);
  const ktaInfo = getMemberKtaIssuanceInfo(member, payments);

  // Standard CR80 card ratio 85.6mm x 53.98mm = 1.58577:1 (1050px x 662px is 1.586:1)
  const cardWidth = 1050;
  const cardHeight = 662;

  // 1. GUARANTEE QR CODE GENERATION
  let qrImg: HTMLImageElement | null = null;
  try {
    let finalQrDataUrl = qrDataUrl;
    if (!finalQrDataUrl) {
      const payload = qrPayload || generateKtaQrPayload(
        member,
        ktaInfo,
        settings,
        expiry.expiryDateFormatted,
        'url'
      );
      finalQrDataUrl = await QRCode.toDataURL(payload, {
        width: 512,
        margin: 1,
        color: {
          dark: '#022c22', // deep emerald dark matching preview
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    }

    if (finalQrDataUrl) {
      qrImg = await loadImage(finalQrDataUrl);
    }
  } catch (e) {
    console.error('Failed to generate/load QR code image for KTA:', e);
  }

  // 2. LOAD ORGANIZATION LOGO WITH BULLETPROOF FALLBACK
  let logoImg: HTMLImageElement | null = null;
  const primaryLogoUrl = settings.logoUrl || '/app-icon.svg';
  try {
    logoImg = await loadImage(primaryLogoUrl);
  } catch (err) {
    console.warn('Could not load primary organization logo image, trying /app-icon.svg fallback:', err);
    if (primaryLogoUrl !== '/app-icon.svg') {
      try {
        logoImg = await loadImage('/app-icon.svg');
      } catch (fallbackErr) {
        console.warn('Both logo attempts failed, vector emblem will be drawn:', fallbackErr);
      }
    }
  }

  const canvas = document.createElement('canvas');

  if (side === 'front') {
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d')!;
    drawKtaFront(ctx, 0, 0, cardWidth, cardHeight, member, theme, settings, expiry.expiryDateFormatted, qrImg, logoImg);
  } else if (side === 'back') {
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d')!;
    drawKtaBack(ctx, 0, 0, cardWidth, cardHeight, member, theme, settings, qrImg, logoImg);
  } else {
    // Both sides: Stacked vertically with clean premium container
    const gap = 50;
    const bannerH = 96;
    const footerPad = 50;
    canvas.width = cardWidth;
    canvas.height = bannerH + cardHeight * 2 + gap + footerPad;
    const ctx = canvas.getContext('2d')!;

    // Background Canvas
    ctx.fillStyle = '#0b1329';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title banner
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `KARTU TANDA ANGGOTA DIGITAL RESMI - ${member.name.toUpperCase()}`,
      canvas.width / 2,
      20
    );

    // Organization Name in Gold
    const fullOrgName = (settings.communityName || 'PAGUYUBAN DANA KEMATIAN').toUpperCase();
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText(
      `${fullOrgName} • NPA: ${member.memberNumber || '-'}`,
      canvas.width / 2,
      56
    );

    // Front Card
    drawKtaFront(ctx, 0, bannerH, cardWidth, cardHeight, member, theme, settings, expiry.expiryDateFormatted, qrImg, logoImg);

    // Back Card
    drawKtaBack(ctx, 0, bannerH + cardHeight + gap, cardWidth, cardHeight, member, theme, settings, qrImg, logoImg);
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
  const sideLabel = options.side === 'front' ? 'Depan' : options.side === 'back' ? 'Belakang' : 'Lengkap_2_Sisi';
  const filename = `KTA_${cleanNpa}_${cleanName}_${sideLabel}.png`;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return filename;
}
