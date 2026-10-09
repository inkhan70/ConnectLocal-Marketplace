import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return existing;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured on the server.');
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export async function verifyBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('Authentication required.');
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new Error('Authentication required.');
  return getAdminAuth().verifyIdToken(token);
}

/** Maps a thrown auth failure to the right HTTP status (401 for auth problems, 500 otherwise). */
export function authErrorStatus(error: any): number {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (message === 'Authentication required.' || code.startsWith('auth/')) return 401;
  return 500;
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
