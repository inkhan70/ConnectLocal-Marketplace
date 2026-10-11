import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authErrorStatus, getAdminAuth, getAdminDb, requireAdmin } from '@/lib/server/firebase-admin';

const ROLES = ['buyer', 'company', 'wholesaler', 'distributor', 'shopkeeper', 'services'] as const;

// Keep the dashboard layout consistent with the role (client rules forbid users from changing it themselves).
const DEFAULT_DASHBOARD: Record<string, string> = { buyer: 'buyer', company: 'business', wholesaler: 'business', distributor: 'business', shopkeeper: 'shopkeeper', services: 'services' };
const GENERIC_DASHBOARDS = new Set(['buyer', 'business', 'shopkeeper']);

export async function POST(request: NextRequest) {
  try {
    // Admin if the token claim OR the Firestore profile flag says so (and the two are re-synced).
    const decoded = await requireAdmin(request);
    const db = getAdminDb();

    const body = await request.json();
    const uid = String(body.uid || '');
    const action = String(body.action || '');
    if (!uid) return NextResponse.json({ error: 'uid is required.' }, { status: 400 });

    const ref = db.collection('users').doc(uid);
    const target = await ref.get();
    if (!target.exists) return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });

    if (action === 'set_role') {
      const role = String(body.role || '');
      if (!ROLES.includes(role as any)) return NextResponse.json({ error: 'Invalid member role.' }, { status: 400 });
      const currentDashboard = String(target.data()?.dashboardType || '');
      // A services member keeps a specialised dashboard (health, food, ...) if they already have one.
      const dashboardType = role === 'services' && currentDashboard && !GENERIC_DASHBOARDS.has(currentDashboard) ? currentDashboard : DEFAULT_DASHBOARD[role];
      await ref.update({ role, dashboardType, needsRoleSelection: false, roleSelectionCompleted: true, updatedAt: new Date().toISOString(), audit: FieldValue.arrayUnion({ action: 'role_changed', actorId: decoded.uid, role, at: new Date().toISOString() }) });
      return NextResponse.json({ success: true, role });
    }

    if (action === 'set_admin') {
      const enabled = body.enabled === true;
      if (!enabled && target.data()?.isAdmin === true) {
        const admins = await db.collection('users').where('isAdmin', '==', true).get();
        if (admins.size <= 1) return NextResponse.json({ error: 'The last administrator cannot be removed.' }, { status: 409 });
      }
      await ref.update({ isAdmin: enabled, updatedAt: new Date().toISOString(), audit: FieldValue.arrayUnion({ action: enabled ? 'admin_granted' : 'admin_revoked', actorId: decoded.uid, at: new Date().toISOString() }) });
      const authUser = await getAdminAuth().getUser(uid);
      await getAdminAuth().setCustomUserClaims(uid, {
        ...(authUser.customClaims || {}),
        isAdmin: enabled,
        ...(enabled ? { role: 'admin' } : (authUser.customClaims?.role === 'admin' ? { role: 'business' } : {})),
      });
      return NextResponse.json({ success: true, isAdmin: enabled });
    }

    if (action === 'set_permissions') {
      if (!Array.isArray(body.permissions) || body.permissions.some((p: unknown) => typeof p !== 'string')) return NextResponse.json({ error: 'permissions must be an array of strings.' }, { status: 400 });
      const permissions = [...new Set(body.permissions as string[])].slice(0, 100);
      await ref.update({ permissions, updatedAt: new Date().toISOString(), audit: FieldValue.arrayUnion({ action: 'permissions_changed', actorId: decoded.uid, permissions, at: new Date().toISOString() }) });
      return NextResponse.json({ success: true, permissions });
    }

    if (action === 'delete') {
      if (uid === decoded.uid) return NextResponse.json({ error: 'An administrator cannot delete their own account from this panel.' }, { status: 409 });
      if (target.data()?.isAdmin === true) {
        const admins = await db.collection('users').where('isAdmin', '==', true).get();
        if (admins.size <= 1) return NextResponse.json({ error: 'The last administrator cannot be deleted.' }, { status: 409 });
      }
      try {
        await getAdminAuth().deleteUser(uid);
      } catch (error: any) {
        // The Auth account may already be gone; the profile must still be cleaned up.
        if (error?.code !== 'auth/user-not-found') throw error;
      }
      // Do not leave the removed member's listings purchasable (checkout would fail with "seller not found").
      const listings = await db.collection('products').where('userId', '==', uid).get();
      for (let i = 0; i < listings.docs.length; i += 400) {
        const batch = db.batch();
        listings.docs.slice(i, i + 400).forEach(doc => batch.update(doc.ref, { status: 'Archived', updatedAt: FieldValue.serverTimestamp() }));
        await batch.commit();
      }
      await ref.delete();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown admin action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin user action failed:', error);
    const status = authErrorStatus(error);
    return NextResponse.json({ error: error?.message || 'Admin action failed.' }, { status });
  }
}
