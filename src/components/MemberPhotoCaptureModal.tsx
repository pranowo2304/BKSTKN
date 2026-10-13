import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Check,
  RotateCw,
  Upload,
  AlertCircle,
  Sparkles,
  User,
  ShieldCheck,
  Zap,
  ZapOff,
} from 'lucide-react';

interface MemberPhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (photoDataUrl: string) => void;
  memberName?: string;
  currentPhotoUrl?: string;
}

export const MemberPhotoCaptureModal: React.FC<MemberPhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  memberName = 'Warga',
  currentPhotoUrl,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [rotationDegrees, setRotationDegrees] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Play synthetic camera shutter sound using Web Audio API
  const playShutterSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // AudioContext may fail if blocked, silently ignore
    }
  };

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setIsInitializing(true);
    setPermissionError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError('Browser Anda tidak mendukung akses kamera langsung. Silakan gunakan tombol unggah berkas foto.');
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities?.() || {}) as { torch?: boolean };
        if (caps.torch) {
          setHasTorch(true);
        }
      }

      // Enumerate available video inputs
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
        if (!selectedDeviceId && track) {
          const currentSettings = track.getSettings();
          if (currentSettings.deviceId) {
            setSelectedDeviceId(currentSettings.deviceId);
          }
        }
      } catch {
        // ignore device listing error
      }

      setIsInitializing(false);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      console.warn('Camera error:', error);
      setIsInitializing(false);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionError('Akses kamera tidak diizinkan oleh peramban. Mohon izinkan izin kamera pada pengaturan peramban Anda atau gunakan tombol unggah berkas foto.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermissionError('Tidak ada perangkat kamera yang terdeteksi di komputer atau ponsel Anda.');
      } else {
        setPermissionError(`Gagal membuka kamera (${error.message || 'Kesalahan perangkat'}). Anda dapat mengunggah berkas foto secara manual.`);
      }
    }
  }, [facingMode, selectedDeviceId, stopCamera]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      setCapturedPhotoUrl(null);
      setRotationDegrees(0);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle flash / torch
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !isTorchOn;
      await (track as MediaStreamTrack & { applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void> }).applyConstraints?.({
        advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Flip camera between front / user and rear / environment
  const handleFlipCamera = () => {
    setSelectedDeviceId('');
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture photo from video feed
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsCapturing(true);
    playShutterSound();

    try {
      const canvas = document.createElement('canvas');
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // Desired 3:4 portrait ratio for official KTA ID photo
      const targetRatio = 3 / 4;
      let cropWidth = vWidth;
      let cropHeight = vHeight;
      let startX = 0;
      let startY = 0;

      const currentRatio = vWidth / vHeight;
      if (currentRatio > targetRatio) {
        // Video is wider than 3:4 portrait -> crop sides
        cropWidth = vHeight * targetRatio;
        startX = (vWidth - cropWidth) / 2;
      } else {
        // Video is taller than 3:4 portrait -> crop top/bottom
        cropHeight = vWidth / targetRatio;
        startY = (vHeight - cropHeight) / 2;
      }

      // Output resolution: 480 x 640 standard KTA pasfoto
      canvas.width = 480;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // If front camera, mirror image so preview is natural
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedPhotoUrl(dataUrl);
      setRotationDegrees(0);

      // Stop camera while previewing captured photo
      stopCamera();
    } catch (err) {
      console.error('Failed to capture photo:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Rotate photo 90 degrees clockwise
  const handleRotate = () => {
    if (!capturedPhotoUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedPhotoUrl(rotatedDataUrl);
      setRotationDegrees((prev) => (prev + 90) % 360);
    };
    img.src = capturedPhotoUrl;
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    setRotationDegrees(0);
    startCamera();
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedPhotoUrl) {
      onPhotoCaptured(capturedPhotoUrl);
      onClose();
    }
  };

  // Upload photo from file/gallery
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetRatio = 3 / 4;
        let cropWidth = img.width;
        let cropHeight = img.height;
        let startX = 0;
        let startY = 0;

        const currentRatio = img.width / img.height;
        if (currentRatio > targetRatio) {
          cropWidth = img.height * targetRatio;
          startX = (img.width - cropWidth) / 2;
        } else {
          cropHeight = img.width / targetRatio;
          startY = (img.height - cropHeight) / 2;
        }

        canvas.width = 480;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, startX, startY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setCapturedPhotoUrl(dataUrl);
          stopCamera();
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Ambil Foto Profil KTA Warga</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px] sm:max-w-xs">
                Pasfoto resmi anggota: <span className="text-emerald-300 font-semibold">{memberName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[420px]">
          {/* Visual Flash effect on capture */}
          {isCapturing && (
            <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-150 pointer-events-none" />
          )}

          {/* Mode 1: Live Video Camera */}
          {!capturedPhotoUrl && (
            <>
              {isInitializing && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white gap-3 bg-slate-950/90">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-sm font-semibold text-slate-300">Menghubungkan ke kamera perangkat...</p>
                </div>
              )}

              {permissionError ? (
                <div className="p-6 text-center text-white max-w-sm space-y-4">
                  <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-400 mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">Akses Kamera Terkendala</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{permissionError}</p>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Coba Buka Kamera Lagi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Pilih Berkas Foto dari Galeri</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />

                  {/* KTA ID Photo Framing Guide (Oval & Shoulders) */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-4">
                    {/* Darkened overlay outside the crop box */}
                    <div className="relative w-[240px] sm:w-[270px] h-[320px] sm:h-[360px] rounded-3xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex flex-col items-center justify-center overflow-hidden">
                      {/* Face silhouette oval guide */}
                      <div className="w-[140px] sm:w-[160px] h-[180px] sm:h-[200px] rounded-[50%] border-2 border-dashed border-amber-300/80 mb-6 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-amber-200 uppercase tracking-widest px-2 py-0.5 bg-black/40 rounded-full backdrop-blur-xs">
                          Posisi Wajah
                        </span>
                      </div>
                      {/* Shoulders contour guide */}
                      <div className="w-[220px] sm:w-[250px] h-[40px] border-t-2 border-dashed border-emerald-300/70 rounded-[50%_50%_0_0] absolute bottom-2" />
                    </div>

                    <div className="mt-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full border border-white/20 text-[11px] text-white font-medium flex items-center gap-1.5 shadow-md">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Posisikan wajah & bahu tegak di dalam garis panduan</span>
                    </div>
                  </div>

                  {/* Floating Action Controls on Top Video */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={handleToggleTorch}
                        className={`p-2.5 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                          isTorchOn
                            ? 'bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-400/30'
                            : 'bg-black/50 hover:bg-black/70 text-white border border-white/20'
                        }`}
                        title={isTorchOn ? 'Matikan Lampu Kilat' : 'Nyalakan Lampu Kilat'}
                      >
                        {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleFlipCamera}
                      className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/20 transition-all cursor-pointer"
                      title="Balik Kamera Depan / Belakang"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Mode 2: Preview Captured Photo */}
          {capturedPhotoUrl && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
              <div className="relative w-[240px] sm:w-[270px] h-[320px] sm:h-[360px] rounded-2xl overflow-hidden border-3 border-emerald-400 shadow-2xl bg-slate-950">
                <img
                  src={capturedPhotoUrl}
                  alt="Hasil Foto KTA"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-black rounded-md flex items-center gap-1 shadow-md">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Pasfoto Siap</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for Gallery Fallback */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Footer Controls */}
        <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 shrink-0">
          {!capturedPhotoUrl ? (
            <div className="flex items-center justify-between gap-3">
              {/* Left: Gallery Upload Alternative */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-slate-700"
                title="Pilih foto yang sudah ada dari perangkat"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Pilih dari Galeri</span>
                <span className="sm:hidden">Galeri</span>
              </button>

              {/* Center: Big Shutter Button */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={isInitializing || !!permissionError}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xl ${
                  isInitializing || !!permissionError
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-4 border-slate-700'
                    : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 border-4 border-white shadow-emerald-500/30'
                }`}
                title="Tekan untuk mengambil foto"
              >
                <div className="w-12 h-12 rounded-full border-2 border-slate-900/30 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              {/* Right: Camera device selector if available */}
              {availableDevices.length > 1 ? (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="px-2.5 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 outline-none max-w-[130px] truncate"
                >
                  {availableDevices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Kamera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-20" />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ambil Ulang</span>
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer border border-slate-700"
                title="Putar 90 Derajat"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">Putar</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Foto KTA</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
