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
🗓️ *Periode:* *${payment.periodMonth}*
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
 * Builds a direct verification URL for the receipt that can be scanned by authorities
 * and directly verified in the browser.
 */
export const buildReceiptValidationUrl = (receiptNumber: string): string => {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
  const safeReceipt = encodeURIComponent(receiptNumber || '');
  return `${origin}${pathname}?verify=receipt&receiptNumber=${safeReceipt}`;
};

/**
 * Generates the structured QR code verification payload for a receipt.
 * Includes both direct web validation URL (for camera scanning) and JSON verification metadata.
 */
export const generateReceiptQrPayload = (
  payment: Payment,
  member?: Member | null,
  _settings?: SystemSettings
): string => {
  const validationUrl = buildReceiptValidationUrl(payment.receiptNumber);

  return JSON.stringify({
    app: 'KWITANSI-PAGUYUBAN',
    verifyUrl: validationUrl,
    npa: payment.memberNumber,
    nama: payment.memberName,
    kwitansi: payment.receiptNumber,
    periode: payment.periodMonth,
    nominal: payment.amount,
    status: 'LUNAS',
    cluster: member?.cluster || '—',
    tgl: payment.verifiedAt || payment.createdAt,
    v: 1,
  });
};
