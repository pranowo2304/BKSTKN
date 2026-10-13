import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  RotateCcw,
  Eraser,
  Upload,
  Check,
  X,
  ShieldCheck,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2,
  Undo2,
  Redo2,
  Image as ImageIcon
} from 'lucide-react';

export interface SignatureData {
  signatureUrl: string; // Base64 Data URL (PNG)
  signerName: string;
  signerTitle: string;
  signedAt: string;
  saveAsDefault?: boolean;
}

interface DigitalSignaturePadProps {
  initialSignature?: string;
  defaultSignerName?: string;
  defaultSignerTitle?: string;
  savedDefaultSignature?: string;
  onSave: (data: SignatureData) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

const PEN_COLORS = [
  { id: 'blue', name: 'Biru Resmi', hex: '#1e3a8a', bgClass: 'bg-blue-900 border-blue-600' },
  { id: 'black', name: 'Hitam Formal', hex: '#0f172a', bgClass: 'bg-slate-900 border-slate-700' },
  { id: 'emerald', name: 'Hijau Paguyuban', hex: '#047857', bgClass: 'bg-emerald-800 border-emerald-600' },
];

const STROKE_WIDTHS = [
  { label: 'Halus', value: 1.8 },
  { label: 'Sedang', value: 2.8 },
  { label: 'Tebal', value: 4.2 },
];

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  initialSignature,
  defaultSignerName = 'Ibu Hj. Siti Aminah',
  defaultSignerTitle = 'Bendahara Paguyuban',
  savedDefaultSignature,
  onSave,
  onCancel,
  title = 'Bubuhkan Tanda Tangan Digital Verifikasi',
  subtitle = 'Tanda tangan digital ini akan dicantumkan secara resmi pada Kwitansi Pembayaran Kas Warga.',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [selectedColor, setSelectedColor] = useState<string>('#1e3a8a');
  const [strokeWidth, setStrokeWidth] = useState<number>(2.8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  // Metadata form
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerTitle, setSignerTitle] = useState(defaultSignerTitle);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Undo/Redo history of canvas states
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Setup Canvas with Retina/High-DPI resolution
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    const width = rect.width || 480;
    const height = 200;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeWidth;

      // Save initial blank state
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current = [initialData];
      historyIndexRef.current = 0;
    }
  }, [selectedColor, strokeWidth]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // Load existing signature if provided
  useEffect(() => {
    if (initialSignature && canvasRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, 200);
        ctx.drawImage(img, 0, 0, rect.width, 200);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  // Handle pointer drawing coordinates
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;
    setIsDrawing(true);
    setHasDrawn(true);
    setErrorMsg(null);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDrawing(false);
    lastPointRef.current = null;

    // Save snapshot to history for undo/redo
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(snapshot);
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, 200);
    setHasDrawn(false);
    setUploadedPreview(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyIndexRef.current -= 1;
    const prevState = historyRef.current[historyIndexRef.current];
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
      if (historyIndexRef.current === 0) {
        setHasDrawn(false);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyIndexRef.current += 1;
    const nextState = historyRef.current[historyIndexRef.current];
    if (nextState) {
      ctx.putImageData(nextState, 0, 0);
      setHasDrawn(true);
    }
  };

  // Upload image file of signature
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Harap pilih file gambar (PNG, JPG, atau WEBP).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg('Ukuran file tanda tangan maksimal 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedPreview(dataUrl);
      setHasDrawn(true);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Use Saved Default Signature
  const handleUseSavedDefault = () => {
    if (!savedDefaultSignature) return;
    setUploadedPreview(savedDefaultSignature);
    setHasDrawn(true);
    setErrorMsg(null);
  };

  // Submit Signature
  const handleConfirm = () => {
    if (!signerName.trim()) {
      setErrorMsg('Nama penandatangan wajib diisi.');
      return;
    }

    let finalSignatureUrl = '';

    if (mode === 'upload' && uploadedPreview) {
      finalSignatureUrl = uploadedPreview;
    } else if (canvasRef.current && hasDrawn) {
      finalSignatureUrl = canvasRef.current.toDataURL('image/png');
    } else if (uploadedPreview) {
      finalSignatureUrl = uploadedPreview;
    } else {
      setErrorMsg('Silakan goreskan tanda tangan atau upload berkas tanda tangan terlebih dahulu.');
      return;
    }

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} • ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

    onSave({
      signatureUrl: finalSignatureUrl,
      signerName: signerName.trim(),
      signerTitle: signerTitle.trim() || 'Bendahara Paguyuban',
      signedAt: formattedDate,
      saveAsDefault,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-xl w-full mx-auto animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight">{title}</h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Tutup"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Mode Switcher */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setMode('draw')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                mode === 'draw'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 text-indigo-600" />
              <span>Gores Tangan (Canvas)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                mode === 'upload'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Upload Gambar / Scan</span>
            </button>
          </div>

          {savedDefaultSignature && (
            <button
              type="button"
              onClick={handleUseSavedDefault}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
              title="Gunakan tanda tangan tersimpan di sistem"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Gunakan Default Tersimpan</span>
            </button>
          )}
        </div>

        {/* DRAWING CANVAS MODE */}
        {mode === 'draw' && (
          <div className="space-y-2.5">
            {/* Controls Bar: Color & Thickness */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              {/* Pen Colors */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px]">Warna Tinta:</span>
                <div className="flex items-center gap-1.5">
                  {PEN_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setSelectedColor(col.hex)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        selectedColor === col.hex
                          ? 'scale-110 ring-2 ring-indigo-500/50 shadow-xs'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Widths */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px]">Tebal Garis:</span>
                <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-[11px] font-bold">
                  {STROKE_WIDTHS.map((sw) => (
                    <button
                      key={sw.label}
                      type="button"
                      onClick={() => setStrokeWidth(sw.value)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        strokeWidth === sw.value
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {sw.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Undo & Clear */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Redo"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-[11px] font-bold inline-flex items-center gap-1"
                  title="Hapus goresan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>

            {/* Canvas Box */}
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-white transition-colors overflow-hidden touch-none select-none">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="w-full h-[200px] cursor-crosshair block"
                style={{ touchAction: 'none' }}
              />

              {/* Signature Line Guideline */}
              <div className="absolute left-6 right-6 bottom-7 border-b border-slate-200 pointer-events-none flex justify-between text-[10px] text-slate-400 font-mono select-none">
                <span>✕ Goreskan Tanda Tangan Anda di Area Ini</span>
                <span>Area Sah Resmi</span>
              </div>

              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 gap-1.5">
                  <PenTool className="w-6 h-6 text-slate-300 animate-bounce" />
                  <span className="text-xs font-semibold text-slate-400">
                    Goreskan tanda tangan menggunakan mouse, stylus, atau sentuhan jari
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* UPLOAD FILE MODE */}
        {mode === 'upload' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileUpload}
              className="hidden"
            />

            {!uploadedPreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Pilih Berkas Gambar Tanda Tangan
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    PNG (latar transparan disarankan), JPG, atau WEBP maks 4MB
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg mt-1"
                >
                  Pilih File
                </button>
              </div>
            ) : (
              <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-24 h-16 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    <img src={uploadedPreview} alt="Signature preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Tanda Tangan Terunggah</span>
                    <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Siap Dicantumkan pada Kwitansi
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedPreview(null);
                    setHasDrawn(false);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1.5 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ganti</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Signer Identity Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Nama Lengkap Pengesah <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Ibu Hj. Siti Aminah"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Jabatan / Otoritas <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={signerTitle}
              onChange={(e) => setSignerTitle(e.target.value)}
              placeholder="e.g. Bendahara Paguyuban"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Save as Default Checkbox */}
        <label className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors select-none">
          <input
            type="checkbox"
            checked={saveAsDefault}
            onChange={(e) => setSaveAsDefault(e.target.checked)}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-bold text-slate-800 block">
              Simpan sebagai tanda tangan default sistem
            </span>
            <span className="text-[11px] text-slate-500">
              Tanda tangan ini akan otomatis digunakan untuk verifikasi kwitansi berikutnya tanpa perlu menggambar ulang.
            </span>
          </div>
        </label>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <X className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors"
        >
          Batal
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-900/30 inline-flex items-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Terapkan Tanda Tangan Resmi</span>
        </button>
      </div>
    </div>
  );
};
