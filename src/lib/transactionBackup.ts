import {
  BackupAutomationSettings,
  BackupDestination,
  BenefitClaim,
  Member,
  Payment,
  SystemSettings,
  TransactionBackupRecord,
  TransactionBackupSnapshot,
  TransactionBackupSummary,
} from '../types';
import { getIndonesiaDateString, getIndonesiaTimestamp } from './indonesianTime';
import {
  deleteTransactionBackupFromCloud,
  fetchTransactionBackupsFromCloud,
  syncTransactionBackupToCloud,
} from './firebase';

const LOCAL_BACKUP_HISTORY_KEY = 'dana_kematian_backup_history_v1';
const LOCAL_DAILY_LOCK_KEY = 'dana_kematian_daily_backup_lock_v1';

export const DEFAULT_BACKUP_AUTOMATION_SETTINGS: BackupAutomationSettings = {
  enabled: true,
  scheduleTimeWib: '00:00',
  destination: 'cloud_and_email',
  adminEmail: 'pranowo.tfc@gmail.com',
  webhookUrl: '',
  includeMembersSummary: true,
};

export function getEffectiveBackupSettings(settings?: SystemSettings): BackupAutomationSettings {
  const saved = settings?.backupAutomation;
  return {
    enabled: saved?.enabled !== undefined ? saved.enabled : DEFAULT_BACKUP_AUTOMATION_SETTINGS.enabled,
    scheduleTimeWib: saved?.scheduleTimeWib || DEFAULT_BACKUP_AUTOMATION_SETTINGS.scheduleTimeWib,
    destination: saved?.destination || DEFAULT_BACKUP_AUTOMATION_SETTINGS.destination,
    adminEmail: saved?.adminEmail !== undefined ? saved.adminEmail : DEFAULT_BACKUP_AUTOMATION_SETTINGS.adminEmail,
    webhookUrl: saved?.webhookUrl || '',
    includeMembersSummary:
      saved?.includeMembersSummary !== undefined ? saved.includeMembersSummary : true,
    lastBackupDate: saved?.lastBackupDate,
    lastBackupAt: saved?.lastBackupAt,
    lastBackupStatus: saved?.lastBackupStatus,
    lastBackupMessage: saved?.lastBackupMessage,
  };
}

/**
 * Strips heavy Base64 image blobs so JSON transaction backups stay crisp, fast,
 * well under Firestore's 1 MiB document limit, and lightweight as email attachments.
 */
function sanitizePaymentForBackup(p: Payment): Record<string, unknown> {
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    memberId: p.memberId,
    memberNumber: p.memberNumber,
    memberName: p.memberName,
    amount: p.amount,
    paymentType: p.paymentType,
    periodMonth: p.periodMonth,
    periodYear: p.periodYear || null,
    paymentMethod: p.paymentMethod,
    status: p.status,
    createdAt: p.createdAt,
    verifiedAt: p.verifiedAt || null,
    verifiedBy: p.verifiedBy || null,
    adminNotes: p.adminNotes || null,
    adminSignerName: p.adminSignerName || null,
    adminSignerTitle: p.adminSignerTitle || null,
    adminSignatureDate: p.adminSignatureDate || null,
    verificationCancelledAt: p.verificationCancelledAt || null,
    verificationCancelledBy: p.verificationCancelledBy || null,
    verificationCancelReason: p.verificationCancelReason || null,
    hasProofAttachment: Boolean(p.proofImageUrl),
    hasDigitalSignature: Boolean(p.adminSignature),
  };
}

function sanitizeClaimForBackup(c: BenefitClaim): Record<string, unknown> {
  return {
    id: c.id,
    claimNumber: c.claimNumber,
    memberId: c.memberId,
    memberName: c.memberName,
    memberNumber: c.memberNumber,
    cluster: c.cluster || null,
    deceasedName: c.deceasedName,
    relationship: c.relationship,
    dateOfDeath: c.dateOfDeath,
    causeOfDeath: c.causeOfDeath || null,
    status: c.status || 'Disetujui',
    totalAmount: c.totalAmount,
    expenseDetails: (c.expenseDetails || []).map((exp) => ({
      id: exp.id,
      description: exp.description,
      cost: exp.cost,
      recipientParty: exp.recipientParty || null,
      paidDate: exp.paidDate || null,
      hasTransferProof: Boolean(exp.transferProofUrl),
      hasReceiptAttachment: Boolean(exp.externalReceiptUrl),
    })),
    submittedByRtName: c.submittedByRtName || null,
    submittedByRtCluster: c.submittedByRtCluster || null,
    submittedAt: c.submittedAt || null,
    treasurerName: c.treasurerName || null,
    treasurerProcessedAt: c.treasurerProcessedAt || null,
    approvedByKetuaName: c.approvedByKetuaName || null,
    approvedAt: c.approvedAt || null,
    rejectedAt: c.rejectedAt || null,
    rejectionReason: c.rejectionReason || null,
    createdAt: c.createdAt,
    processedBy: c.processedBy,
    notes: c.notes || null,
  };
}

function sanitizeMemberSummaryForBackup(m: Member): Record<string, unknown> {
  return {
    id: m.id,
    memberNumber: m.memberNumber,
    name: m.name,
    cluster: m.cluster,
    phone: m.phone,
    status: m.status,
    verificationStatus: m.verificationStatus || null,
    joinDate: m.joinDate,
    dependentsCount: m.dependentsCount ?? 0,
  };
}

async function computeSha256Hex(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback below if subtle crypto unavailable
  }
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function buildTransactionBackupSnapshot(params: {
  payments: Payment[];
  claims: BenefitClaim[];
  members: Member[];
  settings: SystemSettings;
  baseFundBalance?: number;
  includeMembersSummary?: boolean;
}): TransactionBackupSnapshot {
  const {
    payments,
    claims,
    members,
    settings,
    baseFundBalance = 0,
    includeMembersSummary = true,
  } = params;

  const nowWib = getIndonesiaTimestamp();
  const dateWib = getIndonesiaDateString();

  const verifiedPayments = payments.filter((p) => p.status === 'Verified');
  const pendingPayments = payments.filter((p) => p.status === 'Pending');
  const rejectedPayments = payments.filter((p) => p.status === 'Rejected');
  const approvedClaims = claims.filter((c) => !c.status || c.status === 'Disetujui');

  const summary: TransactionBackupSummary = {
    paymentCount: payments.length,
    verifiedPaymentCount: verifiedPayments.length,
    pendingPaymentCount: pendingPayments.length,
    rejectedPaymentCount: rejectedPayments.length,
    claimCount: claims.length,
    approvedClaimCount: approvedClaims.length,
    memberCount: members.length,
    baseFundBalance,
    totalVerifiedAmount: verifiedPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    totalClaimAmount: approvedClaims.reduce((sum, c) => sum + (c.totalAmount || 0), 0),
  };

  return {
    schemaVersion: '1.0',
    generatedAtWib: `${nowWib} WIB`,
    backupDateWib: dateWib,
    timezone: 'Asia/Jakarta',
    organizationName: settings.communityName || settings.organizationName || 'Paguyuban Dana Kematian',
    summary,
    payments: payments.map(sanitizePaymentForBackup),
    claims: claims.map(sanitizeClaimForBackup),
    ...(includeMembersSummary ? { membersSummary: members.map(sanitizeMemberSummaryForBackup) } : {}),
  };
}

export function getLocalBackupHistory(): TransactionBackupRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BACKUP_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalBackupRecord(record: TransactionBackupRecord): TransactionBackupRecord[] {
  const current = getLocalBackupHistory().filter((r) => r.id !== record.id);
  const updated = [record, ...current]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 30);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_BACKUP_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // If quota tight, store only the newest 5 snapshots locally
      try {
        localStorage.setItem(LOCAL_BACKUP_HISTORY_KEY, JSON.stringify(updated.slice(0, 5)));
      } catch {
        // ignore
      }
    }
  }
  return updated;
}

export async function loadMergedBackupHistory(): Promise<TransactionBackupRecord[]> {
  const localList = getLocalBackupHistory();
  try {
    const cloudList = await fetchTransactionBackupsFromCloud(30);
    const byId = new Map<string, TransactionBackupRecord>();
    localList.forEach((item) => {
      if (item?.id) byId.set(item.id, item);
    });
    cloudList.forEach((item) => {
      if (item?.id) byId.set(item.id, item);
    });
    const merged = Array.from(byId.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    if (typeof window !== 'undefined' && merged.length > 0) {
      try {
        localStorage.setItem(LOCAL_BACKUP_HISTORY_KEY, JSON.stringify(merged.slice(0, 15)));
      } catch {
        // ignore storage quota
      }
    }
    return merged;
  } catch {
    return localList;
  }
}

export async function removeBackupRecord(backupId: string): Promise<TransactionBackupRecord[]> {
  const remaining = getLocalBackupHistory().filter((r) => r.id !== backupId);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_BACKUP_HISTORY_KEY, JSON.stringify(remaining));
    } catch {
      // ignore
    }
  }
  await deleteTransactionBackupFromCloud(backupId);
  return remaining;
}

export function hasDailyScheduledBackupRunToday(settings?: SystemSettings): boolean {
  const todayWib = getIndonesiaDateString();
  if (settings?.backupAutomation?.lastBackupDate === todayWib) {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(LOCAL_DAILY_LOCK_KEY) === todayWib) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function markDailyScheduledBackupLock(dateWib: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_DAILY_LOCK_KEY, dateWib);
    } catch {
      // ignore
    }
  }
}

export async function executeTransactionBackup(params: {
  payments: Payment[];
  claims: BenefitClaim[];
  members: Member[];
  settings: SystemSettings;
  baseFundBalance?: number;
  triggerType: 'scheduled_00_00' | 'manual';
  triggeredBy: string;
}): Promise<{
  record: TransactionBackupRecord;
  updatedAutomationSettings: BackupAutomationSettings;
}> {
  const {
    payments,
    claims,
    members,
    settings,
    baseFundBalance = 0,
    triggerType,
    triggeredBy,
  } = params;

  const cfg = getEffectiveBackupSettings(settings);
  const nowWib = getIndonesiaTimestamp();
  const dateWib = getIndonesiaDateString();
  const timeCompact = nowWib.slice(11, 19).replace(/:/g, '');
  const backupId =
    triggerType === 'scheduled_00_00'
      ? `backup-${dateWib}`
      : `backup-manual-${dateWib}-${timeCompact}`;

  const snapshot = buildTransactionBackupSnapshot({
    payments,
    claims,
    members,
    settings,
    baseFundBalance,
    includeMembersSummary: cfg.includeMembersSummary !== false,
  });

  const serializedJson = JSON.stringify(snapshot, null, 2);
  const sizeBytes = new Blob([serializedJson]).size;
  const checksumSha256 = await computeSha256Hex(serializedJson);

  const destination: BackupDestination = cfg.destination || 'cloud_and_email';
  const wantsCloud = destination === 'cloud_and_email' || destination === 'cloud_only';
  const wantsEmailOrWebhook =
    destination === 'cloud_and_email' ||
    destination === 'email_only' ||
    Boolean(cfg.webhookUrl?.trim());

  let serverDispatchResult: {
    emailDispatched?: boolean;
    emailDispatchChannel?: TransactionBackupRecord['emailDispatchChannel'];
    emailStatusNote?: string;
    webhookDispatched?: boolean;
    serverFileSaved?: boolean;
  } = {};

  try {
    const resp = await fetch('/api/backup/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backupId,
        backupDate: dateWib,
        createdAt: `${nowWib} WIB`,
        triggerType,
        triggeredBy,
        destination,
        adminEmail: cfg.adminEmail,
        webhookUrl: cfg.webhookUrl,
        checksumSha256,
        snapshot,
        wantsEmailDelivery: destination === 'cloud_and_email' || destination === 'email_only',
      }),
    });
    if (resp.ok) {
      serverDispatchResult = await resp.json();
    } else {
      const errData = await resp.json().catch(() => ({}));
      serverDispatchResult = {
        emailDispatched: false,
        emailDispatchChannel: 'none',
        emailStatusNote: errData?.error || `Server merespons HTTP ${resp.status}.`,
      };
    }
  } catch (err) {
    serverDispatchResult = {
      emailDispatched: false,
      emailDispatchChannel: 'none',
      emailStatusNote:
        err instanceof Error ? `Gagal menghubungi server pengiriman: ${err.message}` : 'Koneksi server gagal.',
    };
  }

  let record: TransactionBackupRecord = {
    id: backupId,
    backupDate: dateWib,
    createdAt: `${nowWib} WIB`,
    triggerType,
    triggeredBy,
    destination,
    cloudSaved: false,
    emailDispatched: Boolean(serverDispatchResult.emailDispatched),
    emailTarget: cfg.adminEmail || undefined,
    emailDispatchChannel: serverDispatchResult.emailDispatchChannel || 'none',
    emailStatusNote: wantsEmailOrWebhook
      ? serverDispatchResult.emailStatusNote
      : 'Tujuan disetel hanya ke Cloud Firestore.',
    webhookDispatched: Boolean(serverDispatchResult.webhookDispatched),
    serverFileSaved: Boolean(serverDispatchResult.serverFileSaved),
    sizeBytes,
    checksumSha256,
    summary: snapshot.summary,
    snapshot,
  };

  if (wantsCloud) {
    const okCloud = await syncTransactionBackupToCloud(record);
    record = { ...record, cloudSaved: okCloud };
  }

  saveLocalBackupRecord(record);

  if (triggerType === 'scheduled_00_00') {
    markDailyScheduledBackupLock(dateWib);
  }

  const allCloudOk = !wantsCloud || record.cloudSaved;
  const emailRequested = destination === 'cloud_and_email' || destination === 'email_only';
  const allEmailOk = !emailRequested || record.emailDispatched || Boolean(record.webhookDispatched);

  const lastBackupStatus: BackupAutomationSettings['lastBackupStatus'] =
    allCloudOk && allEmailOk
      ? 'success'
      : record.cloudSaved || record.serverFileSaved || record.emailDispatched || record.webhookDispatched
      ? 'partial'
      : 'failed';

  const statusParts: string[] = [];
  if (record.cloudSaved) statusParts.push('Tersimpan di Cloud Firestore');
  if (record.serverFileSaved) statusParts.push('Arsip JSON server tersimpan');
  if (record.emailDispatched) statusParts.push(`Email terkirim ke ${cfg.adminEmail}`);
  if (record.webhookDispatched) statusParts.push('Webhook cloud terkirim');
  if (emailRequested && !record.emailDispatched && !record.webhookDispatched && record.emailStatusNote) {
    statusParts.push(record.emailStatusNote);
  }

  const updatedAutomationSettings: BackupAutomationSettings = {
    ...cfg,
    lastBackupDate: dateWib,
    lastBackupAt: `${nowWib} WIB`,
    lastBackupStatus,
    lastBackupMessage: statusParts.join(' • ') || 'Backup JSON selesai diproses.',
  };

  return { record, updatedAutomationSettings };
}

export function downloadBackupJsonFile(record: TransactionBackupRecord): string {
  const filename = `Backup_Transaksi_Dana_Kematian_${record.backupDate}_${record.id}.json`;
  const jsonContent = JSON.stringify(
    {
      metadata: {
        backupId: record.id,
        backupDate: record.backupDate,
        createdAt: record.createdAt,
        triggerType: record.triggerType,
        triggeredBy: record.triggeredBy,
        checksumSha256: record.checksumSha256,
      },
      ...record.snapshot,
    },
    null,
    2
  );

  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export function openBackupEmailDraft(record: TransactionBackupRecord, adminEmail: string): void {
  const target = (adminEmail || '').trim();
  const subject = `[Backup Harian JSON] ${record.snapshot.organizationName} - ${record.backupDate}`;
  const compactJson = JSON.stringify(record.snapshot);
  const previewJson =
    compactJson.length <= 1500
      ? compactJson
      : `${compactJson.slice(0, 1500)}\n... (lihat file JSON terlampir / unduh dari portal admin)`;

  const body =
    `Salinan Backup Data Transaksi Harian (Format JSON)\n` +
    `Organisasi: ${record.snapshot.organizationName}\n` +
    `Tanggal Backup: ${record.backupDate}\n` +
    `Waktu Pembuatan: ${record.createdAt}\n` +
    `Checksum SHA-256: ${record.checksumSha256 || '-'}\n\n` +
    `Ringkasan Data:\n` +
    `- Total Transaksi Iuran: ${record.summary.paymentCount} (${record.summary.verifiedPaymentCount} Terverifikasi)\n` +
    `- Total Nominal Iuran Terverifikasi: Rp ${record.summary.totalVerifiedAmount.toLocaleString('id-ID')}\n` +
    `- Total Klaim Santunan: ${record.summary.claimCount} (Rp ${record.summary.totalClaimAmount.toLocaleString('id-ID')})\n` +
    `- Total Anggota Tercatat: ${record.summary.memberCount}\n\n` +
    `Lampiran / Cuplikan JSON:\n${previewJson}`;

  window.location.href = `mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Returns milliseconds until the next 00:00:05 WIB (Asia/Jakarta)
 * and a human-readable countdown string.
 */
export function getNextMidnightWibInfo(now: Date = new Date()): {
  msUntilMidnightWib: number;
  countdownLabel: string;
  currentTimeWib: string;
} {
  const currentTimeWib = getIndonesiaTimestamp(now); // YYYY-MM-DD HH:mm:ss
  const timePart = currentTimeWib.slice(11, 19);
  const [hh, mm, ss] = timePart.split(':').map((v) => parseInt(v, 10) || 0);
  const secondsToday = hh * 3600 + mm * 60 + ss;
  const secondsUntilMidnight = Math.max(5, 86400 - secondsToday + 5); // +5s buffer past 00:00:00

  const remH = Math.floor(secondsUntilMidnight / 3600);
  const remM = Math.floor((secondsUntilMidnight % 3600) / 60);
  return {
    msUntilMidnightWib: secondsUntilMidnight * 1000,
    countdownLabel: `${remH} jam ${remM} menit lagi (00:00 WIB)`,
    currentTimeWib: `${currentTimeWib} WIB`,
  };
}
