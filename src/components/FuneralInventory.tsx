import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  FileDown,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Calendar,
  User,
  Phone,
  MapPin,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building,
  Info,
  X,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Trash2,
  Edit3
} from 'lucide-react';
import {
  FuneralInventoryItem,
  FuneralInventoryLoan,
  FuneralSchedule,
  InventoryCategory,
  InventoryCondition,
  LoanItemDetail,
  SystemSettings,
  AppUser
} from '../types';
import { generateInventoryPdfReport } from '../lib/inventoryPdfExport';

interface FuneralInventoryProps {
  items: FuneralInventoryItem[];
  loans: FuneralInventoryLoan[];
  funeralSchedules: FuneralSchedule[];
  currentUser?: AppUser | null;
  settings?: SystemSettings;
  onSaveItem: (item: FuneralInventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onSaveLoan: (loan: FuneralInventoryLoan, updatedItems: FuneralInventoryItem[]) => void;
  onReturnLoan: (loanId: string, updatedItems: FuneralInventoryItem[]) => void;
  onNavigateToFuneralSchedule?: (scheduleId?: string) => void;
}

const CATEGORIES: { label: string; value: InventoryCategory | 'ALL' }[] = [
  { label: 'Semua Kategori', value: 'ALL' },
  { label: 'Tenda Duka', value: 'Tenda' },
  { label: 'Kursi Warga', value: 'Kursi' },
  { label: 'Keranda Jenazah', value: 'Keranda' },
  { label: 'Kain Penutup', value: 'Kain Penutup' },
  { label: 'Peralatan Mandi', value: 'Peralatan Mandi' },
  { label: 'Sound & Lampu', value: 'Sound & Penerangan' },
  { label: 'Lainnya', value: 'Lainnya' },
];

export const FuneralInventory: React.FC<FuneralInventoryProps> = ({
  items,
  loans,
  funeralSchedules,
  currentUser,
  settings,
  onSaveItem,
  onDeleteItem,
  onSaveLoan,
  onReturnLoan,
  onNavigateToFuneralSchedule,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'loans' | 'schedules'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'ALL'>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'ALL' | 'DIPINJAM' | 'DIKEMBALIKAN'>('ALL');

  // Modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FuneralInventoryItem | null>(null);
  const [isCreateLoanModalOpen, setIsCreateLoanModalOpen] = useState(false);
  const [prefilledScheduleId, setPrefilledScheduleId] = useState<string>('');
  const [returningLoan, setReturningLoan] = useState<FuneralInventoryLoan | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const totalItemsCount = items.length;
    const totalStock = items.reduce((sum, item) => sum + item.totalStock, 0);
    const availableStock = items.reduce((sum, item) => sum + item.availableStock, 0);
    const borrowedStock = items.reduce((sum, item) => sum + item.borrowedStock, 0);
    const activeLoans = loans.filter((l) => l.status === 'DIPINJAM').length;
    const goodConditionCount = items.filter((i) => i.condition === 'Baik').length;
    const availabilityRate = totalStock > 0 ? Math.round((availableStock / totalStock) * 100) : 100;

    return {
      totalItemsCount,
      totalStock,
      availableStock,
      borrowedStock,
      activeLoans,
      goodConditionCount,
      availabilityRate,
    };
  }, [items, loans]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.storageLocation.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchCond = selectedCondition === 'ALL' || item.condition === selectedCondition;
      return matchSearch && matchCat && matchCond;
    });
  }, [items, searchQuery, selectedCategory, selectedCondition]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const bName = loan.borrowerName || loan.familyContactName || '';
      const bRt = loan.borrowerRt || loan.cluster || '';
      const matchSearch =
        loan.loanCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loan.deceasedName && loan.deceasedName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        bRt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = loanStatusFilter === 'ALL' || loan.status === loanStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [loans, searchQuery, loanStatusFilter]);

  // Active / Upcoming Funeral Schedules
  const activeSchedules = useMemo(() => {
    return funeralSchedules.filter((s) => s.status === 'SIAGA' || s.status === 'BERLANGSUNG');
  }, [funeralSchedules]);

  // Handler: Export PDF
  const handleExportPDF = () => {
    setIsExportingPdf(true);
    try {
      const doc = generateInventoryPdfReport({
        items,
        loans,
        settings,
        generatedBy: currentUser?.name || 'Petugas Inventaris Paguyuban',
      });
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      doc.save(`Laporan_Inventaris_Duka_Paguyuban_${todayStr}.pdf`);
      setPdfSuccessMessage(true);
      setTimeout(() => setPdfSuccessMessage(false), 4000);
    } catch (err) {
      console.error('Gagal mencetak PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenLoanWithSchedule = (scheduleId: string) => {
    setPrefilledScheduleId(scheduleId);
    setIsCreateLoanModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider">
              <Boxes className="w-3.5 h-3.5 text-teal-400" />
              <span>Logistik & Perlengkapan Duka</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Inventaris Duka Paguyuban
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              Pencatatan stok terpusat perlengkapan fardhu kifayah (tenda, keranda, kursi, kain penutup) 
              dengan pelacakan ketersediaan real-time dan terhubung ke jadwal pemakaman warga.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition shadow-sm backdrop-blur-sm active:scale-95 disabled:opacity-50"
            >
              <FileDown className="w-4 h-4 text-teal-300" />
              <span>{isExportingPdf ? 'Menyiapkan PDF...' : 'Ekspor Laporan PDF'}</span>
            </button>

            <button
              onClick={() => {
                setPrefilledScheduleId('');
                setIsCreateLoanModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              <Clock className="w-4 h-4" />
              <span>Catat Peminjaman</span>
            </button>

            <button
              onClick={() => {
                setEditingItem(null);
                setIsAddItemModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm transition shadow-lg shadow-teal-900/30 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Alat</span>
            </button>
          </div>
        </div>

        {/* PDF Download success toast message */}
        {pdfSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Dokumen PDF Laporan Inventaris Duka berhasil diunduh ke perangkat Anda.</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Barang */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Aset Logistik</span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalStock} <span className="text-sm font-normal text-slate-500">Unit</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tersebar di {stats.totalItemsCount} varian peralatan
          </p>
        </div>

        {/* Stok Tersedia */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Stok Tersedia</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.availableStock} <span className="text-sm font-normal text-emerald-600/70">Unit</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${stats.availabilityRate}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600">{stats.availabilityRate}%</span>
          </div>
        </div>

        {/* Sedang Dipinjam */}
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sedang Dipinjam</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.borrowedStock} <span className="text-sm font-normal text-amber-600/70">Unit</span>
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
            Dalam {stats.activeLoans} peminjaman aktif warga
          </p>
        </div>

        {/* Kondisi Baik */}
        <div className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-900/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-teal-600 dark:text-teal-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Kesiapan Alat</span>
            <div className="p-2 bg-teal-50 dark:bg-teal-950/50 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
            {stats.goodConditionCount} / {stats.totalItemsCount}
          </div>
          <p className="text-xs text-teal-600/80 dark:text-teal-400/80 mt-1">
            Barang berkondisi baik & prima
          </p>
        </div>
      </div>

      {/* Main Tab Switcher & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'catalog'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Katalog Peralatan ({filteredItems.length})
            </button>
            <button
              onClick={() => setActiveTab('loans')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'loans'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Riwayat & Peminjaman</span>
              {stats.activeLoans > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-600 text-white font-bold">
                  {stats.activeLoans}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'schedules'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Jadwal Duka Terkait</span>
              {activeSchedules.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-600 text-white font-bold">
                  {activeSchedules.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari alat, kode, nama warga/RT..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
            />
          </div>
        </div>

        {/* Filters according to activeTab */}
        {activeTab === 'catalog' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition ${
                    selectedCategory === cat.value
                      ? 'bg-teal-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Kondisi:</span>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">Semua Kondisi</option>
                <option value="Baik">Kondisi Baik</option>
                <option value="Perlu Perawatan">Perlu Perawatan</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak">Rusak</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'loans' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status Pinjam:</span>
            <button
              onClick={() => setLoanStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                loanStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setLoanStatusFilter('DIPINJAM')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                loanStatusFilter === 'DIPINJAM'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Sedang Dipinjam ({stats.activeLoans})
            </button>
            <button
              onClick={() => setLoanStatusFilter('DIKEMBALIKAN')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                loanStatusFilter === 'DIKEMBALIKAN'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Telah Dikembalikan
            </button>
          </div>
        )}
      </div>

      {/* CONTENT: TAB 1 - CATALOG */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isFullyAvailable = item.borrowedStock === 0;
            const isOutOfStock = item.availableStock === 0;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top line with code and badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                        {item.itemCode}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 font-medium">{item.category}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.condition === 'Baik'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : item.condition === 'Perlu Perawatan'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                      }`}
                    >
                      {item.condition}
                    </span>
                  </div>

                  {/* Item Name */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                    {item.name}
                  </h3>

                  {/* Storage Location */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="line-clamp-1">{item.storageLocation}</span>
                  </div>

                  {/* Stock Availability Visualization */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Ketersediaan Stok:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.availableStock} / {item.totalStock} {item.unit}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${(item.availableStock / (item.totalStock || 1)) * 100}%` }}
                        title={`Tersedia: ${item.availableStock} ${item.unit}`}
                      />
                      <div
                        className="bg-amber-500 h-full transition-all"
                        style={{ width: `${(item.borrowedStock / (item.totalStock || 1)) * 100}%` }}
                        title={`Dipinjam: ${item.borrowedStock} ${item.unit}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Tersedia: {item.availableStock}
                      </span>
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Dipinjam: {item.borrowedStock}
                      </span>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1 mb-3">
                      Catatan: {item.notes}
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setIsAddItemModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Edit Detail Peralatan"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (item.borrowedStock > 0) {
                          alert(`Tidak dapat menghapus '${item.name}' karena masih ada ${item.borrowedStock} unit yang sedang dipinjam warga.`);
                          return;
                        }
                        if (confirm(`Yakin ingin menghapus ${item.name} (${item.itemCode}) dari inventaris?`)) {
                          onDeleteItem(item.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      title="Hapus Peralatan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    disabled={isOutOfStock}
                    onClick={() => {
                      setPrefilledScheduleId('');
                      setIsCreateLoanModalOpen(true);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      isOutOfStock
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                        : 'bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:hover:bg-teal-900/60 dark:text-teal-300'
                    }`}
                  >
                    <span>{isOutOfStock ? 'Stok Habis' : 'Pinjamkan'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <Boxes className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Peralatan Tidak Ditemukan
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Coba ubah kata kunci pencarian atau bersihkan filter kategori.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CONTENT: TAB 2 - LOANS */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {filteredLoans.map((loan) => {
            const isReturned = loan.status === 'DIKEMBALIKAN';
            return (
              <div
                key={loan.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {loan.loanCode}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          loan.status === 'DIPINJAM'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {loan.status === 'DIPINJAM' ? 'SEDANG DIPINJAM' : 'TELAH DIKEMBALIKAN'}
                      </span>
                    </div>

                    {/* Deceased info / Funeral Schedule binding */}
                    {loan.deceasedName && (
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white pt-1">
                        <span className="text-emerald-600">⚰️ Duka:</span>
                        <span>{loan.deceasedName}</span>
                        {loan.funeralScheduleCode && (
                          <span className="text-xs font-normal text-slate-500 font-mono">
                            ({loan.funeralScheduleCode})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions for this loan */}
                  <div className="flex items-center gap-2">
                    {!isReturned && (
                      <button
                        onClick={() => setReturningLoan(loan)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Selesai & Kembalikan Stok</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Borrower & Contact Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Penanggung Jawab / Peminjam:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {loan.borrowerName || loan.familyContactName || 'Warga'} ({loan.borrowerRt || loan.cluster || '-'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Kontak / Telepon:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {loan.borrowerPhone || loan.familyContactPhone || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Waktu Peminjaman & Batas:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {loan.borrowDate || loan.loanDate
                        ? new Date(loan.borrowDate || loan.loanDate || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                        : '-'}
                      {' - '}
                      {loan.expectedReturnDate
                        ? new Date(loan.expectedReturnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Selesai Takziyah'}
                    </span>
                  </div>
                </div>

                {/* Loaned items list */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Daftar Peralatan yang Dipinjam:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(loan.items || loan.borrowedItems || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 shadow-xs"
                      >
                        <Package className="w-3.5 h-3.5 text-teal-600" />
                        <span className="font-semibold text-teal-700 dark:text-teal-300">
                          {item.quantity} {item.unit}
                        </span>
                        <span>{item.itemName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {loan.notes && (
                  <p className="text-xs text-slate-500 italic">
                    Catatan serah terima: {loan.notes}
                  </p>
                )}
              </div>
            );
          })}

          {filteredLoans.length === 0 && (
            <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Belum Ada Catatan Peminjaman
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan tombol 'Catat Peminjaman' untuk mencatat peralatan yang dipinjam oleh keluarga duka.
              </p>
            </div>
          )}
        </div>
      )}

      {/* CONTENT: TAB 3 - LINKED FUNERAL SCHEDULES */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-3">
            <Info className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Integrasi Langsung Jadwal Pemakaman & Inventaris:</span>
              <p className="leading-relaxed">
                Setiap kali ada jadwal pemakaman aktif di RT setempat, petugas dapat langsung mengalokasikan tenda, kursi, keranda, dan sound system tanpa perlu mengisi ulang biodata keluarga duka.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {funeralSchedules.map((schedule) => {
              // Find loan associated with this schedule
              const associatedLoan = loans.find(
                (l) => l.funeralScheduleId === schedule.id || l.funeralScheduleCode === schedule.scheduleCode
              );

              return (
                <div
                  key={schedule.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                        {schedule.scheduleCode}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {schedule.deceasedName} ({schedule.rt})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Wafat: {new Date(schedule.deathDate).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        schedule.status === 'SIAGA'
                          ? 'bg-amber-100 text-amber-800'
                          : schedule.status === 'BERLANGSUNG'
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                    <p><strong>Rumah Duka:</strong> {schedule.funeralHomeAddress}</p>
                    <p><strong>Lokasi TPU:</strong> {schedule.cemeteryLocation}</p>
                    <p><strong>Kontak Keluarga:</strong> {schedule.familyContactName} ({schedule.familyContactPhone})</p>
                  </div>

                  {/* Status Alokasi Logistik */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    {associatedLoan ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          Logistik Terdistribusi ({associatedLoan.items.length} Macam)
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Belum dialokasikan peralatan duka
                      </span>
                    )}

                    <button
                      onClick={() => handleOpenLoanWithSchedule(schedule.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span>{associatedLoan ? 'Ubah / Tambah Alat' : 'Alokasikan Alat'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT ITEM ================= */}
      {isAddItemModalOpen && (
        <AddEditItemModal
          item={editingItem}
          onClose={() => setIsAddItemModalOpen(false)}
          onSave={(itemToSave) => {
            onSaveItem(itemToSave);
            setIsAddItemModalOpen(false);
          }}
        />
      )}

      {/* ================= MODAL: CREATE LOAN ================= */}
      {isCreateLoanModalOpen && (
        <CreateLoanModal
          items={items}
          funeralSchedules={funeralSchedules}
          prefilledScheduleId={prefilledScheduleId}
          currentUser={currentUser}
          onClose={() => setIsCreateLoanModalOpen(false)}
          onSubmit={(newLoan, updatedItems) => {
            onSaveLoan(newLoan, updatedItems);
            setIsCreateLoanModalOpen(false);
          }}
        />
      )}

      {/* ================= MODAL: RETURN LOAN ================= */}
      {returningLoan && (
        <ReturnLoanModal
          loan={returningLoan}
          items={items}
          onClose={() => setReturningLoan(null)}
          onConfirm={(loanId, updatedItems) => {
            onReturnLoan(loanId, updatedItems);
            setReturningLoan(null);
          }}
        />
      )}
    </div>
  );
};

/* ----------------------------------------------------
   SUB-COMPONENT: ADD / EDIT ITEM MODAL
   ---------------------------------------------------- */
interface AddEditItemModalProps {
  item: FuneralInventoryItem | null;
  onClose: () => void;
  onSave: (item: FuneralInventoryItem) => void;
}

const AddEditItemModal: React.FC<AddEditItemModalProps> = ({ item, onClose, onSave }) => {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState<InventoryCategory>(item?.category || 'Tenda');
  const [totalStock, setTotalStock] = useState<number>(item?.totalStock || 1);
  const [unit, setUnit] = useState(item?.unit || 'Unit');
  const [condition, setCondition] = useState<InventoryCondition>(item?.condition || 'Baik');
  const [storageLocation, setStorageLocation] = useState(item?.storageLocation || 'Gudang Utama Masjid Al-Ikhlas');
  const [notes, setNotes] = useState(item?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama peralatan harus diisi!');
      return;
    }

    const borrowedStock = item?.borrowedStock || 0;
    const availableStock = Math.max(0, Number(totalStock) - borrowedStock);

    const itemCode =
      item?.itemCode ||
      `INV-${category.substring(0, 3).toUpperCase()}-${String(Math.floor(100 + Math.random() * 900))}`;

    const itemData: FuneralInventoryItem = {
      id: item?.id || `inv-${Date.now()}`,
      itemCode,
      name,
      category,
      totalStock: Number(totalStock),
      availableStock,
      borrowedStock,
      unit,
      condition,
      storageLocation,
      notes,
      lastUpdated: new Date().toISOString(),
    };

    onSave(itemData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEdit ? 'Edit Peralatan Inventaris' : 'Tambah Peralatan Duka Baru'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Peralatan / Aset Duka *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Tenda Duka Lipat 4x6 Meter"
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kategori Peralatan
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              >
                <option value="Tenda">Tenda Duka</option>
                <option value="Kursi">Kursi Warga</option>
                <option value="Keranda">Keranda Jenazah</option>
                <option value="Kain Penutup">Kain Penutup</option>
                <option value="Peralatan Mandi">Peralatan Mandi</option>
                <option value="Sound & Penerangan">Sound & Penerangan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kondisi Fisik
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as InventoryCondition)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              >
                <option value="Baik">Baik (Siap Pakai)</option>
                <option value="Perlu Perawatan">Perlu Perawatan</option>
                <option value="Rusak Ringan">Rusak Ringan</option>
                <option value="Rusak">Rusak</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Jumlah Stok *
              </label>
              <input
                type="number"
                min="1"
                required
                value={totalStock}
                onChange={(e) => setTotalStock(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Satuan Barang
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit, Pcs, Set, Lembar"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lokasi Penyimpanan / Gudang
            </label>
            <input
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="Contoh: Gudang Masjid Al-Ikhlas Lt. 1"
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan / Spesifikasi Tambahan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Termasuk 4 pasak besi & tali pengikat..."
              className="w-full text-xs px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/20"
            >
              Simpan Peralatan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ----------------------------------------------------
   SUB-COMPONENT: CREATE LOAN MODAL
   ---------------------------------------------------- */
interface CreateLoanModalProps {
  items: FuneralInventoryItem[];
  funeralSchedules: FuneralSchedule[];
  prefilledScheduleId?: string;
  currentUser?: AppUser | null;
  onClose: () => void;
  onSubmit: (newLoan: FuneralInventoryLoan, updatedItems: FuneralInventoryItem[]) => void;
}

const CreateLoanModal: React.FC<CreateLoanModalProps> = ({
  items,
  funeralSchedules,
  prefilledScheduleId,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(prefilledScheduleId || '');
  const [deceasedName, setDeceasedName] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [borrowerAddress, setBorrowerAddress] = useState('');
  const [borrowerRt, setBorrowerRt] = useState('RT 01');
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // Default return 3 days later
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  // Selected item quantities: { [itemId: string]: number }
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Record<string, number>>({});

  // Auto-fill if a funeral schedule is picked
  const handleScheduleChange = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    if (!scheduleId) return;

    const found = funeralSchedules.find((s) => s.id === scheduleId);
    if (found) {
      setDeceasedName(found.deceasedName);
      setBorrowerName(found.familyContactName || 'Keluarga Ahli Waris');
      setBorrowerPhone(found.familyContactPhone || '');
      setBorrowerAddress(found.funeralHomeAddress || '');
      setBorrowerRt(found.rt || 'RT 01');
    }
  };

  // Run on mount if prefilled
  React.useEffect(() => {
    if (prefilledScheduleId) {
      handleScheduleChange(prefilledScheduleId);
    }
  }, [prefilledScheduleId]);

  const handleQtyChange = (itemId: string, qty: number, maxAvailable: number) => {
    const safeQty = Math.max(0, Math.min(qty, maxAvailable));
    setSelectedItemQuantities((prev) => {
      const copy = { ...prev };
      if (safeQty === 0) {
        delete copy[itemId];
      } else {
        copy[itemId] = safeQty;
      }
      return copy;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedItemIds = Object.keys(selectedItemQuantities).filter(
      (id) => selectedItemQuantities[id] > 0
    );

    if (selectedItemIds.length === 0) {
      alert('Pilih setidaknya satu peralatan yang akan dipinjamkan!');
      return;
    }

    if (!borrowerName.trim()) {
      alert('Nama peminjam / ahli waris harus diisi!');
      return;
    }

    const loanItems: LoanItemDetail[] = [];
    const updatedItemsList = items.map((item) => {
      const qtyToBorrow = selectedItemQuantities[item.id] || 0;
      if (qtyToBorrow > 0) {
        loanItems.push({
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.name,
          quantity: qtyToBorrow,
          unit: item.unit,
          conditionBefore: item.condition,
        });

        return {
          ...item,
          availableStock: Math.max(0, item.availableStock - qtyToBorrow),
          borrowedStock: item.borrowedStock + qtyToBorrow,
          lastUpdated: new Date().toISOString(),
        };
      }
      return item;
    });

    const targetSchedule = funeralSchedules.find((s) => s.id === selectedScheduleId);

    const newLoan: FuneralInventoryLoan = {
      id: `loan-${Date.now()}`,
      loanCode: `PINJAM-2026-${String(Math.floor(100 + Math.random() * 900))}`,
      funeralScheduleId: selectedScheduleId || undefined,
      funeralScheduleCode: targetSchedule?.scheduleCode,
      deceasedName: deceasedName.trim() || undefined,
      borrowerName,
      borrowerPhone,
      borrowerAddress,
      borrowerRt,
      familyContactName: borrowerName,
      familyContactPhone: borrowerPhone,
      cluster: borrowerRt,
      destinationAddress: borrowerAddress,
      items: loanItems,
      borrowedItems: loanItems,
      borrowDate: new Date().toISOString(),
      loanDate: new Date().toISOString().slice(0, 10),
      expectedReturnDate,
      status: 'DIPINJAM',
      officerInCharge: currentUser?.name || 'Petugas Inventaris Paguyuban',
      officerName: currentUser?.name || 'Petugas Inventaris Paguyuban',
      notes,
      createdAt: new Date().toISOString(),
    };

    onSubmit(newLoan, updatedItemsList);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Formulir Peminjaman Logistik Duka
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan serah terima peralatan operasional kepada keluarga warga yang berduka
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Link to Funeral Schedule Selector */}
          <div className="bg-teal-50/60 dark:bg-teal-950/30 p-3.5 rounded-2xl border border-teal-200/80 dark:border-teal-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Hubungkan ke Jadwal Pemakaman (Opsional):
              </label>
              {selectedScheduleId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScheduleId('');
                    setDeceasedName('');
                  }}
                  className="text-[11px] text-teal-700 hover:underline"
                >
                  Reset Pilihan
                </button>
              )}
            </div>

            <select
              value={selectedScheduleId}
              onChange={(e) => handleScheduleChange(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 rounded-xl focus:outline-none dark:text-white"
            >
              <option value="">-- Bukan Untuk Jadwal Tertentu (Peminjaman Manual) --</option>
              {funeralSchedules.map((sched) => (
                <option key={sched.id} value={sched.id}>
                  {sched.scheduleCode} - {sched.deceasedName} ({sched.rt}) [{sched.status}]
                </option>
              ))}
            </select>
          </div>

          {/* Deceased & Borrower Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Almarhum/Almarhumah (Bila Ada)
              </label>
              <input
                type="text"
                value={deceasedName}
                onChange={(e) => setDeceasedName(e.target.value)}
                placeholder="Contoh: Alm. Bapak Ahmad Sutanto"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Peminjam / Penanggung Jawab *
              </label>
              <input
                type="text"
                required
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Contoh: Rian Sutanto (Anak)"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No. Telepon / WhatsApp *
              </label>
              <input
                type="text"
                required
                value={borrowerPhone}
                onChange={(e) => setBorrowerPhone(e.target.value)}
                placeholder="0812xxxx"
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Wilayah RT *
              </label>
              <select
                value={borrowerRt}
                onChange={(e) => setBorrowerRt(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              >
                {['RT 01', 'RT 02', 'RT 03', 'RT 04', 'RT 05', 'RT 06', 'RT 07'].map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Pengembalian *
              </label>
              <input
                type="date"
                required
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alamat Lengkap Rumah Duka / Pemasangan
            </label>
            <input
              type="text"
              value={borrowerAddress}
              onChange={(e) => setBorrowerAddress(e.target.value)}
              placeholder="Contoh: Jl. Dahlia No. 12 RT 03 RW 05"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
            />
          </div>

          {/* ITEM SELECTOR TABLE */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Pilih Peralatan & Tentukan Jumlah yang Dipinjam:
              </label>
              <span className="text-[11px] text-teal-600 font-semibold">
                {Object.keys(selectedItemQuantities).length} item terpilih
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {items.map((item) => {
                const currentVal = selectedItemQuantities[item.id] || 0;
                const isAvailable = item.availableStock > 0;

                return (
                  <div
                    key={item.id}
                    className={`p-3 flex items-center justify-between gap-3 text-xs ${
                      !isAvailable ? 'opacity-50 bg-slate-50 dark:bg-slate-800/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({item.itemCode})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Kategori: {item.category}</span>
                        <span>•</span>
                        <span className={item.availableStock > 0 ? 'text-emerald-600 font-semibold' : 'text-red-500'}>
                          Sisa Siap: {item.availableStock} {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={item.availableStock}
                        disabled={!isAvailable}
                        value={currentVal || ''}
                        placeholder="0"
                        onChange={(e) =>
                          handleQtyChange(item.id, parseInt(e.target.value) || 0, item.availableStock)
                        }
                        className="w-16 px-2 py-1 text-center font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <span className="text-slate-400 text-xs w-10">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan Serah Terima / Kondisi Awal
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Diambil langsung oleh keluarga, kondisi kain bersih rapi..."
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20"
            >
              Simpan & Terbitkan Peminjaman
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ----------------------------------------------------
   SUB-COMPONENT: RETURN LOAN MODAL
   ---------------------------------------------------- */
interface ReturnLoanModalProps {
  loan: FuneralInventoryLoan;
  items: FuneralInventoryItem[];
  onClose: () => void;
  onConfirm: (loanId: string, updatedItems: FuneralInventoryItem[]) => void;
}

const ReturnLoanModal: React.FC<ReturnLoanModalProps> = ({ loan, items, onClose, onConfirm }) => {
  const [returnNotes, setReturnNotes] = useState('');

  const handleReturnConfirm = () => {
    // Restore stocks back to items
    const loanItemsList = loan.items || loan.borrowedItems || [];
    const updatedItems = items.map((invItem) => {
      const loanedDetail = loanItemsList.find((i) => (i.itemId || i.inventoryItemId) === invItem.id);
      if (loanedDetail) {
        const returnedQty = loanedDetail.quantity;
        return {
          ...invItem,
          availableStock: invItem.availableStock + returnedQty,
          borrowedStock: Math.max(0, invItem.borrowedStock - returnedQty),
          lastUpdated: new Date().toISOString(),
        };
      }
      return invItem;
    });

    onConfirm(loan.id, updatedItems);
  };

  const borrowerNameDisp = loan.borrowerName || loan.familyContactName || 'Warga';
  const borrowerRtDisp = loan.borrowerRt || loan.cluster || '-';
  const borrowDateVal = loan.borrowDate || loan.loanDate || '';
  const loanItemsList = loan.items || loan.borrowedItems || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Konfirmasi Pengembalian Logistik
              </h3>
              <p className="text-xs text-slate-500 font-mono">{loan.loanCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl space-y-1">
            <p><strong>Peminjam:</strong> {borrowerNameDisp} ({borrowerRtDisp})</p>
            {loan.deceasedName && <p><strong>Jenazah Terkait:</strong> {loan.deceasedName}</p>}
            {borrowDateVal && (
              <p><strong>Tanggal Pinjam:</strong> {new Date(borrowDateVal).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
            )}
          </div>

          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Peralatan yang Akan Dikembalikan ke Gudang:
            </span>
            <ul className="space-y-1">
              {loanItemsList.map((i, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200/50"
                >
                  <span className="font-medium text-emerald-900 dark:text-emerald-200">{i.itemName}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    +{i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Catatan Pemeriksaan Kondisi Fisik Setelah Dipakai
            </label>
            <textarea
              rows={2}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Contoh: Semua peralatan telah dicuci/dibersihkan, kondisi utuh lengkap..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none dark:text-white"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleReturnConfirm}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20"
          >
            Konfirmasi & Pulihkan Stok
          </button>
        </div>
      </div>
    </div>
  );
};
