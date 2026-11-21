import React, { useEffect, useState } from 'react';
import {
  X,
  HelpCircle,
  ShieldCheck,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Users,
  Clock,
  CreditCard,
  Crown,
  Heart,
  CheckSquare,
  Square,
  MessageSquare,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { AppUser } from '../types';

const RT_ONBOARDING_STORAGE_PREFIX = 'dana_kematian_rt_onboarding_seen_v1';

export function getRtOnboardingStorageKey(userId?: string): string {
  return `${RT_ONBOARDING_STORAGE_PREFIX}:${userId || 'default'}`;
}

export function hasSeenRtOnboarding(userId?: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(getRtOnboardingStorageKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function markRtOnboardingSeen(userId?: string, seen: boolean = true): void {
  if (typeof window === 'undefined') return;
  try {
    if (seen) {
      localStorage.setItem(getRtOnboardingStorageKey(userId), 'true');
    } else {
      localStorage.removeItem(getRtOnboardingStorageKey(userId));
    }
  } catch {
    // ignore storage errors
  }
}

export interface RtOnboardingHelpModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  activeUser?: AppUser | null;
  clusterName?: string;
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalCount: number;
  claimsCount: number;
  isFirstTimeAutoOpen?: boolean;
  onSelectFilterTab?: (tab: 'pending' | 'verified' | 'rejected' | 'all' | 'claims') => void;
}

interface GuideStep {
  id: number;
  shortLabel: string;
  title: string;
  subtitle: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 0,
    shortLabel: '01. Antrean RT',
    title: 'Ruang Lingkup & Antrean Verifikasi Cluster',
    subtitle: 'Memahami batas wilayah cluster dan daftar calon anggota yang perlu diperiksa.',
  },
  {
    id: 1,
    shortLabel: '02. Periksa KK',
    title: 'Pemeriksaan Berkas Kartu Keluarga (KK) & NIK',
    subtitle: 'Checklist wajib sebelum menyetujui pendaftaran warga di wilayah RT Anda.',
  },
  {
    id: 2,
    shortLabel: '03. Keputusan',
    title: 'Menyetujui vs. Menolak Berkas Pendaftaran',
    subtitle: 'Simulasikan dampak tombol Setujui, Tolak, dan Verifikasi Massal terhadap akun warga.',
  },
  {
    id: 3,
    shortLabel: '04. Alur KTA',
    title: 'Alur Lanjutan Hingga KTA Digital Resmi Terbit',
    subtitle: 'Posisi tugas Ketua RT dalam 4 gerbang persetujuan paguyuban.',
  },
  {
    id: 4,
    shortLabel: '05. Klaim Duka',
    title: 'Pengajuan Klaim Santunan Warga (Pintu 1: RT)',
    subtitle: 'Cara cepat melaporkan warga berduka agar santunan dan ambulans segera diproses.',
  },
];

const VERIFICATION_CHECKLIST = [
  {
    id: 'chk-kk',
    title: 'Cocokkan 16 digit NIK & Nomor KK dengan foto lampiran KK',
    detail: 'Klik tombol "Periksa KK" pada kartu warga untuk memperbesar foto dan memastikan tulisan terbaca jelas.',
  },
  {
    id: 'chk-address',
    title: 'Pastikan alamat blok dan nomor rumah masuk wilayah RT Anda',
    detail: 'Cek kesesuaian alamat domisili aktual warga agar tidak salah verifikasi lintas cluster.',
  },
  {
    id: 'chk-dependents',
    title: 'Tinjau daftar tanggungan keluarga serumah di KK',
    detail: 'Pastikan jumlah jiwa dan nama tanggungan (pasangan/anak/orang tua) sesuai dengan Kartu Keluarga.',
  },
  {
    id: 'chk-wa',
    title: 'Konfirmasi via WhatsApp bila data meragukan atau foto buram',
    detail: 'Gunakan tautan "WA" pada kartu warga untuk menghubungi pendaftar secara langsung sebelum mengambil keputusan.',
  },
];

const PIPELINE_STAGES = [
  {
    step: 'Tahap 1',
    actor: 'Calon Warga',
    title: 'Registrasi & Unggah KK',
    statusLabel: 'Menunggu Verifikasi RT',
    description: 'Warga mengisi formulir pendaftaran, memasukkan daftar keluarga di KK, dan mengunggah foto Kartu Keluarga.',
  },
  {
    step: 'Tahap 2 (Anda)',
    actor: 'Ketua RT Cluster',
    title: 'Verifikasi Domisili & Berkas',
    statusLabel: 'Menunggu Pembayaran',
    description: 'Setelah Anda klik Setujui, menu Bayar Iuran pada akun warga otomatis terbuka agar dapat melakukan transfer.',
  },
  {
    step: 'Tahap 3',
    actor: 'Warga & Bendahara',
    title: 'Transfer Iuran & Validasi Kas',
    statusLabel: 'Menunggu Persetujuan Ketua Paguyuban',
    description: 'Warga mengunggah bukti transfer iuran, lalu Bendahara memvalidasi mutasi kas dan menerbitkan Kwitansi Digital.',
  },
  {
    step: 'Tahap 4',
    actor: 'Ketua Paguyuban',
    title: 'Pengesahan Akhir & Terbit KTA',
    statusLabel: 'Aktif (KTA QR Terbit)',
    description: 'Ketua Paguyuban memberikan pengesahan akhir. Status warga menjadi Aktif dan KTA Digital ber-QR Code resmi diterbitkan.',
  },
];

export const RtOnboardingHelpModal: React.FC<RtOnboardingHelpModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  clusterName,
  pendingCount,
  verifiedCount,
  rejectedCount,
  totalCount,
  claimsCount,
  isFirstTimeAutoOpen = false,
  onSelectFilterTab,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [simulatedDecision, setSimulatedDecision] = useState<'approve' | 'reject'>('approve');
  const [selectedPipelineIdx, setSelectedPipelineIdx] = useState<number>(1);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDontShowAgain(!hasSeenRtOnboarding(activeUser?.id) ? true : hasSeenRtOnboarding(activeUser?.id));
    }
  }, [isOpen, activeUser?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(dontShowAgain);
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dontShowAgain, onClose]);

  if (!isOpen) return null;

  const toggleChecklist = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedChecklistCount = VERIFICATION_CHECKLIST.filter((item) => checkedItems[item.id]).length;
  const activeGuide = GUIDE_STEPS[currentStep];
  const clusterDisplay = clusterName || activeUser?.cluster || 'Semua Cluster';
  const progressPercent = Math.round(((currentStep + 1) / GUIDE_STEPS.length) * 100);

  const handleJumpToTab = (tab: 'pending' | 'verified' | 'rejected' | 'all' | 'claims') => {
    if (onSelectFilterTab) {
      onSelectFilterTab(tab);
    }
    onClose(dontShowAgain);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rt-onboarding-title"
      onClick={() => onClose(dontShowAgain)}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span>{isFirstTimeAutoOpen ? 'Selamat Datang Ketua RT' : 'Panduan Operasional RT'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-emerald-400">{clusterDisplay}</span>
                {activeUser?.name && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{activeUser.name}</span>
                  </>
                )}
              </div>
              <h2 id="rt-onboarding-title" className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Alur Verifikasi Warga & Tugas Ketua RT
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onClose(dontShowAgain)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shrink-0 cursor-pointer"
              aria-label="Tutup panduan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Navigation Tabs */}
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Langkah <strong className="text-white tabular-nums">{currentStep + 1}</strong> dari{' '}
                <span className="tabular-nums">{GUIDE_STEPS.length}</span>
              </span>
              <span className="font-mono tabular-nums text-emerald-400">{progressPercent}% selesai</span>
            </div>

            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
              {GUIDE_STEPS.map((step, idx) => {
                const isActive = idx === currentStep;
                const isDone = idx < currentStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : isDone
                        ? 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {step.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-slate-800">
          {/* Active Step Header */}
          <div className="pb-4 border-b border-slate-200">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">{activeGuide.title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{activeGuide.subtitle}</p>
          </div>

          {/* STEP 1: Scope & Queue */}
          {currentStep === 0 && (
            <div className="space-y-5">
              {/* Live Cluster Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50">
                <div className="p-3.5">
                  <span className="text-xs text-slate-500 block">Menunggu Verifikasi</span>
                  <strong className="text-xl font-bold text-amber-700 tabular-nums mt-0.5 block">
                    {pendingCount}
                  </strong>
                </div>
                <div className="p-3.5">
                  <span className="text-xs text-slate-500 block">Disetujui RT</span>
                  <strong className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5 block">
                    {verifiedCount}
                  </strong>
                </div>
                <div className="p-3.5">
                  <span className="text-xs text-slate-500 block">Ditolak / Koreksi</span>
                  <strong className="text-xl font-bold text-rose-700 tabular-nums mt-0.5 block">
                    {rejectedCount}
                  </strong>
                </div>
                <div className="p-3.5">
                  <span className="text-xs text-slate-500 block">Total Warga Cluster</span>
                  <strong className="text-xl font-bold text-slate-900 tabular-nums mt-0.5 block">
                    {totalCount}
                  </strong>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">Tampilan Terkunci Sesuai Wilayah Cluster Anda</p>
                    <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                      Daftar warga di portal ini otomatis disaring hanya untuk wilayah{' '}
                      <strong className="text-slate-900">{clusterDisplay}</strong> sehingga Anda hanya memverifikasi
                      warga di lingkungan RT Anda sendiri.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">Fokus Utama: Tab "Menunggu Verifikasi"</p>
                    <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                      Setiap warga yang baru mendaftar tidak dapat membayar iuran kas sebelum berkasnya disetujui pada
                      tab <strong>Menunggu Verifikasi</strong>. Gunakan kotak pencarian untuk mencari nama, NIK, atau
                      blok rumah dengan cepat.
                    </p>
                  </div>
                </div>
              </div>

              {onSelectFilterTab && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                  <span className="text-xs text-slate-500">
                    Ingin langsung membuka antrean pendaftaran cluster saat ini?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToTab('pending')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Buka Antrean ({pendingCount})</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Interactive KK & NIK Checklist */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Centang poin di bawah sebagai simulasi pemeriksaan berkas warga:</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {completedChecklistCount}/{VERIFICATION_CHECKLIST.length} diperiksa
                  </span>
                  {completedChecklistCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCheckedItems({})}
                      className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                      title="Ulang checklist"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {VERIFICATION_CHECKLIST.map((item) => {
                  const isChecked = Boolean(checkedItems[item.id]);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklist(item.id)}
                      className={`w-full text-left p-3.5 sm:p-4 flex items-start gap-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                        isChecked ? 'bg-emerald-50/60' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-emerald-700" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </span>
                      <span className="space-y-0.5">
                        <span
                          className={`block text-sm font-semibold ${
                            isChecked ? 'text-emerald-950' : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="block text-xs text-slate-600 leading-relaxed">{item.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-700" />
                  <span>
                    Tombol <strong>Periksa KK</strong> berada di baris lampiran setiap kartu warga.
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span>
                    Tombol <strong>WA</strong> langsung membuka obrolan ke nomor pendaftar.
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Interactive Decision Outcome Simulator */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setSimulatedDecision('approve')}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    simulatedDecision === 'approve'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Simulasi: Setujui (Verifikasi RT)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedDecision('reject')}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    simulatedDecision === 'reject'
                      ? 'bg-white text-rose-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Simulasi: Tolak Berkas
                </button>
              </div>

              {simulatedDecision === 'approve' ? (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                    <span>Dampak Saat Klik "Setujui (Verifikasi RT)"</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-emerald-200/80 space-y-1">
                      <span className="text-slate-500 block">Perubahan Status Warga</span>
                      <p className="font-semibold text-slate-900">
                        Menunggu Verifikasi RT <span aria-hidden="true">→</span>{' '}
                        <span className="text-emerald-700">Menunggu Pembayaran</span>
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-emerald-200/80 space-y-1">
                      <span className="text-slate-500 block">Akses Portal Warga</span>
                      <p className="font-semibold text-slate-900">
                        Tombol <strong>Bayar Iuran</strong> terbuka dan nama Ketua RT tercatat sebagai verifikator.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Anda juga dapat mengisi catatan verifikasi opsional sebelum konfirmasi. Jika terdapat banyak warga
                    sekaligus yang sudah valid, gunakan tombol <strong>Verifikasi Semua</strong> di bilah atas.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <XCircle className="w-5 h-5 text-rose-700 shrink-0" />
                    <span>Dampak Saat Klik "Tolak"</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-rose-200/80 space-y-1">
                      <span className="text-slate-500 block">Perubahan Status Warga</span>
                      <p className="font-semibold text-slate-900">
                        Menunggu Verifikasi RT <span aria-hidden="true">→</span>{' '}
                        <span className="text-rose-700">Ditolak</span>
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-rose-200/80 space-y-1">
                      <span className="text-slate-500 block">Alasan Penolakan Wajib Diisi</span>
                      <p className="font-semibold text-slate-900">
                        Warga menerima alasan penolakan yang jelas (misal: foto KK buram / salah alamat RT).
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-rose-900 leading-relaxed">
                    Berkas yang ditolak tersimpan di tab <strong>Ditolak</strong> dan masih dapat ditinjau ulang
                    sewaktu-waktu melalui tombol <strong>Tinjau Ulang / Setujui</strong> jika warga sudah melengkapi data.
                  </p>
                </div>
              )}

              <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                <strong>Penting:</strong> Nama petugas pada kolom <em>"Verifikator RT Aktif"</em> di pojok kanan atas
                halaman akan otomatis terekam pada riwayat verifikasi dan KTA warga.
              </div>
            </div>
          )}

          {/* STEP 4: Full 4-Stage Pipeline */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Klik setiap tahapan di bawah untuk melihat peran masing-masing pengurus hingga KTA Digital warga aktif:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isSelected = idx === selectedPipelineIdx;
                  const isRtStage = idx === 1;
                  return (
                    <button
                      key={stage.step}
                      type="button"
                      onClick={() => setSelectedPipelineIdx(idx)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : isRtStage
                          ? 'bg-emerald-50/70 border-emerald-300 text-slate-900 hover:bg-emerald-100/60'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-semibold block ${
                          isSelected ? 'text-emerald-400' : isRtStage ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {stage.step}
                      </span>
                      <strong className="text-xs font-bold block mt-0.5 leading-snug">{stage.title}</strong>
                    </button>
                  );
                })}
              </div>

              {(() => {
                const detail = PIPELINE_STAGES[selectedPipelineIdx];
                const DetailIcon =
                  selectedPipelineIdx === 0
                    ? Users
                    : selectedPipelineIdx === 1
                    ? ShieldCheck
                    : selectedPipelineIdx === 2
                    ? CreditCard
                    : Crown;
                return (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                        <DetailIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          {detail.step}: {detail.title}
                        </span>
                      </div>
                      <span className="text-xs text-slate-600">
                        Penanggung jawab: <strong className="text-slate-900">{detail.actor}</strong>
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{detail.description}</p>
                    <p className="text-xs text-slate-500 pt-1">
                      Status sistem pada tahap ini:{' '}
                      <strong className="text-slate-900">{detail.statusLabel}</strong>
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* STEP 5: RT Death Claim Submission (Pintu 1) */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">
                      Ketua RT Adalah Pintu Pertama Pengajuan Klaim Santunan Duka
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Selain verifikasi pendaftar baru, Ketua RT dapat memantau daftar pengajuan santunan warga cluster
                      pada tab <strong>Klaim Santunan Warga</strong> dan mengajukan klaim duka melalui menu{' '}
                      <strong>Realisasi Santunan</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Pintu 1 · Ketua RT</span>
                    <strong className="text-slate-900 block mt-0.5">Input Data & Surat Kematian</strong>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Pintu 2 · Bendahara</span>
                    <strong className="text-slate-900 block mt-0.5">Rincian Biaya & Bukti Transfer</strong>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Pintu 3 · Ketua Paguyuban</span>
                    <strong className="text-slate-900 block mt-0.5">Pengesahan & Pemotongan Kas</strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-500">
                  Saat ini tercatat <strong className="text-slate-800 tabular-nums">{claimsCount}</strong> riwayat
                  klaim di lingkup tampilan Anda.
                </span>

                {onSelectFilterTab && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleJumpToTab('claims')}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Lihat Tab Klaim Santunan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJumpToTab('pending')}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Mulai Verifikasi Warga</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer Controls */}
        <div className="px-5 py-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
            />
            <span>Jangan tampilkan otomatis lagi saat masuk menu Verifikasi RT</span>
          </label>

          <div className="flex items-center justify-end gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>
            )}

            {currentStep < GUIDE_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1))}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Selanjutnya</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onClose(dontShowAgain)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Selesai & Mulai Verifikasi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
