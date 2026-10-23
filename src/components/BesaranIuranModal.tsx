import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Coins,
  ShieldCheck,
  Landmark,
  Copy,
  Check,
  UserCheck,
  UserPlus,
  HeartHandshake,
  ArrowRight,
  Info,
  Bell,
  Megaphone,
} from 'lucide-react';
import { SystemSettings } from '../types';
import { formatIDR } from '../lib/storage';

export interface BesaranIuranModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onOpenLoginModal?: () => void;
  onOpenRegister?: () => void;
}

export const BesaranIuranModal: React.FC<BesaranIuranModalProps> = ({
  isOpen,
  onClose,
  settings,
  onOpenLoginModal,
  onOpenRegister,
}) => {
  const [copiedBankIndex, setCopiedBankIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const validBankAccounts = (settings.bankAccounts || []).filter(
    (b) => b && ((b.accountNumber && b.accountNumber.trim().length > 0) || (b.bankName && b.bankName.trim().length > 0))
  );

  const annualAmount = settings.annualFeeAmount || 300000;
  const monthlyAmount = settings.monthlyFeeAmount || Math.round(annualAmount / 12);

  const handleCopyAccountNumber = (accNumber: string, idx: number) => {
    navigator.clipboard.writeText(accNumber);
    setCopiedBankIndex(idx);
    setTimeout(() => setCopiedBankIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header Modal - Gradasi Elegan Emerald Announcement */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                    Pengumuman Resmi Kas
                  </span>
                  <span className="text-[11px] text-emerald-300 font-semibold">Tahun {new Date().getFullYear()}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                  Pengumuman Besaran Iuran Kas Paguyuban
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {settings.communityName || 'Paguyuban Warga Rukun Sejahtera'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-xs sm:text-sm">
          {/* Maklumat Surat Ketetapan Pengurus */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
            <Megaphone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-emerald-900">
              <strong>Maklumat Pengurus:</strong> Diberitahukan kepada seluruh warga paguyuban mengenai ketetapan resmi besaran iuran dana kematian untuk menjamin kelangsungan santunan duka cita dan pelayanan pemakaman keluarga warga.
            </p>
          </div>

          {/* 1. KARTU BESARAN IURAN TAHUNAN & PENDAFTARAN BEBAS BIAYA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Kartu Iuran Tahunan (Utama) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border-2 border-emerald-500/40 shadow-xs relative overflow-hidden space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                  Iuran Tahunan KK
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono">
                    {formatIDR(annualAmount)}
                  </span>
                  <span className="text-xs text-emerald-800 font-bold">/ KK / Tahun</span>
                </div>
                <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                  Setara {formatIDR(monthlyAmount)} per bulan
                </p>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-emerald-200/80">
                Mencakup hak santunan pemulasaraan jenazah, mobil ambulans 24 jam, kain kafan, serta santunan tunai duka cita untuk seluruh anggota keluarga satu KK.
              </p>
            </div>

            {/* Pendaftaran Gratis (Bebas Biaya Pendaftaran) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border-2 border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-700 text-white shadow-2xs">
                    Biaya Pendaftaran
                  </span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono">
                      GRATIS (Rp 0)
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                    Tanpa Biaya Registrasi Awal & KTA
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-slate-200">
                Pendaftaran warga baru sama sekali tidak dipungut biaya pendaftaran (Rp 0). Warga hanya menyetorkan Iuran Tahunan kas paguyuban setelah berkas diverifikasi oleh Ketua RT.
              </p>
            </div>
          </div>

          {/* 2. REKENING RESMI TUJUAN PEMBAYARAN KAS */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-700" />
                <h4 className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                  Rekening Bank Resmi Kas Paguyuban
                </h4>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-md">
                Kas Bersama
              </span>
            </div>

            {validBankAccounts.length > 0 ? (
              <div className="space-y-2">
                {validBankAccounts.map((bank, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-black text-slate-800">
                          {bank.bankName}
                        </span>
                        <strong className="font-mono text-sm sm:text-base font-black text-emerald-900 tracking-wide">
                          {bank.accountNumber}
                        </strong>
                      </div>
                      {bank.accountHolder && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Atas Nama: <strong className="text-slate-700">{bank.accountHolder}</strong>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyAccountNumber(bank.accountNumber, idx)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
                    >
                      {copiedBankIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin No. Rekening</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Hubungi Bendahara Paguyuban ({settings.treasurerName || 'Bendahara'}: {settings.treasurerPhone || '-'}) untuk informasi nomor rekening kas resmi.
              </p>
            )}
          </div>

          {/* 3. ALUR PEMBAYARAN: TETAP LEWAT HALAMAN USER ANGGOTA */}
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300/80 text-amber-950 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide">
                Alur & Prosedur Pembayaran Iuran
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              Sesuai ketetapan sistem paguyuban, <strong>pembayaran iuran dilakukan melalui Portal Warga (Halaman Akun Anggota)</strong> setelah pendaftaran berkas disetujui oleh Ketua RT setempat.
            </p>
            <ul className="text-[11px] text-amber-900 space-y-1 pl-4 list-disc font-medium">
              <li><strong>Pendaftar Baru:</strong> Pendaftaran gratis tanpa biaya awal. Tunggu verifikasi berkas KK dari Ketua RT, setelah disetujui dapat langsung menyetorkan iuran tahunan.</li>
              <li><strong>Warga Terdaftar:</strong> Masuk (Login) ke Portal Warga untuk menginput setoran iuran tahunan dan mendapatkan kwitansi resmi otomatis.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenRegister && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRegister();
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Daftar Warga Baru</span>
              </button>
            )}

            {onOpenLoginModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLoginModal();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <UserCheck className="w-4 h-4" />
                <span>Masuk ke Portal Warga untuk Bayar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
