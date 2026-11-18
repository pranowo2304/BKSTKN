import { Dependent } from '../types';

export interface ExtractedKkFamilyMember {
  name: string;
  nik?: string;
  relationship: string;
  birthDate?: string;
  age?: number;
}

export interface ExtractedKkResult {
  isValidKartuKeluarga: boolean;
  familyCardNumber: string;
  headOfFamilyName: string;
  headOfFamilyNik: string;
  address: string;
  rtRw: string;
  familyMembers: ExtractedKkFamilyMember[];
  confidenceNote: string;
}

async function resolveSourceToDataUrl(sourceUrl: string): Promise<string> {
  const trimmed = (sourceUrl || '').trim();
  if (!trimmed) {
    throw new Error('Berkas Kartu Keluarga kosong.');
  }
  if (trimmed.startsWith('data:') || trimmed.startsWith('<svg')) {
    return trimmed;
  }

  // Handle http(s), relative /assets/..., or blob URLs (e.g., when re-scanning stored KK)
  const resp = await fetch(trimmed);
  if (!resp.ok) {
    throw new Error('Gagal mengunduh berkas Kartu Keluarga yang tersimpan untuk dipindai ulang.');
  }
  const blob = await resp.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal mengonversi berkas Kartu Keluarga untuk deteksi otomatis.'));
    reader.readAsDataURL(blob);
  });
}

export async function extractFamilyCardData(
  dataUrl: string,
  fileName?: string
): Promise<ExtractedKkResult> {
  const resolvedDataUrl = await resolveSourceToDataUrl(dataUrl);

  let lastErrorMsg =
    'Gagal membaca isi dokumen Kartu Keluarga secara otomatis. Silakan isi data secara manual.';

  // Up to 2 client attempts (server already retries & falls back across models)
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch('/api/kk/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataUrl: resolvedDataUrl, fileName }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.success) {
        return payload.data as ExtractedKkResult;
      }

      lastErrorMsg = payload?.error || lastErrorMsg;
      const isTransientStatus =
        response.status === 502 || response.status === 503 || response.status === 504;
      if (!isTransientStatus || attempt === 1) {
        const fatalErr = new Error(lastErrorMsg);
        (fatalErr as Error & { noRetry?: boolean }).noRetry = true;
        throw fatalErr;
      }
      await new Promise((r) => setTimeout(r, 900));
    } catch (err: unknown) {
      const noRetry = Boolean((err as Error & { noRetry?: boolean })?.noRetry);
      if (noRetry) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastErrorMsg =
          'Koneksi ke layanan pembacaan KK melampaui batas waktu. Silakan klik "Coba Deteksi Lagi".';
      } else if (err instanceof Error) {
        lastErrorMsg = err.message || lastErrorMsg;
      }
      if (attempt === 1) {
        throw new Error(lastErrorMsg);
      }
      await new Promise((r) => setTimeout(r, 700));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(lastErrorMsg);
}

/**
 * Normalizes a detected relationship string to match the options expected by a form selector.
 */
export function mapExtractedRelationship(
  relationship: string,
  allowedSet: 'landing' | 'admin' | 'edit' = 'edit'
): string {
  const rel = (relationship || '').toLowerCase();

  if (rel.includes('istri') || rel.includes('suami')) {
    return 'Suami/Istri';
  }
  if (rel.includes('anak')) {
    return allowedSet === 'admin' ? 'Anak' : 'Anak Kandung';
  }
  if (rel.includes('mertua')) {
    return allowedSet === 'admin' ? 'Orang Tua' : 'Mertua';
  }
  if (rel.includes('orang tua') || rel.includes('orangtua')) {
    return 'Orang Tua';
  }
  if (rel.includes('saudara')) {
    return allowedSet === 'edit' ? 'Saudara Kandung' : allowedSet === 'admin' ? 'Lainnya' : 'Orang Tua';
  }
  return allowedSet === 'landing' ? 'Anak Kandung' : 'Lainnya';
}

/**
 * Merges extracted KK family members (excluding Kepala Keluarga) into an existing dependents array
 * without duplicating names already entered by the user.
 */
export function mergeExtractedDependents(
  existingDependents: Dependent[],
  extractedMembers: ExtractedKkFamilyMember[],
  headOfFamilyName?: string,
  allowedSet: 'landing' | 'admin' | 'edit' = 'edit'
): { merged: Dependent[]; addedCount: number } {
  const normalizedHead = (headOfFamilyName || '').trim().toLowerCase();
  const seenNames = new Set(
    existingDependents.map((d) => d.name.trim().toLowerCase()).filter(Boolean)
  );

  const newlyAdded: Dependent[] = [];

  for (const member of extractedMembers) {
    const cleanName = (member.name || '').trim();
    if (!cleanName) continue;

    const relLower = (member.relationship || '').toLowerCase();
    const normName = cleanName.toLowerCase();

    // Skip the Head of Family because the Head of Family is the primary applicant
    if (relLower.includes('kepala')) continue;
    if (normalizedHead && normName === normalizedHead && relLower === '') continue;
    if (seenNames.has(normName)) continue;

    seenNames.add(normName);
    newlyAdded.push({
      id: `dep_kk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      relationship: mapExtractedRelationship(member.relationship, allowedSet),
      age: typeof member.age === 'number' && member.age >= 0 && member.age <= 120 ? member.age : undefined,
    });
  }

  return {
    merged: [...existingDependents, ...newlyAdded],
    addedCount: newlyAdded.length,
  };
}
