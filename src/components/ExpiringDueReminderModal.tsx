import React, { useState } from 'react';
import { Member, Payment, SystemSettings } from '../types';
import {
  Expiring7DaysSummary,
  generate7DayReminderWhatsAppUrl,
  generateOutreachTextMessage,
  MemberAnnualExpiryInfo,
} from '../lib/expiryUtils';
import { formatIDR } from '../lib/storage';
import {
  X,
  Bell,
  Clock,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  Search,
  Copy,
  Check,
  Calendar,
  Building2,
  Phone,
  ArrowRight,
  Send,
  Users,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface ExpiringDueReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: Expiring7DaysSummary;
  payments: Payment[];
  settings: SystemSettings;
  onSelectMemberForPayment?: (member: Member) => void;
}

export const ExpiringDueReminderModal: React.FC<ExpiringDueReminderModalProps> = ({
  isOpen,
  onClose,
  summary,
  payments,
  settings,
  onSelectMemberForPayment,
}) => {
  const [filterTab, setFilterTab] = useState<'expiring7' | 'overdue' | 'all'>('expiring7');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const { expiringMembers, overdueMembers, expiringCount, overdueCount, totalAmountDue } = summary;

  // Determine active list
  let displayList =
    filterTab === 'expiring7'
      ? expiringMembers
      : filterTab === 'overdue'
      ? overdueMembers
      : [...expiringMembers, ...overdueMembers];

  // Apply search filter
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    displayList = displayList.filter(
      (item) =>
        item.member.name.toLowerCase().includes(term) ||
        item.member.memberNumber.toLowerCase().includes(term) ||
        (item.member.cluster && item.member.cluster.toLowerCase().includes(term)) ||
        (item.member.phone && item.member.phone.includes(term))
    );
  }

  const handleCopyMessage = (member: Member, expiryInfo: MemberAnnualExpiryInfo) => {
    const msg = generateOutreachTextMessage(member, expiryInfo, settings);
    navigator.clipboard.writeText(msg);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handlePayRenewal = (member: Member) => {
    if (onSelectMemberForPayment) {
      onSelectMemberForPayment(member);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-500/30 rounded-xl border border-amber-400/40 text-amber-100">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                  Monitoring Masa Berlaku Iuran
                </span>
                <span className="text-xs text-amber-100 font-mono font-bold">
                  Batas Waktu: ≤ 7 Hari
                </span>
              </div>
              <h3 className="font-black text-lg sm:text-xl text-white mt-0.5">
                Daftar Iuran Anggota Segera Jatuh Tempo
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-amber-800/50 hover:bg-amber-800 text-amber-100 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlight Summary Stats Ribbon */}
        <div className="bg-amber-50 p-4 border-b border-amber-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 text-xs">
          <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg font-black">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Jatuh Tempo (≤ 7 Hari):</span>
              <strong className="text-amber-900 font-black text-sm">{expiringCount} Anggota</strong>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-black">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Estimasi Kas Masuk:</span>
              <strong className="text-emerald-700 font-black text-sm font-mono">{formatIDR(totalAmountDue)}</strong>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-800 rounded-lg font-black">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-500 text-[11px] block">Lewat Jatuh Tempo (Overdue):</span>
              <strong className="text-rose-900 font-black text-sm">{overdueCount} Anggota</strong>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setFilterTab('expiring7')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterTab === 'expiring7'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jatuh Tempo 7 Hari ({expiringCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('overdue')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterTab === 'overdue'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sudah Lewat ({overdueCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({expiringCount + overdueCount})
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama, NPA, cluster..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Member Cards List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {displayList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600 text-sm">Tidak ada data anggota ditemukan</p>
              <p className="text-xs text-slate-400">
                {searchTerm
                  ? 'Coba gunakan kata kunci pencarian lainnya.'
                  : 'Semua anggota pada kategori ini terpantau tertib.'}
              </p>
            </div>
          ) : (
            displayList.map(({ member, expiryInfo }) => {
              const waUrl = generate7DayReminderWhatsAppUrl(member, expiryInfo, settings);
              const daysRemaining = expiryInfo.daysRemaining;
              const isOverdue = daysRemaining < 0;
              const isDueToday = daysRemaining === 0;

              return (
                <div
                  key={member.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-2xs ${
                    isOverdue
                      ? 'bg-rose-50/60 border-rose-200'
                      : daysRemaining <= 3
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-white border-slate-200 hover:border-amber-300'
                  }`}
                >
                  {/* Member Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 text-sm sm:text-base">{member.name}</h4>
                      <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {member.memberNumber}
                      </span>
                      {member.cluster && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                          {member.cluster}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Batas Masa Aktif: <strong>{expiryInfo.expiryDateFormatted}</strong></span>
                      </span>
                      {member.phone && (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{member.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Countdown Badge & Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                    <div className="text-right">
                      {isOverdue ? (
                        <span className="px-2.5 py-1 bg-rose-600 text-white font-black text-xs rounded-lg inline-flex items-center gap-1 shadow-2xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Lewat {Math.abs(daysRemaining)} Hari</span>
                        </span>
                      ) : isDueToday ? (
                        <span className="px-2.5 py-1 bg-rose-500 text-white font-black text-xs rounded-lg inline-flex items-center gap-1 shadow-2xs animate-pulse">
                          <Clock className="w-3 h-3" />
                          <span>Jatuh Tempo Hari Ini!</span>
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-lg font-black text-xs inline-flex items-center gap-1 shadow-2xs ${
                            daysRemaining <= 3
                              ? 'bg-amber-500 text-slate-950 animate-pulse'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{daysRemaining} Hari Lagi</span>
                        </span>
                      )}
                    </div>

                    {/* Copy Text Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(member, expiryInfo)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-xs font-bold inline-flex items-center gap-1"
                      title="Salin template pesan pengingat"
                    >
                      {copiedId === member.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* WhatsApp Reminder Button */}
                    <button
                      type="button"
                      onClick={() => window.open(waUrl, '_blank', 'noopener,noreferrer')}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-sm shadow-emerald-950/20 inline-flex items-center gap-1.5 hover:scale-105 active:scale-95"
                      title="Buka WhatsApp dengan pesan pengingat 7 hari terisi otomatis"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ingatkan WA</span>
                    </button>

                    {/* Quick Pay / Renewal CTA */}
                    {onSelectMemberForPayment && (
                      <button
                        type="button"
                        onClick={() => handlePayRenewal(member)}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                        title="Catat/Perpanjang Iuran warga ini"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        <span>Input Iuran</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <p className="text-slate-500">
            Sistem otomatis menandai seluruh anggota dengan masa aktif sisa ≤ 7 hari.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
