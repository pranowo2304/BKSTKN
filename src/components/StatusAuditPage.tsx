import React, { useMemo, useState } from 'react';
import {
  AppNotification,
  AppUser,
  Member,
  MemberStatus,
  MemberVerificationStatus,
  Payment,
  SystemSettings,
} from '../types';
import {
  analyzeMemberStatusAnomalies,
  buildDuplicateNpaResolutionPlan,
  inspectMemberForensicTrace,
  MemberForensicReport,
  NpaReassignmentPlanItem,
} from '../lib/systemAuditLog';
import { getWhatsAppLogs } from '../lib/whatsappService';
import { formatIDR } from '../lib/storage';
import { exportStatusAuditCSV } from '../lib/csvExport';
import { SystemStatusTraceModal } from './SystemStatusTraceModal';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  Download,
  FileSearch,
  History,
  KeyRound,
  Lock,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';

interface StatusAuditPageProps {
  members: Member[];
  payments: Payment[];
  notifications?: AppNotification[];
  settings: SystemSettings;
  activeUser?: AppUser | null;
  setCurrentTab?: (tab: string) => void;
  onRepairMemberStatus: (
    memberId: string,
    targetStatus: MemberStatus,
    targetVerificationStatus: MemberVerificationStatus,
    reason: string
  ) => void;
  onBatchRepairMemberStatus?: (
    repairs: Array<{
      memberId: string;
      targetStatus: MemberStatus;
      targetVerificationStatus: MemberVerificationStatus;
      reason: string;
    }>
  ) => void;
  onResolveDuplicateNpas?: (plan?: NpaReassignmentPlanItem[]) => void;
  onSelectMemberForPayment?: (member: Member) => void;
}

type AuditFilterMode =
  | 'unpaid_bendahara'
  | 'duplicate_npa'
  | 'all_anomalies'
  | 'all_bendahara_queue';

export const StatusAuditPage: React.FC<StatusAuditPageProps> = ({
  members,
  payments,
  notifications = [],
  settings,
  activeUser,
  setCurrentTab,
  onRepairMemberStatus,
  onBatchRepairMemberStatus,
  onResolveDuplicateNpas,
  onSelectMemberForPayment,
}) => {
  const [filterMode, setFilterMode] = useState<AuditFilterMode>('unpaid_bendahara');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [clusterFilter, setClusterFilter] = useState<string>('Semua');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [traceModalOpen, setTraceModalOpen] = useState<boolean>(false);
  const [traceMemberId, setTraceMemberId] = useState<string | undefined>(undefined);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const waLogs = useMemo(() => getWhatsAppLogs(), [members.length, payments.length]);

  // Precompute forensic reports for relevant members once
  const forensicByMemberId = useMemo(() => {
    const map = new Map<string, MemberForensicReport>();
    for (const member of members) {
      if (!member) continue;
      map.set(
        member.id,
        inspectMemberForensicTrace({
          member,
          allMembers: members,
          payments,
          notifications,
          whatsappLogs: waLogs,
        })
      );
    }
    return map;
  }, [members, payments, notifications, waLogs]);

  const allAnomalies = useMemo(() => {
    return analyzeMemberStatusAnomalies({
      members,
      payments,
      notifications,
      whatsappLogs: waLogs,
    });
  }, [members, payments, notifications, waLogs]);

  const unpaidBendaharaAnomalies = useMemo(
    () => allAnomalies.filter((a) => a.categories.includes('UNPAID_AWAITING_BENDAHARA')),
    [allAnomalies]
  );

  const duplicateNpaGroups = useMemo(
    () => buildDuplicateNpaResolutionPlan(members, payments),
    [members, payments]
  );

  const totalDuplicateAffectedMembers = useMemo(
    () => duplicateNpaGroups.reduce((sum, g) => sum + g.members.length, 0),
    [duplicateNpaGroups]
  );

  const allDuplicateReassignments = useMemo(
    () => duplicateNpaGroups.flatMap((g) => g.duplicates),
    [duplicateNpaGroups]
  );

  const bendaharaQueueMembers = useMemo(
    () => members.filter((m) => m.status === 'Menunggu Validasi Bendahara'),
    [members]
  );

  const validBendaharaCount = Math.max(
    0,
    bendaharaQueueMembers.length - unpaidBendaharaAnomalies.length
  );

  const availableClusters = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.cluster) set.add(m.cluster);
    });
    return Array.from(set).sort();
  }, [members]);

  // Determine visible rows based on selected filter tab
  const visibleRows = useMemo(() => {
    let baseMembers: Member[];
    if (filterMode === 'unpaid_bendahara') {
      baseMembers = unpaidBendaharaAnomalies.map((a) => a.member);
    } else if (filterMode === 'duplicate_npa') {
      baseMembers = duplicateNpaGroups.flatMap((g) => g.members);
    } else if (filterMode === 'all_anomalies') {
      baseMembers = allAnomalies.map((a) => a.member);
    } else {
      baseMembers = bendaharaQueueMembers;
    }

    const q = searchTerm.trim().toLowerCase();
    return baseMembers.filter((m) => {
      if (clusterFilter !== 'Semua' && m.cluster !== clusterFilter) {
        return false;
      }
      if (!q) return true;
      return (
        m.name?.toLowerCase().includes(q) ||
        m.memberNumber?.toLowerCase().includes(q) ||
        m.nik?.toLowerCase().includes(q) ||
        m.cluster?.toLowerCase().includes(q)
      );
    });
  }, [
    filterMode,
    unpaidBendaharaAnomalies,
    duplicateNpaGroups,
    allAnomalies,
    bendaharaQueueMembers,
    searchTerm,
    clusterFilter,
  ]);

  const repairableVisibleRows = useMemo(
    () =>
      visibleRows.filter((m) => {
        const rep = forensicByMemberId.get(m.id);
        return Boolean(rep?.anomaly);
      }),
    [visibleRows, forensicByMemberId]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllRepairable = () => {
    if (
      repairableVisibleRows.length > 0 &&
      repairableVisibleRows.every((m) => selectedIds.has(m.id))
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(repairableVisibleRows.map((m) => m.id)));
    }
  };

  const handleSingleQuickRepair = (member: Member, report: MemberForensicReport) => {
    const reason =
      `Audit Status: Warga berstatus "${member.status}" tanpa entri pembayaran valid (aktif). Dikembalikan ke "${report.recommendedStatus}".`;
    onRepairMemberStatus(
      member.id,
      report.recommendedStatus,
      report.recommendedVerificationStatus,
      reason
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(member.id);
      return next;
    });
    setFeedbackMsg(
      `Status "${member.name}" (${member.memberNumber}) berhasil dikembalikan ke "${report.recommendedStatus}".`
    );
  };

  const handleExecuteBatchRepair = () => {
    const targets = repairableVisibleRows.filter((m) => selectedIds.has(m.id));
    if (targets.length === 0) return;

    const repairs = targets
      .map((m) => {
        const rep = forensicByMemberId.get(m.id);
        if (!rep) return null;
        return {
          memberId: m.id,
          targetStatus: rep.recommendedStatus,
          targetVerificationStatus: rep.recommendedVerificationStatus,
          reason: `Perbaikan massal Audit Status: status "${m.status}" tidak memiliki bukti pembayaran valid. Dikembalikan ke "${rep.recommendedStatus}".`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (repairs.length === 0) return;

    if (onBatchRepairMemberStatus) {
      onBatchRepairMemberStatus(repairs);
    } else {
      repairs.forEach((r) =>
        onRepairMemberStatus(
          r.memberId,
          r.targetStatus,
          r.targetVerificationStatus,
          r.reason
        )
      );
    }

    setSelectedIds(new Set());
    setFeedbackMsg(
      `${repairs.length} data anomali warga berhasil diperbaiki ke status semestinya dan disinkronkan ke Cloud Firestore.`
    );
  };

  const handleResolveNpaGroup = (items: NpaReassignmentPlanItem[], label?: string) => {
    if (!onResolveDuplicateNpas || items.length === 0) return;
    onResolveDuplicateNpas(items);
    const preview = items.map((x) => `${x.member.name}: ${x.oldNpa} -> ${x.newNpa}`).join('; ');
    setFeedbackMsg(
      `${items.length} data warga dengan NPA kembar${label ? ` (${label})` : ''} telah diterbitkan NPA unik baru (${preview}) dan disinkronkan ke Cloud Firestore.`
    );
  };

  const handleDownloadAuditReport = () => {
    exportStatusAuditCSV({
      anomalies: unpaidBendaharaAnomalies,
      forensicByMemberId,
      settings,
    });
    setFeedbackMsg(
      `Laporan Audit Status (${unpaidBendaharaAnomalies.length} anggota berstatus "Menunggu Validasi Bendahara" tanpa pembayaran valid) berhasil diunduh dalam format CSV.`
    );
  };

  const canAuditAndRepair = activeUser?.authority === 'Admin';

  if (activeUser?.authority !== 'Admin') {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <Lock className="w-7 h-7" />
          </div>
          <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] font-black uppercase tracking-wider border border-rose-200">
            Akses Terbatas: Khusus Admin
          </span>
          <h2 className="text-xl font-black text-slate-900">
            Fitur Audit Status Hanya Dapat Diakses oleh Admin
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Halaman Audit Status, pelacakan anomali mutasi sistem, dan perbaikan NPA kembar hanya tersedia untuk peran <strong>Admin</strong> guna menjaga integritas data paguyuban.
          </p>
          {setCurrentTab && (
            <button
              type="button"
              onClick={() => setCurrentTab(activeUser?.authority === 'Anggota' ? 'member-portal' : 'dashboard')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              Kembali ke Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-2xl border border-slate-800 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold border border-indigo-500/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit Status Keanggotaan &amp; Rekonsiliasi Kas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Audit Status — Deteksi Antrean Bendahara Tanpa Pembayaran
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Mengidentifikasi anggota yang berstatus{' '}
            <strong className="text-amber-300">Menunggu Validasi Bendahara</strong> namun belum
            memiliki entri pembayaran aktif (Pending/Verified), melacak sumber anomali (NPA kembar,
            transaksi ditolak/terhapus, atau sync tertunda), dan memperbaiki status secara cepat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadAuditReport}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Unduh daftar anggota berstatus Menunggu Validasi Bendahara tanpa entri pembayaran dalam format CSV"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan Audit</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-black tabular-nums">
              {unpaidBendaharaAnomalies.length}
            </span>
          </button>
          {setCurrentTab && (
            <button
              type="button"
              onClick={() => setCurrentTab('validation')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>Buka Validasi Kas</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTraceMemberId(undefined);
              setTraceModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <History className="w-4 h-4" />
            <span>Log Mutasi &amp; Forensik</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          className={`p-4 rounded-2xl border shadow-xs ${
            unpaidBendaharaAnomalies.length > 0
              ? 'bg-rose-50 border-rose-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <p
            className={`text-[11px] font-bold uppercase tracking-wider ${
              unpaidBendaharaAnomalies.length > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            Belum Ada Pembayaran Valid
          </p>
          <p
            className={`text-2xl font-black mt-1 tabular-nums ${
              unpaidBendaharaAnomalies.length > 0 ? 'text-rose-900' : 'text-emerald-900'
            }`}
          >
            {unpaidBendaharaAnomalies.length}{' '}
            <span className="text-xs font-bold">Warga</span>
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Status &ldquo;Menunggu Validasi Bendahara&rdquo; tanpa struk aktif
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Total Anomali Sistem
          </p>
          <p className="text-2xl font-black text-amber-950 mt-1 tabular-nums">
            {allAnomalies.length} <span className="text-xs font-bold">Warga</span>
          </p>
          <p className="text-[11px] text-amber-800/90 mt-1">
            Termasuk NPA kembar &amp; bypass tahap verifikasi
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200 bg-white shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Antrean Bendahara Sah
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {validBendaharaCount} <span className="text-xs font-bold text-slate-600">Warga</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Memiliki bukti transfer Pending yang cocok ID
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Populasi Diaudit
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {members.length} <span className="text-xs font-bold text-slate-600">Anggota</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            Dicocokkan terhadap {payments.length} entri pembayaran
          </p>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-black px-2 py-0.5 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFilterMode('unpaid_bendahara');
                setSelectedIds(new Set());
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer border ${
                filterMode === 'unpaid_bendahara'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Belum Ada Pembayaran Valid</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                  filterMode === 'unpaid_bendahara'
                    ? 'bg-white text-rose-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {unpaidBendaharaAnomalies.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterMode('duplicate_npa');
                setSelectedIds(new Set());
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer border ${
                filterMode === 'duplicate_npa'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>NPA Kembar</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                  filterMode === 'duplicate_npa'
                    ? 'bg-white text-indigo-800'
                    : duplicateNpaGroups.length > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {totalDuplicateAffectedMembers}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterMode('all_anomalies');
                setSelectedIds(new Set());
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer border ${
                filterMode === 'all_anomalies'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Semua Anomali Status</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                  filterMode === 'all_anomalies'
                    ? 'bg-white text-amber-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {allAnomalies.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterMode('all_bendahara_queue');
                setSelectedIds(new Set());
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer border ${
                filterMode === 'all_bendahara_queue'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>Semua Antrean Bendahara</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 tabular-nums">
                {bendaharaQueueMembers.length}
              </span>
            </button>
          </div>

          {/* Batch Repair Action */}
          {canAuditAndRepair && repairableVisibleRows.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleSelectAllRepairable}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                {repairableVisibleRows.every((m) => selectedIds.has(m.id))
                  ? 'Batal Pilih Semua'
                  : `Pilih Semua (${repairableVisibleRows.length})`}
              </button>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleExecuteBatchRepair}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Perbaiki Terpilih ({selectedIds.size})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search + Cluster filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama warga, NPA (ADK-2026-...), NIK, atau cluster..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Semua">Semua Cluster ({members.length})</option>
            {availableClusters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DUPLICATE NPA RESOLUTION PANEL */}
      {duplicateNpaGroups.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[11px] font-black">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    Terdeteksi {duplicateNpaGroups.length} NPA Kembar ({totalDuplicateAffectedMembers} Data Warga)
                  </span>
                </span>
              </div>
              <p className="text-xs text-amber-950 leading-relaxed">
                Sistem mempertahankan NPA asli untuk <strong>pemilik sah (pendaftar awal / pembayaran Verified)</strong>,
                dan menerbitkan <strong>NPA unik baru</strong> secara otomatis untuk data kembar lainnya (serta memperbarui tautan transaksi, akun user, &amp; cloud berdasarkan <code className="font-mono bg-white/70 px-1 rounded">memberId</code>).
              </p>
            </div>

            {canAuditAndRepair && onResolveDuplicateNpas && (
              <button
                type="button"
                onClick={() => handleResolveNpaGroup(allDuplicateReassignments)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Terbitkan {allDuplicateReassignments.length} NPA Baru Otomatis</span>
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {duplicateNpaGroups.map((group) => (
              <div
                key={group.normalizedNpa}
                className="bg-white rounded-xl border border-amber-200 p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono font-black px-2 py-0.5 bg-slate-900 text-white rounded">
                      {group.displayNpa}
                    </span>
                    <span className="font-bold text-slate-700">
                      Dipakai bersama oleh {group.members.length} data warga
                    </span>
                  </div>
                  {canAuditAndRepair && onResolveDuplicateNpas && (
                    <button
                      type="button"
                      onClick={() => handleResolveNpaGroup(group.duplicates, group.displayNpa)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Rapikan {group.displayNpa}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      Tetap Pakai NPA Asli ({group.displayNpa})
                    </p>
                    <p className="font-black text-slate-900">
                      {group.keeper.name}{' '}
                      <span className="font-mono text-[10px] font-normal text-slate-500">
                        ({group.keeper.id})
                      </span>
                    </p>
                    <p className="text-[11px] text-emerald-900">
                      Status: <strong>{group.keeper.status}</strong> &bull; {group.keeperReason}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
                      Diterbitkan NPA Unik Baru ({group.duplicates.length} Data)
                    </p>
                    {group.duplicates.map((dup) => (
                      <div
                        key={dup.member.id}
                        className="flex items-center justify-between gap-2 text-[11px] bg-white px-2.5 py-1.5 rounded border border-indigo-100 flex-wrap"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{dup.member.name}</span>{' '}
                          <span className="text-slate-500">({dup.member.status})</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono font-bold">
                          <span className="text-rose-600 line-through">{dup.oldNpa}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            {dup.newNpa}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT RESULTS TABLE */}
      {visibleRows.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            {filterMode === 'unpaid_bendahara'
              ? 'Tidak Ada Anggota Bermasalah di Antrean Bendahara'
              : 'Tidak Ada Data Anomali yang Cocok'}
          </h3>
          <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
            {filterMode === 'unpaid_bendahara'
              ? 'Semua anggota dengan status "Menunggu Validasi Bendahara" saat ini telah memiliki entri pembayaran yang valid.'
              : 'Tidak ditemukan data sesuai filter pencarian saat ini.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    {canAuditAndRepair && repairableVisibleRows.length > 0 && (
                      <input
                        type="checkbox"
                        checked={
                          repairableVisibleRows.length > 0 &&
                          repairableVisibleRows.every((m) => selectedIds.has(m.id))
                        }
                        onChange={toggleSelectAllRepairable}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Pilih semua baris anomali"
                      />
                    )}
                  </th>
                  <th className="py-3.5 px-3">Anggota &amp; Cluster</th>
                  <th className="py-3.5 px-3">Status &amp; Verifikasi RT</th>
                  <th className="py-3.5 px-3">Validitas Pembayaran &amp; Diagnosa</th>
                  <th className="py-3.5 px-4 text-right">Tindakan Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleRows.map((member) => {
                  const report = forensicByMemberId.get(member.id);
                  const anomaly = report?.anomaly || null;
                  const topCause = anomaly?.probableCauses[0];
                  const activeStrict = report?.activePaymentsStrict || [];
                  const rejectedList = report?.rejectedPayments || [];
                  const collisionNpa = report?.collisionPeers.sameNpa || [];
                  const isRepairable = Boolean(anomaly);
                  const isChecked = selectedIds.has(member.id);

                  return (
                    <tr
                      key={member.id}
                      className={`transition-colors ${
                        anomaly
                          ? 'bg-rose-50/35 hover:bg-rose-50/70'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 align-top">
                        {canAuditAndRepair && isRepairable && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(member.id)}
                            className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                      </td>

                      {/* Member Info */}
                      <td className="py-3.5 px-3 align-top space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900">{member.name}</span>
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] font-bold text-slate-700">
                            {member.memberNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {member.cluster || '-'} &bull; Terdaftar: {member.joinDate || '-'}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          ID: {member.id}
                        </p>
                      </td>

                      {/* Status & RT */}
                      <td className="py-3.5 px-3 align-top space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                            anomaly
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          {member.status}
                        </span>
                        <p className="text-[11px] text-slate-600">
                          Verifikasi RT:{' '}
                          <strong className="text-slate-800">
                            {member.verificationStatus || 'Pending'}
                          </strong>
                          {member.verifiedByRt ? ` (${member.verifiedByRt})` : ''}
                        </p>
                      </td>

                      {/* Payment Evidence & Cause */}
                      <td className="py-3.5 px-3 align-top space-y-1.5 max-w-md">
                        {activeStrict.length > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>
                                {activeStrict.length} Pembayaran Valid ({activeStrict[0].receiptNumber}{' '}
                                &bull; {formatIDR(activeStrict[0].amount)})
                              </span>
                            </span>
                            {anomaly && topCause && (
                              <p className="text-[11px] text-amber-800 font-medium">
                                Catatan: {topCause.title}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-extrabold">
                              <AlertTriangle className="w-3 h-3" />
                              <span>0 Entri Pembayaran Valid (Pending/Verified)</span>
                            </span>
                            {rejectedList.length > 0 && (
                              <p className="text-[11px] text-amber-800 font-semibold">
                                Ditemukan {rejectedList.length} pembayaran berstatus Rejected (
                                {rejectedList[0].receiptNumber})
                              </p>
                            )}
                            {collisionNpa.length > 0 && (
                              <p className="text-[11px] text-rose-700 font-semibold">
                                NPA kembar dengan: {collisionNpa.map((c) => c.name).join(', ')}
                              </p>
                            )}
                            {topCause && (
                              <p className="text-[11px] text-slate-600 leading-snug">
                                {topCause.title}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {canAuditAndRepair && anomaly && report && (
                            <button
                              type="button"
                              onClick={() => handleSingleQuickRepair(member, report)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-2xs inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              title={`Koreksi status ke "${report.recommendedStatus}"`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Ke &ldquo;{report.recommendedStatus}&rdquo;</span>
                            </button>
                          )}

                          {onSelectMemberForPayment && (
                            <button
                              type="button"
                              onClick={() => onSelectMemberForPayment(member)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              title="Input pembayaran iuran warga ini secara manual"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Input Bayar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setTraceMemberId(member.id);
                              setTraceModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] font-bold rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            title="Lihat rincian forensik, log mutasi, dan opsi perbaikan lain"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Detail</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORENSIC TRACE & LOG MODAL */}
      <SystemStatusTraceModal
        isOpen={traceModalOpen}
        onClose={() => setTraceModalOpen(false)}
        members={members}
        payments={payments}
        notifications={notifications}
        initialMemberId={traceMemberId}
        onRepairMemberStatus={onRepairMemberStatus}
        onResolveDuplicateNpas={onResolveDuplicateNpas}
      />
    </div>
  );
};
