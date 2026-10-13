import React, { useState } from 'react';
import {
  Database,
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  Users,
  CreditCard,
  HeartHandshake,
  Cloud,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberCount: number;
  paymentCount: number;
  claimCount: number;
  onClearDemoData: () => Promise<void> | void;
  onRestoreDemoData: () => Promise<void> | void;
  onClearClaims?: () => Promise<void> | void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  memberCount,
  paymentCount,
  claimCount,
  onClearDemoData,
  onRestoreDemoData,
  onClearClaims,
}) => {
  const [confirmClearStep, setConfirmClearStep] = useState(false);
  const [confirmClearClaimsStep, setConfirmClearClaimsStep] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClear = async () => {
    try {
      setIsProcessing(true);
      await onClearDemoData();
      setConfirmClearStep(false);
      setActionSuccess('Seluruh data demo (termasuk data realisasi santunan) berhasil dihapus bersih.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Gagal mengosongkan data. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearOnlyClaims = async () => {
    if (!onClearClaims) return;
    try {
      setIsProcessing(true);
      await onClearClaims();
      setConfirmClearClaimsStep(false);
      setActionSuccess('Seluruh data realisasi santunan duka berhasil dikosongkan.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to clear claims:', error);
      alert('Gagal mengosongkan data realisasi. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsProcessing(true);
      await onRestoreDemoData();
      setActionSuccess('Data contoh (demo) berhasil dipulihkan ke database.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to restore data:', error);
      alert('Gagal memulihkan data demo. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manajemen Basis Data & Data Demo</span>
              </h2>
              <p className="text-xs text-slate-400">
                Kelola status data aplikasi (Cloud Firestore & Penyimpanan Lokal)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Message */}
          {actionSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Current Database Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Ringkasan Data Saat Ini
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                <Cloud className="w-3 h-3" /> Firestore Terhubung
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-semibold">Anggota</span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">{memberCount}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold">Transaksi</span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">{paymentCount}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] font-semibold">Santunan</span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">{claimCount}</span>
              </div>
            </div>
          </div>

          {/* Action 1: Hapus Semua Data Demo */}
          <div className="border border-rose-200 bg-rose-50/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-rose-950">
                  Hapus Seluruh Data Demo (Mulai dari Nol)
                </h3>
                <p className="text-xs text-rose-800/80 leading-relaxed">
                  Kosongkan database dari semua data contoh (anggota, transaksi iuran, dan santunan)
                  sehingga aplikasi bersih dan siap digunakan untuk pencatatan warga riil. Akun pengurus
                  dan pengaturan tetap dipertahankan.
                </p>
              </div>
            </div>

            {!confirmClearStep ? (
              <div className="pt-2 text-right">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setConfirmClearStep(true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Semua Data Demo</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 p-4 bg-white rounded-xl border-2 border-rose-300 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Konfirmasi Pengosongan Data</span>
                </div>
                <p className="text-xs text-slate-600">
                  Apakah Anda yakin? Tindakan ini akan menghapus {memberCount} data anggota, {paymentCount} transaksi iuran, dan {claimCount} santunan dari database.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmClearStep(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleClear}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Ya, Hapus Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action 2: Kosongkan Khusus Data Realisasi Santunan Duka */}
          {onClearClaims && (
            <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-amber-950">
                    Kosongkan Khusus Data Realisasi Santunan Duka
                  </h3>
                  <p className="text-xs text-amber-900/80 leading-relaxed">
                    Hanya menghapus riwayat seluruh pengajuan klaim dan realisasi santunan duka ({claimCount} klaim) tanpa menghapus data warga terdaftar atau transaksi iuran kas.
                  </p>
                </div>
              </div>

              {!confirmClearClaimsStep ? (
                <div className="pt-2 text-right">
                  <button
                    type="button"
                    disabled={isProcessing || claimCount === 0}
                    onClick={() => setConfirmClearClaimsStep(true)}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Kosongkan Data Realisasi ({claimCount})</span>
                  </button>
                </div>
              ) : (
                <div className="mt-3 p-4 bg-white rounded-xl border-2 border-amber-300 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Konfirmasi Pengosongan Data Realisasi</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Apakah Anda yakin ingin mengosongkan seluruh {claimCount} data klaim realisasi santunan duka?
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmClearClaimsStep(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleClearOnlyClaims}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengosongkan...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Ya, Kosongkan Realisasi</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action 3: Pulihkan Data Contoh (Demo) */}
          <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900">
                  Pulihkan Contoh Data Demo
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Isi kembali database dengan data simulasi warga (5 cluster RT), contoh transaksi lunas &
                  antrean validasi, serta simulasi klaim santunan duka untuk keperluan uji coba atau demo.
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRestore}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 text-emerald-400" />
                    <span>Pulihkan Data Demo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
