import React from 'react';
import { Download, Smartphone, X, CheckCircle2, Share, PlusSquare, ArrowUpRight } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

import { AppIcon } from './AppIcon';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { hasDeferredPrompt, isIOS, isInstalled, installApp } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (hasDeferredPrompt) {
      const success = await installApp();
      if (success) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 text-white">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border-b border-slate-800 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950 border-2 border-emerald-400/60 p-0.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center shrink-0 overflow-hidden">
              <AppIcon size={48} className="rounded-xl" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40 mb-1">
                <Smartphone className="w-3 h-3 text-emerald-400" />
                <span>Aplikasi Mobile (PWA)</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                Pasang di Layar Utama HP
              </h3>
              <p className="text-xs text-slate-400">
                Akses langsung cepat seperti aplikasi Android & iOS
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Keunggulan */}
          <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
            <p className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Kelebihan Menginstal Ikon Aplikasi:</span>
            </p>
            <ul className="space-y-1.5 text-slate-300 pl-5 list-disc leading-relaxed">
              <li>Ikon resmi langsung tampil di layar depan HP Anda.</li>
              <li>Membuka secara <strong>Layar Penuh (Full Screen)</strong> tanpa bar browser.</li>
              <li>Memudahkan warga cek KTA digital & info santunan duka.</li>
            </ul>
          </div>

          {/* Conditional Install Instructions */}
          {hasDeferredPrompt ? (
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>Pasang Ikon Aplikasi Sekarang</span>
              </button>
              <p className="text-center text-[11px] text-slate-400">
                Ketuk tombol di atas lalu pilih <strong>Instal / Pasang</strong> saat jendela browser muncul.
              </p>
            </div>
          ) : isIOS ? (
            <div className="space-y-2.5 bg-blue-950/40 p-4 rounded-2xl border border-blue-500/30 text-blue-100">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Share className="w-4 h-4 text-blue-400" />
                <span>Petunjuk untuk Pengguna iPhone / iPad (Safari):</span>
              </p>
              <ol className="space-y-2 pl-4 list-decimal text-slate-300 leading-relaxed text-[11px]">
                <li>
                  Ketuk tombol <strong>Bagikan (Share)</strong>{' '}
                  <span className="inline-block p-1 bg-white/10 rounded font-mono text-[10px]">⎋ / Share</span> di bagian bawah Safari.
                </li>
                <li>
                  Gulir ke bawah dan pilih opsi{' '}
                  <strong className="text-white flex items-center gap-1 inline-flex">
                    <PlusSquare className="w-3.5 h-3.5 text-blue-400" /> Tambahkan ke Layar Utama (Add to Home Screen)
                  </strong>.
                </li>
                <li>
                  Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas. Ikon aplikasi akan langsung terpasang di layar iPhone Anda!
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-2.5 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-slate-300">
              <p className="font-bold text-white flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Petunjuk Tambah ke Layar Utama (Chrome / Browser HP):</span>
              </p>
              <ol className="space-y-2 pl-4 list-decimal text-slate-300 leading-relaxed text-[11px]">
                <li>
                  Ketuk menu titik tiga (<strong>⋮</strong>) di pojok kanan atas browser Anda.
                </li>
                <li>
                  Pilih menu <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama" (Add to Home screen)</strong>.
                </li>
                <li>
                  Ikon aplikasi otomatis terpasang di menu utama HP Anda dan siap dibuka langsung kapan saja!
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">
            {isInstalled ? '✅ Aplikasi sudah terpasang di HP' : 'Siap pasang di Android & iOS'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
