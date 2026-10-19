import React, { useState, useEffect, useMemo } from 'react';
import { Member, ClusterType, CLUSTERS, AppUser, BenefitClaim } from '../types';
import {
  ShieldCheck,
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  Home,
  Phone,
  MapPin,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Info,
  Calendar,
  Sparkles,
  ExternalLink,
  Edit3,
  X,
  Crown,
  RotateCcw,
  Eye,
  Lock,
  ShieldAlert,
  Heart,
  Plus,
  Upload,
  Camera,
  Check,
  Building,
  Receipt,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { FamilyCardModal } from './FamilyCardModal';
import { RoleMobileAppMenu } from './RoleMobileAppMenu';
import { useRolePermissions } from '../lib/permissions';
import { formatIDR } from '../lib/storage';

interface RtClusterVerificationProps {
  members: Member[];
  activeUser?: AppUser | null;
  claims?: BenefitClaim[];
  onVerifyMember: (memberId: string, rtOfficerName: string, rtNotes?: string) => void;
  onRejectMember: (memberId: string, rejectionReason: string) => void;
  onUpdateMemberCluster?: (memberId: string, newCluster: ClusterType) => void;
  onViewMemberDetail?: (member: Member) => void;
  onAddClaim?: (newClaim: BenefitClaim) => void;
  onNavigateToRealization?: () => void;
}

export const RtClusterVerification: React.FC<RtClusterVerificationProps> = ({
  members,
  activeUser,
  claims = [],
  onVerifyMember,
  onRejectMember,
  onUpdateMemberCluster,
  onViewMemberDetail,
  onAddClaim,
  onNavigateToRealization,
}) => {
  // Granular permissions hook
  const { can } = useRolePermissions();
  const canVerifyRt = can(activeUser?.authority, 'verify_rt_members');

  // Initialize cluster according to logged-in user cluster
  const isRtRole =
    activeUser?.authority === 'Ketua RT (Cluster)' ||
    activeUser?.authority === 'Ketua RT' ||
    Boolean(activeUser?.authority?.includes('RT'));
  const isReadOnlyRole = !canVerifyRt;
  const userCluster = activeUser?.cluster;

  // For Ketua RT, strictly lock selectedCluster to their assigned cluster
  const [selectedCluster, setSelectedCluster] = useState<string>(() => {
    if (isRtRole && userCluster) return userCluster;
    return 'Semua';
  });

  const [statusFilter, setStatusFilter] = useState<'pending' | 'verified' | 'rejected' | 'all' | 'claims'>('pending');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Officer Name Simulation based on logged in user
  const [officerName, setOfficerName] = useState<string>(() => {
    if (activeUser) {
      return activeUser.cluster 
        ? `${activeUser.name} (${activeUser.cluster})` 
        : `${activeUser.name} (${activeUser.authority})`;
    }
    return 'Ketua RT';
  });

  // Sync state if activeUser switches
  useEffect(() => {
    if (activeUser) {
      if (activeUser.authority === 'Ketua RT (Cluster)' && activeUser.cluster) {
        setSelectedCluster(activeUser.cluster);
        setOfficerName(`${activeUser.name} (${activeUser.cluster})`);
      } else {
        setOfficerName(activeUser.cluster 
          ? `${activeUser.name} (${activeUser.cluster})` 
          : `${activeUser.name} (${activeUser.authority})`
        );
      }
    }
  }, [activeUser]);

  // Modal States
  const [verifyingMember, setVerifyingMember] = useState<Member | null>(null);
  const [rejectingMember, setRejectingMember] = useState<Member | null>(null);
  const [selectedKkViewerMember, setSelectedKkViewerMember] = useState<Member | null>(null);
  const [rtNotes, setRtNotes] = useState<string>('Data KTP dan domisili terverifikasi sah.');
  const [rejectionReason, setRejectionReason] = useState<string>('Data domisili/NIK tidak terdaftar di wilayah RT.');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // BASE SCOPE: Ketua RT can ONLY see data of their own cluster
  const baseMembers = useMemo(() => {
    if (isRtRole && userCluster) {
      return members.filter((m) => m.cluster === userCluster);
    }
    return members;
  }, [members, isRtRole, userCluster]);

  // RT Claim Modal States
  const [isRtClaimModalOpen, setIsRtClaimModalOpen] = useState(false);
  const [claimFilterByCluster, setClaimFilterByCluster] = useState(true);
  const claimCandidateMembers = claimFilterByCluster && baseMembers.length > 0 ? baseMembers : members;
  const [claimMemberId, setClaimMemberId] = useState(claimCandidateMembers[0]?.id || members[0]?.id || '');
  const [claimDeceasedName, setClaimDeceasedName] = useState('');
  const [claimRelationship, setClaimRelationship] = useState<'Anggota Utama' | 'Suami/Istri' | 'Anak' | 'Orang Tua' | 'Tanggungan Lain'>('Anggota Utama');
  const [claimDateOfDeath, setClaimDateOfDeath] = useState(new Date().toISOString().split('T')[0]);
  const [claimCauseOfDeath, setClaimCauseOfDeath] = useState('');
  const [claimDeathCertUrl, setClaimDeathCertUrl] = useState<string | null>(null);
  const [claimDeathCertName, setClaimDeathCertName] = useState('');
  const [claimNotes, setClaimNotes] = useState('Laporan warga berduka diajukan resmi oleh Ketua RT setempat.');
  const [zoomedDeathCert, setZoomedDeathCert] = useState<string | null>(null);

  // Synchronize candidate member
  useEffect(() => {
    if (claimCandidateMembers.length > 0 && !claimCandidateMembers.some((m) => m.id === claimMemberId)) {
      setClaimMemberId(claimCandidateMembers[0].id);
    }
  }, [claimCandidateMembers, claimMemberId]);

  const handleRtClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activeMember = members.find((m) => m.id === claimMemberId) || claimCandidateMembers[0] || members[0];
    if (!activeMember) {
      alert('Pilih data anggota terdaftar terlebih dahulu.');
      return;
    }
    if (!claimDeceasedName.trim()) {
      alert('Masukkan nama almarhum/almarhumah.');
      return;
    }

    const nextClaimNum = `KLAIM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newClaim: BenefitClaim = {
      id: 'claim-' + Date.now(),
      claimNumber: nextClaimNum,
      memberId: activeMember.id,
      memberName: activeMember.name,
      memberNumber: activeMember.memberNumber,
      cluster: activeMember.cluster || userCluster || 'Cluster RT',
      deceasedName: claimDeceasedName.trim(),
      relationship: claimRelationship,
      dateOfDeath: claimDateOfDeath,
      causeOfDeath: claimCauseOfDeath.trim() || 'Sakit / Usia Lanjut',
      deathCertificateUrl: claimDeathCertUrl || undefined,
      deathCertificateFileName: claimDeathCertName || undefined,
      status: 'Menunggu Pembayaran Bendahara',
      submittedByRtName: activeUser?.name || officerName || 'Ketua RT',
      submittedByRtCluster: activeUser?.cluster || userCluster || activeMember.cluster || 'Cluster RT',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      rtNotes: claimNotes.trim() || 'Laporan duka cita diajukan resmi oleh Ketua RT setempat.',
      expenseDetails: [],
      totalAmount: 0,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      processedBy: `${activeUser?.name || officerName || 'Ketua RT'} (Pengajuan Awal RT)`,
      notes: 'Klaim baru diajukan oleh RT. Menunggu Bendahara melakukan input rincian pembayaran ke pihak terkait.',
    };

    if (onAddClaim) {
      onAddClaim(newClaim);
    }

    setIsRtClaimModalOpen(false);
    setStatusFilter('claims');
    setClaimDeceasedName('');
    setClaimCauseOfDeath('');
    setClaimDeathCertUrl(null);
    setClaimDeathCertName('');
    setClaimNotes('Laporan warga berduka diajukan resmi oleh Ketua RT setempat.');
    setToastMessage(`Klaim santunan untuk "${newClaim.deceasedName}" (${newClaim.claimNumber}) berhasil disimpan! Berkas berstatus Menunggu Pembayaran Bendahara dan telah tercatat di sistem.`);
    setTimeout(() => setToastMessage(null), 7000);
  };

  const setSampleClaimData = () => {
    if (claimCandidateMembers.length > 0) {
      setClaimMemberId(claimCandidateMembers[0].id);
    }
    setClaimDeceasedName('Alm. Bpk. Rusli Hidayat');
    setClaimRelationship('Anggota Utama');
    setClaimCauseOfDeath('Sakit Usia Lanjut di Rumah Duka');
    setClaimDeathCertUrl('https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80');
    setClaimDeathCertName('surat_kematian_kelurahan_resmi.pdf');
    setClaimNotes('Laporan duka cita warga RT. Surat keterangan kematian resmi telah lengkap dan terverifikasi oleh Ketua RT.');
  };

  const relevantRtClaims = useMemo(() => {
    return claims.filter((c) => {
      if (isRtRole && userCluster) {
        return (
          c.cluster?.toLowerCase() === userCluster.toLowerCase() ||
          c.submittedByRtCluster?.toLowerCase() === userCluster.toLowerCase()
        );
      }
      if (selectedCluster !== 'Semua') {
        return (
          c.cluster?.toLowerCase() === selectedCluster.toLowerCase() ||
          c.submittedByRtCluster?.toLowerCase() === selectedCluster.toLowerCase()
        );
      }
      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.createdAt).getTime() || 0;
      const timeB = new Date(b.submittedAt || b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [claims, isRtRole, userCluster, selectedCluster]);

  const countWaitingTreasurer = relevantRtClaims.filter(
    (c) => c.status === 'Diajukan RT' || c.status === 'Menunggu Pembayaran Bendahara'
  ).length;
  const countWaitingKetua = relevantRtClaims.filter(
    (c) => c.status === 'Menunggu Persetujuan Ketua'
  ).length;
  const countApproved = relevantRtClaims.filter(
    (c) => !c.status || c.status === 'Disetujui'
  ).length;
  const countRejected = relevantRtClaims.filter(
    (c) => c.status === 'Ditolak'
  ).length;

  // Compute counts scoped to visible members
  const pendingMembers = baseMembers.filter(
    (m) => m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending'
  );
  const verifiedMembers = baseMembers.filter(
    (m) => m.status === 'Aktif' || m.status === 'Menunggu Pembayaran' || m.status === 'Menunggu Validasi Bendahara' || m.verificationStatus === 'Verified'
  );
  const rejectedMembers = baseMembers.filter(
    (m) => m.status === 'Ditolak' || m.verificationStatus === 'Rejected'
  );

  // Filter logic strictly within baseMembers
  const filteredList = baseMembers.filter((member) => {
    // Cluster filter (for non-Ketua RT supervisors)
    if (!isRtRole && selectedCluster !== 'Semua' && member.cluster !== selectedCluster) {
      return false;
    }

    // Status filter
    const isPending = member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending';
    const isVerified = (member.status === 'Aktif' || member.status === 'Menunggu Pembayaran' || member.status === 'Menunggu Validasi Bendahara' || member.verificationStatus === 'Verified') && member.status !== 'Meninggal';
    const isRejected = member.status === 'Ditolak' || member.verificationStatus === 'Rejected';

    if (statusFilter === 'pending' && !isPending) return false;
    if (statusFilter === 'verified' && !isVerified) return false;
    if (statusFilter === 'rejected' && !isRejected) return false;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = member.name.toLowerCase().includes(q);
      const matchNik = member.nik.includes(q);
      const matchPhone = member.phone.includes(q);
      const matchAddr = member.address.toLowerCase().includes(q);
      const matchNum = member.memberNumber.toLowerCase().includes(q);
      if (!matchName && !matchNik && !matchPhone && !matchAddr && !matchNum) {
        return false;
      }
    }

    return true;
  });

  const handleConfirmVerify = () => {
    if (!verifyingMember) return;
    
    // Granular authority guard
    if (!canVerifyRt) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki izin granular 'Verifikasi Berkas Warga Cluster RT'.`);
      setVerifyingMember(null);
      return;
    }

    // Strict authority guard: Ketua RT can only verify in their own cluster
    if (isRtRole && userCluster && verifyingMember.cluster !== userCluster) {
      alert(`Akses Ditolak: Anda adalah Ketua RT ${userCluster} dan tidak berwenang memverifikasi warga di ${verifyingMember.cluster}.`);
      setVerifyingMember(null);
      return;
    }

    onVerifyMember(verifyingMember.id, officerName, rtNotes);
    setToastMessage(`Sukses! Pendaftaran warga "${verifyingMember.name}" di ${verifyingMember.cluster || 'Cluster'} berhasil disetujui RT. Status saat ini "Menunggu Pembayaran". Calon anggota sekarang dapat melakukan konfirmasi pembayaran & upload bukti transfer.`);
    setVerifyingMember(null);
    setRtNotes('Data KTP dan domisili terverifikasi sah.');
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleConfirmReject = () => {
    if (!rejectingMember) return;

    // Granular authority guard
    if (!canVerifyRt) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki izin granular 'Verifikasi Berkas Warga Cluster RT'.`);
      setRejectingMember(null);
      return;
    }

    // Strict authority guard: Ketua RT can only reject in their own cluster
    if (isRtRole && userCluster && rejectingMember.cluster !== userCluster) {
      alert(`Akses Ditolak: Anda adalah Ketua RT ${userCluster} dan tidak berwenang menolak pendaftaran warga di ${rejectingMember.cluster}.`);
      setRejectingMember(null);
      return;
    }

    onRejectMember(rejectingMember.id, rejectionReason);
    setToastMessage(`Pendaftaran warga "${rejectingMember.name}" telah ditolak dengan alasan: "${rejectionReason}".`);
    setRejectingMember(null);
    setRejectionReason('Data domisili/NIK tidak terdaftar di wilayah RT.');
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleBatchVerifyCluster = () => {
    // Granular authority guard
    if (!canVerifyRt) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki izin granular untuk melakukan verifikasi massal RT.`);
      return;
    }

    const clusterPending = filteredList.filter(
      (m) => m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending'
    );
    if (clusterPending.length === 0) return;

    const clusterLabel = isRtRole && userCluster ? userCluster : selectedCluster;
    if (window.confirm(`Setujui sekaligus ${clusterPending.length} calon warga di ${clusterLabel}?`)) {
      clusterPending.forEach((m) => {
        // Enforce cluster match
        if (!isRtRole || m.cluster === userCluster) {
          onVerifyMember(m.id, officerName, `Verifikasi massal Ketua RT di ${m.cluster}`);
        }
      });
      setToastMessage(`Berhasil menyetujui ${clusterPending.length} pendaftaran warga di ${clusterLabel}!`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-32">

      {/* ========================================================================= */}
      {/* MOBILE APP STYLE OPERATIONAL MENU & DASHBOARD                             */}
      {/* ========================================================================= */}
      <RoleMobileAppMenu
        activeUser={activeUser}
        roleTitle={canVerifyRt ? "KETUA RT" : (activeUser?.authority ? activeUser.authority.toUpperCase() : "MONITORING RT")}
        userName={officerName || activeUser?.name || 'Ketua RT'}
        roleSubtitle={canVerifyRt ? `Ketua RT ${userCluster || selectedCluster || 'Cluster'} • Verifikasi Berkas KK` : `Mode Pemantauan Berkas RT • ${activeUser?.authority || 'Supervisi'}`}
        counterLabel="PERLU VERIFIKASI"
        counterValue={`${pendingMembers.length} Warga`}
        counterHighlight={pendingMembers.length > 0}
        sectionTitle={canVerifyRt ? "MENU CEPAT VERIFIKASI RT" : "MONITORING BERKAS RT"}
        sectionSubtitle={canVerifyRt ? "Kelola warga cluster & verifikasi berkas KK" : "Pantau data warga dan antrean berkas RT"}
        actions={[
          {
            id: 'antrean-rt',
            label: canVerifyRt ? 'Verifikasi Warga' : 'Antrean Berkas RT',
            subLabel: 'Menunggu Persetujuan',
            badge: pendingMembers.length > 0 ? pendingMembers.length : undefined,
            gradient: 'from-amber-500 to-orange-500',
            icon: ShieldCheck,
            onClick: () => {
              setStatusFilter('pending');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'warga-cluster',
            label: 'Data Warga RT',
            subLabel: 'Semua Warga Cluster',
            badge: filteredList.length,
            gradient: 'from-blue-600 to-indigo-500',
            icon: Users,
            onClick: () => {
              setStatusFilter('all');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'lolos-rt',
            label: 'Lolos Verifikasi',
            subLabel: 'Sudah Disetujui RT',
            badge: verifiedMembers.length,
            gradient: 'from-emerald-600 to-teal-500',
            icon: CheckCircle2,
            onClick: () => {
              setStatusFilter('verified');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'ditolak-rt',
            label: 'Ditolak / Koreksi',
            subLabel: 'Butuh Perbaikan',
            badge: rejectedMembers.length > 0 ? rejectedMembers.length : undefined,
            gradient: 'from-rose-600 to-pink-500',
            icon: XCircle,
            onClick: () => {
              setStatusFilter('rejected');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
        ]}
        pills={[
          {
            id: 'pill-antrean',
            label: 'Antrean Verifikasi',
            count: pendingMembers.length,
            isActive: statusFilter === 'pending',
            icon: Clock,
            onClick: () => setStatusFilter('pending'),
          },
          {
            id: 'pill-semua',
            label: 'Semua Warga',
            count: filteredList.length,
            isActive: statusFilter === 'all',
            icon: Users,
            onClick: () => setStatusFilter('all'),
          },
          {
            id: 'pill-lolos',
            label: 'Telah Lolos RT',
            count: verifiedMembers.length,
            isActive: statusFilter === 'verified',
            icon: CheckCircle,
            onClick: () => setStatusFilter('verified'),
          },
          {
            id: 'pill-klaim',
            label: 'Klaim Santunan Warga',
            count: relevantRtClaims.length,
            isActive: statusFilter === 'claims',
            icon: Heart,
            onClick: () => setStatusFilter('claims'),
          },
        ]}
        dockItems={[
          {
            id: 'dock-antrean',
            label: canVerifyRt ? 'Verifikasi' : 'Antrean',
            icon: ShieldCheck,
            badge: pendingMembers.length > 0 ? pendingMembers.length : undefined,
            isActive: statusFilter === 'pending',
            onClick: () => {
              setStatusFilter('pending');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-warga',
            label: 'Data RT',
            icon: Users,
            isActive: statusFilter === 'all',
            onClick: () => {
              setStatusFilter('all');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-klaim',
            label: 'Klaim Duka',
            icon: Heart,
            badge: relevantRtClaims.length > 0 ? relevantRtClaims.length : undefined,
            isActive: statusFilter === 'claims',
            onClick: () => {
              setStatusFilter('claims');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          ...(canVerifyRt
            ? [
                {
                  id: 'dock-massal',
                  label: 'Setujui Semua',
                  icon: CheckCircle2,
                  isCenterFloating: true,
                  onClick: handleBatchVerifyCluster,
                },
              ]
            : []),
          {
            id: 'dock-lolos',
            label: 'Lolos RT',
            icon: CheckCircle,
            isActive: statusFilter === 'verified',
            onClick: () => {
              setStatusFilter('verified');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
          {
            id: 'dock-ditolak',
            label: 'Ditolak',
            icon: XCircle,
            badge: rejectedMembers.length > 0 ? rejectedMembers.length : undefined,
            isActive: statusFilter === 'rejected',
            onClick: () => {
              setStatusFilter('rejected');
              const el = document.getElementById('rt-verification-tabs');
              el?.scrollIntoView({ behavior: 'smooth' });
            },
          },
        ]}
      />

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>Verifikasi Pendaftaran Warga oleh Ketua RT / Cluster</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Wajib disetujui oleh masing-masing Ketua RT/Cluster sebelum warga dapat melakukan pembayaran iuran kas.
              </p>
            </div>
          </div>
        </div>

        {/* RT Officer In-Charge Badge & Quick Switch */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsRtClaimModalOpen(true)}
            className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5" />
            <span>+ Input Klaim Santunan Warga (RT)</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs">
            <User className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verifikator RT Aktif</p>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none border-b border-dashed border-slate-300 focus:border-indigo-500"
                title="Nama Ketua RT / Petugas Verifikasi"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-sm animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* RT Login Personalized Cluster Banner */}
      {activeUser && (
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isRtRole && userCluster
            ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-amber-300 text-amber-950'
            : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-sm ${
              activeUser.avatarColor || (isRtRole ? 'bg-amber-600' : 'bg-indigo-600')
            }`}>
              {activeUser.name.charAt(0)}
            </div>
            <div>
              <p className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-2 flex-wrap">
                <span>Login: {activeUser.name}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                  isRtRole ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                }`}>
                  {activeUser.authority} {userCluster ? `• ${userCluster}` : ''}
                </span>
              </p>
              <p className="text-slate-600 mt-0.5">
                {isRtRole && userCluster ? (
                  <span>
                    Verifikasi warga disesuaikan otomatis dengan wilayah penugasan Anda di <strong>{userCluster}</strong>.
                  </span>
                ) : (
                  <span>
                    Anda memiliki wewenang supervisi penuh untuk memantau dan memverifikasi calon warga di semua RT Cluster.
                  </span>
                )}
              </p>
            </div>
          </div>

          {isRtRole && userCluster && selectedCluster !== userCluster && (
            <button
              type="button"
              onClick={() => setSelectedCluster(userCluster)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Kembali ke {userCluster}</span>
            </button>
          )}
        </div>
      )}

      {/* Cluster Filter Section */}
      {isRtRole && userCluster ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-4 sm:p-5 rounded-2xl text-white shadow-md border border-amber-500/30 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 shrink-0">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Lingkungan RT yang Dipimpin</span>
                  <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black rounded-md">Hak Akses Terkunci</span>
                </div>
                <h3 className="text-lg font-black text-white mt-0.5">{userCluster}</h3>
                <p className="text-xs text-slate-300">
                  Sesuai ketentuan, Ketua RT hanya dapat melihat data warga dan melakukan verifikasi di lingkungan <strong>{userCluster}</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400">Total Warga {userCluster}:</span>
              <span className="font-extrabold text-emerald-400">{baseMembers.length} Orang</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 p-3 sm:p-4 rounded-2xl text-white shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-4 h-4 text-emerald-400" />
              <span>Pilih Lingkungan Cluster / Wilayah RT:</span>
            </span>
            <div className="flex items-center gap-2">
              {selectedCluster !== 'Semua' && (
                <span className="text-emerald-400 text-xs font-semibold">
                  Menampilkan warga di <strong>{selectedCluster}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <button
              type="button"
              onClick={() => setSelectedCluster('Semua')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                selectedCluster === 'Semua'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <span>Semua Cluster</span>
              <span className="text-[10px] opacity-80 mt-0.5">({members.length} Warga)</span>
            </button>

            {CLUSTERS.map((clusterName) => {
              const countPendingInCluster = members.filter(
                (m) => m.cluster === clusterName && (m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending')
              ).length;

              return (
                <button
                  key={clusterName}
                  type="button"
                  onClick={() => setSelectedCluster(clusterName)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-center relative flex flex-col items-center justify-center ${
                    selectedCluster === clusterName
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black ring-2 ring-emerald-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{clusterName}</span>
                  </div>
                  {countPendingInCluster > 0 ? (
                    <span className="text-[10px] font-extrabold text-amber-300 mt-0.5 animate-pulse">
                      {countPendingInCluster} Menunggu RT
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-60 mt-0.5">Terverifikasi</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Supervisory read-only banner */}
      {isReadOnlyRole && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Mode Supervisi & Monitoring:</strong> Anda masuk sebagai <strong>{activeUser?.authority}</strong>. Anda dapat melihat berkas dan memantau status verifikasi RT dari seluruh pendaftar tanpa kewenangan mengubah atau memverifikasi berkas.
            </span>
          </div>
        </div>
      )}

      {/* Control Bar: Status Tabs, Search, & Batch Action */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Menunggu Verifikasi ({pendingMembers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'verified'
                  ? 'bg-emerald-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Sudah Disetujui RT ({verifiedMembers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600 text-white shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Ditolak ({rejectedMembers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({members.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('claims')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'claims'
                  ? 'bg-rose-600 text-white shadow-sm font-black'
                  : 'text-rose-700 hover:text-rose-900 bg-rose-50/70 hover:bg-rose-100/70'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Klaim Santunan Warga ({relevantRtClaims.length})</span>
            </button>
          </div>

          {/* Search Bar & Batch Verify Button */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, NIK, alamat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {statusFilter === 'pending' && filteredList.length > 0 && !isReadOnlyRole && (
              <button
                type="button"
                onClick={handleBatchVerifyCluster}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                title="Setujui semua warga yang pending di cluster ini"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Verifikasi Semua ({filteredList.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Applicant Cards List or Claims Section */}
      {statusFilter === 'claims' ? (
        /* CLAIMS SECTION FOR RT */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
          {/* Header banner */}
          <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-500/30 text-rose-200 border border-rose-400/40 rounded-full text-[10px] font-black uppercase">
                <Heart className="w-3 h-3 text-rose-300" />
                <span>Pengajuan Warga Berduka (Alur Pintu 1: RT)</span>
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>Daftar Klaim Santunan Kematian Warga</span>
                {userCluster && <span className="text-rose-300 text-sm font-bold">({userCluster})</span>}
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Ketua RT menginput klaim duka warga. Selanjutnya Bendahara menginput pembayaran pihak luar & bukti transfer, lalu disahkan Ketua Paguyuban untuk pemotongan kas paguyuban.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRtClaimModalOpen(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-950/40 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Klaim Santunan Warga</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-[11px] block">Total Pengajuan</span>
              <strong className="text-base text-slate-900 font-black">{relevantRtClaims.length} Kasus</strong>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-xs">
              <span className="text-amber-800 text-[11px] block">1. Menunggu Bendahara</span>
              <strong className="text-base text-amber-900 font-black">{countWaitingTreasurer} Kasus</strong>
            </div>
            <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 shadow-xs">
              <span className="text-sky-800 text-[11px] block">2. Menunggu Ketua</span>
              <strong className="text-base text-sky-900 font-black">{countWaitingKetua} Kasus</strong>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-emerald-800 text-[11px] block">3. Disetujui (Kas Sah)</span>
              <strong className="text-base text-emerald-900 font-black">{countApproved} Kasus</strong>
            </div>
          </div>

          {/* Claims List */}
          <div className="divide-y divide-slate-100">
            {relevantRtClaims.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                  <Heart className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Belum Ada Pengajuan Klaim Santunan Warga {userCluster ? `di ${userCluster}` : ''}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Ketua RT dapat mencatat peristiwa duka cita warga dan mengunggah surat kematian agar proses santunan kas duka cita segera diproses oleh Bendahara.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRtClaimModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Input Pengajuan Santunan Pertama</span>
                  </button>
                </div>
              </div>
            ) : (
              relevantRtClaims.map((claim) => {
                const isWaitingTreasurer =
                  claim.status === 'Diajukan RT' || claim.status === 'Menunggu Pembayaran Bendahara';
                const isWaitingKetua = claim.status === 'Menunggu Persetujuan Ketua';
                const isApproved = !claim.status || claim.status === 'Disetujui';
                const isRejected = claim.status === 'Ditolak';

                return (
                  <div key={claim.id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-4">
                    {/* Top Row: Claim Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg">
                          {claim.claimNumber}
                        </span>
                        <h4 className="text-base font-black text-slate-900">
                          {claim.deceasedName}
                        </h4>
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-900 font-black text-[10px] rounded-md uppercase">
                          {claim.relationship}
                        </span>
                      </div>

                      {/* Status pill */}
                      <div>
                        {isWaitingTreasurer && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs rounded-full inline-flex items-center gap-1.5 shadow-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>1. Menunggu Pembayaran Bendahara</span>
                          </span>
                        )}
                        {isWaitingKetua && (
                          <span className="px-3 py-1 bg-sky-100 text-sky-900 border border-sky-300 font-extrabold text-xs rounded-full inline-flex items-center gap-1.5 animate-pulse shadow-xs">
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            <span>2. Menunggu Persetujuan Ketua Paguyuban</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-xs rounded-full inline-flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>3. Disetujui (Kas Terpotong Sah)</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-3 py-1 bg-rose-100 text-rose-900 border border-rose-300 font-extrabold text-xs rounded-full inline-flex items-center gap-1.5 shadow-xs">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            <span>Ditolak / Butuh Revisi</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member & Death Meta info */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Kepala Keluarga / Anggota:</span>
                        <strong className="text-slate-800 font-bold">{claim.memberName}</strong>
                        <span className="text-slate-500 font-mono text-[11px] block">{claim.memberNumber} • {claim.cluster}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Wafat Pada:</span>
                        <span className="text-slate-800 font-semibold">{claim.dateOfDeath}</span>
                        <span className="text-slate-500 block text-[11px]">Sebab: {claim.causeOfDeath || 'Usia lanjut / sakit'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Berkas Surat Kematian:</span>
                        {claim.deathCertificateUrl ? (
                          <button
                            type="button"
                            onClick={() => setZoomedDeathCert(claim.deathCertificateUrl || null)}
                            className="mt-0.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 inline-flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Lihat Surat Kematian</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Tidak ada lampiran foto</span>
                        )}
                      </div>
                    </div>

                    {/* 3-Pintu Audit Trail */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Pintu 1: RT */}
                      <div className="p-3 rounded-xl border bg-white border-slate-200 space-y-1">
                        <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-[11px]">
                          <Building className="w-3.5 h-3.5" />
                          <span>Pintu 1: Pengajuan RT</span>
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium">
                          Diajukan oleh: <strong>{claim.submittedByRtName || 'Ketua RT'}</strong> ({claim.submittedByRtCluster || claim.cluster})
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {claim.submittedAt || claim.createdAt}
                        </p>
                        {claim.rtNotes && (
                          <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                            "{claim.rtNotes}"
                          </p>
                        )}
                      </div>

                      {/* Pintu 2: Bendahara */}
                      <div className={`p-3 rounded-xl border space-y-1 ${
                        isWaitingTreasurer
                          ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}>
                        <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-[11px]">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pintu 2: Pembayaran Bendahara</span>
                        </div>
                        {isWaitingTreasurer ? (
                          <p className="text-[11px] text-amber-800 leading-snug">
                            Menunggu Bendahara menginput pembayaran pihak terkait & bukti transfer.
                          </p>
                        ) : (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-slate-500">Total Nominal:</span>
                              <strong className="text-emerald-700 font-mono font-black">{formatIDR(claim.totalAmount)}</strong>
                            </div>
                            <p className="text-[11px] text-slate-700">
                              Oleh: <strong>{claim.treasurerName || 'Bendahara'}</strong>
                            </p>
                            <span className="text-[10px] text-slate-500 font-mono block">
                              {claim.treasurerProcessedAt}
                            </span>
                            {claim.expenseDetails && claim.expenseDetails.length > 0 && (
                              <span className="text-[10px] font-bold text-indigo-700 block">
                                Terlampir {claim.expenseDetails.length} rincian biaya & bukti bayar
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Pintu 3: Ketua Paguyuban */}
                      <div className={`p-3 rounded-xl border space-y-1 ${
                        isApproved
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : isRejected
                          ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                          : 'bg-slate-50/60 border-slate-200 text-slate-700'
                      }`}>
                        <div className="flex items-center gap-1.5 text-purple-700 font-extrabold text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Pintu 3: Persetujuan Ketua</span>
                        </div>
                        {isApproved ? (
                          <>
                            <p className="text-[11px] text-emerald-900 font-bold leading-snug">
                              Disahkan resmi oleh: {claim.approvedByKetuaName || 'Ketua Paguyuban'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {claim.approvedAt}
                            </p>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              <Check className="w-3 h-3" /> Saldo Kas Berkurang Sah
                            </span>
                          </>
                        ) : isRejected ? (
                          <>
                            <p className="text-[11px] text-rose-900 font-bold">
                              Ditolak oleh Ketua Paguyuban
                            </p>
                            <p className="text-[11px] text-rose-800 italic">
                              "{claim.rejectionReason}"
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-slate-600 leading-snug">
                            Menunggu persetujuan & pengesahan tanda tangan digital Ketua Paguyuban.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Applicant Cards List */
        filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Tidak ada calon anggota pada kategori ini
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === 'pending'
              ? 'Seluruh pendaftar warga di cluster ini telah selesai diverifikasi oleh Ketua RT.'
              : 'Tidak ditemukan data warga yang sesuai dengan kriteria filter atau pencarian.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((member) => {
            const isPending = member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending';
            const isVerified = (member.status === 'Aktif' || member.verificationStatus === 'Verified') && member.status !== 'Meninggal';
            const isRejected = member.status === 'Ditolak' || member.verificationStatus === 'Rejected';

            return (
              <div
                key={member.id}
                className={`bg-white rounded-2xl p-5 border transition-all space-y-4 shadow-sm relative ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-400/20 bg-gradient-to-b from-amber-50/20 to-white'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/10'
                    : 'border-slate-200/80 hover:border-emerald-300'
                }`}
              >
                {/* Card Header: Name, NIK, Status Badge */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {member.memberNumber}
                      </span>
                      {member.cluster && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold rounded-md flex items-center gap-1">
                          <Home className="w-2.5 h-2.5" />
                          <span>{member.cluster}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">
                      {member.name}
                    </h3>
                    <p className="font-mono text-xs text-slate-500">NIK: {member.nik}</p>
                  </div>

                  <div>
                    {isPending ? (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold rounded-full inline-flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3 text-amber-700" />
                        <span>Menunggu RT</span>
                      </span>
                    ) : isRejected ? (
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold rounded-full inline-flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>Ditolak RT</span>
                      </span>
                    ) : member.status === 'Menunggu Pembayaran' ? (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-extrabold rounded-full inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-amber-600" />
                        <span>Disetujui RT (Siap Bayar)</span>
                      </span>
                    ) : member.status === 'Menunggu Validasi Bendahara' ? (
                      <span className="px-2.5 py-1 bg-sky-100 text-sky-900 border border-sky-300 text-[11px] font-extrabold rounded-full inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-sky-600" />
                        <span>Menunggu Bendahara</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold rounded-full inline-flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Aktif & KTA Terbit</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="text-slate-400 font-medium flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>Alamat Domisili / Blok Rumah:</span>
                    </p>
                    <p className="font-bold text-slate-800">{member.address}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-slate-400 font-medium flex items-center gap-1 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>No. Telepon / WhatsApp:</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-slate-800">{member.phone || '-'}</p>
                      {member.phone && (
                        <a
                          href={`https://wa.me/${member.phone.replace(/^0/, '62').replace(/[^\d]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-0.5"
                          title="Hubungi via WhatsApp untuk verifikasi"
                        >
                          <span>WA</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-slate-400 font-medium flex items-center gap-1 text-[11px]">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>Tanggungan Keluarga:</span>
                    </p>
                    <p className="font-bold text-slate-800">
                      {member.dependentsCount} Jiwa
                      {member.dependentsList && member.dependentsList.length > 0 && (
                        <span className="text-slate-500 font-normal text-[11px] block">
                          ({member.dependentsList.map((d) => `${d.name} [${d.relationship}]`).join(', ')})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-slate-400 font-medium flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Tanggal Mendaftar:</span>
                    </p>
                    <p className="font-mono text-slate-700">{member.joinDate}</p>
                  </div>
                </div>

                {/* Lampiran Kartu Keluarga (KK) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-slate-500">Kartu Keluarga:</span>
                    {member.familyCardPhotoUrl ? (
                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] truncate">
                        {member.familyCardFileName || 'KK Terlampir'}
                        {member.familyCardNumber ? ` (${member.familyCardNumber})` : ''}
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[11px]">
                        Belum Ada Foto KK
                      </span>
                    )}
                  </div>

                  {member.familyCardPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedKkViewerMember(member)}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Periksa KK</span>
                    </button>
                  )}
                </div>

                {/* Additional Notes or Rejection Reason */}
                {member.notes && (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-200">
                    <span className="font-bold text-slate-700">Catatan Pendaftaran:</span> "{member.notes}"
                  </div>
                )}

                {member.verifiedByRt && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-[11px] text-emerald-900 border border-emerald-200 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Diverifikasi oleh:</span> {member.verifiedByRt}
                      {member.verifiedAt && <span className="font-mono text-[10px] text-emerald-700 block">Pada: {member.verifiedAt}</span>}
                      {member.rtNotes && <p className="italic mt-0.5 text-emerald-800">"{member.rtNotes}"</p>}
                    </div>
                  </div>
                )}

                {member.rejectionReason && (
                  <div className="p-2.5 bg-rose-50 rounded-xl text-[11px] text-rose-900 border border-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Alasan Penolakan RT:</span> {member.rejectionReason}
                    </div>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {onViewMemberDetail && (
                      <button
                        type="button"
                        onClick={() => onViewMemberDetail(member)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                      >
                        Detail Lengkap
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isReadOnlyRole ? (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-200/80 shadow-xs" title="Otoritas Terbatas: Akun Anda tidak memiliki hak verifikasi berkas RT">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Hanya Monitoring RT</span>
                      </span>
                    ) : isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectingMember(member)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Tolak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerifyingMember(member)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-900/20 transition-all inline-flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                          <span>Setujui (Verifikasi RT)</span>
                        </button>
                      </>
                    ) : isRejected ? (
                      <button
                        type="button"
                        onClick={() => setVerifyingMember(member)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-colors"
                      >
                        Tinjau Ulang / Setujui
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dapat Bayar Iuran</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* APPROVAL MODAL */}
      {verifyingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Verifikasi & Setujui Warga</h3>
                  <p className="text-xs text-slate-500">Persetujuan pendaftaran oleh Ketua RT {verifyingMember.cluster}</p>
                </div>
              </div>
              <button
                onClick={() => setVerifyingMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Calon Warga:</span>
                <span className="font-extrabold text-slate-900">{verifyingMember.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIK KTP:</span>
                <span className="font-mono font-bold text-slate-900">{verifyingMember.nik}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cluster & Alamat:</span>
                <span className="font-semibold text-slate-800">{verifyingMember.cluster} - {verifyingMember.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Tanggungan:</span>
                <span className="font-bold text-slate-800">{verifyingMember.dependentsCount} Jiwa</span>
              </div>

              {/* Lampiran KK Preview in Modal */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Lampiran Kartu Keluarga:</span>
                  <span className="font-bold text-slate-900">
                    {verifyingMember.familyCardFileName || (verifyingMember.familyCardPhotoUrl ? 'KK Terlampir' : 'Tidak ada foto KK')}
                  </span>
                </div>
                {verifyingMember.familyCardPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedKkViewerMember(verifyingMember)}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors inline-flex items-center gap-1 shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Foto KK</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Verifikasi Ketua RT (Opsional):
              </label>
              <textarea
                rows={2}
                value={rtNotes}
                onChange={(e) => setRtNotes(e.target.value)}
                placeholder="Contoh: Sudah konfirmasi KK dan domisili sah di RT 03."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
              />
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-medium flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Setelah disetujui Ketua RT, status warga menjadi <strong>Menunggu Pembayaran</strong>. Warga kemudian dapat melakukan konfirmasi pembayaran & mengunggah bukti transfer untuk divalidasi Bendahara.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVerifyingMember(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-950/20 transition-all flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Konfirmasi Setujui Warga</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Tolak Pendaftaran Warga</h3>
                  <p className="text-xs text-slate-500">Pendaftaran {rejectingMember.name}</p>
                </div>
              </div>
              <button
                onClick={() => setRejectingMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Penolakan dari Ketua RT: <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Jelaskan alasan mengapa pendaftaran ditolak (misal: bukan warga RT setempat, salah alamat cluster, dsb)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingMember(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-950/20 transition-all flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Konfirmasi Tolak Pendaftaran</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAMILY CARD FULL VIEW MODAL */}
      {selectedKkViewerMember && selectedKkViewerMember.familyCardPhotoUrl && (
        <FamilyCardModal
          isOpen={!!selectedKkViewerMember}
          onClose={() => setSelectedKkViewerMember(null)}
          photoUrl={selectedKkViewerMember.familyCardPhotoUrl}
          memberName={selectedKkViewerMember.name}
          kkNumber={selectedKkViewerMember.familyCardNumber}
          cluster={selectedKkViewerMember.cluster}
          fileName={selectedKkViewerMember.familyCardFileName}
        />
      )}

      {/* RT INPUT BENEFIT CLAIM MODAL */}
      {isRtClaimModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 my-8">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-md uppercase mb-0.5">
                    <span>Tahap 1: Laporan Duka Cita oleh Ketua RT</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    Formulir Pengajuan Santunan Kematian Warga (RT)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Wilayah Pengajuan: <strong>{userCluster || 'Cluster RT'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRtClaimModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRtClaimSubmit} className="space-y-4">
              {/* Helper Bar */}
              <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-xs">
                <span className="text-indigo-900 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Isi otomatis dengan data simulasi kematian warga?</span>
                </span>
                <button
                  type="button"
                  onClick={setSampleClaimData}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Isi Contoh Cepat
                </button>
              </div>

              {/* Citizen Selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Anggota Terdaftar (Keluarga Duka) <span className="text-rose-500">*</span>
                  </label>
                  {userCluster && (
                    <button
                      type="button"
                      onClick={() => setClaimFilterByCluster(!claimFilterByCluster)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {claimFilterByCluster ? `Tampilkan Semua Cluster` : `Hanya ${userCluster}`}
                    </button>
                  )}
                </div>
                <select
                  required
                  value={claimMemberId}
                  onChange={(e) => setClaimMemberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {claimCandidateMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.memberNumber}) - {m.cluster}
                    </option>
                  ))}
                </select>
                {claimCandidateMembers.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Belum ada anggota di cluster ini.</p>
                )}
              </div>

              {/* Deceased Name & Relationship */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Almarhum / Almarhumah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bpk. H. Rusli Hidayat"
                    value={claimDeceasedName}
                    onChange={(e) => setClaimDeceasedName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hubungan dengan Anggota Terdaftar <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={claimRelationship}
                    onChange={(e) => setClaimRelationship(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Anggota Utama">Anggota Utama (Kepala Keluarga)</option>
                    <option value="Suami/Istri">Suami / Istri Sah</option>
                    <option value="Anak">Anak Kandung</option>
                    <option value="Orang Tua">Orang Tua Kandung</option>
                    <option value="Tanggungan Lain">Tanggungan Lain Sesuai KK</option>
                  </select>
                </div>
              </div>

              {/* Date of Death & Cause */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Wafat <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={claimDateOfDeath}
                    onChange={(e) => setClaimDateOfDeath(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Penyebab Kematian (Singkat)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sakit Medis di RS / Usia Lanjut"
                    value={claimCauseOfDeath}
                    onChange={(e) => setClaimCauseOfDeath(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Lampiran Surat Kematian */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Unggah Surat Keterangan Kematian Resmi RT / Kelurahan / RS
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih Berkas / Foto</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setClaimDeathCertName(file.name);
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setClaimDeathCertUrl(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setClaimDeathCertUrl('https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80');
                      setClaimDeathCertName('surat_kematian_kelurahan_resmi.pdf');
                    }}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Gunakan Contoh Berkas
                  </button>
                  {claimDeathCertName && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {claimDeathCertName}
                    </span>
                  )}
                </div>
              </div>

              {/* RT Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Pengantar Ketua RT:
                </label>
                <textarea
                  rows={2}
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="Catatan pengantar laporan warga berduka"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRtClaimModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-950/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Heart className="w-4 h-4" />
                  <span>Simpan & Ajukan Klaim Santunan (RT)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZOOMED DEATH CERT MODAL */}
      {zoomedDeathCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Lampiran Surat Keterangan Kematian</span>
              </h3>
              <button
                type="button"
                onClick={() => setZoomedDeathCert(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 rounded-2xl p-2">
              <img
                src={zoomedDeathCert}
                alt="Surat Kematian"
                className="max-w-full h-auto object-contain rounded-xl shadow-md"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setZoomedDeathCert(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
