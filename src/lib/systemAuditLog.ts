import {
  Member,
  MemberStatus,
  MemberVerificationStatus,
  Payment,
  AppNotification,
  WhatsAppNotificationLog,
} from '../types';
import { doesPaymentBelongToMember } from './ktaUtils';

export const SYSTEM_AUDIT_LOG_KEY = 'dana_kematian_system_audit_log_v1';
const PENDING_MEMBERS_SYNC_KEY = 'dana_kematian_pending_members_sync_v1';
const PENDING_PAYMENTS_SYNC_KEY = 'dana_kematian_pending_payments_sync_v1';
const MAX_AUDIT_LOG_ENTRIES = 350;

export interface SystemAuditTraceEntry {
  id: string;
  timestamp: string;
  source: string;
  action: string;
  severity: 'info' | 'warning' | 'error';
  actor?: string;
  memberId?: string;
  memberName?: string;
  memberNumber?: string;
  paymentId?: string;
  previousStatus?: string;
  newStatus?: string;
  matchedBy?: string;
  detail: string;
}

export type AnomalyCategory =
  | 'UNPAID_AWAITING_BENDAHARA'
  | 'UNPAID_AWAITING_PAGUYUBAN_OR_ACTIVE'
  | 'COLLIDING_NPA_OR_NAME'
  | 'ORPHANED_REJECTED_OR_DELETED_PAYMENT'
  | 'RT_VERIFICATION_BYPASSED';

export interface ForensicCauseFinding {
  code: string;
  title: string;
  sourceFile: string;
  evidence: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface MemberStatusAnomaly {
  member: Member;
  categories: AnomalyCategory[];
  severity: 'critical' | 'warning';
  headline: string;
  recommendedStatus: MemberStatus;
  recommendedVerificationStatus: MemberVerificationStatus;
  probableCauses: ForensicCauseFinding[];
}

export interface MemberForensicReport {
  member: Member;
  anomaly: MemberStatusAnomaly | null;
  exactIdPayments: Payment[];
  fallbackNpaPayments: Payment[];
  fallbackNamePayments: Payment[];
  activePaymentsStrict: Payment[];
  rejectedPayments: Payment[];
  collisionPeers: {
    sameNpa: Member[];
    sameName: Member[];
  };
  pendingCloudMemberQueue: Member | null;
  pendingCloudPaymentQueue: Payment[];
  relatedNotifications: AppNotification[];
  relatedWaLogs: WhatsAppNotificationLog[];
  relatedAuditLogs: SystemAuditTraceEntry[];
  recommendedStatus: MemberStatus;
  recommendedVerificationStatus: MemberVerificationStatus;
  repairExplanation: string;
}

export interface NpaReassignmentPlanItem {
  member: Member;
  oldNpa: string;
  newNpa: string;
  keeperMemberId: string;
  keeperMemberName: string;
  reason: string;
  strictPaymentsCount: number;
}

export interface DuplicateNpaGroup {
  normalizedNpa: string;
  displayNpa: string;
  keeper: Member;
  keeperReason: string;
  duplicates: NpaReassignmentPlanItem[];
  members: Member[];
}

/**
 * Generates a collision-free ADK-YYYY-NNN member number by scanning existing highest sequence.
 */
export function generateNextMemberNumber(members: Member[] = [], offset = 0): string {
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;
  const usedNpas = new Set<string>();

  for (const m of members) {
    if (!m?.memberNumber) continue;
    usedNpas.add(m.memberNumber.trim().toLowerCase());
    const match = m.memberNumber.match(/^ADK-\d{4}-(\d+)$/i);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  let nextSeq = Math.max(maxSeq + 1, members.length + 1) + offset;
  let candidate = `ADK-${currentYear}-${String(nextSeq).padStart(3, '0')}`;
  while (usedNpas.has(candidate.toLowerCase())) {
    nextSeq += 1;
    candidate = `ADK-${currentYear}-${String(nextSeq).padStart(3, '0')}`;
  }
  return candidate;
}

function scoreMemberForNpaKeeper(member: Member, payments: Payment[]): {
  score: number;
  reason: string;
  strictPaymentsCount: number;
} {
  const strictPayments = payments.filter((p) => p && p.memberId && p.memberId === member.id);
  const verifiedCount = strictPayments.filter((p) => p.status === 'Verified').length;
  const pendingCount = strictPayments.filter((p) => p.status === 'Pending').length;

  let score = 0;
  const reasons: string[] = [];

  if (verifiedCount > 0) {
    score += 10000;
    reasons.push(`${verifiedCount} pembayaran Verified`);
  }
  if (member.isKtaIssued || member.status === 'Aktif') {
    score += 5000;
    reasons.push('Status Aktif / KTA terbit');
  }
  if (member.status === 'Meninggal') {
    score += 4000;
    reasons.push('Riwayat anggota historis');
  }
  if (pendingCount > 0) {
    score += 2000;
    reasons.push(`${pendingCount} pembayaran Pending`);
  }
  if (
    member.verificationStatus === 'Verified' ||
    member.status === 'Menunggu Persetujuan Ketua Paguyuban' ||
    member.status === 'Menunggu Pembayaran'
  ) {
    score += 500;
    reasons.push('Sudah lolos verifikasi RT');
  }
  if (member.status === 'Non-Aktif') {
    score -= 1000;
  }
  if (member.status === 'Ditolak') {
    score -= 2000;
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join(', ') : 'Pendaftar paling awal pada NPA ini',
    strictPaymentsCount: strictPayments.length,
  };
}

/**
 * Finds all non-empty duplicate memberNumber (NPA) groups and constructs a safe reassignment plan
 * keeping the rightful original owner on the original NPA and issuing guaranteed-unique ADK-YYYY-NNN
 * numbers to all colliding peers.
 */
export function buildDuplicateNpaResolutionPlan(
  members: Member[] = [],
  payments: Payment[] = []
): DuplicateNpaGroup[] {
  const byNormalizedNpa = new Map<string, Member[]>();

  for (const m of members) {
    if (!m?.memberNumber) continue;
    const norm = m.memberNumber.trim().toLowerCase();
    if (!norm) continue;
    const list = byNormalizedNpa.get(norm) || [];
    list.push(m);
    byNormalizedNpa.set(norm, list);
  }

  // Virtual pool containing all existing members + newly reserved NPAs to guarantee zero intra-batch collisions
  const virtualMembersPool: Member[] = [...members];
  const groups: DuplicateNpaGroup[] = [];

  for (const [normalizedNpa, groupMembers] of byNormalizedNpa.entries()) {
    if (groupMembers.length < 2) continue;

    const ranked = groupMembers
      .map((m, idx) => ({
        member: m,
        idx,
        meta: scoreMemberForNpaKeeper(m, payments),
      }))
      .sort((a, b) => {
        if (b.meta.score !== a.meta.score) {
          return b.meta.score - a.meta.score;
        }
        const dateCmp = (a.member.joinDate || '9999-99-99').localeCompare(
          b.member.joinDate || '9999-99-99'
        );
        if (dateCmp !== 0) return dateCmp;
        const idCmp = (a.member.id || '').localeCompare(b.member.id || '');
        if (idCmp !== 0) return idCmp;
        return a.idx - b.idx;
      });

    const keeperEntry = ranked[0];
    const duplicateEntries = ranked.slice(1);
    const displayNpa = (keeperEntry.member.memberNumber || normalizedNpa).trim();

    const duplicates: NpaReassignmentPlanItem[] = duplicateEntries.map((entry) => {
      const nextNpa = generateNextMemberNumber(virtualMembersPool);
      virtualMembersPool.push({
        ...entry.member,
        memberNumber: nextNpa,
      });

      return {
        member: entry.member,
        oldNpa: entry.member.memberNumber,
        newNpa: nextNpa,
        keeperMemberId: keeperEntry.member.id,
        keeperMemberName: keeperEntry.member.name,
        reason: `Pemilik sah NPA ${displayNpa} adalah ${keeperEntry.member.name} (${keeperEntry.meta.reason}). Data kembar diterbitkan NPA baru ${nextNpa}.`,
        strictPaymentsCount: entry.meta.strictPaymentsCount,
      };
    });

    groups.push({
      normalizedNpa,
      displayNpa,
      keeper: keeperEntry.member,
      keeperReason: keeperEntry.meta.reason,
      duplicates,
      members: ranked.map((r) => r.member),
    });
  }

  return groups.sort((a, b) => a.displayNpa.localeCompare(b.displayNpa));
}

export function getSystemAuditLogs(): SystemAuditTraceEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYSTEM_AUDIT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSystemTrace(
  entry: Omit<SystemAuditTraceEntry, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  }
): SystemAuditTraceEntry {
  const newEntry: SystemAuditTraceEntry = {
    id: entry.id || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: entry.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
    source: entry.source,
    action: entry.action,
    severity: entry.severity,
    actor: entry.actor,
    memberId: entry.memberId,
    memberName: entry.memberName,
    memberNumber: entry.memberNumber,
    paymentId: entry.paymentId,
    previousStatus: entry.previousStatus,
    newStatus: entry.newStatus,
    matchedBy: entry.matchedBy,
    detail: entry.detail,
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getSystemAuditLogs();
      const updated = [newEntry, ...existing].slice(0, MAX_AUDIT_LOG_ENTRIES);
      localStorage.setItem(SYSTEM_AUDIT_LOG_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
  }

  return newEntry;
}

export function clearSystemAuditLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SYSTEM_AUDIT_LOG_KEY);
  } catch {
    // ignore storage error
  }
}

export function getPendingUnsyncedMembers(): Member[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_MEMBERS_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPendingUnsyncedPayments(): Payment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_PAYMENTS_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSafeRepairTarget(member: Member): {
  status: MemberStatus;
  verificationStatus: MemberVerificationStatus;
  explanation: string;
} {
  const hasRtApprovalEvidence = Boolean(
    member.verifiedByRt ||
      member.rtVerifiedBy ||
      member.verifiedAt ||
      member.rtVerifiedAt ||
      member.verificationStatus === 'Verified'
  );

  if (hasRtApprovalEvidence) {
    return {
      status: 'Menunggu Pembayaran',
      verificationStatus: 'Verified',
      explanation:
        'Warga sudah memiliki bukti verifikasi Ketua RT (' +
        (member.verifiedByRt || member.rtVerifiedBy || 'Ketua RT') +
        '), sehingga status semestinya adalah "Menunggu Pembayaran" sampai warga mengunggah bukti transfer.',
    };
  }

  return {
    status: 'Menunggu Verifikasi RT',
    verificationStatus: 'Pending',
    explanation:
      'Warga belum memiliki jejak verifikasi Ketua RT maupun pembayaran aktif, sehingga status semestinya dikembalikan ke "Menunggu Verifikasi RT" (Pending).',
  };
}

/**
 * Inspects a single member across payments, duplicate NPAs/names, notifications, WA logs,
 * cloud pending queues, and mutation audit logs to determine exact root causes of anomalies.
 */
export function inspectMemberForensicTrace(params: {
  member: Member;
  allMembers: Member[];
  payments: Payment[];
  notifications?: AppNotification[];
  whatsappLogs?: WhatsAppNotificationLog[];
  auditLogs?: SystemAuditTraceEntry[];
}): MemberForensicReport {
  const {
    member,
    allMembers = [],
    payments = [],
    notifications = [],
    whatsappLogs = [],
    auditLogs = getSystemAuditLogs(),
  } = params;

  const cleanMemberNpa = (member.memberNumber || '').trim().toLowerCase();
  const cleanMemberName = (member.name || '').trim().toLowerCase();

  const exactIdPayments = payments.filter((p) => p && p.memberId && p.memberId === member.id);
  const fallbackNpaPayments = payments.filter(
    (p) =>
      p &&
      p.memberId !== member.id &&
      cleanMemberNpa &&
      (p.memberNumber || '').trim().toLowerCase() === cleanMemberNpa
  );
  const fallbackNamePayments = payments.filter(
    (p) =>
      p &&
      p.memberId !== member.id &&
      cleanMemberName &&
      (p.memberName || '').trim().toLowerCase() === cleanMemberName
  );

  const activePaymentsStrict = exactIdPayments.filter(
    (p) => p.status === 'Pending' || p.status === 'Verified'
  );
  const rejectedPayments = [...exactIdPayments, ...fallbackNpaPayments].filter(
    (p, idx, arr) => p.status === 'Rejected' && arr.findIndex((x) => x.id === p.id) === idx
  );

  const sameNpa = cleanMemberNpa
    ? allMembers.filter(
        (other) =>
          other &&
          other.id !== member.id &&
          (other.memberNumber || '').trim().toLowerCase() === cleanMemberNpa
      )
    : [];

  const sameName = cleanMemberName
    ? allMembers.filter(
        (other) =>
          other &&
          other.id !== member.id &&
          (other.name || '').trim().toLowerCase() === cleanMemberName
      )
    : [];

  const pendingCloudMembers = getPendingUnsyncedMembers();
  const pendingCloudPayments = getPendingUnsyncedPayments();
  const pendingCloudMemberQueue =
    pendingCloudMembers.find((m) => m && m.id === member.id) || null;
  const pendingCloudPaymentQueue = pendingCloudPayments.filter(
    (p) =>
      p &&
      (p.memberId === member.id ||
        (cleanMemberNpa && (p.memberNumber || '').trim().toLowerCase() === cleanMemberNpa))
  );

  const relatedNotifications = notifications.filter(
    (n) =>
      n &&
      (n.memberId === member.id ||
        (cleanMemberNpa && n.message?.toLowerCase().includes(cleanMemberNpa)) ||
        (cleanMemberName && cleanMemberName.length >= 3 && n.message?.toLowerCase().includes(cleanMemberName)))
  );

  const relatedWaLogs = whatsappLogs.filter(
    (w) =>
      w &&
      ((cleanMemberNpa && (w.memberNumber || '').trim().toLowerCase() === cleanMemberNpa) ||
        (cleanMemberName && (w.recipientName || '').trim().toLowerCase() === cleanMemberName))
  );

  const relatedAuditLogs = auditLogs.filter(
    (log) =>
      log &&
      (log.memberId === member.id ||
        (cleanMemberNpa && (log.memberNumber || '').trim().toLowerCase() === cleanMemberNpa) ||
        (cleanMemberName && (log.memberName || '').trim().toLowerCase() === cleanMemberName))
  );

  const categories: AnomalyCategory[] = [];
  const probableCauses: ForensicCauseFinding[] = [];

  const isExemptLifecycle =
    member.status === 'Meninggal' ||
    member.status === 'Ditolak' ||
    member.status === 'Non-Aktif';

  const strictVerifiedPayments = exactIdPayments.filter((p) => p.status === 'Verified');
  const strictPendingPayments = exactIdPayments.filter((p) => p.status === 'Pending');

  // Check 1: Unpaid citizen stuck in 'Menunggu Validasi Bendahara'
  if (member.status === 'Menunggu Validasi Bendahara' && activePaymentsStrict.length === 0) {
    categories.push('UNPAID_AWAITING_BENDAHARA');

    if (fallbackNpaPayments.length > 0 || sameNpa.length > 0) {
      const refPay = fallbackNpaPayments[0];
      const peerNames = sameNpa.map((x) => `${x.name} (${x.id})`).join(', ');
      probableCauses.push({
        code: 'NPA_COLLISION_HIJACK',
        title: 'Tabrakan Nomor Anggota (NPA Kembar) Menyebabkan Pembayaran Anggota Lain Tertukar',
        sourceFile: 'src/lib/receiptUtils.ts & src/components/MemberRegistration.tsx',
        evidence:
          `NPA "${member.memberNumber}" juga dimiliki oleh: ${peerNames || 'anggota lain'}. ` +
          (refPay
            ? `Pembayaran ${refPay.receiptNumber} (${refPay.paymentType}, status: ${refPay.status}) sebenarnya memiliki memberId=${refPay.memberId}, tetapi memiliki NPA yang sama sehingga logika lama findMemberForPayment/handleAddPayment ikut mengubah status warga ini.`
            : `Sebelumnya penomoran ADK-2026-xxx memakai members.length + 1 yang bisa menghasilkan NPA kembar setelah ada penghapusan anggota.`),
        severity: 'critical',
      });
    }

    if (fallbackNamePayments.length > 0) {
      const refPay = fallbackNamePayments[0];
      probableCauses.push({
        code: 'NAME_FALLBACK_HIJACK',
        title: 'Pencocokan Pembayaran Berdasarkan Nama Kembar (Fallback Name Match)',
        sourceFile: 'src/lib/ktaUtils.ts (doesPaymentBelongToMember)',
        evidence: `Terdapat pembayaran ${refPay.receiptNumber} milik memberId=${refPay.memberId} dengan nama sama "${refPay.memberName}". Logika lama doesPaymentBelongToMember jatuh ke pencocokan nama walau memberId berbeda.`,
        severity: 'critical',
      });
    }

    if (rejectedPayments.length > 0) {
      categories.push('ORPHANED_REJECTED_OR_DELETED_PAYMENT');
      const rej = rejectedPayments[0];
      probableCauses.push({
        code: 'REJECTED_PAYMENT_ORPHAN_STATUS',
        title: 'Pembayaran Ditolak / Dihapus Tidak Mengembalikan Status Warga',
        sourceFile: 'src/App.tsx (handleRejectPayment / handleDeletePayment)',
        evidence: `Ditemukan pembayaran berstatus Rejected (${rej.receiptNumber || rej.id}), atau bukti pembayaran sebelumnya telah dihapus, namun status warga di cloud/lokal tetap tertinggal di "Menunggu Validasi Bendahara".`,
        severity: 'warning',
      });
    }

    const recoveryAudit = relatedAuditLogs.find((l) => l.source.includes('memberRecovery'));
    if (recoveryAudit) {
      probableCauses.push({
        code: 'AUTO_RECOVERY_PROMOTION',
        title: 'Promosi Otomatis oleh Mesin Pemulihan Startup (memberRecovery)',
        sourceFile: 'src/lib/memberRecovery.ts (RULE_D / recoverMissingMembersFromTraces)',
        evidence: `${recoveryAudit.timestamp}: ${recoveryAudit.detail}`,
        severity: 'critical',
      });
    }

    const paymentNotif = relatedNotifications.find(
      (n) => n.category === 'payment' || n.title.toLowerCase().includes('setoran')
    );
    if (paymentNotif && activePaymentsStrict.length === 0) {
      probableCauses.push({
        code: 'PAYMENT_DELETED_OR_CLOUD_DESYNC',
        title: 'Jejak Notifikasi Pembayaran Ada, Tapi Record Pembayaran Hilang / Terhapus',
        sourceFile: 'src/App.tsx / Firestore Sync',
        evidence: `Notifikasi "${paymentNotif.title}" (${paymentNotif.timestamp}) tercatat: "${paymentNotif.message}", namun tidak ada transaksi aktif pada daftar pembayaran saat ini (kemungkinan dihapus atau gagal sinkronisasi cloud).`,
        severity: 'warning',
      });
    }

    if (pendingCloudMemberQueue) {
      probableCauses.push({
        code: 'LOCAL_SYNC_QUEUE_STALE',
        title: 'Antrean Sinkronisasi Lokal Tertunda (Mode Offline / Cloud Retry)',
        sourceFile: 'localStorage: dana_kematian_pending_members_sync_v1',
        evidence: `Data warga ini masih tersimpan di antrean sync lokal dengan status "${pendingCloudMemberQueue.status}", sehingga berpotensi menimpa status sebenarnya saat rekonsiliasi cloud.`,
        severity: 'warning',
      });
    }

    if (probableCauses.length === 0) {
      probableCauses.push({
        code: 'MISSING_PAYMENT_TRANSITION',
        title: 'Perubahan Status Manual / Sinkronisasi Silang Tanpa Record Pembayaran Aktif',
        sourceFile: 'src/App.tsx (handleUpdateMember / Cloud Merge)',
        evidence:
          'Warga berstatus "Menunggu Validasi Bendahara", tetapi 0 transaksi pembayaran (Pending/Verified) yang terhubung ke ID maupun NPA warga ini. Kemungkinan status diubah manual pada Edit Biodata / impor data / sinkronisasi browser lama sebelum fitur Audit Mutasi aktif.',
        severity: 'warning',
      });
    }
  }

  // Check 2: Unpaid citizen stuck in 'Menunggu Persetujuan Ketua Paguyuban' or 'Aktif'
  if (
    !isExemptLifecycle &&
    (member.status === 'Menunggu Persetujuan Ketua Paguyuban' ||
      (member.status === 'Aktif' && strictVerifiedPayments.length === 0 && !member.isKtaIssued))
  ) {
    if (strictVerifiedPayments.length === 0 && strictPendingPayments.length === 0) {
      categories.push('UNPAID_AWAITING_PAGUYUBAN_OR_ACTIVE');
      probableCauses.push({
        code: 'PROMOTED_WITHOUT_VERIFIED_PAYMENT',
        title: `Status "${member.status}" Tanpa Pembayaran Verified Milik Sendiri`,
        sourceFile: 'src/App.tsx / src/lib/memberRecovery.ts',
        evidence:
          fallbackNpaPayments.length > 0
            ? `Tidak ada pembayaran milik memberId=${member.id}, namun ditemukan pembayaran dengan NPA kembar (${fallbackNpaPayments[0].receiptNumber}).`
            : `Warga berada pada tahap "${member.status}" tanpa transaksi pembayaran Verified yang cocok dengan memberId=${member.id}.`,
        severity: 'critical',
      });
    }
  }

  // Check 3: Duplicate NPA or name collision risk even before triggering false promotion
  if (!isExemptLifecycle && sameNpa.length > 0) {
    if (!categories.includes('COLLIDING_NPA_OR_NAME')) {
      categories.push('COLLIDING_NPA_OR_NAME');
    }
    if (!probableCauses.some((c) => c.code === 'NPA_COLLISION_HIJACK')) {
      probableCauses.push({
        code: 'DUPLICATE_MEMBER_NUMBER',
        title: `Nomor Pokok Anggota Kembar (${member.memberNumber})`,
        sourceFile: 'src/components/MemberRegistration.tsx (nextNumber = members.length + 1)',
        evidence: `NPA "${member.memberNumber}" dipakai bersama oleh: ${sameNpa.map((x) => `${x.name} (${x.id})`).join(', ')}. Risiko tertukarnya status pembayaran jika tidak segera dibedakan.`,
        severity: 'warning',
      });
    }
  }

  // Check 4: Advanced status while RT verification is still Pending
  if (
    !isExemptLifecycle &&
    (member.status === 'Menunggu Pembayaran' ||
      member.status === 'Menunggu Validasi Bendahara' ||
      member.status === 'Menunggu Persetujuan Ketua Paguyuban') &&
    member.verificationStatus !== 'Verified'
  ) {
    categories.push('RT_VERIFICATION_BYPASSED');
    probableCauses.push({
      code: 'RT_STATUS_MISMATCH',
      title: `Status Tahap "${member.status}" Namun verificationStatus Masih "${member.verificationStatus || 'kosong'}"`,
      sourceFile: 'src/App.tsx / src/lib/memberRecovery.ts',
      evidence: `Status warga sudah melewati tahap RT, tetapi field verificationStatus bukan "Verified" (RT verifier: ${member.verifiedByRt || member.rtVerifiedBy || '-'}).`,
      severity: 'warning',
    });
  }

  const repairTarget = getSafeRepairTarget(member);

  let anomaly: MemberStatusAnomaly | null = null;
  if (categories.length > 0) {
    const hasCritical = probableCauses.some((c) => c.severity === 'critical');
    let headline = 'Anomali Konsistensi Status Sistem';
    if (categories.includes('UNPAID_AWAITING_BENDAHARA')) {
      headline = 'Belum Ada Pembayaran Aktif, Tapi Status "Menunggu Validasi Bendahara"';
    } else if (categories.includes('UNPAID_AWAITING_PAGUYUBAN_OR_ACTIVE')) {
      headline = `Belum Ada Pembayaran Verified, Tapi Status "${member.status}"`;
    } else if (categories.includes('COLLIDING_NPA_OR_NAME')) {
      headline = `Nomor Anggota Kembar (${member.memberNumber}) Berisiko Tertukar`;
    } else if (categories.includes('RT_VERIFICATION_BYPASSED')) {
      headline = 'Inkonsistensi Status Verifikasi RT';
    }

    anomaly = {
      member,
      categories,
      severity: hasCritical ? 'critical' : 'warning',
      headline,
      recommendedStatus: repairTarget.status,
      recommendedVerificationStatus: repairTarget.verificationStatus,
      probableCauses,
    };
  }

  return {
    member,
    anomaly,
    exactIdPayments,
    fallbackNpaPayments,
    fallbackNamePayments,
    activePaymentsStrict,
    rejectedPayments,
    collisionPeers: {
      sameNpa,
      sameName,
    },
    pendingCloudMemberQueue,
    pendingCloudPaymentQueue,
    relatedNotifications,
    relatedWaLogs,
    relatedAuditLogs,
    recommendedStatus: repairTarget.status,
    recommendedVerificationStatus: repairTarget.verificationStatus,
    repairExplanation: repairTarget.explanation,
  };
}

/**
 * Scans all registered members and returns detected status/payment anomalies
 * sorted by severity (critical unpaid Bendahara queue mismatches first).
 */
export function analyzeMemberStatusAnomalies(params: {
  members: Member[];
  payments: Payment[];
  notifications?: AppNotification[];
  whatsappLogs?: WhatsAppNotificationLog[];
}): MemberStatusAnomaly[] {
  const { members = [], payments = [], notifications = [], whatsappLogs = [] } = params;
  const auditLogs = getSystemAuditLogs();
  const anomalies: MemberStatusAnomaly[] = [];

  for (const member of members) {
    if (!member) continue;
    const report = inspectMemberForensicTrace({
      member,
      allMembers: members,
      payments,
      notifications,
      whatsappLogs,
      auditLogs,
    });
    if (report.anomaly) {
      anomalies.push(report.anomaly);
    }
  }

  // Sort: UNPAID_AWAITING_BENDAHARA first, then critical, then warning
  return anomalies.sort((a, b) => {
    const aUnpaidBendahara = a.categories.includes('UNPAID_AWAITING_BENDAHARA') ? 0 : 1;
    const bUnpaidBendahara = b.categories.includes('UNPAID_AWAITING_BENDAHARA') ? 0 : 1;
    if (aUnpaidBendahara !== bUnpaidBendahara) return aUnpaidBendahara - bUnpaidBendahara;
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return (b.member.joinDate || '').localeCompare(a.member.joinDate || '');
  });
}

/**
 * Helper to check if a payment strictly or loosely belongs to a member for diagnostic comparison.
 */
export function explainPaymentLinkMatch(payment: Payment, member: Member): string {
  if (payment.memberId && member.id && payment.memberId === member.id) {
    return 'Cocok ID Permanen (memberId)';
  }
  if (doesPaymentBelongToMember(payment, member)) {
    return 'Cocok Fallback (NPA/Nama tanpa memberId)';
  }
  if (
    payment.memberNumber &&
    member.memberNumber &&
    payment.memberNumber.toLowerCase().trim() === member.memberNumber.toLowerCase().trim()
  ) {
    return `NPA Kembar (ID Pembayar: ${payment.memberId})`;
  }
  if (
    payment.memberName &&
    member.name &&
    payment.memberName.toLowerCase().trim() === member.name.toLowerCase().trim()
  ) {
    return `Nama Kembar (ID Pembayar: ${payment.memberId})`;
  }
  return 'Tidak Cocok';
}
