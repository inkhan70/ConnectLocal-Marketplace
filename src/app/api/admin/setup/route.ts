import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminAuth, getAdminDb, requireAdmin } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

/**
 * Promote/demote an account only when the caller is already an admin.
 * Initial promotion should use the one-time local scripts/promote-admin.cjs utility.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = getAdminDb();

    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const enabled = body.setAdmin !== false;
    if (!uid) return NextResponse.json({ error: 'uid is required.' }, { status: 400 });

    const auth = getAdminAuth();
    const target = await auth.getUser(uid);
    const targetRef = db.collection('users').doc(uid);
    const targetDoc = await targetRef.get();

    if (!enabled && targetDoc.data()?.isAdmin === true) {
      const admins = await db.collection('users').where('isAdmin', '==', true).get();
      if (admins.size <= 1) return NextResponse.json({ error: 'The last administrator cannot be removed.' }, { status: 409 });
    }

    await targetRef.set({ isAdmin: enabled, updatedAt: new Date().toISOString() }, { merge: true });
    await auth.setCustomUserClaims(uid, { ...(target.customClaims || {}), isAdmin: enabled, ...(enabled ? { role: 'admin' } : (target.customClaims?.role === 'admin' ? { role: 'business' } : {})) });
    return NextResponse.json({ success: true, uid, isAdmin: enabled });
  } catch (error: any) {
    console.error('Admin setup failed:', error);
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : 'Unable to update admin status.' }, { status });
  }
}
