import { Member, Payment, MemberStatusHistoryItem, MemberStatus } from '../types';
import { formatIDR } from './storage';

/**
 * Returns the standard progression index of a member's status for auditing.
 */
export const getStatusStageOrder = (stage: MemberStatusHistoryItem['stage']): number => {
  switch (stage) {
    case 'registered':
      return 1;
    case 'rt_verified':
      return 2;
    case 'payment_submitted':
      return 3;
    case 'payment_validated':
      return 3;
    case 'paguyuban_approved':
      return 4;
    case 'active':
      return 5;
    case 'deceased':
      return 6;
    case 'inactive':
      return 6;
    case 'rejected':
      return 2;
    default:
      return 0;
  }
};

/**
 * Generates a comprehensive, chronological status change timeline for audit purposes.
 * Incorporates any custom logged history on the member object and backfills standard
 * lifecycle stages from member metadata and associated payment records.
 */
export const getMemberStatusTimeline = (
  member: Member,
  payments: Payment[] = []
): MemberStatusHistoryItem[] => {
  if (!member) return [];

  // Filter payments associated with this member
  const memberPayments = payments.filter(
    (p) => p.memberId === member.id || p.memberNumber === member.memberNumber
  );
  const verifiedPayment = memberPayments.find((p) => p.status === 'Verified');
  const pendingPayment = memberPayments.find((p) => p.status === 'Pending');

  const isRtVerified =
    member.verificationStatus === 'Verified' ||
    Boolean(member.rtVerifiedBy) ||
    Boolean(member.verifiedByRt) ||
    member.status === 'Menunggu Pembayaran' ||
    member.status === 'Menunggu Validasi Bendahara' ||
    member.status === 'Aktif' ||
    member.status === 'Meninggal';

  const isRejected =
    member.status === 'Ditolak' || member.verificationStatus === 'Rejected';

  const isPaymentDone =
    Boolean(verifiedPayment) ||
    member.status === 'Aktif' ||
    member.status === 'Meninggal' ||
    Boolean(member.isKtaIssued);

  const isActive = member.status === 'Aktif';
  const isDeceased = member.status === 'Meninggal';
  const isInactive = member.status === 'Non-Aktif';

  // If member already has explicit statusHistory entries, use them as base
  const existingHistory = Array.isArray(member.statusHistory) ? [...member.statusHistory] : [];

  // Stage 1: Registration
  const regItem: MemberStatusHistoryItem = {
    id: `${member.id}-stage-1-reg`,
    stage: 'registered',
    title: 'Pendaftaran Warga Baru (Registered)',
    description: 'Pengajuan data kependudukan, alamat domisili, dan berkas Kartu Keluarga (KK).',
    status: 'Menunggu Verifikasi RT',
    timestamp: member.joinDate ? `${member.joinDate} 08:30` : '2026-01-01 08:30',
    actor: member.name,
    actorRole: 'Warga / Pendaftar',
    notes: `Pendaftaran diajukan untuk Cluster: ${member.cluster || 'Cluster'}, Alamat: ${member.address}. Jumlah tanggungan tercatat: ${member.dependentsCount} jiwa. No. KK: ${member.familyCardNumber || (member.familyCardPhotoUrl ? 'Lampiran foto terunggah' : 'Belum dilampirkan')}.`,
    isCompleted: true,
    isCurrent: member.status === 'Menunggu Verifikasi RT',
    metadata: {
      cluster: member.cluster,
      familyCardNumber: member.familyCardNumber,
    },
  };

  // Stage 2: RT Verification
  let rtItem: MemberStatusHistoryItem;
  if (isRejected) {
    rtItem = {
      id: `${member.id}-stage-2-rt-reject`,
      stage: 'rejected',
      title: 'Verifikasi RT Ditolak (RT Rejected)',
      description: 'Pengajuan keanggotaan ditolak oleh Ketua RT setelah pemeriksaan dokumen.',
      status: 'Ditolak',
      timestamp: member.rtVerifiedAt || member.verifiedAt || `${member.joinDate} 11:15`,
      actor: member.rtVerifiedBy || member.verifiedByRt || (member.cluster ? `Ketua RT (${member.cluster})` : 'Ketua RT Cluster'),
      actorRole: 'Ketua RT (Cluster)',
      notes: member.rejectionReason || member.rtNotes || 'Data domisili atau identitas kependudukan tidak sesuai dengan data RT setempat.',
      isCompleted: true,
      isCurrent: true,
      metadata: {
        cluster: member.cluster,
        rejectionReason: member.rejectionReason || member.rtNotes,
      },
    };
  } else if (isRtVerified) {
    rtItem = {
      id: `${member.id}-stage-2-rt-verified`,
      stage: 'rt_verified',
      title: 'Verifikasi Berkas RT (RT Verified)',
      description: 'Ketua RT memverifikasi keabsahan domisili warga dan keaslian berkas KK.',
      status: 'Menunggu Pembayaran',
      timestamp: member.rtVerifiedAt || member.verifiedAt || `${member.joinDate} 14:20`,
      actor: member.rtVerifiedBy || member.verifiedByRt || (member.cluster ? `Ketua RT (${member.cluster})` : 'Ketua RT Cluster'),
      actorRole: 'Ketua RT (Cluster)',
      notes: member.rtNotes || 'Data domisili dan dokumen Kartu Keluarga terverifikasi sah. Disetujui untuk lanjut ke pembayaran iuran.',
      isCompleted: true,
      isCurrent: member.status === 'Menunggu Pembayaran',
      metadata: {
        cluster: member.cluster,
      },
    };
  } else {
    rtItem = {
      id: `${member.id}-stage-2-rt-pending`,
      stage: 'rt_verified',
      title: 'Menunggu Verifikasi RT (Pending RT)',
      description: 'Pemeriksaan berkas Kartu Keluarga dan verifikasi domisili oleh Ketua RT setempat.',
      status: 'Menunggu Verifikasi RT',
      timestamp: 'Dalam Antrean Verifikasi',
      actor: member.cluster ? `Ketua RT (${member.cluster})` : 'Ketua RT Cluster',
      actorRole: 'Ketua RT (Cluster)',
      notes: 'Ketua RT perlu memeriksa Kartu Keluarga dan domisili sebelum pendaftaran dapat dilanjutkan.',
      isCompleted: false,
      isCurrent: true,
      metadata: {
        cluster: member.cluster,
      },
    };
  }

  // Stage 3: Payment Validation
  let paymentItem: MemberStatusHistoryItem;
  if (isPaymentDone) {
    const payTime = verifiedPayment?.verifiedAt || verifiedPayment?.createdAt || member.ktaIssuedAt || `${member.joinDate} 16:45`;
    const verifier = verifiedPayment?.verifiedBy || verifiedPayment?.adminSignerName || member.ktaIssuedBy || 'Bendahara Paguyuban';
    const amountStr = verifiedPayment ? formatIDR(verifiedPayment.amount) : 'Iuran Tahunan Rp 300.000';
    const payTypeStr = verifiedPayment?.paymentType || 'Iuran Tahunan & Pendaftaran';
    const payMethodStr = verifiedPayment?.paymentMethod || 'Transfer Bank';
    const receiptStr = verifiedPayment?.receiptNumber || `KWT-${member.memberNumber}`;

    paymentItem = {
      id: `${member.id}-stage-3-pay-done`,
      stage: 'payment_validated',
      title: 'Validasi Pembayaran (Payment Validated)',
      description: 'Bendahara memvalidasi bukti transfer setoran iuran dan menerbitkan kwitansi resmi.',
      status: 'Aktif',
      timestamp: payTime,
      actor: verifier,
      actorRole: 'Bendahara Paguyuban',
      notes: `Setoran iuran ${payTypeStr} sebesar ${amountStr} via ${payMethodStr} disahkan. No. Kwitansi: ${receiptStr}. ${verifiedPayment?.adminNotes ? `Catatan: "${verifiedPayment.adminNotes}"` : ''}`,
      isCompleted: true,
      isCurrent: false,
      metadata: {
        receiptNumber: receiptStr,
        amount: verifiedPayment?.amount || 300000,
        paymentMethod: payMethodStr,
      },
    };
  } else if (pendingPayment || member.status === 'Menunggu Validasi Bendahara') {
    paymentItem = {
      id: `${member.id}-stage-3-pay-pending`,
      stage: 'payment_submitted',
      title: 'Menunggu Validasi Bendahara (Payment Submitted)',
      description: 'Warga telah mengunggah bukti pembayaran iuran, menunggu verifikasi dan tanda tangan Bendahara.',
      status: 'Menunggu Validasi Bendahara',
      timestamp: pendingPayment?.createdAt || `${member.joinDate} 15:30`,
      actor: member.name,
      actorRole: 'Warga / Pendaftar',
      notes: `Bukti transfer setoran ${pendingPayment?.paymentType || 'Iuran'} sebesar ${pendingPayment ? formatIDR(pendingPayment.amount) : 'iuran'} terunggah. Menunggu pengesahan Bendahara.`,
      isCompleted: false,
      isCurrent: true,
      metadata: {
        receiptNumber: pendingPayment?.receiptNumber,
        amount: pendingPayment?.amount,
        paymentMethod: pendingPayment?.paymentMethod,
      },
    };
  } else if (member.status === 'Menunggu Pembayaran') {
    paymentItem = {
      id: `${member.id}-stage-3-pay-waiting`,
      stage: 'payment_validated',
      title: 'Menunggu Pembayaran Warga (Payment Required)',
      description: 'Warga belum melakukan pembayaran iuran ke rekening kas paguyuban.',
      status: 'Menunggu Pembayaran',
      timestamp: 'Menunggu Konfirmasi Warga',
      actor: member.name,
      actorRole: 'Warga / Pendaftar',
      notes: 'Pendaftaran telah disetujui Ketua RT. Menunggu warga mengunggah bukti transfer iuran pendaftaran/tahunan.',
      isCompleted: false,
      isCurrent: true,
    };
  } else {
    paymentItem = {
      id: `${member.id}-stage-3-pay-locked`,
      stage: 'payment_validated',
      title: 'Validasi Pembayaran (Payment Validated)',
      description: 'Tahap pembayaran akan dibuka setelah verifikasi berkas oleh Ketua RT selesai.',
      status: 'Menunggu Pembayaran',
      timestamp: 'Menunggu Verifikasi RT',
      actor: 'Bendahara Paguyuban',
      actorRole: 'Bendahara Paguyuban',
      notes: 'Belum dapat diproses hingga tahap verifikasi RT disetujui.',
      isCompleted: false,
      isCurrent: false,
    };
  }

  // Stage 4: Persetujuan Akhir Ketua Paguyuban
  let paguyubanItem: MemberStatusHistoryItem;
  const isPaguyubanApproved = Boolean(
    member.isPaguyubanApproved ||
    (member.approvedByPaguyuban && member.status === 'Aktif') ||
    (member.isKtaIssued && member.status === 'Aktif')
  );

  if (isPaguyubanApproved) {
    paguyubanItem = {
      id: `${member.id}-stage-4-paguyuban-approved`,
      stage: 'paguyuban_approved',
      title: 'Persetujuan Akhir Ketua Paguyuban (Approved)',
      description: 'Ketua Paguyuban memberikan pengesahan akhir registrasi anggota dan menerbitkan KTA resmi.',
      status: 'Aktif',
      timestamp: member.approvedByPaguyubanAt || member.ktaIssuedAt || `${member.joinDate} 17:00`,
      actor: member.approvedByPaguyuban || 'Bpk. H. Ahmad Fauzi (Ketua Paguyuban)',
      actorRole: 'Ketua Paguyuban',
      notes: member.paguyubanNotes || 'Pendaftaran disahkan secara resmi oleh Ketua Paguyuban. Berkas lengkap dan iuran tervalidasi. KTA resmi diterbitkan.',
      isCompleted: true,
      isCurrent: false,
    };
  } else if (member.status === 'Menunggu Persetujuan Ketua Paguyuban' || (isPaymentDone && !isActive)) {
    paguyubanItem = {
      id: `${member.id}-stage-4-paguyuban-pending`,
      stage: 'paguyuban_approved',
      title: 'Menunggu Persetujuan Akhir Ketua Paguyuban (Pending Final)',
      description: 'Verifikasi RT dan pembayaran iuran selesai. Menunggu pengesahan akhir dari Ketua Paguyuban agar KTA dapat terbit.',
      status: 'Menunggu Persetujuan Ketua Paguyuban',
      timestamp: 'Dalam Antrean Persetujuan Ketua Paguyuban',
      actor: 'Ketua Paguyuban',
      actorRole: 'Ketua Paguyuban',
      notes: 'Sesuai ketentuan, persetujuan akhir registrasi anggota ada di tangan Ketua Paguyuban. KTA resmi baru akan terbit setelah disetujui.',
      isCompleted: false,
      isCurrent: true,
    };
  } else {
    paguyubanItem = {
      id: `${member.id}-stage-4-paguyuban-locked`,
      stage: 'paguyuban_approved',
      title: 'Persetujuan Akhir Ketua Paguyuban (Locked)',
      description: 'Tahap persetujuan akhir akan dibuka setelah verifikasi RT dan pembayaran iuran divalidasi Bendahara.',
      status: 'Menunggu Persetujuan Ketua Paguyuban',
      timestamp: 'Menunggu Tahapan Sebelumnya',
      actor: 'Ketua Paguyuban',
      actorRole: 'Ketua Paguyuban',
      notes: 'Belum dapat diproses hingga tahap verifikasi RT dan pembayaran bendahara selesai.',
      isCompleted: false,
      isCurrent: false,
    };
  }

  // Stage 5: Active Status & Digital KTA Issuance
  let activeItem: MemberStatusHistoryItem;
  if (isActive && isPaguyubanApproved) {
    const actTime = member.ktaIssuedAt || member.approvedByPaguyubanAt || `${member.joinDate} 17:15`;
    const issuer = member.ktaIssuedBy || member.approvedByPaguyuban || 'Ketua Paguyuban & Bendahara';

    activeItem = {
      id: `${member.id}-stage-5-active`,
      stage: 'active',
      title: 'Keanggotaan Resmi Aktif & Terbit KTA (Active)',
      description: 'Kartu Tanda Anggota (KTA) resmi diterbitkan dan hak santunan kematian aktif penuh.',
      status: 'Aktif',
      timestamp: actTime,
      actor: issuer,
      actorRole: 'Ketua Paguyuban & Pengurus',
      notes: `Nomor Anggota ${member.memberNumber} resmi berstatus AKTIF. KTA Digital dengan QR Code validasi dapat diakses dan diunduh. Hak santunan duka dan pendampingan fardhu kifayah berlaku penuh.`,
      isCompleted: true,
      isCurrent: true,
      metadata: {
        documentRef: member.memberNumber,
      },
    };
  } else if (isDeceased) {
    activeItem = {
      id: `${member.id}-stage-5-active-prev`,
      stage: 'active',
      title: 'Keanggotaan Resmi Aktif (Historical)',
      description: 'Pernah aktif terdaftar sebagai anggota paguyuban hingga berpulang ke rahmatullah.',
      status: 'Aktif',
      timestamp: member.ktaIssuedAt || member.joinDate,
      actor: member.ktaIssuedBy || 'Ketua Paguyuban & Pengurus',
      actorRole: 'Ketua Paguyuban & Pengurus',
      notes: `Keanggotaan resmi pernah aktif penuh dengan No. Anggota ${member.memberNumber}.`,
      isCompleted: true,
      isCurrent: false,
    };
  } else {
    activeItem = {
      id: `${member.id}-stage-5-not-active`,
      stage: 'active',
      title: 'Keanggotaan Resmi Aktif & Terbit KTA (Active)',
      description: 'Penerbitan KTA Digital dan aktivasi hak santunan duka cita.',
      status: 'Aktif',
      timestamp: 'Menunggu Persetujuan Ketua Paguyuban',
      actor: 'Sistem & Ketua Paguyuban',
      actorRole: 'Ketua Paguyuban',
      notes: 'KTA baru akan resmi terbit setelah persetujuan akhir diberikan oleh Ketua Paguyuban.',
      isCompleted: false,
      isCurrent: false,
    };
  }

  // Combine standard 5-step pipeline: Registered -> RT Verified -> Payment Validated -> Paguyuban Approved -> Active & KTA Issued
  const standardTimeline: MemberStatusHistoryItem[] = [regItem, rtItem, paymentItem, paguyubanItem, activeItem];

  // Optional Terminal Stage 5: Deceased (Meninggal)
  if (isDeceased) {
    standardTimeline.push({
      id: `${member.id}-stage-5-deceased`,
      stage: 'deceased',
      title: 'Wafat / Meninggal Dunia (Deceased)',
      description: 'Klaim santunan duka cita dan fardhu kifayah telah direalisasikan.',
      status: 'Meninggal',
      timestamp: member.notes?.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}/)?.[0] || '15 Mei 2026',
      actor: 'Pengurus Lingkungan & Ahli Waris',
      actorRole: 'Pengurus Paguyuban',
      notes: member.notes || 'Anggota telah berpulang ke rahmatullah. Santunan tunai dan layanan pengurusan jenazah telah disalurkan kepada ahli waris.',
      isCompleted: true,
      isCurrent: true,
    });
  }

  // Optional Terminal Stage: Inactive (Non-Aktif)
  if (isInactive) {
    standardTimeline.push({
      id: `${member.id}-stage-5-inactive`,
      stage: 'inactive',
      title: 'Status Non-Aktif (Inactive)',
      description: 'Keanggotaan sementara dinonaktifkan (misal pindah domisili atau mutasi).',
      status: 'Non-Aktif',
      timestamp: new Date().toISOString().substring(0, 10),
      actor: 'Pengurus Paguyuban',
      actorRole: 'Pengurus Paguyuban',
      notes: member.notes || 'Status keanggotaan dinonaktifkan.',
      isCompleted: true,
      isCurrent: true,
    });
  }

  // Merge any unique explicit logged items from existingHistory that might not be in standard stages
  if (existingHistory.length > 0) {
    const existingIds = new Set(standardTimeline.map((item) => item.id));
    existingHistory.forEach((hist) => {
      if (!existingIds.has(hist.id)) {
        standardTimeline.push(hist);
      }
    });
  }

  return standardTimeline;
};

/**
 * Helper to generate a new audit log record when a member status change occurs.
 */
export const createStatusChangeAuditItem = (
  memberId: string,
  stage: MemberStatusHistoryItem['stage'],
  title: string,
  status: MemberStatus,
  actor: string,
  actorRole: string,
  notes?: string,
  metadata?: MemberStatusHistoryItem['metadata']
): MemberStatusHistoryItem => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  return {
    id: `audit-${memberId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    stage,
    title,
    description: notes || `Perubahan status menjadi ${status}`,
    status,
    timestamp: now,
    actor,
    actorRole,
    notes,
    isCompleted: true,
    isCurrent: true,
    metadata,
  };
};
