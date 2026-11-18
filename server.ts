import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

// Shared server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

interface ExtractedFamilyMemberRaw {
  name?: string;
  nik?: string;
  relationship?: string;
  birthDate?: string;
  age?: number;
}

interface ExtractedKkResponseRaw {
  isValidKartuKeluarga?: boolean;
  familyCardNumber?: string;
  headOfFamilyName?: string;
  headOfFamilyNik?: string;
  address?: string;
  rtRw?: string;
  familyMembers?: ExtractedFamilyMemberRaw[];
  confidenceNote?: string;
}

function parseDataUrl(
  dataUrl: string
): { mimeType: string; data: string; isSvgText: boolean; svgText?: string } | null {
  const trimmed = (dataUrl || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('<svg')) {
    return { mimeType: 'image/svg+xml', data: '', isSvgText: true, svgText: trimmed };
  }

  if (trimmed.startsWith('data:image/svg+xml')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return null;
    const header = trimmed.slice(0, commaIdx).toLowerCase();
    const body = trimmed.slice(commaIdx + 1);
    const svgText = header.includes(';base64')
      ? Buffer.from(body, 'base64').toString('utf8')
      : decodeURIComponent(body);
    return { mimeType: 'image/svg+xml', data: body, isSvgText: true, svgText };
  }

  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  let mimeType = match[1].toLowerCase().trim();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  const data = match[2].replace(/\s+/g, '');
  if (!data) return null;
  return { mimeType, data, isSvgText: false };
}

const GEMINI_SUPPORTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

async function preprocessImageForOcr(
  base64Data: string,
  mimeType: string
): Promise<{ mimeType: string; data: string }> {
  if (mimeType === 'application/pdf') {
    return { mimeType, data: base64Data };
  }

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;
    const inputBuffer = Buffer.from(base64Data, 'base64');

    // Auto-orient via EXIF metadata (.rotate()), upscale/cap safely to <=2400px,
    // and output crisp high-quality JPEG so dense KK tables stay legible even in portrait photos
    const meta = await sharp(inputBuffer).metadata();
    let pipeline = sharp(inputBuffer).rotate();

    const maxDim = Math.max(meta.width || 0, meta.height || 0);
    if (maxDim > 1800) {
      pipeline = pipeline.resize({
        width: 1800,
        height: 1800,
        fit: 'inside',
        withoutEnlargement: true,
      });
    } else if (maxDim > 0 && maxDim < 1000) {
      // Gently upscale small/compressed images so tiny 16-digit KK numbers are easier to read
      const scale = Math.min(2, Math.ceil(1400 / maxDim));
      if (meta.width && meta.height && scale > 1) {
        pipeline = pipeline.resize({
          width: meta.width * scale,
          height: meta.height * scale,
          kernel: sharp.kernel.lanczos3,
        });
      }
    }

    const outBuffer = await pipeline
      .sharpen({ sigma: 0.7 })
      .jpeg({ quality: 88, mozjpeg: false })
      .toBuffer();

    return {
      mimeType: 'image/jpeg',
      data: outBuffer.toString('base64'),
    };
  } catch (err) {
    // Fallback gracefully if sharp is unavailable or cannot decode (e.g. uncommon HEIC variant)
    console.warn('Sharp OCR preprocessing skipped:', err instanceof Error ? err.message : err);
    if (GEMINI_SUPPORTED_IMAGE_MIMES.has(mimeType)) {
      return { mimeType, data: base64Data };
    }
    return { mimeType: 'image/jpeg', data: base64Data };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT:${label}`));
    }, timeoutMs);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('timeout:') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed') ||
    msg.includes('500') ||
    msg.includes('internal')
  );
}

function formatFriendlyKkError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();

  if (lower.includes('timeout:')) {
    return {
      status: 504,
      message:
        'Waktu pembacaan dokumen habis karena ukuran berkas besar atau koneksi sedang lambat. Silakan klik "Coba Deteksi Lagi".',
    };
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      message:
        'Layanan OCR AI sedang padat sementara. Silakan tunggu beberapa detik lalu tekan tombol "Coba Deteksi Lagi".',
    };
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Kuota harian API gratis sementara habis. Untuk menaikkan kuota, gunakan API key berbayar di panel Settings > Secrets, atau isi data secara manual terlebih dahulu.',
    };
  }
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('api key')
  ) {
    return {
      status: 403,
      message:
        'Kunci API layanan OCR belum aktif atau tidak valid. Mohon periksa pengaturan Secrets GEMINI_API_KEY.',
    };
  }
  if (lower.includes('invalid_argument') || lower.includes('unable to process input image') || lower.includes('400')) {
    return {
      status: 400,
      message:
        'Format atau kualitas foto KK tidak dapat diproses. Pastikan berkas berupa foto JPG/PNG/WebP yang jelas atau PDF resmi.',
    };
  }
  return {
    status: 500,
    message:
      'Gagal membaca data Kartu Keluarga secara otomatis. Pastikan foto KK terang, tidak blur, dan teks terbaca jelas, lalu coba lagi.',
  };
}

function normalizeRelationship(rel?: string): string {
  const raw = (rel || '').trim().toLowerCase();
  if (!raw) return 'Lainnya';
  if (raw.includes('kepala')) return 'Kepala Keluarga';
  if (raw.includes('istri') || raw.includes('suami') || raw.includes('pasangan')) return 'Suami/Istri';
  if (raw.includes('anak')) return 'Anak Kandung';
  if (raw.includes('mertua')) return 'Mertua';
  if (raw.includes('orang tua') || raw.includes('orangtua') || raw.includes('ayah') || raw.includes('ibu')) return 'Orang Tua';
  if (raw.includes('saudara') || raw.includes('kakak') || raw.includes('adik')) return 'Saudara Kandung';
  return 'Lainnya';
}

function computeAgeFromBirthDate(birthDateStr?: string, fallbackAge?: number): number | undefined {
  if (birthDateStr) {
    const clean = birthDateStr.trim();
    // Try DD-MM-YYYY or DD/MM/YYYY
    let day: number | undefined;
    let month: number | undefined;
    let year: number | undefined;

    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);

    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      month = parseInt(dmyMatch[2], 10);
      year = parseInt(dmyMatch[3], 10);
    } else if (ymdMatch) {
      year = parseInt(ymdMatch[1], 10);
      month = parseInt(ymdMatch[2], 10);
      day = parseInt(ymdMatch[3], 10);
    }

    if (year && month && day && year > 1900 && year <= new Date().getFullYear()) {
      const now = new Date();
      let age = now.getFullYear() - year;
      const mDiff = now.getMonth() + 1 - month;
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) {
        age--;
      }
      if (age >= 0 && age <= 120) {
        return age;
      }
    }
  }

  if (typeof fallbackAge === 'number' && Number.isFinite(fallbackAge) && fallbackAge >= 0 && fallbackAge <= 120) {
    return Math.round(fallbackAge);
  }
  return undefined;
}

// Track temporary per-model cooldowns (e.g. when a model hits Free Tier 429 daily quota or 503 overload)
const modelCooldownUntil: Record<string, number> = {};

function markModelCooldown(model: string, err: unknown) {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('perday')) {
    // Daily or rate quota hit: cool down this model for 30 minutes so requests route immediately to fallback
    modelCooldownUntil[model] = Date.now() + 30 * 60 * 1000;
  } else if (msg.includes('503') || msg.includes('unavailable') || msg.includes('timeout:')) {
    // Transient overload/timeout: brief 90s cooldown
    modelCooldownUntil[model] = Date.now() + 90 * 1000;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get(['/health', '/healthz'], (_req: Request, res: Response) => {
    res.status(200).type('text/plain').send('OK');
  });

  app.post('/api/kk/extract', async (req: Request, res: Response) => {
    try {
      const { dataUrl, fileName } = (req.body || {}) as { dataUrl?: string; fileName?: string };
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Berkas Kartu Keluarga tidak ditemukan pada permintaan.',
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          success: false,
          error: 'Layanan pembacaan otomatis belum terkonfigurasi. Pastikan GEMINI_API_KEY tersedia pada Secrets.',
        });
        return;
      }

      const parsed = parseDataUrl(dataUrl);
      if (!parsed) {
        res.status(400).json({
          success: false,
          error: 'Format berkas Kartu Keluarga tidak dapat dibaca. Gunakan foto JPG/PNG/WebP atau dokumen PDF yang valid.',
        });
        return;
      }

      const extractionPrompt = `Anda adalah sistem OCR kependudukan Indonesia yang sangat teliti untuk mengekstrak data dari dokumen Kartu Keluarga (KK) Republik Indonesia.
Periksa dokumen Kartu Keluarga yang dilampirkan (${fileName || 'dokumen KK'}). Dokumen dapat berorientasi landscape, portrait, miring, atau terputar 90°/180°/270° — baca seluruh teks dengan cermat dalam orientasi apa pun.

Ekstrak informasi berikut secara akurat:
1. isValidKartuKeluarga: true jika dokumen tersebut adalah Kartu Keluarga Indonesia (berisi judul KARTU KELUARGA, nomor KK, atau tabel anggota keluarga kependudukan).
2. familyCardNumber: Nomor Kartu Keluarga (16 digit angka) yang tertulis besar di bagian atas tengah tepat di bawah judul "KARTU KELUARGA" (No. xxxxxxxxxxxxxxxx). JANGAN tertukar dengan NIK di dalam tabel. Kembalikan 16 digit angka saja tanpa spasi/titik.
3. headOfFamilyName & headOfFamilyNik: Nama Kepala Keluarga (biasanya tertulis di bagian kiri atas dan baris 1 tabel) serta NIK 16 digit Kepala Keluarga.
4. address & rtRw: Alamat dan RT/RW jika terbaca jelas.
5. familyMembers: Ekstrak SEMUA baris anggota keluarga pada tabel KK (Kepala Keluarga, Istri/Suami, Anak, Orang Tua, Mertua, dll.):
   - name: nama lengkap (gunakan kapitalisasi rapi seperti "Budi Santoso").
   - nik: 16 digit angka NIK jika terbaca (kosongkan jika buram/tidak terlihat).
   - relationship: klasifikasikan ke salah satu dari: "Kepala Keluarga", "Suami/Istri", "Anak Kandung", "Orang Tua", "Mertua", "Saudara Kandung", atau "Lainnya".
   - birthDate: tanggal lahir berformat DD-MM-YYYY jika terbaca.
   - age: perkiraan usia dalam tahun (integer) per tahun ${new Date().getFullYear()}.
6. confidenceNote: catatan singkat kejelasan pembacaan dalam Bahasa Indonesia (jika gambar buram, terpotong, atau terlalu jauh, sebutkan secara spesifik).
Jika suatu kolom tidak terbaca jelas, kosongkan string-nya tanpa mengarang angka.`;

      let parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
      if (parsed.isSvgText) {
        parts = [{ text: `${extractionPrompt}\n\nBerikut isi SVG dokumen Kartu Keluarga:\n${parsed.svgText}` }];
      } else {
        const prepared = await preprocessImageForOcr(parsed.data, parsed.mimeType);
        parts = [
          {
            inlineData: {
              mimeType: prepared.mimeType,
              data: prepared.data,
            },
          },
          { text: extractionPrompt },
        ];
      }

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          isValidKartuKeluarga: {
            type: Type.BOOLEAN,
            description: 'Apakah dokumen yang diunggah merupakan Kartu Keluarga (KK) Indonesia.',
          },
          familyCardNumber: {
            type: Type.STRING,
            description: 'Nomor Kartu Keluarga 16 digit angka tanpa spasi.',
          },
          headOfFamilyName: {
            type: Type.STRING,
            description: 'Nama lengkap Kepala Keluarga pada Kartu Keluarga.',
          },
          headOfFamilyNik: {
            type: Type.STRING,
            description: 'NIK 16 digit Kepala Keluarga jika terbaca.',
          },
          address: {
            type: Type.STRING,
            description: 'Alamat domisili yang tertulis pada Kartu Keluarga.',
          },
          rtRw: {
            type: Type.STRING,
            description: 'Nomor RT / RW jika tertulis.',
          },
          familyMembers: {
            type: Type.ARRAY,
            description: 'Daftar seluruh anggota keluarga yang tercantum dalam tabel Kartu Keluarga.',
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Nama lengkap anggota keluarga.' },
                nik: { type: Type.STRING, description: 'NIK 16 digit jika terbaca.' },
                relationship: {
                  type: Type.STRING,
                  description: 'Kepala Keluarga, Suami/Istri, Anak Kandung, Orang Tua, Mertua, Saudara Kandung, atau Lainnya.',
                },
                birthDate: { type: Type.STRING, description: 'Tanggal lahir (DD-MM-YYYY) jika terbaca.' },
                age: { type: Type.INTEGER, description: 'Perkiraan usia dalam tahun jika tanggal lahir terbaca.' },
              },
            },
          },
          confidenceNote: {
            type: Type.STRING,
            description: 'Ringkasan singkat kualitas & kejelasan hasil pembacaan dokumen dalam Bahasa Indonesia.',
          },
        },
      };

      const candidateAttempts: Array<{ model: string; useLowThinking: boolean; timeoutMs: number; delayBeforeMs: number }> = [
        { model: 'gemini-4-hydrogen', useLowThinking: true, timeoutMs: 25000, delayBeforeMs: 0 },
        { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 18000, delayBeforeMs: 300 },
        { model: 'gemini-4-hydrogen', useLowThinking: true, timeoutMs: 18000, delayBeforeMs: 500 },
      ];

      // Skip models currently in cooldown (e.g. quota exhausted) unless all models are in cooldown
      const now = Date.now();
      const availableAttempts = candidateAttempts.filter(
        (a) => now >= (modelCooldownUntil[a.model] || 0)
      );
      const attempts =
        availableAttempts.length > 0
          ? availableAttempts
          : [
              { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 18000, delayBeforeMs: 0 },
              { model: 'gemini-4-hydrogen', useLowThinking: true, timeoutMs: 20000, delayBeforeMs: 400 },
            ];

      let lastError: unknown = null;
      let extracted: ExtractedKkResponseRaw | null = null;

      for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        if (i > 0 && attempt.delayBeforeMs > 0) {
          await sleep(attempt.delayBeforeMs);
        }

        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: attempt.model,
              contents: { parts },
              config: {
                ...(attempt.useLowThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
                responseMimeType: 'application/json',
                responseSchema,
              },
            }),
            attempt.timeoutMs,
            attempt.model
          );

          const rawText = (response.text || '{}').trim();
          const parsedJson = JSON.parse(rawText) as ExtractedKkResponseRaw;
          extracted = parsedJson;
          break;
        } catch (err) {
          lastError = err;
          markModelCooldown(attempt.model, err);
          if (i === attempts.length - 1) {
            const friendly = formatFriendlyKkError(err);
            console.error(`KK extraction exhausted all models (HTTP ${friendly.status}): ${friendly.message}`);
          }
          if (!isRetryableGeminiError(err) && i === 0) {
            continue;
          }
          if (!isRetryableGeminiError(err) && i >= 1) {
            break;
          }
        }
      }

      if (!extracted) {
        const friendly = formatFriendlyKkError(lastError);
        res.status(friendly.status).json({
          success: false,
          error: friendly.message,
        });
        return;
      }

      const cleanKk = (extracted.familyCardNumber || '').replace(/[^0-9]/g, '').slice(0, 16);
      const cleanHeadNik = (extracted.headOfFamilyNik || '').replace(/[^0-9]/g, '').slice(0, 16);
      const membersList = Array.isArray(extracted.familyMembers)
        ? extracted.familyMembers
            .filter((m) => m && typeof m.name === 'string' && m.name.trim().length > 0)
            .map((m) => ({
              name: m.name!.trim(),
              nik: (m.nik || '').replace(/[^0-9]/g, '').slice(0, 16),
              relationship: normalizeRelationship(m.relationship),
              birthDate: (m.birthDate || '').trim(),
              age: computeAgeFromBirthDate(m.birthDate, m.age),
            }))
        : [];

      const headFromList = membersList.find((m) => m.relationship === 'Kepala Keluarga');
      const headName = (extracted.headOfFamilyName || headFromList?.name || '').trim();
      const headNik = cleanHeadNik || headFromList?.nik || '';

      res.status(200).json({
        success: true,
        data: {
          isValidKartuKeluarga: extracted.isValidKartuKeluarga !== false,
          familyCardNumber: cleanKk,
          headOfFamilyName: headName,
          headOfFamilyNik: headNik,
          address: (extracted.address || '').trim(),
          rtRw: (extracted.rtRw || '').trim(),
          familyMembers: membersList,
          confidenceNote: (extracted.confidenceNote || '').trim(),
        },
      });
    } catch (error: unknown) {
      console.error('KK extraction fatal error:', error instanceof Error ? error.message : error);
      const friendly = formatFriendlyKkError(error);
      res.status(friendly.status).json({
        success: false,
        error: friendly.message,
      });
    }
  });

  const BACKUP_ARCHIVE_DIR = path.join('/tmp', 'dana_kematian_backups');

  function getServerEmailTransportInfo() {
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').trim();

    if (resendKey) {
      return { configured: true, channel: 'resend_api' as const };
    }
    if (smtpHost && smtpUser && smtpPass) {
      return { configured: true, channel: 'smtp_server' as const };
    }
    return { configured: false, channel: 'none' as const };
  }

  app.get('/api/backup/status', (_req: Request, res: Response) => {
    const emailInfo = getServerEmailTransportInfo();
    let archiveFiles: string[] = [];
    try {
      if (fs.existsSync(BACKUP_ARCHIVE_DIR)) {
        archiveFiles = fs
          .readdirSync(BACKUP_ARCHIVE_DIR)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 15);
      }
    } catch {
      archiveFiles = [];
    }

    res.status(200).json({
      ok: true,
      emailConfigured: emailInfo.configured,
      emailChannel: emailInfo.channel,
      archiveCount: archiveFiles.length,
      recentArchiveFiles: archiveFiles,
    });
  });

  app.post('/api/backup/dispatch', async (req: Request, res: Response) => {
    try {
      const {
        backupId,
        backupDate,
        createdAt,
        triggerType,
        triggeredBy,
        adminEmail,
        webhookUrl,
        checksumSha256,
        snapshot,
        wantsEmailDelivery,
      } = (req.body || {}) as {
        backupId?: string;
        backupDate?: string;
        createdAt?: string;
        triggerType?: string;
        triggeredBy?: string;
        adminEmail?: string;
        webhookUrl?: string;
        checksumSha256?: string;
        snapshot?: Record<string, unknown>;
        wantsEmailDelivery?: boolean;
      };

      if (!backupId || !snapshot) {
        res.status(400).json({ error: 'Payload backup tidak lengkap.' });
        return;
      }

      const fullBackupJson = JSON.stringify(
        {
          metadata: {
            backupId,
            backupDate,
            createdAt,
            triggerType,
            triggeredBy,
            checksumSha256,
          },
          ...snapshot,
        },
        null,
        2
      );

      const fileName = `Backup_Transaksi_Dana_Kematian_${backupDate || 'harian'}_${backupId}.json`;

      // 1. Archive JSON file on server tmp storage
      let serverFileSaved = false;
      try {
        fs.mkdirSync(BACKUP_ARCHIVE_DIR, { recursive: true });
        fs.writeFileSync(path.join(BACKUP_ARCHIVE_DIR, fileName), fullBackupJson, 'utf8');
        serverFileSaved = true;
      } catch (fsErr) {
        console.warn('Server local backup archive skipped:', fsErr instanceof Error ? fsErr.message : fsErr);
      }

      // 2. Forward JSON payload to optional HTTPS Cloud/Email Webhook (e.g. Google Apps Script)
      let webhookDispatched = false;
      let webhookError = '';
      const cleanWebhook = (webhookUrl || '').trim();
      if (cleanWebhook && /^https?:\/\//i.test(cleanWebhook)) {
        try {
          const hookRes = await withTimeout(
            fetch(cleanWebhook, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(checksumSha256 ? { 'X-Backup-Checksum': checksumSha256 } : {}),
              },
              body: fullBackupJson,
            }),
            15000,
            'backup-webhook'
          );
          if (hookRes.ok) {
            webhookDispatched = true;
          } else {
            webhookError = `Webhook merespons HTTP ${hookRes.status}`;
          }
        } catch (hookErr) {
          webhookError = hookErr instanceof Error ? hookErr.message : 'Webhook timeout/error';
        }
      }

      // 3. Deliver Email with .json attachment via Resend API or SMTP if configured
      let emailDispatched = false;
      let emailDispatchChannel: 'smtp_server' | 'resend_api' | 'webhook' | 'none' = 'none';
      let emailStatusNote = '';

      const targetEmail = (adminEmail || '').trim();
      const summary = (snapshot.summary || {}) as {
        paymentCount?: number;
        verifiedPaymentCount?: number;
        totalVerifiedAmount?: number;
        claimCount?: number;
        totalClaimAmount?: number;
      };

      if (wantsEmailDelivery) {
        const resendKey = (process.env.RESEND_API_KEY || '').trim();
        const smtpHost = (process.env.SMTP_HOST || '').trim();
        const smtpUser = (process.env.SMTP_USER || '').trim();
        const smtpPass = (process.env.SMTP_PASS || '').trim();

        const emailSubject = `[Backup JSON 00:00 WIB] ${snapshot.organizationName || 'Paguyuban Dana Kematian'} (${backupDate || '-'})`;
        const emailText =
          `Salinan Backup Transaksi Harian (Format JSON)\n` +
          `Tanggal Backup: ${backupDate || '-'}\n` +
          `Waktu Pembuatan: ${createdAt || '-'}\n` +
          `Jenis Pemicu: ${triggerType === 'scheduled_00_00' ? 'Otomatis Jam 00:00 WIB' : 'Manual Admin'}\n` +
          `Checksum SHA-256: ${checksumSha256 || '-'}\n\n` +
          `Ringkasan Transaksi:\n` +
          `- Total Transaksi Iuran: ${summary.paymentCount ?? 0} (${summary.verifiedPaymentCount ?? 0} Terverifikasi)\n` +
          `- Total Nominal Iuran Terverifikasi: Rp ${Number(summary.totalVerifiedAmount || 0).toLocaleString('id-ID')}\n` +
          `- Total Klaim Santunan: ${summary.claimCount ?? 0} (Rp ${Number(summary.totalClaimAmount || 0).toLocaleString('id-ID')})\n\n` +
          `File salinan JSON terlampir pada email ini (${fileName}).`;

        if (!targetEmail || !targetEmail.includes('@')) {
          emailStatusNote = 'Alamat email admin belum diisi dengan format yang valid.';
        } else if (resendKey) {
          try {
            const fromEmail =
              (process.env.RESEND_FROM_EMAIL || '').trim() || 'onboarding@resend.dev';
            const resendResp = await withTimeout(
              fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: fromEmail,
                  to: [targetEmail],
                  subject: emailSubject,
                  text: emailText,
                  attachments: [
                    {
                      filename: fileName,
                      content: Buffer.from(fullBackupJson, 'utf8').toString('base64'),
                    },
                  ],
                }),
              }),
              15000,
              'resend-email'
            );
            if (resendResp.ok) {
              emailDispatched = true;
              emailDispatchChannel = 'resend_api';
              emailStatusNote = `Email lampiran JSON berhasil dikirim ke ${targetEmail} via Resend API.`;
            } else {
              const resendErr = await resendResp.text().catch(() => '');
              emailStatusNote = `Pengiriman Resend gagal (HTTP ${resendResp.status}): ${resendErr.slice(0, 120)}`;
            }
          } catch (mailErr) {
            emailStatusNote =
              mailErr instanceof Error ? `Gagal kirim via Resend: ${mailErr.message}` : 'Gagal kirim via Resend.';
          }
        } else if (smtpHost && smtpUser && smtpPass) {
          try {
            const port = Number(process.env.SMTP_PORT || 465);
            const secure = (process.env.SMTP_SECURE || (port === 465 ? 'true' : 'false')) === 'true';
            const transporter = nodemailer.createTransport({
              host: smtpHost,
              port,
              secure,
              auth: {
                user: smtpUser,
                pass: smtpPass,
              },
            });
            await withTimeout(
              transporter.sendMail({
                from: (process.env.SMTP_FROM || '').trim() || smtpUser,
                to: targetEmail,
                subject: emailSubject,
                text: emailText,
                attachments: [
                  {
                    filename: fileName,
                    content: fullBackupJson,
                    contentType: 'application/json',
                  },
                ],
              }),
              15000,
              'smtp-email'
            );
            emailDispatched = true;
            emailDispatchChannel = 'smtp_server';
            emailStatusNote = `Email lampiran JSON berhasil dikirim ke ${targetEmail} via SMTP.`;
          } catch (smtpErr) {
            emailStatusNote =
              smtpErr instanceof Error ? `Gagal kirim via SMTP: ${smtpErr.message}` : 'Gagal kirim via SMTP.';
          }
        } else if (webhookDispatched) {
          emailDispatched = true;
          emailDispatchChannel = 'webhook';
          emailStatusNote = `Salinan JSON diteruskan ke Webhook Cloud/Email (${cleanWebhook}).`;
        } else {
          emailStatusNote = webhookError
            ? `Webhook gagal (${webhookError}). Email SMTP/Resend belum dikonfigurasi di Secrets.`
            : 'Salinan aman tersimpan di Cloud Firestore. Untuk kirim email otomatis penuh, tambahkan Secrets SMTP/Resend atau isi URL Webhook Cloud/Apps Script.';
        }
      } else if (webhookDispatched) {
        emailDispatchChannel = 'webhook';
        emailStatusNote = `Webhook Cloud/Email berhasil menerima salinan JSON.`;
      }

      res.status(200).json({
        ok: true,
        serverFileSaved,
        webhookDispatched,
        emailDispatched,
        emailDispatchChannel,
        emailStatusNote,
      });
    } catch (error) {
      console.error('Backup dispatch error:', error);
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Gagal memproses pengiriman backup.',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    const rootDir = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : __dirname;

    app.use(
      express.static(rootDir, {
        index: 'index.html',
        setHeaders: (res: Response, filePath: string) => {
          const ext = path.extname(filePath).toLowerCase();
          if (ext === '.html' || ext === '.htm' || path.basename(filePath) === 'sw.js') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.get('*', (req: Request, res: Response) => {
      if (path.extname(req.path)) {
        res.status(404).send('Not Found');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(rootDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
