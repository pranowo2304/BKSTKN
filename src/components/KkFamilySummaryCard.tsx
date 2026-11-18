import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  Plus,
  Check,
  X,
  ScanLine,
  RefreshCw,
  Eye,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Dependent } from '../types';
import {
  extractFamilyCardData,
  ExtractedKkResult,
  mergeExtractedDependents,
} from '../lib/kkExtractor';

export interface KkFamilyDraftData {
  headName: string;
  headNik: string;
  familyCardNumber: string;
  dependents: Dependent[];
}

interface KkFamilySummaryCardProps {
  mode?: 'summary' | 'verify';
  headName: string;
  headNik?: string;
  familyCardNumber?: string;
  familyCardPhotoUrl?: string;
  familyCardFileName?: string;
  dependents: Dependent[];
  isVerifiedRt?: boolean;
  canEdit?: boolean;
  isChecklistChecked?: boolean;
  duplicateKkError?: string | null;
  onChecklistChange?: (checked: boolean) => void;
  onDraftChange?: (draft: KkFamilyDraftData) => void;
  onInspectKkPhoto?: () => void;
  onOpenVerifyEdit?: () => void;
}

const RELATIONSHIP_OPTIONS = [
  'Suami/Istri',
  'Anak Kandung',
  'Orang Tua',
  'Mertua',
  'Saudara Kandung',
  'Lainnya',
];

export const KkFamilySummaryCard: React.FC<KkFamilySummaryCardProps> = ({
  mode = 'summary',
  headName,
  headNik = '',
  familyCardNumber = '',
  familyCardPhotoUrl,
  familyCardFileName,
  dependents,
  isVerifiedRt = false,
  canEdit = false,
  isChecklistChecked = false,
  duplicateKkError,
  onChecklistChange,
  onDraftChange,
  onInspectKkPhoto,
  onOpenVerifyEdit,
}) => {
  // Inline row editing state (for mode === 'verify')
  const [editingDepId, setEditingDepId] = useState<string | null>(null);
  const [editDepName, setEditDepName] = useState('');
  const [editDepRel, setEditDepRel] = useState('Anak Kandung');
  const [editDepAge, setEditDepAge] = useState('');

  // Inline add dependent state
  const [isAddingDep, setIsAddingDep] = useState(false);
  const [newDepName, setNewDepName] = useState('');
  const [newDepRel, setNewDepRel] = useState('Suami/Istri');
  const [newDepAge, setNewDepAge] = useState('');

  // On-demand KK OCR extraction state inside RT review
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractFeedback, setExtractFeedback] = useState<string | null>(null);

  const emitDraft = (patch: Partial<KkFamilyDraftData>) => {
    if (!onDraftChange) return;
    onDraftChange({
      headName: patch.headName !== undefined ? patch.headName : headName,
      headNik: patch.headNik !== undefined ? patch.headNik : headNik,
      familyCardNumber: patch.familyCardNumber !== undefined ? patch.familyCardNumber : familyCardNumber,
      dependents: patch.dependents !== undefined ? patch.dependents : dependents,
    });
  };

  const handleStartEditDep = (dep: Dependent) => {
    setEditingDepId(dep.id);
    setEditDepName(dep.name);
    setEditDepRel(dep.relationship || 'Lainnya');
    setEditDepAge(typeof dep.age === 'number' ? String(dep.age) : '');
  };

  const handleSaveEditDep = (depId: string) => {
    const cleanName = editDepName.trim();
    if (!cleanName) return;
    const parsedAge = editDepAge.trim() ? parseInt(editDepAge, 10) : undefined;
    const nextDeps = dependents.map((d) =>
      d.id === depId
        ? {
            ...d,
            name: cleanName,
            relationship: editDepRel,
            age: Number.isFinite(parsedAge) ? parsedAge : undefined,
          }
        : d
    );
    emitDraft({ dependents: nextDeps });
    setEditingDepId(null);
  };

  const handleRemoveDep = (depId: string) => {
    const nextDeps = dependents.filter((d) => d.id !== depId);
    emitDraft({ dependents: nextDeps });
    if (editingDepId === depId) {
      setEditingDepId(null);
    }
  };

  const handleAddDep = () => {
    const cleanName = newDepName.trim();
    if (!cleanName) return;
    const parsedAge = newDepAge.trim() ? parseInt(newDepAge, 10) : undefined;
    const created: Dependent = {
      id: `dep_rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      relationship: newDepRel,
      age: Number.isFinite(parsedAge) ? parsedAge : undefined,
    };
    emitDraft({ dependents: [...dependents, created] });
    setNewDepName('');
    setNewDepRel('Anak Kandung');
    setNewDepAge('');
    setIsAddingDep(false);
  };

  const handleRunKkScan = async (replaceExisting: boolean = false) => {
    if (!familyCardPhotoUrl) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractFeedback(null);

    try {
      const result: ExtractedKkResult = await extractFamilyCardData(
        familyCardPhotoUrl,
        familyCardFileName
      );

      const nextHeadName = headName.trim() ? headName : result.headOfFamilyName || headName;
      const nextHeadNik = headNik.trim() ? headNik : result.headOfFamilyNik || headNik;
      const nextKkNumber =
        result.familyCardNumber && result.familyCardNumber.length === 16
          ? result.familyCardNumber
          : familyCardNumber;

      const baseList = replaceExisting ? [] : dependents;
      const { merged, addedCount } = mergeExtractedDependents(
        baseList,
        result.familyMembers,
        nextHeadName || result.headOfFamilyName,
        'edit'
      );

      emitDraft({
        headName: nextHeadName,
        headNik: nextHeadNik,
        familyCardNumber: nextKkNumber,
        dependents: merged,
      });

      const details: string[] = [];
      if (result.familyCardNumber) details.push(`No. KK ${result.familyCardNumber}`);
      details.push(
        replaceExisting
          ? `${merged.length} anggota keluarga dimuat dari KK`
          : addedCount > 0
          ? `${addedCount} anggota keluarga baru ditambahkan`
          : `${result.familyMembers.length} anggota pada KK sudah sesuai daftar`
      );
      setExtractFeedback(details.join(' • '));
    } catch (err: unknown) {
      setExtractError(
        err instanceof Error
          ? err.message
          : 'Gagal membaca dokumen KK secara otomatis. Anda tetap dapat mengedit secara manual.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  // =========================================================================
  // COMPACT SUMMARY MODE (untuk kartu pendaftar di daftar RT)
  // =========================================================================
  if (mode === 'summary') {
    const totalProtected = dependents.length + 1;

    return (
      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 space-y-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-slate-900 text-[11px] sm:text-xs">
              Ringkasan Anggota Keluarga KK
            </span>
            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-md">
              {totalProtected} Jiwa
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isVerifiedRt ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Terverifikasi RT</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-[10px] font-bold">
                Perlu Cek RT
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/90 px-2.5 py-2 rounded-lg border border-indigo-100 text-[11px]">
          <div className="truncate">
            <span className="text-slate-500">No. KK: </span>
            <span className="font-mono font-bold text-slate-900">
              {familyCardNumber || 'Belum diisi'}
            </span>
          </div>
          <div className="truncate">
            <span className="text-slate-500">Kepala Keluarga: </span>
            <span className="font-bold text-slate-900">{headName}</span>
          </div>
        </div>

        {dependents.length > 0 ? (
          <div className="space-y-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {dependents.map((dep, idx) => (
                <div
                  key={dep.id || `${dep.name}-${idx}`}
                  className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200/90 flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="font-bold text-slate-800 truncate">
                    {idx + 1}. {dep.name}
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                    {dep.relationship}
                    {typeof dep.age === 'number' ? ` • ${dep.age} th` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic px-1">
            Belum ada anggota keluarga tanggungan yang tercatat.
          </p>
        )}

        {canEdit && onOpenVerifyEdit && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onOpenVerifyEdit}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>Verifikasi / Edit Daftar Keluarga</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // FULL VERIFY & EDIT MODE (untuk modal verifikasi Ketua RT)
  // =========================================================================
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
      {/* Section Header + OCR Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-indigo-200/70">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                Verifikasi & Edit Data KK & Anggota Keluarga
              </h4>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md text-[10px] font-extrabold">
                Total {dependents.length + 1} Jiwa
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Cocokkan hasil ekstraksi KK dengan dokumen asli sebelum menyetujui pendaftaran.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {familyCardPhotoUrl && onInspectKkPhoto && (
            <button
              type="button"
              onClick={onInspectKkPhoto}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Buka Foto KK</span>
            </button>
          )}
          {familyCardPhotoUrl && canEdit && (
            <button
              type="button"
              onClick={() => void handleRunKkScan(false)}
              disabled={isExtracting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Pindai ulang berkas KK terlampir untuk mencocokkan No. KK dan anggota keluarga"
            >
              {isExtracting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ScanLine className="w-3.5 h-3.5" />
              )}
              <span>{isExtracting ? 'Membaca KK...' : 'Ekstrak Ulang dari KK'}</span>
            </button>
          )}
        </div>
      </div>

      {/* OCR Status Messages */}
      {extractFeedback && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Hasil baca KK: {extractFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setExtractFeedback(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {extractError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{extractError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExtractError(null)}
            className="text-rose-600 hover:text-rose-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editable Core KK & Head of Family Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-indigo-100">
        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            Nomor KK (16 Digit)
          </label>
          <div className="relative">
            <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={16}
              disabled={!canEdit}
              value={familyCardNumber}
              onChange={(e) =>
                emitDraft({ familyCardNumber: e.target.value.replace(/[^0-9]/g, '') })
              }
              placeholder="16 digit No. KK"
              className={`w-full pl-8 pr-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold outline-none ${
                duplicateKkError
                  ? 'border-rose-400 bg-rose-50 text-rose-900'
                  : familyCardNumber.length === 16
                  ? 'border-emerald-300 bg-emerald-50/40 text-slate-900'
                  : 'border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-500'
              }`}
            />
          </div>
          {duplicateKkError && (
            <p className="text-[10px] text-rose-600 font-bold mt-1">{duplicateKkError}</p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            Nama Kepala Keluarga
          </label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              disabled={!canEdit}
              value={headName}
              onChange={(e) => emitDraft({ headName: e.target.value })}
              placeholder="Nama Kepala Keluarga"
              className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-bold text-slate-900 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            NIK Kepala Keluarga (16 Digit)
          </label>
          <input
            type="text"
            maxLength={16}
            disabled={!canEdit}
            value={headNik}
            onChange={(e) => emitDraft({ headNik: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder="16 digit NIK"
            className="w-full px-2.5 py-1.5 border border-slate-300 bg-slate-50 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none"
          />
        </div>
      </div>

      {/* Family Members List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-800">
            Daftar Anggota Keluarga ({dependents.length} Tanggungan)
          </span>
          {canEdit && !isAddingDep && (
            <button
              type="button"
              onClick={() => setIsAddingDep(true)}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Tambah Anggota</span>
            </button>
          )}
        </div>

        {/* Add Dependent Inline Form */}
        {canEdit && isAddingDep && (
          <div className="p-3 bg-white rounded-xl border border-emerald-300 space-y-2.5 shadow-2xs">
            <p className="text-[11px] font-extrabold text-emerald-900">
              Tambah Anggota Keluarga Sesuai KK
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={newDepName}
                onChange={(e) => setNewDepName(e.target.value)}
                placeholder="Nama lengkap sesuai KK"
                className="sm:col-span-5 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:border-emerald-500"
              />
              <select
                value={newDepRel}
                onChange={(e) => setNewDepRel(e.target.value)}
                className="sm:col-span-4 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:border-emerald-500"
              >
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={120}
                value={newDepAge}
                onChange={(e) => setNewDepAge(e.target.value)}
                placeholder="Usia"
                className="sm:col-span-3 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddingDep(false)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddDep}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Simpan Baris</span>
              </button>
            </div>
          </div>
        )}

        {/* Table of Head + Dependents */}
        <div className="bg-white rounded-xl border border-indigo-100 divide-y divide-slate-100 overflow-hidden">
          {/* Row 0: Head of Family */}
          <div className="px-3 py-2 bg-slate-50/80 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-md bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                KK
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-slate-900 truncate">{headName || '-'}</p>
                <p className="text-[10px] font-mono text-slate-500">
                  NIK: {headNik || 'Belum diisi'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-bold shrink-0">
              Kepala Keluarga
            </span>
          </div>

          {dependents.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-500">
              Belum ada anggota keluarga tambahan pada daftar. Klik &ldquo;Ekstrak Ulang dari KK&rdquo; atau &ldquo;Tambah Anggota&rdquo; jika terdapat tanggungan pada dokumen KK.
            </div>
          ) : (
            dependents.map((dep, idx) => {
              const isEditingRow = editingDepId === dep.id;

              return (
                <div key={dep.id || idx} className="px-3 py-2.5 text-xs hover:bg-slate-50/70">
                  {isEditingRow ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={editDepName}
                          onChange={(e) => setEditDepName(e.target.value)}
                          placeholder="Nama lengkap"
                          className="sm:col-span-5 px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <select
                          value={editDepRel}
                          onChange={(e) => setEditDepRel(e.target.value)}
                          className="sm:col-span-4 px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          {RELATIONSHIP_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={editDepAge}
                          onChange={(e) => setEditDepAge(e.target.value)}
                          placeholder="Usia (th)"
                          className="sm:col-span-3 px-2.5 py-1.5 border border-indigo-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingDepId(null)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditDep(dep.id)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Simpan</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{dep.name}</p>
                          <p className="text-[11px] text-slate-500">
                            <span className="font-semibold text-indigo-700">
                              {dep.relationship}
                            </span>
                            {typeof dep.age === 'number' ? ` • ${dep.age} Tahun` : ''}
                          </p>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditDep(dep)}
                            className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit nama / hubungan / usia anggota keluarga"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDep(dep.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus anggota keluarga dari daftar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Verification Confirmation Checkbox */}
      {canEdit && onChecklistChange && (
        <label className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-emerald-200 cursor-pointer select-none hover:bg-emerald-50/40 transition-colors">
          <input
            type="checkbox"
            checked={isChecklistChecked}
            onChange={(e) => onChecklistChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <span className="text-[11px] text-slate-800 leading-relaxed font-medium">
            <strong className="text-emerald-900 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verifikasi Data KK oleh Ketua RT:
            </strong>{' '}
            Saya telah memeriksa berkas KK terlampir dan memastikan Nomor KK, Kepala Keluarga, serta daftar anggota keluarga di atas sudah sesuai.
          </span>
        </label>
      )}
    </div>
  );
};
