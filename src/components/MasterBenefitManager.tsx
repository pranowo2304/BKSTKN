import React, { useState } from 'react';
import { BenefitMaster } from '../types';
import { formatIDR } from '../lib/storage';
import {
  HeartHandshake,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Shield,
  Clock,
  Sparkles,
  Layers,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Copy,
  Info,
  DollarSign,
  Heart,
  RotateCcw,
  Palette,
} from 'lucide-react';

interface MasterBenefitManagerProps {
  benefits: BenefitMaster[];
  onSaveBenefit: (benefit: BenefitMaster) => void;
  onDeleteBenefit: (benefitId: string) => void;
  onResetBenefits?: () => void;
}

const COLOR_OPTIONS: { label: string; value: string; bg: string; text: string; border: string }[] = [
  { label: 'Hijau Zamrud (Emerald)', value: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-700', border: 'border-emerald-500/40' },
  { label: 'Biru Kehijauan (Teal)', value: 'teal', bg: 'bg-teal-500/20', text: 'text-teal-700', border: 'border-teal-500/40' },
  { label: 'Biru Langit (Cyan)', value: 'cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-700', border: 'border-cyan-500/40' },
  { label: 'Kuning Jingga (Amber)', value: 'amber', bg: 'bg-amber-500/20', text: 'text-amber-700', border: 'border-amber-500/40' },
  { label: 'Ungu Elegan (Purple)', value: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-700', border: 'border-purple-500/40' },
  { label: 'Merah Muda (Rose)', value: 'rose', bg: 'bg-rose-500/20', text: 'text-rose-700', border: 'border-rose-500/40' },
  { label: 'Biru Indigo (Indigo)', value: 'indigo', bg: 'bg-indigo-500/20', text: 'text-indigo-700', border: 'border-indigo-500/40' },
];

const QUICK_SERVICE_SUGGESTIONS = [
  'Santunan Duka Tunai Cepat untuk Ahli Waris',
  'Kain Kafan & Perlengkapan Jenazah Lengkap',
  'Mobil Jenazah / Ambulans ke TPU Pemakaman',
  'Fasilitas Sewa Tenda & Kursi Duka',
  'Biaya Penggalian & Penutupan Liang Lahat',
  'Pendampingan Fardhu Kifayah & DKM',
  'Bantuan Konsumsi & Air Mineral Takziah',
  'Santunan Duka Sosial Gotong Royong',
];

const TARGET_RELATIONSHIPS = [
  'Anggota Utama',
  'Orang Tua',
  'Tanggungan Lain',
];

export const MasterBenefitManager: React.FC<MasterBenefitManagerProps> = ({
  benefits,
  onSaveBenefit,
  onDeleteBenefit,
  onResetBenefits,
}) => {
  const [editingBenefit, setEditingBenefit] = useState<BenefitMaster | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<BenefitMaster>>({
    categoryName: '',
    code: '',
    targetRelationship: 'Anggota Utama',
    maxCashAmount: 5000000,
    defaultTotalPackage: 10000000,
    servicesIncluded: [],
    waitingPeriodDays: 0,
    badgeColor: 'emerald',
    isActive: true,
    orderIndex: 1,
    description: '',
    termsAndConditions: '',
  });

  const [newServiceInput, setNewServiceInput] = useState('');

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleStartCreate = () => {
    setEditingBenefit(null);
    setFormData({
      id: `bnf-${Date.now()}`,
      categoryName: '',
      code: `BNF-${Math.floor(100 + Math.random() * 900)}`,
      targetRelationship: 'Anggota Utama',
      maxCashAmount: 3000000,
      defaultTotalPackage: 6000000,
      servicesIncluded: [
        'Santunan Duka Tunai Cepat untuk Ahli Waris',
        'Kain Kafan & Perlengkapan Jenazah Lengkap',
        'Ambulans Jenazah ke TPU / Pemakaman',
      ],
      waitingPeriodDays: 0,
      badgeColor: 'emerald',
      isActive: true,
      orderIndex: benefits.length + 1,
      description: '',
      termsAndConditions: 'Telah terdaftar aktif dan menyelesaikan iuran kas tahunan.',
    });
    setNewServiceInput('');
    setIsCreatingNew(true);
  };

  const handleStartEdit = (benefit: BenefitMaster) => {
    setIsCreatingNew(false);
    setEditingBenefit(benefit);
    setFormData({ ...benefit });
    setNewServiceInput('');
  };

  const handleCancelForm = () => {
    setIsCreatingNew(false);
    setEditingBenefit(null);
  };

  const handleAddService = (serviceName?: string) => {
    const text = (serviceName || newServiceInput).trim();
    if (!text) return;
    const currentList = formData.servicesIncluded || [];
    if (currentList.includes(text)) {
      setNewServiceInput('');
      return;
    }
    setFormData({
      ...formData,
      servicesIncluded: [...currentList, text],
    });
    setNewServiceInput('');
  };

  const handleRemoveService = (indexToRemove: number) => {
    const currentList = formData.servicesIncluded || [];
    setFormData({
      ...formData,
      servicesIncluded: currentList.filter((_, idx) => idx !== indexToRemove),
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryName?.trim()) {
      alert('Nama Kategori / Paket Manfaat wajib diisi!');
      return;
    }

    const benefitToSave: BenefitMaster = {
      id: formData.id || `bnf-${Date.now()}`,
      categoryName: formData.categoryName.trim(),
      code: formData.code?.trim() || `BNF-${Date.now().toString().slice(-4)}`,
      targetRelationship: formData.targetRelationship || 'Anggota Utama',
      maxCashAmount: Number(formData.maxCashAmount) || 0,
      defaultTotalPackage: Number(formData.defaultTotalPackage) || 0,
      servicesIncluded: formData.servicesIncluded && formData.servicesIncluded.length > 0
        ? formData.servicesIncluded
        : ['Santunan Duka Tunai Cepat', 'Kain Kafan & Perlengkapan Jenazah'],
      waitingPeriodDays: Number(formData.waitingPeriodDays) || 0,
      badgeColor: formData.badgeColor || 'emerald',
      isActive: formData.isActive !== false,
      orderIndex: Number(formData.orderIndex) || benefits.length + 1,
      description: formData.description?.trim() || '',
      termsAndConditions: formData.termsAndConditions?.trim() || '',
    };

    onSaveBenefit(benefitToSave);
    setIsCreatingNew(false);
    setEditingBenefit(null);
    showNotification(
      isCreatingNew
        ? `Paket "${benefitToSave.categoryName}" berhasil ditambahkan ke Master Data!`
        : `Paket "${benefitToSave.categoryName}" berhasil diperbarui!`
    );
  };

  const handleToggleStatus = (benefit: BenefitMaster) => {
    const updated = { ...benefit, isActive: !benefit.isActive };
    onSaveBenefit(updated);
    showNotification(`Status paket "${benefit.categoryName}" diubah menjadi ${updated.isActive ? 'Aktif' : 'Non-Aktif'}.`);
  };

  const handleDuplicate = (benefit: BenefitMaster) => {
    const duplicated: BenefitMaster = {
      ...benefit,
      id: `bnf-${Date.now()}`,
      categoryName: `${benefit.categoryName} (Salinan)`,
      code: `${benefit.code || 'BNF'}-COPY`,
      orderIndex: benefits.length + 1,
    };
    onSaveBenefit(duplicated);
    showNotification(`Paket berhasil disalin sebagai "${duplicated.categoryName}".`);
  };

  const handleDelete = (id: string, name: string) => {
    onDeleteBenefit(id);
    setDeleteConfirmId(null);
    showNotification(`Paket "${name}" berhasil dihapus dari Master Data.`);
  };

  // Helper badge color style
  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'teal':
        return {
          pill: 'bg-teal-50 text-teal-700 border-teal-200',
          darkPill: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
          text: 'text-teal-600',
          darkText: 'text-teal-400',
          border: 'border-teal-500/30',
          icon: 'text-teal-400',
        };
      case 'cyan':
        return {
          pill: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          darkPill: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          text: 'text-cyan-600',
          darkText: 'text-cyan-400',
          border: 'border-cyan-500/30',
          icon: 'text-cyan-400',
        };
      case 'amber':
        return {
          pill: 'bg-amber-50 text-amber-700 border-amber-200',
          darkPill: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          text: 'text-amber-600',
          darkText: 'text-amber-400',
          border: 'border-amber-500/30',
          icon: 'text-amber-400',
        };
      case 'purple':
        return {
          pill: 'bg-purple-50 text-purple-700 border-purple-200',
          darkPill: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          text: 'text-purple-600',
          darkText: 'text-purple-400',
          border: 'border-purple-500/30',
          icon: 'text-purple-400',
        };
      case 'rose':
        return {
          pill: 'bg-rose-50 text-rose-700 border-rose-200',
          darkPill: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          text: 'text-rose-600',
          darkText: 'text-rose-400',
          border: 'border-rose-500/30',
          icon: 'text-rose-400',
        };
      case 'indigo':
        return {
          pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          darkPill: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          text: 'text-indigo-600',
          darkText: 'text-indigo-400',
          border: 'border-indigo-500/30',
          icon: 'text-indigo-400',
        };
      case 'emerald':
      default:
        return {
          pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          darkPill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          text: 'text-emerald-600',
          darkText: 'text-emerald-400',
          border: 'border-emerald-500/30',
          icon: 'text-emerald-400',
        };
    }
  };

  const activeCount = benefits.filter((b) => b.isActive).length;
  const sortedBenefits = [...benefits].sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Feedback Toast */}
      {feedback && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-md animate-in zoom-in-95">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Info & Action Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 rounded-2xl border border-emerald-800/60 shadow-lg text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Master Data Dinamis</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Master Hak & Manfaat Santunan Duka
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
            Kelola kategori hak santunan tunai, estimasi paket pelayanan jenazah, daftar fasilitas duka, serta masa tunggu keanggotaan secara dinamis dan transparan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {onResetBenefits && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Kembalikan Master Hak & Manfaat ke konfigurasi standar default?')) {
                  onResetBenefits();
                  showNotification('Master Hak & Manfaat dikembalikan ke konfigurasi default.');
                }
              }}
              className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              title="Reset ke paket standar paguyuban"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Default</span>
            </button>
          )}

          {!isCreatingNew && !editingBenefit && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Paket Manfaat Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Metric Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold uppercase text-slate-400">Total Kategori</p>
          <p className="text-xl font-black text-slate-900 mt-1">{benefits.length} Paket</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{activeCount} Aktif digunakan</p>
        </div>

        {benefits.slice(0, 2).map((b, idx) => (
          <div key={b.id || idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-bold uppercase text-emerald-600 truncate">{b.categoryName}</p>
            <p className="text-xl font-black text-emerald-700 mt-1 font-mono">
              {formatIDR(b.defaultTotalPackage)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Santunan Tunai: <strong className="font-mono text-slate-700">{formatIDR(b.maxCashAmount)}</strong>
            </p>
          </div>
        ))}
      </div>

      {/* FORM: Tambah / Edit Paket Hak & Manfaat */}
      {(isCreatingNew || editingBenefit) && (
        <form
          onSubmit={handleSubmitForm}
          className="bg-white rounded-2xl p-6 sm:p-8 border-2 border-emerald-500/50 shadow-md space-y-6 animate-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isCreatingNew ? 'Tambah Paket Hak & Manfaat Baru' : `Edit Paket: ${editingBenefit?.categoryName}`}
                </h3>
                <p className="text-xs text-slate-500">
                  Isi rincian santunan tunai, estimasi total paket duka, fasilitas, dan ketentuan penerima manfaat.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelForm}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Kategori */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Kategori / Paket Manfaat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kepala Keluarga (Anggota Utama)"
                    value={formData.categoryName || ''}
                    onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Hubungan Target */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Hubungan Target Penerima <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.targetRelationship || 'Anggota Utama'}
                    onChange={(e) => setFormData({ ...formData, targetRelationship: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    {TARGET_RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                    <option value="Khusus">Khusus / Kustom</option>
                  </select>
                </div>

                {/* Kode Paket */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kode Paket (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BNF-KK"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Santunan Tunai Cepat */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Santunan Tunai Cepat (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="50000"
                      required
                      placeholder="3000000"
                      value={formData.maxCashAmount || 0}
                      onChange={(e) => setFormData({ ...formData, maxCashAmount: Number(e.target.value) })}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-emerald-700 font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Format: {formatIDR(formData.maxCashAmount || 0)}
                  </p>
                </div>

                {/* Estimasi Total Paket Manfaat */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Estimasi Total Nilai Paket (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="100000"
                      required
                      placeholder="6000000"
                      value={formData.defaultTotalPackage || 0}
                      onChange={(e) => setFormData({ ...formData, defaultTotalPackage: Number(e.target.value) })}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Format: {formatIDR(formData.defaultTotalPackage || 0)}
                  </p>
                </div>

                {/* Masa Tunggu Hari */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Masa Tunggu Keanggotaan
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.waitingPeriodDays ?? 0}
                      onChange={(e) => setFormData({ ...formData, waitingPeriodDays: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">Hari</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formData.waitingPeriodDays === 0 ? 'Langsung berlaku setelah terdaftar' : `Berlaku setelah ${formData.waitingPeriodDays} hari aktif`}
                  </p>
                </div>

                {/* Pilihan Warna Badge */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Warna Tema & Badge
                  </label>
                  <select
                    value={formData.badgeColor || 'emerald'}
                    onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tag/List Manager: Fasilitas & Layanan Ditanggung */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700">
                  Rincian Fasilitas & Layanan Duka yang Ditanggung
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ketik fasilitas baru (misal: Mobil Ambulans ke TPU)..."
                    value={newServiceInput}
                    onChange={(e) => setNewServiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddService();
                      }
                    }}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddService()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shrink-0"
                  >
                    + Tambah
                  </button>
                </div>

                {/* Suggestions Pills */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-semibold">Saran Cepat (Klik untuk menambahkan):</p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {QUICK_SERVICE_SUGGESTIONS.map((sug, i) => {
                      const isIncluded = formData.servicesIncluded?.includes(sug);
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={isIncluded}
                          onClick={() => handleAddService(sug)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                            isIncluded
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 border-emerald-200 font-medium'
                          }`}
                        >
                          + {sug}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Services List */}
                <div className="space-y-1.5 pt-2">
                  {formData.servicesIncluded && formData.servicesIncluded.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {formData.servicesIncluded.map((srv, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-slate-800 font-medium">{srv}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveService(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      Belum ada rincian fasilitas. Tambahkan setidaknya satu layanan duka.
                    </p>
                  )}
                </div>
              </div>

              {/* Deskripsi & Syarat Ketentuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi Ringkas Paket
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Penjelasan ringkas paket santunan duka..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Syarat & Ketentuan Tambahan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Tercatat dalam KK dan lunas iuran tahun berjalan..."
                    value={formData.termsAndConditions || ''}
                    onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white"
                  />
                </div>
              </div>

              {/* Status Toggle & Urutan */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className="text-emerald-600 hover:text-emerald-700 focus:outline-hidden"
                  >
                    {formData.isActive !== false ? (
                      <ToggleRight className="w-8 h-8 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                  </button>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Status: {formData.isActive !== false ? 'Aktif Digunakan' : 'Non-Aktif (Disembunyikan)'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Paket yang aktif akan ditampilkan pada Landing Page Warga dan form klaim duka.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">Urutan:</label>
                  <input
                    type="number"
                    min="1"
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                    value={formData.orderIndex || 1}
                    onChange={(e) => setFormData({ ...formData, orderIndex: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Realtime Card Preview */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pratinjau Kartu (Landing Page Publik)</span>
                </p>
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md">
                  Live Preview
                </span>
              </div>

              {/* Live Dark Card Preview */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-700 shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />

                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider ${
                      getBadgeStyle(formData.badgeColor).darkPill
                    }`}
                  >
                    {formData.code || 'BNF-CUSTOM'} • {formData.targetRelationship || 'Target'}
                  </span>

                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formData.waitingPeriodDays ? `${formData.waitingPeriodDays} Hari` : '0 Hari (Langsung)'}</span>
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-black text-white">
                    {formData.categoryName || 'Nama Kategori Manfaat'}
                  </h4>
                  <p className="text-2xl font-black font-mono mt-1 text-emerald-400">
                    {formatIDR(formData.defaultTotalPackage || 0)}
                  </p>
                  <p className="text-[11px] text-emerald-200/80 font-medium">
                    Santunan Tunai Cepat: <span className="font-bold">{formatIDR(formData.maxCashAmount || 0)}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Fasilitas Ditanggung:</p>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    {(formData.servicesIncluded && formData.servicesIncluded.length > 0
                      ? formData.servicesIncluded
                      : ['Santunan Duka Tunai Cepat', 'Kain Kafan & Perlengkapan Jenazah']
                    ).slice(0, 5).map((srv, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-tight">{srv}</span>
                      </li>
                    ))}
                    {(formData.servicesIncluded?.length || 0) > 5 && (
                      <li className="text-[10px] text-slate-400 pl-5">
                        + {(formData.servicesIncluded?.length || 0) - 5} fasilitas lainnya...
                      </li>
                    )}
                  </ul>
                </div>

                {formData.description && (
                  <p className="text-[11px] text-slate-400 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 leading-relaxed">
                    {formData.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{isCreatingNew ? 'Simpan Paket Baru' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* DAFTAR MASTER HAK & MANFAAT (Grid Card View) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Daftar Paket Hak & Manfaat Paguyuban ({benefits.length})</span>
          </h3>

          <p className="text-xs text-slate-500">
            Perubahan master data akan otomatis menyinkronkan seluruh tampilan aplikasi & perhitungan klaim.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedBenefits.map((benefit, index) => {
            const badgeStyle = getBadgeStyle(benefit.badgeColor);
            const isDeleting = deleteConfirmId === benefit.id;

            return (
              <div
                key={benefit.id}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between p-5 relative ${
                  benefit.isActive
                    ? 'border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-300'
                    : 'border-slate-200 bg-slate-50/70 opacity-75'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Code, Target, Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg border uppercase ${badgeStyle.pill}`}
                    >
                      {benefit.code || `BNF-0${index + 1}`} • {benefit.targetRelationship}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(benefit)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold transition-colors"
                      title="Klik untuk mengubah status aktif"
                    >
                      {benefit.isActive ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Aktif
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          Non-Aktif
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Title & Amount */}
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                      {benefit.categoryName}
                    </h4>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-xl font-black text-slate-900 font-mono">
                        {formatIDR(benefit.defaultTotalPackage)}
                      </p>
                      <span className="text-[10px] text-slate-400 font-semibold">/ paket duka</span>
                    </div>
                    <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                      Santunan Tunai Ahli Waris: <span className="font-bold">{formatIDR(benefit.maxCashAmount)}</span>
                    </p>
                  </div>

                  {/* Services tags */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Layanan & Fasilitas ({benefit.servicesIncluded?.length || 0}):
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {(benefit.servicesIncluded || []).slice(0, 4).map((srv, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5 text-[11px]">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{srv}</span>
                        </li>
                      ))}
                      {(benefit.servicesIncluded?.length || 0) > 4 && (
                        <li className="text-[10px] text-slate-400 pl-5 font-semibold">
                          + {(benefit.servicesIncluded?.length || 0) - 4} fasilitas duka lainnya...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Masa tunggu */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      Masa tunggu:{' '}
                      <strong className="text-slate-700">
                        {benefit.waitingPeriodDays === 0
                          ? '0 Hari (Langsung berlaku)'
                          : `${benefit.waitingPeriodDays} Hari`}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(benefit)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Duplikat / Salin Paket"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isDeleting ? (
                      <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200 animate-in zoom-in-95">
                        <span className="text-[10px] font-bold text-rose-700 px-1">Hapus?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(benefit.id, benefit.categoryName)}
                          className="p-1 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700"
                        >
                          Ya
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold hover:bg-slate-300"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(benefit)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-slate-600" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(benefit.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus paket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
