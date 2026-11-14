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
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Invitation, InvitationStatus, SubscriptionTier } from './types';

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
