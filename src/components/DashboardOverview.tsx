import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Member, Payment, BenefitClaim, SystemSettings, CLUSTERS, ClusterType, AppUser, AppNotification } from '../types';
import { formatIDR, getBaseBalance, getMemberForUser } from '../lib/storage';
import { exportMonthlyFinancialStatementCSV } from '../lib/csvExport';
import { calculateMemberExpiry, getExpiringWithin7DaysSummary } from '../lib/expiryUtils';
import { getGracePeriodSummary } from '../lib/gracePeriodUtils';
import { MemberDetailModal } from './MemberDetailModal';
import { EarlyOutreachModal } from './EarlyOutreachModal';
import { ContactAdminModal } from './ContactAdminModal';
import { DigitalKtaModal } from './DigitalKtaModal';
import { PrintMemberCardModal } from './PrintMemberCardModal';
import { KtaScannerModal } from './KtaScannerModal';
import { ExpiringDueReminderModal } from './ExpiringDueReminderModal';
import { DashboardNotifications } from './DashboardNotifications';
import { RoleMobileAppMenu } from './RoleMobileAppMenu';
import { useRolePermissions } from '../lib/permissions';
import { getAllNavigationActionsForUser } from '../lib/navigationMenu';
import {
  getAdminContacts,
  AdminContact,
  MessageTopic,
  createAdminWhatsAppUrl,
  buildAdminContactMessage,
} from '../lib/contactAdminUtils';
import { 
  Wallet, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  ShieldCheck, 
  HeartHandshake, 
  UserPlus, 
  CreditCard, 
  CheckSquare, 
  Receipt, 
  FileCheck2, 
  CalendarCheck, 
  TrendingUp, 
  BarChart3, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Download, 
  Shield, 
  Building2, 
  Crown, 
  Award, 
  MapPin, 
  UserCheck, 
  Sparkles, 
  ArrowRight,
  User,
  AlertTriangle,
  Lock,
  Eye,
  Plus,
  Edit3,
  Check,
  ChevronRight,
  MessageSquare,
  Phone,
  Send,
  CheckCircle,
  XCircle,
  Info,
  ExternalLink,
  Filter,
  Search,
  RotateCcw,
  Share2,
  HelpCircle,
  QrCode,
  Scan,
  Bell,
  LayoutGrid,
  SlidersHorizontal,
  Smartphone,
  UserCog,
  Settings as SettingsIcon,
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  CartesianGrid, 
  Legend, 
  ComposedChart, 
  Line 
} from 'recharts';

interface DashboardOverviewProps {
  currentTab?: string;
  members: Member[];
  payments: Payment[];
  claims: BenefitClaim[];
  settings: SystemSettings;
  users?: AppUser[];
  activeUser?: AppUser;
  financials: {
    totalBalance: number;
    totalIncomeVerified: number;
    totalPendingIncome: number;
    totalBenefitSpent: number;
  };
  notifications?: AppNotification[];
  onDismissNotification?: (id: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onClearAllNotifications?: () => void;
  setCurrentTab: (tab: string) => void;
  onViewReceipt: (payment: Payment) => void;
  onOpenExportModal?: () => void;
  onSelectMemberForPayment?: (member: Member) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentTab = 'dashboard',
  members,
  payments,
  claims,
  settings,
  users = [],
  activeUser,
  financials,
  notifications = [],
  onDismissNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  setCurrentTab,
  onViewReceipt,
  onOpenExportModal,
  onSelectMemberForPayment,
}) => {
  const [selectedMemberModal, setSelectedMemberModal] = useState<Member | null>(null);
  const [digitalKtaMember, setDigitalKtaMember] = useState<Member | null>(null);
  const [selectedPrintCardMember, setSelectedPrintCardMember] = useState<Member | null>(null);
  const [isKtaScannerOpen, setIsKtaScannerOpen] = useState<boolean>(false);
  const [outreachMember, setOutreachMember] = useState<Member | null>(null);
  const [isContactAdminModalOpen, setIsContactAdminModalOpen] = useState<boolean>(false);
  const [contactAdminRole, setContactAdminRole] = useState<'Admin' | 'Bendahara' | 'RT' | undefined>(undefined);
  const [contactTopic, setContactTopic] = useState<MessageTopic>('iuran');
  const [rtSearchTerm, setRtSearchTerm] = useState('');
  const [rtStatusFilter, setRtStatusFilter] = useState<'Semua' | 'Aktif' | 'Menunggu Verifikasi RT' | 'Segera Habis' | 'Jatuh Tempo'>('Semua');
  const [isDueReminderModalOpen, setIsDueReminderModalOpen] = useState<boolean>(false);
  const { permissions } = useRolePermissions();

  const activeMembersCount = members.filter((m) => m.status === 'Aktif' || m.verificationStatus === 'Verified').length;
  const pendingRtMembersCount = members.filter((m) => m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending').length;
  const pendingPaguyubanApprovalCount = members.filter((m) => {
    if (m.isPaguyubanApproved || m.status === 'Aktif' || m.status === 'Ditolak') {
      return false;
    }
    if (m.status === 'Menunggu Verifikasi RT' || m.verificationStatus !== 'Verified') {
      return false;
    }
    // Hanya yang sudah divalidasi pembayaran oleh bendahara
    return payments.some(
      (p) => (p.memberId === m.id || p.memberNumber === m.memberNumber) && p.status === 'Verified'
    );
  }).length;
  const pendingPayments = payments.filter((p) => p.status === 'Pending');
  const graceSummary = getGracePeriodSummary(payments);
  const expiring7Summary = getExpiringWithin7DaysSummary(members, payments, new Date(), settings.annualFeeAmount);

  // Active Members per Cluster Statistics
  const clusterStats = CLUSTERS.map((clusterName) => {
    const clusterMembers = members.filter((m) => m.cluster === clusterName);
    const activeCount = clusterMembers.filter(
      (m) => m.status === 'Aktif' || m.verificationStatus === 'Verified'
    ).length;
    const pendingCount = clusterMembers.filter(
      (m) => m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending'
    ).length;
    const totalCount = clusterMembers.length;
    const totalDependents = clusterMembers.reduce((sum, m) => sum + (m.dependentsCount || 0), 0);
    const totalSouls = activeCount + totalDependents;

    const clusterPayments = payments.filter((p) => {
      if (p.status !== 'Verified') return false;
      const mem = members.find((m) => m.id === p.memberId);
      return mem?.cluster === clusterName;
    });
    const totalCollected = clusterPayments.reduce((sum, p) => sum + p.amount, 0);

    const percentage = activeMembersCount > 0
      ? Math.round((activeCount / activeMembersCount) * 100)
      : 0;

    return {
      cluster: clusterName,
      activeCount,
      pendingCount,
      totalCount,
      totalDependents,
      totalSouls,
      totalCollected,
      percentage,
    };
  });

  // Determine which cluster has the most registered/active users
  const topCluster = [...clusterStats].sort((a, b) => b.activeCount - a.activeCount)[0] || clusterStats[0];

  const [trendViewMode, setTrendViewMode] = useState<'amount' | 'compliance'>('amount');
  const [trendPeriod, setTrendPeriod] = useState<'2026' | '6months' | '2025'>('2026');
  const [cashFlowYear, setCashFlowYear] = useState<string>('2026');

  // Indonesian months standard list
  const INDO_MONTHS = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  // Robust parsing of payment transaction/period date
  const getPaymentDateInfo = useCallback((p: Payment) => {
    const periodLower = (p.periodMonth || '').toLowerCase();
    
    // 1. Check if periodMonth contains a specific Indonesian month name
    for (let i = 0; i < INDO_MONTHS.length; i++) {
      const m = INDO_MONTHS[i].toLowerCase();
      if (periodLower.includes(m)) {
        const yearMatch = periodLower.match(/\b(20\d\d)\b/) || (p.periodYear || '').match(/\b(20\d\d)\b/) || (p.createdAt || '').match(/\b(20\d\d)\b/);
        const yr = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
        return {
          monthName: INDO_MONTHS[i],
          monthIndex: i,
          year: yr,
          key: `${INDO_MONTHS[i]} ${yr}`,
        };
      }
    }

    // 2. Otherwise determine by transaction timestamp (verifiedAt or createdAt)
    const dateStr = p.verifiedAt || p.createdAt || '';
    if (dateStr) {
      const clean = dateStr.trim().replace(' ', 'T');
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        const mIdx = d.getMonth();
        const yr = d.getFullYear();
        return {
          monthName: INDO_MONTHS[mIdx],
          monthIndex: mIdx,
          year: yr,
          key: `${INDO_MONTHS[mIdx]} ${yr}`,
        };
      }
      const match = dateStr.match(/(\d{4})-(\d{1,2})/);
      if (match) {
        const yr = parseInt(match[1], 10);
        const mIdx = parseInt(match[2], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          return {
            monthName: INDO_MONTHS[mIdx],
            monthIndex: mIdx,
            year: yr,
            key: `${INDO_MONTHS[mIdx]} ${yr}`,
          };
        }
      }
    }

    const fallbackYr = p.periodYear ? parseInt(p.periodYear, 10) : 2026;
    return {
      monthName: 'Agustus',
      monthIndex: 7,
      year: fallbackYr,
      key: `Agustus ${fallbackYr}`,
    };
  }, [INDO_MONTHS]);

  // Robust parsing of claim disbursement date
  const getClaimDateInfo = useCallback((c: BenefitClaim) => {
    const dateStr = c.createdAt || c.dateOfDeath || '';
    if (dateStr) {
      const clean = dateStr.trim().replace(' ', 'T');
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        const mIdx = d.getMonth();
        const yr = d.getFullYear();
        return {
          monthName: INDO_MONTHS[mIdx],
          monthIndex: mIdx,
          year: yr,
          key: `${INDO_MONTHS[mIdx]} ${yr}`,
        };
      }
      const match = dateStr.match(/(\d{4})-(\d{1,2})/);
      if (match) {
        const yr = parseInt(match[1], 10);
        const mIdx = parseInt(match[2], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          return {
            monthName: INDO_MONTHS[mIdx],
            monthIndex: mIdx,
            year: yr,
            key: `${INDO_MONTHS[mIdx]} ${yr}`,
          };
        }
      }
    }

    return {
      monthName: 'Mei',
      monthIndex: 4,
      year: 2026,
      key: 'Mei 2026',
    };
  }, [INDO_MONTHS]);

  // Helper to determine if an active member has paid dues for a specific month & year
  const isMemberCompliantForMonth = useCallback((m: Member, yr: number, monthIdx: number) => {
    const monthKey = `${INDO_MONTHS[monthIdx]} ${yr}`;
    
    // Check direct verified payment for this month
    const hasMonthPayment = payments.some(
      (p) => p.memberId === m.id && p.status === 'Verified' && getPaymentDateInfo(p).key === monthKey
    );
    if (hasMonthPayment) return true;

    // Check verified annual payment for this year
    const hasAnnualPayment = payments.some((p) => {
      if (p.memberId !== m.id || p.status !== 'Verified') return false;
      const pInfo = getPaymentDateInfo(p);
      const period = (p.periodMonth || '').toLowerCase();
      const type = (p.paymentType || '').toLowerCase();
      return (
        (type.includes('tahunan') || period.includes('tahun') || period.includes('2026')) &&
        (p.periodYear === String(yr) || pInfo.year === yr)
      );
    });
    if (hasAnnualPayment) return true;

    // Check rollover from 2025/2026 (valid until September 2026)
    if (yr === 2026 && monthIdx <= 8) {
      const hasRollover = payments.some((p) => {
        if (p.memberId !== m.id || p.status !== 'Verified') return false;
        const period = (p.periodMonth || '').toLowerCase();
        return period.includes('2025/2026') || (p.adminNotes || '').includes('2026');
      });
      if (hasRollover) return true;
    }

    return false;
  }, [payments, INDO_MONTHS, getPaymentDateInfo]);

  // Dynamic months list based on trendPeriod
  const paymentTrendMonths = useMemo(() => {
    if (trendPeriod === '6months') {
      return ['Maret 2026', 'April 2026', 'Mei 2026', 'Juni 2026', 'Juli 2026', 'Agustus 2026'];
    }
    if (trendPeriod === '2025') {
      return INDO_MONTHS.map((m) => `${m} 2025`);
    }
    // Default 2026: Januari - Agustus 2026 (or full year if needed)
    return [
      'Januari 2026', 'Februari 2026', 'Maret 2026', 'April 2026',
      'Mei 2026', 'Juni 2026', 'Juli 2026', 'Agustus 2026'
    ];
  }, [trendPeriod, INDO_MONTHS]);

  const activeCount = activeMembersCount || members.filter((m) => m.status === 'Aktif' || m.verificationStatus === 'Verified').length || 1;
  const expectedMonthlyTarget = activeCount * (settings.monthlyFeeAmount || 25000);
  const activeMembersList = useMemo(() => {
    return members.filter((m) => m.status === 'Aktif' || m.verificationStatus === 'Verified');
  }, [members]);

  const paymentTrendData = useMemo(() => {
    return paymentTrendMonths.map((monthName) => {
      const parts = monthName.split(' ');
      const mName = parts[0];
      const yr = parseInt(parts[1], 10) || 2026;
      const mIdx = INDO_MONTHS.indexOf(mName);

      const monthPayments = payments.filter((p) => {
        const pInfo = getPaymentDateInfo(p);
        return pInfo.key === monthName;
      });

      const verifiedSum = monthPayments
        .filter((p) => p.status === 'Verified')
        .reduce((sum, p) => sum + p.amount, 0);

      const pendingSum = monthPayments
        .filter((p) => p.status === 'Pending')
        .reduce((sum, p) => sum + p.amount, 0);

      const verifiedMembersCount = activeMembersList.filter((m) =>
        isMemberCompliantForMonth(m, yr, mIdx)
      ).length;

      const pendingCount = monthPayments.filter((p) => p.status === 'Pending').length;

      const complianceRate = activeCount > 0
        ? Math.min(100, Math.round((verifiedMembersCount / activeCount) * 100))
        : 100;

      return {
        month: monthName,
        shortMonth: mName.slice(0, 3),
        verifikasi: verifiedSum,
        pending: pendingSum,
        totalTerkumpul: verifiedSum + pendingSum,
        targetIuran: expectedMonthlyTarget,
        anggotaLunas: verifiedMembersCount,
        anggotaPending: pendingCount,
        targetAnggota: activeCount,
        kepatuhanPct: complianceRate,
      };
    });
  }, [paymentTrendMonths, payments, activeMembersList, activeCount, expectedMonthlyTarget, INDO_MONTHS, getPaymentDateInfo, isMemberCompliantForMonth]);

  const avgCompliancePct = Math.round(
    paymentTrendData.reduce((acc, curr) => acc + curr.kepatuhanPct, 0) / (paymentTrendData.length || 1)
  );
  const totalTrendCollected = paymentTrendData.reduce((acc, curr) => acc + curr.verifikasi, 0);
  const currentMonthData = paymentTrendData[paymentTrendData.length - 1] || {
    month: 'Agustus 2026',
    shortMonth: 'Agu',
    verifikasi: 0,
    pending: 0,
    totalTerkumpul: 0,
    targetIuran: expectedMonthlyTarget,
    anggotaLunas: 0,
    anggotaPending: 0,
    targetAnggota: activeCount,
    kepatuhanPct: 0,
  };

  // Fiscal Health Calculations (All-time dynamic operational cashflow matching verified financials)
  const totalCollectedFiscal = financials.totalIncomeVerified;
  const countCollectedFiscal = payments.filter((p) => p.status === 'Verified').length;

  const totalPaidOutFiscal = financials.totalBenefitSpent;
  const countPaidOutFiscal = claims.length;

  const netCashflowFiscal = totalCollectedFiscal - totalPaidOutFiscal;
  const isNetPositive = netCashflowFiscal >= 0;

  const targetCollection = activeMembersCount * settings.annualFeeAmount;
  const collectionPercentage = targetCollection > 0 
    ? Math.min(100, Math.round((totalCollectedFiscal / targetCollection) * 100))
    : 100;

  // Dynamic available years for Cash Flow chart
  const availableCashFlowYears = useMemo(() => {
    const years = new Set<string>();
    years.add('2026');
    years.add('2025');
    payments.forEach((p) => {
      const info = getPaymentDateInfo(p);
      years.add(String(info.year));
    });
    claims.forEach((c) => {
      const info = getClaimDateInfo(c);
      years.add(String(info.year));
    });
    return Array.from(years).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  }, [payments, claims, getPaymentDateInfo, getClaimDateInfo]);

  // Real synchronized cash flow data (Pemasukan vs Realisasi Santunan)
  const chartData = useMemo(() => {
    const yr = parseInt(cashFlowYear, 10);
    return INDO_MONTHS.map((mName, mIdx) => {
      const monthKey = `${mName} ${yr}`;
      const shortMonth = mName.slice(0, 3);

      // Income: verified payments in this month & year
      const monthVerifiedPayments = payments.filter((p) => {
        if (p.status !== 'Verified') return false;
        const info = getPaymentDateInfo(p);
        return info.year === yr && info.monthIndex === mIdx;
      });
      const pemasukan = monthVerifiedPayments.reduce((sum, p) => sum + p.amount, 0);

      // Expense: claims in this month & year
      const monthClaims = claims.filter((c) => {
        const info = getClaimDateInfo(c);
        return info.year === yr && info.monthIndex === mIdx;
      });
      const pengeluaran = monthClaims.reduce((sum, c) => sum + c.totalAmount, 0);

      return {
        month: shortMonth,
        fullMonth: monthKey,
        pemasukan,
        pengeluaran,
        surplus: pemasukan - pengeluaran,
        txCount: monthVerifiedPayments.length,
        claimCount: monthClaims.length,
      };
    });
  }, [cashFlowYear, payments, claims, INDO_MONTHS, getPaymentDateInfo, getClaimDateInfo]);

  const totalCashFlowIncome = useMemo(() => chartData.reduce((sum, item) => sum + item.pemasukan, 0), [chartData]);
  const totalCashFlowExpense = useMemo(() => chartData.reduce((sum, item) => sum + item.pengeluaran, 0), [chartData]);
  const totalCashFlowNet = totalCashFlowIncome - totalCashFlowExpense;

  const CustomTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 max-w-xs font-sans">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-slate-200">
            <span>Periode: {label}</span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono">
              {data.kepatuhanPct}% Kepatuhan
            </span>
          </div>
          
          {trendViewMode === 'amount' ? (
            <div className="space-y-1 font-mono">
              <div className="flex justify-between text-emerald-400">
                <span>Terverifikasi:</span>
                <span className="font-bold">{formatIDR(data.verifikasi)}</span>
              </div>
              {data.pending > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Pending Validasi:</span>
                  <span className="font-bold">{formatIDR(data.pending)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1 text-[11px]">
                <span>Target Kolektibilitas ({data.targetAnggota} Anggota):</span>
                <span>{formatIDR(data.targetIuran)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between text-emerald-400 font-mono">
                <span>Anggota Lunas:</span>
                <span className="font-bold">{data.anggotaLunas} dari {data.targetAnggota} Anggota</span>
              </div>
              {data.anggotaPending > 0 && (
                <div className="flex justify-between text-amber-400 font-mono">
                  <span>Antrean Pending:</span>
                  <span className="font-bold">{data.anggotaPending} Transaksi</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300 font-mono text-[11px] border-t border-slate-800 pt-1">
                <span>Tingkat Kepatuhan:</span>
                <span className="font-bold text-teal-300">{data.kepatuhanPct}%</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomCashFlowTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const net = data.pemasukan - data.pengeluaran;
      return (
        <div className="bg-slate-900 border border-slate-700 text-white p-3.5 rounded-xl shadow-xl text-xs space-y-2 max-w-xs font-sans">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold text-slate-200">
            <span>{data.fullMonth}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              net >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {net >= 0 ? `Surplus +${formatIDR(net)}` : `Defisit ${formatIDR(net)}`}
            </span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between text-emerald-400">
              <span>Pemasukan Iuran:</span>
              <span className="font-bold">{formatIDR(data.pemasukan)} ({data.txCount} tx)</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>Realisasi Santunan:</span>
              <span className="font-bold">{formatIDR(data.pengeluaran)} ({data.claimCount} klaim)</span>
            </div>
            <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1 text-[11px]">
              <span>Arus Kas Bersih:</span>
              <span className={`font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {net >= 0 ? `+${formatIDR(net)}` : formatIDR(net)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const isAnggota = activeUser?.authority === 'Anggota';
  const myMember = isAnggota 
    ? (getMemberForUser(activeUser, members) || members.find(m => m?.name && activeUser?.name && m.name.toLowerCase() === activeUser.name.toLowerCase()) || members[0])
    : null;

  if (isAnggota && myMember) {
    const expiry = calculateMemberExpiry(myMember, payments, new Date(), settings);
    const myPayments = payments.filter(p => p.memberId === myMember.id || p.memberNumber === myMember.memberNumber);
    const myVerifiedPayments = myPayments.filter(p => p.status === 'Verified');
    const myTotalPaid = myVerifiedPayments.reduce((sum, p) => sum + p.amount, 0);

    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pt-1 sm:pt-2 pb-28 sm:pb-32">
        {/* 📱 MOBILE APP MENU DENGAN WARNA SERAGAM SESUAI GAMBAR */}
        <RoleMobileAppMenu
          activeUser={activeUser}
          roleTitle="PORTAL ANGGOTA"
          userName={myMember.name || activeUser?.name || 'Warga Anggota'}
          roleSubtitle={`${myMember.cluster} • NIK: ${myMember.nik}`}
          counterLabel="STATUS KTA"
          counterValue={myMember.isKtaIssued ? 'Aktif' : 'Proses'}
          counterHighlight={!myMember.isKtaIssued}
          sectionTitle="MENU CEPAT OPERASIONAL ANGGOTA"
          sectionSubtitle="Semua menu navigasi operasional warga anggota"
          actions={getAllNavigationActionsForUser({
            currentTab,
            setCurrentTab,
            activeUser,
            permissions,
            totalMembersCount: members.length,
            totalPaymentsCount: myVerifiedPayments.length,
            totalClaimsCount: claims.length,
            onSelectMemberForPayment: (m) => {
              if (onSelectMemberForPayment) onSelectMemberForPayment(m);
              setCurrentTab('payment');
            },
            onOpenDigitalKta: (m) => setDigitalKtaMember(m),
            myMember,
          })}
          pills={[
            {
              id: 'pill-kta',
              label: 'Buka KTA Digital',
              icon: FileCheck2,
              onClick: () => setDigitalKtaMember(myMember),
            },
            {
              id: 'pill-bayar',
              label: 'Bayar Iuran',
              icon: CreditCard,
              onClick: () => {
                if (onSelectMemberForPayment) onSelectMemberForPayment(myMember);
                setCurrentTab('payment');
              },
            },
            {
              id: 'pill-keluarga',
              label: `Keluarga (${myMember.familyMembers?.length || 0})`,
              icon: Users,
              onClick: () => setSelectedMemberModal(myMember),
            },
            {
              id: 'pill-hubungi',
              label: 'Hubungi Pengurus',
              icon: MessageSquare,
              onClick: () => {
                setContactAdminRole('Admin');
                setContactTopic('iuran');
                setIsContactAdminModalOpen(true);
              },
            },
          ]}
          dockItems={[
            {
              id: 'dock-beranda',
              label: 'Beranda',
              icon: UserCheck,
              isActive: true,
              onClick: () => setCurrentTab('dashboard'),
            },
            {
              id: 'dock-kta',
              label: 'KTA Digital',
              icon: FileCheck2,
              onClick: () => setDigitalKtaMember(myMember),
            },
            {
              id: 'dock-bayar',
              label: 'Bayar Iuran',
              icon: CreditCard,
              isCenterFloating: true,
              onClick: () => {
                if (onSelectMemberForPayment) onSelectMemberForPayment(myMember);
                setCurrentTab('payment');
              },
            },
            {
              id: 'dock-kwitansi',
              label: 'Kwitansi',
              icon: Receipt,
              badge: myVerifiedPayments.length > 0 ? myVerifiedPayments.length : undefined,
              onClick: () => setCurrentTab('history'),
            },
            {
              id: 'dock-bantuan',
              label: 'Bantuan WA',
              icon: MessageSquare,
              onClick: () => {
                setContactAdminRole('Admin');
                setContactTopic('iuran');
                setIsContactAdminModalOpen(true);
              },
            },
          ]}
        />

        {/* 4 Key Status Cards for the Member */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Status Iuran & Perlindungan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Perlindungan Iuran</span>
              <div className={`p-2 rounded-xl ${
                expiry.isExpiringSoon ? 'bg-amber-100 text-amber-800' : expiry.isExpired ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {expiry.isExpiringSoon || expiry.isExpired ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg font-black text-slate-900 leading-tight">{expiry.statusLabel}</h4>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {expiry.expiryDate ? `Habis: ${expiry.expiryDateFormatted}` : 'Belum tercatat'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Masa Aktif:</span>
              <span className={`font-bold ${expiry.isExpiringSoon ? 'text-amber-700' : expiry.isExpired ? 'text-rose-700' : 'text-emerald-700'}`}>
                {expiry.daysRemaining > 0 ? `${expiry.daysRemaining} Hari Tersisa` : 'Jatuh Tempo'}
              </span>
            </div>
          </div>

          {/* Card 2: Tanggungan Keluarga Terlindungi */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggungan Keluarga</span>
              <div className="p-2 rounded-xl bg-teal-100 text-teal-800">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg font-black text-slate-900 leading-tight">
                {myMember.dependentsCount + 1} Jiwa Terlindungi
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                1 Anggota Utama + {myMember.dependentsCount} Tanggungan
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Hak Santunan:</span>
              <span className="font-bold text-teal-700">Terdaftar Penuh</span>
            </div>
          </div>

          {/* Card 3: Total Iuran Saya Terbayar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Iuran Saya Terverifikasi</span>
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg font-black font-mono text-emerald-700 leading-tight">
                {formatIDR(myTotalPaid)}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {myVerifiedPayments.length} Transaksi Terverifikasi Bendahara
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Status Pembayaran:</span>
              <span className="font-bold text-emerald-700">Lunas / Tercatat</span>
            </div>
          </div>

          {/* Card 4: Transparansi Saldo Kas Paguyuban */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Kas Paguyuban</span>
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg font-black font-mono text-slate-900 leading-tight">
                {formatIDR(financials.totalBalance)}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Dana Gotong Royong Warga Aman & Akuntabel
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Transparansi Kas:</span>
              <span className="font-bold text-indigo-700">Terbuka untuk Anggota</span>
            </div>
          </div>
        </div>

        {/* 2-Column Main Section: Digital Card + Dependents & Personal Payment Records */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 cols): KTA Digital & Expiry Notification */}
          <div className="lg:col-span-5 space-y-6">
            {/* Kartu Tanda Anggota Digital Preview */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-2xl border-2 border-emerald-500/40 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      KTA DIGITAL RESMI
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 mt-0.5">{settings.communityName}</h4>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold rounded border border-emerald-500/40">
                  {myMember.cluster}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-3 items-center my-3 relative z-10">
                <div className="col-span-8 space-y-2">
                  <div>
                    <p className="text-[10px] text-slate-400">Nama Anggota:</p>
                    <p className="text-base sm:text-lg font-black text-white tracking-wide truncate">{myMember.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
                    <div>
                      <span className="text-[9px] text-slate-400 block">NPA (No. Anggota):</span>
                      <span className="font-bold text-emerald-400 text-xs">{myMember.memberNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">NIK:</span>
                      <span className="text-xs">{myMember.nik}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 flex flex-col items-center justify-center bg-slate-950/60 p-2 rounded-xl border border-emerald-500/30">
                  <div className="p-1 bg-white rounded-lg shadow">
                    <QRCodeSVG
                      value={JSON.stringify({
                        app: 'KTA-PAGUYUBAN',
                        npa: myMember.memberNumber,
                        name: myMember.name,
                        nik: myMember.nik,
                        cluster: myMember.cluster,
                        status: myMember.status,
                        expiry: expiry.expiryDateFormatted,
                        dependents: myMember.dependentsCount,
                        v: 1
                      })}
                      size={60}
                      level="M"
                      includeMargin={false}
                      bgColor="#FFFFFF"
                      fgColor="#022c22"
                    />
                  </div>
                  <span className="text-[7px] font-mono text-emerald-300 mt-1 uppercase font-bold tracking-tight">
                    Scan QR
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 relative z-10">
                <div className="text-[10px] text-slate-400">
                  <span>Masa Berlaku: </span>
                  <span className="font-mono text-emerald-300 font-bold">{expiry.expiryDateFormatted}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDigitalKtaMember(myMember)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-950" />
                    <span>Buka KTA Digital & Cetak</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Rekening Pembayaran Iuran & Aksi Bayar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Informasi Rekening Kas Iuran</span>
                </h4>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  {formatIDR(settings.annualFeeAmount || 300000)} / Tahun
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {settings.bankAccounts && settings.bankAccounts.length > 0 ? (
                  settings.bankAccounts.map((acc, idx) => (
                    <div key={`dash-bank-${idx}-${acc.accountNumber || idx}`} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{acc.bankName}</span>
                        <p className="font-mono text-xs text-slate-600 mt-0.5">{acc.accountNumber}</p>
                        <p className="text-[10px] text-slate-500">a.n. {acc.accountHolder || (acc as any).holderName}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-white text-slate-700 font-mono text-[10px] rounded border border-slate-200">
                        Transfer
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <p className="font-bold text-slate-900">Transfer Kas Paguyuban</p>
                    <p className="text-xs text-slate-600">BCA / Mandiri / BRI / QRIS</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (onSelectMemberForPayment) {
                    onSelectMemberForPayment(myMember);
                  }
                  setCurrentTab('payment');
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Bayar Iuran Sekarang</span>
              </button>
            </div>
          </div>

          {/* Right Column (7 cols): Covered Dependents & My Recent Payments */}
          <div className="lg:col-span-7 space-y-6">
            {/* Daftar Tanggungan Keluarga Terdaftar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Tanggungan Keluarga ({myMember.dependentsList?.length || 0})</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Anggota keluarga serumah yang berhak atas santunan dana kematian & ambulans jenazah.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('registration')}
                  className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-2xs"
                  title="Ubah data diri dan kelola daftar keluarga"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Kelola & Tambah</span>
                </button>
              </div>

              {(!myMember.dependentsList || myMember.dependentsList.length === 0) ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                  <p className="text-xs font-semibold text-slate-600">Belum ada tanggungan keluarga terdaftar</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hubungi Ketua RT {myMember.cluster} untuk menambahkan data anggota keluarga.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myMember.dependentsList.map((dep, idx) => (
                    <div key={dep.id || idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{dep.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {dep.relationship} {dep.age ? `• Usia: ${dep.age} Th` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold text-[10px] rounded-full border border-emerald-200">
                        Terlindungi Penuh
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Riwayat Pembayaran Iuran Saya (Terbaru) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Riwayat Pembayaran Iuran Saya</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catatan pembayaran yang telah Anda setorkan ke kas paguyuban.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('history')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  Semua Kwitansi →
                </button>
              </div>

              {myPayments.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                  <p className="text-xs font-semibold text-slate-600">Belum ada riwayat pembayaran</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Silakan lakukan pembayaran iuran tahunan melalui menu Bayar Iuran.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myPayments.slice(0, 4).map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.paymentType}</span>
                          <span className="font-mono text-[11px] text-slate-500">({p.periodMonth})</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                          <span>{p.receiptNumber}</span>
                          <span>•</span>
                          <span>{p.createdAt.split(' ')[0]}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {formatIDR(p.amount)}
                        </span>
                        {p.status === 'Verified' ? (
                          <button
                            onClick={() => onViewReceipt(p)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 transition-colors"
                          >
                            Kwitansi
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            p.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {p.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transparansi Penyaluran Dana Kematian Paguyuban */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-rose-600" />
                <span>Transparansi Penyaluran Santunan Duka Paguyuban</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Keterbukaan realisasi santunan kematian bagi keluarga anggota yang berduka sebagai wujud gotong royong.
              </p>
            </div>
            <span className="px-3 py-1 bg-rose-50 text-rose-800 font-mono font-bold text-xs rounded-xl border border-rose-200">
              Total Terealisasi: {formatIDR(financials.totalBenefitSpent)}
            </span>
          </div>

          {claims.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">Belum ada catatan klaim duka yang disalurkan.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {claims.slice(0, 4).map((c) => (
                <div key={c.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">Almarhum/ah {c.deceasedName}</p>
                    <p className="text-[11px] text-slate-600">
                      Keluarga/Ahli Waris: <span className="font-semibold text-slate-800">{c.memberName}</span> ({c.relationship})
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">Wafat: {c.dateOfDeath}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-rose-700 text-xs block">
                      {formatIDR(c.totalAmount)}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 inline-block">
                      Disalurkan
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pusat Bantuan & Kontak Pengurus Paguyuban (Kirim WhatsApp Otomatis) */}
        {(() => {
          const adminContactsList = getAdminContacts(users, settings, myMember.cluster);
          return (
            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-7 rounded-2xl border border-emerald-900/60 shadow-xl space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 -translate-y-6 translate-x-6 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-900/80 pb-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-emerald-800/80 border border-emerald-600 flex items-center justify-center text-emerald-300">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <h4 className="font-black text-base sm:text-lg text-white">
                      Pusat Kontak & Bantuan Pengurus Paguyuban
                    </h4>
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold text-[11px] rounded-full border border-emerald-500/40">
                      Kirim WA Otomatis
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Hubungi pengurus resmi paguyuban dengan nomor WhatsApp terdaftar secara langsung tanpa perlu mengetik ulang data diri.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setContactAdminRole(undefined);
                    setContactTopic('umum');
                    setIsContactAdminModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-emerald-950/40 inline-flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kirim Pesan Kustom</span>
                </button>
              </div>

              {/* Quick Topic Chips */}
              <div className="space-y-2 relative z-10">
                <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                  ⚡ Pilih Keperluan Cepat (Template WhatsApp Siap Kirim):
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContactAdminRole('Bendahara');
                      setContactTopic('iuran');
                      setIsContactAdminModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl text-xs font-semibold border border-emerald-700/60 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Konfirmasi / Tanya Iuran (Bendahara)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContactAdminRole('Admin');
                      setContactTopic('duka');
                      setIsContactAdminModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 hover:text-white rounded-xl text-xs font-semibold border border-rose-800/60 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />
                    <span>Lapor Duka & Santunan (Admin / DKM)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContactAdminRole('RT');
                      setContactTopic('keluarga');
                      setIsContactAdminModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-950/70 hover:bg-blue-900 text-blue-200 hover:text-white rounded-xl text-xs font-semibold border border-blue-800/60 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ubah Data Keluarga (Ketua RT {myMember.cluster})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContactAdminRole('Admin');
                      setContactTopic('verifikasi');
                      setIsContactAdminModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900 text-amber-200 hover:text-white rounded-xl text-xs font-semibold border border-amber-800/60 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Status Verifikasi Akun</span>
                  </button>
                </div>
              </div>

              {/* Grid of Official Pengurus Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2 relative z-10">
                {adminContactsList.slice(0, 6).map((contact) => {
                  // Direct 1-tap WhatsApp message URL generator
                  const defaultMsg = buildAdminContactMessage('umum', myMember, contact, undefined, settings);
                  const directUrl = createAdminWhatsAppUrl(contact.phone, defaultMsg);

                  return (
                    <div
                      key={contact.id}
                      className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 hover:border-emerald-700/80 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-full ${
                              contact.avatarColor || 'bg-slate-700'
                            } text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-inner`}
                          >
                            {contact.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-sm text-white truncate">
                              {contact.name}
                            </p>
                            <p className="text-[11px] text-emerald-400 font-semibold truncate">
                              {contact.role}
                            </p>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {contact.description}
                        </p>

                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-200 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="font-bold">{contact.displayPhone}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            window.open(directUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-950/20 inline-flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                          title={`Kirim WA langsung ke ${contact.name}`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim WA</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (contact.authority === 'Bendahara') setContactAdminRole('Bendahara');
                            else if (contact.authority === 'Ketua RT (Cluster)') setContactAdminRole('RT');
                            else setContactAdminRole('Admin');
                            setContactTopic('iuran');
                            setIsContactAdminModalOpen(true);
                          }}
                          className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                          title="Pilih topik pesan & pratinjau"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Modal Detail Anggota */}
        {selectedMemberModal && (
          <MemberDetailModal
            member={selectedMemberModal}
            payments={payments}
            claims={claims}
            settings={settings}
            onClose={() => setSelectedMemberModal(null)}
            onViewReceipt={onViewReceipt}
            onSelectMemberForPayment={onSelectMemberForPayment}
            onOpenFullKtaModal={(mem) => {
              setDigitalKtaMember(mem);
            }}
          />
        )}

        {/* Modal KTA Digital & QR Code Resmi */}
        {digitalKtaMember && (
          <DigitalKtaModal
            member={digitalKtaMember}
            payments={payments}
            settings={settings}
            isOpen={!!digitalKtaMember}
            onClose={() => setDigitalKtaMember(null)}
          />
        )}

        {/* Modal Hubungi Admin via WhatsApp */}
        <ContactAdminModal
          users={users}
          member={myMember}
          settings={settings}
          isOpen={isContactAdminModalOpen}
          onClose={() => setIsContactAdminModalOpen(false)}
          defaultAdminRole={contactAdminRole}
          defaultTopic={contactTopic}
        />
      </div>
    );
  }

  const isKetuaRT = activeUser?.authority === 'Ketua RT (Cluster)';
  const rtCluster = (activeUser?.cluster as ClusterType) || 'Cluster Sanur';

  if (isKetuaRT) {
    const rtMembers = members.filter((m) => m.cluster === rtCluster);
    const rtActiveMembers = rtMembers.filter(
      (m) => m.status === 'Aktif' || m.verificationStatus === 'Verified'
    );
    const rtPendingMembers = rtMembers.filter(
      (m) => m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending'
    );
    const rtTotalDependents = rtMembers.reduce((sum, m) => sum + (m.dependentsCount || 0), 0);
    const rtTotalSouls = rtActiveMembers.length + rtActiveMembers.reduce((sum, m) => sum + (m.dependentsCount || 0), 0);

    const rtPayments = payments.filter((p) => {
      const mem = members.find((m) => m.id === p.memberId || m.memberNumber === p.memberNumber);
      return mem?.cluster === rtCluster;
    });
    const rtVerifiedPayments = rtPayments.filter((p) => p.status === 'Verified');
    const rtTotalCollected = rtVerifiedPayments.reduce((sum, p) => sum + p.amount, 0);
    const rtAnnualTarget = rtActiveMembers.length * (settings.annualFeeAmount || 300000);
    const rtCompliancePct = rtAnnualTarget > 0 ? Math.min(100, Math.round((rtTotalCollected / rtAnnualTarget) * 100)) : 0;

    // Expiry status analysis for RT members
    const rtMembersWithExpiry = rtMembers.map((m) => ({
      member: m,
      expiry: calculateMemberExpiry(m, payments, new Date(), settings),
    }));

    const rtExpiringSoon = rtMembersWithExpiry.filter(
      (item) => (item.member.status === 'Aktif' || item.member.verificationStatus === 'Verified') && item.expiry.isExpiringSoon
    );
    const rtExpired = rtMembersWithExpiry.filter(
      (item) => (item.member.status === 'Aktif' || item.member.verificationStatus === 'Verified') && item.expiry.isExpired
    );
    const rtPaidActive = rtMembersWithExpiry.filter(
      (item) => (item.member.status === 'Aktif' || item.member.verificationStatus === 'Verified') && !item.expiry.isExpired && !item.expiry.isExpiringSoon
    );

    const filteredRtMembers = rtMembersWithExpiry.filter(({ member, expiry }) => {
      const query = rtSearchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query) ||
        member.nik.includes(query) ||
        member.memberNumber.toLowerCase().includes(query) ||
        member.phone.toLowerCase().includes(query) ||
        member.address.toLowerCase().includes(query);

      let matchesStatus = true;
      if (rtStatusFilter === 'Semua') matchesStatus = true;
      else if (rtStatusFilter === 'Aktif') matchesStatus = (member.status === 'Aktif' || member.verificationStatus === 'Verified') && !expiry.isExpired;
      else if (rtStatusFilter === 'Menunggu Verifikasi RT') matchesStatus = member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending';
      else if (rtStatusFilter === 'Segera Habis') matchesStatus = (member.status === 'Aktif' || member.verificationStatus === 'Verified') && expiry.isExpiringSoon;
      else if (rtStatusFilter === 'Jatuh Tempo') matchesStatus = (member.status === 'Aktif' || member.verificationStatus === 'Verified') && expiry.isExpired;

      return matchesSearch && matchesStatus;
    });

    const solvencyClaimCount = settings.mainMemberBenefitAmount > 0 
      ? Math.floor(financials.totalBalance / settings.mainMemberBenefitAmount) 
      : 0;

    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pt-1 sm:pt-2 pb-28 sm:pb-32">
        {/* 📱 MOBILE APP MENU DENGAN WARNA SERAGAM SESUAI GAMBAR */}
        <RoleMobileAppMenu
          activeUser={activeUser}
          roleTitle="KETUA RT"
          userName={activeUser?.name || 'Ketua RT'}
          roleSubtitle={`Ketua RT ${rtCluster} • Wilayah Binaan Warga`}
          counterLabel="PERLU VERIFIKASI"
          counterValue={`${rtPendingMembers.length} Warga`}
          counterHighlight={rtPendingMembers.length > 0}
          sectionTitle="MENU CEPAT OPERASIONAL RT"
          sectionSubtitle="Semua menu navigasi operasional wilayah RT"
          actions={[
            ...getAllNavigationActionsForUser({
              currentTab,
              setCurrentTab,
              activeUser,
              permissions,
              pendingRtVerificationCount: rtPendingMembers.length,
              pendingCount: 0,
              pendingPaguyubanApprovalCount: 0,
              overdueGraceCount: 0,
              totalMembersCount: rtMembers.length,
              totalPaymentsCount: payments.length,
              totalClaimsCount: claims.length,
              totalUsersCount: users.length,
              onOpenExportModal,
              onSelectMemberForPayment,
              onOpenDigitalKta: (m) => setDigitalKtaMember(m),
              myMember,
            }),
            {
              id: 'scan-kta',
              label: 'Scan KTA',
              subLabel: 'Pindai Barcode Warga',
              gradient: 'from-teal-600 to-emerald-500',
              icon: Scan,
              onClick: () => setIsKtaScannerOpen(true),
            },
          ]}
          pills={[
            {
              id: 'pill-verifikasi',
              label: 'Antrean Verifikasi',
              count: rtPendingMembers.length,
              icon: ShieldCheck,
              isActive: rtPendingMembers.length > 0,
              onClick: () => setCurrentTab('rt-verification'),
            },
            {
              id: 'pill-klaim',
              label: 'Klaim Manfaat',
              icon: HeartHandshake,
              onClick: () => setCurrentTab('realization'),
            },
            {
              id: 'pill-warga',
              label: 'Data Warga RT',
              count: rtActiveMembers.length,
              icon: Users,
              onClick: () => {
                const tableEl = document.getElementById('rt-member-table-section');
                tableEl?.scrollIntoView({ behavior: 'smooth' });
              },
            },
            {
              id: 'pill-segera-habis',
              label: 'Segera Habis',
              count: rtExpiringSoon.length,
              icon: Bell,
              onClick: () => {
                setRtStatusFilter('Segera Habis');
                const tableEl = document.getElementById('rt-member-table-section');
                tableEl?.scrollIntoView({ behavior: 'smooth' });
              },
            },
          ]}
          dockItems={[
            {
              id: 'dock-verifikasi',
              label: 'Verifikasi',
              icon: ShieldCheck,
              badge: rtPendingMembers.length > 0 ? rtPendingMembers.length : undefined,
              onClick: () => setCurrentTab('rt-verification'),
            },
            {
              id: 'dock-klaim',
              label: 'Klaim Manfaat',
              icon: HeartHandshake,
              onClick: () => setCurrentTab('realization'),
            },
            {
              id: 'dock-scan',
              label: 'Scan KTA',
              icon: Scan,
              isCenterFloating: true,
              onClick: () => setIsKtaScannerOpen(true),
            },
            {
              id: 'dock-data',
              label: 'Data RT',
              icon: Users,
              isActive: true,
              onClick: () => {
                const tableEl = document.getElementById('rt-member-table-section');
                tableEl?.scrollIntoView({ behavior: 'smooth' });
              },
            },
            {
              id: 'dock-setor',
              label: 'Setor Kas',
              icon: CreditCard,
              onClick: () => setCurrentTab('payment'),
            },
          ]}
        />

        {/* Real-time System Notifications & Alerts */}
        <DashboardNotifications
          notifications={notifications}
          activeUser={activeUser || null}
          onDismissNotification={onDismissNotification || (() => {})}
          onMarkNotificationRead={onMarkNotificationRead || (() => {})}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead || (() => {})}
          onClearAllNotifications={onClearAllNotifications || (() => {})}
          onNavigateTab={setCurrentTab}
        />

        {/* 1. FISCAL HEALTH SECTION (KESEHATAN FISKAL PAGUYUBAN & WILAYAH RT) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Kesehatan Fiskal & Kepatuhan Iuran RT</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Indikator ketahanan dana duka paguyuban serta kinerja penerimaan iuran warga di {rtCluster}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Arus Kas Paguyuban: {isNetPositive ? 'Surplus / Aman' : 'Defisit Terkendali'}</span>
              </span>
            </div>
          </div>

          {/* 4 Fiscal Health Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Saldo Kas Paguyuban */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Kas Paguyuban
                </span>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {formatIDR(financials.totalBalance)}
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Dana Cadangan Duka</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                    {solvencyClaimCount}x Santunan Utama
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Penerimaan Iuran RT */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Iuran Terkumpul ({rtCluster})
                </span>
                <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition-all">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-700 tracking-tight">
                  {formatIDR(rtTotalCollected)}
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>{rtVerifiedPayments.length} Setoran Terverifikasi</span>
                  <span className="font-semibold text-slate-500 text-[11px]">
                    Target: {formatIDR(rtAnnualTarget)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Tingkat Kepatuhan Iuran RT */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Kepatuhan Iuran RT
                </span>
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-blue-700 tracking-tight">
                    {rtCompliancePct}%
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    ({rtPaidActive.length}/{rtActiveMembers.length} KK Lunas)
                  </span>
                </div>

                {/* Mini Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, rtCompliancePct))}%` }}
                  />
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="text-amber-600 font-semibold">{rtExpiringSoon.length} Segera Habis</span>
                  <span className="text-rose-600 font-semibold">{rtExpired.length} Jatuh Tempo</span>
                </div>
              </div>
            </div>

            {/* Card 4: Penyaluran Santunan Duka */}
            <div
              onClick={() => setCurrentTab('realization')}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group cursor-pointer"
              title="Ketuk untuk membuka modul Klaim Manfaat Duka"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Santunan Tersalurkan
                </span>
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all">
                  <HeartHandshake className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black font-mono text-rose-700 tracking-tight">
                  {formatIDR(financials.totalBenefitSpent)}
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span className="text-rose-600 font-bold group-hover:underline flex items-center gap-1">
                    Klaim Manfaat →
                  </span>
                  <span className="font-bold text-slate-700 text-[11px]">{claims.length} Peristiwa Duka</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACTION ALERTS (PENDING RT & EXPIRING SOON OUTREACH) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alert 1: Pending RT Verification */}
          {rtPendingMembers.length > 0 ? (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-amber-100/60 rounded-2xl border border-amber-300 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-200/80 text-amber-900 rounded-xl shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5 text-amber-900" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-amber-950 flex items-center gap-2">
                    <span>{rtPendingMembers.length} Warga Menunggu Verifikasi RT</span>
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                      Tindakan Dibutuhkan
                    </span>
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Terdapat pendaftaran warga baru di {rtCluster} yang belum diverifikasi. Verifikasi segera agar warga dapat membayar iuran dan menerima perlindungan duka.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentTab('rt-verification')}
                className="shrink-0 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5"
              >
                <span>Verifikasi Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="p-5 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-emerald-900 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-emerald-950">Verifikasi Warga RT Tuntas</h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Seluruh pendaftaran warga di {rtCluster} telah terverifikasi dengan baik.
                </p>
              </div>
            </div>
          )}

          {/* Alert 2: Early Outreach Warning (≤ 30 Hari Expiring) */}
          {rtExpiringSoon.length > 0 ? (
            <div className="p-5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-300 text-orange-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-orange-200/80 text-orange-900 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-orange-700" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-orange-950 flex items-center gap-2">
                    <span>{rtExpiringSoon.length} Warga Masa Iuran Segera Habis (≤ 30 Hari)</span>
                  </h4>
                  <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                    Kirim pengingat ramah via WhatsApp agar warga segera memperpanjang iuran tahunan sebelum masa perlindungan berakhir.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRtStatusFilter('Segera Habis')}
                className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5"
              >
                <span>Lihat Warga Ini</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-slate-200 text-slate-700 rounded-xl shrink-0">
                <CalendarCheck className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Masa Perlindungan Iuran Terjaga</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Tidak ada warga {rtCluster} yang masa perlindungannya kedaluwarsa dalam 30 hari ke depan.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. DATA ANGGOTA SESUAI RT ({rtCluster}) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
          {/* Header Data Anggota RT */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <span>Data Anggota & Warga {rtCluster}</span>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                      Khusus RT Anda
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menampilkan total <strong>{rtMembers.length} KK</strong> ({rtTotalSouls} Jiwa Terdaftar) di wilayah {rtCluster}.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Metrics Chips & Actions */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold">
                {rtActiveMembers.length} Aktif Terlindungi
              </span>
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold">
                {rtPendingMembers.length} Menunggu Verifikasi RT
              </span>
              <button
                type="button"
                onClick={() => setCurrentTab('realization')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-xl font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Buka Formulir Pengajuan Klaim Manfaat Duka"
              >
                <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                <span>Klaim Manfaat</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Cari nama warga, NIK, No. Anggota di ${rtCluster}...`}
                value={rtSearchTerm}
                onChange={(e) => setRtSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
              />
              {rtSearchTerm && (
                <button
                  onClick={() => setRtSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {(
                [
                  { id: 'Semua', label: `Semua (${rtMembers.length})` },
                  { id: 'Aktif', label: `Aktif (${rtPaidActive.length})` },
                  { id: 'Menunggu Verifikasi RT', label: `Pending RT (${rtPendingMembers.length})` },
                  { id: 'Segera Habis', label: `Segera Habis (${rtExpiringSoon.length})` },
                  { id: 'Jatuh Tempo', label: `Jatuh Tempo (${rtExpired.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRtStatusFilter(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    rtStatusFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Data Warga RT */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Warga / NIK</th>
                  <th className="px-4 py-3.5">Alamat & Kontak</th>
                  <th className="px-4 py-3.5 text-center">Tanggungan</th>
                  <th className="px-4 py-3.5">Status Keanggotaan</th>
                  <th className="px-4 py-3.5">Masa Berlaku Iuran</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRtMembers.length > 0 ? (
                  filteredRtMembers.map(({ member, expiry }) => {
                    const isPending = member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending';
                    const isWarning = expiry.isExpiringSoon;
                    const isExpired = expiry.isExpired && !isPending;

                    return (
                      <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Warga & NIK */}
                        <td className="px-4 py-3.5">
                          <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>{member.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                              {member.memberNumber}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            NIK: {member.nik}
                          </div>
                        </td>

                        {/* Alamat & Kontak */}
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-slate-700 truncate max-w-[200px]" title={member.address}>
                            {member.address}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{member.phone}</span>
                          </div>
                        </td>

                        {/* Tanggungan */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded-lg border border-slate-200">
                            {member.dependentsCount || 0} Jiwa
                          </span>
                        </td>

                        {/* Status Keanggotaan */}
                        <td className="px-4 py-3.5">
                          {isPending ? (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Menunggu Verifikasi RT</span>
                            </span>
                          ) : member.status === 'Aktif' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Terverifikasi RT</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold">
                              {member.status}
                            </span>
                          )}
                        </td>

                        {/* Masa Berlaku Iuran */}
                        <td className="px-4 py-3.5">
                          {isPending ? (
                            <span className="text-slate-400 text-xs italic">Belum Buka Iuran</span>
                          ) : isWarning ? (
                            <div>
                              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-md text-[11px] font-extrabold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Segera Habis ({expiry.daysRemaining} hari)</span>
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Jatuh Tempo: {expiry.expiryDateFormatted}
                              </div>
                            </div>
                          ) : isExpired ? (
                            <div>
                              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-md text-[11px] font-bold inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Kedaluwarsa</span>
                              </span>
                              <div className="text-[10px] text-rose-600 font-mono mt-0.5">
                                Habis {expiry.expiryDateFormatted}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-bold inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Aktif ({expiry.daysRemaining} hari)</span>
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                s.d. {expiry.expiryDateFormatted}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending ? (
                              <button
                                onClick={() => setCurrentTab('rt-verification')}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm inline-flex items-center gap-1"
                                title="Buka menu verifikasi RT"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Verifikasi</span>
                              </button>
                            ) : (
                              <>
                                {(isWarning || isExpired) && (
                                  <button
                                    onClick={() => setOutreachMember(member)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg transition-all"
                                    title="Kirim pengingat perpanjangan via WhatsApp"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => setSelectedMemberModal(member)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                                  title="Lihat KTA Digital & Data Keluarga"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (onSelectMemberForPayment) {
                                      onSelectMemberForPayment(member);
                                    }
                                    setCurrentTab('payment');
                                  }}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-sm"
                                  title="Bantu Setor / Bayar Iuran Warga"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                      Tidak ada data anggota di {rtCluster} yang sesuai dengan kriteria filter atau pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Privacy & Isolation Notice */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p>
              <strong>Isolasi Data Lingkup RT ({rtCluster}):</strong> Demi menjaga privasi warga dan tata kelola rukun tetangga yang akuntabel, dashboard Ketua RT hanya menampilkan data anggota di wilayah binaan RT Anda ({rtCluster}). Data anggota dari RT/Cluster lain disembunyikan secara otomatis.
            </p>
          </div>
        </div>

        {/* Modal Detail Anggota */}
        {selectedMemberModal && (
          <MemberDetailModal
            member={selectedMemberModal}
            payments={payments}
            claims={claims}
            settings={settings}
            onClose={() => setSelectedMemberModal(null)}
            onViewReceipt={onViewReceipt}
            onSelectMemberForPayment={onSelectMemberForPayment}
            onOpenFullKtaModal={(mem) => {
              setDigitalKtaMember(mem);
            }}
          />
        )}

        {/* Modal KTA Digital Resmi */}
        {digitalKtaMember && (
          <DigitalKtaModal
            member={digitalKtaMember}
            payments={payments}
            settings={settings}
            isOpen={!!digitalKtaMember}
            onClose={() => setDigitalKtaMember(null)}
          />
        )}

        {/* Modal Scanner / Verifikasi KTA */}
        <KtaScannerModal
          isOpen={isKtaScannerOpen}
          members={members}
          payments={payments}
          settings={settings}
          onClose={() => setIsKtaScannerOpen(false)}
          onOpenKtaModal={(mem) => {
            setDigitalKtaMember(mem);
          }}
          onSelectMember={(mem) => {
            setSelectedMemberModal(mem);
          }}
          onSelectMemberForPayment={onSelectMemberForPayment}
        />

        {/* Modal WhatsApp Early Outreach */}
        {outreachMember && (
          <EarlyOutreachModal
            isOpen={!!outreachMember}
            member={outreachMember}
            payments={payments}
            settings={settings}
            onClose={() => setOutreachMember(null)}
            onSelectMemberForPayment={onSelectMemberForPayment}
          />
        )}
      </div>
    );
  }

  const isBendahara = activeUser?.authority === 'Bendahara';
  const isAdmin = activeUser?.authority === 'Admin';
  const isKetuaPaguyuban = activeUser?.authority === 'Ketua Paguyuban';
  const isKetuaRW = activeUser?.authority === 'Ketua RW';
  const isKetuaDKM = activeUser?.authority === 'Ketua DKM';
  const verifiedPaymentsCount = payments.filter((p) => p.status === 'Verified').length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pt-1 sm:pt-2 pb-28 sm:pb-32">
      {/* 📱 MOBILE APP MENU DENGAN WARNA SERAGAM SESUAI GAMBAR */}
      <RoleMobileAppMenu
        activeUser={activeUser}
        roleTitle={
          isBendahara
            ? 'BENDAHARA PAGUYUBAN'
            : isKetuaPaguyuban
            ? 'KETUA PAGUYUBAN'
            : isKetuaRW
            ? 'KETUA RW'
            : isKetuaDKM
            ? 'KETUA DKM'
            : isKetuaRT
            ? 'KETUA RT'
            : 'ADMINISTRATOR'
        }
        userName={activeUser?.name || 'Administrator'}
        roleSubtitle={
          isBendahara
            ? 'Bendahara Kas • Validasi Pembayaran & Rekap Keuangan'
            : isKetuaPaguyuban
            ? 'Ketua Paguyuban • Hak Pengesahan Akhir & KTA'
            : isKetuaRW
            ? 'Ketua RW 05 • Supervisi Wilayah & Pengawas Santunan'
            : isKetuaDKM
            ? 'Ketua DKM • Koordinasi Fardhu Kifayah & Santunan Jamaah'
            : isKetuaRT
            ? 'Ketua RT • Verifikasi Berkas & Pelayanan Warga Cluster'
            : 'Admin Utama • Akses Penuh Sistem & Master Data'
        }
        counterLabel={
          isBendahara
            ? 'PERLU VALIDASI'
            : isKetuaPaguyuban
            ? 'PERLU PENGESAHAN'
            : isKetuaRW
            ? 'MONITORING RW'
            : isKetuaDKM
            ? 'SANTUNAN UMAT'
            : 'TOTAL ANTREAN'
        }
        counterValue={
          isBendahara
            ? `${pendingPayments.length} Transaksi`
            : isKetuaPaguyuban
            ? `${members.filter(m => !m.isKtaIssued).length} Warga`
            : isKetuaRW
            ? `${members.length} KK Terdaftar`
            : isKetuaDKM
            ? `${claims.length} Klaim Duka`
            : `${pendingRtMembersCount} Berkas`
        }
        counterHighlight={
          isBendahara
            ? pendingPayments.length > 0
            : isKetuaPaguyuban
            ? members.filter(m => !m.isKtaIssued).length > 0
            : isKetuaRW
            ? pendingRtMembersCount > 0
            : isKetuaDKM
            ? claims.some(c => c.status === 'Submitted' || c.status === 'Pending')
            : pendingRtMembersCount > 0
        }
        sectionTitle={
          isAdmin
            ? 'MENU CEPAT ADMINISTRATOR SISTEM'
            : isBendahara
            ? 'MENU CEPAT OPERASIONAL BENDAHARA'
            : isKetuaPaguyuban
            ? 'MENU CEPAT KETUA PAGUYUBAN'
            : isKetuaRW
            ? 'MENU SUPERVISI KETUA RW 05'
            : isKetuaDKM
            ? 'MENU KOORDINASI KETUA DKM'
            : 'MENU CEPAT OPERASIONAL RT'
        }
        sectionSubtitle={
          isKetuaRW
            ? 'Ketuk modul untuk pengawasan lintas RT & laporan kas paguyuban'
            : isKetuaDKM
            ? 'Ketuk modul untuk santunan duka umat & data jamaah'
            : 'Ketuk ikon untuk membuka modul aplikasi'
        }
        actions={[
          ...getAllNavigationActionsForUser({
            currentTab,
            setCurrentTab,
            activeUser,
            permissions,
            pendingRtVerificationCount: pendingRtMembersCount,
            pendingCount: pendingPayments.length,
            pendingPaguyubanApprovalCount,
            overdueGraceCount: graceSummary.overdueCount,
            totalMembersCount: members.length,
            totalPaymentsCount: verifiedPaymentsCount,
            totalClaimsCount: claims.length,
            totalUsersCount: users.length,
            onOpenExportModal,
            onSelectMemberForPayment,
            onOpenDigitalKta: (m) => setDigitalKtaMember(m),
            myMember,
          }),
          ...(isKetuaRW || isKetuaDKM || isKetuaPaguyuban
            ? [
                {
                  id: 'kesehatan-fiskal-quick',
                  label: 'Kesehatan Fiskal',
                  subLabel: 'Arus Kas & Solvensi',
                  badge: isNetPositive ? 'Surplus' : 'Defisit',
                  gradient: 'from-emerald-600 to-teal-500',
                  icon: Activity,
                  onClick: () => {
                    const el = document.getElementById('section-kesehatan-fiskal-overview');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  },
                },
              ]
            : []),
        ]}
        pills={[
          ...(isKetuaRW
            ? [
                {
                  id: 'pill-antrean-rw',
                  label: 'Antrean Berkas RT',
                  count: pendingRtMembersCount,
                  icon: ShieldCheck,
                  isActive: pendingRtMembersCount > 0,
                  onClick: () => setCurrentTab('rt-verification'),
                },
                {
                  id: 'pill-pengesahan-rw',
                  label: 'Pengesahan KTA',
                  count: pendingPaguyubanApprovalCount,
                  icon: Crown,
                  onClick: () => setCurrentTab('paguyuban-approval'),
                },
                {
                  id: 'pill-klaim-rw',
                  label: 'Klaim Duka RW',
                  count: claims.length,
                  icon: HeartHandshake,
                  onClick: () => setCurrentTab('realization'),
                },
                {
                  id: 'pill-laporan-rw',
                  label: 'Laporan Kas RW',
                  count: verifiedPaymentsCount,
                  icon: FileSpreadsheet,
                  onClick: () => setCurrentTab('history'),
                },
                {
                  id: 'pill-fiskal-rw',
                  label: 'Kesehatan Fiskal',
                  count: isNetPositive ? 'Kas Surplus' : 'Defisit',
                  icon: Activity,
                  onClick: () => {
                    const el = document.getElementById('section-kesehatan-fiskal-overview');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  },
                },
              ]
            : isKetuaDKM
            ? [
                {
                  id: 'pill-santunan-dkm',
                  label: 'Santunan Duka',
                  count: claims.length,
                  icon: HeartHandshake,
                  isActive: claims.length > 0,
                  onClick: () => setCurrentTab('realization'),
                },
                {
                  id: 'pill-jamaah-dkm',
                  label: 'Jamaah Terdaftar',
                  count: members.length,
                  icon: Users,
                  onClick: () => setCurrentTab('registration'),
                },
                {
                  id: 'pill-laporan-dkm',
                  label: 'Laporan Santunan',
                  icon: FileSpreadsheet,
                  onClick: () => setCurrentTab('history'),
                },
                {
                  id: 'pill-fiskal-dkm',
                  label: 'Ketahanan Dana',
                  count: isNetPositive ? 'Kas Surplus' : 'Defisit',
                  icon: Activity,
                  onClick: () => {
                    const el = document.getElementById('section-kesehatan-fiskal-overview');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  },
                },
              ]
            : [
                {
                  id: 'pill-antrean',
                  label: isBendahara
                    ? 'Antrean Validasi'
                    : isKetuaPaguyuban
                    ? 'Pengesahan Ketua'
                    : 'Antrean Berkas',
                  count: isBendahara
                    ? pendingPayments.length
                    : isKetuaPaguyuban
                    ? pendingPaguyubanApprovalCount
                    : pendingRtMembersCount,
                  icon: isBendahara ? CheckSquare : isKetuaPaguyuban ? Crown : ShieldCheck,
                  isActive: (isBendahara
                    ? pendingPayments.length
                    : isKetuaPaguyuban
                    ? pendingPaguyubanApprovalCount
                    : pendingRtMembersCount) > 0,
                  onClick: () =>
                    setCurrentTab(
                      isBendahara
                        ? 'validation'
                        : isKetuaPaguyuban
                        ? 'paguyuban-approval'
                        : 'rt-verification'
                    ),
                },
                {
                  id: 'pill-jatuh-tempo',
                  label: 'Jatuh Tempo 7 Hari',
                  count: expiring7Summary.expiringCount,
                  icon: Bell,
                  onClick: () => {
                    setIsDueReminderModalOpen(true);
                  },
                },
                {
                  id: 'pill-riwayat',
                  label: 'Riwayat Transaksi',
                  count: verifiedPaymentsCount,
                  icon: Receipt,
                  onClick: () => setCurrentTab('history'),
                },
                ...(isKetuaPaguyuban
                  ? [
                      {
                        id: 'pill-fiskal-ketua',
                        label: 'Kesehatan Fiskal',
                        count: isNetPositive ? 'Kas Surplus' : 'Defisit',
                        icon: Activity,
                        onClick: () => {
                          const el = document.getElementById('section-kesehatan-fiskal-overview');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        },
                      },
                    ]
                  : []),
                ...(isAdmin
                  ? [
                      {
                        id: 'pill-pengaturan-sistem',
                        label: 'Pengaturan Sistem',
                        icon: SettingsIcon,
                        onClick: () => setCurrentTab('settings'),
                      },
                      {
                        id: 'pill-pengguna',
                        label: 'User & Otoritas',
                        count: users.length,
                        icon: UserCog,
                        onClick: () => setCurrentTab('users'),
                      },
                    ]
                  : []),
              ]),
        ]}
        dockItems={
          isAdmin
            ? [
                {
                  id: 'dock-dashboard',
                  label: 'Dashboard',
                  icon: Users,
                  isActive: true,
                  onClick: () => setCurrentTab('dashboard'),
                },
                {
                  id: 'dock-action',
                  label: 'Verifikasi',
                  icon: ShieldCheck,
                  badge: pendingRtMembersCount > 0 ? pendingRtMembersCount : undefined,
                  onClick: () => setCurrentTab('rt-verification'),
                },
                {
                  id: 'dock-iuran',
                  label: 'Input Iuran',
                  icon: CreditCard,
                  isCenterFloating: true,
                  onClick: () => setCurrentTab('payment'),
                },
                {
                  id: 'dock-settings',
                  label: 'Atur Sistem',
                  icon: SettingsIcon,
                  onClick: () => setCurrentTab('settings'),
                },
                {
                  id: 'dock-users',
                  label: 'Otoritas',
                  icon: UserCog,
                  badge: users.length,
                  onClick: () => setCurrentTab('users'),
                },
              ]
            : isKetuaRW
            ? [
                {
                  id: 'dock-dashboard-rw',
                  label: 'Beranda RW',
                  icon: Users,
                  isActive: true,
                  onClick: () => setCurrentTab('dashboard'),
                },
                {
                  id: 'dock-verifikasi-rw',
                  label: 'Verifikasi RT',
                  icon: ShieldCheck,
                  badge: pendingRtMembersCount > 0 ? pendingRtMembersCount : undefined,
                  onClick: () => setCurrentTab('rt-verification'),
                },
                {
                  id: 'dock-history-rw',
                  label: 'Laporan Kas',
                  icon: FileSpreadsheet,
                  isCenterFloating: true,
                  onClick: () => setCurrentTab('history'),
                },
                {
                  id: 'dock-santunan-rw',
                  label: 'Santunan RW',
                  icon: HeartHandshake,
                  onClick: () => setCurrentTab('realization'),
                },
                {
                  id: 'dock-warga-rw',
                  label: 'Warga RW',
                  icon: Users,
                  onClick: () => setCurrentTab('registration'),
                },
              ]
            : isKetuaDKM
            ? [
                {
                  id: 'dock-dashboard-dkm',
                  label: 'Beranda DKM',
                  icon: Users,
                  isActive: true,
                  onClick: () => setCurrentTab('dashboard'),
                },
                {
                  id: 'dock-jamaah-dkm',
                  label: 'Jamaah',
                  icon: Users,
                  onClick: () => setCurrentTab('registration'),
                },
                {
                  id: 'dock-santunan-dkm',
                  label: 'Santunan Duka',
                  icon: HeartHandshake,
                  isCenterFloating: true,
                  onClick: () => setCurrentTab('realization'),
                },
                {
                  id: 'dock-history-dkm',
                  label: 'Laporan',
                  icon: FileSpreadsheet,
                  onClick: () => setCurrentTab('history'),
                },
                {
                  id: 'dock-public-dkm',
                  label: 'Info Duka',
                  icon: Building2,
                  onClick: () => setCurrentTab('public'),
                },
              ]
            : [
                {
                  id: 'dock-dashboard',
                  label: 'Dashboard',
                  icon: Users,
                  isActive: true,
                  onClick: () => setCurrentTab('dashboard'),
                },
                {
                  id: 'dock-action',
                  label: isBendahara ? 'Validasi' : isKetuaPaguyuban ? 'Pengesahan' : 'Verifikasi',
                  icon: isBendahara ? CheckCircle2 : isKetuaPaguyuban ? Crown : ShieldCheck,
                  badge: (isBendahara
                    ? pendingPayments.length
                    : isKetuaPaguyuban
                    ? pendingPaguyubanApprovalCount
                    : pendingRtMembersCount) > 0
                    ? (isBendahara
                        ? pendingPayments.length
                        : isKetuaPaguyuban
                        ? pendingPaguyubanApprovalCount
                        : pendingRtMembersCount)
                    : undefined,
                  onClick: () =>
                    setCurrentTab(
                      isBendahara
                        ? 'validation'
                        : isKetuaPaguyuban
                        ? 'paguyuban-approval'
                        : 'rt-verification'
                    ),
                },
                {
                  id: 'dock-iuran',
                  label: 'Input Iuran',
                  icon: CreditCard,
                  isCenterFloating: true,
                  onClick: () => setCurrentTab('payment'),
                },
                {
                  id: 'dock-laporan',
                  label: 'Laporan',
                  icon: FileSpreadsheet,
                  onClick: () => {
                    if (onOpenExportModal) {
                      onOpenExportModal();
                    } else {
                      exportMonthlyFinancialStatementCSV('Agustus 2026', settings, payments, claims, members, getBaseBalance());
                    }
                  },
                },
                {
                  id: 'dock-santunan',
                  label: 'Santunan',
                  icon: HeartHandshake,
                  onClick: () => setCurrentTab('realization'),
                },
              ]
        }
      />

      {/* Real-time System Notifications & Alerts */}
      <DashboardNotifications
        notifications={notifications}
        activeUser={activeUser || null}
        onDismissNotification={onDismissNotification || (() => {})}
        onMarkNotificationRead={onMarkNotificationRead || (() => {})}
        onMarkAllNotificationsRead={onMarkAllNotificationsRead || (() => {})}
        onClearAllNotifications={onClearAllNotifications || (() => {})}
        onNavigateTab={setCurrentTab}
      />

      {/* 🚨 BENDAHARA / ADMIN GRACE PERIOD OVERDUE NOTIFICATION BANNER */}
      {graceSummary.hasOverdue && (
        <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900 rounded-2xl p-5 sm:p-6 text-white border-2 border-rose-500/80 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/40 shrink-0 mt-0.5 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Pemberitahuan Bendahara: {graceSummary.overdueCount} Bukti Pembayaran Melebihi Toleransi 30 Hari
                </h3>
                <span className="px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                  Grace Period Overdue
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Terdapat dana tertahan sebesar <strong className="text-white font-mono">{formatIDR(graceSummary.overdueTotalAmount)}</strong> yang telah disubmit &gt;30 hari lalu dan belum diverifikasi. Segera tindak lanjuti agar status KTA anggota tetap valid.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentTab('validation')}
            className="shrink-0 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-rose-950/50 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Buka Validasi Kas Masuk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 👑 KETUA PAGUYUBAN PENDING APPROVAL BANNER */}
      {isKetuaPaguyuban && pendingPaguyubanApprovalCount > 0 && (
        <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-purple-900 rounded-2xl p-5 sm:p-6 text-white border-2 border-purple-500/80 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/40 shrink-0 mt-0.5 animate-pulse">
              <Crown className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Persetujuan Ketua Paguyuban: {pendingPaguyubanApprovalCount} Anggota Menunggu Pengesahan KTA
                </h3>
                <span className="px-2.5 py-0.5 bg-purple-600 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                  Persetujuan Ketua
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Terdapat <strong className="text-white">{pendingPaguyubanApprovalCount} berkas warga</strong> yang telah lolos verifikasi RT dan pembayaran iurannya telah divalidasi Bendahara, menunggu persetujuan dan pengesahan resmi Ketua Paguyuban untuk penerbitan KTA Digital.
              </p>
            </div>
          </div>

          <button
            onClick={() => setCurrentTab('paguyuban-approval')}
            className="shrink-0 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-purple-950/50 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Buka Persetujuan Ketua</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 🏢 KETUA RW SUPERVISORY BANNER */}
      {isKetuaRW && (
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl p-5 sm:p-6 text-white border-2 border-indigo-500/80 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/40 shrink-0 mt-0.5">
              <Building2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Supervisi Wilayah RW 05: Monitoring Kas Paguyuban & Rekap Seluruh RT
                </h3>
                <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                  Ketua RW 05
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Memantau rekapitulasi iuran seluruh cluster RT, saldo kas terhimpun <strong className="text-emerald-400 font-mono">{formatIDR(financials.totalBalance)}</strong>, serta pengawasan realisasi santunan duka cita warga lingkungan RW.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentTab('history')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-indigo-950/50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Laporan Kas RW</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('rt-verification')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Berkas RT ({pendingRtMembersCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* 🕌 KETUA DKM COORDINATION BANNER */}
      {isKetuaDKM && (
        <div className="bg-gradient-to-br from-teal-950 via-slate-900 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white border-2 border-teal-500/80 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/40 shrink-0 mt-0.5">
              <HeartHandshake className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Pusat Santunan Duka & Koordinasi Fardhu Kifayah DKM
                </h3>
                <span className="px-2.5 py-0.5 bg-teal-600 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                  Ketua DKM
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Pengawasan fardhu kifayah dan penyaluran santunan duka cita untuk keluarga jamaah. Total <strong className="text-white">{claims.length} peristiwa duka</strong> telah tersalurkan secara amanah dengan dana kas terhimpun <strong className="text-emerald-400 font-mono">{formatIDR(financials.totalBalance)}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentTab('realization')}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-teal-950/50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Buka Santunan Duka</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('registration')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Direktori Jamaah</span>
            </button>
          </div>
        </div>
      )}

      {/* FISCAL HEALTH MINI-CARDS (DYNAMIC CASHFLOW SUMMARY) */}
      <div id="section-kesehatan-fiskal-overview" className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-700/80 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Kesehatan Fiskal Periode Berjalan</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono rounded-full">
                  Ringkasan Kas
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Perbandingan instan total penerimaan iuran masuk terverifikasi vs realisasi penyaluran santunan duka.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Arus Kas Operasional:</span>
            <span className={`px-2.5 py-1 rounded-full font-bold text-xs inline-flex items-center gap-1 ${
              isNetPositive 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isNetPositive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{isNetPositive ? 'Surplus / Kas Positif' : 'Defisit Terkendali'}</span>
            </span>
          </div>
        </div>

        {/* 3 Mini-Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Total Collected */}
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 hover:border-emerald-500/50 transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Penerimaan Iuran Terverifikasi</span>
              </span>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/30">
                Terkumpul
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                {formatIDR(totalCollectedFiscal)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-700/50">
                <span>{countCollectedFiscal} Transaksi Terverifikasi</span>
                <span className="font-semibold text-emerald-400">{collectionPercentage}% Kolektibilitas</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Paid Out */}
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 hover:border-rose-500/50 transition-all flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Penyaluran Santunan</span>
              </span>
              <span className="px-2 py-0.5 bg-rose-950 text-rose-300 text-[10px] font-bold rounded-md border border-rose-500/30">
                Klaim Duka
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                {formatIDR(totalPaidOutFiscal)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-700/50">
                <span>{countPaidOutFiscal} Realisasi Manfaat</span>
                <span className="font-semibold text-slate-400">
                  {totalPaidOutFiscal === 0 ? 'Nihil Klaim' : 'Terealisasi'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Net Cashflow / Fiscal Health Balance */}
          <div className={`rounded-xl p-4 border transition-all flex flex-col justify-between ${
            isNetPositive
              ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400'
              : 'bg-rose-950/40 border-rose-500/40 hover:border-rose-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className={`w-3.5 h-3.5 ${isNetPositive ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span>Surplus Bersih Operasional</span>
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                isNetPositive 
                  ? 'bg-emerald-900/80 text-emerald-300 border-emerald-500/40' 
                  : 'bg-rose-900/80 text-rose-300 border-rose-500/40'
              }`}>
                {isNetPositive ? '+ SURPLUS' : '- DEFISIT'}
              </span>
            </div>
            <div className="mt-3">
              <p className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                isNetPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isNetPositive ? `+ ${formatIDR(netCashflowFiscal)}` : formatIDR(netCashflowFiscal)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-700/50">
                <span>Status Cadangan:</span>
                <span className="font-bold text-white">
                  {isNetPositive ? 'Likuid & Siap Siaga' : 'Perlu Tambahan Iuran'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Saldo Kas (Main KPI) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Saldo Kas Dana</span>
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-3">
            {formatIDR(financials.totalBalance)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Saldo Aktif Gotong Royong</span>
          </div>
        </div>

        {/* Total Anggota Aktif */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Anggota Terdaftar</span>
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-3">
            {activeMembersCount} <span className="text-sm font-normal text-slate-500">Anggota</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">Iuran Rutin: {formatIDR(settings.monthlyFeeAmount)}/bln</p>
        </div>

        {/* Total Iuran Verified Masuk */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Iuran Terverifikasi</span>
            <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-3">
            {formatIDR(financials.totalIncomeVerified)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Pending: <strong className="text-amber-600">{formatIDR(financials.totalPendingIncome)}</strong></span>
            {pendingPayments.length > 0 && (
              <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                {pendingPayments.length} Verifikasi
              </span>
            )}
          </div>
        </div>

        {/* Total Realisasi Manfaat (Pengeluaran Duka) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Realisasi Manfaat</span>
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-3">
            {formatIDR(financials.totalBenefitSpent)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Santunan Terpenuhi: <strong className="text-slate-800">{claims.length} Klaim Duka</strong>
          </p>
        </div>
      </div>

      {/* ACTIVE MEMBERS PER CLUSTER GRID */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
        {/* Header & Leaderboard Highlight */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <span>Sebaran Anggota Aktif per Cluster</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                  {CLUSTERS.length} Cluster Wilayah
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring jumlah warga aktif terverifikasi dan cakupan jiwa tertanggung di masing-masing RT Cluster.
              </p>
            </div>
          </div>

          {/* Top Cluster Highlight Badge */}
          {topCluster && (
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-gradient-to-r from-amber-50 to-amber-100/80 border border-amber-200/90 text-amber-900 rounded-xl text-xs shadow-sm self-start md:self-auto">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
                <Crown className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Cluster Terbanyak:
                </span>
                <span className="font-extrabold text-amber-950">
                  {topCluster.cluster} ({topCluster.activeCount} Anggota • {topCluster.percentage}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cluster Distribution Visual Bar */}
        {activeMembersCount > 0 && (
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600">
              <span>Proporsi Anggota Aktif Antar Cluster:</span>
              <span className="font-mono font-bold text-slate-800">{activeMembersCount} Total Warga Terdaftar</span>
            </div>
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              {clusterStats.map((item, idx) => {
                const colors = [
                  'bg-teal-500',
                  'bg-amber-500',
                  'bg-blue-500',
                  'bg-cyan-500',
                  'bg-sky-500',
                  'bg-orange-500',
                ];
                const color = colors[idx % colors.length];
                if (item.percentage === 0) return null;
                return (
                  <div
                    key={item.cluster}
                    style={{ width: `${item.percentage}%` }}
                    className={`${color} h-full transition-all duration-500 relative group cursor-pointer`}
                    title={`${item.cluster}: ${item.activeCount} Anggota (${item.percentage}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10px] text-slate-500">
              {clusterStats.map((item, idx) => {
                const dotColors = [
                  'bg-teal-500',
                  'bg-amber-500',
                  'bg-blue-500',
                  'bg-cyan-500',
                  'bg-sky-500',
                  'bg-orange-500',
                ];
                return (
                  <div key={item.cluster} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                    <span className="font-medium text-slate-700">{item.cluster}:</span>
                    <span className="font-bold text-slate-900 font-mono">{item.activeCount} ({item.percentage}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6-Card Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {clusterStats.map((stat, idx) => {
            const isTop = stat.cluster === topCluster?.cluster && stat.activeCount > 0;
            const themeConfigs = [
              {
                border: isTop ? 'border-teal-400 ring-2 ring-teal-400/20' : 'border-teal-200/80',
                badgeBg: 'bg-teal-50 text-teal-900 border-teal-200',
                barColor: 'bg-teal-500',
                iconColor: 'text-teal-600',
              },
              {
                border: isTop ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-amber-200/80',
                badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
                barColor: 'bg-amber-500',
                iconColor: 'text-amber-600',
              },
              {
                border: isTop ? 'border-blue-400 ring-2 ring-blue-400/20' : 'border-blue-200/80',
                badgeBg: 'bg-blue-50 text-blue-900 border-blue-200',
                barColor: 'bg-blue-500',
                iconColor: 'text-blue-600',
              },
              {
                border: isTop ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-cyan-200/80',
                badgeBg: 'bg-cyan-50 text-cyan-900 border-cyan-200',
                barColor: 'bg-cyan-500',
                iconColor: 'text-cyan-600',
              },
              {
                border: isTop ? 'border-sky-400 ring-2 ring-sky-400/20' : 'border-sky-200/80',
                badgeBg: 'bg-sky-50 text-sky-900 border-sky-200',
                barColor: 'bg-sky-500',
                iconColor: 'text-sky-600',
              },
              {
                border: isTop ? 'border-orange-400 ring-2 ring-orange-400/20' : 'border-orange-200/80',
                badgeBg: 'bg-orange-50 text-orange-900 border-orange-200',
                barColor: 'bg-orange-500',
                iconColor: 'text-orange-600',
              },
            ];

            const theme = themeConfigs[idx % themeConfigs.length];

            return (
              <div
                key={stat.cluster}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 hover:shadow-md flex flex-col justify-between space-y-3 relative group ${theme.border}`}
              >
                {/* Top Badge & Cluster Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wider inline-flex items-center gap-1 ${theme.badgeBg}`}>
                      <Building2 className="w-3 h-3" />
                      <span>{stat.cluster}</span>
                    </span>

                    {isTop ? (
                      <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-md inline-flex items-center gap-1 shadow-sm animate-bounce">
                        <Crown className="w-3 h-3" />
                        <span>#1 Terbanyak</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Peringkat {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Main Metric: Active Members */}
                  <div className="pt-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                        {stat.activeCount}{' '}
                        <span className="text-xs font-bold text-slate-500">Warga Aktif</span>
                      </p>
                      <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {stat.percentage}%
                      </span>
                    </div>

                    {/* Progress Bar of cluster share */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        style={{ width: `${stat.percentage}%` }}
                        className={`h-full ${theme.barColor} transition-all duration-500`}
                      />
                    </div>
                  </div>
                </div>

                {/* Sub-Metrics details */}
                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Jiwa Tertanggung:</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {stat.totalSouls} Jiwa <span className="text-slate-400 font-normal">({stat.totalDependents} tanggungan)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Iuran Terkumpul:</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      {formatIDR(stat.totalCollected)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-500">Antrean RT:</span>
                    {stat.pendingCount > 0 ? (
                      isBendahara || isKetuaPaguyuban ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold text-[10px] rounded-md inline-flex items-center gap-1 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>{stat.pendingCount} Menunggu RT</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setCurrentTab('rt-verification')}
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] rounded-md inline-flex items-center gap-1 transition-colors"
                          title="Buka Menu Verifikasi RT"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>{stat.pendingCount} Butuh Verifikasi</span>
                        </button>
                      )
                    ) : (
                      <span className="text-emerald-600 font-medium text-[10px] inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Lengkap Terverifikasi</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Button */}
                <button
                  type="button"
                  onClick={() => setCurrentTab('registration')}
                  className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-[11px] rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 group/btn"
                >
                  <span>Lihat Warga {stat.cluster.replace('Cluster ', '')}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Payment Trend Graph Section (Recharts) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-5">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <span>Grafik Tren Pembayaran Iuran Bulanan</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualisasi konsistensi kolektibilitas iuran, tingkat kepatuhan anggota, dan realisasi penerimaan bulanan
              </p>
            </div>
          </div>

          {/* Actions & Toggle View Mode */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Period Selector */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTrendPeriod('2026')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendPeriod === '2026'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tahun 2026
              </button>
              <button
                type="button"
                onClick={() => setTrendPeriod('6months')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendPeriod === '6months'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                6 Bulan
              </button>
              <button
                type="button"
                onClick={() => setTrendPeriod('2025')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendPeriod === '2025'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2025
              </button>
            </div>

            <button
              onClick={() => {
                if (onOpenExportModal) {
                  onOpenExportModal();
                } else {
                  exportMonthlyFinancialStatementCSV(currentMonthData.month || 'Agustus 2026', settings, payments, claims, members, getBaseBalance());
                }
              }}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition-colors text-xs flex items-center gap-1.5 shadow-sm"
              title="Unduh Laporan Keuangan Bulanan CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor CSV</span>
            </button>

            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setTrendViewMode('amount')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  trendViewMode === 'amount'
                    ? 'bg-white text-emerald-800 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Nominal Iuran (Rp)</span>
              </button>
              <button
                onClick={() => setTrendViewMode('compliance')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  trendViewMode === 'compliance'
                    ? 'bg-white text-blue-800 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Tingkat Kepatuhan (%)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Metric Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Rata-Rata Kepatuhan</p>
              <p className="text-xl font-black font-mono text-emerald-700 mt-0.5">{avgCompliancePct}%</p>
            </div>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                {trendPeriod === '6months' ? 'Terkumpul 6 Bulan' : trendPeriod === '2025' ? 'Terkumpul Tahun 2025' : 'Terkumpul Periode Ini'}
              </p>
              <p className="text-xl font-black font-mono text-slate-900 mt-0.5">{formatIDR(totalTrendCollected)}</p>
            </div>
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Status {currentMonthData.month}</p>
              <p className="text-xl font-black font-mono text-slate-900 mt-0.5">
                {currentMonthData.anggotaLunas} <span className="text-xs font-normal text-slate-500">/ {currentMonthData.targetAnggota} Anggota</span>
              </p>
            </div>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Recharts Monthly Payment Trend Graph Area */}
        <div className="h-72 sm:h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {trendViewMode === 'amount' ? (
              <ComposedChart data={paymentTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortMonth" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTrendTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Area 
                  type="monotone" 
                  dataKey="verifikasi" 
                  name="Iuran Terverifikasi (Rp)" 
                  fill="#10b981" 
                  stroke="#059669" 
                  fillOpacity={0.2} 
                  strokeWidth={2.5}
                />
                <Bar 
                  dataKey="pending" 
                  name="Pending Validasi (Rp)" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                  barSize={20} 
                />
                <Line 
                  type="monotone" 
                  dataKey="targetIuran" 
                  name="Target Kolektibilitas (Rp)" 
                  stroke="#6366f1" 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={false} 
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={paymentTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="shortMonth" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis 
                  yAxisId="left" 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  domain={[0, Math.max(activeCount + 1, 6)]} 
                  allowDecimals={false}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  domain={[0, 100]} 
                  unit="%" 
                />
                <Tooltip content={<CustomTrendTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Bar 
                  yAxisId="left" 
                  dataKey="anggotaLunas" 
                  name="Anggota Lunas (Orang)" 
                  fill="#0d9488" 
                  radius={[6, 6, 0, 0]} 
                  barSize={24} 
                />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="kepatuhanPct" 
                  name="Tingkat Kepatuhan (%)" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }} 
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Collection Consistency Insights Footer */}
        <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-100 flex items-start gap-3 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold text-emerald-950">Analisis Konsistensi Pembayaran Admin: </span>
            Tingkat kepatuhan iuran rutin anggota berada pada rata-rata <strong className="text-emerald-800">{avgCompliancePct}%</strong>.
            {currentMonthData.pending > 0 ? (
              <span> Terdapat <strong className="text-amber-800">{currentMonthData.anggotaPending} transaksi pending</strong> pada bulan {currentMonthData.month} yang dapat segera divalidasi oleh admin.</span>
            ) : (
              <span> Seluruh anggota aktif terpantau tertib membayar iuran untuk periode {currentMonthData.month}.</span>
            )}
          </div>
        </div>
      </div>

      {/* Financial Chart & Pending Validation Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Grafik Arus Kas Dana Kematian</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Pemasukan Iuran Terverifikasi vs Realisasi Santunan Duka</p>
            </div>
            
            {/* Year Selector */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold self-start sm:self-auto">
              {availableCashFlowYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setCashFlowYear(yr)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    cashFlowYear === yr
                      ? 'bg-white text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tahun {yr}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Summary Mini-cards for Cash Flow Chart */}
          <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Pemasukan ({cashFlowYear}):</span>
              <span className="font-bold font-mono text-emerald-600 text-xs sm:text-sm">{formatIDR(totalCashFlowIncome)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Santunan ({cashFlowYear}):</span>
              <span className="font-bold font-mono text-rose-600 text-xs sm:text-sm">{formatIDR(totalCashFlowExpense)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Arus Bersih ({cashFlowYear}):</span>
              <span className={`font-bold font-mono text-xs sm:text-sm ${totalCashFlowNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {totalCashFlowNet >= 0 ? `+${formatIDR(totalCashFlowNet)}` : formatIDR(totalCashFlowNet)}
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => val === 0 ? '0' : `Rp ${(val / 1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomCashFlowTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="pemasukan" name="Pemasukan Iuran (Rp)" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pengeluaran" name="Realisasi Santunan (Rp)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Validation Quick Panel (1 col) */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {isBendahara ? 'Perlu Validasi Bendahara' : 'Perlu Validasi Pembayaran'}
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-mono font-bold rounded-full border border-amber-500/30">
                {pendingPayments.length} Antrean
              </span>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400 opacity-80" />
                <p className="text-sm font-medium">Semua pembayaran telah divalidasi!</p>
                <p className="text-xs text-slate-500">Tidak ada antrean bukti transfer baru.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingPayments.slice(0, 3).map((pay) => (
                  <div key={pay.id} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-100">{pay.memberName}</p>
                      <p className="text-slate-400 text-[11px]">{pay.paymentType} • {pay.periodMonth}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-emerald-400">{formatIDR(pay.amount)}</p>
                      <p className="text-[10px] text-amber-400 font-medium">Pending</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setCurrentTab('validation')}
            className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isBendahara ? 'Buka Validasi Pembayaran (Bendahara)' : 'Buka Panel Validasi Kas Masuk'}</span>
          </button>
        </div>
      </div>

      {/* Recent Activity Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments Table */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <span>Pembayaran Terbaru</span>
            </h3>
            <button
              onClick={() => setCurrentTab('history')}
              className="text-xs text-emerald-700 font-semibold hover:underline"
            >
              Lihat Semua →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Anggota</th>
                  <th className="py-2.5 px-3">Nominal</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Kwitansi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.slice(0, 5).map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{pay.memberName}</p>
                      <p className="text-[10px] text-slate-500">{pay.paymentType} ({pay.periodMonth})</p>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      {formatIDR(pay.amount)}
                    </td>
                    <td className="py-3 px-3">
                      {pay.status === 'Verified' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold text-[10px] rounded-full">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Lunas</span>
                        </span>
                      ) : pay.status === 'Pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold text-[10px] rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 font-semibold text-[10px] rounded-full">
                          Ditolak
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {pay.status === 'Verified' && (
                        <button
                          onClick={() => onViewReceipt(pay)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          Lihat Kwitansi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Death Benefit Realizations */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-rose-600" />
              <span>Realisasi Manfaat Duka</span>
            </h3>
            <button
              onClick={() => setCurrentTab('realization')}
              className="text-xs text-rose-600 font-semibold hover:underline"
            >
              Kelola Realisasi →
            </button>
          </div>

          {claims.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Belum ada data realisasi santunan duka.
            </div>
          ) : (
            <div className="space-y-3">
              {claims.slice(0, 4).map((claim) => (
                <div key={claim.id} className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{claim.deceasedName}</span>
                      <span className="px-2 py-0.5 text-[10px] bg-rose-200/80 text-rose-900 font-semibold rounded-md">
                        {claim.relationship}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Anggota: <strong>{claim.memberName}</strong> ({claim.memberNumber}) • Tgl: {claim.dateOfDeath}
                    </p>
                  </div>
                  <div className="text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-rose-200">
                    <p className="text-xs text-slate-500 font-medium">Realisasi Santunan</p>
                    <p className="text-sm font-black font-mono text-rose-700">{formatIDR(claim.totalAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail Anggota */}
      {selectedMemberModal && (
        <MemberDetailModal
          member={selectedMemberModal}
          payments={payments}
          claims={claims}
          settings={settings}
          onClose={() => setSelectedMemberModal(null)}
          onViewReceipt={onViewReceipt}
          onSelectMemberForPayment={onSelectMemberForPayment}
          onOpenFullKtaModal={(mem) => {
            setDigitalKtaMember(mem);
          }}
          onOpenPrintCardModal={(mem) => {
            setSelectedPrintCardMember(mem);
          }}
        />
      )}

      {/* Modal KTA Digital Resmi */}
      {digitalKtaMember && (
        <DigitalKtaModal
          member={digitalKtaMember}
          payments={payments}
          settings={settings}
          isOpen={!!digitalKtaMember}
          onClose={() => setDigitalKtaMember(null)}
          onOpenPrintCardModal={(mem) => {
            setSelectedPrintCardMember(mem);
          }}
        />
      )}

      {/* Modal Cetak Kartu Anggota Fisik */}
      {selectedPrintCardMember && (
        <PrintMemberCardModal
          member={selectedPrintCardMember}
          payments={payments}
          settings={settings}
          isOpen={!!selectedPrintCardMember}
          onClose={() => setSelectedPrintCardMember(null)}
        />
      )}

      {/* Modal Scanner / Verifikasi KTA */}
      <KtaScannerModal
        isOpen={isKtaScannerOpen}
        members={members}
        payments={payments}
        settings={settings}
        onClose={() => setIsKtaScannerOpen(false)}
        onOpenKtaModal={(mem) => {
          setDigitalKtaMember(mem);
        }}
        onSelectMember={(mem) => {
          setSelectedMemberModal(mem);
        }}
        onSelectMemberForPayment={onSelectMemberForPayment}
      />

      {/* Modal WhatsApp Early Outreach */}
      {outreachMember && (
        <EarlyOutreachModal
          isOpen={!!outreachMember}
          member={outreachMember}
          payments={payments}
          settings={settings}
          onClose={() => setOutreachMember(null)}
          onSelectMemberForPayment={onSelectMemberForPayment}
        />
      )}

      {/* MODAL DETAIL IURAN JATUH TEMPO 7 HARI (Manual view only) */}
      <ExpiringDueReminderModal
        isOpen={isDueReminderModalOpen}
        onClose={() => setIsDueReminderModalOpen(false)}
        summary={expiring7Summary}
        payments={payments}
        settings={settings}
        onSelectMemberForPayment={onSelectMemberForPayment}
      />
    </div>
  );
};
