import React, { useState, useEffect } from 'react';
import {
  Member,
  Payment,
  BenefitClaim,
  SystemSettings,
  AppUser,
  ClusterType,
  ClusterMaster,
  BenefitMaster,
  DEFAULT_BENEFITS,
  AppNotification,
} from './types';
import {
  getStoredMembers,
  saveMembers,
  getStoredPayments,
  savePayments,
  getStoredClaims,
  saveClaims,
  getStoredSettings,
  saveSettings,
  getStoredUsers,
  saveUsers,
  getStoredActiveUser,
  saveStoredActiveUser,
  clearStoredActiveUser,
  getStoredClusters,
  saveStoredClusters,
  getStoredBenefits,
  saveStoredBenefits,
  getStoredNotifications,
  saveStoredNotifications,
  formatIDR,
  calculateCurrentBalance,
  resetToDefaultData,
  clearTransactionsLocally,
  clearAllDemoDataLocally,
  clearAllClaimsLocally,
  syncClustersToRtUsers,
  createMemberUser,
} from './lib/storage';
import {
  seedInitialFirestoreData,
  subscribeToFirestore,
  syncMemberToCloud,
  syncMembersBatchToCloud,
  syncPaymentToCloud,
  syncClaimToCloud,
  syncSettingsToCloud,
  syncUserToCloud,
  syncUsersBatchToCloud,
  syncClusterToCloud,
  deleteClusterFromCloud,
  syncBenefitToCloud,
  deleteBenefitFromCloud,
  syncBenefitsBatchToCloud,
  clearTransactionsFromCloud,
  clearAllDemoDataFromCloud,
  clearAllClaimsFromCloud,
  cleanupDemoClaimsFromCloud,
  restoreDemoDataToCloud,
} from './lib/firebase';
import { checkDuplicateMember } from './lib/duplicateValidator';
import { initialUsers } from './data/initialData';

import { Navbar } from './components/Navbar';
import { PublicLandingPage } from './components/PublicLandingPage';
import { DashboardOverview } from './components/DashboardOverview';
import { MemberRegistration } from './components/MemberRegistration';
import { RtClusterVerification } from './components/RtClusterVerification';
import { PaguyubanApproval } from './components/PaguyubanApproval';
import { PaymentForm } from './components/PaymentForm';
import { AdminValidation } from './components/AdminValidation';
import { BenefitRealization } from './components/BenefitRealization';
import { PaymentHistory } from './components/PaymentHistory';
import { FundSettings } from './components/FundSettings';
import { UserManagement } from './components/UserManagement';
import { PersistentRoleFloatingDock } from './components/PersistentRoleFloatingDock';
import { ReceiptModal } from './components/ReceiptModal';
import { FinancialReportModal } from './components/FinancialReportModal';
import { UserLoginModal } from './components/UserLoginModal';
import { LogoutConfirmationModal } from './components/LogoutConfirmationModal';
import { MemberPortal } from './components/MemberPortal';
import { KtaAuthenticityVerificationModal } from './components/KtaAuthenticityVerificationModal';
import { ReceiptAuthenticityVerificationModal } from './components/ReceiptAuthenticityVerificationModal';
import { DigitalKtaModal } from './components/DigitalKtaModal';
import { MembershipCertificateModal } from './components/MembershipCertificateModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { AppIcon } from './components/AppIcon';
import { HeartHandshake, Loader2, Cloud, Database } from 'lucide-react';
import { useRolePermissions, getPermittedTabsForRole } from './lib/permissions';
import {
  dispatchWhatsAppNotification,
  buildPaymentValidatedActiveMessage,
  buildRtVerificationMessage,
  buildGeneralStatusChangeMessage,
} from './lib/whatsappService';

export default function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [claims, setClaims] = useState<BenefitClaim[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(getStoredSettings());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [clusters, setClusters] = useState<ClusterMaster[]>([]);
  const [benefits, setBenefits] = useState<BenefitMaster[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeUser, setActiveUser] = useState<AppUser | null>(null);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'connecting' | 'offline' | 'error'>('connecting');
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('Menghubungkan ke Cloud Firestore...');

  const [currentTab, setCurrentTab] = useState<string>('public');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<Member | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);
  const [verifiedKtaData, setVerifiedKtaData] = useState<{ npa: string; sig?: string } | null>(null);
  const [isKtaVerificationModalOpen, setIsKtaVerificationModalOpen] = useState<boolean>(false);
  const [verifiedReceiptNumber, setVerifiedReceiptNumber] = useState<string | null>(null);
  const [isReceiptVerificationModalOpen, setIsReceiptVerificationModalOpen] = useState<boolean>(false);
  const [selectedFullKtaMember, setSelectedFullKtaMember] = useState<Member | null>(null);
  const [selectedCertificateMember, setSelectedCertificateMember] = useState<Member | null>(null);
  const [isPublicRegisterOpen, setIsPublicRegisterOpen] = useState<boolean>(false);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleOpenPWA = () => setIsPWAInstallModalOpen(true);
    window.addEventListener('open-pwa-install', handleOpenPWA);
    return () => window.removeEventListener('open-pwa-install', handleOpenPWA);
  }, []);

  const handleOpenRegistrationFromDock = () => {
    if (currentTab !== 'public') {
      setCurrentTab('public');
    }
    setIsPublicRegisterOpen(true);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-public-registration'));
    }, 60);
  };

  // Load Initial Data from Storage & Subscribe to Firebase Firestore
  useEffect(() => {
    // 1. Initial fast load from local cache
    const initialM = getStoredMembers();
    const initialP = getStoredPayments();
    const initialC = getStoredClaims();
    const initialS = getStoredSettings();
    const initialU = getStoredUsers();
    const initialCl = getStoredClusters();
    const initialB = getStoredBenefits();
    const initialN = getStoredNotifications();
    const storedActive = getStoredActiveUser();

    setMembers(initialM);
    setPayments(initialP);
    setClaims(initialC);
    setSettings(initialS);
    setUsers(initialU);
    setClusters(initialCl);
    setBenefits(initialB);
    setNotifications(initialN);
    // Validate stored active user against Master Users list
    let validActiveUser: AppUser | null = null;
    if (storedActive) {
      const match = initialU.find(
        (u) =>
          (u.id && u.id === storedActive.id) ||
          (u.email && storedActive.email && u.email.toLowerCase() === storedActive.email.toLowerCase())
      );
      if (match) {
        validActiveUser = match;
      } else {
        console.warn('Stored active user not found in Master Users list, resetting to logged out guest state');
        clearStoredActiveUser();
      }
    }

    setActiveUser(validActiveUser);
    setIsAdmin(validActiveUser ? validActiveUser.authority !== 'Anggota' : false);
    if (!validActiveUser) {
      setCurrentTab('public');
    } else if (validActiveUser.authority === 'Anggota') {
      setCurrentTab('member-portal');
    } else {
      setCurrentTab('dashboard');
    }

    // 1b. Check if opened via QR Code scan verification link (?verify=kta&npa=... or ?verify=receipt&receiptNumber=...)
    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const verifyType = params.get('verify');
        const npaParam = params.get('npa');
        const sigParam = params.get('sig') || undefined;

        if (verifyType === 'kta' && npaParam) {
          setVerifiedKtaData({ npa: decodeURIComponent(npaParam), sig: sigParam });
          setIsKtaVerificationModalOpen(true);
        }

        const receiptParam = params.get('receiptNumber') || params.get('receipt') || params.get('no') || params.get('kwitansi');
        if ((verifyType === 'receipt' || params.has('receiptNumber')) && receiptParam) {
          setVerifiedReceiptNumber(decodeURIComponent(receiptParam));
          setIsReceiptVerificationModalOpen(true);
        }
      } catch (err) {
        console.warn('Error reading verification search params:', err);
      }
    }

    // 2. Initialize Firestore Cloud Data & Real-time Listeners
    let unsubscribeFirestore: (() => void) | undefined;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;

    const setupCloud = async () => {
      try {
        setLoadingMessage('Mengakses database Cloud Firestore...');
        await seedInitialFirestoreData();
        await cleanupDemoClaimsFromCloud().catch(() => {});
        unsubscribeFirestore = subscribeToFirestore({
          onMembersChange: (cloudMembers) => {
            if (cloudMembers) {
              setMembers(cloudMembers);
              saveMembers(cloudMembers);
            }
            setIsInitialLoading(false);
          },
          onPaymentsChange: (cloudPayments) => {
            if (cloudPayments) {
              setPayments(cloudPayments);
              savePayments(cloudPayments);
            }
            setIsInitialLoading(false);
          },
          onClaimsChange: (cloudClaims) => {
            if (cloudClaims && Array.isArray(cloudClaims)) {
              // Ensure legacy demo claims (claim-1, claim-2, claim-3) are stripped out
              const nonDemo = cloudClaims.filter((c) => c && c.id !== 'claim-1' && c.id !== 'claim-2' && c.id !== 'claim-3');
              setClaims(nonDemo);
              saveClaims(nonDemo);
            }
            setIsInitialLoading(false);
          },
          onSettingsChange: (cloudSettings) => {
            if (cloudSettings) {
              setSettings(cloudSettings);
              saveSettings(cloudSettings);
            }
            setIsInitialLoading(false);
          },
          onUsersChange: (cloudUsers) => {
            if (cloudUsers && cloudUsers.length > 0) {
              setClusters((currentClusters) => {
                const effectiveClusters = currentClusters.length > 0 ? currentClusters : getStoredClusters();
                const synced = syncClustersToRtUsers(effectiveClusters, cloudUsers);
                setUsers(synced);
                saveUsers(synced);

                // Strictly validate activeUser against live Master Users from cloud
                setActiveUser((currentActive) => {
                  if (!currentActive) return null;
                  const found = synced.find(
                    (u) =>
                      (u.id && u.id === currentActive.id) ||
                      (u.email && currentActive.email && u.email.toLowerCase() === currentActive.email.toLowerCase())
                  );
                  if (!found) {
                    console.warn('Current active user not found in cloud Master Users, logging out:', currentActive.name);
                    clearStoredActiveUser();
                    setIsAdmin(false);
                    setCurrentTab('public');
                    return null;
                  }
                  saveStoredActiveUser(found);
                  return found;
                });

                return currentClusters;
              });
            }
            setIsInitialLoading(false);
          },
          onClustersChange: (cloudClusters) => {
            if (cloudClusters && cloudClusters.length > 0) {
              setClusters(cloudClusters);
              saveStoredClusters(cloudClusters);
              setUsers((prevUsers) => {
                const synced = syncClustersToRtUsers(cloudClusters, prevUsers);
                saveUsers(synced);
                return synced;
              });
            }
            setIsInitialLoading(false);
          },
          onBenefitsChange: (cloudBenefits) => {
            if (cloudBenefits && cloudBenefits.length > 0) {
              const hasOld = cloudBenefits.some(
                (b) =>
                  b.id === 'bnf-2' ||
                  b.id === 'bnf-3' ||
                  b.code === 'BNF-PASANGAN' ||
                  b.code === 'BNF-ANAK' ||
                  b.targetRelationship === 'Suami/Istri' ||
                  b.targetRelationship === 'Anak' ||
                  b.categoryName?.toLowerCase().includes('pasangan') ||
                  b.categoryName?.toLowerCase().includes('istri') ||
                  b.categoryName?.toLowerCase().includes('suami') ||
                  b.categoryName?.toLowerCase().includes('anak')
              );
              if (hasOld) {
                deleteBenefitFromCloud('bnf-2').catch(() => {});
                deleteBenefitFromCloud('bnf-3').catch(() => {});
                cloudBenefits
                  .filter(
                    (b) =>
                      b.code === 'BNF-PASANGAN' ||
                      b.code === 'BNF-ANAK' ||
                      b.targetRelationship === 'Suami/Istri' ||
                      b.targetRelationship === 'Anak' ||
                      b.categoryName?.toLowerCase().includes('pasangan') ||
                      b.categoryName?.toLowerCase().includes('istri') ||
                      b.categoryName?.toLowerCase().includes('suami') ||
                      b.categoryName?.toLowerCase().includes('anak')
                  )
                  .forEach((b) => deleteBenefitFromCloud(b.id).catch(() => {}));
              }
              const cleaned = cloudBenefits.filter(
                (b) =>
                  b.id !== 'bnf-2' &&
                  b.id !== 'bnf-3' &&
                  b.code !== 'BNF-PASANGAN' &&
                  b.code !== 'BNF-ANAK' &&
                  b.targetRelationship !== 'Suami/Istri' &&
                  b.targetRelationship !== 'Anak' &&
                  !b.categoryName?.toLowerCase().includes('pasangan') &&
                  !b.categoryName?.toLowerCase().includes('istri') &&
                  !b.categoryName?.toLowerCase().includes('suami') &&
                  !b.categoryName?.toLowerCase().includes('anak')
              );
              setBenefits(cleaned.length > 0 ? cleaned : DEFAULT_BENEFITS);
              saveStoredBenefits(cleaned.length > 0 ? cleaned : DEFAULT_BENEFITS);
            }
            setIsInitialLoading(false);
          },
          onStatusChange: (status) => {
            setCloudStatus(status);
            if (status === 'connected') {
              setIsInitialLoading(false);
            } else if (status === 'connecting') {
              setLoadingMessage('Menyinkronkan data langsung dari Firebase...');
            } else if (status === 'offline' || status === 'error') {
              setTimeout(() => setIsInitialLoading(false), 600);
            }
          },
        });
      } catch (err) {
        console.warn('Firestore initialization fallback to local:', err);
        setCloudStatus('offline');
        setIsInitialLoading(false);
      }
    };

    // Safety timeout: ensure loading screen dismisses even if connection is very slow
    safetyTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2800);

    setupCloud();

    return () => {
      if (safetyTimer) {
        clearTimeout(safetyTimer);
      }
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  // Compute live financials and pending queues (strictly scoped if Ketua RT)
  const isKetuaRtUser = activeUser?.authority === 'Ketua RT (Cluster)';
  const userRtCluster = activeUser?.cluster;
  const isAdminRole = activeUser ? activeUser.authority === 'Admin' : isAdmin;

  const financials = calculateCurrentBalance(undefined, payments, claims);
  const pendingCount = payments.filter((p) => p.status === 'Pending').length;
  
  const pendingRtVerificationCount = members.filter((m) => {
    if (isKetuaRtUser && userRtCluster && m.cluster !== userRtCluster) {
      return false;
    }
    return m.status === 'Menunggu Verifikasi RT' || m.verificationStatus === 'Pending';
  }).length;

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

  const displayMemberCount = isKetuaRtUser && userRtCluster
    ? members.filter((m) => m.cluster === userRtCluster).length
    : members.length;

  // Active Cluster Names list
  const activeClusterNames = clusters.filter((c) => c.isActive).map((c) => c.name);

  // Granular Role Permissions
  const { permissions: rolePermissions, can, refreshPermissions } = useRolePermissions();

  // Pengaturan tab otomatis berdasarkan hak akses granular:
  useEffect(() => {
    if (activeUser) {
      const permittedTabs = getPermittedTabsForRole(activeUser.authority, rolePermissions);
      if (!permittedTabs.includes(currentTab)) {
        if (activeUser.authority === 'Anggota') {
          setCurrentTab('member-portal');
        } else if (activeUser.authority === 'Ketua Paguyuban') {
          setCurrentTab(permittedTabs.includes('paguyuban-approval') ? 'paguyuban-approval' : (permittedTabs[0] || 'dashboard'));
        } else {
          setCurrentTab(permittedTabs.includes('dashboard') ? 'dashboard' : (permittedTabs[0] || 'dashboard'));
        }
      }
    }
  }, [activeUser, currentTab, rolePermissions]);

  // --- HANDLER FUNCTIONS ---

  // SAVE / UPDATE CLUSTER MASTER
  const handleSaveCluster = (clusterData: ClusterMaster) => {
    let updated: ClusterMaster[];
    const exists = clusters.some((c) => c.id === clusterData.id);
    if (exists) {
      updated = clusters.map((c) => (c.id === clusterData.id ? clusterData : c));
    } else {
      updated = [...clusters, clusterData];
    }
    setClusters(updated);
    saveStoredClusters(updated);
    syncClusterToCloud(clusterData).catch((e) => console.warn('Cloud sync cluster error:', e));

    // Otomatis sinkronkan user Ketua RT dengan Master RT Cluster yang diperbarui
    const updatedUsers = syncClustersToRtUsers(updated, users);
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    const affectedRtUser = updatedUsers.find(
      (u) => u.authority === 'Ketua RT (Cluster)' && (u.cluster === clusterData.name || u.id === `usr-rt-${clusterData.id}`)
    );
    if (affectedRtUser) {
      syncUserToCloud(affectedRtUser).catch((e) => console.warn('Cloud sync RT user error:', e));
    }
  };

  // DELETE CLUSTER MASTER
  const handleDeleteCluster = (clusterId: string) => {
    const clusterToDelete = clusters.find((c) => c.id === clusterId);
    const updated = clusters.filter((c) => c.id !== clusterId);
    setClusters(updated);
    saveStoredClusters(updated);
    deleteClusterFromCloud(clusterId).catch((e) => console.warn('Cloud delete cluster error:', e));

    if (clusterToDelete) {
      const updatedUsers = users.map((u) => {
        if (u.authority === 'Ketua RT (Cluster)' && (u.cluster === clusterToDelete.name || u.id === `usr-rt-${clusterToDelete.id}`)) {
          return { ...u, status: 'Non-Aktif' as const, notes: `${u.notes || ''} (Wilayah dinonaktifkan)` };
        }
        return u;
      });
      setUsers(updatedUsers);
      saveUsers(updatedUsers);
    }
  };

  // EXPLICIT SYNC RT USERS WITH CLUSTERS
  const handleSyncRtUsersWithClusters = () => {
    const syncedUsers = syncClustersToRtUsers(clusters, users);
    setUsers(syncedUsers);
    saveUsers(syncedUsers);
    syncUsersBatchToCloud(syncedUsers).catch((e) => console.warn('Cloud batch sync RT users notice:', e));
  };

  // SAVE / UPDATE BENEFIT MASTER
  const handleSaveBenefit = (benefitData: BenefitMaster) => {
    let updated: BenefitMaster[];
    const exists = benefits.some((b) => b.id === benefitData.id);
    if (exists) {
      updated = benefits.map((b) => (b.id === benefitData.id ? benefitData : b));
    } else {
      updated = [...benefits, benefitData];
    }
    setBenefits(updated);
    saveStoredBenefits(updated);
    syncBenefitToCloud(benefitData).catch((e) => console.warn('Cloud sync benefit error:', e));
  };

  // DELETE BENEFIT MASTER
  const handleDeleteBenefit = (benefitId: string) => {
    const updated = benefits.filter((b) => b.id !== benefitId);
    setBenefits(updated);
    saveStoredBenefits(updated);
    deleteBenefitFromCloud(benefitId).catch((e) => console.warn('Cloud delete benefit error:', e));
  };

  // RESET BENEFITS TO DEFAULT
  const handleResetBenefits = () => {
    setBenefits(DEFAULT_BENEFITS);
    saveStoredBenefits(DEFAULT_BENEFITS);
    syncBenefitsBatchToCloud(DEFAULT_BENEFITS).catch((e) => console.warn('Cloud batch sync benefits error:', e));
  };

  // NOTIFICATION MANAGEMENT HELPERS
  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      read: false,
      ...notif,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    saveStoredNotifications([]);
  };

  // PENDAFTARAN MANDIRI WARGA DARI HALAMAN PUBLIK (Terbuka untuk umum tanpa perlu login admin)
  const handlePublicRegisterMember = (newMember: Member) => {
    // Validasi pencegahan data double NIK dan Nomor KK
    const dupCheck = checkDuplicateMember(members, newMember.nik, newMember.familyCardNumber);
    if (dupCheck.isDuplicate) {
      alert(`PENDAFTARAN DITOLAK (DATA DOUBLE TERDETEKSI):\n\n${dupCheck.message}`);
      return;
    }

    const updatedMembers = [newMember, ...members];
    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    syncMemberToCloud(newMember).catch((e) => console.warn('Cloud sync member error:', e));

    // Sinkronisasi otomatis akun login warga agar bisa langsung login ke portal anggota
    if (newMember.email && newMember.password) {
      const newUser = createMemberUser(newMember, newMember.email, newMember.password);
      setUsers((prevUsers) => {
        const existingIdx = prevUsers.findIndex(
          (u) =>
            u.id === newUser.id ||
            (u.email && u.email.toLowerCase() === newUser.email.toLowerCase()) ||
            (u.memberId && u.memberId === newMember.id)
        );
        let updatedUsersList: AppUser[];
        if (existingIdx !== -1) {
          updatedUsersList = [...prevUsers];
          updatedUsersList[existingIdx] = { ...prevUsers[existingIdx], ...newUser };
        } else {
          updatedUsersList = [newUser, ...prevUsers];
        }
        saveUsers(updatedUsersList);
        syncUserToCloud(newUser).catch((e) => console.warn('Cloud sync user error:', e));
        return updatedUsersList;
      });
    }

    addNotification({
      type: 'info',
      category: 'registration',
      title: 'Pendaftaran Warga Baru Masuk',
      message: `Pendaftaran warga baru ${newMember.name} (${newMember.cluster || 'Cluster'}) berhasil diajukan dan menunggu verifikasi berkas KK oleh Ketua RT.`,
      cluster: newMember.cluster,
      memberId: newMember.id,
      linkTab: 'rt-verification',
    });
  };

  // ADD SINGLE MEMBER (Oleh Pengurus / Admin di Dashboard Registrasi Anggota)
  const handleAddMember = (newMember: Member) => {
    // Jika pendaftaran mandiri (status 'Menunggu Verifikasi RT'), selalu izinkan tanpa memblokir
    const isSelfRegistration = newMember.status === 'Menunggu Verifikasi RT' || !activeUser || activeUser.authority === 'Anggota';
    if (!isSelfRegistration && !can(activeUser?.authority, 'register_members')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang pendaftaran anggota baru.`);
      return;
    }

    // Validasi pencegahan data double NIK dan Nomor KK
    const dupCheck = checkDuplicateMember(members, newMember.nik, newMember.familyCardNumber);
    if (dupCheck.isDuplicate) {
      alert(`PENDAFTARAN DITOLAK (DATA DOUBLE TERDETEKSI):\n\n${dupCheck.message}`);
      return;
    }

    const updatedMembers = [newMember, ...members];
    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    syncMemberToCloud(newMember).catch((e) => console.warn('Cloud sync member error:', e));

    addNotification({
      type: 'info',
      category: 'registration',
      title: 'Pendaftaran Warga Baru Masuk',
      message: `Pendaftaran warga baru ${newMember.name} (${newMember.cluster || 'Cluster'}) berhasil diajukan dan menunggu verifikasi berkas KK oleh Ketua RT.`,
      cluster: newMember.cluster,
      memberId: newMember.id,
      linkTab: 'rt-verification',
    });
  };

  // UPDATE EXISTING MEMBER BIODATA
  const handleUpdateMember = (updatedMember: Member) => {
    // Validasi pencegahan data double NIK dan Nomor KK pada anggota lain
    const dupCheck = checkDuplicateMember(members, updatedMember.nik, updatedMember.familyCardNumber, updatedMember.id);
    if (dupCheck.isDuplicate) {
      alert(`PEMBARUAN DITOLAK (DATA DOUBLE TERDETEKSI):\n\n${dupCheck.message}`);
      return;
    }

    const oldMember = members.find((m) => m.id === updatedMember.id);
    const statusChanged = oldMember && oldMember.status !== updatedMember.status;
    const updatedMembers = members.map((m) => (m.id === updatedMember.id ? updatedMember : m));
    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    syncMemberToCloud(updatedMember).catch((e) => console.warn('Cloud sync updated member error:', e));

    // Sinkronkan nama dan profil pengguna aktif jika anggota sedang login
    if (
      activeUser &&
      (activeUser.memberId === updatedMember.id ||
        (activeUser.email && updatedMember.email && activeUser.email.toLowerCase() === updatedMember.email.toLowerCase()))
    ) {
      const updatedUser: AppUser = {
        ...activeUser,
        name: updatedMember.name,
        email: updatedMember.email || activeUser.email,
        phone: updatedMember.phone || activeUser.phone,
      };
      setActiveUser(updatedUser);
      saveStoredActiveUser(updatedUser);
    }

    if (statusChanged && settings.autoNotifyOnMemberStatusChange !== false && updatedMember.phone) {
      const msg = buildGeneralStatusChangeMessage({
        member: updatedMember,
        newStatus: updatedMember.status,
        settings,
        notes: updatedMember.notes,
      });
      dispatchWhatsAppNotification({
        phone: updatedMember.phone,
        recipientName: updatedMember.name,
        memberNumber: updatedMember.memberNumber,
        message: msg,
        triggerType: 'status_changed',
        settings,
      }).catch((e) => console.warn('WA status changed notification error:', e));
    }
  };

  // BATCH IMPORT MEMBERS FROM CSV
  const handleImportBatchMembers = (importedMembers: Member[]) => {
    if (!can(activeUser?.authority, 'register_members')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang impor massal data warga.`);
      return;
    }

    // Filter baris data double NIK dan Nomor KK
    const validBatch: Member[] = [];
    const skippedDuplicates: string[] = [];

    for (const m of importedMembers) {
      const dupCheck = checkDuplicateMember([...members, ...validBatch], m.nik, m.familyCardNumber);
      if (dupCheck.isDuplicate) {
        skippedDuplicates.push(`${m.name} (NIK: ${m.nik || '-'})`);
      } else {
        validBatch.push(m);
      }
    }

    if (validBatch.length === 0) {
      alert(`Impor CSV Ditolak: Seluruh ${skippedDuplicates.length} data dalam berkas terdeteksi sebagai data double NIK / No. KK yang sudah terdaftar.`);
      return;
    }

    const updatedMembers = [...validBatch, ...members];
    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    syncMembersBatchToCloud(validBatch).catch((e) => console.warn('Cloud batch sync members error:', e));

    if (skippedDuplicates.length > 0) {
      alert(
        `Impor Berhasil Sebagian:\n• ${validBatch.length} anggota baru berhasil didaftarkan.\n• ${skippedDuplicates.length} data dilewati karena NIK / No. KK sudah terdaftar dalam sistem.`
      );
    }

    addNotification({
      type: 'success',
      category: 'registration',
      title: 'Impor Anggota Massal Berhasil',
      message: `Sebanyak ${validBatch.length} data anggota baru berhasil diimpor ke sistem paguyuban${skippedDuplicates.length > 0 ? ` (${skippedDuplicates.length} data double dilewati)` : ''}.`,
      linkTab: 'registration',
    });
  };

  // VERIFY MEMBER BY RT OFFICER (Approves registration -> Status: Menunggu Pembayaran, KTA not yet issued)
  const handleVerifyMember = (memberId: string, rtOfficerName: string, rtNotes?: string) => {
    // Granular authority check
    if (!can(activeUser?.authority, 'verify_rt_members')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang granular untuk memverifikasi pendaftaran RT warga.`);
      return;
    }

    // Strict authority guard: Ketua RT can only verify in their own cluster
    if (activeUser?.authority === 'Ketua RT (Cluster)' && activeUser.cluster) {
      const target = members.find((m) => m.id === memberId);
      if (target && target.cluster !== activeUser.cluster) {
        alert(`Akses ditolak: Ketua RT ${activeUser.cluster} tidak dapat memverifikasi warga di ${target.cluster}`);
        return;
      }
    }

    let verifiedMemberObj: Member | null = null;
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const updated: Member = {
          ...m,
          verificationStatus: 'Verified' as const,
          status: 'Menunggu Pembayaran' as const, // Status becomes Menunggu Pembayaran after RT verification
          verifiedByRt: rtOfficerName,
          verifiedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          rtVerifiedBy: rtOfficerName,
          rtVerifiedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          rtNotes: rtNotes || m.rtNotes,
          // KTA remains unissued until Bendahara verifies payment
          isKtaIssued: false,
        };
        verifiedMemberObj = updated;
        return updated;
      }
      return m;
    });

    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    if (verifiedMemberObj) {
      const mem = verifiedMemberObj as Member;
      syncMemberToCloud(mem).catch((e) => console.warn('Cloud sync verified member error:', e));

      // Alert in dashboard: Registration approved by RT!
      addNotification({
        type: 'success',
        category: 'registration',
        title: 'Pendaftaran Warga Disetujui RT',
        message: `Pendaftaran warga ${mem.name} (${mem.cluster || 'Cluster'}) telah disetujui oleh ${rtOfficerName}. Status: Menunggu Pembayaran. Warga sekarang dapat melakukan konfirmasi pembayaran iuran & upload bukti transfer.`,
        cluster: mem.cluster,
        memberId: mem.id,
        linkTab: 'registration',
      });

      // Auto-send WhatsApp notification to member on RT Approval
      if (settings.autoNotifyOnRtVerification !== false && mem.phone) {
        const msg = buildRtVerificationMessage({
          member: mem,
          isApproved: true,
          settings,
          rtName: rtOfficerName,
          clusterName: mem.cluster,
          notes: rtNotes,
          appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        });

        dispatchWhatsAppNotification({
          phone: mem.phone,
          recipientName: mem.name,
          memberNumber: mem.memberNumber,
          message: msg,
          triggerType: 'rt_approved',
          settings,
        }).catch((err) => console.warn('Auto WhatsApp RT approved notification error:', err));
      }
    }
  };

  // REJECT MEMBER BY RT OFFICER
  const handleRejectMember = (memberId: string, rejectionReason: string) => {
    // Granular authority check
    if (!can(activeUser?.authority, 'verify_rt_members')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang granular untuk menolak pendaftaran RT warga.`);
      return;
    }

    // Strict authority guard: Ketua RT can only reject in their own cluster
    if (activeUser?.authority === 'Ketua RT (Cluster)' && activeUser.cluster) {
      const target = members.find((m) => m.id === memberId);
      if (target && target.cluster !== activeUser.cluster) {
        alert(`Akses ditolak: Ketua RT ${activeUser.cluster} tidak dapat menolak warga di ${target.cluster}`);
        return;
      }
    }

    let rejectedMemberObj: Member | null = null;
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const updated: Member = {
          ...m,
          verificationStatus: 'Rejected' as const,
          status: 'Ditolak' as const,
          isKtaIssued: false,
          rejectionReason: rejectionReason,
          rtNotes: `Ditolak oleh Ketua RT: ${rejectionReason}`,
        };
        rejectedMemberObj = updated;
        return updated;
      }
      return m;
    });

    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    if (rejectedMemberObj) {
      const mem = rejectedMemberObj as Member;
      syncMemberToCloud(mem).catch((e) => console.warn('Cloud sync rejected member error:', e));

      // Alert in dashboard: Registration rejected
      addNotification({
        type: 'error',
        category: 'registration',
        title: 'Pendaftaran Warga Ditolak RT',
        message: `Pendaftaran warga ${mem.name} (${mem.cluster || 'Cluster'}) ditolak oleh Ketua RT. Alasan: ${rejectionReason}`,
        cluster: mem.cluster,
        memberId: mem.id,
        linkTab: 'rt-verification',
      });

      // Auto-send WhatsApp notification to member on RT Rejection
      if (settings.autoNotifyOnRtVerification !== false && mem.phone) {
        const msg = buildRtVerificationMessage({
          member: mem,
          isApproved: false,
          settings,
          rtName: activeUser?.name || 'Ketua RT',
          clusterName: mem.cluster,
          notes: rejectionReason,
          appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        });

        dispatchWhatsAppNotification({
          phone: mem.phone,
          recipientName: mem.name,
          memberNumber: mem.memberNumber,
          message: msg,
          triggerType: 'rt_rejected',
          settings,
        }).catch((err) => console.warn('Auto WhatsApp RT rejected notification error:', err));
      }
    }
  };

  // UPDATE MEMBER CLUSTER
  const handleUpdateMemberCluster = (memberId: string, newCluster: ClusterType) => {
    let updatedMemberObj: Member | null = null;
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const updated: Member = {
          ...m,
          cluster: newCluster,
        };
        updatedMemberObj = updated;
        return updated;
      }
      return m;
    });

    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    if (updatedMemberObj) {
      syncMemberToCloud(updatedMemberObj).catch((e) => console.warn('Cloud sync cluster member error:', e));
    }
  };

  // ADD PAYMENT
  const handleAddPayment = (newPayment: Payment) => {
    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);
    savePayments(updatedPayments);
    syncPaymentToCloud(newPayment).catch((e) => console.warn('Cloud sync payment error:', e));

    // If target member was in 'Menunggu Pembayaran', update status to 'Menunggu Validasi Bendahara'
    let updatedMemberObj: Member | null = null;
    const updatedMembers = members.map((m) => {
      if (m.id === newPayment.memberId || m.memberNumber === newPayment.memberNumber) {
        if (m.status === 'Menunggu Pembayaran') {
          const mUpdated: Member = {
            ...m,
            status: 'Menunggu Validasi Bendahara' as const,
          };
          updatedMemberObj = mUpdated;
          return mUpdated;
        }
      }
      return m;
    });
    if (updatedMemberObj) {
      setMembers(updatedMembers);
      saveMembers(updatedMembers);
      syncMemberToCloud(updatedMemberObj).catch((e) => console.warn('Cloud sync member status error:', e));
    }

    const targetMem = members.find((m) => m.id === newPayment.memberId || m.memberNumber === newPayment.memberNumber);
    addNotification({
      type: 'info',
      category: 'payment',
      title: 'Setoran Iuran Baru Diajukan',
      message: `Setoran iuran ${newPayment.paymentType} (${newPayment.periodMonth}) sebesar ${formatIDR(newPayment.amount)} untuk warga ${newPayment.memberName} (${newPayment.memberNumber}) telah diunggah dan menunggu validasi Bendahara.`,
      cluster: targetMem?.cluster,
      paymentId: newPayment.id,
      memberId: newPayment.memberId,
      linkTab: 'payments',
    });
  };

  // VERIFY PAYMENT BY BENDAHARA (OFFICIALLY ISSUES THE KTA & KWITANSI DIGITAL SIGNATURE)
  const handleVerifyPayment = (
    paymentId: string,
    adminNotes?: string,
    adminSignature?: string,
    adminSignerName?: string,
    adminSignerTitle?: string
  ) => {
    // Granular authority check
    if (!can(activeUser?.authority, 'approve_payments')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang validasi pembayaran kas (Wewenang Bendahara).`);
      return;
    }

    let verifiedPaymentObj: Payment | null = null;
    let targetMemberId: string | undefined;
    const timestampNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const verifierName = adminSignerName || activeUser?.name || settings.defaultAdminSignerName || settings.treasurerName || 'Bendahara Paguyuban';
    const sigUrl = adminSignature || settings.defaultAdminSignature;
    const sigTitle = adminSignerTitle || settings.defaultAdminSignerTitle || (activeUser?.authority === 'Bendahara' ? 'Bendahara Paguyuban' : 'Pengurus Paguyuban');

    const updatedPayments = payments.map((p) => {
      if (p.id === paymentId) {
        const updated: Payment = {
          ...p,
          status: 'Verified' as const,
          verifiedAt: timestampNow,
          verifiedBy: verifierName,
          adminNotes: adminNotes || p.adminNotes || 'Disetujui dan disahkan oleh Bendahara',
          adminSignature: sigUrl || p.adminSignature,
          adminSignerName: verifierName,
          adminSignerTitle: sigTitle,
          adminSignatureDate: sigUrl ? timestampNow : p.adminSignatureDate,
        };
        verifiedPaymentObj = updated;
        targetMemberId = p.memberId;
        return updated;
      }
      return p;
    });

    setPayments(updatedPayments);
    savePayments(updatedPayments);

    if (verifiedPaymentObj) {
      const pay = verifiedPaymentObj as Payment;
      syncPaymentToCloud(pay).catch((e) => console.warn('Cloud sync payment error:', e));

      const targetMem = members.find((m) => m.id === pay.memberId || m.memberNumber === pay.memberNumber);
      const isMemAlreadyApproved = targetMem?.isPaguyubanApproved === true;

      // Alert in dashboard: Payment verified
      addNotification({
        type: 'success',
        category: 'payment',
        title: isMemAlreadyApproved
          ? 'Pembayaran Divalidasi Bendahara & KTA Aktif'
          : 'Pembayaran Divalidasi Bendahara - Menunggu Persetujuan Ketua Paguyuban',
        message: `Pembayaran iuran ${pay.paymentType} (${pay.periodMonth}) sebesar ${formatIDR(pay.amount)} untuk warga ${pay.memberName} (${pay.memberNumber}) telah divalidasi oleh ${verifierName}.${
          isMemAlreadyApproved
            ? ' Status anggota resmi AKTIF dan saldo kas bertambah.'
            : ' Menunggu persetujuan akhir dari Ketua Paguyuban sebelum KTA resmi diterbitkan.'
        }`,
        cluster: targetMem?.cluster,
        paymentId: pay.id,
        memberId: pay.memberId,
        linkTab: isMemAlreadyApproved ? 'payments' : 'paguyuban-approval',
      });
    }

    // When payment is verified by Bendahara, advance status
    if (targetMemberId) {
      let updatedMemberObj: Member | null = null;
      const updatedMembers = members.map((m) => {
        if (m.id === targetMemberId || m.memberNumber === verifiedPaymentObj?.memberNumber) {
          const isAlreadyApproved = m.isPaguyubanApproved === true;
          const nextStatus = isAlreadyApproved ? ('Aktif' as const) : ('Menunggu Persetujuan Ketua Paguyuban' as const);
          const nextKtaIssued = isAlreadyApproved;

          const mUpdated: Member = {
            ...m,
            status: nextStatus,
            verificationStatus: 'Verified' as const,
            isKtaIssued: nextKtaIssued,
            ktaIssuedAt: nextKtaIssued ? (m.ktaIssuedAt || timestampNow) : undefined,
            ktaIssuedBy: nextKtaIssued ? (m.ktaIssuedBy || verifierName) : undefined,
          };
          updatedMemberObj = mUpdated;
          return mUpdated;
        }
        return m;
      });
      setMembers(updatedMembers);
      saveMembers(updatedMembers);
      if (updatedMemberObj) {
        const activeMem = updatedMemberObj as Member;
        syncMemberToCloud(activeMem).catch((e) => console.warn('Cloud sync member status error:', e));

        if (activeMem.isPaguyubanApproved) {
          // Auto-send WhatsApp notification to member's registered phone if already approved
          if (settings.autoNotifyOnPaymentValidated !== false && activeMem.phone) {
            const verifiedPay: Payment | undefined = verifiedPaymentObj || payments.find((p) => p.id === paymentId);
            if (verifiedPay) {
              const expiryDateStr = verifiedPay.periodMonth ? `${verifiedPay.periodMonth} (1 Tahun)` : undefined;
              const currentUrl = typeof window !== 'undefined' ? window.location.origin : undefined;

              const msg = buildPaymentValidatedActiveMessage({
                member: activeMem,
                payment: verifiedPay,
                settings,
                verifierName,
                expiryDateStr,
                appUrl: currentUrl,
              });

              dispatchWhatsAppNotification({
                phone: activeMem.phone,
                recipientName: activeMem.name,
                memberNumber: activeMem.memberNumber,
                message: msg,
                triggerType: 'status_active',
                settings,
              }).then((resLog) => {
                if (resLog.status === 'sent') {
                  addNotification({
                    type: 'success',
                    category: 'system',
                    title: 'WhatsApp Otomatis Terkirim',
                    message: `Notifikasi resmi status AKTIF & KTA terbit telah otomatis terkirim via WhatsApp Gateway ke nomor ${activeMem.phone} (${activeMem.name}).`,
                    cluster: activeMem.cluster,
                    memberId: activeMem.id,
                  });
                }
              }).catch((err) => console.warn('Auto WhatsApp status notification error:', err));
            }
          }
        } else {
          // Alert waiting for Ketua Paguyuban approval
          addNotification({
            type: 'info',
            category: 'registration',
            title: 'Menunggu Pengesahan Ketua Paguyuban',
            message: `Pembayaran iuran untuk ${activeMem.name} (${activeMem.memberNumber}) telah divalidasi Bendahara. Berkas kini berada di antrean Persetujuan Akhir Ketua Paguyuban untuk penerbitan KTA resmi.`,
            cluster: activeMem.cluster,
            memberId: activeMem.id,
            linkTab: 'paguyuban-approval',
          });
        }
      }
    }
  };

  // APPROVE MEMBER BY KETUA PAGUYUBAN (OFFICIALLY ISSUES KTA)
  const handleApproveByKetuaPaguyuban = (
    memberId: string,
    paguyubanNotes?: string,
    paguyubanSignature?: string
  ) => {
    // Granular authority check
    if (!can(activeUser?.authority, 'approve_paguyuban')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang pengesahan akhir Ketua Paguyuban.`);
      return;
    }

    // Validasi mutlak: Persetujuan Ketua Paguyuban HANYA bisa dilakukan bila sudah ada validasi pembayaran dari bendahara
    const targetMember = members.find((m) => m.id === memberId);
    const hasVerifiedPayment = targetMember && payments.some(
      (p) => (p.memberId === targetMember.id || p.memberNumber === targetMember.memberNumber) && p.status === 'Verified'
    );

    if (!hasVerifiedPayment) {
      alert('Persetujuan ketua paguyuban hanya bisa dilakukan apabila sudah ada validasi pembayaran dari bendahara!');
      return;
    }

    const timestampNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const approverName = activeUser?.name || 'Bpk. H. Ahmad Fauzi (Ketua Paguyuban)';

    let updatedMemberObj: Member | null = null;
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const updated: Member = {
          ...m,
          status: 'Aktif' as const,
          verificationStatus: 'Verified' as const,
          isPaguyubanApproved: true,
          approvedByPaguyuban: approverName,
          approvedByPaguyubanAt: timestampNow,
          paguyubanNotes: paguyubanNotes || 'Disetujui dan disahkan secara resmi oleh Ketua Paguyuban.',
          paguyubanSignature: paguyubanSignature || m.paguyubanSignature || settings.defaultAdminSignature,
          isKtaIssued: true,
          ktaIssuedAt: timestampNow,
          ktaIssuedBy: approverName,
        };
        updatedMemberObj = updated;
        return updated;
      }
      return m;
    });

    setMembers(updatedMembers);
    saveMembers(updatedMembers);

    if (updatedMemberObj) {
      const mem = updatedMemberObj as Member;
      syncMemberToCloud(mem).catch((e) => console.warn('Cloud sync approve member error:', e));

      addNotification({
        type: 'success',
        category: 'registration',
        title: 'KTA Resmi Terbit - Pengesahan Ketua Paguyuban',
        message: `Pendaftaran warga ${mem.name} (${mem.memberNumber}) telah disetujui akhir oleh ${approverName}. Status resmi AKTIF dan KTA Digital resmi telah diterbitkan.`,
        cluster: mem.cluster,
        memberId: mem.id,
        linkTab: 'registration',
      });

      // Auto-send WhatsApp notification to member on Paguyuban Approval
      if (settings.autoNotifyOnPaymentValidated !== false && mem.phone) {
        const verifiedPay = payments.find(
          (p) => (p.memberId === mem.id || p.memberNumber === mem.memberNumber) && p.status === 'Verified'
        );
        const expiryDateStr = verifiedPay?.periodMonth ? `${verifiedPay.periodMonth} (1 Tahun)` : undefined;
        const currentUrl = typeof window !== 'undefined' ? window.location.origin : undefined;

        const msg = buildPaymentValidatedActiveMessage({
          member: mem,
          payment: verifiedPay || {
            id: 'pay-temp',
            receiptNumber: 'KWT-RESMI',
            memberId: mem.id,
            memberName: mem.name,
            memberNumber: mem.memberNumber,
            paymentType: 'Iuran Tahunan',
            periodMonth: '2026',
            amount: settings.annualFeeAmount || 300000,
            paymentMethod: 'Transfer',
            status: 'Verified',
            createdAt: timestampNow,
          },
          settings,
          verifierName: approverName,
          expiryDateStr,
          appUrl: currentUrl,
        });

        dispatchWhatsAppNotification({
          phone: mem.phone,
          recipientName: mem.name,
          memberNumber: mem.memberNumber,
          message: msg,
          triggerType: 'status_active',
          settings,
        }).then((resLog) => {
          if (resLog.status === 'sent') {
            addNotification({
              type: 'success',
              category: 'system',
              title: 'WhatsApp KTA Terbit Terkirim',
              message: `Notifikasi resmi pengesahan Ketua Paguyuban & KTA Digital terbit telah terkirim via WhatsApp Gateway ke nomor ${mem.phone} (${mem.name}).`,
              cluster: mem.cluster,
              memberId: mem.id,
            });
          }
        }).catch((err) => console.warn('Auto WhatsApp approval notification error:', err));
      }
    }
  };

  // REJECT MEMBER BY KETUA PAGUYUBAN
  const handleRejectByKetuaPaguyuban = (memberId: string, rejectionReason: string) => {
    // Granular authority check
    if (!can(activeUser?.authority, 'approve_paguyuban')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang penolakan berkas Ketua Paguyuban.`);
      return;
    }

    let rejectedMemberObj: Member | null = null;
    const updatedMembers = members.map((m) => {
      if (m.id === memberId) {
        const updated: Member = {
          ...m,
          status: 'Ditolak' as const,
          isKtaIssued: false,
          isPaguyubanApproved: false,
          paguyubanRejectionReason: rejectionReason,
          paguyubanNotes: `Ditolak oleh Ketua Paguyuban: ${rejectionReason}`,
        };
        rejectedMemberObj = updated;
        return updated;
      }
      return m;
    });

    setMembers(updatedMembers);
    saveMembers(updatedMembers);
    if (rejectedMemberObj) {
      const mem = rejectedMemberObj as Member;
      syncMemberToCloud(mem).catch((e) => console.warn('Cloud sync rejected member error:', e));

      addNotification({
        type: 'error',
        category: 'registration',
        title: 'Pendaftaran Ditolak Ketua Paguyuban',
        message: `Pendaftaran warga ${mem.name} (${mem.memberNumber}) ditolak oleh Ketua Paguyuban. Alasan: ${rejectionReason}`,
        cluster: mem.cluster,
        memberId: mem.id,
        linkTab: 'paguyuban-approval',
      });
    }
  };

  // UPDATE PAYMENT (e.g. signature addition, metadata changes)
  const handleUpdatePayment = (updatedPayment: Payment) => {
    const updated = payments.map((p) => (p.id === updatedPayment.id ? updatedPayment : p));
    setPayments(updated);
    savePayments(updated);
    syncPaymentToCloud(updatedPayment).catch((e) => console.warn('Cloud sync updated payment error:', e));
    if (selectedReceiptPayment?.id === updatedPayment.id) {
      setSelectedReceiptPayment(updatedPayment);
    }
  };

  // SAVE DEFAULT SIGNATURE TO SYSTEM SETTINGS
  const handleSaveDefaultSignature = (signatureUrl: string, signerName: string, signerTitle: string) => {
    const updatedSettings: SystemSettings = {
      ...settings,
      defaultAdminSignature: signatureUrl,
      defaultAdminSignerName: signerName,
      defaultAdminSignerTitle: signerTitle,
    };
    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    syncSettingsToCloud(updatedSettings).catch((e) => console.warn('Cloud sync settings signature error:', e));
  };

  // REJECT PAYMENT
  const handleRejectPayment = (paymentId: string, notes?: string) => {
    // Granular authority check
    if (!can(activeUser?.authority, 'reject_payments')) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang penolakan pembayaran kas.`);
      return;
    }

    let rejectedPaymentObj: Payment | null = null;
    const updatedPayments = payments.map((p) => {
      if (p.id === paymentId) {
        const updated = {
          ...p,
          status: 'Rejected' as const,
          notes: notes || p.notes || 'Ditolak bendahara (bukti tidak valid)',
        };
        rejectedPaymentObj = updated;
        return updated;
      }
      return p;
    });

    setPayments(updatedPayments);
    savePayments(updatedPayments);
    if (rejectedPaymentObj) {
      const pay = rejectedPaymentObj as Payment;
      syncPaymentToCloud(pay).catch((e) => console.warn('Cloud sync rejected payment error:', e));

      // If target member was awaiting treasurer validation, revert status to Menunggu Pembayaran
      let updatedMemberObj: Member | null = null;
      const updatedMembers = members.map((m) => {
        if (m.id === pay.memberId || m.memberNumber === pay.memberNumber) {
          if (m.status === 'Menunggu Validasi Bendahara') {
            const mUpdated: Member = {
              ...m,
              status: 'Menunggu Pembayaran' as const,
            };
            updatedMemberObj = mUpdated;
            return mUpdated;
          }
        }
        return m;
      });
      if (updatedMemberObj) {
        setMembers(updatedMembers);
        saveMembers(updatedMembers);
        syncMemberToCloud(updatedMemberObj).catch((e) => console.warn('Cloud sync member status error:', e));
      }

      const targetMem = members.find((m) => m.id === pay.memberId || m.memberNumber === pay.memberNumber);
      // Alert in dashboard: Payment rejected
      addNotification({
        type: 'warning',
        category: 'payment',
        title: 'Pembayaran Iuran Ditolak',
        message: `Pembayaran iuran warga ${pay.memberName} (${pay.memberNumber}) ditolak oleh Bendahara. Alasan: ${notes || 'Bukti transfer tidak valid atau belum masuk rekening kas.'}`,
        cluster: targetMem?.cluster,
        paymentId: pay.id,
        memberId: pay.memberId,
        linkTab: 'payments',
      });
    }
  };

  // ADD BENEFIT CLAIM (SANTUNAN DUKA - DIAJUKAN RT / ADMIN)
  const handleAddClaim = (newClaim: BenefitClaim) => {
    // Sesuai aturan: Bendahara dan Ketua Paguyuban TIDAK BISA input klaim manfaat
    // Bendahara hanya merealisasikan manfaat yang diajukan oleh RT
    const auth = activeUser?.authority || '';
    if (auth === 'Bendahara' || auth === 'Ketua Paguyuban') {
      alert(`Akses Ditolak: ${auth} tidak memiliki wewenang menginput pengajuan klaim santunan duka baru. Pengajuan awal santunan duka wajib diajukan oleh Ketua RT setempat.`);
      return;
    }

    const isRt = auth === 'Ketua RT (Cluster)' || auth === 'Ketua RT' || auth.includes('RT');
    const isPermitted = isRt || auth === 'Admin' || !activeUser; // Fallback for guest/demo testing

    if (!isPermitted) {
      alert(`Akses Ditolak: Akun Anda (${activeUser?.authority || 'Pengguna'}) tidak memiliki wewenang pengajuan klaim santunan duka. Pengajuan hanya dapat dilakukan oleh Ketua RT.`);
      return;
    }

    const claimWithStatus: BenefitClaim = {
      ...newClaim,
      status: newClaim.status || 'Menunggu Pembayaran Bendahara',
      submittedByRtName: newClaim.submittedByRtName || activeUser?.name || 'Ketua RT',
      submittedByRtCluster: newClaim.submittedByRtCluster || activeUser?.cluster || newClaim.cluster || 'Cluster RT',
      submittedAt: newClaim.submittedAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    setClaims((prevClaims) => {
      const filtered = prevClaims.filter((c) => c.id !== claimWithStatus.id);
      const updatedClaims = [claimWithStatus, ...filtered];
      saveClaims(updatedClaims);
      return updatedClaims;
    });

    syncClaimToCloud(claimWithStatus).catch((e) => console.warn('Cloud sync claim error:', e));

    addNotification({
      type: 'warning',
      category: 'claim',
      title: 'Pengajuan Santunan Duka Masuk (RT)',
      message: `Klaim santunan duka cita untuk almarhum/ah ${claimWithStatus.deceasedName} (Keluarga ${claimWithStatus.memberName}) telah diajukan oleh RT. Menunggu input rincian pembayaran ke pihak terkait oleh Bendahara.`,
      memberId: claimWithStatus.memberId,
      linkTab: 'realization',
    });
  };

  // UPDATE CLAIM (BENDAHARA INPUT PEMBAYARAN KE PIHAK TERKAIT + BUKTI TRANSFER & KWITANSI LUAR)
  const handleUpdateClaim = (updatedClaim: BenefitClaim) => {
    setClaims((prevClaims) => {
      const updatedClaims = prevClaims.map((c) => (c.id === updatedClaim.id ? updatedClaim : c));
      saveClaims(updatedClaims);
      return updatedClaims;
    });

    syncClaimToCloud(updatedClaim).catch((e) => console.warn('Cloud sync claim update error:', e));

    if (updatedClaim.status === 'Menunggu Persetujuan Ketua') {
      addNotification({
        type: 'info',
        category: 'claim',
        title: 'Rincian Pembayaran Klaim Diinput Bendahara',
        message: `Bendahara telah menginput pembayaran santunan sebesar ${formatIDR(updatedClaim.totalAmount)} & melampirkan bukti transfer serta kwitansi luar (${updatedClaim.claimNumber}). Menunggu persetujuan Ketua Paguyuban.`,
        memberId: updatedClaim.memberId,
        linkTab: 'paguyuban-approval',
      });
    }
  };

  // APPROVE BENEFIT CLAIM (KETUA PAGUYUBAN - RESMI MEMOTONG SALDO KAS)
  const handleApproveClaim = (claimId: string, notes?: string, signature?: string) => {
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;

    const approvedClaim: BenefitClaim = {
      ...claim,
      status: 'Disetujui',
      approvedByKetuaName: activeUser?.name || 'Ketua Paguyuban',
      approvedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      approvalNotes: notes || claim.approvalNotes || 'Penyaluran santunan duka cita disetujui resmi oleh Ketua Paguyuban.',
      ketuaSignature: signature || settings.defaultAdminSignature,
    };

    const updatedClaims = claims.map((c) => (c.id === claimId ? approvedClaim : c));
    setClaims(updatedClaims);
    saveClaims(updatedClaims);
    syncClaimToCloud(approvedClaim).catch((e) => console.warn('Cloud sync approved claim error:', e));

    // If main member deceased, update member status to 'Meninggal'
    if (approvedClaim.relationship === 'Anggota Utama') {
      let deceasedMember: Member | null = null;
      const updatedMembers = members.map((m) => {
        if (m.id === approvedClaim.memberId) {
          const mUpdated = {
            ...m,
            status: 'Meninggal' as const,
            notes: `Meninggal dunia pada ${approvedClaim.dateOfDeath}. Realisasi manfaat ${approvedClaim.claimNumber} telah disahkan Ketua Paguyuban.`,
          };
          deceasedMember = mUpdated;
          return mUpdated;
        }
        return m;
      });
      setMembers(updatedMembers);
      saveMembers(updatedMembers);
      if (deceasedMember) {
        syncMemberToCloud(deceasedMember).catch((e) => console.warn('Cloud sync member error:', e));
      }
    }

    addNotification({
      type: 'info',
      category: 'claim',
      title: 'Klaim Santunan Disetujui & Kas Terpotong',
      message: `Santunan duka ${approvedClaim.claimNumber} (${approvedClaim.deceasedName}) sebesar ${formatIDR(approvedClaim.totalAmount)} telah disetujui resmi oleh Ketua Paguyuban. Saldo kas paguyuban berkurang otomatis.`,
      memberId: approvedClaim.memberId,
      linkTab: 'realization',
    });
  };

  // REJECT BENEFIT CLAIM (KETUA PAGUYUBAN)
  const handleRejectClaim = (claimId: string, reason: string) => {
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;

    const rejectedClaim: BenefitClaim = {
      ...claim,
      status: 'Ditolak',
      rejectedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      rejectionReason: reason || 'Klaim ditolak / perlu revisi dokumen.',
    };

    const updatedClaims = claims.map((c) => (c.id === claimId ? rejectedClaim : c));
    setClaims(updatedClaims);
    saveClaims(updatedClaims);
    syncClaimToCloud(rejectedClaim).catch((e) => console.warn('Cloud sync rejected claim error:', e));

    addNotification({
      type: 'warning',
      category: 'claim',
      title: 'Klaim Santunan Ditolak / Perlu Revisi',
      message: `Pengajuan santunan ${rejectedClaim.claimNumber} (${rejectedClaim.deceasedName}) ditolak oleh Ketua Paguyuban: "${reason}".`,
      memberId: rejectedClaim.memberId,
      linkTab: 'realization',
    });
  };

  // SAVE SETTINGS
  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    syncSettingsToCloud(newSettings).catch((e) => console.warn('Cloud sync settings error:', e));
  };

  // HAPUS DATA TRANSAKSI DI DATABASE FIREBASE (Kosongkan riwayat pembayaran iuran & santunan tanpa menghapus data warga)
  const handleClearTransactions = async () => {
    try {
      clearTransactionsLocally();
      setPayments([]);
      setClaims([]);

      // Hapus data transaksi dari Cloud Firestore
      await clearTransactionsFromCloud();

      addNotification({
        type: 'info',
        category: 'payment',
        title: 'Data Transaksi Telah Dikosongkan',
        message: 'Seluruh riwayat pembayaran iuran kas dan santunan berhasil dihapus dari Cloud Firestore. Data anggota warga tetap aman tersimpan.',
        linkTab: 'payments',
      });
    } catch (e) {
      console.error('Error clearing transaction data from Firebase:', e);
      throw e;
    }
  };

  // CLEAR ALL DEMO DATA (Empty database to start clean)
  const handleClearAllDemoData = async () => {
    try {
      clearAllDemoDataLocally();
      setMembers([]);
      setPayments([]);
      setClaims([]);
      setNotifications([]);
      const adminUsers = initialUsers.filter((u) => u.authority !== 'Anggota');
      setUsers(adminUsers);
      const defaultAdmin = adminUsers[0] || initialUsers[0];
      setActiveUser(defaultAdmin);
      setIsAdmin(true);

      // Clear from Firestore Cloud
      await clearAllDemoDataFromCloud();
    } catch (e) {
      console.error('Error clearing demo data:', e);
      throw e;
    }
  };

  // CLEAR ONLY REALIZATION CLAIMS (Kosongkan seluruh riwayat klaim santunan duka)
  const handleClearClaims = async () => {
    try {
      clearAllClaimsLocally();
      setClaims([]);
      await clearAllClaimsFromCloud();
    } catch (e) {
      console.error('Error clearing claims:', e);
      throw e;
    }
  };

  // RESET TO DEFAULT DEMO DATA
  const handleResetData = async () => {
    try {
      resetToDefaultData();
      const initialM = getStoredMembers();
      const initialP = getStoredPayments();
      const initialC = getStoredClaims();
      const initialS = getStoredSettings();
      const initialU = getStoredUsers();
      const initialCl = getStoredClusters();
      const initialN = getStoredNotifications();

      setMembers(initialM);
      setPayments(initialP);
      setClaims(initialC);
      setSettings(initialS);
      setUsers(initialU);
      setClusters(initialCl);
      setNotifications(initialN);
      setActiveUser(initialUsers[0]);
      setIsAdmin(true);

      // Sync demo restoration to Cloud Firestore
      await restoreDemoDataToCloud();
    } catch (e) {
      console.error('Error resetting demo data:', e);
      throw e;
    }
  };

  // USER MANAGEMENT HANDLERS
  const handleAddUser = (newUser: AppUser) => {
    const updatedUsers = [newUser, ...users];
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    syncUserToCloud(newUser).catch((e) => console.warn('Cloud sync user error:', e));
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    const updatedUsers = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    syncUserToCloud(updatedUser).catch((e) => console.warn('Cloud sync updated user error:', e));

    if (activeUser.id === updatedUser.id) {
      setActiveUser(updatedUser);
      saveStoredActiveUser(updatedUser);
      setIsAdmin(updatedUser.authority !== 'Anggota');
      if (updatedUser.authority !== 'Anggota' && currentTab === 'public') {
        setCurrentTab('dashboard');
      }
    }
  };

  const handleDeleteUser = (userId: string) => {
    const updatedUsers = users.filter((u) => u.id !== userId);
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    // Cloud sync logic handles deletion
  };

  const handleSwitchActiveUser = (newUser: AppUser) => {
    setActiveUser(newUser);
    saveStoredActiveUser(newUser);
    setIsAdmin(newUser.authority !== 'Anggota');
    if (newUser.authority === 'Anggota') {
      setCurrentTab('member-portal');
    } else if (currentTab === 'public' || currentTab === 'member-portal') {
      setCurrentTab('dashboard');
    }
  };

  const handleUserLogin = (user: AppUser) => {
    setActiveUser(user);
    saveStoredActiveUser(user);
    setIsAdmin(user.authority !== 'Anggota');
    setIsLoginModalOpen(false);
    if (user.authority === 'Anggota') {
      setCurrentTab('member-portal');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const handleRequestLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    setActiveUser(null);
    clearStoredActiveUser();
    setIsAdmin(false);
    setCurrentTab('public');
    setIsLogoutModalOpen(false);
  };

  const handleSelectMemberForPayment = (member: Member) => {
    if (member.status === 'Menunggu Verifikasi RT' || member.verificationStatus === 'Pending') {
      alert(`Pendaftar baru belum dapat melakukan pembayaran!\n\nSesuai alur resmi paguyuban, pendaftar baru bisa melakukan pembayaran setelah verifikasi dari RT (${member.cluster || 'Cluster'}). Mohon tunggu verifikasi Ketua RT.`);
      return;
    }
    if (member.status === 'Ditolak' || member.verificationStatus === 'Rejected') {
      alert(`Warga "${member.name}" tidak dapat melakukan pembayaran karena berkas pendaftaran ditolak oleh Ketua RT.`);
      return;
    }
    setSelectedMemberForPayment(member);
    setCurrentTab('payment');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
      {/* INITIAL FIREBASE CLOUD DATABASE LOADING SCREEN */}
      {isInitialLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white p-6 transition-opacity duration-300">
          <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative gradient glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Animated Organization Logo Presentation */}
            <div className="relative mx-auto w-32 h-32 mb-5 flex items-center justify-center">
              {/* Outer Pulsing Aura Ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/30 via-teal-400/25 to-amber-400/20 blur-xl animate-pulse-glow pointer-events-none" />

              {/* Rotating Dashed Orbital Halo (Clockwise) */}
              <div className="absolute -inset-2 rounded-full border-2 border-dashed border-emerald-400/40 animate-spin-slow pointer-events-none" />

              {/* Counter-rotating Dotted Celestial Ring */}
              <div className="absolute -inset-4 rounded-full border border-dotted border-teal-400/30 animate-spin-reverse-slow pointer-events-none" />

              {/* Four Cardinal Glow Indicator Dots */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]" />
              <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_8px_#fbbf24]" />
              <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />

              {/* Center Floating Organization Logo Container */}
              <div className="relative w-24 h-24 rounded-3xl p-[2px] bg-gradient-to-br from-emerald-400 via-teal-500 to-amber-400 shadow-2xl shadow-emerald-950/80 animate-float-logo">
                <div className="w-full h-full bg-slate-950 rounded-[22px] backdrop-blur-md flex items-center justify-center p-2 overflow-hidden relative group">
                  {/* Subtle Inner Diagonal Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60 animate-shimmer pointer-events-none" />

                  {/* Organization Logo (image with fallback to AppIcon) */}
                  {settings?.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt={settings.communityName || 'Logo Organisasi'}
                      className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                      onError={(e) => {
                        // Fallback smoothly to AppIcon SVG if image fails
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallbackElem = document.getElementById('loading-app-icon-fallback');
                        if (fallbackElem) fallbackElem.style.display = 'flex';
                      }}
                    />
                  ) : null}

                  {/* SVG Organization Emblem Component (Shown if no logoUrl or on error) */}
                  <div
                    id="loading-app-icon-fallback"
                    className="w-full h-full items-center justify-center"
                    style={{ display: settings?.logoUrl ? 'none' : 'flex' }}
                  >
                    <AppIcon size={74} withBackground={false} className="filter drop-shadow-[0_4px_12px_rgba(16,185,129,0.35)]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-xl font-black text-white tracking-tight">
              {settings?.communityName || 'Paguyuban Dana Kematian Warga'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Sistem Informasi Kas & Keanggotaan Terpadu
            </p>

            {/* Loading status box */}
            <div className="mt-6 p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-bold tracking-wide">
                  {loadingMessage}
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-shimmer" />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">
                Mengakses data anggota, kas keuangan, dan klaim santunan langsung dari server Cloud Firestore.
              </p>
            </div>

            {/* Real-time sync badge */}
            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Cloud Firestore Real-time Sync Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Main Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        pendingCount={pendingCount}
        pendingRtVerificationCount={pendingRtVerificationCount}
        pendingPaguyubanApprovalCount={pendingPaguyubanApprovalCount}
        totalBalance={financials.totalBalance}
        settings={settings}
        payments={payments}
        users={users}
        activeUser={activeUser}
        memberCount={displayMemberCount}
        claimCount={claims.length}
        cloudStatus={cloudStatus}
        onSwitchActiveUser={handleSwitchActiveUser}
        onResetData={handleResetData}
        onClearTransactions={handleClearTransactions}
        onClearDemoData={handleClearTransactions}
        onClearClaims={handleClearClaims}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onLogout={handleRequestLogout}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-28">
        {currentTab === 'public' && (
          <PublicLandingPage
            members={members}
            payments={payments}
            claims={claims}
            settings={settings}
            clusters={clusters}
            benefits={benefits}
            users={users}
            activeUser={activeUser}
            financials={financials}
            onRegisterMember={handlePublicRegisterMember}
            onMakePayment={handleAddPayment}
            onNavigateToInternal={() => setCurrentTab('dashboard')}
            onLoginSuccess={handleUserLogin}
            onLogout={handleRequestLogout}
            onOpenLoginModal={() => setIsLoginModalOpen(true)}
            initialOpenRegister={isPublicRegisterOpen}
            onRegisterStateChange={setIsPublicRegisterOpen}
          />
        )}

        {currentTab === 'member-portal' && (
          <MemberPortal
            activeUser={activeUser}
            members={members}
            payments={payments}
            claims={claims}
            settings={settings}
            benefits={benefits}
            users={users}
            onNavigateToPayment={handleSelectMemberForPayment}
            onUpdateMember={handleUpdateMember}
            onLogout={handleRequestLogout}
            setCurrentTab={setCurrentTab}
          />
        )}

        {currentTab === 'dashboard' && (
          <DashboardOverview
            currentTab={currentTab}
            members={members}
            payments={payments}
            claims={claims}
            settings={settings}
            clusters={clusters}
            users={users}
            activeUser={activeUser}
            financials={financials}
            notifications={notifications}
            onDismissNotification={handleDismissNotification}
            onMarkNotificationRead={handleMarkNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onClearAllNotifications={handleClearAllNotifications}
            setCurrentTab={setCurrentTab}
            onViewReceipt={(p) => setSelectedReceiptPayment(p)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onSelectMemberForPayment={handleSelectMemberForPayment}
          />
        )}

        {currentTab === 'registration' && (
          <MemberRegistration
            members={members}
            payments={payments}
            claims={claims}
            settings={settings}
            benefits={benefits}
            users={users}
            activeUser={activeUser}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onImportBatchMembers={handleImportBatchMembers}
            onSelectMemberForPayment={handleSelectMemberForPayment}
            onViewReceipt={(p) => setSelectedReceiptPayment(p)}
            onNavigateToVerification={can(activeUser?.authority, 'verify_rt_members') ? () => setCurrentTab('rt-verification') : undefined}
          />
        )}

        {currentTab === 'rt-verification' && (
          <RtClusterVerification
            members={members}
            activeUser={activeUser}
            claims={claims}
            onVerifyMember={handleVerifyMember}
            onRejectMember={handleRejectMember}
            onUpdateMemberCluster={handleUpdateMemberCluster}
            onAddClaim={handleAddClaim}
            onNavigateToRealization={() => setCurrentTab('realization')}
          />
        )}

        {currentTab === 'paguyuban-approval' && (
          <PaguyubanApproval
            members={members}
            payments={payments}
            claims={claims}
            financials={financials}
            benefits={benefits}
            settings={settings}
            activeUser={activeUser}
            onApproveMember={handleApproveByKetuaPaguyuban}
            onRejectMember={handleRejectByKetuaPaguyuban}
            onViewReceipt={(p) => setSelectedReceiptPayment(p)}
            onAddClaim={handleAddClaim}
            onUpdateClaim={handleUpdateClaim}
            onApproveClaim={handleApproveClaim}
            onRejectClaim={handleRejectClaim}
          />
        )}

        {currentTab === 'payment' && (
          <PaymentForm
            members={members}
            settings={settings}
            activeUser={activeUser}
            selectedMemberForPayment={selectedMemberForPayment}
            onAddPayment={handleAddPayment}
            onNavigateToValidation={() => setCurrentTab('validation')}
            onNavigateToVerification={can(activeUser?.authority, 'verify_rt_members') ? () => setCurrentTab('rt-verification') : undefined}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'validation' && (
          <AdminValidation
            payments={payments}
            members={members}
            settings={settings}
            activeUser={activeUser}
            setCurrentTab={setCurrentTab}
            onVerifyPayment={handleVerifyPayment}
            onRejectPayment={handleRejectPayment}
            onViewReceipt={(p) => setSelectedReceiptPayment(p)}
            onSaveDefaultSignature={handleSaveDefaultSignature}
          />
        )}

        {currentTab === 'realization' && (
          <BenefitRealization
            members={members}
            claims={claims}
            currentBalance={financials.totalBalance}
            settings={settings}
            benefits={benefits}
            activeUser={activeUser}
            onAddClaim={handleAddClaim}
            onUpdateClaim={handleUpdateClaim}
            onApproveClaim={handleApproveClaim}
            onRejectClaim={handleRejectClaim}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onClearClaims={handleClearClaims}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'history' && (
          <PaymentHistory
            payments={payments}
            members={members}
            settings={settings}
            activeUser={activeUser}
            onViewReceipt={(p) => setSelectedReceiptPayment(p)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'users' && (
          <UserManagement
            users={users}
            activeUser={activeUser}
            clusters={clusters}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSwitchActiveUser={handleSwitchActiveUser}
            onSyncRtUsersWithClusters={handleSyncRtUsersWithClusters}
            onPermissionsChange={() => refreshPermissions()}
            onNavigateToSettings={() => setCurrentTab('settings')}
            onClose={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'settings' && (
          <FundSettings
            settings={settings}
            clusters={clusters}
            benefits={benefits}
            memberCount={members.length}
            paymentCount={payments.length}
            claimCount={claims.length}
            activeUser={activeUser}
            onSaveSettings={handleSaveSettings}
            onSaveCluster={handleSaveCluster}
            onDeleteCluster={handleDeleteCluster}
            onSaveBenefit={handleSaveBenefit}
            onDeleteBenefit={handleDeleteBenefit}
            onResetBenefits={handleResetBenefits}
            onResetData={handleResetData}
            onClearTransactions={handleClearTransactions}
            onClearDemoData={handleClearAllDemoData}
            onClearClaims={handleClearClaims}
            onNavigateToUsers={() => setCurrentTab('users')}
            onClose={() => setCurrentTab('dashboard')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 pb-28 md:pb-6 text-xs text-center print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-slate-300">
            <HeartHandshake className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{settings.communityName}</span>
          </div>
          <p>© {new Date().getFullYear()} Aplikasi Dana Kematian • Transparan & Akuntabel</p>
        </div>
      </footer>

      {/* Persistent Floating Bottom Dock across all menus */}
      <PersistentRoleFloatingDock
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeUser={activeUser}
        isAdminRole={isAdminRole}
        pendingRtVerificationCount={pendingRtVerificationCount}
        pendingCount={pendingCount}
        pendingPaguyubanApprovalCount={pendingPaguyubanApprovalCount}
        userCount={users.length}
        onOpenRegistration={handleOpenRegistrationFromDock}
        onOpenPayment={() => {
          setSelectedMemberForPayment(null);
          setCurrentTab('payment');
        }}
      />

      {/* Kwitansi Receipt Modal Popup */}
      {selectedReceiptPayment && (
        <ReceiptModal
          payment={selectedReceiptPayment}
          members={members}
          payments={payments}
          settings={settings}
          activeUser={activeUser}
          onClose={() => setSelectedReceiptPayment(null)}
          onUpdatePayment={handleUpdatePayment}
          onSaveDefaultSignature={handleSaveDefaultSignature}
          onOpenPublicVerification={(receiptNo) => {
            setVerifiedReceiptNumber(receiptNo);
            setIsReceiptVerificationModalOpen(true);
          }}
        />
      )}

      {/* Financial Report & CSV Export Modal */}
      <FinancialReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        payments={payments}
        claims={claims}
        members={members}
        settings={settings}
        financials={financials}
      />

      {/* User Login & Authentication Modal */}
      <UserLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        members={members}
        activeUser={activeUser}
        onLoginSuccess={handleUserLogin}
        onUpdateMember={handleUpdateMember}
        onUpdateUser={handleUpdateUser}
        onNavigateToDashboard={() => {
          setCurrentTab('dashboard');
          setIsLoginModalOpen(false);
        }}
      />

      {/* User Logout Safety Confirmation Alert Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        user={activeUser}
        onConfirm={handleConfirmLogout}
        onClose={() => setIsLogoutModalOpen(false)}
      />

      {/* Public / Global KTA Authenticity Verification Modal (Accessed via mobile QR scan or link) */}
      {isKtaVerificationModalOpen && (
        <KtaAuthenticityVerificationModal
          isOpen={isKtaVerificationModalOpen}
          onClose={() => {
            setIsKtaVerificationModalOpen(false);
            setVerifiedKtaData(null);
            if (typeof window !== 'undefined' && window.history) {
              const url = new URL(window.location.href);
              url.searchParams.delete('verify');
              url.searchParams.delete('npa');
              url.searchParams.delete('sig');
              window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
            }
          }}
          npaQuery={verifiedKtaData?.npa}
          securityToken={verifiedKtaData?.sig}
          members={members}
          payments={payments}
          settings={settings}
          onOpenFullKtaModal={(mem) => {
            setSelectedFullKtaMember(mem);
          }}
        />
      )}

      {/* Public Receipt Authenticity Verification Modal (Accessed via mobile QR scan or link) */}
      {isReceiptVerificationModalOpen && (
        <ReceiptAuthenticityVerificationModal
          isOpen={isReceiptVerificationModalOpen}
          receiptNumberQuery={verifiedReceiptNumber || ''}
          payments={payments}
          members={members}
          settings={settings}
          onClose={() => {
            setIsReceiptVerificationModalOpen(false);
            setVerifiedReceiptNumber(null);
            if (typeof window !== 'undefined' && window.history) {
              const url = new URL(window.location.href);
              url.searchParams.delete('verify');
              url.searchParams.delete('receiptNumber');
              url.searchParams.delete('receipt');
              url.searchParams.delete('no');
              url.searchParams.delete('kwitansi');
              window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
            }
          }}
          onOpenFullReceipt={(payment) => {
            setSelectedReceiptPayment(payment);
          }}
        />
      )}

      {/* Digital KTA Modal opened from verification certificate */}
      {selectedFullKtaMember && (
        <DigitalKtaModal
          isOpen={Boolean(selectedFullKtaMember)}
          member={selectedFullKtaMember}
          payments={payments}
          settings={settings}
          onClose={() => setSelectedFullKtaMember(null)}
          onSelectMemberForPayment={(mem) => {
            setSelectedFullKtaMember(null);
            setSelectedMemberForPayment(mem);
            setCurrentTab('payment');
          }}
        />
      )}

      {/* Official Membership Certificate Modal */}
      {selectedCertificateMember && (
        <MembershipCertificateModal
          isOpen={Boolean(selectedCertificateMember)}
          member={selectedCertificateMember}
          payments={payments}
          settings={settings}
          onClose={() => setSelectedCertificateMember(null)}
          onOpenKtaModal={(mem) => {
            setSelectedCertificateMember(null);
            setSelectedFullKtaMember(mem);
          }}
        />
      )}

      {/* PWA Mobile App Installation Modal */}
      <PWAInstallModal
        isOpen={isPWAInstallModalOpen}
        onClose={() => setIsPWAInstallModalOpen(false)}
      />
    </div>
  );
}
