import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Camera,
  ShieldCheck,
  CreditCard,
  FolderOpen,
  Sparkles,
  FileCheck,
  Scan,
  Activity,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  processImageFile,
  formatFileSize,
  generateDemoFamilyCardDataUrl,
  validateFamilyCardFile,
  MAX_KK_FILE_SIZE_BYTES
} from '../lib/imageUtils';
import {
  analyzeImageQuality,
  DocumentQualityReport,
} from '../lib/documentQualityValidator';
import { FamilyCardModal } from './FamilyCardModal';
import { DocumentCameraScannerModal } from './DocumentCameraScannerModal';

export interface FamilyCardUploadResult {
  photoUrl: string;
  fileName: string;
  kkNumber?: string;
  file?: File | null;
  qualityReport?: DocumentQualityReport;
}

interface FamilyCardUploaderProps {
  photoUrl?: string;
  fileName?: string;
  kkNumber?: string;
  memberName?: string;
  cluster?: string;
  required?: boolean;
  disabled?: boolean;
  file?: File | null;
  initialQualityReport?: DocumentQualityReport | null;
  onFileSelect?: (file: File | null) => void;
  onChange: (data: FamilyCardUploadResult) => void;
  onClear?: () => void;
  onKkNumberChange?: (kkNumber: string) => void;
  duplicateKkError?: string | null;
}

export const FamilyCardUploader: React.FC<FamilyCardUploaderProps> = ({
  photoUrl,
  fileName,
  kkNumber = '',
  memberName = 'Calon Anggota',
  cluster = '',
  required = true,
  disabled = false,
  file: fileProp,
  initialQualityReport,
  onFileSelect,
  onChange,
  onClear,
  onKkNumberChange,
  duplicateKkError,
}) => {
  // Two separate inputs: One standard file picker (for gallery/files) and one with capture="environment" (direct camera)
  const filePickerInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // File object state handled in component before and during upload
  const [selectedFile, setSelectedFile] = useState<File | null>(fileProp || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [qualityReport, setQualityReport] = useState<DocumentQualityReport | null>(initialQualityReport || null);
  const [isValidatingQuality, setIsValidatingQuality] = useState<boolean>(false);

  // Synchronize state when parent fileProp changes
  useEffect(() => {
    if (fileProp !== undefined) {
      setSelectedFile(fileProp);
    }
  }, [fileProp]);

  // Synchronize quality report if initialQualityReport changes
  useEffect(() => {
    if (initialQualityReport !== undefined) {
      setQualityReport(initialQualityReport);
    }
  }, [initialQualityReport]);

  const handleFile = async (file: File) => {
    if (!file) return;

    // 1. Store the File object in state immediately before processing/uploading
    setSelectedFile(file);
    if (onFileSelect) {
      onFileSelect(file);
    }

    // 2. Validate file type and size
    const validation = validateFamilyCardFile(file, MAX_KK_FILE_SIZE_BYTES);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Berkas Kartu Keluarga tidak valid.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const processed = await processImageFile(file, 1280, 0.76);
      setFileSizeBytes(processed.fileSizeBytes);

      // Run real-time quality validation if not a PDF
      let report: DocumentQualityReport | undefined;
      const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isFilePdf) {
        setIsValidatingQuality(true);
        try {
          report = await analyzeImageQuality(processed.dataUrl);
          setQualityReport(report);
        } catch (e) {
          console.warn('Quality check failed:', e);
        } finally {
          setIsValidatingQuality(false);
        }
      } else {
        setQualityReport(null);
      }

      onChange({
        photoUrl: processed.dataUrl,
        fileName: processed.fileName,
        kkNumber,
        file,
        qualityReport: report,
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Gagal memproses berkas Kartu Keluarga. Silakan pilih berkas lain dari galeri perangkat Anda.';
      setErrorMessage(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraCaptureComplete = ({
    photoUrl: capturedUrl,
    file: capturedFile,
    fileName: capturedFileName,
    qualityReport: report,
  }: {
    photoUrl: string;
    file: File;
    fileName: string;
    qualityReport: DocumentQualityReport;
  }) => {
    setSelectedFile(capturedFile);
    if (onFileSelect) {
      onFileSelect(capturedFile);
    }
    setFileSizeBytes(capturedFile.size);
    setQualityReport(report);
    setErrorMessage(null);

    onChange({
      photoUrl: capturedUrl,
      fileName: capturedFileName,
      kkNumber,
      file: capturedFile,
      qualityReport: report,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const chosen = files[0];
    if (chosen) {
      handleFile(chosen);
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Resetting value on click (not during change) allows re-selecting the exact same file without detaching the File object
    (e.currentTarget as HTMLInputElement).value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (onFileSelect) {
      onFileSelect(null);
    }
    setFileSizeBytes(null);
    setQualityReport(null);
    setErrorMessage(null);
    if (onClear) {
      onClear();
    } else {
      onChange({
        photoUrl: '',
        fileName: '',
        kkNumber,
        file: null,
      });
    }
  };

  const handleUseDemoKK = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMessage(null);
    setSelectedFile(null);
    if (onFileSelect) {
      onFileSelect(null);
    }
    const demoUrl = generateDemoFamilyCardDataUrl(
      memberName || 'Kepala Keluarga',
      kkNumber || '3171012304950001',
      cluster || 'RT 01 / RW 03'
    );
    const generatedName = `KK_Digital_${(memberName || 'Warga').replace(/\s+/g, '_')}.svg`;
    setFileSizeBytes(3500);
    const demoReport: DocumentQualityReport = {
      status: 'good',
      overallScore: 95,
      isAcceptable: true,
      metrics: {
        sharpnessScore: 94,
        laplacianVariance: 220,
        brightnessScore: 140,
        contrastScore: 80,
        readabilityScore: 92,
        textStrokeCount: 880,
      },
      headline: 'Contoh Dokumen Digital',
      feedbackMessage: 'Format vektor digital tajam dan teks terbaca sempurna.',
      recommendations: [],
    };
    setQualityReport(demoReport);
    onChange({
      photoUrl: demoUrl,
      fileName: generatedName,
      kkNumber: kkNumber || '3171012304950001',
      file: null,
      qualityReport: demoReport,
    });
  };

  const isPdf = photoUrl?.startsWith('data:application/pdf') || fileName?.toLowerCase().endsWith('.pdf');

  // Trigger analysis for preloaded non-pdf photos if not already analyzed
  useEffect(() => {
    if (photoUrl && !qualityReport && !isPdf && !photoUrl.startsWith('data:image/svg')) {
      analyzeImageQuality(photoUrl)
        .then((rep) => setQualityReport(rep))
        .catch(() => {});
    }
  }, [photoUrl, isPdf, qualityReport]);

  return (
    <div className="space-y-3">
      {/* Label and Guidance Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>Lampiran Berkas / Foto Kartu Keluarga (KK)</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        <span className="text-[11px] font-medium text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-md">
          Format: JPEG, PNG, PDF • Dokumen Maks. 5MB (Foto HP Maks. 20MB)
        </span>
      </div>

      {/* Optional No. KK Input */}
      {onKkNumberChange !== undefined && (
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Nomor Kartu Keluarga (16 Digit) <span className="text-slate-400 font-normal">(Opsional / Tertera di bagian atas KK)</span>
          </label>
          <div className="relative">
            <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={16}
              placeholder="Contoh: 3171012304950001"
              value={kkNumber}
              disabled={disabled}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                onKkNumberChange(clean);
                if (photoUrl) {
                  onChange({
                    photoUrl,
                    fileName: fileName || 'kartu_keluarga.jpg',
                    kkNumber: clean,
                  });
                }
              }}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-mono font-bold transition-all outline-none ${
                duplicateKkError
                  ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-500'
                  : kkNumber && kkNumber.length === 16
                  ? 'border-emerald-400 bg-emerald-50/50 text-slate-800 focus:ring-2 focus:ring-emerald-500'
                  : 'bg-slate-50 border-slate-300 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white'
              }`}
            />
          </div>
          {duplicateKkError && (
            <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 font-bold flex items-start gap-1.5 animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span>{duplicateKkError}</span>
            </div>
          )}
          {!duplicateKkError && kkNumber && kkNumber.length === 16 && (
            <p className="mt-1 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Format 16 digit lengkap</span>
            </p>
          )}
        </div>
      )}

      {/* 1. Standard File Picker: JPEG, PNG, WebP, PDF & Gallery Photos */}
      <input
        ref={filePickerInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif,image/*,application/pdf"
        disabled={disabled || isProcessing}
        onClick={handleInputClick}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* 2. Direct Camera Snapshot: Mobile / Tablet Camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || isProcessing}
        onClick={handleInputClick}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Error Message with Quick Action */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="p-1 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <span className="font-bold text-rose-900 block">Validasi Berkas Kartu Keluarga</span>
              <p className="leading-relaxed text-rose-800">{errorMessage}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-rose-200/70">
            <span className="text-[11px] text-rose-700 font-medium">Solusi cepat:</span>
            <button
              type="button"
              onClick={() => filePickerInputRef.current?.click()}
              className="px-2.5 py-1 bg-white hover:bg-rose-100/50 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <FolderOpen className="w-3 h-3 text-rose-600" />
              <span>Pilih Berkas Lain</span>
            </button>
            <button
              type="button"
              onClick={handleUseDemoKK}
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Gunakan Contoh KK Digital</span>
            </button>
          </div>
        </div>
      )}

      {/* Uploader Box / Preview Box */}
      {photoUrl ? (
        /* Preview State */
        <div className="bg-emerald-50/60 border-2 border-emerald-300/80 rounded-2xl p-4 transition-all shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Thumbnail and Info */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                onClick={() => setIsViewerOpen(true)}
                className="relative group w-20 h-16 sm:w-24 sm:h-18 rounded-xl overflow-hidden border border-emerald-400 bg-white shadow-sm shrink-0 cursor-pointer flex items-center justify-center"
                title="Klik untuk memperbesar / periksa berkas KK"
              >
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center p-2 text-rose-600">
                    <FileCheck className="w-7 h-7 text-emerald-700" />
                    <span className="text-[9px] font-bold text-slate-600 mt-0.5">DOKUMEN PDF</span>
                  </div>
                ) : (
                  <>
                    <img
                      src={photoUrl}
                      alt="Kartu Keluarga Preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye className="w-5 h-5" />
                    </div>
                  </>
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold text-slate-900 truncate">
                    Berkas Kartu Keluarga Terlampir
                  </p>
                </div>
                <p className="text-[11px] font-mono text-slate-600 truncate max-w-xs sm:max-w-md">
                  {fileName || (isPdf ? 'Kartu_Keluarga.pdf' : 'Kartu_Keluarga.jpg')}
                  {fileSizeBytes ? ` • ${formatFileSize(fileSizeBytes)}` : ''}
                </p>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Siap Diverifikasi Ketua RT / Pengurus</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60">
              <button
                type="button"
                onClick={() => setIsViewerOpen(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Periksa tampilan berkas"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Lihat Berkas</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                disabled={disabled}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Pindai ulang menggunakan kamera dokumen real-time"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-200" />
                <span>Pindai Real-time</span>
              </button>

              <button
                type="button"
                onClick={() => filePickerInputRef.current?.click()}
                disabled={disabled}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Pilih file lain dari HP atau Laptop"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Pilih File</span>
              </button>

              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="Hapus lampiran"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* REAL-TIME QUALITY VALIDATION STATUS CARD */}
          {isValidatingQuality && (
            <div className="mt-3 p-3 bg-white/80 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Memvalidasi ketajaman gambar, pencahayaan, dan keterbacaan teks Kartu Keluarga...</span>
            </div>
          )}

          {!isValidatingQuality && qualityReport && (
            <div className="mt-3">
              {qualityReport.isAcceptable ? (
                /* Acceptable Quality Banner */
                <div className="p-3 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-950">
                          Kualitas Dokumen Lulus: {qualityReport.headline}
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400">
                          Skor: {qualityReport.overallScore}%
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                        {qualityReport.feedbackMessage}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-emerald-700 mt-1">
                        <span>Ketajaman: {qualityReport.metrics.sharpnessScore}%</span>
                        <span>•</span>
                        <span>Keterbacaan Huruf/Angka: {qualityReport.metrics.readabilityScore}%</span>
                        <span>•</span>
                        <span>
                          Pencahayaan:{' '}
                          {qualityReport.metrics.brightnessScore < 65
                            ? 'Gelap'
                            : qualityReport.metrics.brightnessScore > 215
                            ? 'Silau'
                            : 'Optimal'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Warning / Suboptimal Quality Banner (Blur / Unreadable / Dark) */
                <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-amber-500 text-white shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-950">
                            Peringatan Kualitas Dokumen: {qualityReport.headline}
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-400">
                            Skor: {qualityReport.overallScore}%
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900 font-medium leading-relaxed mt-1">
                          {qualityReport.feedbackMessage}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCameraScannerOpen(true)}
                      className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>Foto Ulang via Kamera Real-time</span>
                    </button>
                  </div>

                  {qualityReport.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-amber-200 text-[11px] text-amber-900">
                      <span className="font-bold">Saran perbaikan:</span>
                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[10px] text-amber-800">
                        {qualityReport.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty State with Real-time Camera, File Picker, and Quick Camera Options */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
              : 'border-slate-300 bg-slate-50/80 hover:bg-emerald-50/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              {isProcessing ? (
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              ) : (
                <Upload className="w-6 h-6 text-emerald-600" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">
                {isProcessing
                  ? `Mengoptimalkan berkas: ${selectedFile?.name || fileName || 'Kartu Keluarga'}...`
                  : 'Unggah Lampiran Kartu Keluarga (KK)'}
              </p>
              {isProcessing && selectedFile ? (
                <p className="text-xs text-emerald-700 font-medium animate-pulse">
                  Ukuran berkas: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Mengompresi agar siap diunggah...
                </p>
              ) : (
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Pindai menggunakan kamera real-time dengan panduan ketajaman, atau pilih berkas dari perangkat Anda:
                </p>
              )}
            </div>

            {/* THREE ACTION OPTIONS: 1. REAL-TIME SCANNER (HERO), 2. PILIH FILE, 3. FOTO KAMERA CEPAT */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-1 w-full max-w-lg">
              {/* Button 1: HERO - Kamera Dokumen Real-time with Live Blur & Readability Detection */}
              <button
                type="button"
                onClick={() => !disabled && !isProcessing && setIsCameraScannerOpen(true)}
                disabled={disabled || isProcessing}
                className="flex-1 min-w-[210px] px-4 py-3 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer border border-emerald-500/40 group"
              >
                <div className="p-1.5 rounded-lg bg-emerald-800 text-white group-hover:scale-110 transition-transform">
                  <Scan className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span>Kamera Real-time</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-900 text-emerald-200 font-extrabold border border-emerald-600/60">
                      AUTO VALIDASI
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-200/90 font-normal">
                    Deteksi otomatis blur & teks terbaca
                  </p>
                </div>
              </button>

              {/* Button 2: Pilih Berkas dari Galeri / File Manager */}
              <button
                type="button"
                onClick={() => !disabled && !isProcessing && filePickerInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className="px-4 py-3 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-800 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Pilih berkas gambar atau PDF dari penyimpanan"
              >
                <FolderOpen className="w-4 h-4 text-emerald-700" />
                <span>Pilih Berkas</span>
              </button>

              {/* Button 3: Ambil Foto Standar */}
              <button
                type="button"
                onClick={() => !disabled && !isProcessing && cameraInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Ambil foto cepat dari kamera bawaan HP"
              >
                <Camera className="w-4 h-4 text-slate-600" />
                <span className="sm:hidden lg:inline">Foto Cepat</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Format: JPEG, PNG, PDF (Maks. 5MB • Foto HP Maks. 20MB)
              </span>
              <span>•</span>
              <button
                type="button"
                onClick={handleUseDemoKK}
                className="text-emerald-700 hover:text-emerald-800 font-semibold underline inline-flex items-center gap-1 cursor-pointer"
                title="Gunakan format contoh jika Anda belum menyiapkan berkas fisik"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Gunakan Contoh KK Digital</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Modal for inspecting the KK */}
      {photoUrl && (
        <FamilyCardModal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          photoUrl={photoUrl}
          memberName={memberName}
          kkNumber={kkNumber}
          cluster={cluster}
          fileName={fileName}
          qualityScore={qualityReport?.overallScore}
          qualityStatus={qualityReport?.status}
        />
      )}

      {/* Real-time Document Camera Scanner Modal */}
      <DocumentCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onCaptureComplete={handleCameraCaptureComplete}
        documentTitle="Kartu Keluarga (KK)"
        memberName={memberName}
      />
    </div>
  );
};
