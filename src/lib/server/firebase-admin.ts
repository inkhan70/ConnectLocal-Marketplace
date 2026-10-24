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

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

type ClassifiedError = { status: number; code: string; message: string; opaque?: boolean };

/** Recognises infrastructure/IAM failures (Firestore gRPC + Admin SDK auth errors) and explains how to fix them. */
function matchInfraError(error: any): ClassifiedError | null {
  const raw = error?.code;
  const grpc = typeof raw === 'number' ? raw : undefined;
  const text = String(raw ?? '');
  const msg = String(error?.message ?? '');
  if (grpc === 7 || text === 'permission-denied' || /PERMISSION_DENIED/.test(msg)) {
    return {
      status: 500,
      code: 'firestore_permission_denied',
      message:
        "The server's Firebase service account is not allowed to use Firestore. In Google Cloud Console -> IAM, give that service account the 'Cloud Datastore User' role, make sure the Cloud Firestore API is enabled, and make sure the key belongs to this Firebase project.",
    };
  }
  if (text === 'auth/insufficient-permission' || text === 'auth/internal-error' && /permission|identitytoolkit/i.test(msg)) {
    return {
      status: 500,
      code: 'auth_permission_denied',
      message:
        "The server's Firebase service account is not allowed to manage Firebase Authentication. In Google Cloud Console -> IAM, give it the 'Firebase Authentication Admin' role and enable the Identity Toolkit API.",
    };
  }
  if (grpc === 5 || text === 'not-found') {
    return {
      status: 500,
      code: 'firestore_not_found',
      message: 'The Firestore database was not found. Create the (default) Firestore database (Native mode) in the Firebase Console.',
    };
  }
  if (grpc === 16 || text === 'unauthenticated' || /invalid_grant|invalid_rapt/.test(msg)) {
    return {
      status: 500,
      code: 'service_account_rejected',
      message: 'Google rejected the server service-account key (revoked, deleted or malformed). Generate a new key and update FIREBASE_SERVICE_ACCOUNT_KEY on Vercel.',
    };
  }
  if (grpc === 14 || grpc === 4 || text === 'unavailable' || text === 'deadline-exceeded') {
    return { status: 503, code: 'upstream_unavailable', message: 'The database is temporarily unavailable. Please try again in a moment.' };
  }
  if (grpc === 8 || text === 'resource-exhausted') {
    return { status: 429, code: 'quota_exceeded', message: 'The service is busy right now. Please try again shortly.' };
  }
  return null;
}

/**
 * Turns any server-side failure (HttpError, Firestore gRPC errors, Admin SDK errors) into a status, a stable code and
 * a message that tells the operator exactly what to fix. Never includes secrets.
 */
export function describeServerError(error: any): ClassifiedError {
  if (error instanceof HttpError) return { status: error.status, code: error.code, message: error.message };
  const infra = matchInfraError(error);
  if (infra) return infra;
  return { status: 500, code: String(error?.code || 'server_error'), message: 'Unable to complete the request.' };
}

/**
 * Classifies ANY error thrown inside a route handler into the right HTTP status and a safe message:
 *  - HttpError / infrastructure failures keep their status and operator-friendly message,
 *  - plain `Error`s thrown by our own validation code ("Product not found.", "Not enough stock") are client errors
 *    (404 / 409 / 403 / 400) instead of a misleading 500,
 *  - anything else (TypeError, SDK internals) becomes a generic 500 so implementation details never leak.
 */
export function classifyError(error: any): ClassifiedError {
  if (error instanceof HttpError) return { status: error.status, code: error.code, message: error.message };
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message === 'Authentication required.') return { status: 401, code: 'unauthenticated', message };
  if (message === 'Administrator access required.') return { status: 403, code: 'not_admin', message };
  const infra = matchInfraError(error);
  if (infra) return infra;
  if (error?.code === 'auth/user-not-found') return { status: 404, code: 'user_not_found', message: 'That user account was not found.' };
  const plain = error && error.constructor === Error && !(error as any).code && message;
  if (plain) {
    let status = 400;
    if (/not found|no longer exist|disappeared|could not find|does not exist/i.test(message)) status = 404;
    else if (/enough stock|already|conflict|not currently available|no longer available|out of stock/i.test(message)) status = 409;
    else if (/do not own|not allowed|only .* can|forbidden|cannot .* own/i.test(message)) status = 403;
    return { status, code: 'request_rejected', message };
  }
  return { status: 500, code: String(error?.code || 'server_error'), message: 'Something went wrong on the server. Please try again.', opaque: true };
}

/** Maps a thrown failure to the right HTTP status (kept for existing call sites). */
export function authErrorStatus(error: any): number {
  return classifyError(error).status;
}

/** Client-safe message for a thrown failure (never leaks internals; `fallback` is used only for opaque 5xx errors). */
export function safeMessage(error: any, fallback?: string): string {
  const c = classifyError(error);
  return c.opaque && fallback ? fallback : c.message;
}

/** Reads a JSON request body; a malformed or missing body is a 400, not a 500. */
export async function readJsonBody<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
}
