import { Member, Payment, BenefitClaim, SystemSettings, AppUser, ClusterMaster, DEFAULT_CLUSTERS, BenefitMaster, DEFAULT_BENEFITS, AppNotification, INITIAL_NOTIFICATIONS } from '../types';
import {
  initialMembers,
  initialPayments,
  initialClaims,
  sampleDemoMembers,
  sampleDemoPayments,
  sampleDemoClaims,
  initialSettings,
  initialUsers,
  initialBenefits,
  INITIAL_BASE_FUND_BALANCE,
} from '../data/initialData';

const KEYS = {
  MEMBERS: 'dana_kematian_members_v1',
  PAYMENTS: 'dana_kematian_payments_v1',
  CLAIMS: 'dana_kematian_claims_v1',
  SETTINGS: 'dana_kematian_settings_v1',
  BASE_BALANCE: 'dana_kematian_base_balance_v1',
  USERS: 'dana_kematian_users_v1',
  ACTIVE_USER: 'dana_kematian_active_user_v1',
  CLUSTERS: 'dana_kematian_clusters_v1',
  BENEFITS: 'dana_kematian_benefits_v1',
  NOTIFICATIONS: 'dana_kematian_notifications_v1',
  IS_INITIALIZED: 'dana_kematian_initialized_v1',
  DEMO_CLEARED: 'dana_kematian_demo_cleared_v1',
};

export const getStoredBenefits = (): BenefitMaster[] => {
  try {
    const data = localStorage.getItem(KEYS.BENEFITS);
    if (!data) {
      localStorage.setItem(KEYS.BENEFITS, JSON.stringify(DEFAULT_BENEFITS));
      return DEFAULT_BENEFITS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_BENEFITS;
  } catch (e) {
    console.error('Error reading benefits:', e);
    return DEFAULT_BENEFITS;
  }
};

export const saveStoredBenefits = (benefits: BenefitMaster[]) => {
  try {
    localStorage.setItem(KEYS.BENEFITS, JSON.stringify(benefits));
  } catch (e) {
    console.error('Error saving benefits:', e);
  }
};

export const getStoredClusters = (): ClusterMaster[] => {
  try {
    const data = localStorage.getItem(KEYS.CLUSTERS);
    if (!data) {
      localStorage.setItem(KEYS.CLUSTERS, JSON.stringify(DEFAULT_CLUSTERS));
      return DEFAULT_CLUSTERS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_CLUSTERS;
  } catch (e) {
    console.error('Error reading clusters:', e);
    return DEFAULT_CLUSTERS;
  }
};

export const saveStoredClusters = (clusters: ClusterMaster[]) => {
  try {
    localStorage.setItem(KEYS.CLUSTERS, JSON.stringify(clusters));
  } catch (e) {
    console.error('Error saving clusters:', e);
  }
};

export const getActiveClusterNames = (): string[] => {
  const clusters = getStoredClusters();
  return clusters.filter((c) => c.isActive).map((c) => c.name);
};

export const getStoredUsers = (): AppUser[] => {
  try {
    const data = localStorage.getItem(KEYS.USERS);
    let users = initialUsers;
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        users = parsed;
      }
    }

    // Ensure default role accounts like Ketua Paguyuban exist
    const hasKetuaPaguyuban = users.some((u) => u && (u.authority === 'Ketua Paguyuban' || u.id === 'usr-ketua-paguyuban'));
    if (!hasKetuaPaguyuban) {
      const ketuaUser = initialUsers.find((u) => u.id === 'usr-ketua-paguyuban');
      if (ketuaUser) {
        users = [ketuaUser, ...users];
      }
    }

    // Auto migrate old cluster names in users
    users = users.map((u) => {
      if (!u) return u;
      let cluster = u.cluster;
      if (cluster === 'Cluster Tanah Minang') {
        cluster = 'Cluster Ranah Minang';
      } else if (cluster === 'Cluster Pasundan') {
        cluster = 'Cluster Pasundan RT 01';
      } else if (cluster === 'Cluster Pasundan RT 02') {
        cluster = 'Cluster Pasundan RT 05';
      } else if (cluster === 'Cluster Pasundan RT 03') {
        cluster = 'Cluster Pasundan RT 06';
      }
      return { ...u, cluster };
    });

    // Synchronize Ketua RT users with Master RT Clusters
    const clusters = getStoredClusters();
    users = syncClustersToRtUsers(clusters, users);

    const members = getStoredMembers();
    const synced = syncMembersToUsers(members, users);
    localStorage.setItem(KEYS.USERS, JSON.stringify(synced));
    return synced;
  } catch (e) {
    console.error('Error reading users:', e);
    return initialUsers;
  }
};

/**
 * Synchronizes Ketua RT user accounts with Master RT Clusters (ClusterMaster).
 * For each cluster in master clusters:
 * 1. Checks if a Ketua RT user exists for this cluster.
 * 2. Updates their name, email, phone, status, and cluster according to Master RT Cluster.
 * 3. If missing, automatically generates the official Ketua RT account.
 * 4. Ensures cluster name changes in Master Cluster are reflected in the user's cluster field.
 */
export const syncClustersToRtUsers = (
  clusters: ClusterMaster[] = [],
  existingUsers: AppUser[] = []
): AppUser[] => {
  let usersList = Array.isArray(existingUsers) ? [...existingUsers] : [];
  if (!Array.isArray(clusters) || clusters.length === 0) return usersList;

  // Map known default cluster IDs to initial RT user IDs if present
  const clusterIdToDefaultUserId: Record<string, string> = {
    'cls-1': 'usr-3',
    'cls-2': 'usr-4',
    'cls-3': 'usr-5',
    'cls-4': 'usr-5b',
    'cls-5': 'usr-5c',
    'cls-6': 'usr-6',
  };

  clusters.forEach((cls) => {
    if (!cls || !cls.name) return;

    const cleanCode = (cls.code || cls.name)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const defaultEmail = cls.leaderEmail?.trim() || `rt.${cleanCode}@danakematian.org`;
    const defaultPhone = cls.leaderPhone?.trim() || '';
    const defaultName = cls.leaderName?.trim() || `Ketua ${cls.name}`;
    const defaultUserId = clusterIdToDefaultUserId[cls.id] || `usr-rt-${cls.id}`;

    // Find existing Ketua RT user for this cluster
    const existingIndex = usersList.findIndex((u) => {
      if (!u || u.authority !== 'Ketua RT (Cluster)') return false;
      if (u.id === defaultUserId || u.id === `usr-rt-${cls.id}`) return true;
      if (cls.leaderEmail && u.email && u.email.toLowerCase() === cls.leaderEmail.trim().toLowerCase()) return true;
      if (u.cluster && u.cluster.toLowerCase() === cls.name.toLowerCase()) return true;
      if (cls.id === 'cls-4' && u.cluster === 'Cluster Pasundan RT 02') return true;
      if (cls.id === 'cls-5' && u.cluster === 'Cluster Pasundan RT 03') return true;
      return false;
    });

    if (existingIndex !== -1) {
      const current = usersList[existingIndex];
      usersList[existingIndex] = {
        ...current,
        name: defaultName,
        email: defaultEmail,
        phone: defaultPhone || current.phone,
        cluster: cls.name,
        status: cls.isActive ? 'Aktif' : 'Non-Aktif',
        notes: `Ketua RT resmi wilayah ${cls.name} (${cls.rtNumber || 'RT'}). Sinkron dengan Master Cluster.`,
      };
    } else {
      // Create new Ketua RT user
      usersList.push({
        id: defaultUserId,
        name: defaultName,
        email: defaultEmail,
        password: 'password123',
        authority: 'Ketua RT (Cluster)',
        cluster: cls.name,
        phone: defaultPhone,
        status: cls.isActive ? 'Aktif' : 'Non-Aktif',
        createdAt: new Date().toISOString().split('T')[0],
        avatarColor: 'bg-amber-600',
        notes: `Ketua RT resmi wilayah ${cls.name} (${cls.rtNumber || 'RT'}). Sinkron dengan Master Cluster.`,
      });
    }
  });

  return usersList;
};

export const createMemberUser = (member: Member, customEmail?: string, customPassword?: string): AppUser => {
  const name = member?.name || 'Warga';
  const memberNum = member?.memberNumber || `${Date.now()}`;
  const cleanName = (name || '').replace(/^Alm\.\s*/i, '').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const emailPrefix = (cleanName || 'warga').toLowerCase().split(/\s+/).slice(0, 2).join('.') || `warga.${(memberNum || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  
  const finalEmail = (customEmail && customEmail.trim()) || (member?.email && member.email.trim()) || `${emailPrefix}@warga.danakematian.org`;
  const finalPassword = (customPassword && customPassword.trim()) || (member?.password && member.password.trim()) || 'password123';

  return {
    id: `usr-mem-${member?.id || Date.now()}`,
    name: name,
    email: finalEmail.toLowerCase(),
    password: finalPassword,
    authority: 'Anggota',
    cluster: member?.cluster,
    phone: member?.phone,
    memberId: member?.id,
    memberNumber: member?.memberNumber,
    status: member?.status === 'Ditolak' ? 'Non-Aktif' : 'Aktif',
    createdAt: member?.joinDate || new Date().toISOString().split('T')[0],
    avatarColor: 'bg-slate-700',
    notes: `Warga ${member?.cluster || ''} (${member?.memberNumber || ''})`,
  };
};

export const syncMembersToUsers = (members: Member[] = [], existingUsers: AppUser[] = []): AppUser[] => {
  const usersList = Array.isArray(existingUsers) ? [...existingUsers] : [];
  if (!Array.isArray(members)) return usersList;
  
  members.forEach((m) => {
    if (!m) return;
    const existingIndex = usersList.findIndex(
      (u) =>
        u && (
          (u.memberId && m.id && u.memberId === m.id) ||
          (m.email && u.email && u.email.toLowerCase() === m.email.toLowerCase()) ||
          (u.authority === 'Anggota' && (
            (u.memberNumber && m.memberNumber && u.memberNumber === m.memberNumber) ||
            (u.name && m.name && u.name.toLowerCase() === m.name.toLowerCase())
          ))
        )
    );

    if (existingIndex === -1) {
      usersList.push(createMemberUser(m));
    } else {
      usersList[existingIndex] = {
        ...usersList[existingIndex],
        email: m.email ? m.email.toLowerCase() : usersList[existingIndex].email,
        password: m.password || usersList[existingIndex].password,
        memberId: m.id,
        memberNumber: m.memberNumber,
        cluster: m.cluster,
        phone: m.phone || usersList[existingIndex].phone,
      };
    }
  });

  return usersList;
};

export const getMemberForUser = (user?: AppUser, members: Member[] = []): Member | undefined => {
  if (!user || !Array.isArray(members)) return undefined;
  if (user.memberId) {
    const found = members.find((m) => m && m.id === user.memberId);
    if (found) return found;
  }
  if (user.memberNumber) {
    const found = members.find((m) => m && m.memberNumber === user.memberNumber);
    if (found) return found;
  }
  if (user.email) {
    const userEmailLower = user.email.toLowerCase();
    const found = members.find((m) => m && m.email && m.email.toLowerCase() === userEmailLower);
    if (found) return found;
  }
  if (user.authority === 'Anggota' && user.name) {
    const userNameLower = (user.name || '').toLowerCase();
    const found = members.find((m) => m && ((m.name && m.name.toLowerCase() === userNameLower) || (m.phone && user.phone && m.phone === user.phone)));
    if (found) return found;
  }
  return undefined;
};

export const saveUsers = (users: AppUser[]) => {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
};

export const getStoredActiveUser = (): AppUser | null => {
  try {
    const data = localStorage.getItem(KEYS.ACTIVE_USER);
    if (!data) {
      // Default to initial admin if first run, or return default user
      const users = getStoredUsers();
      const defaultUser = users[0] || initialUsers[0];
      localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(defaultUser));
      return defaultUser;
    }
    if (data === 'guest' || data === 'null') {
      return null;
    }
    const user: AppUser = JSON.parse(data);
    if (user.cluster === 'Cluster Tanah Minang') {
      user.cluster = 'Cluster Ranah Minang';
      localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    } else if (user.cluster === 'Cluster Pasundan') {
      user.cluster = 'Cluster Pasundan RT 01';
      localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    }
    return user;
  } catch (e) {
    return null;
  }
};

export const saveStoredActiveUser = (user: AppUser | null) => {
  if (user) {
    localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(user));
  } else {
    localStorage.setItem(KEYS.ACTIVE_USER, 'guest');
  }
};

export const clearStoredActiveUser = () => {
  localStorage.setItem(KEYS.ACTIVE_USER, 'guest');
};

export const getStoredMembers = (): Member[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const data = localStorage.getItem(KEYS.MEMBERS);
    if (data === null) {
      if (isCleared) {
        return [];
      }
      const isInit = localStorage.getItem(KEYS.IS_INITIALIZED);
      if (isInit) {
        return [];
      }
      localStorage.setItem(KEYS.IS_INITIALIZED, 'true');
      localStorage.setItem(KEYS.MEMBERS, JSON.stringify(initialMembers));
      return initialMembers;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    let migrated = false;
    const migratedMembers = parsed.map((m: Member) => {
      if (!m) return m;
      let cluster = m.cluster;
      if (cluster === 'Cluster Tanah Minang') {
        cluster = 'Cluster Ranah Minang';
        migrated = true;
      } else if (cluster === 'Cluster Pasundan') {
        const addr = (m.address || '').toLowerCase();
        if (addr.includes('rt 02') || addr.includes('rt 2') || addr.includes('rt.02') || addr.includes('rt.2') || addr.includes('blok p-02')) {
          cluster = 'Cluster Pasundan RT 02';
        } else if (addr.includes('rt 03') || addr.includes('rt 3') || addr.includes('rt.03') || addr.includes('rt.3') || addr.includes('blok p-03')) {
          cluster = 'Cluster Pasundan RT 03';
        } else {
          cluster = 'Cluster Pasundan RT 01';
        }
        migrated = true;
      }
      return { ...m, cluster };
    });

    if (migrated) {
      localStorage.setItem(KEYS.MEMBERS, JSON.stringify(migratedMembers));
    }

    return migratedMembers;
  } catch (e) {
    console.error('Error reading members:', e);
    return [];
  }
};

export const saveMembers = (members: Member[]) => {
  try {
    localStorage.setItem(KEYS.IS_INITIALIZED, 'true');
    localStorage.setItem(KEYS.MEMBERS, JSON.stringify(members));
  } catch (e) {
    console.warn('Storage quota warning when saving members:', e);
    // If quota exceeded due to large photo base64 strings, save members safely
    try {
      const compactMembers = members.map((m) => {
        if (m.familyCardPhotoUrl && m.familyCardPhotoUrl.length > 300000) {
          // Keep a compressed placeholder in local storage while cloud Firestore holds the full record
          return {
            ...m,
            familyCardPhotoUrl: m.familyCardPhotoUrl.substring(0, 100000),
          };
        }
        return m;
      });
      localStorage.setItem(KEYS.MEMBERS, JSON.stringify(compactMembers));
    } catch (innerErr) {
      console.warn('Fallback compact member save failed:', innerErr);
    }
  }
};

export const getStoredPayments = (): Payment[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const data = localStorage.getItem(KEYS.PAYMENTS);
    if (data === null) {
      if (isCleared) {
        return [];
      }
      const isInit = localStorage.getItem(KEYS.IS_INITIALIZED);
      if (isInit) {
        return [];
      }
      localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(initialPayments));
      return initialPayments;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error('Error reading payments:', e);
    return [];
  }
};

export const savePayments = (payments: Payment[]) => {
  try {
    localStorage.setItem(KEYS.IS_INITIALIZED, 'true');
    localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(payments));
  } catch (e) {
    console.warn('Storage quota warning when saving payments:', e);
  }
};

export const getStoredClaims = (): BenefitClaim[] => {
  try {
    const data = localStorage.getItem(KEYS.CLAIMS);
    if (!data) {
      localStorage.setItem(KEYS.CLAIMS, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Filter out demo claims ('claim-1', 'claim-2', 'claim-3') to ensure realization demo data is clean
      const cleaned = parsed.filter((c: BenefitClaim) => c && c.id !== 'claim-1' && c.id !== 'claim-2' && c.id !== 'claim-3');
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(KEYS.CLAIMS, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return [];
  } catch (e) {
    console.error('Error reading claims:', e);
    return [];
  }
};

export const clearAllClaimsLocally = () => {
  try {
    localStorage.setItem(KEYS.CLAIMS, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('adk_claims_updated', { detail: [] }));
    }
  } catch (e) {
    console.warn('Storage quota warning when clearing claims:', e);
  }
};

export const saveClaims = (claims: BenefitClaim[]) => {
  try {
    localStorage.setItem(KEYS.IS_INITIALIZED, 'true');
    localStorage.setItem(KEYS.CLAIMS, JSON.stringify(claims));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('adk_claims_updated', { detail: claims }));
    }
  } catch (e) {
    console.warn('Storage quota warning when saving claims:', e);
  }
};

export const getStoredSettings = (): SystemSettings => {
  try {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (data === null) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(initialSettings));
      return initialSettings;
    }
    const parsed = JSON.parse(data);
    if (!parsed.logoUrl) {
      parsed.logoUrl = '/app-icon.svg';
    }
    return {
      ...initialSettings,
      ...parsed,
      membershipPeriod: {
        ...initialSettings.membershipPeriod,
        ...(parsed.membershipPeriod || {}),
      },
    };
  } catch (e) {
    console.error('Error reading settings:', e);
    return initialSettings;
  }
};

export const saveSettings = (settings: SystemSettings) => {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
};

export const getBaseBalance = (): number => {
  try {
    const val = localStorage.getItem(KEYS.BASE_BALANCE);
    return val !== null ? parseFloat(val) : INITIAL_BASE_FUND_BALANCE;
  } catch (e) {
    return INITIAL_BASE_FUND_BALANCE;
  }
};

// Calculate current dynamic balance: Base + Verified Payments - Approved Benefit Claims
export const calculateCurrentBalance = (
  baseBalance: number = getBaseBalance(),
  payments: Payment[] = getStoredPayments(),
  claims: BenefitClaim[] = getStoredClaims()
): {
  totalBalance: number;
  totalIncomeVerified: number;
  totalPendingIncome: number;
  totalBenefitSpent: number;
  totalPendingClaimsAmount?: number;
} => {
  const totalIncomeVerified = payments
    .filter((p) => p.status === 'Verified')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPendingIncome = payments
    .filter((p) => p.status === 'Pending')
    .reduce((sum, p) => sum + p.amount, 0);

  // Hanya klaim santunan yang telah disetujui resmi oleh Ketua Paguyuban yang mengurangi saldo kas
  const approvedClaims = claims.filter((c) => !c.status || c.status === 'Disetujui');
  const totalBenefitSpent = approvedClaims.reduce((sum, c) => sum + c.totalAmount, 0);

  // Akumulasi komitmen dana klaim yang sedang diproses (Diajukan RT / Menunggu Persetujuan Ketua)
  const pendingClaims = claims.filter(
    (c) =>
      c.status === 'Diajukan RT' ||
      c.status === 'Menunggu Pembayaran Bendahara' ||
      c.status === 'Menunggu Persetujuan Ketua'
  );
  const totalPendingClaimsAmount = pendingClaims.reduce((sum, c) => sum + c.totalAmount, 0);

  const totalBalance = baseBalance + totalIncomeVerified - totalBenefitSpent;

  return {
    totalBalance,
    totalIncomeVerified,
    totalPendingIncome,
    totalBenefitSpent,
    totalPendingClaimsAmount,
  };
};

export const getStoredNotifications = (): AppNotification[] => {
  try {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    if (!data) {
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_NOTIFICATIONS;
  } catch (e) {
    console.error('Error reading notifications:', e);
    return INITIAL_NOTIFICATIONS;
  }
};

export const saveStoredNotifications = (notifications: AppNotification[]) => {
  try {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving notifications:', e);
  }
};

export const resetToDefaultData = () => {
  localStorage.removeItem(KEYS.DEMO_CLEARED);
  localStorage.setItem(KEYS.IS_INITIALIZED, 'true');
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify(sampleDemoMembers));
  localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(sampleDemoPayments));
  localStorage.setItem(KEYS.CLAIMS, JSON.stringify(sampleDemoClaims));
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(initialSettings));
  localStorage.setItem(KEYS.CLUSTERS, JSON.stringify(DEFAULT_CLUSTERS));
  localStorage.setItem(KEYS.BENEFITS, JSON.stringify(DEFAULT_BENEFITS));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
  localStorage.setItem(KEYS.BASE_BALANCE, INITIAL_BASE_FUND_BALANCE.toString());
  localStorage.setItem(KEYS.USERS, JSON.stringify(initialUsers));
  localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(initialUsers[0]));
};

export const clearTransactionsLocally = () => {
  localStorage.setItem(KEYS.PAYMENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.CLAIMS, JSON.stringify([]));
  localStorage.setItem(KEYS.BASE_BALANCE, '0');
  localStorage.setItem('dana_kematian_tx_cleared_v1', 'true');
};

export const clearAllDemoDataLocally = () => {
  localStorage.setItem(KEYS.IS_INITIALIZED, 'true');
  localStorage.setItem(KEYS.DEMO_CLEARED, 'true');
  localStorage.setItem(KEYS.MEMBERS, JSON.stringify([]));
  localStorage.setItem(KEYS.PAYMENTS, JSON.stringify([]));
  localStorage.setItem(KEYS.CLAIMS, JSON.stringify([]));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
  localStorage.setItem(KEYS.BASE_BALANCE, '0');
  const adminUsers = initialUsers.filter((u) => u.authority !== 'Anggota');
  localStorage.setItem(KEYS.USERS, JSON.stringify(adminUsers));
  localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(adminUsers[0] || initialUsers[0]));
};

// Format Currency Utility IDR
export const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
};
