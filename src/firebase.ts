import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CoursePaymentMethod,
  CoursePaymentRecord,
  Invitation,
  InvitationStatus,
  SubscriptionTier
} from './types';
import {
  ActiveLabDraft,
  SavedLabRecord,
  normalizeCanvasDimensions,
  sanitizeDevicesForStorage,
  sanitizeLabId,
  sanitizeLabelsForStorage,
  sanitizeLinksForStorage,
  sanitizeShapesForStorage
} from './utils/labPersistence';
import {
  LearningStreakData,
  computeLearningStreak,
  sanitizeActiveDates
} from './utils/learningStreak';
import {
  DailyStudyGoalData,
  clampGoalMinutes,
  normalizeStudyGoalData
} from './utils/studyGoal';
import { PersonalFlashcard } from './components/Flashcards/flashcardTypes';
import {
  normalizePersonalFlashcard,
  sanitizeCourseRefId,
  sanitizeFlashcardId
} from './utils/personalFlashcards';
import {
  QuickNote,
  normalizeQuickNote,
  sanitizeNoteId,
  sanitizeNoteTags,
  sanitizeVideoTimestamp
} from './utils/quickNotes';
import {
  CourseBookmark,
  buildBookmarkDocId,
  normalizeCourseBookmark,
  sanitizeBookmarkIdPart
} from './utils/courseBookmarks';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

let gapiPreloadStarted = false;
export function preloadGoogleAuthSdk(): void {
  if (gapiPreloadStarted || typeof document === 'undefined') return;
  const win = window as Window & {
    gapi?: {
      load?: (name: string, cbOrConfig: (() => void) | { callback?: () => void }) => void;
      iframes?: { Iframe?: unknown };
    };
  };
  if (win.gapi?.iframes?.Iframe) return;
  gapiPreloadStarted = true;

  const warmIframes = () => {
    try {
      win.gapi?.load?.('gapi.iframes', () => {});
    } catch {
      // ignore warmup errors
    }
  };

  if (win.gapi?.load) {
    warmIframes();
    return;
  }

  if (!document.querySelector('script[src^="https://apis.google.com/js/api.js"]')) {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = warmIframes;
    document.head?.appendChild(script);
  }
}

export async function syncFirebaseUserProfile(params: {
  uid: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  avatar?: string;
  inviteCode?: string;
}): Promise<'student' | 'instructor' | 'admin' | null> {
  const userPath = `users/${params.uid}`;
  const ref = doc(db, 'users', params.uid);
  try {
    const snap = await getDoc(ref);
    const safeName = (params.name || 'Netplus User').trim().slice(0, 120);
    const safeEmail = (params.email || '').trim().slice(0, 254);
    const safeAvatar = (params.avatar || '').trim().slice(0, 500);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: params.uid,
        name: safeName,
        email: safeEmail,
        role: params.role,
        avatar: safeAvatar,
        ...(params.inviteCode ? { inviteCode: params.inviteCode.trim().slice(0, 128) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return params.role;
    } else {
      const existingData = snap.data() as { role?: 'student' | 'instructor' | 'admin' };
      await setDoc(
        ref,
        {
          name: safeName,
          avatar: safeAvatar,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      return existingData?.role || params.role;
    }
  } catch (error) {
    // Only rethrow structured error if permission error occurs; allow offline login continuity
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
    return null;
  }
}

export async function saveInvitationToFirestore(invite: Invitation): Promise<void> {
  if (!auth.currentUser) return;
  const invitePath = `invitations/${invite.id}`;
  const ref = doc(db, 'invitations', invite.id);
  try {
    await setDoc(ref, {
      id: invite.id.slice(0, 128),
      code: invite.code.slice(0, 64),
      email: invite.email.trim().toLowerCase().slice(0, 254),
      fullName: invite.fullName.trim().slice(0, 120),
      role: invite.role,
      assignedCourseIds: invite.assignedCourseIds.slice(0, 20),
      cohortOrSpecialty: invite.cohortOrSpecialty.trim().slice(0, 120),
      ...(invite.subscriptionTier ? { subscriptionTier: invite.subscriptionTier } : {}),
      ...(invite.welcomeNote ? { welcomeNote: invite.welcomeNote.trim().slice(0, 500) } : {}),
      status: invite.status,
      invitedByUid: auth.currentUser.uid,
      invitedByName: invite.invitedByName.trim().slice(0, 120),
      invitedByEmail: (auth.currentUser.email || invite.invitedByEmail).trim().slice(0, 254),
      expiresAt: invite.expiresAt.slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.CREATE, invitePath);
    }
  }
}

export async function updateInvitationStatusInFirestore(
  inviteId: string,
  patch: { status: InvitationStatus; acceptedByUid?: string; acceptedAt?: string }
): Promise<void> {
  if (!auth.currentUser) return;
  const invitePath = `invitations/${inviteId}`;
  const ref = doc(db, 'invitations', inviteId);
  try {
    await updateDoc(ref, {
      status: patch.status,
      ...(patch.acceptedByUid ? { acceptedByUid: patch.acceptedByUid.slice(0, 128) } : {}),
      ...(patch.acceptedAt ? { acceptedAt: patch.acceptedAt.slice(0, 64) } : {}),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.UPDATE, invitePath);
    }
  }
}

export async function deleteInvitationFromFirestore(inviteId: string): Promise<void> {
  if (!auth.currentUser) return;
  const invitePath = `invitations/${inviteId}`;
  try {
    await deleteDoc(doc(db, 'invitations', inviteId));
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, invitePath);
    }
  }
}

export async function fetchInvitationsFromFirestore(
  isAdminUser: boolean,
  userEmail?: string | null
): Promise<Invitation[] | null> {
  if (!auth.currentUser) return null;
  const path = 'invitations';
  try {
    const colRef = collection(db, 'invitations');
    const q = isAdminUser
      ? colRef
      : query(colRef, where('email', '==', (userEmail || auth.currentUser.email || '').toLowerCase()));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, any>;
      const createdAtVal =
        data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date().toISOString();
      return {
        id: String(data.id || d.id),
        code: String(data.code || d.id),
        email: String(data.email || ''),
        fullName: String(data.fullName || ''),
        role: data.role === 'instructor' ? 'instructor' : 'student',
        assignedCourseIds: Array.isArray(data.assignedCourseIds) ? data.assignedCourseIds.map(String) : [],
        cohortOrSpecialty: String(data.cohortOrSpecialty || ''),
        subscriptionTier: data.subscriptionTier as SubscriptionTier | undefined,
        welcomeNote: typeof data.welcomeNote === 'string' ? data.welcomeNote : undefined,
        status: (data.status as InvitationStatus) || 'pending',
        invitedByUid: String(data.invitedByUid || ''),
        invitedByName: String(data.invitedByName || 'Administrator'),
        invitedByEmail: String(data.invitedByEmail || ''),
        acceptedByUid: typeof data.acceptedByUid === 'string' ? data.acceptedByUid : undefined,
        acceptedAt: typeof data.acceptedAt === 'string' ? data.acceptedAt : undefined,
        createdAt: createdAtVal,
        expiresAt: String(data.expiresAt || '')
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export interface FirestoreUserRecord {
  uid: string;
  name: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  avatar?: string;
  inviteCode?: string;
  joinedDate: string;
}

export async function fetchUsersFromFirestore(): Promise<FirestoreUserRecord[] | null> {
  if (!auth.currentUser) return null;
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => {
      const data = d.data() as Record<string, any>;
      const createdAtStr =
        data.createdAt && typeof data.createdAt.toDate === 'function'
          ? data.createdAt.toDate().toISOString().split('T')[0]
          : typeof data.createdAt === 'string'
          ? data.createdAt.split('T')[0]
          : new Date().toISOString().split('T')[0];

      return {
        uid: String(data.uid || d.id),
        name: String(data.name || 'Netplus User'),
        email: String(data.email || ''),
        role:
          data.role === 'admin' || data.role === 'instructor'
            ? data.role
            : 'student',
        avatar: typeof data.avatar === 'string' && data.avatar ? data.avatar : undefined,
        inviteCode: typeof data.inviteCode === 'string' ? data.inviteCode : undefined,
        joinedDate: createdAtStr
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export async function updateUserInFirestore(
  uid: string,
  updates: { name?: string; role?: 'student' | 'instructor' | 'admin' }
): Promise<void> {
  if (!auth.currentUser || !uid) return;
  const userPath = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      ...(updates.name !== undefined ? { name: updates.name.trim().slice(0, 120) } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }
}

export async function deleteUserFromFirestore(uid: string): Promise<void> {
  if (!auth.currentUser || !uid) return;
  const userPath = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, userPath);
    }
  }
}

export async function saveCoursePaymentToFirestore(
  payment: CoursePaymentRecord
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const safeId = payment.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  const paymentPath = `coursePayments/${safeId}`;
  const ref = doc(db, 'coursePayments', safeId);
  try {
    await setDoc(ref, {
      id: safeId,
      transactionId: payment.transactionId.slice(0, 64),
      invoiceNumber: payment.invoiceNumber.slice(0, 64),
      studentUid: auth.currentUser.uid,
      studentName: (payment.studentName || auth.currentUser.displayName || 'Student').trim().slice(0, 120),
      studentEmail: (auth.currentUser.email || payment.studentEmail || 'student@netplus.academy').trim().toLowerCase().slice(0, 254),
      courseId: payment.courseId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128),
      courseCode: payment.courseCode.trim().slice(0, 64),
      courseTitle: payment.courseTitle.trim().slice(0, 200),
      originalPrice: Math.max(0, Math.min(50000, Number(payment.originalPrice) || 0)),
      discountAmount: Math.max(0, Math.min(Number(payment.originalPrice) || 0, Number(payment.discountAmount) || 0)),
      amountPaid: Math.max(0, Math.min(Number(payment.originalPrice) || 0, Number(payment.amountPaid) || 0)),
      currency: 'USD',
      ...(payment.promoCode ? { promoCode: payment.promoCode.trim().slice(0, 40) } : {}),
      paymentMethod: payment.paymentMethod,
      ...(payment.cardLast4 ? { cardLast4: payment.cardLast4.trim().slice(0, 8) } : {}),
      status: 'paid',
      paidAt: payment.paidAt.slice(0, 64),
      accessStartDate: payment.accessStartDate.slice(0, 32),
      accessExpiresAt: payment.accessExpiresAt.slice(0, 32),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.CREATE, paymentPath);
    }
  }
}

export async function fetchCoursePaymentsFromFirestore(
  isAdminUser: boolean
): Promise<CoursePaymentRecord[] | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const path = 'coursePayments';
  try {
    const colRef = collection(db, path);
    const q = isAdminUser
      ? colRef
      : query(colRef, where('studentUid', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, any>;
      const method: CoursePaymentMethod =
        data.paymentMethod === 'paypal' || data.paymentMethod === 'bank_transfer'
          ? data.paymentMethod
          : 'card';
      return {
        id: String(data.id || d.id),
        transactionId: String(data.transactionId || ''),
        invoiceNumber: String(data.invoiceNumber || ''),
        studentId: String(data.studentUid || ''),
        studentName: String(data.studentName || ''),
        studentEmail: String(data.studentEmail || ''),
        courseId: String(data.courseId || ''),
        courseCode: String(data.courseCode || ''),
        courseTitle: String(data.courseTitle || ''),
        originalPrice: Number(data.originalPrice) || 0,
        discountAmount: Number(data.discountAmount) || 0,
        amountPaid: Number(data.amountPaid) || 0,
        currency: 'USD',
        promoCode: typeof data.promoCode === 'string' ? data.promoCode : undefined,
        paymentMethod: method,
        cardLast4: typeof data.cardLast4 === 'string' ? data.cardLast4 : undefined,
        status: data.status === 'refunded' ? 'refunded' : 'paid',
        paidAt: String(data.paidAt || new Date().toISOString()),
        accessStartDate: String(data.accessStartDate || ''),
        accessExpiresAt: String(data.accessExpiresAt || '')
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export async function saveLabTopologyToFirestore(
  record: SavedLabRecord
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeLabId(record.id);
  const safePresetId = sanitizeLabId(record.presetId);
  const safeTitle = (record.title || 'Untitled Topology').trim().slice(0, 120) || 'Untitled Topology';
  const safeDevices = sanitizeDevicesForStorage(record.devices);
  const safeLinks = sanitizeLinksForStorage(record.links);
  const objectivesTotal = Math.max(0, Math.min(50, Math.trunc(record.objectivesTotal || 0)));
  const objectivesPassed = Math.max(
    0,
    Math.min(objectivesTotal, Math.trunc(record.objectivesPassed || 0))
  );

  const projectStatus = record.status === 'completed' ? 'completed' : 'in_progress';

  const labPath = `labTopologies/${safeId}`;
  const ref = doc(db, 'labTopologies', safeId);

  try {
    if (record.syncStatus === 'cloud') {
      try {
        await updateDoc(ref, {
          title: safeTitle,
          presetId: safePresetId,
          devices: safeDevices,
          links: safeLinks,
          deviceCount: safeDevices.length,
          linkCount: safeLinks.length,
          objectivesPassed,
          objectivesTotal,
          status: projectStatus,
          updatedAt: serverTimestamp()
        });
        return true;
      } catch (updateErr) {
        const msg = updateErr instanceof Error ? updateErr.message.toLowerCase() : '';
        if (!msg.includes('not-found') && !msg.includes('no document to update')) {
          throw updateErr;
        }
      }
    }

    await setDoc(ref, {
      id: safeId,
      ownerUid: auth.currentUser.uid,
      title: safeTitle,
      presetId: safePresetId,
      devices: safeDevices,
      links: safeLinks,
      deviceCount: safeDevices.length,
      linkCount: safeLinks.length,
      objectivesPassed,
      objectivesTotal,
      status: projectStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, labPath);
    }
    return false;
  }
}

export async function fetchLabTopologiesFromFirestore(): Promise<SavedLabRecord[] | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const currentUid = auth.currentUser.uid;
  const path = 'labTopologies';
  try {
    const q = query(
      collection(db, path),
      where('ownerUid', '==', currentUid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .filter(d => d.data()?.ownerUid === currentUid)
      .map(d => {
        const data = d.data() as Record<string, any>;
        const createdAtIso =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString();
        const updatedAtIso =
          data.updatedAt && typeof data.updatedAt.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : typeof data.updatedAt === 'string'
            ? data.updatedAt
            : createdAtIso;

        const devices = Array.isArray(data.devices) ? data.devices : [];
        const links = Array.isArray(data.links) ? data.links : [];

        return {
          id: String(data.id || d.id),
          userId: currentUid,
          title: String(data.title || 'Saved Lab'),
          presetId: String(data.presetId || 'blank-sandbox'),
          devices,
          links,
          deviceCount: Number(data.deviceCount ?? devices.length),
          linkCount: Number(data.linkCount ?? links.length),
          objectivesPassed: Number(data.objectivesPassed ?? 0),
          objectivesTotal: Number(data.objectivesTotal ?? 0),
          status: data.status === 'completed' ? ('completed' as const) : ('in_progress' as const),
          createdAt: createdAtIso,
          updatedAt: updatedAtIso,
          syncStatus: 'cloud' as const
        };
      });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export async function deleteLabTopologyFromFirestore(
  topologyId: string
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeLabId(topologyId);
  const labPath = `labTopologies/${safeId}`;
  try {
    await deleteDoc(doc(db, 'labTopologies', safeId));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, labPath);
    }
    return false;
  }
}

export async function fetchLabDraftFromFirestore(): Promise<ActiveLabDraft | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const uid = auth.currentUser.uid;
  const draftPath = `labDrafts/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'labDrafts', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, any>;
    const updatedAtIso =
      typeof data.clientUpdatedAt === 'string' && data.clientUpdatedAt
        ? data.clientUpdatedAt
        : data.updatedAt && typeof data.updatedAt.toDate === 'function'
        ? data.updatedAt.toDate().toISOString()
        : new Date().toISOString();

    const { width, height } = normalizeCanvasDimensions(data.canvasWidth, data.canvasHeight);
    const rawGrid = (data.gridSettings && typeof data.gridSettings === 'object'
      ? data.gridSettings
      : {}) as Record<string, any>;

    const devices = Array.isArray(data.devices) ? data.devices : [];
    const links = Array.isArray(data.links) ? data.links : [];
    const shapes = Array.isArray(data.shapes) ? data.shapes : [];
    const labels = Array.isArray(data.labels) ? data.labels : [];

    return {
      draftKey: uid,
      userId: uid,
      activeSavedLabId:
        typeof data.activeSavedLabId === 'string' && data.activeSavedLabId
          ? data.activeSavedLabId
          : undefined,
      title: typeof data.title === 'string' && data.title ? data.title : undefined,
      presetId: String(data.presetId || 'blank-sandbox'),
      canvasWidth: width,
      canvasHeight: height,
      showCustomLabels: data.showCustomLabels !== false,
      gridSettings: {
        showGrid: typeof rawGrid.showGrid === 'boolean' ? rawGrid.showGrid : true,
        snapToGrid: typeof rawGrid.snapToGrid === 'boolean' ? rawGrid.snapToGrid : true,
        gridSize:
          typeof rawGrid.gridSize === 'number' && Number.isFinite(rawGrid.gridSize)
            ? rawGrid.gridSize
            : 20,
        gridStyle: rawGrid.gridStyle === 'dots' ? 'dots' : 'lines'
      },
      devices,
      links,
      shapes,
      labels,
      updatedAt: updatedAtIso
    };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, draftPath);
    }
    return null;
  }
}

export async function saveLabDraftToFirestore(
  draft: ActiveLabDraft
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const draftPath = `labDrafts/${uid}`;
  const ref = doc(db, 'labDrafts', uid);

  const safePresetId = sanitizeLabId(draft.presetId || 'blank-sandbox');
  const safeSavedLabId = draft.activeSavedLabId ? sanitizeLabId(draft.activeSavedLabId) : '';
  const safeTitle = draft.title?.trim().slice(0, 120) || '';
  const { width: safeWidth, height: safeHeight } = normalizeCanvasDimensions(
    draft.canvasWidth,
    draft.canvasHeight
  );

  let safeDevices = sanitizeDevicesForStorage(draft.devices);
  const safeLinks = sanitizeLinksForStorage(draft.links);
  const safeShapes = sanitizeShapesForStorage(draft.shapes, safeWidth, safeHeight);
  const safeLabels = sanitizeLabelsForStorage(draft.labels, safeWidth, safeHeight);

  // Guard against Firestore 1 MiB document size limit if CLI history grows large
  const approxBytes = JSON.stringify({
    devices: safeDevices,
    links: safeLinks,
    shapes: safeShapes,
    labels: safeLabels
  }).length;
  if (approxBytes > 800_000) {
    safeDevices = safeDevices.map(dev => ({
      ...dev,
      cliHistory: Array.isArray(dev.cliHistory) ? dev.cliHistory.slice(-10) : []
    }));
  }

  const rawGridSize = Number(draft.gridSettings?.gridSize);
  const clampedGridSize = Number.isFinite(rawGridSize)
    ? Math.round(Math.min(100, Math.max(5, rawGridSize)))
    : 20;
  const safeGridSettings = {
    showGrid: draft.gridSettings?.showGrid !== false,
    snapToGrid: draft.gridSettings?.snapToGrid !== false,
    gridSize: clampedGridSize,
    gridStyle: draft.gridSettings?.gridStyle === 'dots' ? ('dots' as const) : ('lines' as const)
  };
  const clientUpdatedAt = (draft.updatedAt || new Date().toISOString()).slice(0, 64);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        presetId: safePresetId,
        activeSavedLabId: safeSavedLabId || deleteField(),
        title: safeTitle || deleteField(),
        canvasWidth: safeWidth,
        canvasHeight: safeHeight,
        showCustomLabels: draft.showCustomLabels !== false,
        gridSettings: safeGridSettings,
        devices: safeDevices,
        links: safeLinks,
        shapes: safeShapes,
        labels: safeLabels,
        deviceCount: safeDevices.length,
        linkCount: safeLinks.length,
        clientUpdatedAt,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(ref, {
        uid,
        presetId: safePresetId,
        ...(safeSavedLabId ? { activeSavedLabId: safeSavedLabId } : {}),
        ...(safeTitle ? { title: safeTitle } : {}),
        canvasWidth: safeWidth,
        canvasHeight: safeHeight,
        showCustomLabels: draft.showCustomLabels !== false,
        gridSettings: safeGridSettings,
        devices: safeDevices,
        links: safeLinks,
        shapes: safeShapes,
        labels: safeLabels,
        deviceCount: safeDevices.length,
        linkCount: safeLinks.length,
        clientUpdatedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, draftPath);
    }
    return false;
  }
}

export async function clearLabDraftFromFirestore(): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const draftPath = `labDrafts/${uid}`;
  try {
    await deleteDoc(doc(db, 'labDrafts', uid));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, draftPath);
    }
    return false;
  }
}

export async function fetchLearningStreakFromFirestore(): Promise<LearningStreakData | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const uid = auth.currentUser.uid;
  const streakPath = `learningStreaks/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'learningStreaks', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, any>;
    const activeDates = sanitizeActiveDates(data.activeDates);
    return {
      activeDates,
      longestStreak: Math.max(0, Math.trunc(Number(data.longestStreak) || 0)),
      lastActiveDate:
        typeof data.lastActiveDate === 'string'
          ? data.lastActiveDate.slice(0, 16)
          : activeDates[activeDates.length - 1] || '',
    };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, streakPath);
    }
    return null;
  }
}

export async function saveLearningStreakToFirestore(
  data: LearningStreakData
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const streakPath = `learningStreaks/${uid}`;
  const ref = doc(db, 'learningStreaks', uid);
  const safeDates = sanitizeActiveDates(data.activeDates);
  const computed = computeLearningStreak({
    activeDates: safeDates,
    longestStreak: data.longestStreak,
    lastActiveDate: data.lastActiveDate,
  });

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        activeDates: safeDates,
        currentStreak: Math.min(3650, Math.max(0, Math.trunc(computed.currentStreak))),
        longestStreak: Math.min(3650, Math.max(0, Math.trunc(computed.longestStreak))),
        lastActiveDate: (computed.lastActiveDate || '').slice(0, 16),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        activeDates: safeDates,
        currentStreak: Math.min(3650, Math.max(0, Math.trunc(computed.currentStreak))),
        longestStreak: Math.min(3650, Math.max(0, Math.trunc(computed.longestStreak))),
        lastActiveDate: (computed.lastActiveDate || '').slice(0, 16),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, streakPath);
    }
    return false;
  }
}

export async function fetchStudyGoalFromFirestore(): Promise<DailyStudyGoalData | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const uid = auth.currentUser.uid;
  const goalPath = `studyGoals/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'studyGoals', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, any>;
    return normalizeStudyGoalData({
      dailyGoalMinutes: Number(data.dailyGoalMinutes),
      dateKey: typeof data.dateKey === 'string' ? data.dateKey : undefined,
      courseSeconds: Number(data.courseSeconds) || 0,
      labSeconds: Number(data.labSeconds) || 0,
      practiceSeconds: Number(data.practiceSeconds) || 0,
      creditedModuleIds: Array.isArray(data.creditedModuleIds) ? data.creditedModuleIds : [],
    });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.GET, goalPath);
    }
    return null;
  }
}

export async function saveStudyGoalToFirestore(
  data: DailyStudyGoalData
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const goalPath = `studyGoals/${uid}`;
  const ref = doc(db, 'studyGoals', uid);
  const safe = normalizeStudyGoalData(data);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        dailyGoalMinutes: clampGoalMinutes(safe.dailyGoalMinutes),
        dateKey: safe.dateKey,
        courseSeconds: Math.min(86400, Math.max(0, Math.trunc(safe.courseSeconds))),
        labSeconds: Math.min(86400, Math.max(0, Math.trunc(safe.labSeconds))),
        practiceSeconds: Math.min(86400, Math.max(0, Math.trunc(safe.practiceSeconds))),
        creditedModuleIds: safe.creditedModuleIds.slice(0, 100),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        dailyGoalMinutes: clampGoalMinutes(safe.dailyGoalMinutes),
        dateKey: safe.dateKey,
        courseSeconds: Math.min(86400, Math.max(0, Math.trunc(safe.courseSeconds))),
        labSeconds: Math.min(86400, Math.max(0, Math.trunc(safe.labSeconds))),
        practiceSeconds: Math.min(86400, Math.max(0, Math.trunc(safe.practiceSeconds))),
        creditedModuleIds: safe.creditedModuleIds.slice(0, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, goalPath);
    }
    return false;
  }
}

export async function fetchPersonalFlashcardsFromFirestore(): Promise<PersonalFlashcard[] | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const uid = auth.currentUser.uid;
  const path = 'personalFlashcards';
  try {
    const q = query(collection(db, path), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .filter(d => d.data()?.ownerUid === uid)
      .map(d => {
        const data = d.data() as Record<string, any>;
        const createdAtIso =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString();
        const updatedAtIso =
          data.updatedAt && typeof data.updatedAt.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : typeof data.updatedAt === 'string'
            ? data.updatedAt
            : createdAtIso;

        return normalizePersonalFlashcard(
          {
            id: String(data.id || d.id),
            ownerUid: uid,
            courseId: String(data.courseId || 'general'),
            courseCode: typeof data.courseCode === 'string' ? data.courseCode : undefined,
            courseTitle: typeof data.courseTitle === 'string' ? data.courseTitle : undefined,
            moduleId: typeof data.moduleId === 'string' ? data.moduleId : undefined,
            moduleTitle: typeof data.moduleTitle === 'string' ? data.moduleTitle : undefined,
            category: data.category,
            term: String(data.term || ''),
            question: String(data.question || ''),
            answer: String(data.answer || ''),
            portNumber: typeof data.portNumber === 'string' ? data.portNumber : undefined,
            transportProtocol:
              typeof data.transportProtocol === 'string' ? data.transportProtocol : undefined,
            osiLayer: typeof data.osiLayer === 'string' ? data.osiLayer : undefined,
            explanation: typeof data.explanation === 'string' ? data.explanation : '',
            memoryTip: typeof data.memoryTip === 'string' ? data.memoryTip : '',
            masteryStatus: data.masteryStatus,
            createdAt: createdAtIso,
            updatedAt: updatedAtIso
          },
          uid
        );
      });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export async function savePersonalFlashcardToFirestore(
  card: PersonalFlashcard
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const safeId = sanitizeFlashcardId(card.id);
  const safeCourseId = sanitizeCourseRefId(card.courseId);
  const cardPath = `personalFlashcards/${safeId}`;
  const ref = doc(db, 'personalFlashcards', safeId);

  const safeCourseCode = card.courseCode?.trim().slice(0, 64);
  const safeCourseTitle = card.courseTitle?.trim().slice(0, 200);
  const safeModuleId = card.moduleId ? sanitizeFlashcardId(card.moduleId) : '';
  const safeModuleTitle = card.moduleTitle?.trim().slice(0, 200);
  const safePort = card.portNumber?.trim().slice(0, 40);
  const safeTransport = card.transportProtocol?.trim().slice(0, 40);
  const safeOsi = card.osiLayer?.trim().slice(0, 64);
  const safeExplanation = (card.explanation || '').trim().slice(0, 1200);
  const safeMemoryTip = (card.memoryTip || '').trim().slice(0, 600);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        courseId: safeCourseId,
        courseCode: safeCourseCode || deleteField(),
        courseTitle: safeCourseTitle || deleteField(),
        moduleId: safeModuleId || deleteField(),
        moduleTitle: safeModuleTitle || deleteField(),
        category: card.category,
        term: (card.term || 'Networking Concept').trim().slice(0, 140),
        question: card.question.trim().slice(0, 600),
        answer: card.answer.trim().slice(0, 800),
        portNumber: safePort || deleteField(),
        transportProtocol: safeTransport || deleteField(),
        osiLayer: safeOsi || deleteField(),
        explanation: safeExplanation,
        memoryTip: safeMemoryTip,
        masteryStatus: card.masteryStatus,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        courseId: safeCourseId,
        ...(safeCourseCode ? { courseCode: safeCourseCode } : {}),
        ...(safeCourseTitle ? { courseTitle: safeCourseTitle } : {}),
        ...(safeModuleId ? { moduleId: safeModuleId } : {}),
        ...(safeModuleTitle ? { moduleTitle: safeModuleTitle } : {}),
        category: card.category,
        term: (card.term || 'Networking Concept').trim().slice(0, 140),
        question: card.question.trim().slice(0, 600),
        answer: card.answer.trim().slice(0, 800),
        ...(safePort ? { portNumber: safePort } : {}),
        ...(safeTransport ? { transportProtocol: safeTransport } : {}),
        ...(safeOsi ? { osiLayer: safeOsi } : {}),
        explanation: safeExplanation,
        memoryTip: safeMemoryTip,
        masteryStatus: card.masteryStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, cardPath);
    }
    return false;
  }
}

export async function deletePersonalFlashcardFromFirestore(
  cardId: string
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeFlashcardId(cardId);
  const cardPath = `personalFlashcards/${safeId}`;
  try {
    await deleteDoc(doc(db, 'personalFlashcards', safeId));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, cardPath);
    }
    return false;
  }
}

export async function fetchQuickNotesFromFirestore(): Promise<QuickNote[] | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const uid = auth.currentUser.uid;
  const path = 'quickNotes';
  try {
    const q = query(collection(db, path), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .filter(d => d.data()?.ownerUid === uid)
      .map(d => {
        const data = d.data() as Record<string, any>;
        const createdAtIso =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString();
        const updatedAtIso =
          data.updatedAt && typeof data.updatedAt.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : typeof data.updatedAt === 'string'
            ? data.updatedAt
            : createdAtIso;

        return normalizeQuickNote(
          {
            id: String(data.id || d.id),
            ownerUid: uid,
            courseId: String(data.courseId || 'general'),
            courseCode: typeof data.courseCode === 'string' ? data.courseCode : undefined,
            courseTitle: typeof data.courseTitle === 'string' ? data.courseTitle : undefined,
            moduleId: String(data.moduleId || 'module-general'),
            moduleTitle: String(data.moduleTitle || 'Lesson Notes'),
            title: String(data.title || ''),
            content: String(data.content || ''),
            videoTimestampSeconds:
              typeof data.videoTimestampSeconds === 'number'
                ? data.videoTimestampSeconds
                : undefined,
            tags: sanitizeNoteTags(data.tags),
            createdAt: createdAtIso,
            updatedAt: updatedAtIso
          },
          uid
        );
      });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export async function saveQuickNoteToFirestore(note: QuickNote): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const safeId = sanitizeNoteId(note.id);
  const safeCourseId = sanitizeNoteId(note.courseId || 'general');
  const safeModuleId = sanitizeNoteId(note.moduleId || 'module-general');
  const notePath = `quickNotes/${safeId}`;
  const ref = doc(db, 'quickNotes', safeId);

  const safeCourseCode = note.courseCode?.trim().slice(0, 64);
  const safeCourseTitle = note.courseTitle?.trim().slice(0, 200);
  const safeModuleTitle = (note.moduleTitle || 'Lesson Notes').trim().slice(0, 200) || 'Lesson Notes';
  const safeContent = (note.content || '').trim().slice(0, 4000);
  const safeTitle = (note.title || 'Technical Concept').trim().slice(0, 140) || 'Technical Concept';
  const safeTimestamp = sanitizeVideoTimestamp(note.videoTimestampSeconds);
  const safeTags = sanitizeNoteTags(note.tags);

  if (!safeContent) return false;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        courseId: safeCourseId,
        courseCode: safeCourseCode || deleteField(),
        courseTitle: safeCourseTitle || deleteField(),
        moduleId: safeModuleId,
        moduleTitle: safeModuleTitle,
        title: safeTitle,
        content: safeContent,
        videoTimestampSeconds:
          typeof safeTimestamp === 'number' ? safeTimestamp : deleteField(),
        tags: safeTags,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        courseId: safeCourseId,
        ...(safeCourseCode ? { courseCode: safeCourseCode } : {}),
        ...(safeCourseTitle ? { courseTitle: safeCourseTitle } : {}),
        moduleId: safeModuleId,
        moduleTitle: safeModuleTitle,
        title: safeTitle,
        content: safeContent,
        ...(typeof safeTimestamp === 'number' ? { videoTimestampSeconds: safeTimestamp } : {}),
        tags: safeTags,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, notePath);
    }
    return false;
  }
}

export async function deleteQuickNoteFromFirestore(noteId: string): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const safeId = sanitizeNoteId(noteId);
  const notePath = `quickNotes/${safeId}`;
  try {
    await deleteDoc(doc(db, 'quickNotes', safeId));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, notePath);
    }
    return false;
  }
}

export async function fetchCourseBookmarksFromFirestore(): Promise<CourseBookmark[] | null> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return null;
  const uid = auth.currentUser.uid;
  const path = 'courseBookmarks';
  try {
    const q = query(collection(db, path), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .filter(d => d.data()?.ownerUid === uid)
      .map(d => {
        const data = d.data() as Record<string, any>;
        const createdAtIso =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString();
        const updatedAtIso =
          data.updatedAt && typeof data.updatedAt.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : typeof data.updatedAt === 'string'
            ? data.updatedAt
            : createdAtIso;

        return normalizeCourseBookmark(
          {
            id: String(data.id || d.id),
            ownerUid: uid,
            courseId: String(data.courseId || ''),
            courseCode: typeof data.courseCode === 'string' ? data.courseCode : undefined,
            courseTitle: typeof data.courseTitle === 'string' ? data.courseTitle : undefined,
            createdAt: createdAtIso,
            updatedAt: updatedAtIso
          },
          uid
        );
      });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return null;
  }
}

export async function saveCourseBookmarkToFirestore(
  bookmark: CourseBookmark
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const safeCourseId = sanitizeBookmarkIdPart(bookmark.courseId, 'course', 128);
  const safeId = buildBookmarkDocId(uid, safeCourseId);
  const bookmarkPath = `courseBookmarks/${safeId}`;
  const ref = doc(db, 'courseBookmarks', safeId);

  const safeCourseCode = bookmark.courseCode?.trim().slice(0, 64);
  const safeCourseTitle = bookmark.courseTitle?.trim().slice(0, 200);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        courseCode: safeCourseCode || deleteField(),
        courseTitle: safeCourseTitle || deleteField(),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        courseId: safeCourseId,
        ...(safeCourseCode ? { courseCode: safeCourseCode } : {}),
        ...(safeCourseTitle ? { courseTitle: safeCourseTitle } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, bookmarkPath);
    }
    return false;
  }
}

export async function deleteCourseBookmarkFromFirestore(
  courseId: string
): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return false;
  const uid = auth.currentUser.uid;
  const safeCourseId = sanitizeBookmarkIdPart(courseId, 'course', 128);
  const safeId = buildBookmarkDocId(uid, safeCourseId);
  const bookmarkPath = `courseBookmarks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'courseBookmarks', safeId));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, bookmarkPath);
    }
    return false;
  }
}




