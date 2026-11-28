import { Member, Payment, BenefitClaim, SystemSettings, AppUser, ClusterMaster, DEFAULT_CLUSTERS, BenefitMaster, DEFAULT_BENEFITS, AppNotification, INITIAL_NOTIFICATIONS, AmbulanceOrder, FuneralSchedule, FuneralInventoryItem, FuneralInventoryLoan } from '../types';
import {
  initialMembers,
  initialPayments,
  initialClaims,
  sampleDemoMembers,
  sampleDemoPayments,
  sampleDemoClaims,
  sampleInitialAmbulanceOrders,
  sampleInitialFuneralSchedules,
  sampleInitialInventoryItems,
  sampleInitialInventoryLoans,
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
  AMBULANCE_ORDERS: 'dana_kematian_ambulance_orders_v1',
  FUNERAL_SCHEDULES: 'dana_kematian_funeral_schedules_v1',
  FUNERAL_INVENTORY: 'dana_kematian_funeral_inventory_v1',
  FUNERAL_INVENTORY_LOANS: 'dana_kematian_funeral_inventory_loans_v1',
  IS_INITIALIZED: 'dana_kematian_initialized_v1',
  DEMO_CLEARED: 'dana_kematian_demo_cleared_v1',
};

const LARGE_DATA_URL_LIMIT = 16000;

const isLargeDataUrl = (value: unknown, maxLen: number = LARGE_DATA_URL_LIMIT): boolean => {
  return typeof value === 'string' && value.startsWith('data:') && value.length > maxLen;
};

const compactMemberForLocalCache = (member: Member): Member => {
  if (!member) return member;
  const needsCompact =
    isLargeDataUrl(member.familyCardPhotoUrl) ||
    isLargeDataUrl(member.photoUrl) ||
    isLargeDataUrl(member.paguyubanSignature);
  if (!needsCompact) return member;
  return {
    ...member,
    familyCardPhotoUrl: isLargeDataUrl(member.familyCardPhotoUrl) ? '' : member.familyCardPhotoUrl,
    photoUrl: isLargeDataUrl(member.photoUrl) ? '' : member.photoUrl,
    paguyubanSignature: isLargeDataUrl(member.paguyubanSignature) ? '' : member.paguyubanSignature,
  };
};

const compactPaymentForLocalCache = (payment: Payment): Payment => {
  if (!payment) return payment;
  const needsCompact =
    isLargeDataUrl(payment.proofImageUrl) ||
    isLargeDataUrl(payment.adminSignature);
  if (!needsCompact) return payment;
  return {
    ...payment,
    proofImageUrl: isLargeDataUrl(payment.proofImageUrl) ? '' : payment.proofImageUrl,
    adminSignature: isLargeDataUrl(payment.adminSignature) ? '' : payment.adminSignature,
  };
};

const compactClaimForLocalCache = (claim: BenefitClaim): BenefitClaim => {
  if (!claim) return claim;
  return {
    ...claim,
    deathCertificateUrl: isLargeDataUrl(claim.deathCertificateUrl) ? '' : claim.deathCertificateUrl,
    ketuaSignature: isLargeDataUrl(claim.ketuaSignature) ? '' : claim.ketuaSignature,
    transferProofUrls: Array.isArray(claim.transferProofUrls)
      ? claim.transferProofUrls.filter((u) => !isLargeDataUrl(u))
      : claim.transferProofUrls,
    externalReceiptUrls: Array.isArray(claim.externalReceiptUrls)
      ? claim.externalReceiptUrls.filter((u) => !isLargeDataUrl(u))
      : claim.externalReceiptUrls,
    expenseDetails: Array.isArray(claim.expenseDetails)
      ? claim.expenseDetails.map((d) => ({
          ...d,
          transferProofUrl: isLargeDataUrl(d?.transferProofUrl) ? '' : d?.transferProofUrl,
          externalReceiptUrl: isLargeDataUrl(d?.externalReceiptUrl) ? '' : d?.externalReceiptUrl,
        }))
      : claim.expenseDetails,
  };
};

const reclaimLocalStorageSpace = (excludeKey?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    // 1. Compact heavy cached collections that may contain legacy base64 photos/proofs
    if (excludeKey !== KEYS.MEMBERS) {
      const rawMembers = localStorage.getItem(KEYS.MEMBERS);
      if (rawMembers && rawMembers.length > 200000) {
        try {
          const parsed = JSON.parse(rawMembers);
          if (Array.isArray(parsed)) {
            localStorage.setItem(KEYS.MEMBERS, JSON.stringify(parsed.map(compactMemberForLocalCache)));
          }
        } catch {
          localStorage.removeItem(KEYS.MEMBERS);
        }
      }
    }

    if (excludeKey !== KEYS.PAYMENTS) {
      const rawPayments = localStorage.getItem(KEYS.PAYMENTS);
      if (rawPayments && rawPayments.length > 200000) {
        try {
          const parsed = JSON.parse(rawPayments);
          if (Array.isArray(parsed)) {
            localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(parsed.map(compactPaymentForLocalCache)));
          }
        } catch {
          localStorage.removeItem(KEYS.PAYMENTS);
        }
      }
    }

    if (excludeKey !== KEYS.CLAIMS) {
      const rawClaims = localStorage.getItem(KEYS.CLAIMS);
      if (rawClaims && rawClaims.length > 150000) {
        try {
          const parsed = JSON.parse(rawClaims);
          if (Array.isArray(parsed)) {
            localStorage.setItem(KEYS.CLAIMS, JSON.stringify(parsed.map(compactClaimForLocalCache)));
          }
        } catch {
          localStorage.removeItem(KEYS.CLAIMS);
        }
      }
    }

    // 2. Trim old notifications and non-critical form drafts if large
    if (excludeKey !== KEYS.NOTIFICATIONS) {
      const rawNotifs = localStorage.getItem(KEYS.NOTIFICATIONS);
      if (rawNotifs && rawNotifs.length > 100000) {
        try {
          const parsed = JSON.parse(rawNotifs);
          if (Array.isArray(parsed)) {
            localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(parsed.slice(0, 50)));
          }
        } catch {
          localStorage.removeItem(KEYS.NOTIFICATIONS);
        }
      }
    }

    // Remove oversized draft keys if present
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || k === excludeKey) continue;
      if (k.includes('_draft_') || k.includes('draft_v')) {
        const val = localStorage.getItem(k);
        if (val && val.length > 100000) {
          localStorage.removeItem(k);
        }
      }
    }
  } catch (err) {
    console.warn('Unable to reclaim localStorage space:', err);
  }
};

export const safeSetItem = (key: string, value: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Reclaim space from bloated base64 caches and retry once
    reclaimLocalStorageSpace(key);
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      // As a final step for critical lightweight keys (users, settings, active user), clear heavy offline mirror caches
      const isCriticalSmallKey =
        key === KEYS.USERS ||
        key === KEYS.SETTINGS ||
        key === KEYS.ACTIVE_USER ||
        key === KEYS.CLUSTERS ||
        key === KEYS.BENEFITS ||
        key === KEYS.IS_INITIALIZED;
      if (isCriticalSmallKey) {
        try {
          localStorage.removeItem(KEYS.MEMBERS);
          localStorage.removeItem(KEYS.PAYMENTS);
          localStorage.removeItem(KEYS.CLAIMS);
          localStorage.setItem(key, value);
          return true;
        } catch (finalErr) {
          console.warn(`Storage quota exceeded for ${key}, continuing in memory/cloud mode:`, finalErr);
          return false;
        }
      }
      console.warn(`Storage quota exceeded for ${key}, continuing in memory/cloud mode:`, retryErr);
      return false;
    }
  }
};

export const safeRemoveItem = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Unable to remove localStorage key ${key}:`, err);
  }
};

export const getStoredBenefits = (): BenefitMaster[] => {
  try {
    const data = localStorage.getItem(KEYS.BENEFITS);
    if (!data) {
      safeSetItem(KEYS.BENEFITS, JSON.stringify(DEFAULT_BENEFITS));
      return DEFAULT_BENEFITS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Pastikan santunan pasangan dan anak yang telah dihapus tidak muncul kembali dari cache lama
      const cleaned = parsed.filter(
        (b: BenefitMaster) =>
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
      if (cleaned.length !== parsed.length) {
        safeSetItem(KEYS.BENEFITS, JSON.stringify(cleaned));
      }
      return cleaned.length > 0 ? cleaned : DEFAULT_BENEFITS;
    }
    return DEFAULT_BENEFITS;
  } catch (e) {
    console.error('Error reading benefits:', e);
    return DEFAULT_BENEFITS;
  }
};

export const saveStoredBenefits = (benefits: BenefitMaster[]) => {
  safeSetItem(KEYS.BENEFITS, JSON.stringify(benefits));
};

export const getStoredClusters = (): ClusterMaster[] => {
  try {
    const data = localStorage.getItem(KEYS.CLUSTERS);
    if (!data) {
      safeSetItem(KEYS.CLUSTERS, JSON.stringify(DEFAULT_CLUSTERS));
      return DEFAULT_CLUSTERS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let migrated = false;
      const normalized = parsed.map((c) => {
        if (c.name === 'Cluster Ranah Minang' || c.name === 'Cluster Tanah Minang') {
          migrated = true;
          return {
            ...c,
            name: 'Cluster Ranah Melayu',
            code: c.code || 'RNM',
            rtNumber: c.rtNumber || 'RT 02',
            leaderName: c.leaderName || 'Pak Rully',
            leaderEmail: c.leaderEmail ? c.leaderEmail.replace('ranahminang', 'ranahmelayu') : 'rt.ranahmelayu@danakematian.org',
          };
        }
        if (c.name === 'Cluster Pasundan RT 02') {
          migrated = true;
          return {
            ...c,
            name: 'Cluster Pasundan RT 05',
            rtNumber: 'RT 05',
            code: 'PSD-02',
            leaderName: c.leaderName || 'Pak Anin',
          };
        }
        if (c.name === 'Cluster Pasundan RT 03') {
          migrated = true;
          return {
            ...c,
            name: 'Cluster Pasundan RT 06',
            rtNumber: 'RT 06',
            code: 'PSD-06',
            leaderName: c.leaderName || 'Pak Arifin',
          };
        }
        return c;
      });
      if (migrated) {
        safeSetItem(KEYS.CLUSTERS, JSON.stringify(normalized));
      }

      // Sync leader phone and name with stored users if available
      try {
        const storedUsersStr = localStorage.getItem(KEYS.USERS);
        if (storedUsersStr) {
          const parsedUsers = JSON.parse(storedUsersStr);
          if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
            return syncRtUsersToClusters(normalized, parsedUsers);
          }
        }
      } catch {
        // ignore parse error and proceed with normalized clusters
      }

      return normalized;
    }
    return DEFAULT_CLUSTERS;
  } catch (e) {
    console.error('Error reading clusters:', e);
    return DEFAULT_CLUSTERS;
  }
};

export const saveStoredClusters = (clusters: ClusterMaster[]) => {
  safeSetItem(KEYS.CLUSTERS, JSON.stringify(clusters));
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

    // Auto migrate old cluster names in users
    users = users.map((u) => {
      if (!u) return u;
      let cluster = u.cluster;
      if (cluster === 'Cluster Tanah Minang' || cluster === 'Cluster Ranah Minang') {
        cluster = 'Cluster Ranah Melayu';
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
    safeSetItem(KEYS.USERS, JSON.stringify(synced));
    return synced;
  } catch (e) {
    console.error('Error reading users:', e);
    return initialUsers;
  }
};

/**
 * Matches a ClusterMaster to its corresponding Ketua RT user from Master Pengguna (users).
 * Resolves by user ID, cluster name, leader email, or cluster code/alias.
 */
export const getRtUserForCluster = (
  cluster: ClusterMaster,
  users: AppUser[] = []
): AppUser | undefined => {
  if (!cluster || !Array.isArray(users) || users.length === 0) return undefined;

  const clusterIdToDefaultUserId: Record<string, string> = {
    'cls-1': 'usr-3',
    'cls-2': 'usr-4',
    'cls-3': 'usr-5',
    'cls-4': 'usr-5b',
    'cls-5': 'usr-5c',
    'cls-6': 'usr-6',
  };

  const defaultUserId = clusterIdToDefaultUserId[cluster.id] || `usr-rt-${cluster.id}`;

  // 1. Direct ID match
  let matched = users.find(
    (u) =>
      u &&
      u.authority === 'Ketua RT (Cluster)' &&
      (u.id === defaultUserId || u.id === `usr-rt-${cluster.id}` || (cluster.id && u.id.includes(cluster.id)))
  );
  if (matched) return matched;

  // 2. Exact cluster name match
  if (cluster.name) {
    const cName = cluster.name.trim().toLowerCase();
    matched = users.find(
      (u) =>
        u &&
        u.authority === 'Ketua RT (Cluster)' &&
        u.cluster &&
        u.cluster.trim().toLowerCase() === cName
    );
    if (matched) return matched;
  }

  // 3. Email match
  if (cluster.leaderEmail) {
    const cEmail = cluster.leaderEmail.trim().toLowerCase();
    matched = users.find(
      (u) =>
        u &&
        u.authority === 'Ketua RT (Cluster)' &&
        u.email &&
        u.email.trim().toLowerCase() === cEmail
    );
    if (matched) return matched;
  }

  // 4. Loose / code / alias match
  matched = users.find((u) => {
    if (!u || u.authority !== 'Ketua RT (Cluster)' || !u.cluster) return false;
    const uCluster = u.cluster.trim().toLowerCase();
    const cName = (cluster.name || '').trim().toLowerCase();
    if (cluster.code && uCluster.includes(cluster.code.trim().toLowerCase())) return true;
    if (cluster.id === 'cls-4' && (uCluster.includes('pasundan rt 05') || uCluster.includes('pasundan rt 02'))) return true;
    if (cluster.id === 'cls-5' && (uCluster.includes('pasundan rt 06') || uCluster.includes('pasundan rt 03'))) return true;
    if (cName && (cName.includes(uCluster) || uCluster.includes(cName))) return true;
    return false;
  });

  return matched;
};

/**
 * Synchronizes ClusterMaster data with the latest phone, name, and email from Ketua RT users in Master Pengguna.
 */
export const syncRtUsersToClusters = (
  clusters: ClusterMaster[] = [],
  users: AppUser[] = []
): ClusterMaster[] => {
  if (!Array.isArray(clusters) || clusters.length === 0) return clusters;
  if (!Array.isArray(users) || users.length === 0) return clusters;

  return clusters.map((cls) => {
    const rtUser = getRtUserForCluster(cls, users);
    if (!rtUser) return cls;

    return {
      ...cls,
      leaderPhone: rtUser.phone?.trim() || cls.leaderPhone,
      leaderName: rtUser.name?.trim() || cls.leaderName,
      leaderEmail: rtUser.email?.trim() || cls.leaderEmail,
    };
  });
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

    // Find existing Ketua RT user for this cluster using helper
    const existingUser = getRtUserForCluster(cls, usersList);
    const existingIndex = existingUser ? usersList.findIndex((u) => u.id === existingUser.id) : -1;

    if (existingIndex !== -1) {
      const current = usersList[existingIndex];
      usersList[existingIndex] = {
        ...current,
        name: current.name?.trim() ? current.name : defaultName,
        email: current.email?.trim() ? current.email : defaultEmail,
        phone: current.phone?.trim() ? current.phone : defaultPhone,
        cluster: current.cluster?.trim() ? current.cluster : cls.name,
        status: current.status || (cls.isActive ? 'Aktif' : 'Non-Aktif'),
        notes: current.notes || `Ketua RT resmi wilayah ${cls.name} (${cls.rtNumber || 'RT'}). Sinkron dengan Master Cluster.`,
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
  if (!Array.isArray(existingUsers)) return [];

  // Filter out any 'Anggota' user accounts whose registration was deleted
  const validMemberIds = new Set(members.filter(Boolean).map((m) => m.id));
  const validMemberNumbers = new Set(members.filter(Boolean).map((m) => m.memberNumber));
  const validEmails = new Set(members.filter(Boolean).map((m) => m.email?.toLowerCase()).filter(Boolean) as string[]);

  const usersList = existingUsers.filter((u) => {
    if (!u) return false;
    // Core staff/admin users are always preserved
    if (u.authority !== 'Anggota') return true;
    // Check if member registration still exists
    if (u.memberId && validMemberIds.has(u.memberId)) return true;
    if (u.memberNumber && validMemberNumbers.has(u.memberNumber)) return true;
    if (u.email && validEmails.has(u.email.toLowerCase())) return true;
    return false;
  });

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
      const current = usersList[existingIndex];
      usersList[existingIndex] = {
        ...current,
        name: current.name?.trim() ? current.name : m.name,
        email: current.email?.trim() ? current.email : (m.email ? m.email.toLowerCase() : current.email),
        password: current.password || m.password,
        memberId: m.id,
        memberNumber: m.memberNumber,
        cluster: current.cluster || m.cluster,
        phone: current.phone || m.phone,
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
  safeSetItem(KEYS.USERS, JSON.stringify(users));
};

export const getStoredActiveUser = (): AppUser | null => {
  try {
    const data = localStorage.getItem(KEYS.ACTIVE_USER);
    // On first device access or after logout, user is a guest (null)
    if (!data || data === 'guest' || data === 'null') {
      return null;
    }
    const user: AppUser = JSON.parse(data);
    if (!user || !user.id) {
      return null;
    }
    if (user.cluster === 'Cluster Tanah Minang' || user.cluster === 'Cluster Ranah Minang') {
      user.cluster = 'Cluster Ranah Melayu';
      safeSetItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    } else if (user.cluster === 'Cluster Pasundan' || user.cluster === 'Cluster Pasundan RT 02') {
      user.cluster = 'Cluster Pasundan RT 05';
      safeSetItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    } else if (user.cluster === 'Cluster Pasundan RT 03') {
      user.cluster = 'Cluster Pasundan RT 06';
      safeSetItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    }
    return user;
  } catch (e) {
    return null;
  }
};

export const saveStoredActiveUser = (user: AppUser | null) => {
  if (user) {
    safeSetItem(KEYS.ACTIVE_USER, JSON.stringify(user));
  } else {
    safeRemoveItem(KEYS.ACTIVE_USER);
  }
};

export const clearStoredActiveUser = () => {
  safeRemoveItem(KEYS.ACTIVE_USER);
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
      safeSetItem(KEYS.IS_INITIALIZED, 'true');
      safeSetItem(KEYS.MEMBERS, JSON.stringify(initialMembers.map(compactMemberForLocalCache)));
      return initialMembers;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    let migrated = false;
    const migratedMembers = parsed.map((m: Member) => {
      if (!m) return m;
      let cluster = m.cluster;
      if (cluster === 'Cluster Tanah Minang' || cluster === 'Cluster Ranah Minang' || cluster === 'Ranah Minang' || cluster === 'Tanah Minang') {
        cluster = 'Cluster Ranah Melayu';
        migrated = true;
      } else if (cluster === 'Cluster Pasundan RT 02') {
        cluster = 'Cluster Pasundan RT 05';
        migrated = true;
      } else if (cluster === 'Cluster Pasundan RT 03') {
        cluster = 'Cluster Pasundan RT 06';
        migrated = true;
      } else if (cluster === 'Cluster Pasundan') {
        const addr = (m.address || '').toLowerCase();
        if (addr.includes('rt 05') || addr.includes('rt 5') || addr.includes('rt 02') || addr.includes('rt 2') || addr.includes('blok p-02') || addr.includes('blok p (no. 26')) {
          cluster = 'Cluster Pasundan RT 05';
        } else if (addr.includes('rt 06') || addr.includes('rt 6') || addr.includes('rt 03') || addr.includes('rt 3') || addr.includes('blok p-03') || addr.includes('blok p (no. 51')) {
          cluster = 'Cluster Pasundan RT 06';
        } else {
          cluster = 'Cluster Pasundan RT 01';
        }
        migrated = true;
      }
      if (
        m.status === 'Menunggu Persetujuan Ketua Paguyuban' &&
        !m.approvedByPaguyuban &&
        !m.approvedByPaguyubanAt &&
        m.isPaguyubanApproved === true
      ) {
        migrated = true;
        return { ...m, cluster, isPaguyubanApproved: false, isKtaIssued: false };
      }
      return { ...m, cluster };
    });

    if (migrated) {
      safeSetItem(KEYS.MEMBERS, JSON.stringify(migratedMembers.map(compactMemberForLocalCache)));
    }

    return migratedMembers;
  } catch (e) {
    console.error('Error reading members:', e);
    return [];
  }
};

export const saveMembers = (members: Member[]) => {
  safeSetItem(KEYS.IS_INITIALIZED, 'true');
  // Strip heavy base64 images from localStorage mirror so browser 5MB quota is never exhausted;
  // Cloud Firestore and in-memory state retain the full-resolution attachments.
  const compactMembers = (members || []).map(compactMemberForLocalCache);
  safeSetItem(KEYS.MEMBERS, JSON.stringify(compactMembers));
};

export const getStoredPayments = (): Payment[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const isTxCleared = localStorage.getItem('dana_kematian_tx_cleared_v1') === 'true';
    const data = localStorage.getItem(KEYS.PAYMENTS);
    if (data === null) {
      if (isCleared || isTxCleared) {
        return [];
      }
      const isInit = localStorage.getItem(KEYS.IS_INITIALIZED);
      if (isInit) {
        return [];
      }
      safeSetItem(KEYS.PAYMENTS, JSON.stringify(initialPayments.map(compactPaymentForLocalCache)));
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
  safeSetItem(KEYS.IS_INITIALIZED, 'true');
  // Strip heavy base64 transfer proof images from localStorage mirror; Cloud Firestore holds the full proofs.
  const compactPayments = (payments || []).map(compactPaymentForLocalCache);
  safeSetItem(KEYS.PAYMENTS, JSON.stringify(compactPayments));
};

export const getStoredClaims = (): BenefitClaim[] => {
  try {
    const data = localStorage.getItem(KEYS.CLAIMS);
    if (!data) {
      safeSetItem(KEYS.CLAIMS, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Filter out demo claims ('claim-1', 'claim-2', 'claim-3') to ensure realization demo data is clean
      const cleaned = parsed.filter((c: BenefitClaim) => c && c.id !== 'claim-1' && c.id !== 'claim-2' && c.id !== 'claim-3');
      if (cleaned.length !== parsed.length) {
        safeSetItem(KEYS.CLAIMS, JSON.stringify(cleaned.map(compactClaimForLocalCache)));
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
  safeSetItem(KEYS.CLAIMS, JSON.stringify([]));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('adk_claims_updated', { detail: [] }));
  }
};

export const saveClaims = (claims: BenefitClaim[]) => {
  safeSetItem(KEYS.IS_INITIALIZED, 'true');
  safeSetItem(KEYS.CLAIMS, JSON.stringify((claims || []).map(compactClaimForLocalCache)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('adk_claims_updated', { detail: claims }));
  }
};

export const getStoredAmbulanceOrders = (): AmbulanceOrder[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const data = localStorage.getItem(KEYS.AMBULANCE_ORDERS);
    if (data === null) {
      if (isCleared) return [];
      safeSetItem(KEYS.AMBULANCE_ORDERS, JSON.stringify(sampleInitialAmbulanceOrders));
      return sampleInitialAmbulanceOrders;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading ambulance orders:', e);
    return [];
  }
};

export const saveAmbulanceOrders = (orders: AmbulanceOrder[]) => {
  safeSetItem(KEYS.AMBULANCE_ORDERS, JSON.stringify(orders));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('adk_ambulance_orders_updated', { detail: orders }));
  }
};

export const getStoredFuneralSchedules = (): FuneralSchedule[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const data = localStorage.getItem(KEYS.FUNERAL_SCHEDULES);
    if (data === null) {
      if (isCleared) return [];
      safeSetItem(KEYS.FUNERAL_SCHEDULES, JSON.stringify(sampleInitialFuneralSchedules));
      return sampleInitialFuneralSchedules;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading funeral schedules:', e);
    return [];
  }
};

export const saveFuneralSchedules = (schedules: FuneralSchedule[]) => {
  safeSetItem(KEYS.FUNERAL_SCHEDULES, JSON.stringify(schedules));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('adk_funeral_schedules_updated', { detail: schedules }));
  }
};

export const getStoredFuneralInventory = (): FuneralInventoryItem[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const data = localStorage.getItem(KEYS.FUNERAL_INVENTORY);
    if (data === null) {
      if (isCleared) return [];
      safeSetItem(KEYS.FUNERAL_INVENTORY, JSON.stringify(sampleInitialInventoryItems));
      return sampleInitialInventoryItems;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading funeral inventory items:', e);
    return [];
  }
};

export const saveFuneralInventory = (items: FuneralInventoryItem[]) => {
  safeSetItem(KEYS.FUNERAL_INVENTORY, JSON.stringify(items));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('adk_funeral_inventory_updated', { detail: items }));
  }
};

export const getStoredFuneralInventoryLoans = (): FuneralInventoryLoan[] => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const data = localStorage.getItem(KEYS.FUNERAL_INVENTORY_LOANS);
    if (data === null) {
      if (isCleared) return [];
      safeSetItem(KEYS.FUNERAL_INVENTORY_LOANS, JSON.stringify(sampleInitialInventoryLoans));
      return sampleInitialInventoryLoans;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading funeral inventory loans:', e);
    return [];
  }
};

export const saveFuneralInventoryLoans = (loans: FuneralInventoryLoan[]) => {
  safeSetItem(KEYS.FUNERAL_INVENTORY_LOANS, JSON.stringify(loans));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('adk_funeral_inventory_loans_updated', { detail: loans }));
  }
};

export const getStoredSettings = (): SystemSettings => {
  try {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (data === null) {
      safeSetItem(KEYS.SETTINGS, JSON.stringify(initialSettings));
      return initialSettings;
    }
    const parsed = JSON.parse(data);
    if (!parsed.logoUrl) {
      parsed.logoUrl = '/app-icon.svg';
    }
    const cleanedBanks = Array.isArray(parsed.bankAccounts)
      ? parsed.bankAccounts.filter(
          (b: any) => b && ((b.bankName && b.bankName.trim()) || (b.accountNumber && b.accountNumber.trim()))
        )
      : initialSettings.bankAccounts;

    return {
      ...initialSettings,
      ...parsed,
      bankAccounts: cleanedBanks.length > 0 ? cleanedBanks : initialSettings.bankAccounts,
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
  const cleanedSettings: SystemSettings = {
    ...settings,
    bankAccounts: (settings.bankAccounts || []).filter(
      (b) => b && ((b.bankName && b.bankName.trim()) || (b.accountNumber && b.accountNumber.trim()))
    ),
  };
  if (!safeSetItem(KEYS.SETTINGS, JSON.stringify(cleanedSettings))) {
    // Fallback without large base64 logo/signature if storage is extremely tight
    const compactSettings: SystemSettings = {
      ...cleanedSettings,
      logoUrl: isLargeDataUrl(cleanedSettings.logoUrl, 64000) ? '' : cleanedSettings.logoUrl,
      defaultAdminSignature: isLargeDataUrl(cleanedSettings.defaultAdminSignature, 64000)
        ? ''
        : cleanedSettings.defaultAdminSignature,
    };
    safeSetItem(KEYS.SETTINGS, JSON.stringify(compactSettings));
  }
};

export const getBaseBalance = (): number => {
  try {
    const isCleared = localStorage.getItem(KEYS.DEMO_CLEARED) === 'true';
    const isTxCleared = localStorage.getItem('dana_kematian_tx_cleared_v1') === 'true';
    if (isCleared || isTxCleared) {
      return 0;
    }
    const val = localStorage.getItem(KEYS.BASE_BALANCE);
    return val !== null ? parseFloat(val) : INITIAL_BASE_FUND_BALANCE;
  } catch (e) {
    return INITIAL_BASE_FUND_BALANCE;
  }
};

export const saveBaseBalance = (balance: number) => {
  safeSetItem(KEYS.BASE_BALANCE, balance.toString());
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
      safeSetItem(KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
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
  safeSetItem(KEYS.NOTIFICATIONS, JSON.stringify((notifications || []).slice(0, 120)));
};

export const resetToDefaultData = () => {
  safeRemoveItem(KEYS.DEMO_CLEARED);
  safeSetItem(KEYS.IS_INITIALIZED, 'true');
  safeSetItem(KEYS.MEMBERS, JSON.stringify(sampleDemoMembers.map(compactMemberForLocalCache)));
  safeSetItem(KEYS.PAYMENTS, JSON.stringify(sampleDemoPayments.map(compactPaymentForLocalCache)));
  safeSetItem(KEYS.CLAIMS, JSON.stringify(sampleDemoClaims.map(compactClaimForLocalCache)));
  safeSetItem(KEYS.AMBULANCE_ORDERS, JSON.stringify(sampleInitialAmbulanceOrders));
  safeSetItem(KEYS.FUNERAL_SCHEDULES, JSON.stringify(sampleInitialFuneralSchedules));
  safeSetItem(KEYS.FUNERAL_INVENTORY, JSON.stringify(sampleInitialInventoryItems));
  safeSetItem(KEYS.FUNERAL_INVENTORY_LOANS, JSON.stringify(sampleInitialInventoryLoans));
  safeSetItem(KEYS.SETTINGS, JSON.stringify(initialSettings));
  safeSetItem(KEYS.CLUSTERS, JSON.stringify(DEFAULT_CLUSTERS));
  safeSetItem(KEYS.BENEFITS, JSON.stringify(DEFAULT_BENEFITS));
  safeSetItem(KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
  safeSetItem(KEYS.BASE_BALANCE, INITIAL_BASE_FUND_BALANCE.toString());
  safeSetItem(KEYS.USERS, JSON.stringify(initialUsers));
  safeSetItem(KEYS.ACTIVE_USER, JSON.stringify(initialUsers[0]));
};

export const clearTransactionsLocally = () => {
  safeSetItem(KEYS.PAYMENTS, JSON.stringify([]));
  safeSetItem(KEYS.CLAIMS, JSON.stringify([]));
  safeSetItem(KEYS.BASE_BALANCE, '0');
  safeSetItem('dana_kematian_tx_cleared_v1', 'true');
};

export const clearAllDemoDataLocally = () => {
  safeSetItem(KEYS.IS_INITIALIZED, 'true');
  safeSetItem(KEYS.DEMO_CLEARED, 'true');
  safeSetItem(KEYS.MEMBERS, JSON.stringify([]));
  safeSetItem(KEYS.PAYMENTS, JSON.stringify([]));
  safeSetItem(KEYS.CLAIMS, JSON.stringify([]));
  safeSetItem(KEYS.AMBULANCE_ORDERS, JSON.stringify([]));
  safeSetItem(KEYS.FUNERAL_SCHEDULES, JSON.stringify([]));
  safeSetItem(KEYS.FUNERAL_INVENTORY, JSON.stringify([]));
  safeSetItem(KEYS.FUNERAL_INVENTORY_LOANS, JSON.stringify([]));
  safeSetItem(KEYS.NOTIFICATIONS, JSON.stringify([]));
  safeSetItem(KEYS.BASE_BALANCE, '0');
  const adminUsers = initialUsers.filter((u) => u.authority !== 'Anggota');
  safeSetItem(KEYS.USERS, JSON.stringify(adminUsers));
  safeSetItem(KEYS.ACTIVE_USER, JSON.stringify(adminUsers[0] || initialUsers[0]));
};

// Format Currency Utility IDR
export const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
};
