import React, { useState, useRef } from 'react';
import { SystemSettings, ClusterMaster, BenefitMaster, AppUser } from '../types';
import { 
  Settings, 
  Save, 
  CheckCircle2, 
  RotateCcw, 
  Trash2, 
  Database, 
  ShieldAlert, 
  Shield,
  Users,
  AlertTriangle, 
  Layers, 
  Building2, 
  HeartHandshake,
  Upload,
  Image as ImageIcon,
  FileImage,
  Eye,
  Check,
  Sparkles,
  Info,
  PenTool,
  X,
  Calendar,
  CalendarRange,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { DataManagementModal } from './DataManagementModal';
import { MasterClusterManager } from './MasterClusterManager';
import { MasterBenefitManager } from './MasterBenefitManager';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { SignatureData } from './DigitalSignaturePad';
import { WhatsAppApiSettingsManager } from './WhatsAppApiSettingsManager';
import { MembershipPeriodManager } from './MembershipPeriodManager';
import { MessageSquare } from 'lucide-react';

interface FundSettingsProps {
  settings: SystemSettings;
  clusters?: ClusterMaster[];
  benefits?: BenefitMaster[];
  memberCount?: number;
  paymentCount?: number;
  claimCount?: number;
  activeUser?: AppUser | null;
  onSaveSettings: (newSettings: SystemSettings) => void;
  onSaveCluster?: (cluster: ClusterMaster) => void;
  onDeleteCluster?: (clusterId: string) => void;
  onSaveBenefit?: (benefit: BenefitMaster) => void;
  onDeleteBenefit?: (benefitId: string) => void;
  onResetBenefits?: () => void;
  onResetData: () => void;
  onClearTransactions?: () => Promise<void> | void;
  onClearDemoData?: () => Promise<void> | void;
  onClearClaims?: () => Promise<void> | void;
  onNavigateToUsers?: () => void;
  onClose?: () => void;
}

export const FundSettings: React.FC<FundSettingsProps> = ({
  settings,
  clusters = [],
  benefits = [],
  memberCount = 0,
  paymentCount = 0,
  claimCount = 0,
  activeUser,
  onSaveSettings,
  onSaveCluster,
  onDeleteCluster,
  onSaveBenefit,
  onDeleteBenefit,
  onResetBenefits,
  onResetData,
  onClearTransactions,
  onClearDemoData,
  onClearClaims,
  onNavigateToUsers,
  onClose,
}) => {
  const isAdmin = activeUser ? activeUser.authority === 'Admin' : true;
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'period' | 'clusters' | 'benefits' | 'whatsapp' | 'database'>('general');
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSignature = (data: SignatureData) => {
    setFormData((prev) => ({
      ...prev,
      defaultAdminSignature: data.signatureUrl,
      defaultAdminSignerName: data.signerName,
      defaultAdminSignerTitle: data.signerTitle,
    }));
    setIsSignatureModalOpen(false);
  };

  const handleRemoveSignature = () => {
    setFormData((prev) => ({
      ...prev,
      defaultAdminSignature: undefined,
      defaultAdminSignerName: undefined,
      defaultAdminSignerTitle: undefined,
    }));
  };

  const handleLogoUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('File harus berupa format gambar (PNG, JPG, JPEG, WebP, atau SVG).');
      return;
    }
    setLogoError(null);
    setIsProcessingLogo(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (file.type === 'image/svg+xml') {
        setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
        setIsProcessingLogo(false);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const finalDataUrl = canvas.toDataURL('image/png', 0.92);
          setFormData((prev) => ({ ...prev, logoUrl: finalDataUrl }));
        } else {
          setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
        }
        setIsProcessingLogo(false);
      };
      img.onerror = () => {
        setLogoError('Gagal memproses file gambar. Silakan coba file gambar lain.');
        setIsProcessingLogo(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setLogoError('Gagal membaca file gambar.');
      setIsProcessingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleBankChange = (index: number, field: string, value: string) => {
    const updatedBanks = [...formData.bankAccounts];
    updatedBanks[index] = { ...updatedBanks[index], [field]: value };
    setFormData({ ...formData, bankAccounts: updatedBanks });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-32">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            <span>Pengaturan Sistem & Master Data</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi tarif kas, identitas organisasi, master data hak & manfaat santunan, wilayah cluster & RT dinamis, serta pengelolaan database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setIsDataModalOpen(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Hapus data riwayat transaksi di database Firebase"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus Data Transaksi Firebase</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDataModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Kelola Database</span>
              </button>
            </>
          )}

          {isAdmin && onNavigateToUsers && (
            <button
              type="button"
              onClick={onNavigateToUsers}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Kelola Akun, Otoritas RT, Bendahara, RW, DKM, & Anggota"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pengaturan User & Otoritas</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl border border-slate-800 transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto sm:ml-0"
              title="Tutup Pengaturan & Kembali ke Dashboard"
            >
              <X className="w-4 h-4 text-slate-300" />
              <span>Tutup</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl border border-slate-200 w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('general')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'general'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Settings className="w-4 h-4 text-emerald-600" />
          <span>Organisasi & Tarif Kas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('period')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'period'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Periode Keanggotaan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('benefits')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'benefits'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-emerald-600" />
          <span>Master Hak & Manfaat ({benefits.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('clusters')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'clusters'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-600" />
          <span>Master Cluster & RT ({clusters.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'whatsapp'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>WhatsApp API Gateway</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveSubTab('database')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'database'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-600" />
            <span>Basis Data</span>
          </button>
        )}
      </div>

      {/* TAB 1: General Settings */}
      {activeSubTab === 'general' && (
        <div className="space-y-6 animate-in fade-in">
          {savedSuccess && (
            <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Pengaturan berhasil diperbarui!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>Informasi Organisasi & Logo Paguyuban</span>
                {formData.logoUrl && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 normal-case flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Logo Terpasang
                  </span>
                )}
              </h3>

              {/* LOGO UPLOAD COMPONENT */}
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      <span>Logo Resmi Paguyuban / Komunitas</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Logo akan otomatis ditampilkan di header navigasi setiap halaman, kop surat kwitansi pembayaran, KTA digital, dan laporan kas.
                    </p>
                  </div>

                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Hapus logo kustom dan kembali ke ikon standar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Logo</span>
                    </button>
                  )}
                </div>

                {logoError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{logoError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Upload Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleLogoUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`md:col-span-7 border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                      isDraggingLogo
                        ? 'border-emerald-500 bg-emerald-50/80 scale-[1.01]'
                        : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50/80'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleLogoUpload(e.target.files[0]);
                        }
                      }}
                    />

                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
                      {isProcessingLogo ? (
                        <RotateCcw className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        {isProcessingLogo
                          ? 'Sedang Memproses Gambar...'
                          : 'Klik untuk Pilih File Logo atau Tarik ke Sini'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Mendukung format PNG transparan, JPG, WebP, atau SVG (Ukuran optimal 400x400 px)
                      </p>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer mt-1"
                    >
                      Pilih dari Komputer / HP
                    </button>
                  </div>

                  {/* Visual Preview Box */}
                  <div className="md:col-span-5 bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Pratinjau Tampilan Logo
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Dark Mode (Navbar Header) Preview */}
                      <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Di Header Atas</span>
                        <div className="h-14 flex items-center justify-center">
                          {formData.logoUrl ? (
                            <img
                              src={formData.logoUrl}
                              alt="Logo Header"
                              className="max-h-12 max-w-full object-contain rounded-lg shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md">
                              <HeartHandshake className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 truncate font-semibold">
                          {formData.communityName ? formData.communityName.slice(0, 14) + '...' : 'Paguyuban'}
                        </p>
                      </div>

                      {/* Light Mode (Kwitansi Kop Surat) Preview */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Di Kwitansi Cetak</span>
                        <div className="h-14 flex items-center justify-center">
                          {formData.logoUrl ? (
                            <img
                              src={formData.logoUrl}
                              alt="Logo Kwitansi"
                              className="max-h-12 max-w-full object-contain drop-shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                              <HeartHandshake className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-emerald-800 font-bold">KWITANSI RESMI</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Organisasi / Paguyuban
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.communityName}
                    onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Sekretariat / Wilayah RT/RW
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.communityAddress}
                    onChange={(e) => setFormData({ ...formData, communityAddress: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Bendahara / Pengurus Kas
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.treasurerName}
                    onChange={(e) => setFormData({ ...formData, treasurerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. HP / WhatsApp Bendahara
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.treasurerPhone}
                    onChange={(e) => setFormData({ ...formData, treasurerPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Default Digital Signature for Kwitansi Verification */}
                <div className="sm:col-span-2 pt-3 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        Tanda Tangan Digital Resmi Kwitansi (Default Bendahara / Admin)
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Tanda tangan ini akan otomatis dibubuhkan pada kwitansi dan verifikasi iuran warga agar resmi dan akuntabel saat dicetak.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 shrink-0 self-start sm:self-center"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{formData.defaultAdminSignature ? 'Ubah Tanda Tangan' : '+ Atur Tanda Tangan'}</span>
                    </button>
                  </div>

                  {formData.defaultAdminSignature ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-36 bg-white rounded-lg border border-slate-300 p-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={formData.defaultAdminSignature}
                            alt="Tanda Tangan Default"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {formData.defaultAdminSignerName || formData.treasurerName || 'Nama Penanda Tangan'}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {formData.defaultAdminSignerTitle || 'Bendahara Paguyuban'}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Aktif untuk Kwitansi Otomatis
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRemoveSignature}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-dashed border-indigo-200 text-center">
                      <p className="text-xs text-indigo-900 font-medium">
                        Belum ada tanda tangan digital default yang tersimpan.
                      </p>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        Klik tombol &quot;Atur Tanda Tangan&quot; untuk menggambar langsung di layar atau mengunggah file tanda tangan.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tariffs */}
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                Tarif Standard Iuran Paguyuban
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nominal Iuran Tahunan (Rp / 1 Tahun) <span className="text-emerald-600 font-black">*Utama</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.annualFeeAmount || 300000}
                    onChange={(e) => setFormData({ ...formData, annualFeeAmount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-sm font-mono font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Dibayarkan 1 tahun sekali per kepala keluarga.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Iuran Pendaftaran Baru (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.registrationFeeAmount}
                    onChange={(e) => setFormData({ ...formData, registrationFeeAmount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Biaya administrasi awal saat mendaftar.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Setara Bulanan (Rp / Bulan)
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyFeeAmount || Math.round((formData.annualFeeAmount || 300000) / 12)}
                    onChange={(e) => setFormData({ ...formData, monthlyFeeAmount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Estimasi proporsi per bulan.</p>
                </div>
              </div>

              {/* Membership Period Policy Indicator & Quick Access */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs mt-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block">
                      Kebijakan Periode Keanggotaan
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5">
                      {formData.membershipPeriod?.mode === 'fixed_period'
                        ? formData.membershipPeriod?.fixedType === 'custom_range'
                          ? `Rentang Kustom Pengurus: ${formData.membershipPeriod?.customStartDate} s/d ${formData.membershipPeriod?.customEndDate}`
                          : `Tahun Kalender Serempak (1 Jan - 31 Des ${formData.membershipPeriod?.activePeriodYear || '2026'})`
                        : `Tanggal Pembayaran (Bergulir ${formData.membershipPeriod?.durationMonths || 12} Bulan)`}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {formData.membershipPeriod?.mode === 'fixed_period'
                        ? 'Masa aktif keanggotaan terikat seragam pada periode buku/kepengurusan paguyuban.'
                        : 'Masa aktif dihitung maju selama 1 tahun (365 hari) sejak tanggal pembayaran warga diverifikasi.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('period')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer active:scale-95"
                >
                  <span>Atur Kebijakan Periode</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bank Accounts */}
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                Daftar Rekening Bank Tujuan Transfer
              </h3>

              <div className="space-y-3">
                {formData.bankAccounts.map((bank, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      placeholder="Nama Bank"
                      value={bank.bankName}
                      onChange={(e) => handleBankChange(index, 'bankName', e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Nomor Rekening"
                      value={bank.accountNumber}
                      onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Atas Nama"
                      value={bank.accountHolder}
                      onChange={(e) => handleBankChange(index, 'accountHolder', e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                >
                  <X className="w-4 h-4 text-slate-500" />
                  <span>Tutup & Kembali</span>
                </button>
              ) : <div />}

              <button
                type="submit"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-sm rounded-xl transition-colors shadow-lg shadow-emerald-900/20 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: Dynamic Membership Period Policy Manager */}
      {activeSubTab === 'period' && (
        <div className="animate-in fade-in">
          <MembershipPeriodManager
            settings={formData}
            onSaveSettings={(newSettings) => {
              setFormData(newSettings);
              onSaveSettings(newSettings);
              setSavedSuccess(true);
              setTimeout(() => setSavedSuccess(false), 4000);
            }}
          />
        </div>
      )}

      {/* TAB 2: Dynamic Master Hak & Manfaat Manager */}
      {activeSubTab === 'benefits' && (
        <div className="animate-in fade-in">
          {onSaveBenefit && onDeleteBenefit ? (
            <MasterBenefitManager
              benefits={benefits}
              onSaveBenefit={onSaveBenefit}
              onDeleteBenefit={onDeleteBenefit}
              onResetBenefits={onResetBenefits}
            />
          ) : (
            <p className="text-xs text-slate-500">Modul Master Hak & Manfaat belum terhubung.</p>
          )}
        </div>
      )}

      {/* TAB 3: Dynamic Master Cluster & RT Manager */}
      {activeSubTab === 'clusters' && (
        <div className="animate-in fade-in">
          {onSaveCluster && onDeleteCluster ? (
            <MasterClusterManager
              clusters={clusters}
              onSaveCluster={onSaveCluster}
              onDeleteCluster={onDeleteCluster}
            />
          ) : (
            <p className="text-xs text-slate-500">Modul Master Cluster belum terhubung.</p>
          )}
        </div>
      )}

      {/* TAB 3: Database & Reset Management */}
      {isAdmin && activeSubTab === 'database' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                  Manajemen Basis Data & Data Transaksi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pengelolaan pengosongan riwayat data transaksi iuran dan klaim santunan di database Firebase secara aman.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              {memberCount} Anggota • {paymentCount} Transaksi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-2xl flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs sm:text-sm">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Hapus Data Transaksi di Database Firebase</span>
                </div>
                <p className="text-xs text-rose-900/70 leading-relaxed">
                  Kosongkan seluruh riwayat pembayaran iuran kas dan pencatatan klaim santunan dari Cloud Firestore. Data warga (anggota), kluster RT, akun pengguna, dan pengaturan paguyuban tetap aman dipertahankan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDataModalOpen(true)}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Buka Menu Hapus Transaksi</span>
              </button>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs sm:text-sm">
                  <HeartHandshake className="w-4 h-4 text-amber-600" />
                  <span>Kosongkan Khusus Data Realisasi Santunan</span>
                </div>
                <p className="text-xs text-amber-900/70 leading-relaxed">
                  Hanya menghapus riwayat pengajuan klaim dan realisasi santunan duka dari Cloud Firestore tanpa memengaruhi catatan pembayaran iuran atau data warga.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDataModalOpen(true)}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Kelola Data Santunan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WhatsApp Gateway API & Automation */}
      {activeSubTab === 'whatsapp' && (
        <div className="animate-in fade-in">
          <WhatsAppApiSettingsManager
            settings={settings}
            onSaveSettings={onSaveSettings}
          />
        </div>
      )}

      {/* Modal Dialog */}
      <DataManagementModal
        isOpen={isAdmin && isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        memberCount={memberCount}
        paymentCount={paymentCount}
        claimCount={claimCount}
        onClearTransactions={onClearTransactions || onClearDemoData}
        onClearDemoData={onClearTransactions || onClearDemoData}
        onRestoreDemoData={onResetData}
        onClearClaims={onClearClaims}
      />

      {/* Default Digital Signature Setup Modal */}
      <DigitalSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
        initialSignature={formData.defaultAdminSignature}
        defaultSignerName={formData.defaultAdminSignerName || formData.treasurerName}
        defaultSignerTitle={formData.defaultAdminSignerTitle || 'Bendahara Paguyuban'}
        documentTitle="Pengaturan Tanda Tangan Digital Resmi Paguyuban"
      />
    </div>
  );
};
