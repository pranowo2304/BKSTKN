import { Member } from '../types';

export interface DuplicateValidationResult {
  isDuplicate: boolean;
  duplicateField?: 'nik' | 'familyCardNumber';
  duplicateMember?: Member;
  message?: string;
}

/**
 * Normalizes an identity number (NIK or No KK) by removing spaces, dashes, dots, and non-alphanumeric characters.
 */
export function normalizeIdNumber(val?: string | null): string {
  if (!val) return '';
  return val.trim().replace(/[\s.\-_]/g, '');
}

/**
 * Checks if a NIK is already registered by another member in the database.
 */
export function findDuplicateNikMember(
  members: Member[],
  nik?: string | null,
  excludeMemberId?: string | null
): Member | undefined {
  const cleanNik = normalizeIdNumber(nik);
  if (!cleanNik || cleanNik.length < 5) return undefined;

  return members.find((m) => {
    if (excludeMemberId && m.id === excludeMemberId) return false;
    return normalizeIdNumber(m.nik) === cleanNik;
  });
}

/**
 * Checks if a Nomor Kartu Keluarga (KK) is already registered by another member in the database.
 */
export function findDuplicateKkMember(
  members: Member[],
  familyCardNumber?: string | null,
  excludeMemberId?: string | null
): Member | undefined {
  const cleanKk = normalizeIdNumber(familyCardNumber);
  if (!cleanKk || cleanKk.length < 5) return undefined;

  return members.find((m) => {
    if (excludeMemberId && m.id === excludeMemberId) return false;
    return normalizeIdNumber(m.familyCardNumber) === cleanKk;
  });
}

/**
 * Comprehensive check for duplicate NIK or Nomor Kartu Keluarga (KK).
 * @param members The current array of members from state/database
 * @param nik The NIK being submitted or validated
 * @param familyCardNumber The Nomor KK being submitted or validated
 * @param excludeMemberId Optional member ID to exclude (when editing existing member)
 */
export function checkDuplicateMember(
  members: Member[],
  nik?: string | null,
  familyCardNumber?: string | null,
  excludeMemberId?: string | null
): DuplicateValidationResult {
  // 1. Check NIK duplicate
  const dupNikMember = findDuplicateNikMember(members, nik, excludeMemberId);
  if (dupNikMember) {
    const cleanNik = normalizeIdNumber(nik);
    return {
      isDuplicate: true,
      duplicateField: 'nik',
      duplicateMember: dupNikMember,
      message: `DATA DOUBLE NIK DITOLAK: NIK "${cleanNik}" sudah terdaftar dalam sistem atas nama warga "${dupNikMember.name}" (${dupNikMember.cluster || 'Cluster RT'}, No. Anggota: ${dupNikMember.memberNumber || '-'}). Satu NIK KTP hanya boleh terdaftar satu kali.`,
    };
  }

  // 2. Check Nomor KK duplicate
  const dupKkMember = findDuplicateKkMember(members, familyCardNumber, excludeMemberId);
  if (dupKkMember) {
    const cleanKk = normalizeIdNumber(familyCardNumber);
    return {
      isDuplicate: true,
      duplicateField: 'familyCardNumber',
      duplicateMember: dupKkMember,
      message: `DATA DOUBLE NOMOR KK DITOLAK: Nomor Kartu Keluarga "${cleanKk}" sudah terdaftar dalam sistem atas nama Kepala Keluarga "${dupKkMember.name}" (${dupKkMember.cluster || 'Cluster RT'}, No. Anggota: ${dupKkMember.memberNumber || '-'}). Satu Nomor KK hanya boleh terdaftar satu kali untuk satu rumah tangga.`,
    };
  }

  return { isDuplicate: false };
}
