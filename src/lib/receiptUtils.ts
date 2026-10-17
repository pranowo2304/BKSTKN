import { Payment, Member, SystemSettings } from '../types';
import { formatIDR } from './storage';
import { terbilang } from './terbilang';

/**
 * Normalizes an Indonesian phone number to international WhatsApp format (e.g., 6281234567890).
 */
export const cleanPhoneNumberForWhatsApp = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.startsWith('0')) {
    return '62' + digits.substring(1);
  }
  if (digits.startsWith('8')) {
    return '62' + digits;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  return '62' + digits;
};

/**
 * Formats a phone number for user-friendly display (e.g., +62 812-3456-7890).
 */
export const formatPhoneDisplay = (phone: string): string => {
  if (!phone) return '-';
  const clean = cleanPhoneNumberForWhatsApp(phone);
  if (!clean || clean.length < 9) return phone;

  // Expected format: 6281234567890 -> +62 812-3456-7890
  const country = '+62';
  const rest = clean.startsWith('62') ? clean.substring(2) : clean;
  if (rest.length <= 3) return `${country} ${rest}`;
  if (rest.length <= 7) return `${country} ${rest.substring(0, 3)}-${rest.substring(3)}`;
  return `${country} ${rest.substring(0, 3)}-${rest.substring(3, 7)}-${rest.substring(7)}`;
};

/**
 * Finds the corresponding registered member for a given payment.
 */
export const findMemberForPayment = (
  payment: Payment,
  members: Member[] = []
): Member | undefined => {
  if (!payment || !Array.isArray(members)) return undefined;
  return members.find(
    (m) =>
      m && (
        (payment.memberId && m.id === payment.memberId) ||
        (payment.memberNumber && m.memberNumber && m.memberNumber.toLowerCase() === payment.memberNumber.toLowerCase()) ||
        (payment.memberName && m.name && m.name.toLowerCase().trim() === payment.memberName.toLowerCase().trim())
      )
  );
};

/**
 * Resolves the official membership/payment period determined in System Settings.
 * Evaluates:
 * 1. Fixed Period Mode:
 *    - Custom Range: settings.membershipPeriod.customPeriodName || `${customStartDate} s/d ${customEndDate}`
 *    - Calendar Year: `Tahun ${activePeriodYear}` (e.g. "Tahun 2026")
 * 2. Payment Date Mode (Bergulir):
 *    - `Masa Aktif ${durationMonths} Bulan Bergulir`
 */
export const getSystemConfiguredPeriod = (settings?: SystemSettings): string => {
  const periodConfig = settings?.membershipPeriod;
  if (!periodConfig) {
    return `Tahun ${new Date().getFullYear()}`;
  }

  if (periodConfig.mode === 'fixed_period') {
    if (periodConfig.fixedType === 'custom_range') {
      if (periodConfig.customPeriodName && periodConfig.customPeriodName.trim()) {
        return periodConfig.customPeriodName.trim();
      }
      if (periodConfig.customStartDate && periodConfig.customEndDate) {
        return `Periode ${periodConfig.customStartDate} s/d ${periodConfig.customEndDate}`;
      }
      return `Periode ${periodConfig.activePeriodYear || new Date().getFullYear()}`;
    }
    // calendar_year (1 Jan - 31 Des per tahun buku)
    const yr = periodConfig.activePeriodYear?.trim() || String(new Date().getFullYear());
    return yr.toLowerCase().startsWith('tahun') ? yr : `Tahun ${yr}`;
  }

  // payment_date mode (bergulir)
  const months = periodConfig.durationMonths || 12;
  return `Masa Aktif ${months} Bulan Bergulir`;
};

/**
 * Resolves the payment period displayed on the official receipt (Kwitansi),
 * ensuring it adheres strictly to the period determined in System Settings:
 *
 * 1. If System Settings defines a fixed period policy (fixed_period):
 *    - Follows the system settings period (e.g. "Tahun 2026", "Periode 2026/2027", etc.)
 *    - If the payment is a monthly payment with a specific month (e.g. "Agustus"),
 *      formats as: "Agustus 2026 (Periode Tahun 2026)".
 * 2. If System Settings defines rolling validity (payment_date):
 *    - If payment has periodMonth recorded, uses payment.periodMonth
 *    - Otherwise uses system period or payment year.
 * 3. Fallback to system period or current year.
 */
export const getEffectivePaymentPeriod = (
  payment?: Payment | null,
  settings?: SystemSettings
): string => {
  if (!payment) return getSystemConfiguredPeriod(settings);

  const periodConfig = settings?.membershipPeriod;

  // If system settings has a fixed period policy active
  if (periodConfig && periodConfig.mode === 'fixed_period') {
    const systemPeriod = getSystemConfiguredPeriod(settings);

    // If payment is monthly payment with specific month mentioned
    if (payment.paymentType === 'Iuran Bulanan' && payment.periodMonth) {
      const lower = payment.periodMonth.toLowerCase();
      const months = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
      const hasMonth = months.some(m => lower.includes(m));
      if (hasMonth && !lower.includes(systemPeriod.toLowerCase())) {
        return `${payment.periodMonth} (${systemPeriod})`;
      }
      return payment.periodMonth;
    }

    // For annual fee or standard payment: follow system settings period!
    return systemPeriod;
  }

  // If mode === 'payment_date' or default:
  if (payment.periodMonth && payment.periodMonth.trim()) {
    return payment.periodMonth.trim();
  }

  return getSystemConfiguredPeriod(settings);
};

/**
 * Generates a clean, official, beautifully structured WhatsApp receipt message in Indonesian.
 */
export const generateReceiptTextMessage = (
  payment: Payment,
  member?: Member | null,
  settings?: SystemSettings
): string => {
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian';
  const communityAddress = settings?.communityAddress || 'Sekretariat Pengurus Paguyuban Warga';
  const treasurerName = settings?.treasurerName || 'Bendahara Paguyuban';
  const treasurerPhone = settings?.treasurerPhone || '';
  const terbilangText = terbilang(payment.amount);
  const tanggalBayar = payment.verifiedAt || payment.createdAt;
  const clusterName = member?.cluster ? ` (Cluster: ${member.cluster})` : '';
  const effectivePeriod = getEffectivePaymentPeriod(payment, settings);

  return `*━━━━━━━━━━━━━━━━━━━━━━━━*
*🧾 KWITANSI PEMBAYARAN RESMI*
*${communityName.toUpperCase()}*
_${communityAddress}_
*━━━━━━━━━━━━━━━━━━━━━━━━*

Kepada Yth:
👤 *${payment.memberName}*${clusterName}
🆔 No. Pokok Anggota: *${payment.memberNumber}*
${member?.phone ? `📱 No. Terdaftar: *${member.phone}*\n` : ''}
*RINCIAN PEMBAYARAN:*
----------------------------------------
📄 *No. Kwitansi:* \`${payment.receiptNumber}\`
📅 *Tanggal & Waktu:* ${tanggalBayar}
📌 *Jenis Pembayaran:* *${payment.paymentType}*
🗓️ *Periode:* *${effectivePeriod}*
💳 *Metode Bayar:* ${payment.paymentMethod}

💰 *TOTAL NOMINAL DITERIMA:*
👉 *${formatIDR(payment.amount)}*
_(Terbilang: ${terbilangText})_

*STATUS TRANSAKSI:*
✅ *LUNAS & TERVERIFIKASI SISTEM*

*━━━━━━━━━━━━━━━━━━━━━━━━*
Terima kasih atas partisipasi dan kepedulian Bpk/Ibu dalam program Dana Kematian Paguyuban Warga. Semoga senantiasa diberikan keberkahan, kesehatan, dan lindungan dari Tuhan Yang Maha Esa.

Kwitansi ini diterbitkan secara otomatis dan sah sebagai dokumen bukti penerimaan iuran resmi paguyuban.

Salam hangat,
*Pengurus & Bendahara Paguyuban*
${treasurerName} ${treasurerPhone ? `(${treasurerPhone})` : ''}
*━━━━━━━━━━━━━━━━━━━━━━━━*`;
};

/**
 * Generates the direct WhatsApp Click-to-Chat URL targeting the member's registered phone number.
 */
export const generateReceiptWhatsAppUrl = (
  payment: Payment,
  member?: Member | null,
  settings?: SystemSettings,
  overridePhone?: string
): string => {
  const targetPhoneRaw = overridePhone || member?.phone || '';
  const internationalPhone = cleanPhoneNumberForWhatsApp(targetPhoneRaw);
  const message = generateReceiptTextMessage(payment, member, settings);
  const encodedMessage = encodeURIComponent(message);

  if (internationalPhone) {
    return `https://api.whatsapp.com/send?phone=${internationalPhone}&text=${encodedMessage}`;
  }
  // Fallback if no phone number available (opens WhatsApp web/app share picker)
  return `https://api.whatsapp.com/send?text=${encodedMessage}`;
};

/**
 * Builds a direct public verification URL for the receipt that can be scanned by any smartphone camera
 * and directly verified in the browser.
 */
export const buildReceiptValidationUrl = (receiptNumber: string): string => {
  let origin = '';
  let pathname = '';
  if (typeof window !== 'undefined' && window.location) {
    origin = window.location.origin || '';
    pathname = window.location.pathname || '';
  }
  if (!origin || origin === 'null') {
    origin = 'https://ais-dev-uyptcmfioftmxln6i3q2xc-667773144535.asia-east1.run.app';
  }
  const safeReceipt = encodeURIComponent((receiptNumber || '').trim());
  return `${origin}${pathname}?verify=receipt&receiptNumber=${safeReceipt}`;
};

/**
 * Generates the QR code payload for a receipt.
 * Returning the direct HTTP/HTTPS web verification URL allows standard smartphone cameras
 * (iOS Camera, Google Lens, Samsung Camera, WhatsApp Camera) to instantly display a clickable
 * verification link to the public authenticity verification page.
 */
export const generateReceiptQrPayload = (
  payment: Payment,
  _member?: Member | null,
  _settings?: SystemSettings
): string => {
  return buildReceiptValidationUrl(payment.receiptNumber);
};

/**
 * Parses receipt number from any scanned raw string, URL, or JSON payload.
 */
export const parseReceiptFromScannedPayload = (rawPayload: string): string => {
  const text = (rawPayload || '').trim();
  if (!text) return '';

  // 1. If it's a URL with ?verify=receipt&receiptNumber=...
  if (text.includes('receiptNumber=') || text.includes('receipt=') || text.includes('no=')) {
    try {
      const url = new URL(text.startsWith('http') ? text : `http://dummy.com/${text}`);
      const val = url.searchParams.get('receiptNumber') || url.searchParams.get('receipt') || url.searchParams.get('no');
      if (val) return decodeURIComponent(val).trim();
    } catch {
      const match = text.match(/(?:receiptNumber|receipt|no)=([^&]+)/i);
      if (match && match[1]) return decodeURIComponent(match[1]).trim();
    }
  }

  // 2. If it's JSON
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.receiptNumber || parsed.kwitansi || parsed.receipt) {
        return (parsed.receiptNumber || parsed.kwitansi || parsed.receipt).trim();
      }
    } catch {
      // ignore
    }
  }

  // 3. Raw receipt number format (e.g. KW-20261015-001)
  return text;
};
