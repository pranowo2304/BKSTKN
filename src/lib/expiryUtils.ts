import { Member, Payment, SystemSettings, MembershipPeriodSettings } from '../types';
import { getStoredSettings } from './storage';

export interface MemberAnnualExpiryInfo {
  memberId: string;
  expiryDate: Date;
  expiryDateFormatted: string; // e.g. "10 Sep 2026"
  daysRemaining: number;
  isExpiringSoon: boolean; // 0 < daysRemaining <= 30
  isExpired: boolean; // daysRemaining <= 0
  isInGracePeriod?: boolean; // Dalam masa tenggang toleransi pengurus
  status: 'active' | 'expiring_soon' | 'expired' | 'pending_verification' | 'deceased' | 'inactive';
  statusLabel: string;
  lastPayment?: Payment;
  lastVerifiedPayment?: Payment;
  coverageYear?: string;
  periodMode: 'payment_date' | 'fixed_period';
  policyDescription: string;
}

/**
 * Calculates annual membership expiration date and days remaining based on verified payments or join date,
 * adhering to the admin-configured membership period policy:
 * 1. 'payment_date': Calculated dynamically from payment/join date (e.g. 1 year / 12 months rolling).
 * 2. 'fixed_period': Calculated based on fixed policy determined by management (e.g. Calendar Year 1 Jan - 31 Dec or Custom Range).
 */
export const calculateMemberExpiry = (
  member: Member,
  payments: Payment[] = [],
  referenceDateInput: Date | string | number = new Date(),
  customSettings?: SystemSettings
): MemberAnnualExpiryInfo => {
  // Retrieve settings (from argument or stored settings fallback)
  const currentSettings = customSettings || (typeof window !== 'undefined' ? getStoredSettings() : undefined);
  const periodConfig: MembershipPeriodSettings = currentSettings?.membershipPeriod || {
    mode: 'payment_date',
    durationMonths: 12,
    durationDays: 365,
    fixedType: 'calendar_year',
    activePeriodYear: '2026',
    customStartDate: '2026-01-01',
    customEndDate: '2026-12-31',
    allowGracePeriodDays: 14,
  };

  // Safely normalize referenceDate
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

  // If member is deceased
  if (member.status === 'Meninggal') {
    return {
      memberId: member.id,
      expiryDate: new Date(member.joinDate || referenceDate),
      expiryDateFormatted: '-',
      daysRemaining: 999,
      isExpiringSoon: false,
      isExpired: false,
      status: 'deceased',
      statusLabel: 'Meninggal Dunia',
      periodMode: periodConfig.mode,
      policyDescription: 'Status anggota telah meninggal dunia.',
    };
  }

  // If member is waiting for RT verification
  if (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending') {
    return {
      memberId: member.id,
      expiryDate: new Date(member.joinDate || referenceDate),
      expiryDateFormatted: '-',
      daysRemaining: 999,
      isExpiringSoon: false,
      isExpired: false,
      status: 'pending_verification',
      statusLabel: 'Menunggu Verifikasi RT',
      periodMode: periodConfig.mode,
      policyDescription: 'Menunggu persetujuan data dari Ketua RT.',
    };
  }

  // If rejected or inactive
  if (member.status === 'Ditolak' || member.verificationStatus === 'Rejected' || member.status === 'Non-Aktif') {
    return {
      memberId: member.id,
      expiryDate: new Date(member.joinDate || referenceDate),
      expiryDateFormatted: '-',
      daysRemaining: 0,
      isExpiringSoon: false,
      isExpired: true,
      status: 'inactive',
      statusLabel: member.status === 'Ditolak' ? 'Ditolak RT' : 'Non-Aktif',
      periodMode: periodConfig.mode,
      policyDescription: 'Keanggotaan tidak aktif.',
    };
  }

  // Filter verified payments for this member
  const verifiedPayments = payments.filter(
    (p) => (p.memberId === member.id || p.memberNumber === member.memberNumber) && p.status === 'Verified'
  );

  // Find verified annual payments
  const verifiedAnnualPayments = verifiedPayments.filter(
    (p) => p.paymentType === 'Iuran Tahunan' || p.paymentType === 'Iuran Bulanan'
  );

  // Sort verified payments descending
  const sortedPayments = [...verifiedAnnualPayments].sort((a, b) => {
    const dateA = new Date(a.verifiedAt || a.createdAt).getTime();
    const dateB = new Date(b.verifiedAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  const lastPayment = sortedPayments[0] || verifiedPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  let expiryDate: Date;
  let coverageYear = '';
  let policyDescription = '';

  // -------------------------------------------------------------
  // BRANCH 1: Berdasarkan Periode Tertentu yang Diberlakukan Pengurus
  // -------------------------------------------------------------
  if (periodConfig.mode === 'fixed_period') {
    if (periodConfig.fixedType === 'custom_range') {
      // 1B. Custom Range yang ditentukan pengurus (e.g. 2026-01-01 s/d 2026-12-31)
      const endDateStr = periodConfig.customEndDate || `${referenceDate.getFullYear()}-12-31`;
      expiryDate = new Date(`${endDateStr}T23:59:59`);
      coverageYear = periodConfig.customPeriodName || periodConfig.activePeriodYear || `${referenceDate.getFullYear()}`;
      policyDescription = `Periode Kebijakan Pengurus: ${coverageYear} (${periodConfig.customStartDate || 'Awal'} s/d ${endDateStr})`;
    } else {
      // 1A. Calendar Year (1 Januari - 31 Desember per tahun buku iuran)
      // Periksa tahun tertinggi yang telah dibayar atau tahun aktif pengurus
      const paidYears: number[] = [];
      verifiedAnnualPayments.forEach((p) => {
        if (p.periodYear && !isNaN(Number(p.periodYear))) {
          paidYears.push(Number(p.periodYear));
        } else if (p.periodMonth) {
          const match = p.periodMonth.match(/\b(20\d\d)\b/);
          if (match) paidYears.push(Number(match[0]));
        } else {
          const dt = new Date(p.verifiedAt || p.createdAt);
          if (!isNaN(dt.getTime())) paidYears.push(dt.getFullYear());
        }
      });

      let targetYear = referenceDate.getFullYear();
      if (paidYears.length > 0) {
        targetYear = Math.max(...paidYears);
      } else if (periodConfig.activePeriodYear && !isNaN(Number(periodConfig.activePeriodYear))) {
        targetYear = Number(periodConfig.activePeriodYear);
      } else if (member.joinDate) {
        targetYear = new Date(member.joinDate).getFullYear();
      }

      // Berakhir seragam pada 31 Desember tahun kalender terkait
      expiryDate = new Date(targetYear, 11, 31, 23, 59, 59);
      coverageYear = String(targetYear);
      policyDescription = `Periode Tahun Kalender Pengurus: 1 Jan - 31 Des ${targetYear}`;
    }
  } else {
    // -------------------------------------------------------------
    // BRANCH 2: Berdasarkan Tanggal Pembayaran (Rolling Validity)
    // -------------------------------------------------------------
    const monthsToAdd = periodConfig.durationMonths && periodConfig.durationMonths > 0 ? periodConfig.durationMonths : 12;

    if (lastPayment) {
      const payDateStr = lastPayment.verifiedAt || lastPayment.createdAt;
      const basePayDate = new Date(payDateStr);
      expiryDate = new Date(basePayDate);
      expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);

      if (lastPayment.periodYear) {
        coverageYear = lastPayment.periodYear;
      } else if (lastPayment.periodMonth) {
        const match = lastPayment.periodMonth.match(/\d{4}/);
        if (match) coverageYear = match[0];
      }
    } else {
      // If no payment record yet, base on joinDate + configured duration
      const joinDateObj = new Date(member.joinDate || referenceDate);
      expiryDate = new Date(joinDateObj);
      expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);
    }

    policyDescription = `Dihitung ${monthsToAdd} bulan bergulir dari tanggal transaksi pembayaran`;
  }

  // Calculate days remaining
  const diffTime = expiryDate.getTime() - referenceDate.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const expiryDateFormatted = expiryDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const graceDays = periodConfig.allowGracePeriodDays || 0;
  const isInGracePeriod = daysRemaining <= 0 && Math.abs(daysRemaining) <= graceDays;
  const isExpired = daysRemaining <= 0 && !isInGracePeriod;
  const isExpiringSoon = (daysRemaining > 0 && daysRemaining <= 30) || isInGracePeriod;

  let status: MemberAnnualExpiryInfo['status'] = 'active';
  let statusLabel = `Aktif s/d ${expiryDateFormatted}`;

  if (isInGracePeriod) {
    status = 'expiring_soon';
    statusLabel = `Tenggang Pengurus (${graceDays - Math.abs(daysRemaining)} hari lagi)`;
  } else if (isExpired) {
    status = 'expired';
    statusLabel = `Jatuh Tempo (${Math.abs(daysRemaining)} hari lalu)`;
  } else if (isExpiringSoon) {
    status = 'expiring_soon';
    statusLabel = `Segera Habis (${daysRemaining} hari lagi)`;
  }

  return {
    memberId: member.id,
    expiryDate,
    expiryDateFormatted,
    daysRemaining,
    isExpiringSoon,
    isExpired,
    isInGracePeriod,
    status,
    statusLabel,
    lastPayment,
    coverageYear,
    periodMode: periodConfig.mode,
    policyDescription,
  };
};

/**
 * Builds a direct WhatsApp click-to-chat URL with pre-filled professional message for early outreach.
 */
export const generateOutreachWhatsAppUrl = (
  member: Member,
  expiryInfo: MemberAnnualExpiryInfo,
  settings?: { communityName?: string; treasurerName?: string; treasurerPhone?: string; annualFeeAmount?: number }
): string => {
  const phoneClean = member.phone.replace(/[^0-9]/g, '');
  const internationalPhone = phoneClean.startsWith('0')
    ? '62' + phoneClean.substring(1)
    : phoneClean.startsWith('62')
    ? phoneClean
    : '62' + phoneClean;

  const communityName = settings?.communityName || 'Paguyuban Dana Kematian';
  const annualFee = settings?.annualFeeAmount 
    ? `Rp ${settings.annualFeeAmount.toLocaleString('id-ID')}` 
    : 'Rp 300.000';
  
  const daysText = expiryInfo.daysRemaining > 0 
    ? `tersisa *${expiryInfo.daysRemaining} hari lagi*` 
    : 'telah *jatuh tempo*';

  const message = `*Pemberitahuan Iuran Tahunan — ${communityName}*

Yth. Bpk/Ibu *${member.name}*
No. Anggota: *${member.memberNumber}*
Cluster: *${member.cluster || '-'}*

Semoga Bpk/Ibu dan keluarga senantiasa dalam keadaan sehat walafiat.

Melalui pesan ini, kami dari Pengurus Paguyuban menginformasikan bahwa masa perlindungan *Iuran Tahunan Dana Kematian* Anda akan berakhir pada:
📅 *Batas Masa Aktif:* ${expiryInfo.expiryDateFormatted} (${daysText})
💰 *Nominal Iuran Tahunan:* ${annualFee} / tahun (12 Bulan)

Agar hak santunan duka dan fardhu kifayah bagi anggota keluarga tetap aktif dan terlindungi tanpa jeda, mohon kiranya dapat melakukan perpanjangan iuran tahunan.

Pembayaran dapat ditransfer via rekening paguyuban atau melalui Pengurus/Ketua RT cluster setempat.

Terima kasih atas kerja sama dan kepedulian Bpk/Ibu dalam menjaga kebersamaan paguyuban warga. 🙏

Salam hormat,
*Pengurus Paguyuban Dana Kematian*
${settings?.treasurerName ? `(Bendahara: ${settings.treasurerName})` : ''}`;

  return `https://api.whatsapp.com/send?phone=${internationalPhone}&text=${encodeURIComponent(message)}`;
};

/**
 * Generates plain copyable text message for outreach.
 */
export const generateOutreachTextMessage = (
  member: Member,
  expiryInfo: MemberAnnualExpiryInfo,
  settings?: { communityName?: string; treasurerName?: string; treasurerPhone?: string; annualFeeAmount?: number }
): string => {
  const communityName = settings?.communityName || 'Paguyuban Dana Kematian';
  const annualFee = settings?.annualFeeAmount 
    ? `Rp ${settings.annualFeeAmount.toLocaleString('id-ID')}` 
    : 'Rp 300.000';

  const daysText = expiryInfo.daysRemaining > 0 
    ? `tersisa ${expiryInfo.daysRemaining} hari lagi` 
    : 'telah jatuh tempo';

  return `Pemberitahuan Iuran Tahunan — ${communityName}

Yth. Bpk/Ibu ${member.name} (No. Anggota: ${member.memberNumber})
Cluster: ${member.cluster || '-'}

Semoga Bpk/Ibu dan keluarga senantiasa dalam keadaan sehat.

Kami dari Pengurus Paguyuban menginformasikan bahwa masa berlaku Iuran Tahunan keanggotaan Anda akan berakhir pada:
- Batas Masa Aktif: ${expiryInfo.expiryDateFormatted} (${daysText})
- Nominal Iuran Tahunan: ${annualFee} / tahun (12 Bulan)

Agar hak santunan duka bagi keluarga tetap terlindungi, mohon kiranya melakukan perpanjangan iuran tahunan.

Pembayaran dapat ditransfer via rekening paguyuban atau konfirmasi kepada pengurus/Ketua RT cluster.

Terima kasih atas kerja sama Bapak/Ibu.

Pengurus ${communityName}`;
};

export interface Expiring7DaysItem {
  member: Member;
  expiryInfo: MemberAnnualExpiryInfo;
}

export interface Expiring7DaysSummary {
  expiringMembers: Expiring7DaysItem[];
  expiringCount: number;
  totalAmountDue: number;
  overdueMembers: Expiring7DaysItem[];
  overdueCount: number;
  hasExpiring: boolean;
  earliestExpiringMember?: Expiring7DaysItem;
  clustersBreakdown: { cluster: string; count: number }[];
}

/**
 * Summarizes members whose annual dues are expiring within the next 7 days (0 < daysRemaining <= 7),
 * as well as overdue members, for admin dashboard login toast notification.
 */
export const getExpiringWithin7DaysSummary = (
  members: Member[],
  payments: Payment[],
  referenceDate: Date = new Date(),
  annualFee: number = 300000
): Expiring7DaysSummary => {
  const activeOrVerified = members.filter(
    (m) =>
      (m.status === 'Aktif' || m.verificationStatus === 'Verified') &&
      m.status !== 'Meninggal' &&
      m.status !== 'Non-Aktif' &&
      m.status !== 'Ditolak'
  );

  const expiringMembers: Expiring7DaysItem[] = [];
  const overdueMembers: Expiring7DaysItem[] = [];

  activeOrVerified.forEach((member) => {
    const expiryInfo = calculateMemberExpiry(member, payments, referenceDate);

    // Dues expiring strictly within 7 days (e.g. 1, 2, 3, 4, 5, 6, 7 days remaining or today: 0)
    if (expiryInfo.daysRemaining >= 0 && expiryInfo.daysRemaining <= 7) {
      expiringMembers.push({ member, expiryInfo });
    } else if (expiryInfo.daysRemaining < 0) {
      overdueMembers.push({ member, expiryInfo });
    }
  });

  // Sort upcoming expiring members by days remaining ascending (e.g. 1 day first, then 2, etc.)
  expiringMembers.sort((a, b) => a.expiryInfo.daysRemaining - b.expiryInfo.daysRemaining);
  overdueMembers.sort((a, b) => a.expiryInfo.daysRemaining - b.expiryInfo.daysRemaining);

  const clusterMap: Record<string, number> = {};
  expiringMembers.forEach((item) => {
    const cl = item.member.cluster || 'Cluster Lainnya';
    clusterMap[cl] = (clusterMap[cl] || 0) + 1;
  });

  const clustersBreakdown = Object.entries(clusterMap).map(([cluster, count]) => ({
    cluster,
    count,
  }));

  const expiringCount = expiringMembers.length;
  const overdueCount = overdueMembers.length;

  return {
    expiringMembers,
    expiringCount,
    totalAmountDue: expiringCount * annualFee,
    overdueMembers,
    overdueCount,
    hasExpiring: expiringCount > 0,
    earliestExpiringMember: expiringMembers[0],
    clustersBreakdown,
  };
};

/**
 * Generates an urgent, polite 7-day reminder WhatsApp message link.
 */
export const generate7DayReminderWhatsAppUrl = (
  member: Member,
  expiryInfo: MemberAnnualExpiryInfo,
  settings?: { communityName?: string; treasurerName?: string; treasurerPhone?: string; annualFeeAmount?: number }
): string => {
  const phoneClean = member.phone.replace(/[^0-9]/g, '');
  const internationalPhone = phoneClean.startsWith('0')
    ? '62' + phoneClean.substring(1)
    : phoneClean.startsWith('62')
    ? phoneClean
    : '62' + phoneClean;

  const communityName = settings?.communityName || 'Paguyuban Dana Kematian';
  const annualFee = settings?.annualFeeAmount
    ? `Rp ${settings.annualFeeAmount.toLocaleString('id-ID')}`
    : 'Rp 300.000';

  const countdownText =
    expiryInfo.daysRemaining === 0
      ? 'HARI INI'
      : `${expiryInfo.daysRemaining} HARI LAGI`;

  const message = `🔔 *Pemberitahuan Jatuh Tempo Iuran — ${communityName}*

Yth. Bpk/Ibu *${member.name}*
No. Anggota: *${member.memberNumber}*
Cluster: *${member.cluster || '-'}*

Semoga Bapak/Ibu sekeluarga selalu dalam perlindungan Tuhan YME.

Kami dari Pengurus menginformasikan bahwa masa perlindungan *Iuran Tahunan Dana Kematian* Anda akan *jatuh tempo dalam ${countdownText}*:
📅 *Tanggal Jatuh Tempo:* ${expiryInfo.expiryDateFormatted}
💰 *Nominal Iuran Tahunan:* ${annualFee} / tahun (12 Bulan)

Demi kelancaran hak santunan duka dan fardhu kifayah bagi seluruh anggota keluarga yang terdaftar, mohon perpanjangan iuran dapat diselesaikan sebelum tanggal jatuh tempo.

Transfer dapat ditujukan ke rekening Paguyuban atau melalui Pengurus/Ketua RT Cluster setempat.

Terima kasih atas kerja sama dan kepedulian Bpk/Ibu. 🙏

Salam hormat,
*Pengurus Paguyuban Dana Kematian*
${settings?.treasurerName ? `(Bendahara: ${settings.treasurerName})` : ''}`;

  return `https://api.whatsapp.com/send?phone=${internationalPhone}&text=${encodeURIComponent(message)}`;
};

