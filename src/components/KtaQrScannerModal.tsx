import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Member, SystemSettings } from '../types';
import {
  Camera,
  X,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Flashlight,
  User,
  ShieldCheck,
  Building,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface KtaQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  settings: SystemSettings;
  onMemberIdentified: (member: Member) => void;
  title?: string;
  subtitle?: string;
  actionButtonText?: string;
  helperText?: string;
}

export const KtaQrScannerModal: React.FC<KtaQrScannerModalProps> = ({
  isOpen,
  onClose,
  members,
  settings,
  onMemberIdentified,
  title = 'Scan QR Kartu Tanda Anggota (KTA)',
  subtitle = 'Arahkan kamera ke QR Code pada kartu KTA warga',
  actionButtonText = 'Pilih Warga Ini',
  helperText,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);
  const [notFoundPayload, setNotFoundPayload] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState(true);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'kta-camera-scanner-view';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Play subtle beep sound on success
  const playBeep = () => {
    if (!audioFeedback) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch {
      // Ignore if audio context not allowed
    }
  };

  // Trigger device vibration if available
  const triggerVibrate = () => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // Ignore
      }
    }
  };

  // Find member matching the scanned raw string or JSON
  const findMemberFromPayload = (decodedText: string): Member | null => {
    const raw = decodedText.trim();

    // 1. Try parsing JSON format from DigitalKtaModal
    try {
      const parsed = JSON.parse(raw);
      if (parsed) {
        const npa = parsed.npa || parsed.memberNumber;
        const nik = parsed.nik;
        const id = parsed.id;
        const name = parsed.name;

        const found = members.find((m) => {
          if (npa && m.memberNumber && m.memberNumber.toLowerCase() === String(npa).toLowerCase()) return true;
          if (id && m.id === String(id)) return true;
          if (nik && m.nik && m.nik === String(nik)) return true;
          if (name && m.name && m.name.toLowerCase() === String(name).toLowerCase()) return true;
          return false;
        });

        if (found) return found;
      }
    } catch {
      // Not JSON, continue to raw string matches
    }

    // 2. Direct exact memberNumber match (e.g. "ADK-2026-001")
    const matchByNpa = members.find(
      (m) => m.memberNumber && m.memberNumber.toLowerCase() === raw.toLowerCase()
    );
    if (matchByNpa) return matchByNpa;

    // 3. Match by ID (e.g. "mem-171...")
    const matchById = members.find((m) => m.id === raw);
    if (matchById) return matchById;

    // 4. Match by NIK
    const matchByNik = members.find((m) => m.nik && m.nik === raw);
    if (matchByNik) return matchByNik;

    // 5. Match by Member Name
    const matchByName = members.find(
      (m) => m.name && m.name.toLowerCase() === raw.toLowerCase()
    );
    if (matchByName) return matchByName;

    // 6. Regex search for NPA pattern (e.g. ADK-2026-001 embedded in URL or text)
    const npaRegex = /ADK-\d{4}-\d+/i;
    const npaMatch = raw.match(npaRegex);
    if (npaMatch) {
      const extractedNpa = npaMatch[0].toUpperCase();
      const matchExtracted = members.find(
        (m) => m.memberNumber && m.memberNumber.toUpperCase() === extractedNpa
      );
      if (matchExtracted) return matchExtracted;
    }

    return null;
  };

  const handleDecodedText = (decodedText: string) => {
    setScannedResult(decodedText);
    playBeep();
    triggerVibrate();

    const member = findMemberFromPayload(decodedText);
    if (member) {
      setMatchedMember(member);
      setNotFoundPayload(null);
      // Stop scanner temporarily to show result card
      stopScanner();
    } else {
      setMatchedMember(null);
      setNotFoundPayload(decodedText);
    }
  };

  const startScanner = async (cameraId?: string) => {
    setCameraError(null);
    setScannedResult(null);
    setMatchedMember(null);
    setNotFoundPayload(null);

    try {
      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
        } catch {
          // ignore
        }
      }

      const qrScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = qrScanner;

      // Get available cameras list
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const targetCamId = cameraId || devices[devices.length - 1].id; // default to back camera
        setSelectedCameraId(targetCamId);

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await qrScanner.start(
          targetCamId,
          config,
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
            // scan failure callback (silent frame miss)
          }
        );

        setIsScanning(true);

        // Check if torch/flashlight is supported
        try {
          const capabilities = qrScanner.getRunningTrackCapabilities();
          if ((capabilities as any)?.torch) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      } else {
        // Fallback to environment facing mode
        await qrScanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decodedText) => handleDecodedText(decodedText),
          () => {}
        );
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error('QR Scanner init error:', err);
      setIsScanning(false);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission denied')) {
        setCameraError(
          'Izin akses kamera ditolak oleh browser. Mohon izinkan akses kamera pada ikon gembok/setelan browser untuk memindai QR KTA.'
        );
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('no camera')) {
        setCameraError('Perangkat kamera tidak ditemukan pada perangkat Anda.');
      } else {
        setCameraError(`Gagal membuka kamera: ${errMsg}`);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      setIsScanning(false);
    }
  };

  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }] as any,
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    await stopScanner();
    await startScanner(newCamId);
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }
      const result = await html5QrCodeRef.current.scanFile(file, true);
      handleDecodedText(result);
    } catch (err: any) {
      alert('Tidak dapat membaca QR Code dari file gambar yang diunggah. Pastikan QR code terlihat jelas dan tidak blur.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmMember = () => {
    if (matchedMember) {
      onMemberIdentified(matchedMember);
      onClose();
    }
  };

  const handleRescan = () => {
    setMatchedMember(null);
    setNotFoundPayload(null);
    setScannedResult(null);
    startScanner(selectedCameraId);
  };

  useEffect(() => {
    if (isOpen) {
      // Delay slightly for modal mount DOM ready
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>{title}</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* CAMERA VIEWPORT OR MATCH RESULT */}
          {!matchedMember && !notFoundPayload ? (
            <div className="space-y-3">
              {/* Scanner Container Box */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/50 shadow-inner flex flex-col items-center justify-center min-h-[300px]">
                {/* HTML5 QR Code Mount Element */}
                <div id={scannerContainerId} className="w-full h-full max-w-full overflow-hidden" />

                {/* Laser animation and target frame overlay */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                    <div className="w-56 h-56 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                      {/* Moving Scan Beam Line */}
                      <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-[11px] font-bold text-white/90 bg-slate-950/70 px-3 py-1 rounded-full mt-4 backdrop-blur-xs border border-white/10">
                      Posisikan QR Code di dalam kotak
                    </p>
                  </div>
                )}

                {/* Camera error message */}
                {cameraError && (
                  <div className="p-6 text-center text-rose-300 space-y-3 max-w-sm">
                    <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                    <p className="text-xs font-semibold leading-relaxed text-white">
                      {cameraError}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => startScanner(selectedCameraId)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Akses Lagi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File QR</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls bar: Switch Camera, Flashlight, Audio Beep, Upload Photo */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  {cameras.length > 1 && (
                    <select
                      value={selectedCameraId}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      className="bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {cameras.map((cam, idx) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label || `Kamera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

                  {hasTorch && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        torchOn
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                      title="Senter / Flash"
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setAudioFeedback(!audioFeedback)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      audioFeedback
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-white text-slate-400 border-slate-300'
                    }`}
                    title={audioFeedback ? 'Suara Bunyi Aktif' : 'Suara Bunyi Mati'}
                  >
                    {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileScan}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 transition-colors inline-flex items-center gap-1 text-[11px]"
                    title="Pilih gambar KTA dari galeri atau berkas"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Upload Foto QR</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* STATE 1: MATCHED MEMBER CARD IDENTIFIED */}
          {matchedMember && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>KTA Berhasil Diidentifikasi!</span>
                  </div>
                  <span className="font-mono text-xs font-black text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    {matchedMember.memberNumber}
                  </span>
                </div>

                {/* Member Profile Detail */}
                <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-2.5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                      {matchedMember.name.charAt(0)}
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black text-slate-900">{matchedMember.name}</h3>
                      <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-bold">{matchedMember.cluster || 'Cluster Warga'}</span>
                        <span>•</span>
                        <span className="font-mono">{matchedMember.nik}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {matchedMember.address} • {matchedMember.phone}
                      </p>
                    </div>
                  </div>

                  {/* Verification Status */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Status Keanggotaan:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md ${
                        matchedMember.status === 'Aktif' || matchedMember.verificationStatus === 'Verified'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : matchedMember.status === 'Menunggu Verifikasi RT'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {matchedMember.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Tanggungan Terlindungi:</span>
                    <span className="font-bold text-slate-800">
                      {matchedMember.dependentsCount} Jiwa
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {helperText || (
                    <>
                      Data warga ditemukan: <strong>{matchedMember.name}</strong> ({matchedMember.memberNumber || matchedMember.nik}).
                    </>
                  )}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRescan}
                  className="w-1/3 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmMember}
                  className="w-2/3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20 inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionButtonText}</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: QR SCANNED BUT MEMBER NOT FOUND */}
          {notFoundPayload && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 animate-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-950">
                    QR Code Terbaca, Namun Data Warga Tidak Ditemukan
                  </h3>
                  <p className="text-xs text-amber-900/80 leading-relaxed">
                    Kode QR berhasil terbaca namun nomor anggota (NPA) atau NIK tidak terdaftar di dalam basis data sistem saat ini.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-200 text-[11px] font-mono text-slate-700 break-all">
                <span className="text-slate-400 font-bold block mb-1">Isi QR Code yang Terbaca:</span>
                {notFoundPayload}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRescan}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Scan Lagi</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
            <span>KTA Scanner Engine v2.0</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
