import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Eye,
  EyeOff,
  Sun,
  ShieldCheck,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import {
  analyzeImageDataQuality,
  DocumentQualityReport,
} from '../lib/documentQualityValidator';

interface DocumentCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureComplete: (result: {
    photoUrl: string;
    file: File;
    fileName: string;
    qualityReport: DocumentQualityReport;
  }) => void;
  documentTitle?: string;
  memberName?: string;
}

export const DocumentCameraScannerModal: React.FC<DocumentCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onCaptureComplete,
  documentTitle = 'Kartu Keluarga (KK)',
  memberName = 'Warga',
}) => {
  // Video and Stream references
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasAnalyzeRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastAnalysisTimeRef = useRef<number>(0);

  // States
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);

  // Real-time live analysis report
  const [liveReport, setLiveReport] = useState<DocumentQualityReport | null>(null);
  const [consecutiveGoodFrames, setConsecutiveGoodFrames] = useState<number>(0);

  // Captured state (Freeze frame for review)
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedReport, setCapturedReport] = useState<DocumentQualityReport | null>(null);
  const [isProcessingCapture, setIsProcessingCapture] = useState<boolean>(false);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera();
    setIsInitializing(true);
    setPermissionError(null);

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('denied');
      setPermissionError('Browser Anda tidak mendukung akses kamera langsung. Silakan gunakan opsi unggah berkas galeri.');
      setIsInitializing(false);
      return;
    }

    try {
      // Ideal constraint for documents: high-res 1080p, rear camera
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraPermission('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() || {}) as any;
        if (capabilities.torch) {
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
      } catch (e) {
        // ignore device enumeration errors
      }

      setIsInitializing(false);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setIsInitializing(false);
      setCameraPermission('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Akses kamera ditolak oleh izin peramban (browser). Mohon izinkan akses kamera di ikon gembok pada bilah alamat peramban Anda.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('Tidak ada kamera yang terdeteksi pada perangkat Anda.');
      } else {
        setPermissionError(`Gagal membuka kamera (${err.message || 'Kesalahan perangkat'}). Silakan pilih berkas dari galeri.`);
      }
    }
  }, [selectedDeviceId, stopCamera]);

  // Toggle flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchEnabled(nextTorch);
    } catch (e) {
      console.warn('Torch not supported on this device:', e);
    }
  };

  // Switch camera (front / back)
  const handleSwitchCamera = () => {
    if (availableDevices.length <= 1) return;
    const currentIndex = availableDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextDevice = availableDevices[(currentIndex + 1) % availableDevices.length];
    if (nextDevice) {
      setSelectedDeviceId(nextDevice.deviceId);
      startCamera(nextDevice.deviceId);
    }
  };

  // Real-time analysis loop on live video
  useEffect(() => {
    if (!isOpen || capturedDataUrl || cameraPermission !== 'granted') {
      return;
    }

    let isSubscribed = true;

    const runAnalysisLoop = () => {
      const now = performance.now();
      // Throttle analysis to ~280ms intervals to prevent frame drops
      if (now - lastAnalysisTimeRef.current >= 280) {
        lastAnalysisTimeRef.current = now;

        const video = videoRef.current;
        if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            if (!canvasAnalyzeRef.current) {
              canvasAnalyzeRef.current = document.createElement('canvas');
            }
            const canvas = canvasAnalyzeRef.current;

            // Target analysis resolution: downsampled bounding document area
            // Document box is approx 75% width & 65% height centered
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            const boxW = Math.round(vw * 0.75);
            const boxH = Math.round(vh * 0.65);
            const boxX = Math.round((vw - boxW) / 2);
            const boxY = Math.round((vh - boxH) / 2);

            const analyzeW = 320;
            const analyzeH = Math.round((boxH * 320) / boxW);
            canvas.width = analyzeW;
            canvas.height = analyzeH;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              // Draw only the document sub-region
              ctx.drawImage(video, boxX, boxY, boxW, boxH, 0, 0, analyzeW, analyzeH);
              const imgData = ctx.getImageData(0, 0, analyzeW, analyzeH);
              const report = analyzeImageDataQuality(imgData, 2);

              if (isSubscribed) {
                setLiveReport(report);
                if (report.isAcceptable) {
                  setConsecutiveGoodFrames((prev) => prev + 1);
                } else {
                  setConsecutiveGoodFrames(0);
                }
              }
            }
          } catch (err) {
            // Ignore minor canvas drawing errors during transitions
          }
        }
      }

      if (isSubscribed) {
        animFrameIdRef.current = requestAnimationFrame(runAnalysisLoop);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(runAnalysisLoop);

    return () => {
      isSubscribed = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isOpen, capturedDataUrl, cameraPermission]);

  // Start camera on open, clean up on close
  useEffect(() => {
    if (isOpen) {
      setCapturedDataUrl(null);
      setCapturedReport(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Capture High-Res Snapshot from Video Stream
  const handleCaptureSnapshot = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    setIsProcessingCapture(true);

    try {
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = video.videoWidth || 1920;
      fullCanvas.height = video.videoHeight || 1080;
      const ctx = fullCanvas.getContext('2d');

      if (!ctx) {
        setIsProcessingCapture(false);
        return;
      }

      // Draw full resolution frame
      ctx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

      // Analyze quality on the captured frame
      const analysisW = 480;
      const analysisH = Math.round((fullCanvas.height * 480) / fullCanvas.width);
      const testCanvas = document.createElement('canvas');
      testCanvas.width = analysisW;
      testCanvas.height = analysisH;
      const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });

      let report: DocumentQualityReport;
      if (testCtx) {
        testCtx.drawImage(fullCanvas, 0, 0, analysisW, analysisH);
        const imgData = testCtx.getImageData(0, 0, analysisW, analysisH);
        report = analyzeImageDataQuality(imgData, 2);
      } else {
        report = liveReport || {
          status: 'good',
          overallScore: 75,
          isAcceptable: true,
          metrics: {
            sharpnessScore: 75,
            laplacianVariance: 120,
            brightnessScore: 130,
            contrastScore: 50,
            readabilityScore: 70,
            textStrokeCount: 500,
          },
          headline: 'Dokumen Terfoto',
          feedbackMessage: 'Foto berhasil diambil.',
          recommendations: [],
        };
      }

      // Generate optimized JPEG data URL
      const dataUrl = fullCanvas.toDataURL('image/jpeg', 0.82);

      setCapturedDataUrl(dataUrl);
      setCapturedReport(report);
      // Pause camera stream while user reviews
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } catch (err) {
      console.warn('Error taking photo:', err);
    } finally {
      setIsProcessingCapture(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedDataUrl(null);
    setCapturedReport(null);
    if (videoRef.current && streamRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Confirm and use captured photo
  const handleConfirmUse = () => {
    if (!capturedDataUrl || !capturedReport) return;

    // Convert dataUrl to a real File object for form submission
    const cleanMemberName = memberName.trim().replace(/\s+/g, '_') || 'Warga';
    const timestamp = Date.now();
    const fileName = `KK_${cleanMemberName}_${timestamp}.jpg`;

    // Extract base64 and create Blob
    const arr = capturedDataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const file = new File([blob], fileName, { type: mime });

    onCaptureComplete({
      photoUrl: capturedDataUrl,
      file,
      fileName,
      qualityReport: capturedReport,
    });

    onClose();
  };

  if (!isOpen) return null;

  // Viewfinder outline styles based on live quality status
  const getBorderColorClass = () => {
    if (!liveReport) return 'border-white/60';
    if (liveReport.isAcceptable) return 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]';
    if (liveReport.status === 'warning_blur') return 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]';
    if (liveReport.status === 'warning_dark' || liveReport.status === 'warning_glare')
      return 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]';
    return 'border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.35)]';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[96vh]">
        {/* TOP BAR: Header, Status, and Close */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Kamera Dokumen Real-time</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 font-semibold border border-emerald-700/50">
                  Validasi Otomatis
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Pindai {documentTitle} dengan panduan ketajaman & keterbacaan teks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Flashlight button if supported */}
            {hasTorch && !capturedDataUrl && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  torchEnabled
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title={torchEnabled ? 'Matikan Senter' : 'Nyalakan Senter Kamera'}
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            {/* Switch Camera if multiple cameras exist */}
            {availableDevices.length > 1 && !capturedDataUrl && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                title="Ganti Kamera (Depan / Belakang)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MAIN VIEWPORT */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[360px] sm:min-h-[440px]">
          {/* PERMISSION DENIED STATE */}
          {cameraPermission === 'denied' && (
            <div className="p-6 text-center max-w-md space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-white">Izin Akses Kamera Ditolak</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {permissionError || 'Peramban Anda memblokir akses ke kamera perangkat.'}
                </p>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl text-left text-xs text-slate-300 space-y-2">
                <span className="font-bold text-white block">Cara mengaktifkan:</span>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400">
                  <li>Klik ikon gembok / pengaturan situs di bilah alamat browser.</li>
                  <li>Ubah izin "Kamera" menjadi "Izinkan" (Allow).</li>
                  <li>Tekan tombol coba lagi di bawah ini.</li>
                </ol>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  Tutup & Pilih Berkas
                </button>
              </div>
            </div>
          )}

          {/* INITIALIZING CAMERA SPINNER */}
          {isInitializing && cameraPermission !== 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs font-semibold text-slate-300">Menghubungkan ke kamera resolusi tinggi...</p>
            </div>
          )}

          {/* LIVE VIDEO ELEMENT */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover ${capturedDataUrl ? 'hidden' : 'block'}`}
          />

          {/* CAPTURED FREEZE IMAGE PREVIEW */}
          {capturedDataUrl && (
            <div className="w-full h-full flex items-center justify-center p-2 bg-slate-950">
              <img
                src={capturedDataUrl}
                alt="Captured Document Preview"
                className="max-w-full max-h-full object-contain rounded-xl border border-slate-700"
              />
            </div>
          )}

          {/* LIVE CAMERA OVERLAY: Document Viewfinder Guideline & Real-time Feedback */}
          {!capturedDataUrl && cameraPermission === 'granted' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 z-10">
              {/* Top Floating Feedback Pill */}
              <div className="w-full max-w-md pt-2 flex justify-center">
                {liveReport ? (
                  <div
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border flex items-center gap-2 shadow-lg transition-all duration-200 animate-in fade-in ${
                      liveReport.isAcceptable
                        ? 'bg-emerald-950/85 text-emerald-200 border-emerald-500/50'
                        : liveReport.status === 'warning_blur'
                        ? 'bg-amber-950/90 text-amber-200 border-amber-500/60 animate-pulse'
                        : liveReport.status === 'warning_dark' || liveReport.status === 'warning_glare'
                        ? 'bg-yellow-950/90 text-yellow-200 border-yellow-500/60'
                        : 'bg-rose-950/90 text-rose-200 border-rose-500/60'
                    }`}
                  >
                    {liveReport.isAcceptable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : liveReport.status === 'warning_blur' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : liveReport.status === 'warning_dark' ? (
                      <Sun className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate">{liveReport.feedbackMessage}</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-900/80 text-slate-300 backdrop-blur-sm border border-slate-700">
                    Arahkan kamera ke Kartu Keluarga...
                  </div>
                )}
              </div>

              {/* Central Viewfinder Frame (Landscape Ratio ~1.414 for Kartu Keluarga / A4) */}
              <div className="relative w-[88%] max-w-lg aspect-[1.414/1] flex items-center justify-center">
                {/* Visual guideline box */}
                <div
                  className={`absolute inset-0 border-2 rounded-2xl transition-all duration-300 ${getBorderColorClass()}`}
                >
                  {/* Corner Accent Brackets */}
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Document Title Guideline Watermark */}
                  <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono font-bold text-white/70 uppercase tracking-wider">
                    <span>KARTU KELUARGA (KK)</span>
                    <span>16 DIGIT NIK</span>
                  </div>

                  {/* Center Alignment Crosshair / Scan Beam Effect */}
                  <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-t border-dashed border-white/20" />
                  <div className="absolute inset-y-8 left-1/2 -translate-x-1/2 border-l border-dashed border-white/20" />

                  {/* Success Banner when document is locked & readable */}
                  {consecutiveGoodFrames >= 4 && (
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                      <div className="px-3 py-1 bg-emerald-600/90 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Fokus Terkunci • Siap Ambil Foto</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Real-time HUD Metrics Bar */}
              <div className="w-full max-w-md pb-1">
                <div className="bg-slate-950/80 backdrop-blur-md rounded-2xl p-2.5 border border-slate-800/90 grid grid-cols-3 gap-2 text-center text-[10px]">
                  {/* Metric 1: Ketajaman / Sharpness */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Ketajaman</span>
                      <span className="font-bold text-white">
                        {liveReport ? `${liveReport.metrics.sharpnessScore}%` : '-'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          (liveReport?.metrics.sharpnessScore || 0) >= 50
                            ? 'bg-emerald-400'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${liveReport?.metrics.sharpnessScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Metric 2: Keterbacaan Teks / Readability */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Teks Huruf</span>
                      <span className="font-bold text-white">
                        {liveReport ? `${liveReport.metrics.readabilityScore}%` : '-'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          (liveReport?.metrics.readabilityScore || 0) >= 40
                            ? 'bg-emerald-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${liveReport?.metrics.readabilityScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Metric 3: Pencahayaan / Lighting */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Cahaya</span>
                      <span className="font-bold text-white">
                        {liveReport
                          ? liveReport.metrics.brightnessScore < 60
                            ? 'Gelap'
                            : liveReport.metrics.brightnessScore > 220
                            ? 'Silau'
                            : 'Optimal'
                          : '-'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          liveReport &&
                          liveReport.metrics.brightnessScore >= 60 &&
                          liveReport.metrics.brightnessScore <= 220
                            ? 'bg-emerald-400'
                            : 'bg-yellow-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(((liveReport?.metrics.brightnessScore || 128) / 255) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 z-20 shrink-0">
          {!capturedDataUrl ? (
            /* LIVE CAMERA CONTROLS */
            <div className="flex items-center justify-between gap-3">
              <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pastikan seluruh bagian tabel KK masuk dalam bingkai persegi.</span>
              </div>

              {/* Shutter Button */}
              <div className="flex items-center justify-center w-full sm:w-auto mx-auto gap-4">
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={cameraPermission !== 'granted' || isProcessingCapture}
                  className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-white hover:bg-emerald-50 active:scale-95 transition-all shadow-lg shadow-black/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Ambil Foto Dokumen Kartu Keluarga"
                >
                  <div
                    className={`w-13 h-13 rounded-full border-2 transition-all flex items-center justify-center ${
                      liveReport?.isAcceptable
                        ? 'border-emerald-600 bg-emerald-500/20 group-hover:scale-105'
                        : 'border-slate-400 bg-slate-100'
                    }`}
                  >
                    <Camera
                      className={`w-6 h-6 transition-colors ${
                        liveReport?.isAcceptable ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    />
                  </div>
                </button>
              </div>

              <div className="hidden sm:block text-right">
                <span className="text-[11px] font-mono text-slate-400 block">
                  {availableDevices.length > 0 ? `${availableDevices.length} Kamera Terdeteksi` : 'Kamera Aktif'}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">1080p HD Ready</span>
              </div>
            </div>
          ) : (
            /* POST-CAPTURE QUALITY EVALUATION & DECISION SCREEN */
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Detailed Quality Assessment Breakdown Card */}
              {capturedReport && (
                <div
                  className={`p-3.5 rounded-2xl border ${
                    capturedReport.isAcceptable
                      ? 'bg-emerald-950/50 border-emerald-500/50'
                      : 'bg-amber-950/50 border-amber-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
                          capturedReport.isAcceptable
                            ? 'bg-emerald-900/80 text-emerald-300'
                            : 'bg-amber-900/80 text-amber-300'
                        }`}
                      >
                        {capturedReport.isAcceptable ? (
                          <ShieldCheck className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {capturedReport.headline}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              capturedReport.isAcceptable
                                ? 'bg-emerald-400 text-emerald-950'
                                : 'bg-amber-400 text-amber-950'
                            }`}
                          >
                            Skor: {capturedReport.overallScore}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {capturedReport.feedbackMessage}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations if quality is suboptimal */}
                  {capturedReport.recommendations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-800/40 text-[11px] text-amber-200 space-y-1">
                      <span className="font-semibold block">Saran perbaikan:</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-amber-300/90 text-[10px]">
                        {capturedReport.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Retake vs Confirm */}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  <span>Foto Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmUse}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
                    capturedReport?.isAcceptable
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                      : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {capturedReport?.isAcceptable
                      ? 'Gunakan Foto Dokumen Ini'
                      : 'Tetap Gunakan Foto Ini'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
