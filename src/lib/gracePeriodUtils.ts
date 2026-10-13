import { Payment, Member, SystemSettings } from '../types';

export interface PendingGracePeriodInfo {
  paymentId: string;
  daysPending: number;
  isExceedingGracePeriod: boolean; // daysPending >= 30
  isApproachingGracePeriod: boolean; // 20 <= daysPending < 30
  daysOverdue: number; // Math.max(0, daysPending - 30)
  graceDeadlineDate: Date;
  graceDeadlineFormatted: string;
  createdAtDate: Date;
  createdAtFormatted: string;
  statusSeverity: 'critical' | 'warning' | 'normal' | 'resolved';
  badgeLabel: string;
}

export interface PaymentWithGraceInfo {
  payment: Payment;
  graceInfo: PendingGracePeriodInfo;
}

/**
 * Robust date parser supporting "YYYY-MM-DD HH:mm:ss", ISO strings, and standard date strings.
 */
export const parsePaymentDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  try {
    const normalized = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr;
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) return parsed;
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  } catch {
    return new Date();
  }
};

/**
 * Calculates whether a pending payment has exceeded the 30-day grace period.
 */
export const calculatePendingGracePeriod = (
  payment: Payment,
  referenceDateInput: Date | string | number = new Date()
): PendingGracePeriodInfo => {
  let referenceDate: Date;
  if (referenceDateInput instanceof Date && !isNaN(referenceDateInput.getTime())) {
    referenceDate = referenceDateInput;
  } else if (typeof referenceDateInput === 'string' && !isNaN(new Date(referenceDateInput).getTime())) {
    referenceDate = new Date(referenceDateInput);
  } else if (typeof referenceDateInput === 'number' && referenceDateInput > 100000000000) {
    referenceDate = new Date(referenceDateInput);
  } else {
    referenceDate = new Date();
  }

  const createdAtDate = parsePaymentDate(payment.createdAt);
  const diffTime = referenceDate.getTime() - createdAtDate.getTime();
  const rawDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const daysPending = Math.max(0, rawDays);

  const graceDeadlineDate = new Date(createdAtDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const graceDeadlineFormatted = graceDeadlineDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const createdAtFormatted = createdAtDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (payment.status !== 'Pending') {
    return {
      paymentId: payment.id,
      daysPending: 0,
      isExceedingGracePeriod: false,
      isApproachingGracePeriod: false,
      daysOverdue: 0,
      graceDeadlineDate,
      graceDeadlineFormatted,
      createdAtDate,
      createdAtFormatted,
      statusSeverity: 'resolved',
      badgeLabel: payment.status === 'Verified' ? 'Terverifikasi Lunas' : 'Ditolak',
    };
  }

  const isExceedingGracePeriod = daysPending >= 30;
  const isApproachingGracePeriod = daysPending >= 20 && daysPending < 30;
  const daysOverdue = Math.max(0, daysPending - 30);

  let statusSeverity: PendingGracePeriodInfo['statusSeverity'] = 'normal';
  let badgeLabel = `${daysPending} hari menunggu`;

  if (isExceedingGracePeriod) {
    statusSeverity = 'critical';
    badgeLabel = daysOverdue > 0 
      ? `🚨 Lewat Masa Tenggang +${daysOverdue} Hari (${daysPending}h)`
      : `🚨 Batas Masa Tenggang 30 Hari`;
  } else if (isApproachingGracePeriod) {
    statusSeverity = 'warning';
    badgeLabel = `⚠️ Mendekati Batas (Sisa ${30 - daysPending} hari)`;
  }

  return {
    paymentId: payment.id,
    daysPending,
    isExceedingGracePeriod,
    isApproachingGracePeriod,
    daysOverdue,
    graceDeadlineDate,
    graceDeadlineFormatted,
    createdAtDate,
    createdAtFormatted,
    statusSeverity,
    badgeLabel,
  };
};

/**
 * Returns all pending payments with attached grace period calculation.
 */
export const getPaymentsWithGraceInfo = (
  payments: Payment[] = [],
  referenceDate: Date = new Date()
): PaymentWithGraceInfo[] => {
  return payments.map((p) => ({
    payment: p,
    graceInfo: calculatePendingGracePeriod(p, referenceDate),
  }));
};

/**
 * Returns summary statistics for Bendahara regarding the 30-day grace period.
 */
export const getGracePeriodSummary = (
  payments: Payment[] = [],
  referenceDate: Date = new Date()
) => {
  const pendingPayments = payments.filter((p) => p.status === 'Pending');
  const itemsWithGrace = pendingPayments.map((p) => ({
    payment: p,
    graceInfo: calculatePendingGracePeriod(p, referenceDate),
  }));

  const overdueItems = itemsWithGrace
    .filter((item) => item.graceInfo.isExceedingGracePeriod)
    .sort((a, b) => b.graceInfo.daysPending - a.graceInfo.daysPending);

  const approachingItems = itemsWithGrace
    .filter((item) => item.graceInfo.isApproachingGracePeriod)
    .sort((a, b) => b.graceInfo.daysPending - a.graceInfo.daysPending);

  const normalItems = itemsWithGrace.filter(
    (item) => !item.graceInfo.isExceedingGracePeriod && !item.graceInfo.isApproachingGracePeriod
  );

  const overdueTotalAmount = overdueItems.reduce((sum, item) => sum + item.payment.amount, 0);
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalPendingCount: pendingPayments.length,
    totalPendingAmount,
    overdueCount: overdueItems.length,
    overdueTotalAmount,
    approachingCount: approachingItems.length,
    normalCount: normalItems.length,
    hasOverdue: overdueItems.length > 0,
    hasApproaching: approachingItems.length > 0,
    overdueItems,
    approachingItems,
    normalItems,
  };
};

/**
 * Builds a direct WhatsApp follow-up link for the Bendahara to reach out to a member
 * whose pending payment submission has exceeded the 30-day grace period.
 */
export const generateGracePeriodWhatsAppUrl = (
  payment: Payment,
  member?: Member,
  graceInfo?: PendingGracePeriodInfo,
  settings?: SystemSettings
): string => {
  const phone = member?.phone || '';
  const phoneClean = phone.replace(/[^0-9]/g, '');
  if (!phoneClean) return '';

  const internationalPhone = phoneClean.startsWith('0')
    ? '62' + phoneClean.substring(1)
    : phoneClean.startsWith('62')
    ? phoneClean
    : '62' + phoneClean;

  const communityName = settings?.communityName || 'Paguyuban Dana Kematian';
  const treasurerName = settings?.treasurerName || 'Bendahara Paguyuban';
  const amountFormatted = `Rp ${payment.amount.toLocaleString('id-ID')}`;
  const daysText = graceInfo ? `${graceInfo.daysPending} hari` : 'lebih dari 30 hari';
  const overdueText = graceInfo && graceInfo.daysOverdue > 0 ? `(terlewat ${graceInfo.daysOverdue} hari)` : '';

  const message = `*Pemberitahuan Khusus Bendahara — ${communityName}*

Yth. Bpk/Ibu *${payment.memberName}*
No. Anggota: *${payment.memberNumber}*

Semoga Bpk/Ibu dan keluarga senantiasa dalam keadaan sehat.

Kami dari Tim Bendahara Paguyuban ingin mengonfirmasi perihal pengajuan bukti pembayaran iuran Anda:
📄 *Jenis Transaksi:* ${payment.paymentType} (${payment.periodMonth})
💰 *Nominal:* ${amountFormatted}
🏦 *Metode:* ${payment.paymentMethod}
📅 *Waktu Pengajuan:* ${payment.createdAt}
⚠️ *Status Antrean:* Menunggu konfirmasi / validasi *${daysText}* ${overdueText}

Status ini telah melampaui batas masa tenggang 30 hari (*30-Day Grace Period*). Agar pencatatan kas resmi selesai dan perlindungan hak santunan duka keluarga tetap aktif tanpa kendala, mohon kesediaan Bpk/Ibu untuk memverifikasi ulang mutasi rekening atau mengirimkan ulang konfirmasi transfer yang jelas.

Terima kasih atas kerja sama dan pengertian Bpk/Ibu. 🙏

Salam hormat,
*${treasurerName}*
Bendahara ${communityName}`;

  return `https://api.whatsapp.com/send?phone=${internationalPhone}&text=${encodeURIComponent(message)}`;
};
