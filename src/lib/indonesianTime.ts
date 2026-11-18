/**
 * Indonesian Local Time Utilities (WIB / Asia/Jakarta, UTC+7)
 * Ensures stored payment & verification timestamps always match Indonesian local time
 * instead of UTC (Date.prototype.toISOString()).
 */

export const INDONESIA_TIMEZONE = 'Asia/Jakarta';

/**
 * Formats a Date (or current time) into "YYYY-MM-DD HH:mm:ss" in Indonesian local time (WIB / Asia/Jakarta).
 * Preserves lexicographical sorting and compatibility with `.split(' ')[0]` date extraction.
 */
export function getIndonesiaTimestamp(date: Date = new Date()): string {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: INDONESIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(safeDate);

    const map: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') {
        map[p.type] = p.value;
      }
    });

    const hour = map.hour === '24' ? '00' : map.hour || '00';
    if (map.year && map.month && map.day) {
      return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute || '00'}:${map.second || '00'}`;
    }
  } catch {
    // Fallback below if Intl timeZone is unavailable
  }

  // Exact UTC+7 fallback (Asia/Jakarta has no DST)
  const wibDate = new Date(safeDate.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wibDate.getUTCFullYear()}-${pad(wibDate.getUTCMonth() + 1)}-${pad(
    wibDate.getUTCDate()
  )} ${pad(wibDate.getUTCHours())}:${pad(wibDate.getUTCMinutes())}:${pad(
    wibDate.getUTCSeconds()
  )}`;
}

/**
 * Returns "YYYY-MM-DD" in Indonesian local time (WIB / Asia/Jakarta).
 */
export function getIndonesiaDateString(date: Date = new Date()): string {
  return getIndonesiaTimestamp(date).slice(0, 10);
}

/**
 * Normalizes a timestamp input to Indonesian local time ("YYYY-MM-DD HH:mm:ss") if it's a UTC ISO string,
 * or keeps it if already formatted in local WIB time.
 */
export function normalizeToIndonesiaTimestamp(rawDateStr?: string | null): string {
  if (!rawDateStr || typeof rawDateStr !== 'string' || !rawDateStr.trim()) {
    return getIndonesiaTimestamp();
  }
  const trimmed = rawDateStr.trim();
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return getIndonesiaTimestamp(parsed);
    }
  }
  return trimmed.replace(/\s+WIB$/i, '').trim();
}

/**
 * Parses stored date/time strings assuming Indonesian local time (WIB, +07:00)
 * whenever no explicit timezone offset ("Z" or "+HH:MM") is present.
 */
export function parseIndonesiaTimestamp(rawDateStr?: string | null): Date | null {
  if (!rawDateStr || typeof rawDateStr !== 'string') return null;
  const trimmed = rawDateStr.trim();
  if (!trimmed) return null;

  const withoutWib = trimmed.replace(/\s+WIB$/i, '').trim();

  // Preserve explicit timezone offsets if present (e.g. legacy UTC ISO strings)
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(withoutWib);
  if (hasExplicitTz) {
    const normalized =
      withoutWib.includes(' ') && !withoutWib.includes('T')
        ? withoutWib.replace(' ', 'T')
        : withoutWib;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }

  // Interpret "YYYY-MM-DD HH:mm[:ss]" as WIB (+07:00)
  const dtMatch = withoutWib.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/);
  if (dtMatch) {
    const timePart = dtMatch[2].length === 5 ? `${dtMatch[2]}:00` : dtMatch[2];
    const d = new Date(`${dtMatch[1]}T${timePart}+07:00`);
    if (!isNaN(d.getTime())) return d;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(withoutWib)) {
    const d = new Date(`${withoutWib}T00:00:00+07:00`);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(withoutWib);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Formats a stored timestamp (either WIB "YYYY-MM-DD HH:mm:ss" or legacy UTC ISO "...Z")
 * for clean display in Indonesian local time, optionally appending " WIB".
 */
export function formatStoredPaymentDateTime(
  rawDateStr?: string | null,
  withZoneLabel: boolean = false
): string {
  if (!rawDateStr || typeof rawDateStr !== 'string') return '-';
  const trimmed = rawDateStr.trim();
  if (!trimmed) return '-';

  let display = trimmed;
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      display = getIndonesiaTimestamp(parsed);
    }
  }

  if (withZoneLabel && /\d{2}:\d{2}/.test(display) && !/\b(WIB|WITA|WIT)\b/i.test(display)) {
    return `${display} WIB`;
  }
  return display;
}
