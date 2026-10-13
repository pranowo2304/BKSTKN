import React, { useState } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  ShieldCheck,
  Maximize2
} from 'lucide-react';

interface FamilyCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
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
  memberName = 'Warga',
  kkNumber,
  cluster,
  fileName,
  qualityScore,
  qualityStatus,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  if (!isOpen || !photoUrl) return null;

  const isPdf = photoUrl.startsWith('data:application/pdf') || fileName?.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = fileName || `Kartu_Keluarga_${memberName.replace(/\s+/g, '_')}.${isPdf ? 'pdf' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-white shadow-xl">
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
              {qualityScore !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    qualityStatus === 'warning_blur' || qualityScore < 50
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                  title={`Skor validasi: ${qualityScore}%`}
                >
                  Validasi: {qualityScore}% ({qualityStatus === 'warning_blur' ? 'Buram' : 'Jelas'})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {memberName} {cluster ? `• ${cluster}` : ''} {kkNumber ? `• No. KK: ${kkNumber}` : ''}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
            title="Perkecil (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-xl transition-colors"
            title="Reset Ukuran (100%)"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
            title="Perbesar (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
            title="Putar Foto (90°)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors inline-flex items-center gap-1.5 text-xs font-bold px-3 ml-1"
            title="Unduh Berkas Kartu Keluarga"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Unduh</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition-colors ml-1"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image / PDF Viewer Area */}
      <div className="w-full flex-1 flex items-center justify-center overflow-auto p-4 select-none">
        {isPdf ? (
          <div className="w-full max-w-4xl h-[75vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col">
            <iframe
              src={photoUrl}
              title={`Dokumen Kartu Keluarga ${memberName}`}
              className="w-full h-full border-none"
            />
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
              src={photoUrl}
              alt={`Kartu Keluarga ${memberName}`}
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
};
