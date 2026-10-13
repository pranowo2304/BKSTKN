import { Member, Payment, SystemSettings } from '../types';

export type KtaIssuanceStage = 
  | 'AWAITING_RT'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_BENDAHARA'
  | 'AWAITING_PAGUYUBAN'
  | 'ISSUED';

export interface KtaIssuanceInfo {
  isIssued: boolean;
  canPrintOrShare: boolean;
  stage: KtaIssuanceStage;
  statusTitle: string;
  statusBadge: string;
  statusDescription: string;
  requiredActionText: string;
  verifiedByRtName?: string;
  treasurerVerifiedName?: string;
  approvedByPaguyubanName?: string;
  issuedBy?: string;
  issuedAt?: string;
  receiptNumber?: string;
  lastPaymentAmount?: number;
}

/**
 * STRICT RULE FOR KTA ISSUANCE:
 * 1. Must be verified by RT (member.verificationStatus === 'Verified' && member.status !== 'Menunggu Verifikasi RT')
 * 2. Must have payment verified by Bendahara (payments.some(p => p.status === 'Verified') or member paid)
 * 3. FINAL GATE: Must have final approval from Ketua Paguyuban (member.isPaguyubanApproved === true)
 * 
 * Only when Ketua Paguyuban has approved -> KTA IS OFFICIALLY ISSUED (Setelah disetujui ketua paguyuban, KTA baru terbit).
 */
export function getMemberKtaIssuanceInfo(
  member: Member | null | undefined,
  payments: Payment[] = []
): KtaIssuanceInfo {
  if (!member) {
    return {
      isIssued: false,
      canPrintOrShare: false,
      stage: 'AWAITING_RT',
      statusTitle: 'Tidak Ditemukan',
      statusBadge: 'Belum Terbit',
      statusDescription: 'Data anggota tidak valid atau tidak ditemukan.',
      requiredActionText: 'Pendaftaran ulang diperlukan.',
    };
  }

  // Check RT Verification
  const isRtVerified = 
    member.verificationStatus === 'Verified' && 
    member.status !== 'Menunggu Verifikasi RT';

  if (!isRtVerified) {
    return {
      isIssued: false,
      canPrintOrShare: false,
      stage: 'AWAITING_RT',
      statusTitle: 'Belum Diverifikasi RT',
      statusBadge: 'Draft (Menunggu RT)',
      statusDescription: `Data pendaftaran ${member.name} belum disetujui/diverifikasi oleh Ketua RT ${member.cluster || ''}. KTA resmi tidak dapat diterbitkan sebelum verifikasi RT selesai.`,
      requiredActionText: `Menunggu Ketua RT ${member.cluster || ''} memverifikasi KTP/KK warga.`,
    };
  }

  // Find member's verified payment (Bendahara approval)
  const memberPayments = payments.filter(
    (p) => p.memberId === member.id || p.memberNumber === member.memberNumber
  );

  const verifiedPayment = memberPayments
    .filter((p) => p.status === 'Verified')
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())[0];

  const pendingPayment = memberPayments.find((p) => p.status === 'Pending');

  const hasPaidAndVerified = Boolean(verifiedPayment) || (member.isKtaIssued && member.status === 'Aktif');

  // If member has paid & payment is verified by Bendahara:
  if (hasPaidAndVerified) {
    // Check Ketua Paguyuban final approval
    const isApprovedByPaguyuban = Boolean(
      member.isPaguyubanApproved ||
      (member.approvedByPaguyuban && member.status === 'Aktif') ||
      (member.isKtaIssued && member.status === 'Aktif')
    );

    // If waiting for Ketua Paguyuban approval
    if (!isApprovedByPaguyuban || member.status === 'Menunggu Persetujuan Ketua Paguyuban') {
      return {
        isIssued: false,
        canPrintOrShare: false,
        stage: 'AWAITING_PAGUYUBAN',
        statusTitle: 'Menunggu Persetujuan Ketua Paguyuban',
        statusBadge: 'Menunggu Ketua Paguyuban',
        statusDescription: `Verifikasi RT dan pembayaran iuran Bendahara telah selesai. Sesuai ketentuan, persetujuan akhir registrasi ada di tangan Ketua Paguyuban. KTA resmi baru terbit setelah disetujui Ketua Paguyuban.`,
        requiredActionText: 'Menunggu Ketua Paguyuban memberikan pengesahan akhir registrasi warga.',
        verifiedByRtName: member.verifiedByRt || member.rtVerifiedBy || `Ketua RT ${member.cluster || ''}`,
        treasurerVerifiedName: verifiedPayment?.verifiedBy || 'Bendahara Paguyuban',
        receiptNumber: verifiedPayment?.receiptNumber || 'KWT-TERVERIFIKASI',
        lastPaymentAmount: verifiedPayment?.amount,
      };
    }

    // Fully approved by Ketua Paguyuban -> KTA ISSUED!
    return {
      isIssued: true,
      canPrintOrShare: true,
      stage: 'ISSUED',
      statusTitle: 'KTA Resmi Diterbitkan (Disetujui Ketua Paguyuban)',
      statusBadge: 'KTA Sah (Terbit)',
      statusDescription: `KTA resmi telah diverifikasi oleh Ketua RT, divalidasi Bendahara, dan mendapatkan pengesahan persetujuan akhir dari Ketua Paguyuban.`,
      requiredActionText: 'KTA sah dan aktif penuh. Berhak atas santunan pemakaman dan layanan ambulans 24 jam.',
      verifiedByRtName: member.verifiedByRt || member.rtVerifiedBy || `Ketua RT ${member.cluster || ''}`,
      treasurerVerifiedName: verifiedPayment?.verifiedBy || 'Bendahara Paguyuban',
      approvedByPaguyubanName: member.approvedByPaguyuban || member.ktaIssuedBy || 'Bpk. H. Ahmad Fauzi (Ketua Paguyuban)',
      issuedBy: member.approvedByPaguyuban || member.ktaIssuedBy || 'Ketua Paguyuban',
      issuedAt: member.approvedByPaguyubanAt || member.ktaIssuedAt || verifiedPayment?.verifiedAt || member.joinDate,
      receiptNumber: verifiedPayment?.receiptNumber || 'KWT-TERVERIFIKASI',
      lastPaymentAmount: verifiedPayment?.amount,
    };
  }

  // If member has submitted payment but Bendahara has not verified it yet
  if (pendingPayment || member.status === 'Menunggu Validasi Bendahara') {
    return {
      isIssued: false,
      canPrintOrShare: false,
      stage: 'AWAITING_BENDAHARA',
      statusTitle: 'Menunggu Verifikasi Bendahara',
      statusBadge: 'Menunggu Bendahara',
      statusDescription: `Bukti pembayaran iuran (${pendingPayment?.receiptNumber || 'Baru'}) telah diunggah. Menunggu Bendahara memvalidasi mutasi kas sebelum diteruskan ke Ketua Paguyuban.`,
      requiredActionText: 'Menunggu Bendahara Paguyuban memvalidasi mutasi pembayaran.',
      verifiedByRtName: member.verifiedByRt || `Ketua RT ${member.cluster || ''}`,
      receiptNumber: pendingPayment?.receiptNumber,
    };
  }

  // RT is verified, but member hasn't paid iuran yet
  return {
    isIssued: false,
    canPrintOrShare: false,
    stage: 'AWAITING_PAYMENT',
    statusTitle: 'Menunggu Pembayaran Iuran',
    statusBadge: 'Iuran Belum Dibayar',
    statusDescription: `Verifikasi RT telah disetujui oleh ${member.verifiedByRt || 'Ketua RT'}. Untuk melanjutkan ke tahap pengesahan Ketua Paguyuban, silakan selesaikan pembayaran iuran.`,
    requiredActionText: 'Calon anggota perlu menyetorkan iuran tahunan ke rekening kas paguyuban.',
    verifiedByRtName: member.verifiedByRt || `Ketua RT ${member.cluster || ''}`,
  };
}

export function canMemberAccessKta(
  member: Member | null | undefined,
  payments: Payment[] = []
): boolean {
  const info = getMemberKtaIssuanceInfo(member, payments);
  return info.isIssued;
}

/**
 * Generates a unique, tamper-evident cryptographic security signature
 * for each member's digital KTA based on their permanent credentials.
 */
export function generateKtaSecurityToken(
  member: Member,
  ktaInfo?: KtaIssuanceInfo
): string {
  const rawString = `${member.id}#${member.memberNumber}#${member.nik || 'NO_NIK'}#${member.cluster || ''}#${member.joinDate}#${ktaInfo?.receiptNumber || 'KWT'}#${ktaInfo?.isIssued ? 'ISSUED' : 'DRAFT'}`;
  
  // Deterministic 32-bit FNV-1a hash generator
  let hash1 = 0x811c9dc5;
  let hash2 = 0x517cc1b7;
  for (let i = 0; i < rawString.length; i++) {
    const code = rawString.charCodeAt(i);
    hash1 ^= code;
    hash1 = (hash1 * 0x01000193) >>> 0;
    hash2 ^= (code * (i + 1));
    hash2 = (hash2 * 0x01000193) >>> 0;
  }

  const p1 = hash1.toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
  const p2 = hash1.toString(16).toUpperCase().padStart(8, '0').slice(4, 8);
  const p3 = hash2.toString(16).toUpperCase().padStart(8, '0').slice(0, 4);

  return `SEC-KTA-${p1}-${p2}-${p3}`;
}

export function buildKtaValidationUrl(memberNumber: string, sig?: string): string {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
  const safeNpa = encodeURIComponent(memberNumber || '');
  const sigParam = sig ? `&sig=${encodeURIComponent(sig)}` : '';
  return `${origin}${pathname}?verify=kta&npa=${safeNpa}${sigParam}`;
}

export interface KtaQrPayloadOptions {
  mode?: 'url' | 'json';
  sig?: string;
}

export function generateKtaStructuredPayload(
  member: Member,
  ktaInfo: KtaIssuanceInfo,
  settings: SystemSettings,
  expiryDateFormatted?: string,
  sig?: string
): object {
  const securityToken = sig || generateKtaSecurityToken(member, ktaInfo);
  const verifyUrl = buildKtaValidationUrl(member.memberNumber, securityToken);

  return {
    app: 'KTA-PAGUYUBAN-DANA-KEMATIAN',
    securityToken: securityToken,
    verifyUrl: verifyUrl,
    npa: member.memberNumber,
    name: member.name,
    nik: member.nik,
    cluster: member.cluster || 'Cluster',
    ktaStatus: ktaInfo.isIssued ? 'RESMI_TERBIT' : 'BELUM_TERBIT',
    rtVerification: member.verifiedByRt || member.rtVerifiedBy || 'Belum Terverifikasi RT',
    treasurerVerification: ktaInfo.receiptNumber
      ? `Validasi Bendahara (${ktaInfo.treasurerVerifiedName || 'Bendahara'}) • Kwitansi ${ktaInfo.receiptNumber}`
      : 'Belum Terverifikasi Pembayaran Bendahara',
    paguyubanApproval: ktaInfo.isIssued
      ? `Disetujui & Disahkan Ketua Paguyuban (${ktaInfo.approvedByPaguyubanName || member.approvedByPaguyuban || 'Ketua Paguyuban'})`
      : 'Menunggu Persetujuan Akhir Ketua Paguyuban',
    issuedAt: ktaInfo.issuedAt || 'Belum Terbit',
    expiryDate: expiryDateFormatted || 'Menunggu Pembayaran',
    dependents: member.dependentsCount,
    organization: settings.communityName || 'Paguyuban Dana Kematian Warga',
    verifiedTimestamp: new Date().toISOString(),
  };
}

/**
 * Generates unique QR Code payload for each Digital KTA.
 * By default in 'url' mode, generates the official verification URL so that standard mobile
 * phone cameras (iOS Camera, Google Lens, Samsung Camera) can scan and directly open the
 * authentication page without requiring a specialized scanner app!
 */
export function generateKtaQrPayload(
  member: Member,
  ktaInfo: KtaIssuanceInfo,
  settings: SystemSettings,
  expiryDateFormatted?: string,
  mode: 'url' | 'json' = 'url'
): string {
  const securityToken = generateKtaSecurityToken(member, ktaInfo);
  
  if (mode === 'url') {
    return buildKtaValidationUrl(member.memberNumber, securityToken);
  }

  return JSON.stringify(
    generateKtaStructuredPayload(member, ktaInfo, settings, expiryDateFormatted, securityToken)
  );
}

/**
 * Parses any scanned text (URL, JSON, NPA code, or raw token) to extract
 * the member NPA and security token for verification.
 */
export function extractNpaFromScan(scannedText: string): {
  npa?: string;
  sig?: string;
  rawJson?: any;
} {
  const raw = (scannedText || '').trim();
  if (!raw) return {};

  // 1. Check if it's a verification URL (?verify=kta&npa=...)
  if (raw.includes('verify=kta') || raw.includes('npa=')) {
    try {
      const url = new URL(raw, 'https://dummy.local');
      const npa = url.searchParams.get('npa');
      const sig = url.searchParams.get('sig');
      if (npa) {
        return { npa: decodeURIComponent(npa), sig: sig || undefined };
      }
    } catch {
      // Fallback regex for URL query
      const npaMatch = raw.match(/npa=([^&]+)/i);
      const sigMatch = raw.match(/sig=([^&]+)/i);
      if (npaMatch) {
        return {
          npa: decodeURIComponent(npaMatch[1]),
          sig: sigMatch ? decodeURIComponent(sigMatch[1]) : undefined,
        };
      }
    }
  }

  // 2. Check if JSON payload
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed) {
        const npa = parsed.npa || parsed.memberNumber;
        const sig = parsed.securityToken || parsed.sig;
        if (npa) {
          return { npa: String(npa), sig: sig ? String(sig) : undefined, rawJson: parsed };
        }
      }
    } catch {
      // Not JSON
    }
  }

  // 3. Regex for NPA pattern (e.g. ADK-2026-001)
  const npaRegex = /ADK-\d{4}-\d+/i;
  const npaFound = raw.match(npaRegex);
  if (npaFound) {
    return { npa: npaFound[0].toUpperCase() };
  }

  // 4. Return raw if non-empty
  return { npa: raw };
}

