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
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberCount: number;
  paymentCount: number;
  claimCount: number;
  onClearTransactions?: () => Promise<void> | void;
  onClearDemoData?: () => Promise<void> | void;
  onRestoreDemoData?: () => Promise<void> | void;
  onClearClaims?: () => Promise<void> | void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  memberCount,
  paymentCount,
  claimCount,
  onClearTransactions,
  onClearDemoData,
  onRestoreDemoData,
  onClearClaims,
}) => {
  const [confirmClearTransactionsStep, setConfirmClearTransactionsStep] = useState(false);
  const [confirmClearClaimsStep, setConfirmClearClaimsStep] = useState(false);
  const [confirmClearAllStep, setConfirmClearAllStep] = useState(false);
  const [showAdvancedTesting, setShowAdvancedTesting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Bersihkan Seluruh Data (Registrasi Warga, User Anggota, Pembayaran, & Realisasi Manfaat)
  const handleClearAllData = async () => {
    if (!onClearDemoData) return;
    try {
      setIsProcessing(true);
      await onClearDemoData();
      setConfirmClearAllStep(false);
      setActionSuccess('Seluruh data registrasi warga, akun user anggota, pembayaran, dan realisasi manfaat berhasil dibersihkan.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2200);
    } catch (error) {
      console.error('Failed to clear all data in Firebase:', error);
      alert('Gagal membersihkan data di database Firebase. Silakan periksa koneksi dan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Hapus Data Transaksi di Database Firebase
  const handleClearTransactions = async () => {
    try {
      setIsProcessing(true);
      if (onClearTransactions) {
        await onClearTransactions();
      } else if (onClearDemoData) {
        await onClearDemoData();
      }
      setConfirmClearTransactionsStep(false);
      setActionSuccess('Seluruh data transaksi iuran dan klaim di database Firebase berhasil dihapus bersih.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2200);
    } catch (error) {
      console.error('Failed to clear transactions in Firebase:', error);
      alert('Gagal menghapus data transaksi di database Firebase. Silakan periksa koneksi dan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Kosongkan Khusus Data Realisasi Santunan Duka
  const handleClearOnlyClaims = async () => {
    if (!onClearClaims) return;
    try {
      setIsProcessing(true);
      await onClearClaims();
      setConfirmClearClaimsStep(false);
      setActionSuccess('Seluruh data realisasi santunan duka di database Firebase berhasil dikosongkan.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2200);
    } catch (error) {
      console.error('Failed to clear claims in Firebase:', error);
      alert('Gagal mengosongkan data realisasi di database Firebase. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Pulihkan Data Contoh (Pengujian Pengembang)
  const handleRestore = async () => {
    if (!onRestoreDemoData) return;
    try {
      setIsProcessing(true);
      await onRestoreDemoData();
      setActionSuccess('Data contoh (demo) berhasil dipulihkan ke database.');
      setTimeout(() => {
        setActionSuccess(null);
        onClose();
      }, 2200);
    } catch (error) {
      console.error('Failed to restore data:', error);
      alert('Gagal memulihkan data demo. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manajemen Transaksi di Database Firebase</span>
              </h2>
              <p className="text-xs text-slate-400">
                Kelola penghapusan riwayat transaksi kas di Cloud Firestore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Ringkasan Data Saat Ini
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" /> Cloud Firestore Terhubung
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs relative">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-bold">Warga (Anggota)</span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">{memberCount}</span>
                <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 py-0.5 px-1.5 rounded-md">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Aman (Tetap Ada)</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-rose-200 shadow-2xs">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] font-bold">Transaksi Iuran</span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">{paymentCount}</span>
                <div className="mt-1 text-[10px] font-bold text-rose-600 bg-rose-50 py-0.5 px-1.5 rounded-md">
                  <span>Dihapus</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-center gap-1 text-slate-500 mb-1">
                  <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] font-bold">Klaim Santunan</span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900">{claimCount}</span>
                <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 py-0.5 px-1.5 rounded-md">
                  <span>Dihapus</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action 1: Bersihkan Seluruh Data (Registrasi Warga, User Anggota, Pembayaran, & Realisasi Manfaat) */}
          <div className="border-2 border-red-400 bg-red-50/60 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-red-950">
                    Bersihkan Seluruh Data Registrasi, Pembayaran & Realisasi
                  </h3>
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-extrabold rounded-full">
                    Admin Utama
                  </span>
                </div>
                <p className="text-xs text-red-900/80 leading-relaxed">
                  Menghapus bersih seluruh data pendaftaran warga/anggota ({memberCount} warga), akun login user anggota yang pendaftarannya dihapus, riwayat transaksi pembayaran iuran ({paymentCount} transaksi), dan klaim realisasi santunan ({claimCount} klaim) langsung dari Cloud Firestore.
                </p>
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-[11px] text-emerald-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Akun administrator/pengurus paguyuban, master kluster RT, master santunan, dan pengaturan sistem tetap aman dan tidak terhapus.</span>
                </div>
              </div>
            </div>

            {!confirmClearAllStep ? (
              <div className="pt-2 text-right">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setConfirmClearAllStep(true)}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Bersihkan Seluruh Data</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 p-4 bg-white rounded-xl border-2 border-red-500 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-red-700 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Konfirmasi Pembersihan Seluruh Data</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Apakah Anda yakin? Tindakan ini akan menghapus permanen data registrasi {memberCount} warga, seluruh akun user anggota, {paymentCount} pembayaran iuran, dan {claimCount} klaim realisasi santunan dari database Cloud Firestore.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmClearAllStep(false)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleClearAllData}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Membersihkan...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Ya, Bersihkan Seluruh Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action 2: Hapus Data Transaksi di Database Firebase (Fitur Utama Pengganti Hapus Data Demo) */}
          <div className="border-2 border-rose-300 bg-rose-50/50 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-rose-950">
                    Hapus Data Transaksi di Database Firebase
                  </h3>
                  <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-extrabold rounded-full">
                    Admin
                  </span>
                </div>
                <p className="text-xs text-rose-900/80 leading-relaxed">
                  Menghapus seluruh riwayat data transaksi iuran kas warga dan klaim realisasi santunan duka (<strong className="text-rose-700">{paymentCount} transaksi</strong>, <strong className="text-rose-700">{claimCount} santunan</strong>) langsung dari database Cloud Firestore.
                </p>
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-[11px] text-emerald-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Seluruh data anggota warga ({memberCount} warga), kluster RT, akun pengurus, dan pengaturan paguyuban tetap aman dan tidak akan terhapus.</span>
                </div>
              </div>
            </div>

            {!confirmClearTransactionsStep ? (
              <div className="pt-2 text-right">
                <button
                  type="button"
                  disabled={isProcessing || (paymentCount === 0 && claimCount === 0)}
                  onClick={() => setConfirmClearTransactionsStep(true)}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Data Transaksi di Firebase</span>
                </button>
              </div>
            ) : (
              <div className="mt-3 p-4 bg-white rounded-xl border-2 border-rose-400 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Konfirmasi Hapus Data Transaksi Firebase</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Apakah Anda yakin? Tindakan ini akan menghapus secara permanen seluruh <strong className="text-rose-700 font-bold">{paymentCount} transaksi iuran</strong> dan <strong className="text-rose-700 font-bold">{claimCount} klaim santunan</strong> dari Cloud Firestore. Saldo kas dana kematian akan di-reset ke Rp 0.
                  <br />
                  <span className="text-emerald-700 font-bold mt-1 inline-block">
                    ✓ Data {memberCount} anggota warga dan akun login pengurus TIDAK akan terhapus.
                  </span>
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmClearTransactionsStep(false)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleClearTransactions}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menghapus Transaksi di Firebase...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Ya, Hapus Transaksi Sekarang</span>
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
                    Hanya menghapus riwayat seluruh pengajuan klaim dan realisasi santunan duka ({claimCount} klaim) di Cloud Firestore tanpa memengaruhi catatan pembayaran iuran kas maupun data warga.
                  </p>
                </div>
              </div>

              {!confirmClearClaimsStep ? (
                <div className="pt-2 text-right">
                  <button
                    type="button"
                    disabled={isProcessing || claimCount === 0}
                    onClick={() => setConfirmClearClaimsStep(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
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
                    Apakah Anda yakin ingin mengosongkan seluruh {claimCount} data klaim realisasi santunan duka dari Cloud Firestore?
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmClearClaimsStep(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleClearOnlyClaims}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
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

          {/* Action 3: Pengaturan Pengembang Lanjutan (Collapsible) */}
          {onRestoreDemoData && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowAdvancedTesting(!showAdvancedTesting)}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Opsi Lanjutan: Pulihkan Data Contoh (Demo Simulasi)</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  {showAdvancedTesting ? (
                    <>
                      <span>Tutup</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Lihat</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </span>
              </button>

              {showAdvancedTesting && (
                <div className="p-5 pt-3 border-t border-slate-200 space-y-3 animate-in fade-in">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Fitur ini hanya digunakan saat ingin mengisi kembali database dengan data simulasi (contoh warga RT, transaksi, dan santunan) untuk uji coba.
                  </p>
                  <div className="text-right">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleRestore}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Pulihkan Data Demo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
