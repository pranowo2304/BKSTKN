import React, { useState, useMemo } from 'react';
import { Payment, Member, SystemSettings, AppUser, CLUSTERS } from '../types';
import { formatIDR, getMemberForUser } from '../lib/storage';
import { exportDuesCollectionCSV } from '../lib/csvExport';
import {
  findMemberForPayment,
  generateReceiptWhatsAppUrl,
  formatPhoneDisplay,
} from '../lib/receiptUtils';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Download,
  Share2,
  Phone,
  Home,
  Filter,
  ArrowUpDown,
  RotateCcw,
  X,
  Calendar,
  Tag,
  CreditCard,
  Building2,
  User,
  Sparkles,
} from 'lucide-react';

interface PaymentHistoryProps {
  payments: Payment[];
  members?: Member[];
  settings?: SystemSettings;
  activeUser?: AppUser;
  onViewReceipt: (payment: Payment) => void;
  onOpenExportModal?: () => void;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ 
  payments, 
  members = [], 
  settings, 
  activeUser,
  onViewReceipt,
  onOpenExportModal,
}) => {
  const isAnggota = activeUser?.authority === 'Anggota';
  const isBendahara = activeUser?.authority === 'Bendahara';
  const isKetuaRt = activeUser?.authority === 'Ketua RT (Cluster)';
  // Yang bisa mengirim kwitansi setelah diverifikasi pembayaran oleh bendahara, hanya bendahara.
  // Anggota hanya bisa download kwitansi.
  const canSendReceipt = isBendahara;

  const myMember = isAnggota 
    ? (getMemberForUser(activeUser, members) || members.find(m => m?.name && activeUser?.name && m.name.toLowerCase() === activeUser.name.toLowerCase())) 
    : null;

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Verified' | 'Pending' | 'Rejected'>('Semua');
  const [clusterFilter, setClusterFilter] = useState<string>(() => (isKetuaRt && activeUser?.cluster ? activeUser.cluster : 'Semua'));
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('Semua');
  const [dateFilter, setDateFilter] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc' | 'receipt-asc'>('date-desc');

  // Pre-index members by ID and memberNumber for fast O(1) cluster and phone lookup
  const memberLookup = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => {
      if (m.id) map.set(m.id, m);
      if (m.memberNumber) map.set(m.memberNumber.toLowerCase(), m);
    });
    return map;
  }, [members]);

  const sourcePayments = isAnggota && myMember
    ? payments.filter((p) => p.memberId === myMember.id || p.memberNumber === myMember.memberNumber)
    : isKetuaRt && activeUser?.cluster
    ? payments.filter((p) => {
        const mem = memberLookup.get(p.memberId) || 
                    memberLookup.get(p.memberNumber.toLowerCase()) || 
                    members.find(m => m.name.toLowerCase() === p.memberName.toLowerCase());
        return mem?.cluster === activeUser.cluster;
      })
    : payments;

  // Filtered & Sorted Payments
  const filteredPayments = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    return sourcePayments
      .filter((p) => {
        // Resolve associated member
        const mem = memberLookup.get(p.memberId) || 
                    memberLookup.get(p.memberNumber.toLowerCase()) || 
                    members.find(m => m.name.toLowerCase() === p.memberName.toLowerCase());
        const memberCluster = mem?.cluster || '';
        const memberPhone = mem?.phone || '';
        const memberNik = mem?.nik || '';

        // Global Search across: Name, Member ID (NPA), Receipt Number, Transaction ID, Cluster, Phone, NIK, Period, Method, Type, Notes
        const matchesSearch =
          !query ||
          (p.memberName || '').toLowerCase().includes(query) ||
          (p.memberNumber || '').toLowerCase().includes(query) ||
          (p.receiptNumber || '').toLowerCase().includes(query) ||
          (p.id || '').toLowerCase().includes(query) ||
          (p.paymentType && p.paymentType.toLowerCase().includes(query)) ||
          (p.periodMonth && p.periodMonth.toLowerCase().includes(query)) ||
          (p.paymentMethod && p.paymentMethod.toLowerCase().includes(query)) ||
          (p.notes && p.notes.toLowerCase().includes(query)) ||
          memberCluster.toLowerCase().includes(query) ||
          memberPhone.includes(query) ||
          memberNik.includes(query);

        // Status Filter
        const matchesStatus = statusFilter === 'Semua' ? true : p.status === statusFilter;

        // Cluster Filter
        const matchesCluster = clusterFilter === 'Semua' ? true : memberCluster === clusterFilter;

        // Payment Type Filter
        const matchesType = paymentTypeFilter === 'Semua' ? true : p.paymentType.toLowerCase().includes(paymentTypeFilter.toLowerCase());

        // Date / Period Filter
        let matchesDate = true;
        const pDate = p.date || p.paymentDate || '';
        if (dateFilter === '2026') {
          matchesDate = pDate.startsWith('2026') || p.periodMonth.includes('2026');
        } else if (dateFilter === '2025') {
          matchesDate = pDate.startsWith('2025') || p.periodMonth.includes('2025');
        } else if (dateFilter === 'BulanIni') {
          matchesDate = pDate.startsWith('2026-08') || p.periodMonth.toLowerCase().includes('agustus 2026');
        } else if (dateFilter === 'Q1-2026') {
          matchesDate = pDate.startsWith('2026-01') || pDate.startsWith('2026-02') || pDate.startsWith('2026-03');
        }

        return matchesSearch && matchesStatus && matchesCluster && matchesType && matchesDate;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          const dateA = new Date(a.date || a.paymentDate || 0).getTime();
          const dateB = new Date(b.date || b.paymentDate || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === 'date-asc') {
          const dateA = new Date(a.date || a.paymentDate || 0).getTime();
          const dateB = new Date(b.date || b.paymentDate || 0).getTime();
          return dateA - dateB;
        }
        if (sortBy === 'amount-desc') {
          return b.amount - a.amount;
        }
        if (sortBy === 'amount-asc') {
          return a.amount - b.amount;
        }
        if (sortBy === 'name-asc') {
          return (a.memberName || '').localeCompare(b.memberName || '');
        }
        if (sortBy === 'receipt-asc') {
          return (a.receiptNumber || '').localeCompare(b.receiptNumber || '');
        }
        return 0;
      });
  }, [sourcePayments, searchTerm, statusFilter, clusterFilter, paymentTypeFilter, dateFilter, sortBy, memberLookup, members]);

  // Financial summary of filtered set
  const totalFilteredAmount = useMemo(() => {
    return filteredPayments
      .filter(p => p.status === 'Verified')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filteredPayments]);

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'Semua' ||
    clusterFilter !== 'Semua' ||
    paymentTypeFilter !== 'Semua' ||
    dateFilter !== 'Semua' ||
    sortBy !== 'date-desc';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('Semua');
    setClusterFilter(isKetuaRt && activeUser?.cluster ? activeUser.cluster : 'Semua');
    setPaymentTypeFilter('Semua');
    setDateFilter('Semua');
    setSortBy('date-desc');
  };

  const handleExportCSV = () => {
    if (onOpenExportModal) {
      onOpenExportModal();
    } else if (settings) {
      exportDuesCollectionCSV('Semua Periode', filteredPayments, members, settings);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">
              {isAnggota ? 'Riwayat Transaksi Iuran & Kwitansi Saya' : 'Riwayat Transaksi Iuran & Kwitansi Digital'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAnggota
              ? `Daftar bukti pembayaran iuran atas nama ${myMember?.name || activeUser?.name}. Kwitansi resmi otomatis terbit setelah diverifikasi oleh Bendahara.`
              : isBendahara
              ? 'Daftar lengkap riwayat pembayaran iuran anggota. Gunakan pencarian dan filter untuk menemukan bukti transfer atau kirim kwitansi via WhatsApp.'
              : 'Daftar riwayat transaksi pembayaran iuran anggota lengkap dengan pencarian multi-parameter (Nama, No. Kwitansi, NPA, dan Cluster).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isAnggota && (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/20 transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Laporan CSV</span>
            </button>
          )}
          <span className="px-3 py-2 bg-slate-100 text-slate-800 font-mono text-xs font-bold rounded-xl border border-slate-200">
            {filteredPayments.length} Transaksi {isAnggota ? 'Saya' : ''}
          </span>
        </div>
      </div>

      {/* GLOBAL SEARCH AND FILTER TOOLBAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
          
          {/* Global Search Input Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Nama Anggota, No. Kwitansi, No. Anggota (NPA), Cluster, No. HP, atau Bulan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                title="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            
            {/* Cluster Filter Dropdown or Locked RT Badge */}
            {!isAnggota && (
              isKetuaRt && activeUser?.cluster ? (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5 w-full sm:w-auto shrink-0 shadow-2xs">
                  <Home className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider shrink-0">
                    RT:
                  </span>
                  <span className="text-xs font-black text-amber-950">
                    {activeUser.cluster}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
                  <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <label htmlFor="payment-cluster-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    Cluster:
                  </label>
                  <select
                    id="payment-cluster-filter"
                    value={clusterFilter}
                    onChange={(e) => setClusterFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
                  >
                    <option value="Semua">Semua Cluster</option>
                    {CLUSTERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="payment-status-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Status:
              </label>
              <select
                id="payment-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="Semua">Semua Status</option>
                <option value="Verified">Lunas (Terverifikasi)</option>
                <option value="Pending">Menunggu Verifikasi (Pending)</option>
                <option value="Rejected">Ditolak</option>
              </select>
            </div>

            {/* Payment Type Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="payment-type-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Jenis:
              </label>
              <select
                id="payment-type-filter"
                value={paymentTypeFilter}
                onChange={(e) => setPaymentTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="Semua">Semua Jenis</option>
                <option value="Tahunan">Iuran Tahunan</option>
                <option value="Bulanan">Iuran Bulanan</option>
                <option value="Pendaftaran">Pendaftaran</option>
                <option value="Sukarela">Sumbangan Sukarela</option>
              </select>
            </div>

            {/* Date / Period Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="payment-date-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Periode:
              </label>
              <select
                id="payment-date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="Semua">Semua Periode</option>
                <option value="BulanIni">Bulan Ini (Agu 2026)</option>
                <option value="2026">Tahun 2026</option>
                <option value="2025">Tahun 2025</option>
                <option value="Q1-2026">Q1 2026 (Jan - Mar)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label htmlFor="payment-sort-filter" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Urutan:
              </label>
              <select
                id="payment-sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="date-desc">Tanggal Terbaru</option>
                <option value="date-asc">Tanggal Terlama</option>
                <option value="amount-desc">Nominal Tertinggi</option>
                <option value="amount-asc">Nominal Terendah</option>
                <option value="name-asc">Nama (A - Z)</option>
                <option value="receipt-asc">No. Kwitansi</option>
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1 shrink-0"
                title="Reset semua filter pencarian"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Cluster Filter Pills (for quick admin scanning) */}
        {!isAnggota && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-100 no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0 mr-1">
              Filter Cepat Cluster:
            </span>
            <button
              type="button"
              onClick={() => setClusterFilter('Semua')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                clusterFilter === 'Semua'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Cluster
            </button>
            {CLUSTERS.map((cl) => (
              <button
                key={cl}
                type="button"
                onClick={() => setClusterFilter(cl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  clusterFilter === cl
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cl}
              </button>
            ))}
          </div>
        )}

        {/* Active Filters Bar & Summary */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700">
              Menampilkan <strong className="text-emerald-700 font-bold">{filteredPayments.length}</strong> dari {sourcePayments.length} Transaksi
            </span>
            {totalFilteredAmount > 0 && (
              <span className="text-slate-500 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-emerald-800">
                Total Kas Lunas: <strong>{formatIDR(totalFilteredAmount)}</strong>
              </span>
            )}
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full">
                Filter Aktif
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {searchTerm && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Cari: <strong>"{searchTerm}"</strong>
                  <button type="button" onClick={() => setSearchTerm('')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {clusterFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Cluster: <strong>{clusterFilter}</strong>
                  <button type="button" onClick={() => setClusterFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {statusFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Status: <strong>{statusFilter === 'Verified' ? 'Lunas' : statusFilter}</strong>
                  <button type="button" onClick={() => setStatusFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {paymentTypeFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Jenis: <strong>{paymentTypeFilter}</strong>
                  <button type="button" onClick={() => setPaymentTypeFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
              {dateFilter !== 'Semua' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">
                  Periode: <strong>{dateFilter === 'BulanIni' ? 'Bulan Ini' : dateFilter}</strong>
                  <button type="button" onClick={() => setDateFilter('Semua')}><X className="w-3 h-3 text-slate-400 hover:text-slate-600" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-900 text-white uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">No. Kwitansi</th>
                <th className="py-3.5 px-4">Nama Anggota & Cluster</th>
                <th className="py-3.5 px-4">Jenis & Periode</th>
                <th className="py-3.5 px-4">Metode Bayar</th>
                <th className="py-3.5 px-4">Nominal</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Kwitansi Digital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-600 text-sm">Tidak ada riwayat transaksi yang cocok.</p>
                    <p className="text-xs text-slate-400">
                      {hasActiveFilters ? 'Coba ubah kata kunci pencarian atau reset filter di atas.' : 'Belum ada data pembayaran.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1 mt-2"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Semua Filter</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPayments.map((pay) => {
                  const targetMember = findMemberForPayment(pay, members);
                  const memberPhone = targetMember?.phone || '';
                  const memberCluster = targetMember?.cluster || '';
                  const waUrl = generateReceiptWhatsAppUrl(pay, targetMember, settings);

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-900">{pay.receiptNumber}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          {pay.date || pay.paymentDate || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-slate-900">{pay.memberName}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono flex-wrap mt-0.5">
                          <span className="bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-700 font-bold">
                            {pay.memberNumber}
                          </span>
                          {memberCluster && (
                            <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {memberCluster}
                            </span>
                          )}
                          {memberPhone && (
                            <span className="text-slate-500">
                              📞 {memberPhone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{pay.paymentType}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{pay.periodMonth}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {pay.paymentMethod}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-sm whitespace-nowrap">
                        {formatIDR(pay.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {pay.status === 'Verified' ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Lunas</span>
                          </span>
                        ) : pay.status === 'Pending' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Ditolak</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {pay.status === 'Verified' ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {canSendReceipt && (
                              <button
                                type="button"
                                onClick={() => window.open(waUrl, '_blank', 'noopener,noreferrer')}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-extrabold text-xs rounded-xl transition-all border border-emerald-300 inline-flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95"
                                title={`Kirim kwitansi via WhatsApp langsung ke nomor ${memberPhone || pay.memberName} (Khusus Bendahara)`}
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Kirim WA</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onViewReceipt(pay)}
                              className={`px-3 py-1.5 font-extrabold text-xs rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 ${
                                isAnggota
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white'
                              }`}
                              title={isAnggota ? 'Buka & unduh kwitansi resmi PDF' : 'Buka detail & cetak kwitansi resmi'}
                            >
                              {isAnggota ? (
                                <>
                                  <Download className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>Download Kwitansi</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Kwitansi</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Belum terbit</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

