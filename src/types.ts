export type MemberStatus =
  | 'Aktif'
  | 'Menunggu Verifikasi RT'
  | 'Menunggu Pembayaran'
  | 'Menunggu Validasi Bendahara'
  | 'Menunggu Persetujuan Ketua Paguyuban'
  | 'Ditolak'
  | 'Non-Aktif'
  | 'Meninggal';
export type MemberVerificationStatus = 'Pending' | 'Verified' | 'Rejected';

export type ClusterType =
  | 'Cluster Sanur'
  | 'Cluster Mataram'
  | 'Cluster Pasundan RT 01'
  | 'Cluster Pasundan RT 05'
  | 'Cluster Pasundan RT 06'
  | 'Cluster Ranah Melayu'
  | string;

export interface ClusterMaster {
  id: string;
  name: string;
  code?: string;
  rtNumber?: string;
  leaderName?: string;
  leaderPhone?: string;
  leaderEmail?: string;
  addressCoverage?: string;
  isActive: boolean;
  orderIndex?: number;
  notes?: string;
}

export const DEFAULT_CLUSTERS: ClusterMaster[] = [
  {
    id: 'cls-1',
    name: 'Cluster Sanur',
    code: 'SNR',
    rtNumber: 'RT 04',
    leaderName: 'Pak Dicky Wens',
    leaderPhone: '081234567801',
    leaderEmail: 'rt.sanur@danakematian.org',
    addressCoverage: 'Blok S (No. 01 - 50)',
    isActive: true,
    orderIndex: 1,
  },
  {
    id: 'cls-2',
    name: 'Cluster Mataram',
    code: 'MTR',
    rtNumber: 'RT 03',
    leaderName: 'Pak Cecep',
    leaderPhone: '081345678902',
    leaderEmail: 'rt.mataram@danakematian.org',
    addressCoverage: 'Blok M (No. 01 - 45)',
    isActive: true,
    orderIndex: 2,
  },
  {
    id: 'cls-3',
    name: 'Cluster Pasundan RT 01',
    code: 'PSD-01',
    rtNumber: 'RT 01',
    leaderName: 'Pak Yoni',
    leaderPhone: '081578900123',
    leaderEmail: 'rt.pasundan01@danakematian.org',
    addressCoverage: 'Blok P (No. 01 - 25)',
    isActive: true,
    orderIndex: 3,
  },
  {
    id: 'cls-4',
    name: 'Cluster Pasundan RT 05',
    code: 'PSD-02',
    rtNumber: 'RT 05',
    leaderName: 'Pak Anin',
    leaderPhone: '081578900124',
    leaderEmail: 'rt.pasundan02@danakematian.org',
    addressCoverage: 'Blok P (No. 26 - 50)',
    isActive: true,
    orderIndex: 4,
  },
  {
    id: 'cls-5',
    name: 'Cluster Pasundan RT 06',
    code: 'PSD-06',
    rtNumber: 'RT 06',
    leaderName: 'Pak Arifin',
    leaderPhone: '081578900125',
    leaderEmail: 'rt.pasundan03@danakematian.org',
    addressCoverage: 'Blok P (No. 51 - 80)',
    isActive: true,
    orderIndex: 5,
  },
  {
    id: 'cls-6',
    name: 'Cluster Ranah Melayu',
    code: 'RNM',
    rtNumber: 'RT 02',
    leaderName: 'Pak Rully',
    leaderPhone: '081267891234',
    leaderEmail: 'rt.ranahmelayu@danakematian.org',
    addressCoverage: 'Blok TM & RM (No. 01 - 60)',
    isActive: true,
    orderIndex: 6,
  },
];

export interface BenefitMaster {
  id: string;
  categoryName: string; // e.g. "Kepala Keluarga (Anggota Utama)", "Orang Tua / Mertua"
  code?: string; // e.g. "BNF-KK", "BNF-ORTU"
  targetRelationship: 'Anggota Utama' | 'Suami/Istri' | 'Anak' | 'Orang Tua' | 'Tanggungan Lain' | string;
  maxCashAmount: number; // Santunan Tunai Cepat (Rp)
  defaultTotalPackage: number; // Estimasi Total Paket Manfaat & Layanan (Rp)
  servicesIncluded: string[]; // Rincian layanan & fasilitas yang ditanggung
  waitingPeriodDays: number; // Masa tunggu keanggotaan (Hari)
  badgeColor?: 'emerald' | 'teal' | 'cyan' | 'amber' | 'purple' | 'rose' | 'indigo' | string;
  isActive: boolean;
  orderIndex: number;
  description?: string;
  termsAndConditions?: string;
}

export const DEFAULT_BENEFITS: BenefitMaster[] = [
  {
    id: 'bnf-1',
    categoryName: 'Kepala Keluarga (Anggota Utama)',
    code: 'BNF-KK',
    targetRelationship: 'Anggota Utama',
    maxCashAmount: 5000000,
    defaultTotalPackage: 10000000,
    servicesIncluded: [
      'Santunan Duka Tunai Cepat untuk Ahli Waris',
      'Kain Kafan & Perlengkapan Jenazah Lengkap',
      'Ambulans Jenazah ke TPU / Pemakaman',
      'Fasilitas Sewa Tenda & Kursi Duka (3 Hari)',
      'Biaya Penggalian & Penutupan Liang Lahat',
      'Pendampingan Fardhu Kifayah & Doa Bersama'
    ],
    waitingPeriodDays: 0,
    badgeColor: 'emerald',
    isActive: true,
    orderIndex: 1,
    description: 'Hak santunan penuh bagi Kepala Keluarga / Anggota Utama yang terdaftar aktif.',
    termsAndConditions: 'Telah terdaftar aktif dan menyelesaikan iuran kas tahunan.'
  },
  {
    id: 'bnf-4',
    categoryName: 'Orang Tua / Mertua (Serumah)',
    code: 'BNF-ORTU',
    targetRelationship: 'Orang Tua',
    maxCashAmount: 1500000,
    defaultTotalPackage: 3000000,
    servicesIncluded: [
      'Santunan Duka Cita Tunai',
      'Bantuan Perlengkapan Kain Kafan Jenazah',
      'Mobil Ambulans / Kereta Jenazah',
      'Takziah & Doa Bersama Pengurus Lingkungan'
    ],
    waitingPeriodDays: 30,
    badgeColor: 'amber',
    isActive: true,
    orderIndex: 2,
    description: 'Hak santunan duka cita bagi Orang Tua atau Mertua yang tinggal satu rumah dengan anggota.',
    termsAndConditions: 'Tinggal satu rumah dan telah terdaftar minimal 30 hari masa keanggotaan.'
  },
  {
    id: 'bnf-5',
    categoryName: 'Tanggungan Tambahan Lainnya',
    code: 'BNF-LAIN',
    targetRelationship: 'Tanggungan Lain',
    maxCashAmount: 1000000,
    defaultTotalPackage: 2000000,
    servicesIncluded: [
      'Santunan Duka Sosial Paguyuban',
      'Bantuan Pendampingan Warga Sekitar'
    ],
    waitingPeriodDays: 30,
    badgeColor: 'purple',
    isActive: true,
    orderIndex: 3,
    description: 'Santunan duka gotong royong sosial untuk tanggungan resmi lainnya yang serumah.',
    termsAndConditions: 'Disetujui oleh pengurus RT dan Paguyuban.'
  }
];

export const CLUSTERS: string[] = DEFAULT_CLUSTERS.map(c => c.name);

export interface Dependent {
  id: string;
  name: string;
  relationship: string;
  age?: number;
}

export interface MemberStatusHistoryItem {
  id: string;
  stage: 'registered' | 'rt_verified' | 'payment_submitted' | 'payment_validated' | 'paguyuban_approved' | 'active' | 'rejected' | 'deceased' | 'inactive';
  title: string;
  description: string;
  status: MemberStatus;
  timestamp: string;
  actor: string;
  actorRole: string;
  notes?: string;
  isCompleted: boolean;
  isCurrent?: boolean;
  metadata?: {
    receiptNumber?: string;
    amount?: number;
    paymentMethod?: string;
    familyCardNumber?: string;
    rejectionReason?: string;
    cluster?: string;
    expiryDate?: string;
    documentRef?: string;
  };
}

export interface Member {
  id: string;
  memberNumber: string; // e.g. ADK-001
  name: string;
  nik: string;
  phone: string;
  email?: string;
  password?: string;
  cluster?: ClusterType | string;
  address: string;
  joinDate: string;
  status: MemberStatus;
  verificationStatus?: MemberVerificationStatus;
  verifiedByRt?: string;
  verifiedAt?: string;
  rtVerifiedBy?: string;
  rtVerifiedAt?: string;
  rtNotes?: string;
  rejectionReason?: string;
  isPaguyubanApproved?: boolean;
  approvedByPaguyuban?: string;
  approvedByPaguyubanAt?: string;
  paguyubanNotes?: string;
  paguyubanSignature?: string;
  paguyubanRejectionReason?: string;
  dependentsCount: number;
  dependentsList?: Dependent[];
  photoUrl?: string; // Foto Profil / Pasfoto Resmi KTA Warga (Data URL)
  familyCardPhotoUrl?: string; // Foto / Lampiran Kartu Keluarga (Data URL)
  familyCardFileName?: string; // Nama berkas foto KK
  familyCardNumber?: string; // Nomor Kartu Keluarga (16 digit)
  familyCardQualityScore?: number; // Skor kualitas validasi dokumen (0 - 100)
  familyCardQualityStatus?: string; // Status kualitas: excellent, good, warning_blur, warning_unreadable, dll
  notes?: string;
  isKtaIssued?: boolean;
  ktaIssuedAt?: string;
  ktaIssuedBy?: string;
  statusHistory?: MemberStatusHistoryItem[];
}

export type UserAuthority =
  | 'Anggota'
  | 'Ketua RT (Cluster)'
  | 'Bendahara'
  | 'Ketua Paguyuban'
  | 'Ketua RW'
  | 'Ketua DKM'
  | 'Admin';

export const USER_AUTHORITIES: UserAuthority[] = [
  'Anggota',
  'Ketua RT (Cluster)',
  'Bendahara',
  'Ketua Paguyuban',
  'Ketua RW',
  'Ketua DKM',
  'Admin',
];

export interface AppUser {
  id: string;
  name: string; // Nama User
  email: string; // Alamat Email
  password?: string; // Password
  authority: UserAuthority; // Otoritas
  cluster?: ClusterType | string; // Jika Ketua RT atau Anggota
  phone?: string;
  memberId?: string; // Link to Member ID if authority is Anggota
  memberNumber?: string; // e.g. ADK-2026-001
  status: 'Aktif' | 'Non-Aktif';
  createdAt: string;
  lastLoginAt?: string;
  avatarColor?: string;
  notes?: string;
}

export type PaymentType = 'Iuran Tahunan' | 'Iuran Bulanan' | 'Iuran Pendaftaran' | 'Iuran Sukarela' | 'Iuran Duka Khusus' | 'Iuran Tahunan & Pendaftaran';
export type PaymentStatus = 'Pending' | 'Verified' | 'Rejected';
export type PaymentMethod =
  | 'Transfer BCA'
  | 'Transfer Mandiri'
  | 'Transfer BRI'
  | 'Transfer BSI'
  | 'QRIS'
  | 'QRIS Paguyuban'
  | 'Tunai'
  | 'Tunai ke Pengurus'
  | (string & {});

export interface Payment {
  id: string;
  receiptNumber: string; // e.g. KWT-2026-0801
  memberId: string;
  memberName: string;
  memberNumber: string;
  paymentType: PaymentType;
  periodMonth: string; // e.g. "Tahun 2026" or "Agustus 2026"
  periodYear?: string; // e.g. "2026"
  amount: number;
  paymentMethod: PaymentMethod;
  proofImageUrl?: string; // Data URL or URL string
  proofFileName?: string;
  status: PaymentStatus;
  createdAt: string; // ISO String or readable date
  verifiedAt?: string;
  verifiedBy?: string;
  adminNotes?: string;
  adminSignature?: string; // Tanda tangan digital resmi admin/bendahara (Base64 PNG Data URL)
  adminSignerName?: string; // Nama pengesah tanda tangan (e.g. Ibu Hj. Siti Aminah)
  adminSignerTitle?: string; // Jabatan pengesah (e.g. Bendahara Paguyuban)
  adminSignatureDate?: string; // Tanggal & waktu penandatanganan digital
}

export interface ExpenseDetail {
  id: string;
  description: string;
  cost: number;
  recipientParty?: string; // Pihak terkait penerima (e.g. Ahli Waris, Vendor Ambulans, Petugas TPU)
  transferProofUrl?: string; // Bukti transfer bank dari bendahara
  transferProofFileName?: string;
  externalReceiptUrl?: string; // Kwitansi dari pihak luar / invoice
  externalReceiptFileName?: string;
  paidDate?: string; // Tanggal bayar oleh bendahara
}

export type BenefitClaimStatus =
  | 'Diajukan RT'
  | 'Menunggu Pembayaran Bendahara'
  | 'Menunggu Persetujuan Ketua'
  | 'Disetujui'
  | 'Ditolak';

export interface BenefitClaim {
  id: string;
  claimNumber: string; // e.g. KLAIM-2026-001
  memberId: string;
  memberName: string;
  memberNumber: string;
  cluster?: string;
  deceasedName: string;
  relationship: 'Anggota Utama' | 'Suami/Istri' | 'Anak' | 'Orang Tua' | 'Tanggungan Lain';
  dateOfDeath: string;
  causeOfDeath?: string;
  deathCertificateUrl?: string; // Foto Surat Kematian / Keterangan RT
  deathCertificateFileName?: string;

  // 1. INPUT OLEH KETUA RT
  submittedByRtName?: string;
  submittedByRtCluster?: string;
  submittedAt?: string;
  rtNotes?: string;

  // 2. INPUT PEMBAYARAN OLEH BENDAHARA
  expenseDetails: ExpenseDetail[];
  totalAmount: number;
  transferProofUrls?: string[]; // Bukti transfer umum / multi berkas
  externalReceiptUrls?: string[]; // Kwitansi pihak luar umum / multi berkas
  treasurerName?: string;
  treasurerProcessedAt?: string;
  treasurerNotes?: string;

  // 3. PERSETUJUAN OLEH KETUA PAGUYUBAN (MEMOTONG SALDO KAS)
  status?: BenefitClaimStatus;
  approvedByKetuaName?: string;
  approvedAt?: string;
  approvalNotes?: string;
  ketuaSignature?: string; // Tanda tangan digital Ketua Paguyuban
  rejectedAt?: string;
  rejectionReason?: string;

  createdAt: string;
  processedBy: string;
  notes?: string;
}

export type MembershipPeriodMode = 'payment_date' | 'fixed_period';
export type FixedPeriodType = 'calendar_year' | 'custom_range';

export interface MembershipPeriodSettings {
  /**
   * Mode penentuan masa aktif keanggotaan:
   * - 'payment_date': Berdasarkan tanggal pembayaran (e.g. berlaku 1 tahun / 365 hari sejak bayar)
   * - 'fixed_period': Berdasarkan periode tertentu yang diberlakukan pengurus (e.g. 1 Jan - 31 Des tahun kalender atau rentang kustom)
   */
  mode: MembershipPeriodMode;

  // Konfigurasi jika mode === 'payment_date'
  durationMonths?: number; // Durasi dalam bulan (default: 12 bulan)
  durationDays?: number; // Durasi dalam hari (opsional)

  // Konfigurasi jika mode === 'fixed_period'
  fixedType?: FixedPeriodType; // 'calendar_year' (1 Jan - 31 Des) atau 'custom_range'
  activePeriodYear?: string; // e.g. "2026"
  customPeriodName?: string; // e.g. "Tahun Kalender 2026" atau "Periode Kepengurusan 2026-2027"
  customStartDate?: string; // YYYY-MM-DD e.g. "2026-01-01"
  customEndDate?: string; // YYYY-MM-DD e.g. "2026-12-31"

  // Kebijakan Pengurus Tambahan
  allowGracePeriodDays?: number; // Toleransi masa tenggang (hari) sebelum status terkunci, default 14 hari
  policyNotes?: string; // Catatan dasar hukum / keputusan pengurus
}

export interface SystemSettings {
  communityName: string;
  communityAddress: string;
  logoUrl?: string; // Logo Paguyuban (Base64 data URL or web image URL)
  defaultAdminSignature?: string; // Tanda tangan digital default Bendahara (Base64 PNG Data URL)
  defaultAdminSignerName?: string; // Nama penandatangan default
  defaultAdminSignerTitle?: string; // Jabatan default (e.g. Bendahara Paguyuban)
  annualFeeAmount: number; // Iuran 1 tahun sekali (e.g. Rp 300.000/tahun)
  monthlyFeeAmount: number; // e.g. Rp 25.000/bulan (rekap per bulan)
  registrationFeeAmount: number;
  treasurerName: string;
  treasurerPhone: string;
  bankAccounts: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }[];

  // Kebijakan Periode Keanggotaan yang ditentukan Admin/Pengurus
  membershipPeriod?: MembershipPeriodSettings;

  // Integrasi WhatsApp Gateway & Notifikasi Otomatis
  whatsappApiEnabled?: boolean;
  whatsappProvider?: 'fonnte' | 'waha' | 'custom_webhook' | 'direct_link';
  whatsappApiToken?: string;
  whatsappApiEndpoint?: string; // e.g. https://api.fonnte.com/send
  whatsappSenderPhone?: string;
  autoNotifyOnMemberStatusChange?: boolean; // Kirim saat status berubah (default: true)
  autoNotifyOnPaymentValidated?: boolean; // Kirim saat pembayaran divalidasi dan KTA aktif (default: true)
  autoNotifyOnRtVerification?: boolean; // Kirim saat verifikasi RT disetujui / ditolak (default: true)
  whatsappCustomFooter?: string; // Footer / tanda tangan pesan WA
}

export type WhatsAppTriggerEvent =
  | 'status_active'
  | 'payment_validated'
  | 'rt_approved'
  | 'rt_rejected'
  | 'status_changed'
  | 'test_message';

export interface WhatsAppNotificationLog {
  id: string;
  recipientPhone: string;
  recipientName: string;
  memberNumber: string;
  status: 'sent' | 'fallback_ready' | 'failed' | 'simulated';
  triggerType: WhatsAppTriggerEvent;
  message: string;
  timestamp: string;
  provider?: string;
  responseInfo?: string;
  directWaLink?: string;
}

export type NotificationType = 'success' | 'info' | 'warning' | 'error';
export type NotificationCategory = 'payment' | 'registration' | 'claim' | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  cluster?: string;
  memberId?: string;
  paymentId?: string;
  linkTab?: string;
}

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-demo-1',
    type: 'success',
    category: 'payment',
    title: 'Pembayaran Iuran Terverifikasi',
    message: 'Iuran Tahunan warga Pak Sutrisno (Cluster Sanur) sebesar Rp 300.000 telah diverifikasi oleh Bendahara. KTA Digital resmi telah diterbitkan.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
    read: false,
    cluster: 'Cluster Sanur',
    linkTab: 'payments',
  },
  {
    id: 'notif-demo-2',
    type: 'info',
    category: 'registration',
    title: 'Pendaftaran Warga Baru Masuk',
    message: 'Pendaftaran warga baru atas nama Ahmad Fauzi (Cluster Pasundan RT 01) telah diajukan beserta berkas KK dan menunggu verifikasi berkas oleh Ketua RT.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
    read: false,
    cluster: 'Cluster Pasundan RT 01',
    linkTab: 'rt-verification',
  },
  {
    id: 'notif-demo-3',
    type: 'success',
    category: 'registration',
    title: 'Pendaftaran Warga Disetujui RT',
    message: 'Ketua RT Pasundan RT 02 telah menyetujui verifikasi pendaftaran warga Dewi Lestari. Data anggota telah aktif dalam sistem paguyuban.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
    read: true,
    cluster: 'Cluster Pasundan RT 02',
    linkTab: 'registration',
  },
  {
    id: 'notif-demo-4',
    type: 'warning',
    category: 'payment',
    title: 'Pemberitahuan Iuran Segera Jatuh Tempo',
    message: 'Terdapat 3 warga di paguyuban dengan masa berlaku iuran segera berakhir dalam 30 hari ke depan.',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19),
    read: true,
    linkTab: 'payments',
  },
];

