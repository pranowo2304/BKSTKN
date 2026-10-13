import React, { useState } from 'react';
import { Member, Payment, MemberStatusHistoryItem } from '../types';
import { getMemberStatusTimeline } from '../lib/memberTimelineUtils';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  UserCheck,
  CreditCard,
  Crown,
  FileText,
  UserPlus,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Home,
  Info,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface MemberStatusTimelineProps {
  member: Member;
  payments?: Payment[];
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  onNavigateToPayment?: () => void;
  onNavigateToRtVerification?: () => void;
}

export const MemberStatusTimeline: React.FC<MemberStatusTimelineProps> = ({
  member,
  payments = [],
  isCollapsible = false,
  defaultExpanded = true,
  onNavigateToPayment,
  onNavigateToRtVerification,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<string | null>(null);

  if (!member) {
    return null;
  }

  const timelineItems = getMemberStatusTimeline(member, payments);

  // Determine stage progression numbers
  const completedCount = timelineItems.filter((i) => i.isCompleted).length;
  const totalStandardStages = 5; // Registered -> RT Verified -> Payment Validated -> Paguyuban Approved -> Active
  const progressPercent = Math.min(100, Math.round((completedCount / totalStandardStages) * 100));

  const handleCopyAuditTrail = () => {
    const lines = [
      `=== JEJAK AUDIT STATUS ANGGOTA PAGUYUBAN DANA KEMATIAN ===`,
      `Nama Anggota   : ${member?.name || '-'}`,
      `Nomor Anggota  : ${member?.memberNumber || '-'}`,
      `NIK            : ${member?.nik || '-'}`,
      `Cluster        : ${member?.cluster || '-'}`,
      `Status Terkini : ${member?.status || '-'}`,
      `Tanggal Cetak  : ${new Date().toLocaleString('id-ID')}`,
      `--------------------------------------------------------`,
      `RIWAYAT TAHAPAN (TIMELINE):`,
      ...timelineItems.map((item, idx) => {
        return [
          `[${idx + 1}] ${item.title}`,
          `    Waktu       : ${item.timestamp}`,
          `    Status      : ${item.status}`,
          `    Pelaksana   : ${item.actor} (${item.actorRole})`,
          `    Keterangan  : ${item.notes || item.description}`,
          item.metadata?.receiptNumber ? `    No Kwitansi : ${item.metadata.receiptNumber}` : null,
          item.metadata?.amount ? `    Nominal     : Rp ${item.metadata.amount.toLocaleString('id-ID')}` : null,
          `--------------------------------------------------------`,
        ]
          .filter(Boolean)
          .join('\n');
      }),
    ].join('\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="bg-slate-50/90 rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
      {/* HEADER SECTION */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 text-[10px] font-mono font-bold uppercase tracking-wider border border-indigo-400/30">
              Audit Trail
            </span>
            <span className="font-mono text-xs text-slate-300 font-bold">
              {member.memberNumber}
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-300 font-medium">{member.name}</span>
          </div>
          <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Riwayat Perubahan Status Keanggotaan</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Jejak kronologis validasi berjenjang (Pendaftaran ➔ Verifikasi RT ➔ Pembayaran ➔ KTA Aktif).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleCopyAuditTrail}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
            title="Salin ringkasan jejak audit ke clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 text-[11px]">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">Salin Jejak Audit</span>
              </>
            )}
          </button>

          {isCollapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors border border-slate-700 cursor-pointer"
              title={isExpanded ? 'Sembunyikan Timeline' : 'Tampilkan Timeline'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* EXPANDABLE BODY */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* HIGH-LEVEL PROGRESS STEPPER BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Tahapan Siklus Hidup Keanggotaan</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {completedCount}/{totalStandardStages} Tahap Selesai ({progressPercent}%)
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase ${
                    member.status === 'Aktif'
                      ? 'bg-emerald-100 text-emerald-800'
                      : member.status === 'Ditolak'
                      ? 'bg-rose-100 text-rose-800'
                      : member.status === 'Menunggu Verifikasi RT'
                      ? 'bg-amber-100 text-amber-900'
                      : member.status === 'Menunggu Validasi Bendahara'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-indigo-100 text-indigo-900'
                  }`}
                >
                  Status: {member.status}
                </span>
              </div>
            </div>

            {/* Step Pipeline Visualization */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
              {/* Step 1: Registered */}
              <div className="p-2.5 rounded-xl border bg-emerald-50/70 border-emerald-200 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Tahap 1</p>
                  <p className="text-xs font-black text-slate-900 truncate">Pendaftaran</p>
                  <p className="text-[10px] text-emerald-700 font-medium">Registered</p>
                </div>
              </div>

              {/* Step 2: RT Verified */}
              {(() => {
                const rtStep = timelineItems.find((i) => i.stage === 'rt_verified' || i.stage === 'rejected');
                const isRtDone = rtStep?.isCompleted && rtStep.stage !== 'rejected';
                const isRtRej = rtStep?.stage === 'rejected';
                return (
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      isRtRej
                        ? 'bg-rose-50/80 border-rose-200'
                        : isRtDone
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-amber-50/60 border-amber-200 animate-pulse'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs text-white ${
                        isRtRej ? 'bg-rose-600' : isRtDone ? 'bg-emerald-600' : 'bg-amber-500'
                      }`}
                    >
                      {isRtRej ? (
                        <XCircle className="w-4 h-4" />
                      ) : isRtDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isRtRej ? 'text-rose-900' : isRtDone ? 'text-emerald-900' : 'text-amber-900'
                        }`}
                      >
                        Tahap 2
                      </p>
                      <p className="text-xs font-black text-slate-900 truncate">Verifikasi RT</p>
                      <p
                        className={`text-[10px] font-medium truncate ${
                          isRtRej ? 'text-rose-700' : isRtDone ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isRtRej ? 'Ditolak' : isRtDone ? 'RT Verified' : 'Menunggu RT'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Step 3: Payment Validated */}
              {(() => {
                const payStep = timelineItems.find((i) => i.stage === 'payment_validated' || i.stage === 'payment_submitted');
                const isPayDone = payStep?.isCompleted;
                const isPayPending = payStep?.status === 'Menunggu Validasi Bendahara';
                const isWaitingPay = payStep?.status === 'Menunggu Pembayaran';
                return (
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      isPayDone
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : isPayPending
                        ? 'bg-sky-50/80 border-sky-200'
                        : isWaitingPay
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs text-white ${
                        isPayDone
                          ? 'bg-emerald-600'
                          : isPayPending
                          ? 'bg-sky-600'
                          : isWaitingPay
                          ? 'bg-amber-500'
                          : 'bg-slate-300 text-slate-600'
                      }`}
                    >
                      {isPayDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isPayPending ? (
                        <Clock className="w-4 h-4" />
                      ) : isWaitingPay ? (
                        <CreditCard className="w-4 h-4" />
                      ) : (
                        <span>3</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isPayDone
                            ? 'text-emerald-900'
                            : isPayPending
                            ? 'text-sky-900'
                            : isWaitingPay
                            ? 'text-amber-900'
                            : 'text-slate-500'
                        }`}
                      >
                        Tahap 3
                      </p>
                      <p className="text-xs font-black text-slate-900 truncate">Validasi Bayar</p>
                      <p
                        className={`text-[10px] font-medium truncate ${
                          isPayDone
                            ? 'text-emerald-700'
                            : isPayPending
                            ? 'text-sky-700'
                            : isWaitingPay
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {isPayDone
                          ? 'Payment Validated'
                          : isPayPending
                          ? 'Menunggu Validasi'
                          : isWaitingPay
                          ? 'Menunggu Bayar'
                          : 'Belum Dibuka'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Step 4: Persetujuan Akhir Ketua Paguyuban */}
              {(() => {
                const paguyubanStep = timelineItems.find((i) => i.stage === 'paguyuban_approved');
                const isPaguyubanDone = paguyubanStep?.isCompleted;
                const isAwaitingPaguyuban = member.status === 'Menunggu Persetujuan Ketua Paguyuban' || paguyubanStep?.isCurrent;
                return (
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      isPaguyubanDone
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : isAwaitingPaguyuban
                        ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-200 animate-pulse'
                        : 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs text-white ${
                        isPaguyubanDone
                          ? 'bg-emerald-600'
                          : isAwaitingPaguyuban
                          ? 'bg-purple-600'
                          : 'bg-slate-300 text-slate-600'
                      }`}
                    >
                      {isPaguyubanDone ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isAwaitingPaguyuban ? (
                        <Crown className="w-4 h-4" />
                      ) : (
                        <span>4</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isPaguyubanDone
                            ? 'text-emerald-900'
                            : isAwaitingPaguyuban
                            ? 'text-purple-900'
                            : 'text-slate-500'
                        }`}
                      >
                        Tahap 4
                      </p>
                      <p className="text-xs font-black text-slate-900 truncate">Persetujuan Paguyuban</p>
                      <p
                        className={`text-[10px] font-medium truncate ${
                          isPaguyubanDone
                            ? 'text-emerald-700'
                            : isAwaitingPaguyuban
                            ? 'text-purple-700 font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {isPaguyubanDone ? 'Disetujui Ketua' : isAwaitingPaguyuban ? 'Menunggu Ketua' : 'Belum Terbuka'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Step 5: Active & KTA */}
              {(() => {
                const isAct = member.status === 'Aktif';
                return (
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      isAct
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs text-white ${
                        isAct ? 'bg-emerald-600' : 'bg-slate-300 text-slate-600'
                      }`}
                    >
                      {isAct ? <Crown className="w-4 h-4" /> : <span>5</span>}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isAct ? 'text-emerald-900' : 'text-slate-500'
                        }`}
                      >
                        Tahap 5
                      </p>
                      <p className="text-xs font-black text-slate-900 truncate">Anggota Aktif & KTA</p>
                      <p
                        className={`text-[10px] font-medium truncate ${
                          isAct ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {isAct ? 'Active & KTA Sah' : 'Menunggu Selesai'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* CHRONOLOGICAL AUDIT TRAIL LIST (VERTICAL TIMELINE) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Catatan Riwayat & Waktu Audit (Audit Log Trail)</span>
              </h5>
              <span className="text-[11px] text-slate-500 font-medium">
                {timelineItems.length} Catatan Aktivitas
              </span>
            </div>

            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-3 sm:before:left-4 before:w-0.5 before:bg-slate-200">
              {timelineItems.map((item, index) => {
                const isStepCompleted = item.isCompleted;
                const isStepCurrent = item.isCurrent;
                const isStepRejected = item.stage === 'rejected' || item.status === 'Ditolak';

                // Dot & border colors
                let dotBg = 'bg-slate-300 border-slate-100 text-slate-500';
                let cardBorder = 'border-slate-200 bg-white';
                let badgeClass = 'bg-slate-100 text-slate-700';

                if (isStepRejected) {
                  dotBg = 'bg-rose-600 border-rose-100 text-white shadow-sm ring-4 ring-rose-100';
                  cardBorder = 'border-rose-200 bg-rose-50/40';
                  badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-black';
                } else if (isStepCompleted) {
                  dotBg = 'bg-emerald-600 border-emerald-100 text-white shadow-sm ring-4 ring-emerald-100';
                  cardBorder = 'border-emerald-200/90 bg-white hover:border-emerald-300';
                  badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                } else if (isStepCurrent) {
                  dotBg = 'bg-amber-500 border-amber-100 text-white shadow-sm ring-4 ring-amber-100 animate-pulse';
                  cardBorder = 'border-amber-300 bg-amber-50/30';
                  badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                }

                return (
                  <div key={item.id} className="relative group">
                    {/* Node Dot on Timeline */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-3.5 -translate-x-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all z-10 ${dotBg}`}
                    >
                      {isStepRejected ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : isStepCompleted ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : isStepCurrent ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>

                    {/* Card Content */}
                    <div
                      className={`p-4 rounded-2xl border shadow-2xs transition-all ${cardBorder}`}
                    >
                      {/* Top Header of the Timeline Event */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              Langkah {index + 1}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] rounded-md border ${badgeClass}`}>
                              {item.status}
                            </span>
                          </div>
                          <h6 className="text-sm font-extrabold text-slate-900 mt-1">
                            {item.title}
                          </h6>
                        </div>

                        {/* Timestamp badge */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono font-bold self-start sm:self-center shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.timestamp}</span>
                        </div>
                      </div>

                      {/* Actor & Authority Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-700">
                          <span className="text-slate-400 font-medium shrink-0">Pelaksana:</span>
                          <span className="font-bold text-slate-900 truncate">{item.actor}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <span className="text-slate-400 font-medium shrink-0">Jabatan/Otoritas:</span>
                          <span className="font-bold text-indigo-700 truncate">{item.actorRole}</span>
                        </div>
                      </div>

                      {/* Notes / Descriptions */}
                      <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                        <p className="text-slate-600 font-medium">
                          {item.description}
                        </p>
                        {item.notes && (
                          <div className="p-2.5 bg-slate-100/80 rounded-xl border border-slate-200/80 text-[11px] text-slate-800 space-y-1">
                            <span className="font-bold text-slate-900 block">Catatan Audit / Tindakan:</span>
                            <p className="italic">{item.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Metadata badges if available */}
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100 text-[11px]">
                          {item.metadata.receiptNumber && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold">
                              Kwitansi: {item.metadata.receiptNumber}
                            </span>
                          )}
                          {item.metadata.amount && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold">
                              Rp {item.metadata.amount.toLocaleString('id-ID')}
                            </span>
                          )}
                          {item.metadata.paymentMethod && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                              Metode: {item.metadata.paymentMethod}
                            </span>
                          )}
                          {item.metadata.familyCardNumber && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-mono">
                              No. KK: {item.metadata.familyCardNumber}
                            </span>
                          )}
                          {item.metadata.cluster && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                              Wilayah: {item.metadata.cluster}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quick Navigation Button if action is needed */}
                      {isStepCurrent && !isStepCompleted && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Menunggu tindakan penyelesaian tahap ini.</span>
                          </span>
                          {item.stage === 'rt_verified' && onNavigateToRtVerification && (
                            <button
                              type="button"
                              onClick={onNavigateToRtVerification}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <span>Buka Verifikasi RT</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {item.stage === 'payment_validated' && onNavigateToPayment && (
                            <button
                              type="button"
                              onClick={onNavigateToPayment}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <span>Input / Validasi Bayar</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AUDIT SUMMARY & INTEGRITY DISCLAIMER */}
          <div className="p-3.5 bg-slate-100/90 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-slate-800">
                Integritas Jejak Audit Sistem Paguyuban Dana Kematian
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Setiap pergantian status anggota dicatat dengan stempel waktu, nama pelaksana, dan dokumen pendukung (KTP/KK, kwitansi pembayaran, KTA Digital). Data terlindungi untuk keperluan audit kepengurusan dan transparansi paguyuban.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
