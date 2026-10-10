import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';

let adminApp: App | null = null;

/** Error carrying an HTTP status and a machine-readable code the client can show/act on. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Parses FIREBASE_SERVICE_ACCOUNT_KEY. Vercel/dashboards often mangle this value (wrapping quotes, base64,
 * literal "\n" inside the private key), so be tolerant about the format.
 */
function parseServiceAccount(raw: string): Record<string, any> {
  let text = raw.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  if (!text.startsWith('{')) {
    try { text = Buffer.from(text, 'base64').toString('utf8'); } catch { /* fall through to JSON error */ }
  }
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(500, 'service_account_invalid', 'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }
  if (typeof parsed.private_key === 'string') parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  return parsed;
}

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return existing;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new HttpError(500, 'service_account_missing', 'FIREBASE_SERVICE_ACCOUNT_KEY is not configured on the server.');
  }

  const serviceAccount = parseServiceAccount(raw);
  const accountProject = String(serviceAccount.project_id || '');
  const webProject = firebaseConfig.projectId;

  // ID tokens are issued for the project in the web config. If the service account belongs to a different
  // project, verifyIdToken() rejects EVERY login, which looks like a generic sign-in failure.
  if (accountProject && webProject && accountProject !== webProject) {
    throw new HttpError(
      500,
      'project_mismatch',
      `The server service account is for project "${accountProject}" but the web app uses "${webProject}". Use a service-account key from the "${webProject}" Firebase project.`,
    );
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    // Always the service account's own project (an unrelated NEXT_PUBLIC_FIREBASE_PROJECT_ID must not override it).
    projectId: accountProject || webProject,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  });
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export async function verifyBearerToken(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'missing_token', 'Authentication required.');
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new HttpError(401, 'missing_token', 'Authentication required.');
  // Make sure configuration errors surface as config errors (500) instead of being mistaken for a bad token.
  const auth = getAdminAuth();
  try {
    return await auth.verifyIdToken(token);
  } catch (error: any) {
    console.error('verifyIdToken failed:', error?.code, error?.message);
    throw new HttpError(401, String(error?.code || 'invalid_token'), 'Authentication required.');
  }
}

/** True when the verified token carries the admin custom claim. */
export function hasAdminClaim(decoded: Partial<DecodedIdToken> & Record<string, any>): boolean {
  return decoded.role === 'admin' || decoded.isAdmin === true;
}

/**
 * Single source of truth for "is this caller an administrator?".
 * Admin status is stored in two places (Firebase custom claims and users/{uid}.isAdmin) and either may lag the other,
 * so a caller is an admin if EITHER says so. Drift is healed so Firestore rules and the UI agree afterwards.
 */
export async function isAdminCaller(db: Firestore, decoded: DecodedIdToken): Promise<boolean> {
  const claim = hasAdminClaim(decoded as any);
  const ref = db.collection('users').doc(decoded.uid);
  const snap = await ref.get();
  const flag = snap.exists && snap.data()?.isAdmin === true;
  if (!claim && !flag) return false;

  try {
    if (claim && !flag && snap.exists) {
      await ref.set({ isAdmin: true, updatedAt: new Date().toISOString() }, { merge: true });
    } else if (flag && !claim) {
      const auth = getAdminAuth();
      const record = await auth.getUser(decoded.uid);
      await auth.setCustomUserClaims(decoded.uid, { ...(record.customClaims || {}), isAdmin: true, role: 'admin' });
    }
  } catch (error) {
    console.error('Admin status sync failed (non-fatal):', error);
  }
  return true;
}

/** Verifies the bearer token and requires an administrator; throws HttpError(401/403) otherwise. */
export async function requireAdmin(request: Request): Promise<DecodedIdToken> {
  const decoded = await verifyBearerToken(request);
  const ok = await isAdminCaller(getAdminDb(), decoded);
  if (!ok) throw new HttpError(403, 'not_admin', 'Administrator access required.');
  return decoded;
}

/** Maps a thrown failure to the right HTTP status (401 for token problems, explicit status for HttpError, else 500). */
export function authErrorStatus(error: any): number {
  if (error instanceof HttpError) return error.status;
  const message = String(error?.message || '');
  if (message === 'Authentication required.') return 401;
  if (message === 'Administrator access required.') return 403;
  return 500;
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
