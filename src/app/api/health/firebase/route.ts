import { NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';
import { describeServerError, getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Open https://<your-site>/api/health/firebase to see, in one place, whether the server can reach Firebase.
 * Returns only pass/fail flags and error codes - never keys or user data.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; code?: string; message?: string }> = {
    serviceAccountKey: { ok: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY },
  };
  if (!checks.serviceAccountKey.ok) checks.serviceAccountKey.message = 'FIREBASE_SERVICE_ACCOUNT_KEY is not set on this deployment.';

  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = { ok: true };
    } catch (error: any) {
      const d = describeServerError(error);
      checks[name] = { ok: false, code: d.code, message: d.message };
    }
  };

  if (checks.serviceAccountKey.ok) {
    await run('adminInit', async () => { getAdminDb(); });
    if (checks.adminInit.ok) {
      await run('firestoreRead', async () => { await getAdminDb().collection('app_config').limit(1).get(); });
      await run('authAdmin', async () => { await getAdminAuth().listUsers(1); });
    }
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, webProjectId: firebaseConfig.projectId, checks }, { status: ok ? 200 : 500 });
}
