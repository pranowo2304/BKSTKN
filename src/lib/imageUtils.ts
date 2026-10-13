/**
 * Image processing utilities for document and photo attachments.
 * Resizes large smartphone camera photos before storing as Data URLs,
 * preventing browser memory issues and localStorage quota exhaustion.
 */

export interface ProcessedImageResult {
  dataUrl: string;
  fileName: string;
  fileSizeBytes: number;
  width: number;
  height: number;
}

export const MAX_KK_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB for PDF and images
export const MAX_KK_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB for high-res smartphone photos (will be canvas-compressed)
export const ALLOWED_KK_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
export const ALLOWED_KK_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileSizeBytes: number;
  fileName: string;
  fileType: string;
  isPdf: boolean;
  isImage: boolean;
}

/**
 * Validates file type (JPEG, PNG, WebP, PDF) and file size
 * for immediate, clear feedback when a user selects a file.
 */
export function validateFamilyCardFile(
  file: File,
  maxPdfSizeBytes = MAX_KK_FILE_SIZE_BYTES
): FileValidationResult {
  if (!file) {
    return {
      valid: false,
      error: 'Berkas tidak ditemukan. Silakan pilih kembali berkas Kartu Keluarga Anda.',
      fileSizeBytes: 0,
      fileName: '',
      fileType: '',
      isPdf: false,
      isImage: false,
    };
  }

  const fileName = file.name || '';
  const fileExt = fileName.includes('.')
    ? '.' + (fileName.split('.').pop() || '').toLowerCase()
    : '';
  const fileMime = (file.type || '').toLowerCase();

  const isPdf = fileMime === 'application/pdf' || fileExt === '.pdf';
  // Allow all standard image types including smartphone camera captures and HEIC/HEIF
  const isImage =
    fileMime.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.heic', '.heif', '.bmp'].includes(fileExt) ||
    (!fileMime && !fileExt); // Fallback for mobile devices that don't declare mime or extension

  const isAllowed = isPdf || isImage;

  // 1. Immediate File Type Validation
  if (!isAllowed) {
    const extDisplay = fileExt ? fileExt.toUpperCase() : (file.type || 'Format tidak dikenal');
    return {
      valid: false,
      error: `Format berkas (${extDisplay}) tidak didukung. Harap pilih berkas gambar foto (JPEG/JPG, PNG, WebP) atau dokumen PDF Kartu Keluarga.`,
      fileSizeBytes: file.size,
      fileName: file.name,
      fileType: file.type,
      isPdf: false,
      isImage: false,
    };
  }

  // 2. File Size Validation:
  // For PDF files: enforce max 5MB because PDFs cannot be auto-compressed on client canvas.
  // For Image files: allow up to 20MB since the canvas compressor will automatically optimize it to ~150-250KB.
  const maxAllowedBytes = isPdf ? maxPdfSizeBytes : MAX_KK_IMAGE_UPLOAD_BYTES;

  if (file.size > maxAllowedBytes) {
    const currentMB = (file.size / (1024 * 1024)).toFixed(1);
    if (isPdf) {
      const maxMB = (maxPdfSizeBytes / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        error: `Ukuran dokumen PDF (${currentMB} MB) melebihi batas maksimal ${maxMB} MB. Silakan pilih dokumen PDF yang lebih kecil atau gunakan foto KK JPG/PNG.`,
        fileSizeBytes: file.size,
        fileName: file.name,
        fileType: file.type,
        isPdf,
        isImage,
      };
    } else {
      return {
        valid: false,
        error: `Ukuran foto (${currentMB} MB) terlalu besar (maksimal 20 MB). Silakan pilih foto dengan resolusi lebih wajar.`,
        fileSizeBytes: file.size,
        fileName: file.name,
        fileType: file.type,
        isPdf,
        isImage,
      };
    }
  }

  return {
    valid: true,
    fileSizeBytes: file.size,
    fileName: file.name,
    fileType: file.type,
    isPdf,
    isImage,
  };
}

export async function processImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.76
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    // Timeout safeguard: Ensure process never hangs indefinitely
    const timeoutId = setTimeout(() => {
      reject(new Error('Waktu pemrosesan berkas habis (timeout). Silakan coba pilih berkas gambar lain atau gunakan format JPG/PNG yang lebih ringan.'));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    // Validate file type and size immediately
    const validation = validateFamilyCardFile(file, MAX_KK_FILE_SIZE_BYTES);
    if (!validation.valid) {
      cleanup();
      reject(new Error(validation.error));
      return;
    }

    const { isPdf } = validation;

    const reader = new FileReader();

    reader.onerror = () => {
      cleanup();
      reject(new Error('Gagal membaca berkas dari perangkat Anda. Silakan coba kembali atau gunakan berkas lain.'));
    };

    reader.onabort = () => {
      cleanup();
      reject(new Error('Proses pembacaan berkas dibatalkan. Silakan pilih kembali berkas Kartu Keluarga.'));
    };

    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        cleanup();
        reject(new Error('Berkas kosong atau tidak dapat terbaca oleh browser.'));
        return;
      }

      // If PDF file, store data URL directly
      if (isPdf) {
        cleanup();
        resolve({
          dataUrl: rawDataUrl,
          fileName: file.name,
          fileSizeBytes: file.size,
          width: 0,
          height: 0,
        });
        return;
      }

      // For image files, compress and resize via HTML5 Canvas
      const img = new Image();

      img.onerror = () => {
        cleanup();
        // If canvas cannot decode (e.g. raw HEIC or corrupted), return raw dataUrl if small enough
        if (rawDataUrl.length < 800000) {
          resolve({
            dataUrl: rawDataUrl,
            fileName: file.name,
            fileSizeBytes: file.size,
            width: 0,
            height: 0,
          });
        } else {
          reject(new Error('Format foto tidak dapat diproses oleh browser. Silakan simpan sebagai JPG/PNG atau pilih foto lain dari galeri.'));
        }
      };

      img.onload = () => {
        try {
          let width = img.width || 1200;
          let height = img.height || 800;

          // Calculate proportional scale
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            resolve({
              dataUrl: rawDataUrl.length < 700000 ? rawDataUrl : rawDataUrl.substring(0, 700000),
              fileName: file.name,
              fileSizeBytes: file.size,
              width: img.width,
              height: img.height,
            });
            return;
          }

          // Render image with high smoothing quality for crisp document text
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let outputDataUrl = canvas.toDataURL('image/jpeg', quality);

          // If still over 450KB (~600,000 base64 chars), perform a second lighter pass to protect storage
          if (outputDataUrl.length > 600000) {
            outputDataUrl = canvas.toDataURL('image/jpeg', 0.60);
          }
          if (outputDataUrl.length > 800000) {
            outputDataUrl = canvas.toDataURL('image/jpeg', 0.48);
          }

          const approxBytes = Math.round((outputDataUrl.length - 22) * 0.75);
          const sanitizedFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';

          cleanup();
          resolve({
            dataUrl: outputDataUrl,
            fileName: sanitizedFileName,
            fileSizeBytes: approxBytes,
            width,
            height,
          });
        } catch {
          cleanup();
          // Fallback if canvas manipulation fails
          if (rawDataUrl.length < 700000) {
            resolve({
              dataUrl: rawDataUrl,
              fileName: file.name,
              fileSizeBytes: file.size,
              width: img.width,
              height: img.height,
            });
          } else {
            reject(new Error('Gagal mengompresi foto Kartu Keluarga. Silakan pilih foto lain dari galeri.'));
          }
        }
      };

      img.src = rawDataUrl;
    };

    try {
      reader.readAsDataURL(file);
    } catch (readErr) {
      cleanup();
      reject(new Error(readErr instanceof Error ? readErr.message : 'Tidak dapat membaca berkas fisik dari perangkat.'));
    }
  });
}

/**
 * Generates an authentic SVG data URL representing an Indonesian Kartu Keluarga document
 * for previewing realistic records.
 */
export function generateDemoFamilyCardDataUrl(
  headOfFamily: string,
  kkNumber = '3171010000000000',
  rtRw = 'RT 01 / RW 03'
): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 680" width="1000" height="680">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <pattern id="guilloche" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="18" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
    </pattern>
  </defs>

  <!-- Background with security pattern -->
  <rect width="1000" height="680" fill="url(#bg)"/>
  <rect width="1000" height="680" fill="url(#guilloche)" opacity="0.6"/>

  <!-- Ornate Border -->
  <rect x="20" y="20" width="960" height="640" rx="12" fill="none" stroke="#047857" stroke-width="4"/>
  <rect x="28" y="28" width="944" height="624" rx="8" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="6,4"/>

  <!-- Garuda Emblem Placeholder / Watermark -->
  <circle cx="500" cy="90" r="32" fill="#047857" opacity="0.12"/>
  <polygon points="500,65 525,105 475,105" fill="#047857" opacity="0.25"/>

  <!-- Header Text -->
  <text x="500" y="65" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="3">REPUBLIK INDONESIA</text>
  <text x="500" y="98" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#047857" text-anchor="middle" letter-spacing="4">KARTU KELUARGA</text>
  <text x="500" y="130" font-family="Courier, monospace" font-size="20" font-weight="bold" fill="#1e293b" text-anchor="middle" letter-spacing="2">No. ${kkNumber}</text>

  <!-- Divider -->
  <line x1="60" y1="145" x2="940" y2="145" stroke="#047857" stroke-width="2.5"/>

  <!-- Summary Info Grid -->
  <g font-family="Arial, sans-serif" font-size="13" fill="#334155">
    <text x="60" y="175" font-weight="bold">Nama Kepala Keluarga</text>
    <text x="240" y="175">: ${headOfFamily.toUpperCase()}</text>

    <text x="60" y="200" font-weight="bold">Alamat</text>
    <text x="240" y="200">: Perumahan Cluster (${rtRw})</text>

    <text x="60" y="225" font-weight="bold">RT / RW</text>
    <text x="240" y="225">: ${rtRw}</text>

    <text x="560" y="175" font-weight="bold">Kecamatan</text>
    <text x="700" y="175">: Setiabudi</text>

    <text x="560" y="200" font-weight="bold">Kabupaten / Kota</text>
    <text x="700" y="200">: Jakarta Selatan</text>

    <text x="560" y="225" font-weight="bold">Provinsi</text>
    <text x="700" y="225">: DKI Jakarta</text>
  </g>

  <!-- Table Header -->
  <g transform="translate(60, 250)">
    <rect width="880" height="32" fill="#047857" rx="4"/>
    <text x="20" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">No</text>
    <text x="70" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">Nama Lengkap</text>
    <text x="320" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">NIK</text>
    <text x="520" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">Jenis Kelamin</text>
    <text x="660" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">Hubungan Keluarga</text>
    <text x="810" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#ffffff">Status</text>
  </g>

  <!-- Table Rows -->
  <g transform="translate(60, 282)" font-family="Arial, sans-serif" font-size="11" fill="#1e293b">
    <!-- Row 1: Head of Family -->
    <rect width="880" height="34" fill="#ffffff" stroke="#e2e8f0"/>
    <text x="20" y="22" font-weight="bold">1</text>
    <text x="70" y="22" font-weight="bold">${headOfFamily.toUpperCase()}</text>
    <text x="320" y="22" font-family="monospace">317101${kkNumber.slice(-10)}</text>
    <text x="520" y="22">LAKI-LAKI</text>
    <text x="660" y="22" font-weight="bold" fill="#047857">KEPALA KELUARGA</text>
    <text x="810" y="22">KAWIN</text>

    <!-- Row 2: Spouse -->
    <g transform="translate(0, 34)">
      <rect width="880" height="34" fill="#f8fafc" stroke="#e2e8f0"/>
      <text x="20" y="22">2</text>
      <text x="70" y="22">ISTRI / PASANGAN</text>
      <text x="320" y="22" font-family="monospace">317101${(parseInt(kkNumber.slice(-6) || '100000', 10) + 1).toString().padStart(10, '0')}</text>
      <text x="520" y="22">PEREMPUAN</text>
      <text x="660" y="22">ISTRI</text>
      <text x="810" y="22">KAWIN</text>
    </g>

    <!-- Row 3: Child 1 -->
    <g transform="translate(0, 68)">
      <rect width="880" height="34" fill="#ffffff" stroke="#e2e8f0"/>
      <text x="20" y="22">3</text>
      <text x="70" y="22">ANAK KANDUNG I</text>
      <text x="320" y="22" font-family="monospace">317101${(parseInt(kkNumber.slice(-6) || '100000', 10) + 2).toString().padStart(10, '0')}</text>
      <text x="520" y="22">LAKI-LAKI</text>
      <text x="660" y="22">ANAK</text>
      <text x="810" y="22">BELUM KAWIN</text>
    </g>

    <!-- Row 4: Child 2 -->
    <g transform="translate(0, 102)">
      <rect width="880" height="34" fill="#f8fafc" stroke="#e2e8f0"/>
      <text x="20" y="22">4</text>
      <text x="70" y="22">ANAK KANDUNG II</text>
      <text x="320" y="22" font-family="monospace">317101${(parseInt(kkNumber.slice(-6) || '100000', 10) + 3).toString().padStart(10, '0')}</text>
      <text x="520" y="22">PEREMPUAN</text>
      <text x="660" y="22">ANAK</text>
      <text x="810" y="22">BELUM KAWIN</text>
    </g>
  </g>

  <!-- Official Footer & Stamp -->
  <g transform="translate(60, 480)">
    <!-- Barcode / QR Simulation -->
    <rect x="20" y="10" width="100" height="100" fill="#ffffff" stroke="#cbd5e1" rx="4"/>
    <rect x="30" y="20" width="80" height="80" fill="#047857" opacity="0.15"/>
    <text x="70" y="65" font-family="monospace" font-size="10" font-weight="bold" fill="#047857" text-anchor="middle">TTE DUKCAPIL</text>
    <text x="70" y="125" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">Tersertifikasi BSrE</text>

    <!-- Right Side Signature Block -->
    <g transform="translate(620, 10)" font-family="Arial, sans-serif" font-size="11" fill="#334155" text-anchor="center">
      <text x="120" y="15" text-anchor="middle">Dikeluarkan Tanggal: 12-01-2024</text>
      <text x="120" y="32" text-anchor="middle" font-weight="bold">KEPALA DINAS KEPENDUDUKAN</text>
      <text x="120" y="47" text-anchor="middle" font-weight="bold">DAN PENCATATAN SIPIL</text>

      <!-- Digital Stamp Badge -->
      <circle cx="120" cy="90" r="32" fill="none" stroke="#047857" stroke-width="2" stroke-dasharray="4,2"/>
      <text x="120" y="93" font-size="8" font-weight="bold" fill="#047857" text-anchor="middle">TANDA TANGAN ELEKTRONIK</text>
    </g>
  </g>

  <!-- Watermark text -->
  <text x="500" y="640" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">
    Lampiran Berkas Resmi Pendaftaran Gotong Royong Paguyuban Warga
  </text>
</svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
