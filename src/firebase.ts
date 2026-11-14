import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

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
}): Promise<void> {
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(
        ref,
        {
          name: safeName,
          avatar: safeAvatar,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  } catch (error) {
    // Only rethrow structured error if permission error occurs; allow offline login continuity
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }
}
