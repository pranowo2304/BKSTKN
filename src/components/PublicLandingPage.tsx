import React, { useState, useEffect, useMemo } from 'react';
import {
  Member,
  Payment,
  BenefitClaim,
  SystemSettings,
  ClusterMaster,
  AppUser,
  PaymentType,
  PaymentMethod,
  Dependent,
  BenefitMaster,
  DEFAULT_BENEFITS,
} from '../types';
import { formatIDR } from '../lib/storage';
import { calculateMemberExpiry } from '../lib/expiryUtils';
import { getMemberKtaIssuanceInfo } from '../lib/ktaUtils';
import { FamilyCardUploader } from './FamilyCardUploader';
import {
  HeartHandshake,
  ShieldCheck,
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  CreditCard,
  Phone,
  MessageCircle,
  HelpCircle,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  FileCheck,
  UserPlus,
  Send,
  Upload,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  Landmark,
  ShieldAlert,
  Download,
  Printer,
  ChevronRight,
  Coins,
  Smile,
  Lock,
  LogIn,
  LogOut,
  User,
  Home,
  Eye,
  EyeOff,
  Bell,
  Copy,
  Info,
  Camera,
  Mail,
} from 'lucide-react';
import { DigitalKtaModal } from './DigitalKtaModal';
import { KtaScannerModal } from './KtaScannerModal';
import { MemberKtaQrGeneratorModal } from './MemberKtaQrGeneratorModal';
import { UserLoginForm } from './UserLoginForm';
import { AppIcon } from './AppIcon';

interface PublicLandingPageProps {
  members: Member[];
  payments: Payment[];
  claims: BenefitClaim[];
  settings: SystemSettings;
  clusters: ClusterMaster[];
  benefits?: BenefitMaster[];
  users: AppUser[];
  activeUser?: AppUser | null;
  financials: {
    totalBalance: number;
    totalIncomeVerified: number;
    totalPendingIncome: number;
    totalBenefitSpent: number;
    totalIncome?: number;
    totalExpenses?: number;
    currentBalance?: number;
    baseFundBalance?: number;
  };
  onRegisterMember: (newMember: Member) => void;
  onMakePayment: (payment: Payment) => void;
  onNavigateToInternal: () => void;
  onOpenKtaModal?: (member: Member) => void;
  onLoginSuccess?: (user: AppUser) => void;
  onLogout?: () => void;
  onOpenLoginModal?: () => void;
  initialOpenRegister?: boolean;
  onRegisterStateChange?: (isOpen: boolean) => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  members,
  payments,
  claims,
  settings,
  clusters,
  benefits = DEFAULT_BENEFITS,
  users,
  activeUser,
  financials,
  onRegisterMember,
  onMakePayment,
  onNavigateToInternal,
  onOpenKtaModal,
  onLoginSuccess,
  onLogout,
  onOpenLoginModal,
  initialOpenRegister = false,
  onRegisterStateChange,
}) => {
  // Navigation within landing page
  const [activeSection, setActiveSection] = useState<'beranda' | 'cek-status' | 'daftar' | 'manfaat' | 'login' | 'kontak'>('beranda');

  // Mobile App specific UI state
  const [showBalance, setShowBalance] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'daftar' | 'status' | 'manfaat' | 'wilayah' | 'faq'>('all');
  const [activeMobileNav, setActiveMobileNav] = useState<'beranda' | 'status' | 'daftar' | 'manfaat' | 'akun'>('beranda');
  const [copiedBank, setCopiedBank] = useState(false);

  // Dynamic greeting based on time of day for mobile app feel
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }, []);

  // Smooth scroll and focus navigation helper
  const navigateToSection = (
    sectionId: string,
    options?: { openRegister?: boolean; filter?: typeof activeFilter; mobileNav?: typeof activeMobileNav }
  ) => {
    if (options?.openRegister) {
      setIsRegistering(true);
    }
    if (options?.filter) {
      setActiveFilter(options.filter);
    }
    if (options?.mobileNav) {
      setActiveMobileNav(options.mobileNav);
    }
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        const navOffset = 100;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }, 60);
  };

  // Search & Status Check State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Member | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedKtaMember, setSelectedKtaMember] = useState<Member | null>(null);
  const [selectedQrGeneratorMember, setSelectedQrGeneratorMember] = useState<Member | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Self-service Registration Form State
  const DRAFT_STORAGE_KEY = 'dana_kematian_public_reg_draft_v2';

  const [isRegistering, setIsRegistering] = useState(initialOpenRegister);

  // Sync initialOpenRegister prop changes
  useEffect(() => {
    if (initialOpenRegister) {
      setIsRegistering(true);
      setActiveMobileNav('daftar');
      const timer = setTimeout(() => {
        const el = document.getElementById('section-daftar');
        if (el) {
          const navOffset = 90;
          const elementPosition = el.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - navOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialOpenRegister]);

  // Global event listener for opening registration form (from bottom dock, buttons, or external links)
  useEffect(() => {
    const handleOpenRegister = () => {
      setIsRegistering(true);
      setActiveMobileNav('daftar');
      
      const scrollToForm = () => {
        const el = document.getElementById('section-daftar');
        if (el) {
          const navOffset = 90;
          const elementPosition = el.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - navOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });
          const firstInput = el.querySelector('input') as HTMLInputElement | null;
          if (firstInput) {
            firstInput.focus();
          }
          return true;
        }
        return false;
      };

      if (!scrollToForm()) {
        setTimeout(scrollToForm, 60);
        setTimeout(scrollToForm, 180);
        setTimeout(scrollToForm, 350);
      }
    };

    window.addEventListener('open-public-registration', handleOpenRegister);

    // Also check URL hash if opened directly with #section-daftar or #daftar
    if (typeof window !== 'undefined' && (window.location.hash === '#section-daftar' || window.location.hash === '#daftar')) {
      handleOpenRegister();
    }

    return () => {
      window.removeEventListener('open-public-registration', handleOpenRegister);
    };
  }, []);

  // Notify parent of registration open state
  useEffect(() => {
    if (onRegisterStateChange) {
      onRegisterStateChange(isRegistering);
    }
  }, [isRegistering, onRegisterStateChange]);
  const [regSuccess, setRegSuccess] = useState<Member | null>(null);
  const [regForm, setRegForm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY) || localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            name: parsed.name || '',
            nik: parsed.nik || '',
            phone: parsed.phone || '',
            address: parsed.address || '',
            cluster: parsed.cluster || clusters[0]?.name || 'Cluster Sanur',
            dependents: Array.isArray(parsed.dependents) ? parsed.dependents : [],
            notes: parsed.notes || '',
            familyCardPhotoUrl: parsed.familyCardPhotoUrl || '',
            familyCardFileName: parsed.familyCardFileName || '',
            familyCardNumber: parsed.familyCardNumber || '',
            email: parsed.email || '',
            password: parsed.password || '',
          };
        }
      }
    } catch (e) {
      console.warn('Could not parse registration draft:', e);
    }
    return {
      name: '',
      nik: '',
      phone: '',
      email: '',
      password: '',
      address: '',
      cluster: clusters[0]?.name || 'Cluster Sanur',
      dependents: [] as Dependent[],
      notes: '',
      familyCardPhotoUrl: '',
      familyCardFileName: '',
      familyCardNumber: '',
    };
  });

  const [regFamilyCardFile, setRegFamilyCardFile] = useState<File | null>(null);
  const [showPublicRegPassword, setShowPublicRegPassword] = useState(false);

  // Save draft whenever regForm changes
  useEffect(() => {
    const hasData = Boolean(
      regForm.name ||
        regForm.nik ||
        regForm.phone ||
        regForm.address ||
        regForm.familyCardPhotoUrl ||
        regForm.dependents.length > 0
    );
    if (hasData) {
      try {
        const sanitizedDraft = {
          ...regForm,
          // Exclude large base64 data URLs from storage draft to prevent browser QuotaExceededError
          familyCardPhotoUrl:
            regForm.familyCardPhotoUrl && regForm.familyCardPhotoUrl.length < 120000
              ? regForm.familyCardPhotoUrl
              : '',
        };
        const draftStr = JSON.stringify(sanitizedDraft);
        try {
          sessionStorage.setItem(DRAFT_STORAGE_KEY, draftStr);
        } catch {
          // ignore session quota warning
        }
        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, draftStr);
        } catch {
          // ignore local quota warning
        }
      } catch (e) {
        console.warn('Draft save error:', e);
      }
    }
  }, [regForm]);

  // Window drag & drop prevention to stop file drop navigation
  useEffect(() => {
    const preventFileDropNav = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventFileDropNav);
    window.addEventListener('drop', preventFileDropNav);
    return () => {
      window.removeEventListener('dragover', preventFileDropNav);
      window.removeEventListener('drop', preventFileDropNav);
    };
  }, []);

  const handleCloseRegisterForm = () => {
    setIsRegistering(false);
    setRegSuccess(null);
    setActiveMobileNav('beranda');
    setTimeout(() => {
      const menuEl = document.getElementById('section-menu-mobile') || document.getElementById('top');
      menuEl?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleResetDraft = () => {
    if (window.confirm('Hapus draf formulir dan mulai dari awal?')) {
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      setRegFamilyCardFile(null);
      setRegForm({
        name: '',
        nik: '',
        phone: '',
        email: '',
        password: '',
        address: '',
        cluster: clusters[0]?.name || 'Cluster Sanur',
        dependents: [],
        notes: '',
        familyCardPhotoUrl: '',
        familyCardFileName: '',
        familyCardNumber: '',
      });
    }
  };

  // Dependent Form State for Registration
  const [tempDepName, setTempDepName] = useState('');
  const [tempDepRel, setTempDepRel] = useState('Suami/Istri');
  const [tempDepAge, setTempDepAge] = useState('');

  // Self-service Payment Modal from Status Check
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingMember, setPayingMember] = useState<Member | null>(null);
  const [payType, setPayType] = useState<PaymentType>('Iuran Tahunan');
  const [payAmount, setPayAmount] = useState<number>(settings.annualFeeAmount || 300000);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Transfer BCA');
  const [payProofImage, setPayProofImage] = useState<string | null>(null);
  const [payProofFileName, setPayProofFileName] = useState('');
  const [paySuccessMsg, setPaySuccessMsg] = useState(false);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Active Clusters
  const activeClustersList = useMemo(() => {
    return clusters.filter((c) => c.isActive);
  }, [clusters]);

  // Statistics calculation
  const totalVerifiedMembers = members.filter(
    (m) => m.status === 'Aktif' || m.verificationStatus === 'Verified'
  ).length;
  const totalClaimsPaid = claims.reduce((acc, c) => acc + (c.amount || 0), 0);

  // Handle Search Member
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    setHasSearched(true);
    const found = members.find((m) => {
      const matchNik = m.nik && m.nik.toLowerCase() === query;
      const matchPhone = m.phone && m.phone.replace(/[^0-9]/g, '') === query.replace(/[^0-9]/g, '');
      const matchName = m.name && m.name.toLowerCase().includes(query);
      const matchNo = m.memberNumber && m.memberNumber.toLowerCase() === query;
      return matchNik || matchPhone || matchName || matchNo;
    });

    setSearchResult(found || null);
  };

  // Handle Add Dependent
  const handleAddTempDependent = () => {
    if (!tempDepName.trim()) return;
    setRegForm({
      ...regForm,
      dependents: [
        ...regForm.dependents,
        {
          id: 'dep-' + Date.now(),
          name: tempDepName.trim(),
          relationship: tempDepRel,
          age: tempDepAge ? parseInt(tempDepAge, 10) : undefined,
        },
      ],
    });
    setTempDepName('');
    setTempDepAge('');
  };

  const handleRemoveTempDependent = (id: string) => {
    setRegForm({
      ...regForm,
      dependents: regForm.dependents.filter((d) => d.id !== id),
    });
  };

  // Handle Registration Submit
  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.nik.trim() || !regForm.phone.trim() || !regForm.address.trim()) {
      alert('Mohon lengkapi Nama Lengkap, NIK, No. WhatsApp, dan Alamat Rumah!');
      return;
    }

    if (!regForm.email?.trim() || !regForm.password?.trim()) {
      alert('Mohon isi Email dan Kata Sandi Akun untuk login ke Halaman Anggota!');
      return;
    }

    if (!regForm.familyCardPhotoUrl) {
      alert('Pendaftaran warga wajib melampirkan foto Kartu Keluarga (KK) asli untuk proses verifikasi keabsahan oleh Ketua RT.');
      return;
    }

    // Check duplicate NIK
    const existing = members.find((m) => m.nik === regForm.nik.trim());
    if (existing) {
      alert(`NIK ${regForm.nik} sudah terdaftar atas nama ${existing.name}. Silakan cek status keanggotaan Anda.`);
      setSearchQuery(existing.nik);
      handleSearch();
      setActiveSection('cek-status');
      return;
    }

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newMemberNumber = `DK-${year}${month}-${randomSuffix}`;

    const newMember: Member = {
      id: 'mem-' + Date.now(),
      memberNumber: newMemberNumber,
      name: regForm.name.trim(),
      nik: regForm.nik.trim(),
      email: regForm.email.trim().toLowerCase(),
      password: regForm.password.trim(),
      familyCardNumber: regForm.familyCardNumber.trim() || undefined,
      familyCardPhotoUrl: regForm.familyCardPhotoUrl,
      familyCardFileName: regForm.familyCardFileName || `Kartu_Keluarga_${regForm.name.trim().replace(/\s+/g, '_')}.jpg`,
      phone: regForm.phone.trim(),
      cluster: regForm.cluster,
      address: regForm.address.trim(),
      joinDate: new Date().toISOString().split('T')[0],
      status: 'Menunggu Verifikasi RT',
      verificationStatus: 'Pending',
      dependentsCount: regForm.dependents.length,
      dependentsList: regForm.dependents,
      notes: regForm.notes ? `Pendaftaran Mandiri: ${regForm.notes}` : 'Pendaftaran mandiri via Portal Warga',
    };

    onRegisterMember(newMember);
    setRegSuccess(newMember);
    setIsRegistering(true); // Keep registration container open so user sees registration number and success confirmation!

    // Clear saved draft from storage
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }

    // Reset form
    setRegFamilyCardFile(null);
    setRegForm({
      name: '',
      nik: '',
      phone: '',
      address: '',
      cluster: clusters[0]?.name || 'Cluster Sanur',
      dependents: [],
      notes: '',
      familyCardPhotoUrl: '',
      familyCardFileName: '',
      familyCardNumber: '',
    });
  };

  // Handle Public Payment Proof Upload
  const handleProofImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPayProofFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPayProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenPaymentForMember = (member: Member) => {
    if (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending') {
      alert('Pendaftaran Anda masih dalam status "Menunggu Verifikasi RT". Sesuai alur resmi, Anda baru dapat melakukan pembayaran dan mengunggah bukti transfer setelah disetujui oleh Ketua RT di cluster/wilayah Anda.');
      return;
    }
    if (member.status === 'Ditolak' || member.verificationStatus === 'Rejected') {
      alert('Pendaftaran Anda tidak disetujui oleh Ketua RT. Tidak dapat melakukan pembayaran.');
      return;
    }
    setPayingMember(member);
    setPayType('Iuran Tahunan');
    setPayAmount(settings.annualFeeAmount || 300000);
    setPayMethod('Transfer BCA');
    setPayProofImage(null);
    setPayProofFileName('');
    setPaySuccessMsg(false);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingMember) return;

    const receiptNumber = `KW-${Date.now().toString().slice(-6)}`;
    const currentYear = new Date().getFullYear();

    const newPayment: Payment = {
      id: 'pay-' + Date.now(),
      receiptNumber,
      memberId: payingMember.id,
      memberName: payingMember.name,
      memberNumber: payingMember.memberNumber,
      paymentType: payType,
      periodMonth: `Tahun ${currentYear}`,
      periodYear: `${currentYear}`,
      amount: payAmount,
      paymentMethod: payMethod,
      proofImageUrl: payProofImage || undefined,
      proofFileName: payProofFileName || undefined,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      adminNotes: `Pembayaran online mandiri oleh warga (${payingMember.phone})`,
    };

    onMakePayment(newPayment);
    setPaySuccessMsg(true);
    setTimeout(() => {
      setIsPaymentModalOpen(false);
      setPaySuccessMsg(false);
    }, 3000);
  };

  return (
    <div className="space-y-8 sm:space-y-10 animate-in fade-in duration-300 pb-28 md:pb-16">
      {/* ========================================================================= */}
      {/* 1. AKSES CEPAT & MANDIRI (MENU UTAMA APLIKASI MOBILE) - PALING ATAS */}
      {/* ========================================================================= */}
      <section id="section-menu-mobile" className="bg-white rounded-3xl border border-emerald-900/20 shadow-md overflow-hidden">
        {/* Header Banner - Warna Gradasi KTA Halus (Deep Emerald - Teal - Obsidian) & Tulisan Warna Putih */}
        <div
          className="text-white p-5 sm:p-7 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 35%, #065f46 65%, #0f172a 100%)',
          }}
        >
          {/* Subtle luxury mesh pattern overlay like KTA card */}
          <div className="absolute inset-0 bg-[radial-gradient(#34d399_1px,transparent_1px)] [background-size:14px_14px] opacity-15 pointer-events-none" />

          {/* Smooth ambient glow lighting */}
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-teal-400/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              {/* App Icon Box */}
              <AppIcon size={52} className="rounded-2xl shadow-xl shadow-emerald-950/60 shrink-0 border border-emerald-400/30" />

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-800/80 text-white rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/40 shadow-xs">
                    Akses Cepat & Mandiri
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[10px] font-bold text-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Siaga 24 Jam</span>
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {greeting}, Warga!
                </h1>

                <div className="flex items-center gap-1.5 text-xs text-white pt-0.5">
                  <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                  <p className="line-clamp-2 sm:line-clamp-1 font-medium text-white">
                    Seluruh Menu Layanan Terpadu & Akses Mandiri Warga
                  </p>
                </div>
              </div>
            </div>

            <div className="self-start sm:self-auto shrink-0">
              <span className="inline-block text-[11px] font-semibold text-white bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/25 shadow-xs">
                Sentuh ikon untuk membuka layanan
              </span>
            </div>
          </div>
        </div>

        {/* 8-Icon Grid Menu (Mirip Launcher Aplikasi Mobile: 4 Kolom di HP / 8 di Desktop) */}
        <div className="p-4 sm:p-6 grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4 bg-white">
          {/* Menu 1: Daftar Warga */}
          <button
            type="button"
            onClick={() => navigateToSection('section-daftar', { openRegister: true, mobileNav: 'daftar' })}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-emerald-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 group-hover:shadow-emerald-600/30 transition-all">
                <UserPlus className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                Baru
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors whitespace-nowrap">
              Registrasi
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Warga Baru
            </span>
          </button>

          {/* Menu 2: Cek KTA & Status */}
          <button
            type="button"
            onClick={() => navigateToSection('section-cek-status', { mobileNav: 'status' })}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-teal-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:scale-105 group-hover:shadow-teal-600/30 transition-all">
                <QrCode className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-teal-700 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                Kartu
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-teal-700 transition-colors whitespace-nowrap">
              KTA Digital
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Cek Keaktifan
            </span>
          </button>

          {/* Menu 3: Iuran */}
          <button
            type="button"
            onClick={() => navigateToSection('section-informasi-pengumuman')}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-indigo-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 group-hover:shadow-indigo-600/30 transition-all">
                <CreditCard className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-indigo-700 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                Iuran
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors whitespace-nowrap">
              Iuran
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Info & Pengumuman
            </span>
          </button>

          {/* Menu 4: Klaim Santunan */}
          <button
            type="button"
            onClick={() => navigateToSection('manfaat-section', { mobileNav: 'manfaat' })}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-rose-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-600/20 group-hover:scale-105 group-hover:shadow-rose-600/30 transition-all">
                <HeartHandshake className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-rose-600 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                Klaim
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-rose-700 transition-colors whitespace-nowrap">
              Santunan Duka
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Fasilitas & Manfaat
            </span>
          </button>

          {/* Menu 5: Laporan Kas */}
          <button
            type="button"
            onClick={() => navigateToSection('section-transparansi')}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-amber-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-600/20 group-hover:scale-105 group-hover:shadow-amber-600/30 transition-all">
                <Coins className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-amber-600 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                Kas
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors whitespace-nowrap">
              Laporan Kas
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Transparansi Dana
            </span>
          </button>

          {/* Menu 6: Data Cluster & RT */}
          <button
            type="button"
            onClick={() => navigateToSection('section-kontak')}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-purple-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-purple-600/20 group-hover:scale-105 group-hover:shadow-purple-600/30 transition-all">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-purple-700 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                RT
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors whitespace-nowrap">
              Wilayah RT
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Cluster & Pengurus
            </span>
          </button>

          {/* Menu 7: Pusat Bantuan */}
          <button
            type="button"
            onClick={() => navigateToSection('section-faq')}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-sky-50/70 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center text-white shadow-md shadow-sky-600/20 group-hover:scale-105 group-hover:shadow-sky-600/30 transition-all">
                <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-sky-700 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                FAQ
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-sky-700 transition-colors whitespace-nowrap">
              Tanya Jawab
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Panduan & Aturan
            </span>
          </button>

          {/* Menu 8: Portal Pengurus */}
          <button
            type="button"
            onClick={() => {
              if (activeUser) {
                onNavigateToInternal();
              } else if (onOpenLoginModal) {
                onOpenLoginModal();
              } else {
                navigateToSection('section-login', { mobileNav: 'akun' });
              }
            }}
            className="group flex flex-col items-center text-center p-2 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer active:scale-95"
          >
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-md shadow-slate-900/20 group-hover:scale-105 group-hover:shadow-slate-900/30 transition-all">
                {activeUser ? <User className="w-6 h-6 sm:w-7 sm:h-7" /> : <Lock className="w-6 h-6 sm:w-7 sm:h-7" />}
              </div>
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-slate-800 text-white font-black text-[9px] rounded-full uppercase tracking-wider shadow-xs">
                {activeUser ? (activeUser.authority.includes('RT') ? 'RT' : 'Admin') : 'Login'}
              </span>
            </div>
            <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-slate-950 transition-colors whitespace-nowrap">
              {activeUser ? 'Portal Saya' : 'Login Admin'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block whitespace-nowrap">
              Pengurus Kas
            </span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. MOBILE DIGITAL KAS CARD (FINTECH / SUPER-APP STYLE) */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white border border-slate-800 shadow-2xl p-5 sm:p-7">
        {/* Glow ambient background effects */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Card Top Row: Label & Toggle Saldo */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  KAS BERSAMA PAGUYUBAN
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <p className="text-[10px] text-emerald-300 font-medium">100% Terbuka & Realtime</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title={showBalance ? 'Sembunyikan Saldo' : 'Tampilkan Saldo'}
            >
              {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="text-[11px] font-medium hidden sm:inline">
                {showBalance ? 'Sembunyikan' : 'Tampilkan'}
              </span>
            </button>
          </div>

          {/* Card Middle Row: Big Balance Display */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                {showBalance ? formatIDR(financials.totalBalance) : 'Rp ••••••••••'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Saldo dana kas gotong royong terhimpun dari iuran warga seluruh cluster.
              </p>
            </div>

            {/* Quick action buttons right inside the digital card */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              <button
                type="button"
                onClick={() => navigateToSection('section-informasi-pengumuman')}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CreditCard className="w-4 h-4" />
                <span>Iuran</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('section-transparansi')}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                <span>Laporan Kas</span>
              </button>
            </div>
          </div>

          {/* Card Bottom Row: 3 Mini Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-center">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 font-semibold">Warga Terdaftar</p>
              <p className="text-sm sm:text-base font-black text-white mt-0.5">
                {totalVerifiedMembers} <span className="text-[10px] font-normal text-slate-400">KK</span>
              </p>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 font-semibold">Santunan Disalurkan</p>
              <p className="text-sm sm:text-base font-black text-rose-400 font-mono mt-0.5">
                {formatIDR(totalClaimsPaid)}
              </p>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 font-semibold">Cakupan Wilayah</p>
              <p className="text-sm sm:text-base font-black text-teal-300 mt-0.5">
                {activeClustersList.length} <span className="text-[10px] font-normal text-slate-400">Cluster</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MOBILE PROMO & ANNOUNCEMENT CAROUSEL BANNERS */}
      {/* ========================================================================= */}
      <section id="section-informasi-pengumuman" className="space-y-3 scroll-mt-24">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-emerald-600" />
            <span>Informasi & Pengumuman Penting</span>
          </p>
          <span className="text-[11px] text-slate-400">Geser untuk melihat</span>
        </div>

        {/* Horizontal scrollable cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {/* Banner Awal: Besaran Iuran Kas Paguyuban Sesuai Pengaturan Sistem */}
          <div
            onClick={() => navigateToSection('section-cek-status', { mobileNav: 'status' })}
            className="snap-start shrink-0 w-[88%] sm:w-[380px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-500/40 shadow-lg cursor-pointer hover:border-emerald-400 hover:shadow-xl transition-all relative overflow-hidden group"
          >
            {/* Subtle glow effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                Besaran Iuran Resmi Sistem
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-400/30 flex items-center justify-center text-amber-300 shadow-xs">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div className="relative z-10 mt-2.5">
              <span className="text-[10px] text-emerald-200/80 uppercase font-semibold tracking-wider block">
                Besaran Iuran Tahunan Warga:
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <h4 className="text-xl sm:text-2xl font-black text-white leading-tight font-mono text-emerald-400">
                  {formatIDR(settings.annualFeeAmount || 300000)}
                </h4>
                <span className="text-xs text-slate-300 font-sans font-medium">/ KK / Tahun</span>
              </div>
            </div>

            <p className="relative z-10 text-xs text-slate-300 mt-2 leading-relaxed">
              Ketetapan resmi sistem paguyuban ({formatIDR(settings.monthlyFeeAmount || Math.round((settings.annualFeeAmount || 300000) / 12))}/bulan) untuk hak perlindungan fardhu kifayah, pemakaman, dan santunan duka anggota keluarga inti.
            </p>

            <div className="relative z-10 mt-3.5 flex items-center justify-between text-xs font-bold text-amber-300 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Cek Status & Pembayaran</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </span>
              <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20">
                {settings.bankAccounts?.[0]
                  ? `${settings.bankAccounts[0].bankName} - ${settings.bankAccounts[0].accountNumber}`
                  : 'Rekening Kas Bersama'}
              </span>
            </div>
          </div>

          {/* Banner 1: Santunan */}
          <div
            onClick={() => navigateToSection('manfaat-section', { mobileNav: 'manfaat' })}
            className="snap-start shrink-0 w-[85%] sm:w-[360px] bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 text-white rounded-2xl p-4 border border-emerald-700/50 shadow-md cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 rounded text-[10px] font-black uppercase">
                Santunan Duka
              </span>
              <HeartHandshake className="w-5 h-5 text-emerald-300 shrink-0" />
            </div>
            <h4 className="text-sm font-black mt-2 leading-snug">
              Santunan Duka Hingga Rp 5.000.000,-
            </h4>
            <p className="text-xs text-emerald-100/80 mt-1 line-clamp-2">
              Layanan fardhu kifayah jenazah dan santunan tunai cepat untuk anggota dan keluarga inti terdaftar.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-300">
              <span>Lihat Rincian Manfaat</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Banner 2: KTA QR Code */}
          <div
            onClick={() => navigateToSection('section-cek-status', { mobileNav: 'status' })}
            className="snap-start shrink-0 w-[85%] sm:w-[360px] bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white rounded-2xl p-4 border border-teal-700/50 shadow-md cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="px-2 py-0.5 bg-teal-500/30 text-teal-300 rounded text-[10px] font-black uppercase">
                KTA Digital
              </span>
              <QrCode className="w-5 h-5 text-teal-300 shrink-0" />
            </div>
            <h4 className="text-sm font-black mt-2 leading-snug">
              KTA Digital dengan QR Code Resmi
            </h4>
            <p className="text-xs text-teal-100/80 mt-1 line-clamp-2">
              Verifikasi keabsahan anggota dapat dipindai secara instan oleh Ketua RT, DKM, dan Bendahara.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-bold text-teal-300">
              <span>Cek Kartu Anggota Saya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Banner 3: Gotong Royong Antar Cluster */}
          <div
            onClick={() => navigateToSection('section-kontak')}
            className="snap-start shrink-0 w-[85%] sm:w-[360px] bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 border border-indigo-700/50 shadow-md cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 rounded text-[10px] font-black uppercase">
                Gotong Royong RT
              </span>
              <Building2 className="w-5 h-5 text-indigo-300 shrink-0" />
            </div>
            <h4 className="text-sm font-black mt-2 leading-snug">
              Pelayanan Siaga Antar-Cluster & RT
            </h4>
            <p className="text-xs text-indigo-100/80 mt-1 line-clamp-2">
              Koordinasi cepat RT 01, 02, 03 Cluster Sanur, Mataram, Pasundan, dan Ranah Minang.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-300">
              <span>Hubungi Pengurus RT</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. QUICK FILTER TABS (MOBILE SEGMENTED CONTROLS) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => navigateToSection('section-menu-mobile')}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-emerald-600 text-white shadow-xs"
        >
          Semua Layanan
        </button>
        <button
          type="button"
          onClick={() => navigateToSection('section-daftar', { openRegister: true, mobileNav: 'daftar' })}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          Form Pendaftaran
        </button>
        <button
          type="button"
          onClick={() => navigateToSection('section-cek-status', { mobileNav: 'status' })}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          Cek KTA & Status
        </button>
        <button
          type="button"
          onClick={() => navigateToSection('manfaat-section', { mobileNav: 'manfaat' })}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          Hak & Manfaat
        </button>
        <button
          type="button"
          onClick={() => navigateToSection('section-transparansi')}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          Laporan Kas
        </button>
        <button
          type="button"
          onClick={() => navigateToSection('section-kontak')}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          Kontak RT
        </button>
        <button
          type="button"
          onClick={() => navigateToSection('section-faq')}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          Bantuan (FAQ)
        </button>
      </div>

      {/* 2. FITUR UTAMA: CEK STATUS KEANGGOTAAN CEPAT (NIK / NO HP / NAMA) */}
      <section id="section-cek-status" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="max-w-3xl mx-auto text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
            <Search className="w-3.5 h-3.5" />
            <span>Pengecekan Mandiri Warga</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Cek Status Pendaftaran & KTA Digital Anda
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Masukkan Nomor KTP (NIK), Nomor WhatsApp yang terdaftar, atau Nama Kepala Keluarga untuk melihat status verifikasi dan kartu anggota.
          </p>

          <form onSubmit={handleSearch} className="pt-3 max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Ketik NIK 16-digit, No. WA, atau Nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Cari Data</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer border border-slate-700"
                title="Pindai QR Code KTA Digital"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Pindai QR KTA</span>
              </button>
            </div>
          </form>
        </div>

        {/* Search Results Display */}
        {hasSearched && (
          <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 pt-2">
            {searchResult ? (
              <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-2xl border-2 border-emerald-300 p-5 sm:p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-200/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">{searchResult.name}</h3>
                      <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                        {searchResult.memberNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{searchResult.cluster} • {searchResult.address}</span>
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {searchResult.status === 'Aktif' || (searchResult.verificationStatus === 'Verified' && searchResult.status !== 'Menunggu Pembayaran' && searchResult.status !== 'Menunggu Validasi Bendahara') ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Anggota Aktif & Terlindungi</span>
                      </span>
                    ) : searchResult.status === 'Menunggu Verifikasi RT' || searchResult.verificationStatus === 'Pending' ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Tahap 1: Menunggu Verifikasi RT</span>
                      </span>
                    ) : searchResult.status === 'Menunggu Pembayaran' ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-sky-100 text-sky-900 border border-sky-300 inline-flex items-center gap-1.5 animate-pulse">
                        <CreditCard className="w-4 h-4 text-sky-600" />
                        <span>Tahap 2: Disetujui RT • Siap Bayar & Upload Bukti</span>
                      </span>
                    ) : searchResult.status === 'Menunggu Validasi Bendahara' ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-900 border border-indigo-300 inline-flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span>Tahap 3: Menunggu Validasi Kas Bendahara</span>
                      </span>
                    ) : searchResult.status === 'Ditolak' || searchResult.verificationStatus === 'Rejected' ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Verifikasi Ditolak</span>
                      </span>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-200 text-slate-700">
                        {searchResult.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Step Timeline - 5 Stages based on the 7-Step Workflow */}
                <div className="bg-white p-4 rounded-xl border border-emerald-200/60 shadow-inner">
                  <p className="text-xs font-bold text-slate-700 mb-3">Status Alur Keanggotaan & Pembayaran Iuran:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                    {/* Step 1: Registrasi Warga */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold text-[11px]">1. Pendaftaran</p>
                        <p className="text-[10px] text-emerald-700">Terdaftar di Sistem</p>
                      </div>
                    </div>

                    {/* Step 2: Persetujuan Ketua RT */}
                    {(() => {
                      const isRtApproved = searchResult.verificationStatus === 'Verified' || searchResult.status === 'Menunggu Pembayaran' || searchResult.status === 'Menunggu Validasi Bendahara' || searchResult.status === 'Aktif';
                      const isRtRejected = searchResult.status === 'Ditolak' || searchResult.verificationStatus === 'Rejected';
                      return (
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg font-medium border ${
                            isRtApproved
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isRtRejected
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                          }`}
                        >
                          {isRtApproved ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : isRtRejected ? (
                            <X className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-[11px]">2. Verifikasi RT</p>
                            <p className="text-[10px]">
                              {isRtApproved ? `Disetujui ${searchResult.rtVerifiedBy || 'RT'}` : isRtRejected ? 'Ditolak RT' : 'Sedang Diproses'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 3: Konfirmasi Pembayaran & Upload Bukti Transfer */}
                    {(() => {
                      const hasUploadedPayment = payments.some(
                        (p) => p.memberId === searchResult.id || p.memberNumber === searchResult.memberNumber
                      );
                      const isReadyToPay = searchResult.status === 'Menunggu Pembayaran';
                      return (
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg font-medium border ${
                            hasUploadedPayment
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isReadyToPay
                              ? 'bg-sky-50 text-sky-900 border-sky-300 ring-2 ring-sky-400/30'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {hasUploadedPayment ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : isReadyToPay ? (
                            <Upload className="w-4 h-4 text-sky-600 shrink-0 animate-bounce" />
                          ) : (
                            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-[11px]">3. Upload Bukti</p>
                            <p className="text-[10px]">
                              {hasUploadedPayment ? 'Bukti Terkirim' : isReadyToPay ? 'Silakan Bayar' : 'Terkunci (Tunggu RT)'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 4: Validasi Bendahara */}
                    {(() => {
                      const verifiedPayments = payments.filter(
                        (p) => (p.memberId === searchResult.id || p.memberNumber === searchResult.memberNumber) && p.status === 'Verified'
                      );
                      const isTreasurerVerified = verifiedPayments.length > 0 || searchResult.status === 'Aktif';
                      const isPendingTreasurer = searchResult.status === 'Menunggu Validasi Bendahara' || payments.some(
                        (p) => (p.memberId === searchResult.id || p.memberNumber === searchResult.memberNumber) && p.status === 'Pending'
                      );
                      return (
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg font-medium border ${
                            isTreasurerVerified
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isPendingTreasurer
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300 animate-pulse'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {isTreasurerVerified ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : isPendingTreasurer ? (
                            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-[11px]">4. Validasi Kas</p>
                            <p className="text-[10px]">
                              {isTreasurerVerified ? 'Divalidasi Kas' : isPendingTreasurer ? 'Antrean Kas' : 'Menunggu Bukti'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 5: KTA Digital Terbit */}
                    {(() => {
                      const searchKta = getMemberKtaIssuanceInfo(searchResult, payments);
                      return (
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg font-medium border ${
                            searchKta.isIssued
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {searchKta.isIssued ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-[11px]">5. KTA Digital</p>
                            <p className="text-[10px]">
                              {searchKta.isIssued ? 'Terbit & Sah' : searchKta.statusBadge}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* RT Contact Info & Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-600">
                    {(() => {
                      const matchedCluster = clusters.find((c) => c.name === searchResult.cluster);
                      if (matchedCluster && matchedCluster.leaderPhone) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">Kontak Ketua RT ({searchResult.cluster}):</span>
                            <a
                              href={`https://wa.me/${matchedCluster.leaderPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `Halo Pak RT ${matchedCluster.leaderName || ''}, saya ${searchResult.name} ingin menanyakan verifikasi pendaftaran Dana Kematian dengan nomor registrasi ${searchResult.memberNumber}. Terima kasih.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 underline"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{matchedCluster.leaderName} ({matchedCluster.leaderPhone})</span>
                            </a>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Payment / Transfer Upload Button strictly following rule 1, 2, 3 */}
                    {(() => {
                      const isPendingRt = searchResult.status === 'Menunggu Verifikasi RT' || searchResult.verificationStatus === 'Pending';
                      const isRejectedRt = searchResult.status === 'Ditolak' || searchResult.verificationStatus === 'Rejected';
                      const isAwaitingPayment = searchResult.status === 'Menunggu Pembayaran';
                      const isAwaitingTreasurer = searchResult.status === 'Menunggu Validasi Bendahara';

                      return (
                        <button
                          type="button"
                          disabled={isPendingRt || isRejectedRt}
                          onClick={() => handleOpenPaymentForMember(searchResult)}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm ${
                            isPendingRt
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                              : isRejectedRt
                              ? 'bg-rose-100 text-rose-400 cursor-not-allowed border border-rose-200'
                              : isAwaitingPayment
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20 cursor-pointer ring-2 ring-emerald-400/40 animate-pulse'
                              : isAwaitingTreasurer
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                              : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                          }`}
                          title={
                            isPendingRt
                              ? 'Pendaftaran masih menunggu verifikasi Ketua RT sebelum dapat membayar'
                              : isRejectedRt
                              ? 'Pendaftaran ditolak oleh Ketua RT'
                              : 'Konfirmasi Pembayaran & Upload Bukti Transfer'
                          }
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {isPendingRt
                              ? 'Belum Bisa Bayar (Menunggu Persetujuan RT)'
                              : isRejectedRt
                              ? 'Pendaftaran Ditolak RT'
                              : isAwaitingPayment
                              ? 'Upload Bukti Transfer Iuran'
                              : isAwaitingTreasurer
                              ? 'Lihat / Kirim Ulang Bukti'
                              : 'Bayar / Konfirmasi Iuran'}
                          </span>
                        </button>
                      );
                    })()}

                    {(() => {
                      const searchKta = getMemberKtaIssuanceInfo(searchResult, payments);
                      return (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedQrGeneratorMember(searchResult)}
                            className="px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white cursor-pointer hover:scale-105 active:scale-95"
                            title="Buka Generator QR Code unik KTA untuk dibagikan & discan"
                          >
                            <QrCode className="w-3.5 h-3.5 text-amber-300" />
                            <span>QR Code NPA</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenKtaModal) {
                                onOpenKtaModal(searchResult);
                              } else {
                                setSelectedKtaMember(searchResult);
                              }
                            }}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm ${
                              searchKta.isIssued
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {searchKta.isIssued ? (
                              <QrCode className="w-3.5 h-3.5" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-amber-700" />
                            )}
                            <span>{searchKta.isIssued ? 'Buka KTA Digital' : 'Lihat Status KTA'}</span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-800">
                  Data dengan kata kunci "{searchQuery}" Tidak Ditemukan
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Pastikan NIK atau No. WhatsApp yang Anda masukkan benar. Jika Anda belum pernah mendaftar, silakan isi formulir pendaftaran di bawah ini.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    const el = document.getElementById('section-daftar');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar Jadi Anggota Sekarang</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. FORMULIR PENDAFTARAN WARGA MANDIRI (HANYA MUNCUL JIKA MEMILIH MENU DAFTAR) */}
      {(isRegistering || regSuccess) && (
        <section id="section-daftar" className="bg-white rounded-3xl p-6 sm:p-10 border-2 border-emerald-500/30 shadow-xl space-y-6 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
          {/* Formulir Lengkap Pendaftaran Warga */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 mb-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Formulir Pendaftaran Online</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Pendaftaran Anggota Baru Warga
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Silakan lengkapi data Kepala Keluarga dan anggota tanggungan. Berkas akan otomatis diteruskan ke Ketua RT setempat untuk verifikasi.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-xs text-emerald-900 space-y-0.5 shrink-0">
                  <p className="font-bold flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Iuran Kas:</span>
                  </p>
                  <p className="font-mono font-bold text-emerald-800 text-[11px]">
                    {formatIDR(settings.annualFeeAmount || 300000)} / Tahun
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseRegisterForm}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title="Batal mendaftar dan tutup formulir"
                >
                  <X className="w-4 h-4 text-slate-500" />
                  <span>Batal Mendaftar</span>
                </button>
              </div>
            </div>

            {regSuccess && (
              <div className="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-950 space-y-3 animate-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black">Pendaftaran Berhasil Dikirim!</h4>
                    <p className="text-xs text-emerald-800">
                      Nomor Registrasi Anda: <strong className="font-mono text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">{regSuccess.memberNumber}</strong>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed bg-white/70 p-3 rounded-xl border border-emerald-200">
                  Data pendaftaran atas nama <strong>{regSuccess.name}</strong> ({regSuccess.cluster}) telah berhasil disimpan dengan status <strong>Menunggu Verifikasi RT</strong>.
                  {regSuccess.email && (
                    <span className="block mt-1 font-semibold text-emerald-950">
                      Akun login Anda: <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">{regSuccess.email}</span>. Gunakan email ini untuk login dan melihat riwayat pendaftaran, KTA, serta riwayat pembayaran.
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {onOpenLoginModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setRegSuccess(null);
                        setIsRegistering(false);
                        onOpenLoginModal();
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 text-emerald-400" />
                      <span>Login ke Halaman Anggota</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(regSuccess.nik);
                      handleSearch();
                      setActiveSection('cek-status');
                      const el = document.getElementById('section-cek-status');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Search className="w-4 h-4" />
                    <span>Cek Status Pendaftaran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegSuccess(null);
                      setIsRegistering(false);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl"
                  >
                    Tutup Notifikasi
                  </button>
                </div>
              </div>
            )}

            {!regSuccess && (
              <form onSubmit={handleRegistrationSubmit} className="space-y-6">
                {/* Draft auto-save indicator */}
                {(regForm.name || regForm.nik || regForm.phone || regForm.familyCardPhotoUrl) && (
                  <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Draf data tersimpan otomatis di perangkat ini. Data tidak akan hilang jika Anda berpindah tab atau memilih foto.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline shrink-0 cursor-pointer"
                    >
                      Reset Formulir
                    </button>
                  </div>
                )}
                {/* Bagian 1: Data Kepala Keluarga */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">1</span>
                    <span>Data Kepala Keluarga (Anggota Utama)</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Sutrisno Raharjo"
                        value={regForm.name}
                        onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor Induk Kependudukan (NIK) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={16}
                        placeholder="16 Digit Nomor KTP"
                        value={regForm.nik}
                        onChange={(e) => setRegForm({ ...regForm, nik: e.target.value.replace(/[^0-9]/g, '') })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor WhatsApp Aktif <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: 081234567890"
                        value={regForm.phone}
                        onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pilihan Cluster & RT Domisili <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={regForm.cluster}
                        onChange={(e) => setRegForm({ ...regForm, cluster: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        {activeClustersList.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.rtNumber ? `(${c.rtNumber})` : ''} - {c.leaderName ? `Ketua RT: ${c.leaderName}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Alamat Lengkap (Blok & Nomor Rumah) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Blok S No. 15 RT 01"
                        value={regForm.address}
                        onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Alamat Email (Akun Login Warga) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          placeholder="contoh: nama.anda@gmail.com"
                          value={regForm.email || ''}
                          onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Digunakan sebagai username saat login anggota.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kata Sandi Akun <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPublicRegPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          placeholder="Minimal 6 karakter"
                          value={regForm.password || ''}
                          onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPublicRegPassword(!showPublicRegPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPublicRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Kata sandi untuk akses Halaman Anggota.</p>
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Anggota Tanggungan Keluarga */}
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">2</span>
                        <span>Anggota Keluarga yang Ditanggung ({regForm.dependents.length})</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Istri / Suami, Anak Kandung, atau Orang Tua/Mertua yang tinggal satu rumah dan berhak menerima santunan.
                      </p>
                    </div>
                  </div>

                  {/* Quick Add Dependent Row */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nama Anggota Keluarga
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Siti Rahmawati"
                        value={tempDepName}
                        onChange={(e) => setTempDepName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Hubungan Keluarga
                      </label>
                      <select
                        value={tempDepRel}
                        onChange={(e) => setTempDepRel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                      >
                        <option value="Suami/Istri">Suami / Istri</option>
                        <option value="Anak Kandung">Anak Kandung</option>
                        <option value="Orang Tua">Orang Tua</option>
                        <option value="Mertua">Mertua</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="w-20">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Usia</label>
                        <input
                          type="number"
                          placeholder="Thn"
                          value={tempDepAge}
                          onChange={(e) => setTempDepAge(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTempDependent}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <span>+ Tambah</span>
                      </button>
                    </div>
                  </div>

                  {/* Dependents list */}
                  {regForm.dependents.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {regForm.dependents.map((dep, idx) => (
                        <div
                          key={dep.id}
                          className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="truncate">
                            <p className="font-bold text-slate-900 truncate">
                              {idx + 1}. {dep.name}
                            </p>
                            <p className="text-[10px] text-emerald-800">
                              {dep.relationship} {dep.age ? `• ${dep.age} Thn` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTempDependent(dep.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. DOKUMEN PENDUKUNG (FOTO KARTU KELUARGA) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                      3
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      Lampiran Foto Kartu Keluarga (KK)
                    </h3>
                  </div>

                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                    <FamilyCardUploader
                      file={regFamilyCardFile}
                      onFileSelect={(f) => setRegFamilyCardFile(f)}
                      photoUrl={regForm.familyCardPhotoUrl}
                      fileName={regForm.familyCardFileName}
                      kkNumber={regForm.familyCardNumber}
                      memberName={regForm.name || 'Warga'}
                      cluster={regForm.cluster}
                      required={true}
                      onChange={({ photoUrl, fileName, kkNumber, file }) => {
                        if (file !== undefined) setRegFamilyCardFile(file);
                        setRegForm((prev) => ({
                          ...prev,
                          familyCardPhotoUrl: photoUrl,
                          familyCardFileName: fileName,
                          familyCardNumber: kkNumber !== undefined ? kkNumber : prev.familyCardNumber,
                        }));
                      }}
                      onClear={() => {
                        setRegFamilyCardFile(null);
                        setRegForm((prev) => ({
                          ...prev,
                          familyCardPhotoUrl: '',
                          familyCardFileName: '',
                        }));
                      }}
                      onKkNumberChange={(kkNum) => {
                        setRegForm((prev) => ({
                          ...prev,
                          familyCardNumber: kkNum,
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Data Anda aman dan hanya digunakan untuk keperluan pelayanan warga paguyuban.</span>
                  </p>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleCloseRegisterForm}
                      className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                      <span>Batal Mendaftar</span>
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Kirim Pendaftaran Warga</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {/* 4. TABEL HAK MANFAAT SANTUNAN & IURAN KAS (DINAMIS DARI MASTER DATA) */}
      <section id="manfaat-section" className="bg-slate-900 text-white rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-xl space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/40">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Hak Manfaat & Pelayanan Duka</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Rincian Fasilitas & Pelayanan Jenazah
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Setiap anggota yang terdaftar berhak mendapatkan pendampingan, perlengkapan fardhu kifayah, serta layanan kepengurusan jenazah saat menghadapi musibah duka cita.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(benefits.filter((b) => b.isActive).length > 0 ? benefits.filter((b) => b.isActive) : DEFAULT_BENEFITS).map((benefit, idx) => {
            // Determine dynamic badge/card theme
            const color = benefit.badgeColor || 'emerald';
            let pillClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            let textHighlight = 'text-emerald-400';
            let checkIconClass = 'text-emerald-400';
            let cardBorder = 'border-slate-800 hover:border-emerald-500/40';

            if (color === 'teal') {
              pillClass = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
              textHighlight = 'text-teal-300';
              checkIconClass = 'text-teal-400';
              cardBorder = 'border-slate-800 hover:border-teal-500/40';
            } else if (color === 'cyan') {
              pillClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
              textHighlight = 'text-cyan-300';
              checkIconClass = 'text-cyan-400';
              cardBorder = 'border-slate-800 hover:border-cyan-500/40';
            } else if (color === 'amber') {
              pillClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              textHighlight = 'text-amber-300';
              checkIconClass = 'text-amber-400';
              cardBorder = 'border-slate-800 hover:border-amber-500/40';
            } else if (color === 'purple') {
              pillClass = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
              textHighlight = 'text-purple-300';
              checkIconClass = 'text-purple-400';
              cardBorder = 'border-slate-800 hover:border-purple-500/40';
            } else if (color === 'rose') {
              pillClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
              textHighlight = 'text-rose-300';
              checkIconClass = 'text-rose-400';
              cardBorder = 'border-slate-800 hover:border-rose-500/40';
            } else if (color === 'indigo') {
              pillClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
              textHighlight = 'text-indigo-300';
              checkIconClass = 'text-indigo-400';
              cardBorder = 'border-slate-800 hover:border-indigo-500/40';
            }

            return (
              <div
                key={benefit.id || idx}
                className={`bg-slate-800/90 rounded-2xl p-5 border ${cardBorder} flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:bg-slate-800 shadow-md`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider ${pillClass}`}>
                      {benefit.code || `BNF-0${idx + 1}`} • {benefit.targetRelationship}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{benefit.waitingPeriodDays === 0 ? 'Langsung' : `${benefit.waitingPeriodDays} Hari`}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white leading-snug">
                      {benefit.categoryName}
                    </h3>
                    {benefit.description && (
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {benefit.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-700 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Layanan & Fasilitas Didapatkan:</p>
                    <ul className="text-xs text-slate-300 space-y-1.5">
                      {(benefit.servicesIncluded || ['Kain Kafan & Perlengkapan Jenazah', 'Pelayanan Duka Cepat']).map((srv, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5">
                          <Check className={`w-3.5 h-3.5 ${checkIconClass} shrink-0 mt-0.5`} />
                          <span className="text-[11px] leading-tight">{srv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {benefit.termsAndConditions && (
                  <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-700/60 leading-tight">
                    * {benefit.termsAndConditions}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4.5. TRANSPARANSI KAS & REKENING RESMI PAGUYUBAN */}
      {/* ========================================================================= */}
      <section id="section-transparansi" className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200 mb-1">
              <Coins className="w-3.5 h-3.5" />
              <span>Transparansi Kas & Akuntabilitas</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              Laporan Kas Bersama & Rekening Resmi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh mutasi kas dana kematian dikelola secara amanah dan dapat dipantau oleh setiap anggota paguyuban.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateToSection('section-cek-status')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Bayar Iuran Anggota</span>
          </button>
        </div>

        {/* 3 Status Cards: Total Pemasukan, Total Santunan, Saldo Kas Saat Ini */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700">Total Penerimaan Iuran</span>
              <p className="text-xl font-black text-emerald-950 font-mono mt-1">
                {formatIDR(financials.totalIncomeVerified ?? financials.totalIncome ?? 0)}
              </p>
            </div>
            <p className="text-[11px] text-emerald-800 mt-2">
              Akumulasi iuran tahunan & pendaftaran dari seluruh warga terverifikasi.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-700">Total Santunan Disalurkan</span>
              <p className="text-xl font-black text-rose-950 font-mono mt-1">
                {formatIDR(totalClaimsPaid)}
              </p>
            </div>
            <p className="text-[11px] text-rose-800 mt-2">
              Santunan pemulasaraan jenazah & santunan tunai ({claims.length} kejadian duka).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-700">Saldo Kas Bersama Saat Ini</span>
              <p className="text-xl font-black text-indigo-950 font-mono mt-1">
                {formatIDR(financials.totalBalance)}
              </p>
            </div>
            <p className="text-[11px] text-indigo-800 mt-2">
              Dana likuid siap pakai 24 jam di rekening resmi kas paguyuban.
            </p>
          </div>
        </div>

        {/* Rekening Resmi Paguyuban Card */}
        <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Rekening Resmi Pembayaran Iuran</h4>
                <p className="text-xs text-slate-400">Gunakan transfer bank atau ATM resmi berikut:</p>
              </div>
            </div>

            {settings.bankAccounts[0]?.accountNumber && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(settings.bankAccounts[0]?.accountNumber || '');
                  setCopiedBank(true);
                  setTimeout(() => setCopiedBank(false), 2500);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBank ? 'Tersalin!' : 'Salin No. Rekening'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <p className="text-slate-400 text-[10px] uppercase font-bold">Bank Penerima</p>
              <p className="text-sm font-black text-white mt-0.5">{settings.bankAccounts[0]?.bankName || 'BCA (Bank Central Asia)'}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <p className="text-slate-400 text-[10px] uppercase font-bold">Nomor Rekening</p>
              <p className="text-sm font-black text-emerald-400 font-mono mt-0.5">{settings.bankAccounts[0]?.accountNumber || '7890-123-456'}</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <p className="text-slate-400 text-[10px] uppercase font-bold">Atas Nama Rekening</p>
              <p className="text-sm font-black text-white mt-0.5">{settings.bankAccounts[0]?.accountHolder || settings.treasurerName || 'KAS DANA KEMATIAN'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 4 LANGKAH MUDAH BERGABUNG */}
      <section id="section-alur" className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-black text-slate-900">
            Alur Pendaftaran Menjadi Anggota
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Hanya 4 langkah mudah untuk memastikan keluarga Anda terlindungi program dana kematian paguyuban.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 relative">
            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center mb-3">
              1
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Isi Formulir Online</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Lengkapi nama, NIK, alamat rumah, pilihan Cluster RT, dan anggota keluarga yang ditanggung.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 relative">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center mb-3">
              2
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Verifikasi Ketua RT</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ketua RT di cluster Anda memverifikasi kebenaran domisili dan keabsahan warga secara digital.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 relative">
            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center mb-3">
              3
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Transfer Iuran Kas</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bayar iuran tahunan via transfer ke rekening resmi bendahara dan unggah bukti transfer.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 relative">
            <span className="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center mb-3">
              4
            </span>
            <h4 className="text-sm font-bold text-slate-900 mb-1">KTA Digital Aktif</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Unduh Kartu Tanda Anggota (KTA) Digital dengan QR Code resmi yang dapat dicek kapan saja.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/70 p-4 sm:p-5 rounded-2xl">
          <div className="space-y-0.5 text-center sm:text-left">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              Siap mendaftarkan keluarga Anda ke program gotong royong?
            </h4>
            <p className="text-[11px] text-slate-500">
              Pendaftaran online mudah dan langsung terkirim ke Ketua RT cluster tempat tinggal Anda.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsRegistering(true);
              setTimeout(() => {
                const el = document.getElementById('section-daftar');
                el?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Daftar Jadi Anggota Baru</span>
          </button>
        </div>
      </section>

      {/* 6. DIREKTORI KONTAK KETUA RT PER CLUSTER & BENDAHARA */}
      <section id="section-kontak" className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 mb-1">
              <Phone className="w-3.5 h-3.5" />
              <span>Pusat Informasi Wilayah</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900">
              Direktori Kontak Ketua RT Cluster & Pengurus
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungi pengurus RT cluster tempat tinggal Anda atau Bendahara paguyuban jika membutuhkan bantuan.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Bendahara Card */}
          <div className="p-4 bg-emerald-900 text-white rounded-2xl border border-emerald-800 flex flex-col justify-between gap-3 shadow-md">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-emerald-700 text-emerald-200 text-[10px] font-black rounded-full uppercase">
                  Bendahara Kas Paguyuban
                </span>
                <Landmark className="w-4 h-4 text-emerald-300" />
              </div>
              <h4 className="text-base font-bold">{settings?.treasurerName || 'Bendahara Paguyuban'}</h4>
              <p className="text-xs text-emerald-200/80 mt-1">Layanan Konfirmasi Pembayaran & Pembukuan Kas</p>
            </div>

            <a
              href={`https://wa.me/${(settings?.treasurerPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                'Halo Bendahara Paguyuban, saya ingin menanyakan perihal iuran dana kematian.'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat WhatsApp Bendahara</span>
            </a>
          </div>

          {/* Cluster RT Cards */}
          {activeClustersList.map((cluster) => (
            <div
              key={cluster.id}
              className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md">
                    {cluster.rtNumber || 'RT'} {cluster.code ? `• ${cluster.code}` : ''}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Aktif
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{cluster.name}</h4>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  Ketua RT: <strong>{cluster.leaderName || 'Belum diisi'}</strong>
                </p>
                {cluster.addressCoverage && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Blok: {cluster.addressCoverage}</p>
                )}
              </div>

              {cluster.leaderPhone ? (
                <a
                  href={`https://wa.me/${cluster.leaderPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Halo Pak RT ${cluster.leaderName || ''}, saya warga ${cluster.name} ingin menanyakan verifikasi keanggotaan Dana Kematian.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chat WA ({cluster.leaderPhone})</span>
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 text-center py-1">Kontak WA belum terdaftar</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. FAQ / TANYA JAWAB UMUM */}
      <section id="section-faq" className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pertanyaan yang Sering Diajukan</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Tanya Jawab Seputar Dana Kematian
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {[
            {
              q: 'Siapa saja yang berhak mendaftar menjadi anggota?',
              a: 'Seluruh warga yang berdomisili di lingkungan Cluster Sanur, Mataram, Pasundan (RT 01, RT 02, RT 03), Ranah Minang, dan wilayah cluster yang terdaftar di paguyuban, baik status rumah milik sendiri maupun sewa/kontrak.',
            },
            {
              q: 'Bagaimana cara mengajukan santunan saat terjadi musibah duka?',
              a: 'Ahli waris atau pengurus RT setempat cukup melaporkan ke DKM Masjid atau Bendahara Paguyuban dengan menyertakan nama anggota / KTA Digital. Tim DKM dan kas akan langsung mencairkan santunan duka dan menyiapkan pemulasaraan jenazah tanpa birokrasi berbelit.',
            },
            {
              q: 'Berapa besaran iuran dan dibayarkan ke mana?',
              a: `Iuran tahunan sebesar ${formatIDR(settings.annualFeeAmount || 300000)} per tahun per Kepala Keluarga. Pembayaran dapat ditransfer ke rekening resmi bendahara paguyuban di ${settings.bankAccounts[0]?.bankName || 'BCA'} ${settings.bankAccounts[0]?.accountNumber || '7890-123-456'} a.n ${settings.bankAccounts[0]?.accountHolder || settings.treasurerName}.`,
            },
            {
              q: 'Apakah KTA Digital berlaku resmi?',
              a: 'Ya, setiap KTA Digital dilengkapi dengan QR Code unik berenkripsi data yang dapat dipindai oleh pengurus RT, DKM, dan Bendahara untuk memverifikasi keaktifan keanggotaan secara instan.',
            },
          ].map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-slate-50/50"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-800 hover:bg-slate-100/80 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. SECTION LOGIN & AUTENTIKASI PENGGUNA / PENGURUS */}
      <section id="section-login" className="scroll-mt-28 sm:scroll-mt-32">
        <UserLoginForm
          users={users}
          members={members}
          activeUser={activeUser}
          onLoginSuccess={(user) => {
            if (onLoginSuccess) {
              onLoginSuccess(user);
            }
            if (user.authority !== 'Anggota' && onNavigateToInternal) {
              onNavigateToInternal();
            }
          }}
          onNavigateToDashboard={onNavigateToInternal}
          onLogout={onLogout}
        />
      </section>

      {/* MODAL: SELF-SERVICE PAYMENT CONFIRMATION */}
      {isPaymentModalOpen && payingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Konfirmasi Pembayaran Iuran</h3>
                <p className="text-xs text-slate-500">Anggota: {payingMember.name} ({payingMember.memberNumber})</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paySuccessMsg ? (
              <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-300">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="text-base font-black text-emerald-950">Bukti Pembayaran Berhasil Dikirim!</h4>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Bendahara akan memverifikasi kas masuk. Status keanggotaan Anda akan otomatis aktif setelah diverifikasi.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
                {/* Bank Target Info */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <p className="font-bold text-emerald-900">Rekening Resmi Tujuan Transfer:</p>
                  <p className="text-slate-800 font-medium">
                    {settings.bankAccounts[0]?.bankName || 'BCA'}: <strong className="font-mono text-emerald-900">{settings.bankAccounts[0]?.accountNumber || '7890-123-456'}</strong> a.n {settings.bankAccounts[0]?.accountHolder || settings.treasurerName}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Pembayaran</label>
                  <select
                    value={payType}
                    onChange={(e) => {
                      const val = e.target.value as PaymentType;
                      setPayType(val);
                      if (val === 'Iuran Tahunan') setPayAmount(settings.annualFeeAmount || 300000);
                      else if (val === 'Iuran Pendaftaran') setPayAmount(settings.registrationFeeAmount || 50000);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Iuran Tahunan">Iuran Tahunan ({formatIDR(settings.annualFeeAmount || 300000)})</option>
                    <option value="Iuran Pendaftaran">Iuran Pendaftaran Baru ({formatIDR(settings.registrationFeeAmount || 50000)})</option>
                    <option value="Donasi Kas Kematian">Donasi Sukarela Kas Kematian</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nominal Transfer (Rp)</label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-emerald-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metode Transfer</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Transfer BCA">Transfer Bank BCA</option>
                    <option value="Transfer Mandiri">Transfer Bank Mandiri</option>
                    <option value="Transfer BSI">Transfer Bank BSI</option>
                    <option value="QRIS Paguyuban">QRIS Paguyuban</option>
                    <option value="Tunai ke Pengurus">Tunai ke Pengurus RT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unggah Foto Bukti Transfer</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProofImageChange}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                  {payProofImage && (
                    <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <img src={payProofImage} alt="Bukti Transfer" className="h-28 object-contain mx-auto rounded" />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim Bukti Pembayaran</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* KTA DIGITAL MODAL */}
      {selectedKtaMember && (
        <DigitalKtaModal
          isOpen={!!selectedKtaMember}
          member={selectedKtaMember}
          payments={payments}
          settings={settings}
          onClose={() => setSelectedKtaMember(null)}
        />
      )}

      {/* KTA SCANNER MODAL */}
      <KtaScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        members={members}
        payments={payments}
        settings={settings}
        onOpenKtaModal={(mem) => {
          setSelectedKtaMember(mem);
        }}
        onSelectMember={(mem) => {
          setSearchResult(mem);
          setHasSearched(true);
          setSearchQuery(mem.memberNumber);
          const el = document.getElementById('section-cek-status');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
        onSelectMemberForPayment={(mem) => {
          handleOpenPaymentForMember(mem);
        }}
      />

      {/* MEMBER KTA QR CODE GENERATOR MODAL */}
      {selectedQrGeneratorMember && (
        <MemberKtaQrGeneratorModal
          isOpen={Boolean(selectedQrGeneratorMember)}
          onClose={() => setSelectedQrGeneratorMember(null)}
          member={selectedQrGeneratorMember}
          settings={settings}
          payments={payments}
        />
      )}
    </div>
  );
};
