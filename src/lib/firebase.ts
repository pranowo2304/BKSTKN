import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Firestore,
} from 'firebase/firestore';

// Silence benign internal SDK connection/offline polling messages so they don't trigger error boundaries
setLogLevel('silent');
import firebaseConfig from '../../firebase-applet-config.json';
import { Member, Payment, BenefitClaim, SystemSettings, AppUser, ClusterMaster, DEFAULT_CLUSTERS, BenefitMaster, DEFAULT_BENEFITS } from '../types';
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

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance: ReturnType<typeof getAuth> | null = null;
try {
  authInstance = getAuth(app);
} catch (authInitErr) {
  console.warn('Firebase Auth initialization skipped or offline:', authInitErr);
}

export const auth = authInstance;

// Initialize Firestore with custom databaseId and standard WebChannel transport (forced long-polling to prevent proxy/iframe connection failures)
const customDbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  }, customDbId);
} catch {
  firestoreInstance = customDbId
    ? getFirestore(app, customDbId)
    : getFirestore(app);
}

export const db = firestoreInstance;

/**
 * Validates initial connection to Cloud Firestore as recommended by Firebase guidelines.
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Notice: Firestore operating in offline cache mode. Check network or permissions.');
    }
    return false;
  }
}

// Collection References
export const COLLECTIONS = {
  MEMBERS: 'members',
  PAYMENTS: 'payments',
  CLAIMS: 'claims',
  SETTINGS: 'settings',
  USERS: 'users',
  CLUSTERS: 'clusters',
  BENEFITS: 'benefits',
  META: 'meta',
} as const;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  let userId: string | null = null;
  let email: string | null = null;
  let emailVerified: boolean | null = null;
  let isAnonymous: boolean | null = null;
  let tenantId: string | null = null;
  let providerInfo: { providerId?: string | null; email?: string | null }[] = [];

  try {
    const user = auth?.currentUser;
    if (user) {
      userId = user.uid || null;
      email = user.email || null;
      emailVerified = user.emailVerified || null;
      isAnonymous = user.isAnonymous || null;
      tenantId = user.tenantId || null;
      providerInfo = user.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [];
    }
  } catch {
    // Auth access may fail in offline or constrained environments, ignore
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId,
      email,
      emailVerified,
      isAnonymous,
      tenantId,
      providerInfo,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Seed initial data to Firestore ONLY on the very first fresh project run.
 * Uses a persistent metadata flag so emptied/cleared databases will NEVER auto-restore demo data.
 */
export async function seedInitialFirestoreData(): Promise<void> {
  try {
    // If user has locally or globally cleared demo data or transactions, never re-populate!
    if (
      typeof window !== 'undefined' &&
      (localStorage.getItem('dana_kematian_demo_cleared_v1') === 'true' ||
        localStorage.getItem('dana_kematian_tx_cleared_v1') === 'true')
    ) {
      return;
    }

    const metaInitRef = doc(db, COLLECTIONS.META, 'init_status');
    const initSnap = await Promise.race([
      getDoc(metaInitRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]).catch((err) => {
      console.warn('Firestore initial check encountered offline or waiting connection:', err?.message);
      return null;
    });

    // If init record exists, respect its state
    if (initSnap && initSnap.exists()) {
      return;
    }

    // If initial check timed out or was null, do NOT re-seed blindly
    if (!initSnap) {
      return;
    }

    // Also check if any members already exist
    const membersSnap = await Promise.race([
      getDocs(collection(db, COLLECTIONS.MEMBERS)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]).catch(() => null);

    if (membersSnap && !membersSnap.empty) {
      await setDoc(metaInitRef, { initialized: true, initializedAt: new Date().toISOString() }).catch(() => {});
      return;
    }

    const batch = writeBatch(db);

    // 1. Initial Members
    initialMembers.forEach((m) => {
      const ref = doc(db, COLLECTIONS.MEMBERS, m.id);
      batch.set(ref, m);
    });

    // 2. Initial Payments
    initialPayments.forEach((p) => {
      const ref = doc(db, COLLECTIONS.PAYMENTS, p.id);
      batch.set(ref, p);
    });

    // 3. Initial Claims
    initialClaims.forEach((c) => {
      const ref = doc(db, COLLECTIONS.CLAIMS, c.id);
      batch.set(ref, c);
    });

    // 4. Initial Users
    initialUsers.forEach((u) => {
      const ref = doc(db, COLLECTIONS.USERS, u.id);
      batch.set(ref, u);
    });

    // 5. Initial Settings
    const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'main_config');
    batch.set(settingsRef, initialSettings);

    // 6. Initial Master Clusters
    DEFAULT_CLUSTERS.forEach((c) => {
      const ref = doc(db, COLLECTIONS.CLUSTERS, c.id);
      batch.set(ref, c);
    });

    // 7. Initial Master Benefits (Hak & Manfaat)
    DEFAULT_BENEFITS.forEach((b) => {
      const ref = doc(db, COLLECTIONS.BENEFITS, b.id);
      batch.set(ref, b);
    });

    // 8. Base Fund Balance
    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    batch.set(metaRef, { baseFundBalance: INITIAL_BASE_FUND_BALANCE });

    // 9. Mark database as permanently initialized
    batch.set(metaInitRef, { initialized: true, initializedAt: new Date().toISOString() });

    await batch.commit();
    console.log('Firebase Firestore successfully initialized with starting records.');
  } catch (error) {
    console.warn('Notice on seeding initial Firestore data (client operating with local cache fallback):', error);
  }
}

/**
 * Real-time subscribers for all paguyuban data collections
 */
export function subscribeToFirestore(callbacks: {
  onMembersChange?: (members: Member[]) => void;
  onPaymentsChange?: (payments: Payment[]) => void;
  onClaimsChange?: (claims: BenefitClaim[]) => void;
  onSettingsChange?: (settings: SystemSettings) => void;
  onUsersChange?: (users: AppUser[]) => void;
  onClustersChange?: (clusters: ClusterMaster[]) => void;
  onBenefitsChange?: (benefits: BenefitMaster[]) => void;
  onStatusChange?: (status: 'connected' | 'connecting' | 'offline' | 'error', errorMsg?: string) => void;
}): () => void {
  callbacks.onStatusChange?.('connecting');
  const unsubscribers: (() => void)[] = [];

  const handleListenerError = (err: any, collectionName: string) => {
    if (err?.code === 'permission-denied' || err?.message?.includes('insufficient permissions')) {
      handleFirestoreError(err, OperationType.GET, collectionName);
    } else if (err?.code === 'unavailable' || err?.message?.includes('unavailable') || err?.message?.includes('Could not reach')) {
      console.warn(`Firestore [${collectionName}] notice: Backend connection waiting or offline. Operating in offline cache mode.`);
      callbacks.onStatusChange?.('offline', err.message);
    } else {
      console.warn(`Firestore [${collectionName}] subscribe notice:`, err?.message || err);
      callbacks.onStatusChange?.('offline', err?.message);
    }
  };

  try {
    // 1. Members subscription
    const unsubMembers = onSnapshot(
      collection(db, COLLECTIONS.MEMBERS),
      (snapshot) => {
        const membersList: Member[] = [];
        snapshot.forEach((d) => {
          membersList.push({ ...d.data(), id: d.id } as Member);
        });
        callbacks.onMembersChange?.(membersList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.MEMBERS)
    );
    unsubscribers.push(unsubMembers);

    // 2. Payments subscription
    const unsubPayments = onSnapshot(
      collection(db, COLLECTIONS.PAYMENTS),
      (snapshot) => {
        const paymentsList: Payment[] = [];
        snapshot.forEach((d) => {
          paymentsList.push({ ...d.data(), id: d.id } as Payment);
        });
        callbacks.onPaymentsChange?.(paymentsList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.PAYMENTS)
    );
    unsubscribers.push(unsubPayments);

    // 3. Claims subscription
    const unsubClaims = onSnapshot(
      collection(db, COLLECTIONS.CLAIMS),
      (snapshot) => {
        const claimsList: BenefitClaim[] = [];
        snapshot.forEach((d) => {
          claimsList.push({ ...d.data(), id: d.id } as BenefitClaim);
        });
        callbacks.onClaimsChange?.(claimsList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.CLAIMS)
    );
    unsubscribers.push(unsubClaims);

    // 4. Settings subscription
    const unsubSettings = onSnapshot(
      doc(db, COLLECTIONS.SETTINGS, 'main_config'),
      (docSnap) => {
        if (docSnap.exists()) {
          callbacks.onSettingsChange?.(docSnap.data() as SystemSettings);
        }
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.SETTINGS)
    );
    unsubscribers.push(unsubSettings);

    // 5. Users subscription
    const unsubUsers = onSnapshot(
      collection(db, COLLECTIONS.USERS),
      (snapshot) => {
        const usersList: AppUser[] = [];
        snapshot.forEach((d) => {
          usersList.push({ ...d.data(), id: d.id } as AppUser);
        });
        if (usersList.length > 0) {
          callbacks.onUsersChange?.(usersList);
        }
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.USERS)
    );
    unsubscribers.push(unsubUsers);

    // 6. Clusters Master subscription
    const unsubClusters = onSnapshot(
      collection(db, COLLECTIONS.CLUSTERS),
      (snapshot) => {
        const clustersList: ClusterMaster[] = [];
        snapshot.forEach((d) => {
          clustersList.push({ ...d.data(), id: d.id } as ClusterMaster);
        });
        if (clustersList.length > 0) {
          clustersList.sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99));
          callbacks.onClustersChange?.(clustersList);
        }
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.CLUSTERS)
    );
    unsubscribers.push(unsubClusters);

    // 7. Benefits Master subscription (Hak & Manfaat)
    const unsubBenefits = onSnapshot(
      collection(db, COLLECTIONS.BENEFITS),
      (snapshot) => {
        const benefitsList: BenefitMaster[] = [];
        snapshot.forEach((d) => {
          benefitsList.push({ ...d.data(), id: d.id } as BenefitMaster);
        });
        if (benefitsList.length > 0) {
          benefitsList.sort((a, b) => (a.orderIndex || 99) - (b.orderIndex || 99));
          callbacks.onBenefitsChange?.(benefitsList);
        }
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.BENEFITS)
    );
    unsubscribers.push(unsubBenefits);
  } catch (e: any) {
    console.error('Failed to set up Firestore subscriptions:', e);
    callbacks.onStatusChange?.('error', e.message);
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

/**
 * Cloud CRUD Operations
 */
export async function syncBenefitToCloud(benefit: BenefitMaster): Promise<void> {
  const ref = doc(db, COLLECTIONS.BENEFITS, benefit.id);
  try {
    await setDoc(ref, benefit, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.BENEFITS}/${benefit.id}`);
    } else {
      console.warn(`Firestore syncBenefitToCloud notice for benefit ${benefit.id}:`, error?.message);
    }
  }
}

export async function syncBenefitsBatchToCloud(benefits: BenefitMaster[]): Promise<void> {
  const batch = writeBatch(db);
  benefits.forEach((b) => {
    const ref = doc(db, COLLECTIONS.BENEFITS, b.id);
    batch.set(ref, b, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.BENEFITS);
    } else {
      console.warn('Firestore syncBenefitsBatchToCloud notice:', error?.message);
    }
  }
}

export async function deleteBenefitFromCloud(benefitId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.BENEFITS, benefitId);
  try {
    await deleteDoc(ref);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.BENEFITS}/${benefitId}`);
    } else {
      console.warn(`Firestore deleteBenefitFromCloud notice for benefit ${benefitId}:`, error?.message);
    }
  }
}

export async function syncClusterToCloud(cluster: ClusterMaster): Promise<void> {
  const ref = doc(db, COLLECTIONS.CLUSTERS, cluster.id);
  try {
    await setDoc(ref, cluster, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.CLUSTERS}/${cluster.id}`);
    } else {
      console.warn(`Firestore syncClusterToCloud notice for cluster ${cluster.id}:`, error?.message);
    }
  }
}

export async function syncClustersBatchToCloud(clusters: ClusterMaster[]): Promise<void> {
  const batch = writeBatch(db);
  clusters.forEach((c) => {
    const ref = doc(db, COLLECTIONS.CLUSTERS, c.id);
    batch.set(ref, c, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.CLUSTERS);
    } else {
      console.warn('Firestore syncClustersBatchToCloud notice:', error?.message);
    }
  }
}

export async function deleteClusterFromCloud(clusterId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CLUSTERS, clusterId);
  try {
    await deleteDoc(ref);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.CLUSTERS}/${clusterId}`);
    } else {
      console.warn(`Firestore deleteClusterFromCloud notice for cluster ${clusterId}:`, error?.message);
    }
  }
}

export async function syncMemberToCloud(member: Member): Promise<void> {
  const ref = doc(db, COLLECTIONS.MEMBERS, member.id);
  try {
    await setDoc(ref, member, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.MEMBERS}/${member.id}`);
    } else {
      console.warn(`Firestore syncMemberToCloud notice for member ${member.id}:`, error?.message);
    }
  }
}

export async function syncMembersBatchToCloud(members: Member[]): Promise<void> {
  const batch = writeBatch(db);
  members.forEach((m) => {
    const ref = doc(db, COLLECTIONS.MEMBERS, m.id);
    batch.set(ref, m, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.MEMBERS);
    } else {
      console.warn('Firestore syncMembersBatchToCloud notice:', error?.message);
    }
  }
}

/**
 * Sanitizes object by removing undefined keys to prevent Firestore crashes:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeFirestoreData<T = any>(data: T): T {
  if (data === undefined || data === null) return null as any;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFirestoreData(item)) as any;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreData(value);
      }
    }
    return cleaned as any;
  }
  return data;
}

export async function syncPaymentToCloud(payment: Payment): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, payment.id);
  try {
    const sanitized = sanitizeFirestoreData(payment);
    await setDoc(ref, sanitized, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.PAYMENTS}/${payment.id}`);
    } else {
      console.warn(`Firestore syncPaymentToCloud notice for payment ${payment.id}:`, error?.message);
    }
  }
}

export async function syncClaimToCloud(claim: BenefitClaim): Promise<void> {
  const ref = doc(db, COLLECTIONS.CLAIMS, claim.id);
  try {
    const sanitized = sanitizeFirestoreData(claim);
    await setDoc(ref, sanitized, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.CLAIMS}/${claim.id}`);
    } else {
      console.warn(`Firestore syncClaimToCloud notice for claim ${claim.id}:`, error?.message);
    }
  }
}

export async function syncSettingsToCloud(settings: SystemSettings): Promise<void> {
  const ref = doc(db, COLLECTIONS.SETTINGS, 'main_config');
  try {
    await setDoc(ref, settings, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.SETTINGS}/main_config`);
    } else {
      console.warn('Firestore syncSettingsToCloud notice:', error?.message);
    }
  }
}

export async function syncUserToCloud(user: AppUser): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, user.id);
  try {
    await setDoc(ref, user, { merge: true });
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.USERS}/${user.id}`);
    } else {
      console.warn(`Firestore syncUserToCloud notice for user ${user.id}:`, error?.message);
    }
  }
}

export async function syncUsersBatchToCloud(users: AppUser[]): Promise<void> {
  const batch = writeBatch(db);
  users.forEach((u) => {
    const ref = doc(db, COLLECTIONS.USERS, u.id);
    batch.set(ref, u, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.USERS);
    } else {
      console.warn('Firestore syncUsersBatchToCloud notice:', error?.message);
    }
  }
}

/**
 * Delete single entity from Firestore
 */
export async function deleteMemberFromCloud(memberId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.MEMBERS, memberId);
  try {
    await deleteDoc(ref);

    // Also remove associated user account from Firestore
    try {
      const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
      const userBatch = writeBatch(db);
      let foundUser = false;
      usersSnap.forEach((uDoc) => {
        const uData = uDoc.data();
        if (
          uDoc.id === `usr-mem-${memberId}` ||
          uData.memberId === memberId
        ) {
          userBatch.delete(uDoc.ref);
          foundUser = true;
        }
      });
      if (foundUser) {
        await userBatch.commit();
      }
    } catch (userErr) {
      console.warn(`Notice while deleting user for member ${memberId}:`, userErr);
    }
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.MEMBERS}/${memberId}`);
    } else {
      console.warn(`Firestore deleteMemberFromCloud notice for member ${memberId}:`, error?.message);
    }
  }
}

export async function deletePaymentFromCloud(paymentId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  try {
    await deleteDoc(ref);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.PAYMENTS}/${paymentId}`);
    } else {
      console.warn(`Firestore deletePaymentFromCloud notice for payment ${paymentId}:`, error?.message);
    }
  }
}

export async function deleteClaimFromCloud(claimId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CLAIMS, claimId);
  try {
    await deleteDoc(ref);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.CLAIMS}/${claimId}`);
    } else {
      console.warn(`Firestore deleteClaimFromCloud notice for claim ${claimId}:`, error?.message);
    }
  }
}

export async function deleteUserFromCloud(userId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, userId);
  try {
    await deleteDoc(ref);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.USERS}/${userId}`);
    } else {
      console.warn(`Firestore deleteUserFromCloud notice for user ${userId}:`, error?.message);
    }
  }
}

/**
 * Clear all claims records from Firestore Cloud Database
 */
export async function clearAllClaimsFromCloud(): Promise<void> {
  try {
    const claimsSnap = await getDocs(collection(db, COLLECTIONS.CLAIMS));
    const batch = writeBatch(db);
    claimsSnap.forEach((docItem) => {
      batch.delete(docItem.ref);
    });
    await batch.commit();
    console.log('Successfully cleared all claims from Cloud Firestore.');
  } catch (error) {
    console.error('Error clearing claims from Firestore:', error);
    throw error;
  }
}

/**
 * Remove specific legacy demo claims (claim-1, claim-2, claim-3) from Firestore if they exist
 */
export async function cleanupDemoClaimsFromCloud(): Promise<void> {
  try {
    const demoIds = ['claim-1', 'claim-2', 'claim-3'];
    const batch = writeBatch(db);
    let hasDeletes = false;
    for (const id of demoIds) {
      const docRef = doc(db, COLLECTIONS.CLAIMS, id);
      const snap = await getDoc(docRef).catch(() => null);
      if (snap && snap.exists()) {
        batch.delete(docRef);
        hasDeletes = true;
      }
    }
    if (hasDeletes) {
      await batch.commit();
      console.log('Cleaned up legacy demo claims from Cloud Firestore.');
    }
  } catch (err) {
    console.warn('Notice cleaning up demo claims from Firestore:', err);
  }
}

/**
 * Clear all transaction records (Payments and Claims) from Firestore Cloud Database
 * Resets fund balance to Rp 0
 * Leaves Members, Users, Clusters, and Settings completely safe and intact
 */
export async function clearTransactionsFromCloud(): Promise<void> {
  try {
    // 1. Delete all payments in safe chunked batches
    const paymentsSnap = await getDocs(collection(db, COLLECTIONS.PAYMENTS));
    const paymentDocs = paymentsSnap.docs;
    for (let i = 0; i < paymentDocs.length; i += 400) {
      const batch = writeBatch(db);
      paymentDocs.slice(i, i + 400).forEach((docItem) => {
        batch.delete(docItem.ref);
      });
      await batch.commit();
    }

    // 2. Delete all claims in safe chunked batches
    const claimsSnap = await getDocs(collection(db, COLLECTIONS.CLAIMS));
    const claimDocs = claimsSnap.docs;
    for (let i = 0; i < claimDocs.length; i += 400) {
      const batch = writeBatch(db);
      claimDocs.slice(i, i + 400).forEach((docItem) => {
        batch.delete(docItem.ref);
      });
      await batch.commit();
    }

    // 3. Reset financials balance in meta
    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    await setDoc(metaRef, { baseFundBalance: 0 }, { merge: true });

    // 4. Update init_status so demo transactions will never auto-seed again
    const metaInitRef = doc(db, COLLECTIONS.META, 'init_status');
    await setDoc(
      metaInitRef,
      {
        initialized: true,
        transactionsCleared: true,
        transactionsClearedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 5. Local storage marker
    if (typeof window !== 'undefined') {
      localStorage.setItem('dana_kematian_tx_cleared_v1', 'true');
    }

    console.log('Successfully cleared all transactions (payments & claims) from Cloud Firestore.');
  } catch (error) {
    console.error('Error clearing transactions from Firestore:', error);
    throw error;
  }
}

/**
 * Clear all records (Members, Payments, Claims) from Firestore Cloud Database
 * Keeps core admin accounts and basic settings
 */
export async function clearAllDemoDataFromCloud(): Promise<void> {
  try {
    // 1. Delete all members
    const membersSnap = await getDocs(collection(db, COLLECTIONS.MEMBERS));
    const batch1 = writeBatch(db);
    membersSnap.forEach((docItem) => {
      batch1.delete(docItem.ref);
    });
    await batch1.commit();

    // 2. Delete all payments
    const paymentsSnap = await getDocs(collection(db, COLLECTIONS.PAYMENTS));
    const batch2 = writeBatch(db);
    paymentsSnap.forEach((docItem) => {
      batch2.delete(docItem.ref);
    });
    await batch2.commit();

    // 3. Delete all claims
    const claimsSnap = await getDocs(collection(db, COLLECTIONS.CLAIMS));
    const batch3 = writeBatch(db);
    claimsSnap.forEach((docItem) => {
      batch3.delete(docItem.ref);
    });
    await batch3.commit();

    // 4. Reset users collection to default admin/staff only (remove member accounts)
    const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    const batch4 = writeBatch(db);
    usersSnap.forEach((docItem) => {
      batch4.delete(docItem.ref);
    });
    // Re-seed only the initial non-member administrators
    const adminUsers = initialUsers.filter((u) => u.authority !== 'Anggota');
    adminUsers.forEach((u) => {
      const ref = doc(db, COLLECTIONS.USERS, u.id);
      batch4.set(ref, u);
    });
    await batch4.commit();

    // 5. Reset financials balance and update init_status flag
    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    await setDoc(metaRef, { baseFundBalance: 0 });

    const metaInitRef = doc(db, COLLECTIONS.META, 'init_status');
    await setDoc(metaInitRef, { initialized: true, isCleared: true, clearedAt: new Date().toISOString() });

    console.log('Successfully cleared all demo data from Cloud Firestore.');
  } catch (error) {
    console.error('Error clearing demo data from Firestore:', error);
    throw error;
  }
}

/**
 * Restore sample demo records back to Firestore Cloud Database
 */
export async function restoreDemoDataToCloud(): Promise<void> {
  try {
    const batch = writeBatch(db);

    sampleDemoMembers.forEach((m) => {
      const ref = doc(db, COLLECTIONS.MEMBERS, m.id);
      batch.set(ref, m);
    });

    sampleDemoPayments.forEach((p) => {
      const ref = doc(db, COLLECTIONS.PAYMENTS, p.id);
      batch.set(ref, p);
    });

    sampleDemoClaims.forEach((c) => {
      const ref = doc(db, COLLECTIONS.CLAIMS, c.id);
      batch.set(ref, c);
    });

    initialUsers.forEach((u) => {
      const ref = doc(db, COLLECTIONS.USERS, u.id);
      batch.set(ref, u);
    });

    DEFAULT_CLUSTERS.forEach((c) => {
      const ref = doc(db, COLLECTIONS.CLUSTERS, c.id);
      batch.set(ref, c);
    });

    DEFAULT_BENEFITS.forEach((b) => {
      const ref = doc(db, COLLECTIONS.BENEFITS, b.id);
      batch.set(ref, b);
    });

    const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'main_config');
    batch.set(settingsRef, initialSettings);

    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    batch.set(metaRef, { baseFundBalance: INITIAL_BASE_FUND_BALANCE });

    await batch.commit();
    console.log('Successfully restored demo data to Cloud Firestore.');
  } catch (error) {
    console.error('Error restoring demo data to Firestore:', error);
    throw error;
  }
}

