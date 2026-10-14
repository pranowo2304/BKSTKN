import React, { useState, useMemo, useEffect } from 'react';
import { Member, Payment, SystemSettings, AppUser, BenefitClaim, ClusterType, BenefitMaster, DEFAULT_BENEFITS } from '../types';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo, generateKtaQrPayload } from '../lib/ktaUtils';
import { formatIDR, getMemberForUser } from '../lib/storage';
import { MemberStatusTimeline } from './MemberStatusTimeline';
import { DigitalKtaModal } from './DigitalKtaModal';
import { PrintMemberCardModal } from './PrintMemberCardModal';
import { FamilyCardModal } from './FamilyCardModal';
import { ReceiptModal } from './ReceiptModal';
import { ContactAdminModal } from './ContactAdminModal';
import { MemberKtaGallery } from './MemberKtaGallery';
import { MemberKtaQrGeneratorModal } from './MemberKtaQrGeneratorModal';
import { MembershipCertificateModal } from './MembershipCertificateModal';
import { RoleMobileAppMenu } from './RoleMobileAppMenu';
import { downloadKtaCardAsImage, KtaCardSide } from '../lib/ktaImageGenerator';
import { QRCodeSVG } from 'qrcode.react';
import {
  UserCheck,
  CreditCard,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Printer,
  Eye,
  RotateCw,
  Globe,
  Download,
  Share2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  Shield,
  Coins,
  QrCode,
  Check,
  FileSpreadsheet,
  Building2,
  ChevronRight,
  Lock,
  Home,
  Receipt,
  Smartphone,
  Sparkles,
  Layers,
  Image as ImageIcon,
  RefreshCw,
  HeartHandshake,
  Award,
  Heart,
} from 'lucide-react';
import { KtaCardSkeleton } from './KtaCardSkeleton';

interface MemberPortalProps {
  activeUser: AppUser | null;
  members: Member[];
  payments: Payment[];
  claims?: BenefitClaim[];
  settings: SystemSettings;
  benefits?: BenefitMaster[];
  users?: AppUser[];
  onNavigateToPayment?: (member: Member) => void;
  onUpdateMember?: (updatedMember: Member) => void;
  onLogout?: () => void;
  setCurrentTab?: (tab: string) => void;
}

type MemberPortalSection = 'semua' | 'kartu-anggota' | 'galeri-kta' | 'bayar-iuran' | 'nilai-manfaat' | 'riwayat-pembayaran' | 'riwayat-pendaftaran';

export const MemberPortal: React.FC<MemberPortalProps> = ({
  activeUser,
  members = [],
  payments = [],
  claims = [],
  settings,
  benefits = [],
  users = [],
  onNavigateToPayment,
  onUpdateMember,
  onLogout,
  setCurrentTab,
}) => {
  // Identify the member object for this active user
  const member = useMemo(() => {
    return (
      getMemberForUser(activeUser, members) ||
      members.find(
        (m) =>
          (m.id && activeUser?.memberId && m.id === activeUser.memberId) ||
          (m.email && activeUser?.email && m.email.toLowerCase() === activeUser.email.toLowerCase()) ||
          (m.memberNumber && activeUser?.memberNumber && m.memberNumber === activeUser.memberNumber) ||
          (m.name && activeUser?.name && m.name.toLowerCase() === activeUser.name.toLowerCase())
      ) ||
      members[0]
    );
  }, [activeUser, members]);

  // Section switcher
  const [activeSection, setActiveSection] = useState<MemberPortalSection>('semua');

  // Filter payments for this member
  const memberPayments = useMemo(() => {
    if (!member) return [];
    return payments
      .filter((p) => {
        const matchId = p.memberId && p.memberId === member.id;
        const matchNo = p.memberNumber && p.memberNumber === member.memberNumber;
        const matchName = p.memberName && member.name && p.memberName.toLowerCase() === member.name.toLowerCase();
        return matchId || matchNo || matchName;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [member, payments]);

  // Payment filter within member portal
  const [paymentFilter, setPaymentFilter] = useState<'Semua' | 'Verified' | 'Pending' | 'Rejected'>('Semua');
  const filteredMemberPayments = useMemo(() => {
    if (paymentFilter === 'Semua') return memberPayments;
    return memberPayments.filter((p) => (p.status || 'Verified') === paymentFilter);
  }, [memberPayments, paymentFilter]);

  // Expiry & KTA calculations
  const expiry = useMemo(() => {
    if (!member) return null;
    return calculateMemberExpiry(member, payments, new Date(), settings);
  }, [member, payments, settings]);

  const ktaInfo = useMemo(() => {
    if (!member) return null;
    return getMemberKtaIssuanceInfo(member, payments);
  }, [member, payments]);

  // Benefit packages configured by admin / settings
  const effectiveBenefits = useMemo(() => {
    const list = benefits && benefits.length > 0 ? benefits : DEFAULT_BENEFITS;
    const activeList = list.filter((b) => b.isActive !== false);
    return activeList.length > 0 ? activeList : DEFAULT_BENEFITS;
  }, [benefits]);

  const maxBenefitAmount = useMemo(() => {
    return Math.max(...effectiveBenefits.map((b) => b.defaultTotalPackage || 0), 10000000);
  }, [effectiveBenefits]);

  // Modals state
  const [isKtaModalOpen, setIsKtaModalOpen] = useState(false);
  const [isPrintKtaModalOpen, setIsPrintKtaModalOpen] = useState(false);
  const [isQrGeneratorModalOpen, setIsQrGeneratorModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isKkModalOpen, setIsKkModalOpen] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [isContactAdminOpen, setIsContactAdminOpen] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [copiedKta, setCopiedKta] = useState(false);
  const [downloadingMyKta, setDownloadingMyKta] = useState(false);
  const [myKtaDownloadToast, setMyKtaDownloadToast] = useState<string | null>(null);
  const [isCardLoading, setIsCardLoading] = useState(true);

  // Smooth skeleton loading transition on mount or when member changes
  useEffect(() => {
    setIsCardLoading(true);
    const timer = setTimeout(() => {
      setIsCardLoading(false);
    }, 550);
    return () => clearTimeout(timer);
  }, [member?.id, member?.memberNumber]);

  const handleRefreshKta = () => {
    setIsCardLoading(true);
    setTimeout(() => {
      setIsCardLoading(false);
    }, 600);
  };

  // Active status of logged-in member for KTA gallery
  const isMyKtaActive = useMemo(() => {
    return Boolean(member && (member.status === 'Aktif' || member.isKtaIssued));
  }, [member]);

  // QR Code Payload
  const qrPayload = useMemo(() => {
    if (!member || !ktaInfo || !expiry) return '';
    return generateKtaQrPayload(member, ktaInfo, settings, expiry.expiryDateFormatted);
  }, [member, ktaInfo, settings, expiry]);

  // Calculations
  const totalPaid = memberPayments
    .filter((p) => p.status === 'Verified' || !p.status)
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const verifiedPaymentsCount = memberPayments.filter((p) => p.status === 'Verified' || !p.status).length;
  const pendingPaymentsCount = memberPayments.filter((p) => p.status === 'Pending').length;

  const handleDownloadMyKta = async (side: KtaCardSide = 'front') => {
    if (!member) return;
    try {
      setDownloadingMyKta(true);
      const filename = await downloadKtaCardAsImage({
        member,
        side,
        theme: 'emerald',
        settings,
        payments,
      });
      setMyKtaDownloadToast(`KTA (${side === 'front' ? 'Sisi Depan' : side === 'back' ? 'Sisi Belakang' : 'Lengkap'}) berhasil diunduh sebagai gambar.`);
      setTimeout(() => setMyKtaDownloadToast(null), 4000);
    } catch (err) {
      console.error('Error downloading KTA card image:', err);
      alert('Gagal mengunduh gambar KTA. Silakan coba kembali.');
    } finally {
      setDownloadingMyKta(false);
    }
  };

  const handleCopyKtaInfo = () => {
    if (!member) return;
    const text = `*KARTU TANDA ANGGOTA (KTA) DIGITAL*\n${settings.communityName || 'Paguyuban Dana Kematian Warga'}\n\n• Nama: ${member.name}\n• No. Anggota (NPA): ${member.memberNumber}\n• NIK: ${member.nik}\n• Cluster/RT: ${member.cluster || '-'}\n• Status: ${member.status}\n• Masa Berlaku: ${expiry?.expiryDateFormatted || '-'}\n• Terlindungi: ${(member.dependentsCount || 0) + 1} Jiwa\n\n_Diverifikasi oleh Sistem Resmi Paguyuban Dana Kematian._`;
    navigator.clipboard.writeText(text);
    setCopiedKta(true);
    setTimeout(() => setCopiedKta(false), 2500);
  };

  const handleSectionChange = (sec: MemberPortalSection) => {
    setActiveSection(sec);
    if (sec === 'kartu-anggota') {
      const target = document.getElementById('member-kta-header');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    const target = document.getElementById('member-portal-sections');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!member) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm my-8">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-800">Data Anggota Tidak Ditemukan</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Akun login Anda ({activeUser?.email}) belum tertaut dengan data anggota aktif. Silakan hubungi pengurus RT atau Administrator paguyuban.
        </p>
      </div>
    );
  }

  return (
    <div id="member-portal-top" className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-32">
      {/* ========================================================================= */}
      {/* MOBILE APP STYLE OPERATIONAL MENU & DASHBOARD (KHUSUS ANGGOTA)             */}
      {/* ========================================================================= */}
      <RoleMobileAppMenu
        activeUser={activeUser}
        roleTitle="PORTAL ANGGOTA"
        userName={member?.name || activeUser?.name || 'Warga Anggota'}
        roleSubtitle={`${member?.cluster || 'Cluster'} • NIK: ${member?.nik || '-'}`}
        counterLabel="STATUS KTA"
        counterValue={member?.isKtaIssued ? 'Aktif' : 'Proses'}
        counterHighlight={!member?.isKtaIssued}
        sectionTitle="MENU CEPAT OPERASIONAL ANGGOTA"
        sectionSubtitle="Semua menu navigasi operasional warga anggota"
        actions={[
          {
            id: 'kta-digital',
            label: 'KTA Digital',
            subLabel: 'Kartu Anggota Digital',
            badge: member?.isKtaIssued ? 'Aktif' : 'Draft',
            gradient: 'from-emerald-600 to-teal-500',
            icon: QrCode,
            onClick: () => {
              handleSectionChange('kartu-anggota');
              setIsKtaModalOpen(true);
            },
          },
          {
            id: 'bayar-iuran',
            label: 'Bayar Iuran',
            subLabel: `${formatIDR(settings.annualFeeAmount || 300000)}/Tahun`,
            badge: 'Online',
            gradient: 'from-blue-600 to-indigo-500',
            icon: CreditCard,
            onClick: () => {
              if (onNavigateToPayment && member) {
                onNavigateToPayment(member);
              } else if (setCurrentTab) {
                setCurrentTab('payment');
              } else {
                handleSectionChange('bayar-iuran');
              }
            },
          },
          {
            id: 'riwayat-kas',
            label: 'Riwayat Iuran',
            subLabel: 'Kwitansi & Transaksi',
            badge: memberPayments.length,
            gradient: 'from-purple-600 to-indigo-500',
            icon: Receipt,
            onClick: () => {
              if (setCurrentTab) {
                setCurrentTab('history');
              } else {
                handleSectionChange('riwayat-pembayaran');
              }
            },
          },
          {
            id: 'nilai-manfaat',
            label: 'Santunan Duka',
            subLabel: `s/d ${formatIDR(maxBenefitAmount)}`,
            badge: `${effectiveBenefits.length} Paket`,
            gradient: 'from-rose-600 to-pink-500',
            icon: HeartHandshake,
            onClick: () => {
              if (setCurrentTab) {
                setCurrentTab('realization');
              } else {
                handleSectionChange('nilai-manfaat');
              }
            },
          },
          {
            id: 'berkas-keluarga',
            label: 'Keluarga & KK',
            subLabel: `${(member?.dependentsCount || 0) + 1} Jiwa Terlindungi`,
            badge: member?.familyMembers?.length || 0,
            gradient: 'from-teal-600 to-emerald-700',
            icon: Users,
            onClick: () => handleSectionChange('riwayat-pendaftaran'),
          },
          {
            id: 'portal-publik',
            label: 'Portal Warga',
            subLabel: 'Informasi Publik Paguyuban',
            gradient: 'from-teal-600 to-emerald-600',
            icon: Globe,
            onClick: () => {
              if (setCurrentTab) {
                setCurrentTab('public');
              }
            },
          },
        ]}
        pills={[
          {
            id: 'pill-semua',
            label: 'Semua Fitur',
            isActive: activeSection === 'semua',
            icon: Home,
            onClick: () => handleSectionChange('semua'),
          },
          {
            id: 'pill-kta',
            label: 'Lihat KTA Digital',
            isActive: activeSection === 'kartu-anggota',
            icon: QrCode,
            onClick: () => handleSectionChange('kartu-anggota'),
          },
          {
            id: 'pill-bayar',
            label: `Bayar Iuran (${formatIDR(settings.annualFeeAmount || 300000)}/Thn)`,
            isActive: activeSection === 'bayar-iuran',
            icon: CreditCard,
            onClick: () => handleSectionChange('bayar-iuran'),
          },
          {
            id: 'pill-manfaat',
            label: 'Nilai Manfaat',
            isActive: activeSection === 'nilai-manfaat',
            icon: HeartHandshake,
            onClick: () => handleSectionChange('nilai-manfaat'),
          },
          {
            id: 'pill-hubungi',
            label: 'Hubungi Pengurus',
            icon: MessageSquare,
            onClick: () => setIsContactAdminOpen(true),
          },
        ]}
        dockItems={[
          {
            id: 'dock-beranda',
            label: 'Beranda',
            icon: Home,
            isActive: activeSection === 'semua',
            onClick: () => handleSectionChange('semua'),
          },
          {
            id: 'dock-kta',
            label: 'KTA Digital',
            icon: QrCode,
            isActive: activeSection === 'kartu-anggota',
            onClick: () => {
              handleSectionChange('kartu-anggota');
              setIsKtaModalOpen(true);
            },
          },
          {
            id: 'dock-bayar',
            label: 'Bayar Iuran',
            icon: CreditCard,
            isCenterFloating: true,
            onClick: () => {
              if (onNavigateToPayment && member) {
                onNavigateToPayment(member);
              } else {
                handleSectionChange('bayar-iuran');
              }
            },
          },
          {
            id: 'dock-riwayat',
            label: 'Riwayat',
            icon: Receipt,
            badge: memberPayments.length > 0 ? memberPayments.length : undefined,
            isActive: activeSection === 'riwayat-pembayaran',
            onClick: () => handleSectionChange('riwayat-pembayaran'),
          },
          {
            id: 'dock-hubungi',
            label: 'Hubungi',
            icon: MessageSquare,
            onClick: () => setIsContactAdminOpen(true),
          },
        ]}
      />

      {/* 1. KARTU TANDA ANGGOTA (KTA) DIGITAL - PENGGANTI HEADER HALAMAN ANGGOTA */}
      <div id="member-kta-header" className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* MY KTA DOWNLOAD TOAST NOTIFICATION */}
        {myKtaDownloadToast && (
          <div className="mb-5 p-3.5 sm:p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                <Check className="w-4 h-4" />
              </div>
              <p className="text-xs sm:text-sm font-bold">{myKtaDownloadToast}</p>
            </div>
            <button
              type="button"
              onClick={() => setMyKtaDownloadToast(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Visual KTA Card (3D Flip Animation Front / Back with Member Profile Details & Skeleton Transition) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {isCardLoading ? (
              <div className="w-full max-w-md sm:max-w-lg aspect-[1.586/1] animate-in fade-in duration-300">
                <KtaCardSkeleton
                  side={isCardFlipped ? 'back' : 'front'}
                  statusText="Menghubungkan & Memvalidasi KTA Digital..."
                />
              </div>
            ) : (
              /* 3D Flip Card Perspective Container */
              <div
                onClick={() => setIsCardFlipped(!isCardFlipped)}
                className="w-full max-w-md sm:max-w-lg aspect-[1.586/1] relative cursor-pointer select-none group [perspective:1200px] animate-in fade-in duration-300"
                title="Klik untuk membalik kartu (Animasi 3D Flip Sisi Depan / Belakang)"
              >
                {/* Inner 3D Flipping Engine */}
                <div
                  className="w-full h-full relative rounded-2xl shadow-xl group-hover:shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] [transform-style:preserve-3d]"
                  style={{
                    transform: isCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* ================= SISI DEPAN (FRONT FACE) ================= */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl p-4 sm:p-5 text-white overflow-hidden border border-emerald-400/30 flex flex-col justify-between shadow-md [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
                    style={{
                      background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #0f172a 100%)',
                    }}
                  >
                    {/* Subtle pattern background */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

                    {/* Top Bar: Organization Branding & Flip Hint */}
                    <div className="flex justify-between items-start gap-2 border-b border-white/15 pb-2 relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-amber-300 shrink-0 shadow-inner">
                          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                          <p className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">
                            KARTU TANDA ANGGOTA RESMI
                          </p>
                          <h4 className="text-xs sm:text-sm font-black tracking-tight text-white line-clamp-1">
                            {settings.communityName || 'PAGUYUBAN DANA KEMATIAN'}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Interactive 3D Flip Hint Pill */}
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/15 backdrop-blur-xs text-emerald-200 border border-white/20 group-hover:bg-white/25 transition-colors">
                          <RotateCw className="w-2.5 h-2.5" />
                          <span>Klik 3D Flip</span>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase flex items-center gap-1 ${
                            member.status === 'Aktif' || member.isKtaIssued
                              ? 'bg-emerald-400/25 text-emerald-200 border border-emerald-400/40'
                              : 'bg-amber-400/25 text-amber-200 border border-amber-400/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              member.status === 'Aktif' || member.isKtaIssued
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-amber-400'
                            }`}
                          />
                          <span>{member.status === 'Aktif' || member.isKtaIssued ? 'RESMI' : member.status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle Area: Member NPA, Name, Cluster & Scannable QR Code */}
                    <div className="grid grid-cols-12 gap-2 my-auto py-1 items-center relative z-10">
                      <div className="col-span-8 space-y-1">
                        <span className="text-[8px] sm:text-[9px] font-mono tracking-wider text-emerald-200/80 block">
                          NOMOR POKOK ANGGOTA (NPA):
                        </span>
                        <p className="text-base sm:text-2xl font-mono font-black tracking-widest text-white drop-shadow-sm leading-none">
                          {member.memberNumber}
                        </p>
                        <h3 className="text-sm sm:text-lg font-black text-white line-clamp-1">
                          {member.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-emerald-100">
                          <span>Cluster: {member.cluster || '-'}</span>
                          <span>•</span>
                          <span className="font-mono">NIK: {member.nik}</span>
                        </div>
                      </div>

                      {/* QR Code thumbnail */}
                      <div className="col-span-4 flex flex-col items-center justify-center">
                        <div className="p-1 sm:p-1.5 bg-white rounded-xl shadow-md border-2 border-emerald-400/80">
                          <QRCodeSVG
                            value={qrPayload || member.memberNumber}
                            size={58}
                            level="M"
                            bgColor="#FFFFFF"
                            fgColor="#064e3b"
                          />
                        </div>
                        <span className="text-[7px] sm:text-[8px] font-bold text-emerald-300 mt-1 uppercase tracking-tighter text-center">
                          Scan Verifikasi
                        </span>
                      </div>
                    </div>

                    {/* Bottom Bar: Expiry & Protected Dependents */}
                    <div className="flex justify-between items-end text-[9px] sm:text-[10px] text-emerald-200/90 pt-1.5 border-t border-white/15 relative z-10">
                      <div>
                        <span className="block text-[7px] sm:text-[8px] text-emerald-300/70">MASA PERLINDUNGAN:</span>
                        <span className="font-mono font-bold text-white">
                          {expiry?.expiryDateFormatted || '31 Des 2026'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[7px] sm:text-[8px] text-emerald-300/70">TANGGUNGAN:</span>
                        <span className="font-bold text-white">
                          {(member.dependentsCount || 0) + 1} Jiwa Terlindungi
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ================= SISI BELAKANG (BACK FACE - DETAIL PROFIL & INFORMASI TAMBAHAN) ================= */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl p-3.5 sm:p-5 text-white overflow-hidden border border-teal-400/40 flex flex-col justify-between shadow-md [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]"
                    style={{
                      background: 'linear-gradient(135deg, #091e17 0%, #064e3b 50%, #022c22 100%)',
                    }}
                  >
                    {/* Subtle pattern background */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#34d399_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

                    {/* Back Header: Title & Flip Notice */}
                    <div className="flex justify-between items-center border-b border-white/15 pb-1.5 relative z-10">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-teal-300" />
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-teal-300">
                          DETAIL PROFIL & INFORMASI ANGGOTA
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/15 text-white border border-white/20">
                          {member.memberNumber}
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          <RotateCw className="w-2 h-2" />
                          <span>Klik Sisi Depan</span>
                        </span>
                      </div>
                    </div>

                    {/* Back Body: 2 Columns (Member Profile Details + Additional Info & Benefits) */}
                    <div className="grid grid-cols-12 gap-2 sm:gap-3 my-auto py-1 relative z-10 items-center">
                      {/* Left Column: Member Profile Details */}
                      <div className="col-span-7 space-y-1 text-[9px] sm:text-[10px]">
                        <div>
                          <span className="text-[7px] sm:text-[8px] text-teal-300/80 uppercase font-mono block">
                            Nama Lengkap Anggota:
                          </span>
                          <p className="font-black text-white text-[11px] sm:text-xs truncate leading-tight">
                            {member.name}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-1 font-mono text-[8px] sm:text-[9px] bg-black/20 p-1 sm:p-1.5 rounded-lg border border-white/10">
                          <div>
                            <span className="text-teal-300/70 block text-[7px]">NIK:</span>
                            <span className="text-white font-bold truncate block">{member.nik}</span>
                          </div>
                          <div>
                            <span className="text-teal-300/70 block text-[7px]">No. KK:</span>
                            <span className="text-white font-bold truncate block">{member.familyCardNumber || 'Terdaftar'}</span>
                          </div>
                          <div className="col-span-2 pt-0.5 border-t border-white/10 flex items-center justify-between text-[7px] sm:text-[8px]">
                            <span className="text-teal-300/70">Cluster & RT:</span>
                            <span className="text-emerald-300 font-bold">{member.cluster || '-'}</span>
                          </div>
                        </div>

                        {/* Covered Family Dependents */}
                        <div className="bg-emerald-950/40 p-1 sm:p-1.5 rounded-lg border border-emerald-500/20">
                          <div className="flex items-center justify-between text-[7px] sm:text-[8px] mb-0.5">
                            <span className="text-emerald-200 font-bold flex items-center gap-1">
                              <Users className="w-2.5 h-2.5 text-emerald-400" />
                              <span>Tanggungan Jiwa Terlindungi:</span>
                            </span>
                            <span className="font-bold text-amber-300">
                              {(member.dependentsCount || 0) + 1} Jiwa
                            </span>
                          </div>
                          {member.dependentsList && member.dependentsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {member.dependentsList.slice(0, 3).map((dep, idx) => (
                                <span
                                  key={dep.id || idx}
                                  className="px-1 py-0.2 rounded text-[7px] bg-white/10 text-emerald-100 border border-white/15 truncate max-w-[120px]"
                                >
                                  {dep.name} ({dep.relationship})
                                </span>
                              ))}
                              {member.dependentsList.length > 3 && (
                                <span className="px-1 py-0.2 rounded text-[7px] bg-emerald-500/20 text-emerald-300 font-bold">
                                  +{member.dependentsList.length - 3} lainnya
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[7px] text-teal-200/70 italic leading-tight">
                              Kepala Keluarga Terdaftar ({member.phone})
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Column: QR Code & Additional Protection Info */}
                      <div className="col-span-5 flex flex-col items-center justify-between space-y-1 text-center">
                        <div className="p-1 bg-white rounded-xl shadow-md border-2 border-teal-300/70 shrink-0">
                          <QRCodeSVG
                            value={qrPayload || member.memberNumber}
                            size={54}
                            level="M"
                            bgColor="#FFFFFF"
                            fgColor="#022c22"
                          />
                        </div>

                        <div className="text-[7px] sm:text-[8px] text-emerald-100/90 leading-tight space-y-0.5 w-full bg-black/25 p-1 rounded-lg border border-white/10 text-left">
                          <p className="font-bold text-amber-300 text-[8px] flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            <span>Hak Perlindungan:</span>
                          </p>
                          <p>• Ambulans Jenazah 24 Jam</p>
                          <p>• Santunan Duka Cita Cepat</p>
                          <p>• Perlengkapan Fardhu Kifayah</p>
                        </div>
                      </div>
                    </div>

                    {/* Back Footer: Legal Attestation & Contact Line */}
                    <div className="flex justify-between items-end text-[7px] sm:text-[8px] text-teal-200/90 pt-1 border-t border-white/15 relative z-10">
                      <div>
                        <span className="text-teal-300/70">Pengesahan:</span>
                        <p className="font-bold text-white leading-tight">
                          {ktaInfo?.issuedBy || 'Bendahara Paguyuban'}
                        </p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <span className="text-teal-300/70">Darurat Jenazah:</span>
                        <p className="font-bold text-amber-300 leading-tight">
                          {settings.treasurerPhone || '0812-3456-7890'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-teal-300/70">Status KTA:</span>
                        <p className="font-bold text-emerald-300 leading-tight">
                          {member.status === 'Aktif' || member.isKtaIssued ? 'Aktif & Sah' : member.status}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Card Controls below card */}
            <div className="flex items-center justify-center gap-2 mt-3 w-full max-w-md sm:max-w-lg">
              <button
                type="button"
                onClick={() => setIsCardFlipped(!isCardFlipped)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCw className={`w-3.5 h-3.5 text-emerald-600 transition-transform duration-500 ${isCardFlipped ? 'rotate-180' : ''}`} />
                <span>{isCardFlipped ? 'Tampilkan Depan' : 'Balik 3D (Detail Profil)'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshKta}
                disabled={isCardLoading}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                title="Sinkronisasi / Muat Ulang KTA"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isCardLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sinkronkan</span>
              </button>

              <button
                type="button"
                onClick={() => setIsKtaModalOpen(true)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                title="Pratinjau Layar Penuh KTA"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Layar Penuh</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQrGeneratorModalOpen(true)}
                className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                title="Buka Generator QR Code KTA Berdasarkan NPA"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">QR Code NPA</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCertModalOpen(true)}
                className={`py-2 px-3 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                  ktaInfo?.isIssued
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                }`}
                title={
                  ktaInfo?.isIssued
                    ? 'Buka & Cetak Sertifikat Keanggotaan Resmi (A4 Landscape)'
                    : 'Sertifikat bisa terbit setelah disetujui ketua paguyuban'
                }
              >
                {ktaInfo?.isIssued ? (
                  <Award className="w-3.5 h-3.5 text-amber-200" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                )}
                <span>{ktaInfo?.isIssued ? 'Sertifikat Resmi' : 'Sertifikat (Menunggu Ketua Paguyuban)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintKtaModalOpen(true)}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                title="Cetak Fisik / PDF"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Cetak PDF</span>
              </button>
            </div>
          </div>

          {/* Member Details & KTA Information Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  {member.memberNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    member.status === 'Aktif' || member.isKtaIssued
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : member.status === 'Menunggu Verifikasi RT'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : member.status === 'Menunggu Pembayaran'
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}
                >
                  {member.status === 'Aktif' || member.isKtaIssued ? 'KTA AKTIF & SAH' : member.status}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {member.name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span>{member.cluster || 'Cluster Warga'}</span>
                <span>•</span>
                <span>{member.phone || '-'}</span>
              </div>
            </div>

            {/* Quick Status Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Masa Perlindungan:</span>
                <span className="font-mono font-bold text-emerald-800">
                  {expiry?.expiryDateFormatted || '31 Des 2026'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Sisa Masa Aktif:</span>
                <span className="font-bold text-slate-800">
                  {expiry?.daysRemaining ? `${expiry.daysRemaining} Hari Lagi` : 'Aktif'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tanggungan Terdaftar:</span>
                <span className="font-bold text-slate-800">
                  {(member.dependentsCount || 0) + 1} Jiwa Terlindungi
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Pengesahan KTA:</span>
                <span className="font-bold text-slate-800">
                  {ktaInfo?.issuedBy || 'Bendahara Paguyuban'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadMyKta('front')}
                  disabled={downloadingMyKta}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloadingMyKta ? 'Menyiapkan...' : 'Unduh Gambar KTA (.png)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyKtaInfo}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Bagikan Data KTA ke WhatsApp"
                >
                  {copiedKta ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                  <span className="sm:inline">{copiedKta ? 'Tersalin' : 'Bagikan WA'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsContactAdminOpen(true)}
                  className="flex-1 py-2 px-3 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300 hover:border-emerald-300 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hubungi Pengurus</span>
                </button>

                {onNavigateToPayment && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPayment(member)}
                    className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Bayar Iuran</span>
                  </button>
                )}
              </div>

              {/* QR Code Sharing Widget Berdasarkan NPA */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/20 via-slate-900/40 to-teal-950/20 border border-emerald-500/30 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-700 rounded-lg">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">QR Code KTA Warga</h4>
                      <p className="text-[10px] text-slate-500 font-mono">Berdasarkan NPA: {member.memberNumber}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Bisa Scan HP
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Bagikan KTA Digital Anda kepada warga lain atau rumah sakit dengan cepat melalui QR Code unik.
                </p>
                <button
                  type="button"
                  onClick={() => setIsQrGeneratorModalOpen(true)}
                  className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.01] active:scale-95"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Buka Generator & Bagikan QR Code</span>
                </button>
              </div>
            </div>

            {/* Special status notice if not Aktif */}
            {member.status === 'Menunggu Pembayaran' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-2 text-blue-900 text-xs">
                <span className="font-semibold">Verifikasi berkas disetujui. Segera setor iuran kas untuk KTA resmi.</span>
                {onNavigateToPayment && (
                  <button
                    type="button"
                    onClick={() => onNavigateToPayment(member)}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold shrink-0 hover:bg-blue-500 cursor-pointer"
                  >
                    Bayar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* 3. MOBILE SEGMENTED PILL BAR (NAVIGASI TAB SLIDER) */}
      <div
        id="member-portal-sections"
        className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth"
      >
        <button
          type="button"
          onClick={() => handleSectionChange('semua')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'semua'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Semua (Beranda)</span>
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('kartu-anggota')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'kartu-anggota'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>1. KTA Saya</span>
          {member.isKtaIssued && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('galeri-kta')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'galeri-kta'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>2. Galeri KTA Saya</span>
          {isMyKtaActive ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono font-bold">
              Aktif
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('bayar-iuran')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'bayar-iuran'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>3. Bayar Iuran ({formatIDR(settings.annualFeeAmount || 300000)})</span>
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('nilai-manfaat')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'nilai-manfaat'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-amber-300" />
          <span>4. Nilai Manfaat Anggota</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono font-bold">
            s/d {formatIDR(maxBenefitAmount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('riwayat-pembayaran')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'riwayat-pembayaran'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>5. Riwayat Pembayaran</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {memberPayments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('riwayat-pendaftaran')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSection === 'riwayat-pendaftaran'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>6. Berkas & Tanggungan</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {member.statusHistory?.length || 1}
          </span>
        </button>
      </div>

      {/* 3. SECTION CONTENT */}

      {/* When filtering for KTA Saya specifically */}
      {activeSection === 'kartu-anggota' && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Kartu Tanda Anggota (KTA)</h4>
              <p className="text-xs text-slate-600">KTA resmi dan kode QR Anda ditampilkan pada bagian utama di atas halaman.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('member-kta-header');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Fokus ke KTA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================= GALERI KTA DIGITAL ANGGOTA (KHUSUS KTA PRIBADI) ================= */}
      {(activeSection === 'semua' || activeSection === 'galeri-kta') && (
        <div id="galeri-kta-section" className="space-y-4">
          <MemberKtaGallery
            members={member ? [member] : []}
            payments={payments}
            settings={settings}
            activeUser={activeUser}
            currentMember={member}
            onNavigateToPayment={onNavigateToPayment}
            onOpenPrintModal={() => setIsPrintKtaModalOpen(true)}
          />
        </div>
      )}

      {/* ================= 2. TOMBOL & STATUS BAYAR IURAN (TEPAT DI BAWAH KARTU ANGGOTA) ================= */}
      {(activeSection === 'semua' || activeSection === 'bayar-iuran') && (
        <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden border border-emerald-500/30">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 inline-flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Layanan Pembayaran Iuran</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    member.status === 'Aktif'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                      : member.status === 'Menunggu Pembayaran'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                      : (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending')
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                      : 'bg-slate-500/20 text-slate-200 border border-slate-400/30'
                  }`}
                >
                  {member.status === 'Aktif'
                    ? `Perlindungan Aktif s/d ${expiry?.expiryDateFormatted || '-'}`
                    : member.status === 'Menunggu Pembayaran'
                    ? 'Verifikasi RT Berhasil — Siap Bayar Iuran'
                    : (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending')
                    ? 'Menunggu Verifikasi RT — Belum Dapat Bayar'
                    : member.status}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {member.status === 'Aktif'
                  ? 'Bayar / Perpanjang Iuran Kas Paguyuban'
                  : member.status === 'Menunggu Pembayaran'
                  ? 'Verifikasi RT Selesai — Bayar Iuran Sekarang'
                  : (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending')
                  ? 'Pendaftaran Baru Menunggu Verifikasi RT'
                  : 'Layanan Pembayaran Iuran'}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {member.status === 'Aktif'
                  ? 'Setorkan iuran kas tahunan untuk memperpanjang masa aktif perlindungan santunan keluarga Anda. Pembayaran akan otomatis diverifikasi bendahara dan menerbitkan kwitansi resmi.'
                  : member.status === 'Menunggu Pembayaran'
                  ? 'Pendaftaran Anda telah disetujui RT. Lakukan pembayaran iuran tahunan sekarang agar diteruskan ke Ketua Paguyuban untuk penerbitan Sertifikat Resmi & KTA.'
                  : (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending')
                  ? 'Sesuai regulasi: Pendaftar baru bisa melakukan pembayaran setelah verifikasi dari RT. Berkas Anda sedang dalam proses verifikasi oleh Ketua RT setempat.'
                  : 'Iuran tahunan paguyuban dana kematian untuk menjamin perlindungan pemakaman, ambulans jenazah, dan santunan tunai duka cita.'}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-2 text-xs">
                {/* Besaran Iuran Resmi dari Pengaturan Kas oleh Admin */}
                <div className="flex items-center gap-2 bg-emerald-500/25 border border-emerald-400/40 px-3.5 py-1.5 rounded-xl shadow-xs">
                  <Coins className="w-4 h-4 text-emerald-300" />
                  <span className="text-emerald-100 font-medium">
                    Iuran Resmi:{' '}
                    <strong className="text-white font-black text-sm">
                      {formatIDR(settings.annualFeeAmount || 300000)}
                    </strong>{' '}
                    / Tahun
                  </span>
                  <span className="text-[10px] text-emerald-200/80 font-mono">
                    (~{formatIDR(settings.monthlyFeeAmount || Math.round((settings.annualFeeAmount || 300000) / 12))}/bln)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleSectionChange('nilai-manfaat')}
                  className="flex items-center gap-1.5 bg-amber-400/20 hover:bg-amber-400/30 px-3 py-1.5 rounded-xl border border-amber-400/30 text-amber-200 font-bold cursor-pointer transition-colors"
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-amber-300" />
                  <span>Nilai Manfaat: <strong className="text-white">s/d {formatIDR(maxBenefitAmount)}</strong></span>
                </button>

                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xs text-emerald-200/90 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Metode: Transfer Bank, QRIS Instan & Tunai</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 w-full lg:w-auto shrink-0">
              {onNavigateToPayment && (
                member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending' ? (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-4 bg-slate-800/90 text-amber-300 font-bold text-xs sm:text-sm rounded-2xl border border-amber-500/30 cursor-not-allowed flex items-center justify-center gap-2 shadow-inner"
                    title="Pendaftar baru bisa melakukan pembayaran setelah verifikasi dari RT"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Belum Dapat Bayar (Menunggu Verifikasi RT)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateToPayment(member)}
                    className="px-7 py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-950/40 transition-all flex items-center justify-center gap-3 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    title="Klik untuk membuka form bayar iuran kas paguyuban"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>
                      {member.status === 'Aktif'
                        ? 'Bayar / Perpanjang Iuran'
                        : 'Bayar Iuran Sekarang'}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setIsContactAdminOpen(true)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                <span>Konfirmasi via WhatsApp Bendahara</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2b. NILAI MANFAAT MENJADI ANGGOTA ================= */}
      {(activeSection === 'semua' || activeSection === 'nilai-manfaat') && (
        <div id="section-nilai-manfaat" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>Hak & Perlindungan Warga</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Resmi Sesuai AD/ART
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <HeartHandshake className="w-6 h-6 text-amber-600" />
                <span>Nilai Manfaat Menjadi Anggota Paguyuban</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Hak santunan duka cita, fasilitas pemakaman lengkap, dan layanan ambulans untuk Anda & seluruh keluarga yang tercatat resmi.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onNavigateToPayment && (
                <button
                  type="button"
                  onClick={() => onNavigateToPayment(member)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Bayar Iuran ({formatIDR(settings.annualFeeAmount || 300000)}/Thn)</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Highlight Statistic Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Besaran Iuran Pengaturan Kas */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black tracking-wider uppercase text-emerald-800">
                  Iuran Kas Warga
                </span>
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-mono font-black text-emerald-950">
                {formatIDR(settings.annualFeeAmount || 300000)}
              </p>
              <p className="text-xs font-bold text-emerald-700 mt-0.5">
                per 1 Tahun (~{formatIDR(settings.monthlyFeeAmount || Math.round((settings.annualFeeAmount || 300000) / 12))}/bln)
              </p>
              <p className="text-[10px] text-slate-500 mt-2 border-t border-emerald-200/60 pt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Diatur dari Pengaturan Sistem oleh Admin</span>
              </p>
            </div>

            {/* Card 2: Nilai Total Paket Santunan */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black tracking-wider uppercase text-amber-800">
                  Nilai Paket Manfaat
                </span>
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-mono font-black text-amber-950">
                Hingga {formatIDR(maxBenefitAmount)}
              </p>
              <p className="text-xs font-bold text-amber-700 mt-0.5">
                per peristiwa duka cita keluarga
              </p>
              <p className="text-[10px] text-slate-500 mt-2 border-t border-amber-200/60 pt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                <span>Santunan tunai + paket layanan pemakaman</span>
              </p>
            </div>

            {/* Card 3: Tanggungan Keluarga */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black tracking-wider uppercase text-blue-800">
                  Keluarga Terlindungi
                </span>
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-mono font-black text-blue-950">
                {(member.dependentsCount || 0) + 1} Jiwa
              </p>
              <p className="text-xs font-bold text-blue-700 mt-0.5">
                1 Kartu Keluarga (KK) Resmi
              </p>
              <p className="text-[10px] text-slate-500 mt-2 border-t border-blue-200/60 pt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                <span>Semua jiwa terdaftar berhak atas santunan</span>
              </p>
            </div>

            {/* Card 4: Status Perlindungan Anda */}
            <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs relative overflow-hidden ${
              member.status === 'Aktif'
                ? 'bg-gradient-to-br from-teal-50 to-emerald-50/50 border-teal-200/80'
                : 'bg-gradient-to-br from-rose-50 to-amber-50/50 border-rose-200/80'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black tracking-wider uppercase text-slate-800">
                  Status Manfaat Saya
                </span>
                <div className={`p-2 rounded-xl ${member.status === 'Aktif' ? 'bg-teal-100 text-teal-700' : 'bg-rose-100 text-rose-700'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-xl sm:text-2xl font-mono font-black ${member.status === 'Aktif' ? 'text-teal-950' : 'text-rose-950'}`}>
                {member.status === 'Aktif' ? 'Hak Santunan Aktif' : 'Menunggu Setoran'}
              </p>
              <p className={`text-xs font-bold mt-0.5 ${member.status === 'Aktif' ? 'text-teal-700' : 'text-rose-700'}`}>
                {member.status === 'Aktif' ? `Berlaku s/d ${expiry?.expiryDateFormatted || '-'}` : 'Segera setor iuran tahunan'}
              </p>
              <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-200/60 pt-1.5 flex items-center gap-1">
                <CheckCircle2 className={`w-3 h-3 ${member.status === 'Aktif' ? 'text-teal-600' : 'text-rose-600'}`} />
                <span>{member.status === 'Aktif' ? 'Terverifikasi pengurus & bendahara' : 'KTA & manfaat belum aktif'}</span>
              </p>
            </div>
          </div>

          {/* Rincian Paket Manfaat Per Kategori Keluarga */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Rincian Paket & Fasilitas Layanan Duka
                </h3>
                <p className="text-xs text-slate-500">
                  Fasilitas yang disediakan otomatis oleh paguyuban saat terjadi musibah pada anggota keluarga.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {effectiveBenefits.length} Kategori Penerima
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {effectiveBenefits.map((benefit, idx) => {
                const color = benefit.badgeColor || 'emerald';
                const isHighlight = benefit.targetRelationship === 'Anggota Utama' || idx === 0;

                return (
                  <div
                    key={benefit.id || idx}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                      isHighlight
                        ? 'border-amber-300 bg-amber-50/20 shadow-md ring-1 ring-amber-400/30'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md'
                    }`}
                  >
                    {isHighlight && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl shadow-xs">
                        Penerima Utama
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-1.5 ${
                          color === 'teal'
                            ? 'bg-teal-100 text-teal-800'
                            : color === 'amber' || isHighlight
                            ? 'bg-amber-100 text-amber-900'
                            : color === 'blue'
                            ? 'bg-blue-100 text-blue-800'
                            : color === 'purple'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {benefit.targetRelationship || benefit.categoryName}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 leading-snug">
                          {benefit.categoryName}
                        </h4>
                      </div>

                      {/* Nominal Box */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            Total Paket Manfaat:
                          </span>
                          <span className="text-base font-mono font-black text-slate-950">
                            {formatIDR(benefit.defaultTotalPackage || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-slate-100 pt-1">
                          <span className="text-[10px] text-slate-500">Santunan Tunai Ahli Waris:</span>
                          <span className="text-xs font-mono font-extrabold text-emerald-700">
                            {formatIDR(benefit.maxCashAmount || 0)}
                          </span>
                        </div>
                        {benefit.waitingPeriodDays !== undefined && (
                          <div className="flex justify-between items-baseline border-t border-slate-100 pt-1 text-[10px] text-slate-400">
                            <span>Masa Tunggu:</span>
                            <span className="font-semibold text-slate-600">{benefit.waitingPeriodDays} Hari</span>
                          </div>
                        )}
                      </div>

                      {/* Services Included */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                          Fasilitas & Layanan Ditanggung:
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-700">
                          {(benefit.servicesIncluded || [
                            'Santunan Duka Tunai Cepat untuk Ahli Waris',
                            'Mobil Jenazah / Ambulans Gratis 24 Jam',
                            'Peralatan Memandikan & Kain Kafan Lengkap',
                            'Tenaga Gali Kubur & Pengurusan Pemakaman',
                            'Tenda Duka & Kursi Takziah Warga',
                          ]).map((service, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="text-[11px] leading-tight text-slate-700">{service}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Iuran Terkover:</span>
                      <span className="font-black text-emerald-800">
                        Termasuk dalam iuran {formatIDR(settings.annualFeeAmount || 300000)}/thn
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Banner Bantuan & Info Klaim */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">
                  Layanan Duka Cita & Pengajuan Santunan 24 Jam
                </h4>
                <p className="text-xs text-slate-300">
                  Hubungi pengurus atau Bendahara ({settings.treasurerName || 'Pengurus Paguyuban'}: {settings.treasurerPhone || '-'}) segera jika terjadi kedukaan.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsContactAdminOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer flex items-center gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Hubungi Pengurus Paguyuban</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 3. RIWAYAT PEMBAYARAN & KWITANSI ================= */}
      {(activeSection === 'semua' || activeSection === 'riwayat-pembayaran') && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" />
                <span>Riwayat Pembayaran & Kwitansi Iuran</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar lengkap transaksi setoran iuran kas warga dan kwitansi resmi yang dapat diunduh.
              </p>
            </div>

            {onNavigateToPayment && (
              <button
                type="button"
                onClick={() => onNavigateToPayment(member)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Bayar Iuran Baru</span>
              </button>
            )}
          </div>

          {/* Statistik Pembayaran Ringkas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 block">Total Iuran Terverifikasi</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono block">
                {formatIDR(totalPaid)}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium block">
                {verifiedPaymentsCount} transaksi terverifikasi lunas
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-600 block">Status Pembayaran Terakhir</span>
              <span className="text-base sm:text-lg font-black text-slate-900 block">
                {memberPayments.length > 0 ? memberPayments[0].type || 'Iuran Tahunan' : 'Belum Ada'}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {memberPayments.length > 0 ? `Tanggal: ${memberPayments[0].date}` : 'Belum ada transaksi'}
              </span>
            </div>

            <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-1">
              <span className="text-[11px] font-bold text-blue-800 block">Masa Perlindungan Iuran</span>
              <span className="text-base sm:text-lg font-black text-blue-950 block">
                {expiry?.expiryDateFormatted || 'Belum Terdaftar'}
              </span>
              <span className="text-[10px] text-blue-700 font-medium block">
                {expiry?.statusLabel || 'Menunggu Aktivasi'}
              </span>
            </div>
          </div>

          {/* Filter Status Pembayaran */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5">
              {(['Semua', 'Verified', 'Pending', 'Rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setPaymentFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paymentFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st === 'Semua'
                    ? `Semua (${memberPayments.length})`
                    : st === 'Verified'
                    ? `Lunas (${verifiedPaymentsCount})`
                    : st === 'Pending'
                    ? `Menunggu (${pendingPaymentsCount})`
                    : 'Ditolak'}
                </button>
              ))}
            </div>
          </div>

          {/* DAFTAR TRANSAKSI PEMBAYARAN */}
          {filteredMemberPayments.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
              <Coins className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">Belum Ada Riwayat Pembayaran</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {member.status === 'Menunggu Verifikasi RT'
                  ? 'Setelah pendaftaran Anda disetujui oleh Ketua RT, Anda dapat melakukan pembayaran iuran tahunan di sini.'
                  : 'Silakan lakukan penyetoran iuran kas tahunan untuk mengaktifkan perlindungan dana kematian warga.'}
              </p>
              {onNavigateToPayment && member.status !== 'Menunggu Verifikasi RT' && (
                <button
                  type="button"
                  onClick={() => onNavigateToPayment(member)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Bayar Iuran Pertama Sekarang</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMemberPayments.map((payment) => {
                const isVerified = (payment.status || 'Verified') === 'Verified';
                const isPending = payment.status === 'Pending';
                const isRejected = payment.status === 'Rejected';

                return (
                  <div
                    key={payment.id}
                    className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{payment.type}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            isVerified
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isPending
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {isVerified ? 'Lunas / Terverifikasi' : isPending ? 'Menunggu Validasi' : 'Ditolak'}
                        </span>
                        {payment.period && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                            Periode {payment.period}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Tanggal: <strong className="text-slate-700">{payment.date}</strong></span>
                        <span>•</span>
                        <span>Metode: <strong className="text-slate-700">{payment.method}</strong></span>
                        {payment.receiptNumber && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-slate-700">Kwitansi: {payment.receiptNumber}</span>
                          </>
                        )}
                      </div>

                      {payment.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 max-w-xl">
                          Catatan: {payment.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-500 block font-bold">Nominal</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                          {formatIDR(payment.amount)}
                        </span>
                      </div>

                      {isVerified && (
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptPayment(payment)}
                          className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white font-extrabold text-xs rounded-xl border border-emerald-300 hover:border-emerald-600 transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                          title="Lihat & Download Kwitansi Resmi Pembayaran"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Kwitansi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= 4. LAIN-LAIN: RIWAYAT PENDAFTARAN & STATUS VERIFIKASI ================= */}
      {(activeSection === 'semua' || activeSection === 'riwayat-pendaftaran') && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span>Riwayat Pendaftaran & Status Verifikasi</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Jejak audit status keanggotaan sejak pendaftaran diajukan, diverifikasi RT, hingga disahkan.
              </p>
            </div>

            {member.familyCardPhotoUrl && (
              <button
                type="button"
                onClick={() => setIsKkModalOpen(true)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lihat Berkas Kartu Keluarga (KK)</span>
              </button>
            )}
          </div>

          {/* Data Pendaftaran Ringkas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Nomor Kependudukan (NIK)</span>
              <span className="text-xs sm:text-sm font-mono font-black text-slate-900 block">{member.nik}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Nomor Kartu Keluarga (KK)</span>
              <span className="text-xs sm:text-sm font-mono font-black text-slate-900 block">
                {member.familyCardNumber || 'Terlampir dalam foto'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Cluster & Domisili</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 block">{member.cluster || '-'}</span>
              <span className="text-[11px] text-slate-500 block truncate">{member.address}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Tanggungan Terlindungi</span>
              <span className="text-xs sm:text-sm font-black text-emerald-800 block">
                {(member.dependentsCount || 0) + 1} Jiwa
              </span>
              <span className="text-[11px] text-slate-500 block">
                (1 Kepala Keluarga + {member.dependentsCount || 0} Tanggungan)
              </span>
            </div>
          </div>

          {/* Daftar Anggota Keluarga Terdaftar */}
          {member.dependentsList && member.dependentsList.length > 0 && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Daftar Tanggungan Keluarga Terdaftar</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {member.dependentsList.map((dep, idx) => (
                  <div
                    key={dep.id || idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-bold">{dep.name}</strong>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {dep.relationship}
                      </span>
                    </div>
                    {dep.age && <p className="text-slate-500 text-[11px]">Usia: {dep.age} tahun</p>}
                    <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>Mendapat Jaminan Santunan</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIMELINE STATUS AUDIT INTERAKTIF */}
          <div className="pt-2">
            <MemberStatusTimeline
              member={member}
              payments={payments}
              isCollapsible={false}
              defaultExpanded={true}
              onNavigateToPayment={onNavigateToPayment ? () => onNavigateToPayment(member) : undefined}
            />
          </div>
        </div>
      )}

      {/* 4. MODALS */}

      {/* Fullscreen Digital KTA Modal */}
      {isKtaModalOpen && (
        <DigitalKtaModal
          isOpen={isKtaModalOpen}
          onClose={() => setIsKtaModalOpen(false)}
          member={member}
          payments={payments}
          settings={settings}
          onSelectMemberForPayment={onNavigateToPayment}
          onOpenPrintCardModal={() => {
            setIsKtaModalOpen(false);
            setIsPrintKtaModalOpen(true);
          }}
        />
      )}

      {/* Print Member Card Modal */}
      {isPrintKtaModalOpen && (
        <PrintMemberCardModal
          isOpen={isPrintKtaModalOpen}
          onClose={() => setIsPrintKtaModalOpen(false)}
          member={member}
          settings={settings}
          payments={payments}
        />
      )}

      {/* Family Card (KK) Photo Modal */}
      {isKkModalOpen && member && (
        <FamilyCardModal
          isOpen={isKkModalOpen}
          onClose={() => setIsKkModalOpen(false)}
          member={member}
        />
      )}

      {/* Official Receipt Modal */}
      {selectedReceiptPayment && (
        <ReceiptModal
          payment={selectedReceiptPayment}
          member={member}
          settings={settings}
          activeUser={activeUser || undefined}
          isOpen={Boolean(selectedReceiptPayment)}
          onClose={() => setSelectedReceiptPayment(null)}
        />
      )}

      {/* Contact Admin Modal */}
      {isContactAdminOpen && (
        <ContactAdminModal
          isOpen={isContactAdminOpen}
          onClose={() => setIsContactAdminOpen(false)}
          member={member}
          users={users}
          settings={settings}
          defaultAdminRole="Bendahara"
          defaultTopic="iuran"
        />
      )}

      {/* Member KTA QR Code Generator Modal */}
      {isQrGeneratorModalOpen && member && (
        <MemberKtaQrGeneratorModal
          isOpen={isQrGeneratorModalOpen}
          onClose={() => setIsQrGeneratorModalOpen(false)}
          member={member}
          settings={settings}
          payments={payments}
        />
      )}

      {/* Official Membership Certificate Modal */}
      {isCertModalOpen && member && (
        <MembershipCertificateModal
          isOpen={isCertModalOpen}
          onClose={() => setIsCertModalOpen(false)}
          member={member}
          payments={payments}
          settings={settings}
          onOpenKtaModal={() => setIsKtaModalOpen(true)}
        />
      )}


    </div>
  );
};
