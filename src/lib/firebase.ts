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
import { Member, Payment, BenefitClaim, SystemSettings, AppUser, ClusterMaster, DEFAULT_CLUSTERS, BenefitMaster, DEFAULT_BENEFITS, AmbulanceOrder, FuneralSchedule, FuneralInventoryItem, FuneralInventoryLoan } from '../types';
import { recordFirebaseRead, recordFirebaseWrite } from './firebaseTelemetry';
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
  sampleInitialAmbulanceOrders,
  sampleInitialFuneralSchedules,
  sampleInitialInventoryItems,
  sampleInitialInventoryLoans,
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
    recordFirebaseRead('meta', 1);
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
  AMBULANCE_ORDERS: 'ambulance_orders',
  FUNERAL_SCHEDULES: 'funeral_schedules',
  FUNERAL_INVENTORY: 'funeral_inventory',
  FUNERAL_INVENTORY_LOANS: 'funeral_inventory_loans',
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

    if (initSnap) {
      recordFirebaseRead(COLLECTIONS.META, 1);
    }

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

    if (membersSnap) {
      recordFirebaseRead(COLLECTIONS.MEMBERS, Math.max(1, membersSnap.size));
    }

    if (membersSnap && !membersSnap.empty) {
      await setDoc(metaInitRef, { initialized: true, initializedAt: new Date().toISOString() }).catch(() => {});
      recordFirebaseWrite(COLLECTIONS.META, 1);
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
    recordFirebaseWrite(COLLECTIONS.MEMBERS, initialMembers.length);
    recordFirebaseWrite(COLLECTIONS.PAYMENTS, initialPayments.length);
    recordFirebaseWrite(COLLECTIONS.CLAIMS, initialClaims.length);
    recordFirebaseWrite(COLLECTIONS.USERS, initialUsers.length);
    recordFirebaseWrite(COLLECTIONS.SETTINGS, 1);
    recordFirebaseWrite(COLLECTIONS.CLUSTERS, DEFAULT_CLUSTERS.length);
    recordFirebaseWrite(COLLECTIONS.BENEFITS, DEFAULT_BENEFITS.length);
    recordFirebaseWrite(COLLECTIONS.META, 2);
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
  onAmbulanceOrdersChange?: (orders: AmbulanceOrder[]) => void;
  onFuneralSchedulesChange?: (schedules: FuneralSchedule[]) => void;
  onFuneralInventoryChange?: (items: FuneralInventoryItem[]) => void;
  onFuneralInventoryLoansChange?: (loans: FuneralInventoryLoan[]) => void;
  onSettingsChange?: (settings: SystemSettings) => void;
  onUsersChange?: (users: AppUser[]) => void;
  onClustersChange?: (clusters: ClusterMaster[]) => void;
  onBenefitsChange?: (benefits: BenefitMaster[]) => void;
  onFinancialsChange?: (baseFundBalance: number) => void;
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
    } else if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
      console.warn(`Firestore [${collectionName}] notice: Kuota harian pembacaan gratis Firestore (50.000 read/hari) telah tercapai. Sistem otomatis beralih ke Mode Lokal agar aplikasi tetap dapat digunakan.`);
      callbacks.onStatusChange?.('offline', 'Kuota harian gratis Firestore telah mencapai batas maksimal.');
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
        recordFirebaseRead(COLLECTIONS.MEMBERS, Math.max(1, snapshot.docChanges().length));
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
        recordFirebaseRead(COLLECTIONS.PAYMENTS, Math.max(1, snapshot.docChanges().length));
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
        recordFirebaseRead(COLLECTIONS.CLAIMS, Math.max(1, snapshot.docChanges().length));
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
        recordFirebaseRead(COLLECTIONS.SETTINGS, 1);
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
        recordFirebaseRead(COLLECTIONS.USERS, Math.max(1, snapshot.docChanges().length));
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
        recordFirebaseRead(COLLECTIONS.CLUSTERS, Math.max(1, snapshot.docChanges().length));
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
        recordFirebaseRead(COLLECTIONS.BENEFITS, Math.max(1, snapshot.docChanges().length));
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

    // 8. Meta / Financials (Base Fund Balance) subscription
    const unsubFinancials = onSnapshot(
      doc(db, COLLECTIONS.META, 'financials'),
      (docSnap) => {
        recordFirebaseRead(COLLECTIONS.META, 1);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const baseBalance = typeof data?.baseFundBalance === 'number' ? data.baseFundBalance : 0;
          callbacks.onFinancialsChange?.(baseBalance);
        } else {
          // Check init_status if transactions were cleared
          getDoc(doc(db, COLLECTIONS.META, 'init_status')).then((initSnap) => {
            recordFirebaseRead(COLLECTIONS.META, 1);
            if (initSnap && initSnap.exists() && (initSnap.data()?.transactionsCleared || initSnap.data()?.isCleared)) {
              callbacks.onFinancialsChange?.(0);
            }
          }).catch(() => {});
        }
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, `${COLLECTIONS.META}/financials`)
    );
    unsubscribers.push(unsubFinancials);

    // 9. Ambulance Orders subscription
    const unsubAmbulance = onSnapshot(
      collection(db, COLLECTIONS.AMBULANCE_ORDERS),
      (snapshot) => {
        recordFirebaseRead(COLLECTIONS.AMBULANCE_ORDERS, Math.max(1, snapshot.docChanges().length));
        const ordersList: AmbulanceOrder[] = [];
        snapshot.forEach((d) => {
          ordersList.push({ ...d.data(), id: d.id } as AmbulanceOrder);
        });
        callbacks.onAmbulanceOrdersChange?.(ordersList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.AMBULANCE_ORDERS)
    );
    unsubscribers.push(unsubAmbulance);

    // 10. Funeral Schedules subscription
    const unsubFuneral = onSnapshot(
      collection(db, COLLECTIONS.FUNERAL_SCHEDULES),
      (snapshot) => {
        recordFirebaseRead(COLLECTIONS.FUNERAL_SCHEDULES, Math.max(1, snapshot.docChanges().length));
        const schedList: FuneralSchedule[] = [];
        snapshot.forEach((d) => {
          schedList.push({ ...d.data(), id: d.id } as FuneralSchedule);
        });
        callbacks.onFuneralSchedulesChange?.(schedList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.FUNERAL_SCHEDULES)
    );
    unsubscribers.push(unsubFuneral);

    // 11. Funeral Inventory subscription
    const unsubInventory = onSnapshot(
      collection(db, COLLECTIONS.FUNERAL_INVENTORY),
      (snapshot) => {
        recordFirebaseRead(COLLECTIONS.FUNERAL_INVENTORY, Math.max(1, snapshot.docChanges().length));
        const itemList: FuneralInventoryItem[] = [];
        snapshot.forEach((d) => {
          itemList.push({ ...d.data(), id: d.id } as FuneralInventoryItem);
        });
        callbacks.onFuneralInventoryChange?.(itemList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.FUNERAL_INVENTORY)
    );
    unsubscribers.push(unsubInventory);

    // 12. Funeral Inventory Loans subscription
    const unsubInventoryLoans = onSnapshot(
      collection(db, COLLECTIONS.FUNERAL_INVENTORY_LOANS),
      (snapshot) => {
        recordFirebaseRead(COLLECTIONS.FUNERAL_INVENTORY_LOANS, Math.max(1, snapshot.docChanges().length));
        const loanList: FuneralInventoryLoan[] = [];
        snapshot.forEach((d) => {
          loanList.push({ ...d.data(), id: d.id } as FuneralInventoryLoan);
        });
        callbacks.onFuneralInventoryLoansChange?.(loanList);
        callbacks.onStatusChange?.('connected');
      },
      (err) => handleListenerError(err, COLLECTIONS.FUNERAL_INVENTORY_LOANS)
    );
    unsubscribers.push(unsubInventoryLoans);
  } catch (e: any) {
    console.error('Failed to set up Firestore subscriptions:', e);
    callbacks.onStatusChange?.('error', e.message);
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

export async function syncBaseFundBalanceToCloud(balance: number): Promise<void> {
  const metaRef = doc(db, COLLECTIONS.META, 'financials');
  try {
    await setDoc(metaRef, { baseFundBalance: balance }, { merge: true });
    recordFirebaseWrite(COLLECTIONS.META, 1);
  } catch (error: any) {
    console.warn('Firestore syncBaseFundBalanceToCloud notice:', error?.message);
  }
}

/**
 * Cloud CRUD Operations
 */
export async function syncBenefitToCloud(benefit: BenefitMaster): Promise<void> {
  const ref = doc(db, COLLECTIONS.BENEFITS, benefit.id);
  try {
    await setDoc(ref, benefit, { merge: true });
    recordFirebaseWrite(COLLECTIONS.BENEFITS, 1);
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
    recordFirebaseWrite(COLLECTIONS.BENEFITS, benefits.length);
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
    recordFirebaseWrite(COLLECTIONS.BENEFITS, 1, true);
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
    recordFirebaseWrite(COLLECTIONS.CLUSTERS, 1);
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
    recordFirebaseWrite(COLLECTIONS.CLUSTERS, clusters.length);
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
    recordFirebaseWrite(COLLECTIONS.CLUSTERS, 1, true);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.CLUSTERS}/${clusterId}`);
    } else {
      console.warn(`Firestore deleteClusterFromCloud notice for cluster ${clusterId}:`, error?.message);
    }
  }
}

export async function syncMemberToCloud(member: Member): Promise<boolean> {
  const ref = doc(db, COLLECTIONS.MEMBERS, member.id);
  try {
    const sanitized = sanitizeFirestoreData(member);
    let safeData = { ...sanitized };

    // Firestore 1MB document limit safeguard:
    // If familyCardPhotoUrl or photoUrl is a huge dataUrl, constrain it so document saves cleanly
    if (safeData.familyCardPhotoUrl && typeof safeData.familyCardPhotoUrl === 'string' && safeData.familyCardPhotoUrl.length > 500000) {
      safeData.familyCardPhotoUrl = safeData.familyCardPhotoUrl.slice(0, 300000);
    }
    if (safeData.photoUrl && typeof safeData.photoUrl === 'string' && safeData.photoUrl.length > 300000) {
      safeData.photoUrl = safeData.photoUrl.slice(0, 150000);
    }

    await setDoc(ref, safeData, { merge: true });
    recordFirebaseWrite(COLLECTIONS.MEMBERS, 1);
    return true;
  } catch (error: any) {
    console.warn(`Firestore syncMemberToCloud initial attempt notice for member ${member.id}:`, error?.message);
    try {
      // Robust fallback retry: compact large attachments if document exceeds size limit
      const sanitized = sanitizeFirestoreData(member);
      const strippedData = {
        ...sanitized,
        familyCardPhotoUrl: sanitized.familyCardPhotoUrl && typeof sanitized.familyCardPhotoUrl === 'string'
          ? sanitized.familyCardPhotoUrl.slice(0, 40000)
          : '',
        photoUrl: sanitized.photoUrl && typeof sanitized.photoUrl === 'string'
          ? sanitized.photoUrl.slice(0, 30000)
          : '',
      };
      await setDoc(ref, strippedData, { merge: true });
      recordFirebaseWrite(COLLECTIONS.MEMBERS, 1);
      return true;
    } catch (retryErr: any) {
      if (retryErr?.code === 'permission-denied' || retryErr?.message?.includes('insufficient permissions')) {
        handleFirestoreError(retryErr, OperationType.WRITE, `${COLLECTIONS.MEMBERS}/${member.id}`);
      } else {
        console.error(`Firestore syncMemberToCloud error for member ${member.id}:`, retryErr?.message);
      }
      return false;
    }
  }
}

export async function syncMembersBatchToCloud(members: Member[]): Promise<void> {
  const batch = writeBatch(db);
  members.forEach((m) => {
    const ref = doc(db, COLLECTIONS.MEMBERS, m.id);
    const sanitized = sanitizeFirestoreData(m);
    let safeData = { ...sanitized };
    if (safeData.familyCardPhotoUrl && typeof safeData.familyCardPhotoUrl === 'string' && safeData.familyCardPhotoUrl.length > 500000) {
      safeData.familyCardPhotoUrl = safeData.familyCardPhotoUrl.slice(0, 300000);
    }
    if (safeData.photoUrl && typeof safeData.photoUrl === 'string' && safeData.photoUrl.length > 300000) {
      safeData.photoUrl = safeData.photoUrl.slice(0, 150000);
    }
    batch.set(ref, safeData, { merge: true });
  });
  try {
    await batch.commit();
    recordFirebaseWrite(COLLECTIONS.MEMBERS, members.length);
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
    recordFirebaseWrite(COLLECTIONS.PAYMENTS, 1);
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
    recordFirebaseWrite(COLLECTIONS.CLAIMS, 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.CLAIMS}/${claim.id}`);
    } else {
      console.warn(`Firestore syncClaimToCloud notice for claim ${claim.id}:`, error?.message);
    }
  }
}

export async function syncAmbulanceOrderToCloud(order: AmbulanceOrder): Promise<void> {
  const ref = doc(db, COLLECTIONS.AMBULANCE_ORDERS, order.id);
  try {
    const sanitized = sanitizeFirestoreData(order);
    await setDoc(ref, sanitized, { merge: true });
    recordFirebaseWrite(COLLECTIONS.AMBULANCE_ORDERS, 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.AMBULANCE_ORDERS}/${order.id}`);
    } else {
      console.warn(`Firestore syncAmbulanceOrderToCloud notice for ambulance order ${order.id}:`, error?.message);
    }
  }
}

export async function syncFuneralScheduleToCloud(schedule: FuneralSchedule): Promise<void> {
  const ref = doc(db, COLLECTIONS.FUNERAL_SCHEDULES, schedule.id);
  try {
    const sanitized = sanitizeFirestoreData(schedule);
    await setDoc(ref, sanitized, { merge: true });
    recordFirebaseWrite(COLLECTIONS.FUNERAL_SCHEDULES, 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.FUNERAL_SCHEDULES}/${schedule.id}`);
    } else {
      console.warn(`Firestore syncFuneralScheduleToCloud notice for funeral schedule ${schedule.id}:`, error?.message);
    }
  }
}

export async function syncFuneralInventoryItemToCloud(item: FuneralInventoryItem): Promise<void> {
  const ref = doc(db, COLLECTIONS.FUNERAL_INVENTORY, item.id);
  try {
    const sanitized = sanitizeFirestoreData(item);
    await setDoc(ref, sanitized, { merge: true });
    recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY, 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.FUNERAL_INVENTORY}/${item.id}`);
    } else {
      console.warn(`Firestore syncFuneralInventoryItemToCloud notice for item ${item.id}:`, error?.message);
    }
  }
}

export async function syncFuneralInventoryLoanToCloud(loan: FuneralInventoryLoan): Promise<void> {
  const ref = doc(db, COLLECTIONS.FUNERAL_INVENTORY_LOANS, loan.id);
  try {
    const sanitized = sanitizeFirestoreData(loan);
    await setDoc(ref, sanitized, { merge: true });
    recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY_LOANS, 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.FUNERAL_INVENTORY_LOANS}/${loan.id}`);
    } else {
      console.warn(`Firestore syncFuneralInventoryLoanToCloud notice for loan ${loan.id}:`, error?.message);
    }
  }
}

export async function syncSettingsToCloud(settings: SystemSettings): Promise<void> {
  const ref = doc(db, COLLECTIONS.SETTINGS, 'main_config');
  try {
    const cleanedSettings: SystemSettings = {
      ...settings,
      bankAccounts: (settings.bankAccounts || []).filter(
        (b) => b && ((b.bankName && b.bankName.trim()) || (b.accountNumber && b.accountNumber.trim()))
      ),
    };
    await setDoc(ref, cleanedSettings, { merge: true });
    recordFirebaseWrite(COLLECTIONS.SETTINGS, 1);
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
    const sanitized = sanitizeFirestoreData(user);
    await setDoc(ref, sanitized, { merge: true });
    recordFirebaseWrite(COLLECTIONS.USERS, 1);
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
    const sanitized = sanitizeFirestoreData(u);
    batch.set(ref, sanitized, { merge: true });
  });
  try {
    await batch.commit();
    recordFirebaseWrite(COLLECTIONS.USERS, users.length);
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
    recordFirebaseWrite(COLLECTIONS.MEMBERS, 1, true);

    // Also remove associated user account from Firestore
    try {
      const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
      recordFirebaseRead(COLLECTIONS.USERS, Math.max(1, usersSnap.size));
      const userBatch = writeBatch(db);
      let deletedCount = 0;
      usersSnap.forEach((uDoc) => {
        const uData = uDoc.data();
        if (
          uDoc.id === `usr-mem-${memberId}` ||
          uData.memberId === memberId
        ) {
          userBatch.delete(uDoc.ref);
          deletedCount++;
        }
      });
      if (deletedCount > 0) {
        await userBatch.commit();
        recordFirebaseWrite(COLLECTIONS.USERS, deletedCount, true);
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
    recordFirebaseWrite(COLLECTIONS.PAYMENTS, 1, true);
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
    recordFirebaseWrite(COLLECTIONS.CLAIMS, 1, true);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.CLAIMS}/${claimId}`);
    } else {
      console.warn(`Firestore deleteClaimFromCloud notice for claim ${claimId}:`, error?.message);
    }
  }
}

export async function deleteAmbulanceOrderFromCloud(orderId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.AMBULANCE_ORDERS, orderId);
  try {
    await deleteDoc(ref);
    recordFirebaseWrite(COLLECTIONS.AMBULANCE_ORDERS, 1, true);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.AMBULANCE_ORDERS}/${orderId}`);
    } else {
      console.warn(`Firestore deleteAmbulanceOrderFromCloud notice for ambulance order ${orderId}:`, error?.message);
    }
  }
}

export async function clearAllAmbulanceOrdersFromCloud(): Promise<void> {
  try {
    const ordersSnap = await getDocs(collection(db, COLLECTIONS.AMBULANCE_ORDERS));
    recordFirebaseRead(COLLECTIONS.AMBULANCE_ORDERS, Math.max(1, ordersSnap.size));
    const batch = writeBatch(db);
    ordersSnap.forEach((docItem) => {
      batch.delete(docItem.ref);
    });
    await batch.commit();
    if (ordersSnap.size > 0) {
      recordFirebaseWrite(COLLECTIONS.AMBULANCE_ORDERS, ordersSnap.size, true);
    }
    console.log('Successfully cleared all ambulance orders from Cloud Firestore.');
  } catch (error) {
    console.error('Error clearing ambulance orders from Firestore:', error);
    throw error;
  }
}

export async function deleteFuneralScheduleFromCloud(scheduleId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.FUNERAL_SCHEDULES, scheduleId);
  try {
    await deleteDoc(ref);
    recordFirebaseWrite(COLLECTIONS.FUNERAL_SCHEDULES, 1, true);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.FUNERAL_SCHEDULES}/${scheduleId}`);
    } else {
      console.warn(`Firestore deleteFuneralScheduleFromCloud notice for funeral schedule ${scheduleId}:`, error?.message);
    }
  }
}

export async function clearAllFuneralSchedulesFromCloud(): Promise<void> {
  try {
    const schedSnap = await getDocs(collection(db, COLLECTIONS.FUNERAL_SCHEDULES));
    recordFirebaseRead(COLLECTIONS.FUNERAL_SCHEDULES, Math.max(1, schedSnap.size));
    const batch = writeBatch(db);
    schedSnap.forEach((docItem) => {
      batch.delete(docItem.ref);
    });
    await batch.commit();
    if (schedSnap.size > 0) {
      recordFirebaseWrite(COLLECTIONS.FUNERAL_SCHEDULES, schedSnap.size, true);
    }
    console.log('Successfully cleared all funeral schedules from Cloud Firestore.');
  } catch (error) {
    console.error('Error clearing funeral schedules from Firestore:', error);
    throw error;
  }
}

export async function deleteFuneralInventoryItemFromCloud(itemId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.FUNERAL_INVENTORY, itemId);
  try {
    await deleteDoc(ref);
    recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY, 1, true);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.FUNERAL_INVENTORY}/${itemId}`);
    } else {
      console.warn(`Firestore deleteFuneralInventoryItemToCloud notice for item ${itemId}:`, error?.message);
    }
  }
}

export async function deleteFuneralInventoryLoanFromCloud(loanId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.FUNERAL_INVENTORY_LOANS, loanId);
  try {
    await deleteDoc(ref);
    recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY_LOANS, 1, true);
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.FUNERAL_INVENTORY_LOANS}/${loanId}`);
    } else {
      console.warn(`Firestore deleteFuneralInventoryLoanFromCloud notice for loan ${loanId}:`, error?.message);
    }
  }
}

export async function deleteUserFromCloud(userId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, userId);
  try {
    await deleteDoc(ref);
    recordFirebaseWrite(COLLECTIONS.USERS, 1, true);
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
    recordFirebaseRead(COLLECTIONS.CLAIMS, Math.max(1, claimsSnap.size));
    const batch = writeBatch(db);
    claimsSnap.forEach((docItem) => {
      batch.delete(docItem.ref);
    });
    await batch.commit();
    if (claimsSnap.size > 0) {
      recordFirebaseWrite(COLLECTIONS.CLAIMS, claimsSnap.size, true);
    }
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
    let deleteCount = 0;
    for (const id of demoIds) {
      const docRef = doc(db, COLLECTIONS.CLAIMS, id);
      const snap = await getDoc(docRef).catch(() => null);
      if (snap) {
        recordFirebaseRead(COLLECTIONS.CLAIMS, 1);
      }
      if (snap && snap.exists()) {
        batch.delete(docRef);
        deleteCount++;
      }
    }
    if (deleteCount > 0) {
      await batch.commit();
      recordFirebaseWrite(COLLECTIONS.CLAIMS, deleteCount, true);
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
    recordFirebaseRead(COLLECTIONS.PAYMENTS, Math.max(1, paymentsSnap.size));
    const paymentDocs = paymentsSnap.docs;
    for (let i = 0; i < paymentDocs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = paymentDocs.slice(i, i + 400);
      chunk.forEach((docItem) => {
        batch.delete(docItem.ref);
      });
      await batch.commit();
      recordFirebaseWrite(COLLECTIONS.PAYMENTS, chunk.length, true);
    }

    // 2. Delete all claims in safe chunked batches
    const claimsSnap = await getDocs(collection(db, COLLECTIONS.CLAIMS));
    recordFirebaseRead(COLLECTIONS.CLAIMS, Math.max(1, claimsSnap.size));
    const claimDocs = claimsSnap.docs;
    for (let i = 0; i < claimDocs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = claimDocs.slice(i, i + 400);
      chunk.forEach((docItem) => {
        batch.delete(docItem.ref);
      });
      await batch.commit();
      recordFirebaseWrite(COLLECTIONS.CLAIMS, chunk.length, true);
    }

    // 3. Reset financials balance in meta
    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    await setDoc(metaRef, { baseFundBalance: 0 }, { merge: true });
    recordFirebaseWrite(COLLECTIONS.META, 1);

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
    recordFirebaseWrite(COLLECTIONS.META, 1);

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
    recordFirebaseRead(COLLECTIONS.MEMBERS, Math.max(1, membersSnap.size));
    const batch1 = writeBatch(db);
    membersSnap.forEach((docItem) => {
      batch1.delete(docItem.ref);
    });
    await batch1.commit();
    if (membersSnap.size > 0) recordFirebaseWrite(COLLECTIONS.MEMBERS, membersSnap.size, true);

    // 2. Delete all payments
    const paymentsSnap = await getDocs(collection(db, COLLECTIONS.PAYMENTS));
    recordFirebaseRead(COLLECTIONS.PAYMENTS, Math.max(1, paymentsSnap.size));
    const batch2 = writeBatch(db);
    paymentsSnap.forEach((docItem) => {
      batch2.delete(docItem.ref);
    });
    await batch2.commit();
    if (paymentsSnap.size > 0) recordFirebaseWrite(COLLECTIONS.PAYMENTS, paymentsSnap.size, true);

    // 3. Delete all claims
    const claimsSnap = await getDocs(collection(db, COLLECTIONS.CLAIMS));
    recordFirebaseRead(COLLECTIONS.CLAIMS, Math.max(1, claimsSnap.size));
    const batch3 = writeBatch(db);
    claimsSnap.forEach((docItem) => {
      batch3.delete(docItem.ref);
    });
    await batch3.commit();
    if (claimsSnap.size > 0) recordFirebaseWrite(COLLECTIONS.CLAIMS, claimsSnap.size, true);

    // 4. Delete inventory loans
    const loansSnap = await getDocs(collection(db, COLLECTIONS.FUNERAL_INVENTORY_LOANS));
    recordFirebaseRead(COLLECTIONS.FUNERAL_INVENTORY_LOANS, Math.max(1, loansSnap.size));
    const batchLoans = writeBatch(db);
    loansSnap.forEach((docItem) => {
      batchLoans.delete(docItem.ref);
    });
    await batchLoans.commit();
    if (loansSnap.size > 0) recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY_LOANS, loansSnap.size, true);

    // 5. Reset users collection to default admin/staff only (remove member accounts)
    const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    recordFirebaseRead(COLLECTIONS.USERS, Math.max(1, usersSnap.size));
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
    recordFirebaseWrite(COLLECTIONS.USERS, usersSnap.size, true);
    recordFirebaseWrite(COLLECTIONS.USERS, adminUsers.length);

    // 6. Reset financials balance and update init_status flag
    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    await setDoc(metaRef, { baseFundBalance: 0 });

    const metaInitRef = doc(db, COLLECTIONS.META, 'init_status');
    await setDoc(metaInitRef, { initialized: true, isCleared: true, clearedAt: new Date().toISOString() });
    recordFirebaseWrite(COLLECTIONS.META, 2);

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

    sampleInitialAmbulanceOrders.forEach((o) => {
      const ref = doc(db, COLLECTIONS.AMBULANCE_ORDERS, o.id);
      batch.set(ref, o);
    });

    sampleInitialFuneralSchedules.forEach((f) => {
      const ref = doc(db, COLLECTIONS.FUNERAL_SCHEDULES, f.id);
      batch.set(ref, f);
    });

    sampleInitialInventoryItems.forEach((item) => {
      const ref = doc(db, COLLECTIONS.FUNERAL_INVENTORY, item.id);
      batch.set(ref, item);
    });

    sampleInitialInventoryLoans.forEach((loan) => {
      const ref = doc(db, COLLECTIONS.FUNERAL_INVENTORY_LOANS, loan.id);
      batch.set(ref, loan);
    });

    const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'main_config');
    batch.set(settingsRef, initialSettings);

    const metaRef = doc(db, COLLECTIONS.META, 'financials');
    batch.set(metaRef, { baseFundBalance: INITIAL_BASE_FUND_BALANCE });

    await batch.commit();
    recordFirebaseWrite(COLLECTIONS.MEMBERS, sampleDemoMembers.length);
    recordFirebaseWrite(COLLECTIONS.PAYMENTS, sampleDemoPayments.length);
    recordFirebaseWrite(COLLECTIONS.CLAIMS, sampleDemoClaims.length);
    recordFirebaseWrite(COLLECTIONS.USERS, initialUsers.length);
    recordFirebaseWrite(COLLECTIONS.CLUSTERS, DEFAULT_CLUSTERS.length);
    recordFirebaseWrite(COLLECTIONS.BENEFITS, DEFAULT_BENEFITS.length);
    recordFirebaseWrite(COLLECTIONS.AMBULANCE_ORDERS, sampleInitialAmbulanceOrders.length);
    recordFirebaseWrite(COLLECTIONS.FUNERAL_SCHEDULES, sampleInitialFuneralSchedules.length);
    recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY, sampleInitialInventoryItems.length);
    recordFirebaseWrite(COLLECTIONS.FUNERAL_INVENTORY_LOANS, sampleInitialInventoryLoans.length);
    recordFirebaseWrite(COLLECTIONS.SETTINGS, 1);
    recordFirebaseWrite(COLLECTIONS.META, 1);
    console.log('Successfully restored demo data to Cloud Firestore.');
  } catch (error) {
    console.error('Error restoring demo data to Firestore:', error);
    throw error;
  }
}

