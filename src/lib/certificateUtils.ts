import { Member, Payment, SystemSettings } from '../types';
import { getMemberKtaIssuanceInfo, KtaIssuanceInfo } from './ktaUtils';

export interface CertificateInfo {
  certificateNumber: string;
  isIssued: boolean;
  issueDate: string;
  expiryDate: string;
  approvedByPaguyuban: string;
  verifiedByRt: string;
  verifiedByTreasurer: string;
  statusBadge: string;
  statusTitle: string;
  statusDescription: string;
  receiptNumber?: string;
}

/**
 * Format official Certificate Registration Number:
 * Format: SK-PDK/{YEAR}/{CLUSTER_CODE}/{MEMBER_NUMBER}
 * Example: SK-PDK/2026/FL-01/004
 */
export function generateCertificateNumber(
  member: Member | null | undefined,
  year?: number
): string {
  if (!member) return 'SK-PDK/REG/DRAFT';
  const issueYear = year || new Date().getFullYear();
  const rawCluster = (member.cluster || 'UMUM').replace(/\s+/g, '-').toUpperCase();
  const cleanNumber = (member.memberNumber || '000').replace(/[^0-9]/g, '').slice(-4) || '001';
  return `SK-PDK/${issueYear}/${rawCluster}/${cleanNumber}`;
}

/**
 * Certificate issuance follows the EXACT SAME 3-step rule as KTA:
 * 1. RT Verification
 * 2. Treasurer Payment Verification
 * 3. Ketua Paguyuban Final Approval
 */
export function getMemberCertificateInfo(
  member: Member | null | undefined,
  payments: Payment[] = [],
  settings?: SystemSettings
): CertificateInfo {
  const ktaInfo: KtaIssuanceInfo = getMemberKtaIssuanceInfo(member, payments);
  const certNumber = generateCertificateNumber(member, new Date().getFullYear());

  const issueDateFormatted = ktaInfo.issuedAt 
    ? new Date(ktaInfo.issuedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

  return {
    certificateNumber: certNumber,
    isIssued: ktaInfo.isIssued,
    issueDate: issueDateFormatted,
    expiryDate: '1 Tahun Masa Perlindungan Aktif',
    approvedByPaguyuban: ktaInfo.approvedByPaguyubanName || settings?.defaultAdminSignerName || 'Ketua Paguyuban',
    verifiedByRt: ktaInfo.verifiedByRtName || `Ketua RT ${member?.cluster || ''}`,
    verifiedByTreasurer: ktaInfo.treasurerVerifiedName || settings?.treasurerName || 'Bendahara Paguyuban',
    statusBadge: ktaInfo.statusBadge,
    statusTitle: ktaInfo.statusTitle,
    statusDescription: ktaInfo.statusDescription,
    receiptNumber: ktaInfo.receiptNumber,
  };
}
