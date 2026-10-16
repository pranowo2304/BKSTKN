import { Member, Payment, SystemSettings, WhatsAppNotificationLog, WhatsAppTriggerEvent } from '../types';
import { cleanPhoneNumberForWhatsApp, formatPhoneDisplay, getEffectivePaymentPeriod } from './receiptUtils';
import { formatIDR } from './storage';

const WHATSAPP_LOGS_STORAGE_KEY = 'adk_whatsapp_notification_logs';

/**
 * Retrieve saved WhatsApp notification logs from local storage.
 */
export function getWhatsAppLogs(): WhatsAppNotificationLog[] {
  try {
    const raw = localStorage.getItem(WHATSAPP_LOGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading WhatsApp notification logs:', e);
    return [];
  }
}

/**
 * Persist WhatsApp notification logs.
 */
export function saveWhatsAppLog(log: WhatsAppNotificationLog): void {
  try {
    const existing = getWhatsAppLogs();
    const updated = [log, ...existing.filter((item) => item.id !== log.id)].slice(0, 100);
    localStorage.setItem(WHATSAPP_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error saving WhatsApp notification log:', e);
  }
}

/**
 * Clear all WhatsApp notification logs.
 */
export function clearWhatsAppLogs(): void {
  try {
    localStorage.removeItem(WHATSAPP_LOGS_STORAGE_KEY);
  } catch (e) {
    console.warn('Error clearing WhatsApp notification logs:', e);
  }
}

/**
 * Creates a standard direct WhatsApp link (wa.me) for manual fallback.
 */
export function createDirectWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanPhoneNumberForWhatsApp(phone);
  if (!cleanPhone) return '';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds the official WhatsApp message when member status changes to 'Aktif' after payment is validated.
 */
export function buildPaymentValidatedActiveMessage(params: {
  member: Member;
  payment: Payment;
  settings: SystemSettings;
  verifierName?: string;
  expiryDateStr?: string;
  appUrl?: string;
}): string {
  const { member, payment, settings, verifierName, expiryDateStr, appUrl } = params;
  const currentUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://paguyuban-danakematian.id');
  const verifier = verifierName || payment.verifiedBy || settings.treasurerName || 'Bendahara Paguyuban';
  const phoneBendahara = settings.treasurerPhone || '0812-3456-7890';
  const cleanCluster = member.cluster || 'Wilayah Warga';

  return `*${settings.communityName.toUpperCase()}*
_Notifikasi Resmi Sistem Dana Kematian Warga_
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*STATUS KEPESERTAAN RESMI: AKTIF ✅*
*KARTU TANDA ANGGOTA (KTA) DIGITAL TELAH TERBIT*

Yth. Bapak/Ibu *${member.name}*,
Nomor Pokok Anggota (NPA): *${member.memberNumber}*
Wilayah / Cluster: *${cleanCluster}*

Alhamdulillah, kami informasikan bahwa pembayaran iuran Anda telah *BERHASIL DIVALIDASI* oleh Bendahara Paguyuban.

📋 *Rincian Validasi Pembayaran:*
• No. Kuitansi: *${payment.receiptNumber || 'KW-' + payment.id.substring(0, 8).toUpperCase()}*
• Jenis Iuran: *${payment.paymentType}*
• Periode: *${getEffectivePaymentPeriod(payment, settings)}*
• Jumlah Disahkan: *${formatIDR(payment.amount)}*
• Metode: *${payment.paymentMethod || 'Transfer Bank'}*
• Divalidasi Oleh: *${verifier}*
• Status Hak Perlindungan: *AKTIF (Masa Perlindungan Terpenuhi)*
${expiryDateStr ? `• Berlaku s.d.: *${expiryDateStr}*` : ''}

🪪 *KTA Digital Anda Telah Aktif:*
Kartu Tanda Anggota (KTA) Digital resmi dengan QR Code verifikasi dan rincian tanggungan keluarga kini dapat langsung Anda unduh & simpan melalui tautan berikut:
🔗 ${currentUrl}

_Pesan ini dikirimkan secara otomatis oleh Sistem Paguyuban Dana Kematian ${settings.communityName}. Terima kasih atas kepedulian dan partisipasi Anda dalam menjaga amanah kebersamaan warga._

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *Pusat Informasi & Bantuan:*
Bendahara: ${settings.treasurerName} (${phoneBendahara})
Alamat: ${settings.communityAddress || 'Sekretariat Paguyuban'}`;
}

/**
 * Builds notification message for RT verification result (Approved / Rejected).
 */
export function buildRtVerificationMessage(params: {
  member: Member;
  isApproved: boolean;
  settings: SystemSettings;
  rtName?: string;
  clusterName?: string;
  notes?: string;
  appUrl?: string;
}): string {
  const { member, isApproved, settings, rtName, clusterName, notes, appUrl } = params;
  const currentUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://paguyuban-danakematian.id');
  const verifier = rtName || member.verifiedByRt || 'Ketua RT Setempat';
  const cluster = clusterName || member.cluster || 'Cluster Warga';

  if (isApproved) {
    const annualAmount = settings.annualFeeAmount || 300000;
    const bankList = settings.bankAccounts && settings.bankAccounts.length > 0
      ? settings.bankAccounts.map((b) => `• *${b.bankName}*: ${b.accountNumber} (a.n. ${b.accountHolder})`).join('\n')
      : '• Hubungi Bendahara untuk nomor rekening kas resmi.';

    return `*${settings.communityName.toUpperCase()}*
_Notifikasi Verifikasi Pendaftaran Anggota_
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*STATUS: VERIFIKASI RT DISETUJUI ✅*

Yth. Bapak/Ibu *${member.name}*,
Pendaftaran Anda untuk *${cluster}* telah diverifikasi dan *DISETUJUI* oleh Ketua RT (${verifier}).

📌 *Langkah Selanjutnya (Aktivasi KTA):*
Untuk mengaktifkan status kepesertaan penuh dan menerbitkan Kartu Tanda Anggota (KTA) Digital, silakan lakukan pembayaran iuran tahunan sebesar:
💰 *${formatIDR(annualAmount)} / tahun*

🏦 *Rekening Resmi Kas Paguyuban:*
${bankList}

Setelah melakukan transfer, silakan unggah bukti pembayaran melalui Portal Anggota:
🔗 ${currentUrl}

${notes ? `_Catatan Ketua RT:_ "${notes}"\n` : ''}
Terima kasih atas partisipasi Anda dalam Paguyuban Dana Kematian.`;
  } else {
    return `*${settings.communityName.toUpperCase()}*
_Notifikasi Verifikasi Pendaftaran Anggota_
━━━━━━━━━━━━━━━━━━━━━━━━━━━

*STATUS: PENDAFTARAN MEMERLUKAN PERBAIKAN ⚠️*

Yth. Bapak/Ibu *${member.name}*,
Pendaftaran keanggotaan Anda di *${cluster}* belum dapat disetujui oleh Ketua RT (${verifier}).

${notes ? `📝 *Alasan / Catatan:* "${notes}"\n` : ''}
Silakan periksa kembali kelengkapan data dokumen Kartu Keluarga (KK) atau hubungi Ketua RT setempat untuk konfirmasi lebih lanjut.`;
  }
}

/**
 * Builds general member status change message.
 */
export function buildGeneralStatusChangeMessage(params: {
  member: Member;
  newStatus: string;
  settings: SystemSettings;
  notes?: string;
}): string {
  const { member, newStatus, settings, notes } = params;
  return `*${settings.communityName.toUpperCase()}*
_Pemberitahuan Perubahan Status Keanggotaan_
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Yth. Bapak/Ibu *${member.name}* (NPA: *${member.memberNumber}*),
Kami informasikan bahwa status keanggotaan Anda saat ini telah diperbarui menjadi:

📌 *STATUS SAAT INI: ${newStatus.toUpperCase()}*
${notes ? `_Keterangan:_ ${notes}\n` : ''}
Untuk informasi lebih lengkap mengenai hak santunan dan kewajiban iuran, silakan hubungi pengurus atau periksa melalui Portal Anggota.

Salam hormat,
*Pengurus Paguyuban Dana Kematian*`;
}

/**
 * Core function to dispatch a WhatsApp message via API gateway or fallback link.
 */
export async function dispatchWhatsAppNotification(params: {
  phone: string;
  recipientName: string;
  memberNumber: string;
  message: string;
  triggerType: WhatsAppTriggerEvent;
  settings: SystemSettings;
}): Promise<WhatsAppNotificationLog> {
  const { phone, recipientName, memberNumber, message, triggerType, settings } = params;
  const cleanPhone = cleanPhoneNumberForWhatsApp(phone);
  const directLink = createDirectWhatsAppLink(phone, message);
  const now = new Date().toISOString();
  const logId = `wa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Default provider is Fonnte if not specified
  const provider = settings.whatsappProvider || 'fonnte';
  const token = settings.whatsappApiToken?.trim() || '';
  const isEnabled = settings.whatsappApiEnabled !== false; // enabled by default

  // If no clean phone number exists
  if (!cleanPhone) {
    const errorLog: WhatsAppNotificationLog = {
      id: logId,
      recipientPhone: phone || '-',
      recipientName,
      memberNumber,
      status: 'failed',
      triggerType,
      message,
      timestamp: now,
      provider,
      responseInfo: 'Nomor HP anggota tidak valid atau kosong',
    };
    saveWhatsAppLog(errorLog);
    return errorLog;
  }

  // If WhatsApp API is disabled or provider is direct_link or token is empty
  if (!isEnabled || provider === 'direct_link' || !token) {
    const fallbackLog: WhatsAppNotificationLog = {
      id: logId,
      recipientPhone: cleanPhone,
      recipientName,
      memberNumber,
      status: 'fallback_ready',
      triggerType,
      message,
      timestamp: now,
      provider: !token ? `${provider} (Belum Ada Token API)` : provider,
      responseInfo: !token
        ? 'Token API belum dikonfigurasi. Tautan WhatsApp manual siap dikirim.'
        : 'Mode Direct Link aktif. Pesan siap diteruskan ke WhatsApp.',
      directWaLink: directLink,
    };
    saveWhatsAppLog(fallbackLog);
    return fallbackLog;
  }

  // Execute real API call based on provider
  try {
    let endpoint = settings.whatsappApiEndpoint?.trim();
    let response: Response;

    if (provider === 'fonnte') {
      endpoint = endpoint || 'https://api.fonnte.com/send';
      // Fonnte supports FormData or URLSearchParams or JSON
      const formData = new FormData();
      formData.append('target', cleanPhone);
      formData.append('message', message);
      if (settings.whatsappCustomFooter) {
        formData.append('footer', settings.whatsappCustomFooter);
      }

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: formData,
      });
    } else if (provider === 'waha') {
      endpoint = endpoint || 'http://localhost:3000/api/sendText';
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': token,
        },
        body: JSON.stringify({
          chatId: `${cleanPhone}@c.us`,
          text: message,
          session: 'default',
        }),
      });
    } else {
      // Custom Webhook
      endpoint = endpoint || 'https://httpbin.org/post';
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          recipientName,
          memberNumber,
          message,
          triggerType,
          timestamp: now,
        }),
      });
    }

    const resData = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(resData);
    } catch {
      parsed = resData;
    }

    const isSuccess = response.ok && (
      typeof parsed === 'object' && parsed !== null
        ? parsed.status === true || parsed.status === 'success' || parsed.success === true || response.status === 200
        : response.status === 200
    );

    const log: WhatsAppNotificationLog = {
      id: logId,
      recipientPhone: cleanPhone,
      recipientName,
      memberNumber,
      status: isSuccess ? 'sent' : 'fallback_ready',
      triggerType,
      message,
      timestamp: now,
      provider,
      responseInfo: typeof parsed === 'object' ? JSON.stringify(parsed).substring(0, 200) : String(resData).substring(0, 200),
      directWaLink: directLink,
    };

    saveWhatsAppLog(log);
    return log;
  } catch (error: any) {
    console.warn('WhatsApp API request encountered network/CORS error, fallback to direct link:', error);
    const log: WhatsAppNotificationLog = {
      id: logId,
      recipientPhone: cleanPhone,
      recipientName,
      memberNumber,
      status: 'fallback_ready',
      triggerType,
      message,
      timestamp: now,
      provider,
      responseInfo: `Gagal kirim via gateway (${error?.message || 'Network/CORS error'}). Tautan manual wa.me siap digunakan.`,
      directWaLink: directLink,
    };
    saveWhatsAppLog(log);
    return log;
  }
}

/**
 * Test WhatsApp API connection by sending a sample verification message.
 */
export async function testWhatsAppApiConnection(params: {
  testPhone: string;
  settings: SystemSettings;
}): Promise<{ success: boolean; message: string; log?: WhatsAppNotificationLog; directLink?: string }> {
  const { testPhone, settings } = params;
  const clean = cleanPhoneNumberForWhatsApp(testPhone);

  if (!clean || clean.length < 9) {
    return {
      success: false,
      message: 'Nomor WhatsApp uji coba tidak valid (minimal 9 digit, e.g. 08123456789).',
    };
  }

  const testMessage = `*PAGUYUBAN DANA KEMATIAN WARGA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
*UJI KONEKSI WHATSAPP API GATEWAY BERHASIL ✅*

Pesan ini adalah verifikasi bahwa integrasi WhatsApp API pada sistem ${settings.communityName} telah terhubung dengan baik.

• Waktu Pengujian: ${new Date().toLocaleString('id-ID')}
• Provider: ${settings.whatsappProvider || 'fonnte'}
• Nomor Tujuan: +${clean}

Notifikasi otomatis ke anggota (pembayaran valid, KTA terbit, dan verifikasi RT) siap beroperasi secara otomatis.`;

  const log = await dispatchWhatsAppNotification({
    phone: clean,
    recipientName: 'Uji Coba Pengurus',
    memberNumber: 'TEST-SYS',
    message: testMessage,
    triggerType: 'test_message',
    settings,
  });

  if (log.status === 'sent') {
    return {
      success: true,
      message: `Pesan uji coba WhatsApp berhasil dikirim ke nomor +${clean}!`,
      log,
      directLink: log.directWaLink,
    };
  } else {
    return {
      success: false,
      message: log.responseInfo || 'Tidak dapat mengirim pesan otomatis via API. Tautan WhatsApp manual tetap tersedia.',
      log,
      directLink: log.directWaLink,
    };
  }
}
