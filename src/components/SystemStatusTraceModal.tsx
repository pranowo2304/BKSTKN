import React, { useEffect, useMemo, useState } from 'react';
import {
  AppNotification,
  Member,
  MemberStatus,
  MemberVerificationStatus,
  Payment,
  PaymentUploadAuditLog,
} from '../types';
import { getWhatsAppLogs } from '../lib/whatsappService';
import {
  analyzeMemberStatusAnomalies,
  buildDuplicateNpaResolutionPlan,
  clearSystemAuditLogs,
  explainPaymentLinkMatch,
  getSystemAuditLogs,
  inspectMemberForensicTrace,
  NpaReassignmentPlanItem,
  SystemAuditTraceEntry,
} from '../lib/systemAuditLog';
import { formatIDR } from '../lib/storage';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Database,
  History,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';

interface SystemStatusTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  payments: Payment[];
  paymentAuditLogs?: PaymentUploadAuditLog[];
  notifications?: AppNotification[];
  initialMemberId?: string;
  initialTab?: 'anomalies' | 'inspect' | 'logs' | 'uploads';
  canRepair?: boolean;
  onRepairMemberStatus?: (
    memberId: string,
    targetStatus: MemberStatus,
    targetVerificationStatus: MemberVerificationStatus,
    reason: string
  ) => void;
  onResolveDuplicateNpas?: (plan?: NpaReassignmentPlanItem[]) => void;
}

export const SystemStatusTraceModal: React.FC<SystemStatusTraceModalProps> = ({
  isOpen,
  onClose,
  members,
  payments,
  paymentAuditLogs = [],
  notifications = [],
  initialMemberId,
  initialTab,
  canRepair = true,
  onRepairMemberStatus,
  onResolveDuplicateNpas,
}) => {
  const [activeTab, setActiveTab] = useState<'anomalies' | 'inspect' | 'logs' | 'uploads'>('anomalies');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberQuery, setMemberQuery] = useState<string>('');
  const [logQuery, setLogQuery] = useState<string>('');
  const [uploadLogQuery, setUploadLogQuery] = useState<string>('');
  const [onlyUploadMismatch, setOnlyUploadMismatch] = useState<boolean>(false);
  const [repairReason, setRepairReason] = useState<string>(
    'Perbaikan inkonsistensi status: warga belum memiliki transaksi pembayaran aktif.'
  );
  const [repairFeedback, setRepairFeedback] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<SystemAuditTraceEntry[]>([]);

  const waLogs = useMemo(() => (isOpen ? getWhatsAppLogs() : []), [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setAuditLogs(getSystemAuditLogs());
      setRepairFeedback(null);
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (initialMemberId) {
        setSelectedMemberId(initialMemberId);
        setActiveTab('inspect');
      } else {
        setActiveTab('anomalies');
      }
      if (initialMemberId) {
        setSelectedMemberId(initialMemberId);
      }
    }
  }, [isOpen, initialMemberId, initialTab]);

  const anomalies = useMemo(() => {
    if (!isOpen) return [];
    return analyzeMemberStatusAnomalies({
      members,
      payments,
      notifications,
      whatsappLogs: waLogs,
    });
  }, [isOpen, members, payments, notifications, waLogs]);

  // Default pick first anomalous member when opening inspect tab with empty selection
  useEffect(() => {
    if (!isOpen) return;
    if (!selectedMemberId && anomalies.length > 0) {
      setSelectedMemberId(anomalies[0].member.id);
    } else if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(members[0].id);
    }
  }, [isOpen, selectedMemberId, anomalies, members]);

  const filteredMembersForInspect = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const anomalyIds = new Set(anomalies.map((a) => a.member.id));
    const list = q
      ? members.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.memberNumber?.toLowerCase().includes(q) ||
            m.nik?.toLowerCase().includes(q) ||
            m.status?.toLowerCase().includes(q)
        )
      : members;

    return [...list].sort((a, b) => {
      const aFlag = anomalyIds.has(a.id) ? 0 : 1;
      const bFlag = anomalyIds.has(b.id) ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members, memberQuery, anomalies]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const forensicReport = useMemo(() => {
    if (!isOpen || !selectedMember) return null;
    return inspectMemberForensicTrace({
      member: selectedMember,
      allMembers: members,
      payments,
      notifications,
      whatsappLogs: waLogs,
      auditLogs,
    });
  }, [isOpen, selectedMember, members, payments, notifications, waLogs, auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const q = logQuery.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        log.memberName?.toLowerCase().includes(q) ||
        log.memberNumber?.toLowerCase().includes(q) ||
        log.submittedByUserName?.toLowerCase().includes(q) ||
        log.submittedByUserId?.toLowerCase().includes(q) ||
        log.senderAccountName?.toLowerCase().includes(q) ||
        log.source?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.detail?.toLowerCase().includes(q)
    );
  }, [auditLogs, logQuery]);

  // Gabungkan paymentAuditLogs (Cloud) dengan payment yang sudah punya submittedByUserId agar riwayat tetap lengkap
  const mergedUploadAuditLogs = useMemo<PaymentUploadAuditLog[]>(() => {
    const byPaymentId = new Map<string, PaymentUploadAuditLog>();
    for (const log of paymentAuditLogs) {
      if (log?.paymentId) {
        byPaymentId.set(log.paymentId, log);
      }
    }
    for (const p of payments) {
      if (!p || byPaymentId.has(p.id)) continue;
      if (p.submittedByUserId || p.submittedByUserName || p.senderAccountName) {
        byPaymentId.set(p.id, {
          id: `derived-${p.id}`,
          paymentId: p.id,
          receiptNumber: p.receiptNumber || '-',
          memberId: p.memberId,
          memberName: p.memberName,
          memberNumber: p.memberNumber,
          paymentType: p.paymentType,
          periodMonth: p.periodMonth,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          proofFileName: p.proofFileName,
          senderAccountName: p.senderAccountName,
          submittedByUserId: p.submittedByUserId || '-',
          submittedByUserName: p.submittedByUserName || '-',
          submittedByEmail: p.submittedByEmail,
          submittedByAuthority: String(p.submittedByAuthority || '-'),
          submittedByCluster: p.submittedByCluster,
          submittedByMemberId: p.submittedByMemberId,
          submittedByMemberNumber: p.submittedByMemberNumber,
          isAccountMismatch: Boolean(p.uploaderMismatchFlag),
          isSenderNameMismatch: false,
          isUploadedOnBehalf: Boolean(p.submittedByAuthority && p.submittedByAuthority !== 'Anggota'),
          mismatchReason: p.uploaderMismatchReason,
          sourceComponent: 'PaymentRecord',
          uploadedAt: p.submittedAt || p.createdAt,
          createdAtIso: p.submittedAt || p.createdAt || '',
        });
      }
    }
    return Array.from(byPaymentId.values()).sort((a, b) =>
      (b.createdAtIso || b.uploadedAt || '').localeCompare(a.createdAtIso || a.uploadedAt || '')
    );
  }, [paymentAuditLogs, payments]);

  const filteredUploadAuditLogs = useMemo(() => {
    const q = uploadLogQuery.trim().toLowerCase();
    return mergedUploadAuditLogs.filter((item) => {
      if (onlyUploadMismatch && !item.isAccountMismatch && !item.isSenderNameMismatch) {
        return false;
      }
      if (!q) return true;
      return (
        item.memberName?.toLowerCase().includes(q) ||
        item.memberNumber?.toLowerCase().includes(q) ||
        item.receiptNumber?.toLowerCase().includes(q) ||
        item.submittedByUserName?.toLowerCase().includes(q) ||
        item.submittedByUserId?.toLowerCase().includes(q) ||
        item.submittedByEmail?.toLowerCase().includes(q) ||
        item.submittedByAuthority?.toLowerCase().includes(q) ||
        item.senderAccountName?.toLowerCase().includes(q) ||
        item.mismatchReason?.toLowerCase().includes(q)
      );
    });
  }, [mergedUploadAuditLogs, uploadLogQuery, onlyUploadMismatch]);

  const uploadMismatchCount = useMemo(
    () => mergedUploadAuditLogs.filter((l) => l.isAccountMismatch || l.isSenderNameMismatch).length,
    [mergedUploadAuditLogs]
  );

  if (!isOpen) return null;

  const unpaidBendaharaCount = anomalies.filter((a) =>
    a.categories.includes('UNPAID_AWAITING_BENDAHARA')
  ).length;
  const duplicateNpaCount = anomalies.filter((a) =>
    a.categories.includes('COLLIDING_NPA_OR_NAME')
  ).length;

  const handleTriggerRepair = (
    targetStatus: MemberStatus,
    targetVerStatus: MemberVerificationStatus
  ) => {
    if (!selectedMember || !onRepairMemberStatus) return;
    const finalReason =
      repairReason.trim() ||
      `Koreksi status dari "${selectedMember.status}" ke "${targetStatus}" via Penelusuran Anomali Sistem.`;
    onRepairMemberStatus(selectedMember.id, targetStatus, targetVerStatus, finalReason);
    setTimeout(() => {
      setAuditLogs(getSystemAuditLogs());
    }, 100);
    setRepairFeedback(
      `Status "${selectedMember.name}" (${selectedMember.memberNumber}) berhasil diperbaiki menjadi "${targetStatus}".`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="bg-slate-900 text-white px-5 py-4 sm:px-6 sm:py-5 flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-2xl shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Penelusuran Anomali &amp; Audit Status Sistem
                </h2>
                {anomalies.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500 text-white tabular-nums">
                    {anomalies.length} Anomali Terdeteksi
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Semua Status Konsisten
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Lacak sumber penyebab warga belum membayar namun berstatus Menunggu Validasi Bendahara, cek benturan NPA, antrean sync lokal, dan pulihkan status dengan aman.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Tutup jendela penelusuran sistem"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="bg-slate-50 px-5 sm:px-6 pt-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('anomalies')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'anomalies'
                  ? 'border-indigo-600 text-indigo-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Anomali Status</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                  anomalies.length > 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {anomalies.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inspect')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'inspect'
                  ? 'border-indigo-600 text-indigo-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Telusuri Detail Warga</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('uploads')}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'uploads'
                  ? 'border-indigo-600 text-indigo-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Audit Upload Bukti (Cloud)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                  uploadMismatchCount > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {mergedUploadAuditLogs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuditLogs(getSystemAuditLogs());
                setActiveTab('logs');
              }}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'logs'
                  ? 'border-indigo-600 text-indigo-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Log Mutasi Sistem</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 tabular-nums">
                {auditLogs.length}
              </span>
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white">
          {/* TAB 1: ANOMALIES OVERVIEW */}
          {activeTab === 'anomalies' && (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/70">
                  <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                    Belum Bayar &rarr; Antrean Bendahara
                  </p>
                  <p className="text-2xl font-black text-rose-900 mt-1 tabular-nums">
                    {unpaidBendaharaCount} <span className="text-xs font-bold text-rose-700">Warga</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70">
                  <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    NPA Kembar (Risiko Tertukar)
                  </p>
                  <p className="text-2xl font-black text-amber-950 mt-1 tabular-nums">
                    {duplicateNpaCount} <span className="text-xs font-bold text-amber-800">Warga</span>
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Total Data Diperiksa
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                    {members.length} <span className="text-xs font-bold text-slate-600">Warga</span>
                  </p>
                </div>
              </div>

              {anomalies.length === 0 ? (
                <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-black text-emerald-950">
                      Tidak Ada Anomali Status Pembayaran Saat Ini
                    </h3>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      Seluruh warga dengan status Menunggu Validasi Bendahara maupun Menunggu Persetujuan Ketua Paguyuban memiliki transaksi pembayaran aktif dengan kecocokan ID anggota yang valid, dan tidak ditemukan nomor anggota (NPA) kembar. Anda tetap dapat memilih tab <strong>Telusuri Detail Warga</strong> atau <strong>Log Mutasi Sistem</strong> untuk audit manual.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((item) => {
                    const topCause = item.probableCauses[0];
                    return (
                      <div
                        key={item.member.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start gap-4 ${
                          item.severity === 'critical'
                            ? 'bg-rose-50/50 border-rose-200'
                            : 'bg-amber-50/50 border-amber-200'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                item.severity === 'critical'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {item.severity === 'critical' ? 'Anomali Kritis' : 'Peringatan'}
                            </span>
                            <span className="text-sm font-black text-slate-900">
                              {item.member.name}
                            </span>
                            <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[11px] font-bold text-slate-700">
                              {item.member.memberNumber}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {item.member.cluster || '-'}
                            </span>
                          </div>

                          <p className="text-xs font-extrabold text-rose-900">
                            {item.headline} (Status saat ini: <span className="underline">{item.member.status}</span>)
                          </p>

                          {topCause && (
                            <div className="text-[11px] text-slate-700 bg-white/80 border border-slate-200/80 rounded-xl p-2.5 space-y-0.5">
                              <p className="font-bold text-slate-900">
                                Sumber Terdeteksi: {topCause.title}
                              </p>
                              <p className="text-slate-600 leading-relaxed">{topCause.evidence}</p>
                              <p className="font-mono text-[10px] text-indigo-700">
                                Modul: {topCause.sourceFile}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMemberId(item.member.id);
                              setRepairFeedback(null);
                              setActiveTab('inspect');
                            }}
                            className="w-full sm:w-auto px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Telusuri &amp; Perbaiki</span>
                          </button>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Rekomendasi: {item.recommendedStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORENSIC INSPECTOR FOR SINGLE MEMBER */}
          {activeTab === 'inspect' && (
            <div className="space-y-5">
              {/* Member Selector Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Filter nama / NPA / NIK / status warga..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                    setRepairFeedback(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {filteredMembersForInspect.map((m) => {
                    const hasAnomaly = anomalies.some((a) => a.member.id === m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {hasAnomaly ? '[ANOMALI] ' : ''}
                        {m.name} ({m.memberNumber}) — {m.status}
                      </option>
                    );
                  })}
                </select>
              </div>

              {repairFeedback && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{repairFeedback}</span>
                </div>
              )}

              {forensicReport && (
                <div className="space-y-4">
                  {/* Section A: Citizen Snapshot */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Nama &amp; Cluster</p>
                      <p className="font-black text-slate-900 mt-0.5">{forensicReport.member.name}</p>
                      <p className="text-[11px] text-slate-600">{forensicReport.member.cluster || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">ID &amp; NPA Sistem</p>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">{forensicReport.member.memberNumber}</p>
                      <p className="font-mono text-[10px] text-slate-500 truncate">{forensicReport.member.id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Status Saat Ini</p>
                      <p className="font-black text-indigo-900 mt-0.5">{forensicReport.member.status}</p>
                      <p className="text-[11px] text-slate-600">
                        RT Verification: <strong>{forensicReport.member.verificationStatus || 'Pending'}</strong>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Pembayaran ID Cocok</p>
                      <p className="font-black text-slate-900 mt-0.5 tabular-nums">
                        {forensicReport.activePaymentsStrict.length} Aktif ({forensicReport.rejectedPayments.length} Rejected)
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Verifikator RT: {forensicReport.member.verifiedByRt || forensicReport.member.rtVerifiedBy || 'Belum'}
                      </p>
                    </div>
                  </div>

                  {/* Section B: Probable Causes */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Hasil Penelusuran Sumber Kesalahan Sistem</span>
                    </h3>

                    {forensicReport.anomaly && forensicReport.anomaly.probableCauses.length > 0 ? (
                      <div className="space-y-2">
                        {forensicReport.anomaly.probableCauses.map((cause, idx) => (
                          <div
                            key={`${cause.code}-${idx}`}
                            className={`p-3.5 rounded-2xl border space-y-1 text-xs ${
                              cause.severity === 'critical'
                                ? 'bg-rose-50 border-rose-200 text-rose-950'
                                : 'bg-amber-50 border-amber-200 text-amber-950'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-black">{cause.title}</span>
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                                {cause.sourceFile}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed opacity-90">{cause.evidence}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Status warga ini konsisten dengan bukti pembayaran dan verifikasi RT yang tercatat.</span>
                      </div>
                    )}
                  </div>

                  {/* Section C: Payment Cross-Check & NPA Collision */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5">
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <span>Pemeriksaan Silang Record Pembayaran</span>
                      </h4>

                      {forensicReport.exactIdPayments.length === 0 &&
                      forensicReport.fallbackNpaPayments.length === 0 &&
                      forensicReport.fallbackNamePayments.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          0 transaksi pembayaran ditemukan untuk ID, NPA, maupun Nama warga ini.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {[
                            ...forensicReport.exactIdPayments,
                            ...forensicReport.fallbackNpaPayments,
                            ...forensicReport.fallbackNamePayments,
                          ]
                            .filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx)
                            .map((p) => {
                              const linkInfo = explainPaymentLinkMatch(p, forensicReport.member);
                              const isStrictMatch = p.memberId === forensicReport.member.id;
                              return (
                                <div
                                  key={p.id}
                                  className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                                    isStrictMatch
                                      ? 'bg-slate-50 border-slate-200'
                                      : 'bg-rose-50 border-rose-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-slate-900">
                                      {p.receiptNumber || p.id}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                        p.status === 'Verified'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : p.status === 'Pending'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </div>
                                  <p className="text-slate-700">
                                    {p.memberName} ({p.memberNumber}) &bull; {formatIDR(p.amount)}
                                  </p>
                                  <p className="font-mono text-[10px] text-slate-600">
                                    Kaitan: <strong>{linkInfo}</strong> &bull; pay.memberId={p.memberId}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5">
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-amber-600" />
                        <span>Cek Benturan NPA/Nama &amp; Antrean Sync Lokal</span>
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="font-bold text-slate-800">
                            Warga Lain dengan NPA Sama ({forensicReport.member.memberNumber}):
                          </p>
                          {forensicReport.collisionPeers.sameNpa.length === 0 ? (
                            <p className="text-[11px] text-emerald-700 mt-0.5">Tidak ada duplikasi NPA.</p>
                          ) : (
                            <div className="mt-1 space-y-2">
                              <ul className="space-y-0.5 text-[11px] text-rose-700 font-semibold">
                                {forensicReport.collisionPeers.sameNpa.map((peer) => (
                                  <li key={peer.id}>
                                    &bull; {peer.name} ({peer.id}) — Status: {peer.status}
                                  </li>
                                ))}
                              </ul>
                              {onResolveDuplicateNpas && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const norm = (forensicReport.member.memberNumber || '').trim().toLowerCase();
                                    const groups = buildDuplicateNpaResolutionPlan(members, payments);
                                    const matchingGroup = groups.find((g) => g.normalizedNpa === norm);
                                    if (matchingGroup && matchingGroup.duplicates.length > 0) {
                                      onResolveDuplicateNpas(matchingGroup.duplicates);
                                      setAuditLogs(getSystemAuditLogs());
                                      setRepairFeedback(
                                        `NPA kembar (${matchingGroup.displayNpa}) telah dirapikan: ${matchingGroup.keeper.name} tetap memakai NPA asli, sedangkan ${matchingGroup.duplicates.length} data lainnya diterbitkan NPA baru.`
                                      );
                                    }
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Pisahkan &amp; Terbitkan NPA Baru Otomatis</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="font-bold text-slate-800">
                            Antrean Sinkronisasi Cloud Lokal (localStorage):
                          </p>
                          {forensicReport.pendingCloudMemberQueue ||
                          forensicReport.pendingCloudPaymentQueue.length > 0 ? (
                            <div className="text-[11px] text-amber-800 mt-0.5 space-y-0.5">
                              {forensicReport.pendingCloudMemberQueue && (
                                <p>
                                  &bull; Antrean member tertunda: status ={' '}
                                  <strong>{forensicReport.pendingCloudMemberQueue.status}</strong>
                                </p>
                              )}
                              {forensicReport.pendingCloudPaymentQueue.length > 0 && (
                                <p>
                                  &bull; {forensicReport.pendingCloudPaymentQueue.length} pembayaran ada di antrean sync lokal.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              Tidak ada antrean sync tertunda untuk warga ini.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section D: Audit & Notification Trail */}
                  <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-slate-600" />
                      <span>Jejak Mutasi Sistem, Notifikasi &amp; Log WhatsApp</span>
                    </h4>

                    {forensicReport.relatedAuditLogs.length === 0 &&
                    forensicReport.relatedNotifications.length === 0 &&
                    forensicReport.relatedWaLogs.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">
                        Belum ada jejak log mutasi untuk warga ini (log mutasi otomatis mulai merekam setiap perubahan status mulai sekarang).
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px]">
                        {forensicReport.relatedAuditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-indigo-950">
                                [MUTASI] {log.source} &bull; {log.action}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                                {log.timestamp}
                              </span>
                            </div>
                            {log.previousStatus && log.newStatus && (
                              <p className="font-semibold text-indigo-900">
                                {log.previousStatus} &rarr; {log.newStatus}
                                {log.actor ? ` (Oleh: ${log.actor})` : ''}
                              </p>
                            )}
                            <p className="text-slate-700">{log.detail}</p>
                          </div>
                        ))}

                        {forensicReport.relatedNotifications.map((n) => (
                          <div
                            key={n.id}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">[NOTIF] {n.title}</span>
                              <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                                {n.timestamp}
                              </span>
                            </div>
                            <p className="text-slate-600">{n.message}</p>
                          </div>
                        ))}

                        {forensicReport.relatedWaLogs.map((w) => (
                          <div
                            key={w.id}
                            className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-emerald-900">
                                [WA] {w.triggerType} ({w.status})
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                                {w.timestamp}
                              </span>
                            </div>
                            <p className="text-slate-700 line-clamp-2">{w.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section E: Safe Repair Box */}
                  {canRepair && onRepairMemberStatus && forensicReport.anomaly && (
                    <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Wrench className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-xs sm:text-sm font-black text-indigo-950">
                            Perbaikan Status Aman (Sinkron Lokal + Cloud)
                          </h4>
                          <p className="text-xs text-indigo-900 leading-relaxed">
                            {forensicReport.repairExplanation}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Catatan Audit Perbaikan
                        </label>
                        <input
                          type="text"
                          value={repairReason}
                          onChange={(e) => setRepairReason(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleTriggerRepair(
                              forensicReport.recommendedStatus,
                              forensicReport.recommendedVerificationStatus
                            )
                          }
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Perbaiki ke &ldquo;{forensicReport.recommendedStatus}&rdquo;</span>
                        </button>

                        {forensicReport.recommendedStatus !== 'Menunggu Verifikasi RT' && (
                          <button
                            type="button"
                            onClick={() => handleTriggerRepair('Menunggu Verifikasi RT', 'Pending')}
                            className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Kembalikan ke &ldquo;Menunggu Verifikasi RT&rdquo;</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLOUD PAYMENT UPLOADER AUDIT LOGS */}
          {activeTab === 'uploads' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-black">Jejak Akun Pengunggah Bukti Transfer (Tersinkronisasi Cloud)</p>
                  <p className="text-[11px] text-indigo-900">
                    Mencatat ID pengguna aktif (<code className="font-mono">userId</code>), nama akun, email, peran, dan nama pengirim di rekening setiap kali bukti transfer diunggah.
                  </p>
                </div>
                {uploadMismatchCount > 0 && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 font-black text-[11px] shrink-0">
                    ⚠ {uploadMismatchCount} Selisih Pengunggah/Pengirim
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={uploadLogQuery}
                    onChange={(e) => setUploadLogQuery(e.target.value)}
                    placeholder="Cari nama anggota, nama pengunggah, userId, email, nama pengirim rekening, atau no. kwitansi..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyUploadMismatch((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                    onlyUploadMismatch
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Hanya Ketidaksesuaian ({uploadMismatchCount})</span>
                </button>
              </div>

              {filteredUploadAuditLogs.length === 0 ? (
                <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 text-center space-y-1.5">
                  <UserCheck className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Belum Ada Log Audit Upload Bukti Transfer</p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Setiap pengunggahan bukti transfer baru akan otomatis mencatat ID pengguna, akun pengunggah, dan nama pengirim ke database Cloud.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
                  {filteredUploadAuditLogs.map((entry) => {
                    const hasMismatch = entry.isAccountMismatch || entry.isSenderNameMismatch;
                    return (
                      <div
                        key={entry.id}
                        className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                          hasMismatch
                            ? 'bg-amber-50/70 border-amber-300'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black px-2 py-0.5 rounded bg-slate-900 text-white text-[10px]">
                              {entry.receiptNumber}
                            </span>
                            <span className="font-black text-slate-900">
                              Anggota: {entry.memberName} ({entry.memberNumber})
                            </span>
                            <span className="font-mono font-bold text-emerald-700">
                              {formatIDR(entry.amount)}
                            </span>
                            {hasMismatch && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Ketidaksesuaian Identitas</span>
                              </span>
                            )}
                            {!hasMismatch && entry.isUploadedOnBehalf && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                Diunggah oleh Pengurus
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                            {entry.uploadedAt}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/80 text-[11px]">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Akun Pengunggah
                            </span>
                            <span className="font-bold text-slate-900">
                              {entry.submittedByUserName}
                            </span>
                            <span className="text-slate-600 block">
                              {entry.submittedByAuthority}
                              {entry.submittedByCluster ? ` • ${entry.submittedByCluster}` : ''}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              User ID &amp; Email Pengunggah
                            </span>
                            <span className="font-mono font-bold text-indigo-800 block">
                              {entry.submittedByUserId}
                            </span>
                            <span className="text-slate-600 block truncate">
                              {entry.submittedByEmail || '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Pengirim di Rekening / Berkas
                            </span>
                            <span className="font-bold text-slate-900 block">
                              {entry.senderAccountName || '(Tidak diisi)'}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px] block truncate">
                              {entry.paymentMethod} • {entry.proofFileName || '-'}
                            </span>
                          </div>
                        </div>

                        {entry.mismatchReason && (
                          <div className="p-2 rounded-lg bg-amber-100/80 border border-amber-300 text-[11px] font-semibold text-amber-950">
                            ⚠ {entry.mismatchReason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM MUTATION AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={logQuery}
                    onChange={(e) => setLogQuery(e.target.value)}
                    placeholder="Cari log berdasarkan nama warga, NPA, fungsi sumber (App / memberRecovery)..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAuditLogs(getSystemAuditLogs())}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Muat Ulang</span>
                  </button>
                  {auditLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearSystemAuditLogs();
                        setAuditLogs([]);
                      }}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bersihkan Log</span>
                    </button>
                  )}
                </div>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 text-center space-y-1.5">
                  <History className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Belum Ada Rekaman Log Mutasi Status</p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Setiap pendaftaran warga, verifikasi RT, pengiriman bukti pembayaran, validasi/pembatalan Bendahara, pemulihan otomatis, dan perbaikan anomali akan otomatis tercatat di sini dengan sumber modul dan aktornya.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                  {filteredAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-2xl border text-xs space-y-1 ${
                        log.severity === 'error'
                          ? 'bg-rose-50/70 border-rose-200'
                          : log.severity === 'warning'
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            {log.source}
                          </span>
                          <span className="font-black text-slate-900">{log.action}</span>
                          {log.memberName && (
                            <span className="text-slate-700 font-semibold">
                              &bull; {log.memberName} ({log.memberNumber || log.memberId})
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {log.timestamp}
                        </span>
                      </div>

                      {(log.previousStatus || log.newStatus || log.actor) && (
                        <p className="text-[11px] font-bold text-indigo-900">
                          {log.previousStatus && log.newStatus
                            ? `Status: ${log.previousStatus} -> ${log.newStatus}`
                            : ''}
                          {log.matchedBy ? ` • Match: ${log.matchedBy}` : ''}
                          {log.actor ? ` • Aktor: ${log.actor}` : ''}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-700 leading-relaxed">{log.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
