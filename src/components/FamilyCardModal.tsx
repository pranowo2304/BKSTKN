import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  ShieldCheck,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { Member } from '../types';

interface FamilyCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl?: string;
  member?: Member;
  memberName?: string;
  kkNumber?: string;
  cluster?: string;
  fileName?: string;
  qualityScore?: number;
  qualityStatus?: string;
}

export const FamilyCardModal: React.FC<FamilyCardModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  member,
  memberName,
  kkNumber,
  cluster,
  fileName,
  qualityScore,
  qualityStatus,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [imageError, setImageError] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const resolvedPhotoUrl = useMemo(() => {
    const raw = (photoUrl || member?.familyCardPhotoUrl || '').trim();
    if (!raw) return '';
    if (raw.startsWith('<svg')) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
    }
    return raw;
  }, [photoUrl, member?.familyCardPhotoUrl]);

  const resolvedMemberName = memberName || member?.name || 'Warga';
  const resolvedKkNumber = kkNumber ?? member?.familyCardNumber;
  const resolvedCluster = cluster ?? member?.cluster;
  const resolvedFileName = fileName ?? member?.familyCardFileName;
  const resolvedQualityScore = qualityScore ?? member?.familyCardQualityScore;
  const resolvedQualityStatus = qualityStatus ?? member?.familyCardQualityStatus;

  const isPdf = useMemo(() => {
    if (!resolvedPhotoUrl) return false;
    return (
      resolvedPhotoUrl.startsWith('data:application/pdf') ||
      resolvedPhotoUrl.toLowerCase().includes('.pdf') ||
      Boolean(resolvedFileName?.toLowerCase().endsWith('.pdf'))
    );
  }, [resolvedPhotoUrl, resolvedFileName]);

  // Reset zoom, rotation, error state whenever modal opens or source changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setImageError(false);
    }
  }, [isOpen, resolvedPhotoUrl]);

  // Convert large data:application/pdf;base64,... URLs to Blob URLs for reliable iframe/tab rendering
  useEffect(() => {
    if (!isOpen || !isPdf || !resolvedPhotoUrl.startsWith('data:application/pdf')) {
      setPdfBlobUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    try {
      const commaIdx = resolvedPhotoUrl.indexOf(',');
      if (commaIdx !== -1) {
        const base64Data = resolvedPhotoUrl.slice(commaIdx + 1);
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      }
    } catch (err) {
      console.warn('PDF blob conversion failed, falling back to data URL:', err);
      setPdfBlobUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, isPdf, resolvedPhotoUrl]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activePdfSrc = pdfBlobUrl || resolvedPhotoUrl;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    if (!resolvedPhotoUrl) return;
    const link = document.createElement('a');
    link.href = isPdf ? activePdfSrc : resolvedPhotoUrl;
    link.download =
      resolvedFileName ||
      `Kartu_Keluarga_${resolvedMemberName.replace(/\s+/g, '_')}.${isPdf ? 'pdf' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[150] bg-slate-950/88 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Lampiran Kartu Keluarga ${resolvedMemberName}`}
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-5xl bg-slate-900/95 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-white shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                Lampiran Foto Kartu Keluarga (KK)
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Dokumen Resmi</span>
              </span>
              {resolvedQualityScore !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    resolvedQualityStatus === 'warning_blur' || resolvedQualityScore < 50
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                  title={`Skor validasi: ${resolvedQualityScore}%`}
                >
                  Validasi: {resolvedQualityScore}% ({resolvedQualityStatus === 'warning_blur' ? 'Buram' : 'Jelas'})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {resolvedMemberName} {resolvedCluster ? `• ${resolvedCluster}` : ''}{' '}
              {resolvedKkNumber ? `• No. KK: ${resolvedKkNumber}` : ''}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isPdf && resolvedPhotoUrl && !imageError && (
            <>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Perkecil (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                title="Reset Ukuran (100%)"
              >
                {Math.round(scale * 100)}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Perbesar (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Putar Foto (90°)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}

          {resolvedPhotoUrl && (
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors inline-flex items-center gap-1.5 text-xs font-bold px-3 ml-1 cursor-pointer"
              title="Unduh Berkas Kartu Keluarga"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Unduh</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-colors ml-1 cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image / PDF Viewer Area */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        className="w-full flex-1 flex items-center justify-center overflow-auto p-2 sm:p-4 select-none"
      >
        {!resolvedPhotoUrl ? (
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center text-slate-200 space-y-3 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="font-bold text-base text-white">Lampiran Kartu Keluarga Belum Tersedia</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Berkas foto atau dokumen PDF Kartu Keluarga untuk anggota ini belum diunggah. Silakan unggah ulang melalui menu Edit Biodata & Keluarga.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        ) : isPdf ? (
          <div className="w-full max-w-4xl h-[75vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col">
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 text-xs text-slate-700">
              <span className="font-semibold truncate">
                {resolvedFileName || 'Dokumen_Kartu_Keluarga.pdf'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={activePdfSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Tab Baru</span>
                </a>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Unduh PDF</span>
                </button>
              </div>
            </div>
            <iframe
              src={activePdfSrc}
              title={`Dokumen Kartu Keluarga ${resolvedMemberName}`}
              className="w-full flex-1 border-none bg-slate-50"
            />
          </div>
        ) : imageError ? (
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 text-center text-slate-200 space-y-3 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="font-bold text-base text-white">Gagal Memuat Gambar Kartu Keluarga</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Berkas gambar Kartu Keluarga tidak dapat ditampilkan secara langsung atau formatnya terpotong. Anda dapat mengunduh berkasnya atau mengunggah ulang foto KK.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Coba Unduh Berkas</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: 'transform 0.15s ease-out',
            }}
            className="max-w-full max-h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            <img
              src={resolvedPhotoUrl}
              alt={`Kartu Keluarga ${resolvedMemberName}`}
              onError={() => setImageError(true)}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border-2 border-slate-700 bg-white"
            />
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="w-full max-w-xl text-center py-2">
        <p className="text-[11px] text-slate-400 bg-slate-900/80 px-4 py-1.5 rounded-full inline-block border border-slate-800">
          Gunakan tombol zoom atau putar untuk memeriksa teks NIK dan susunan anggota keluarga dengan teliti.
        </p>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
