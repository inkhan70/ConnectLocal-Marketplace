import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { applySubscriptionToUser, deactivateSubscription, getSubscriptionPlan, recordSubscriptionAdminAction } from '@/lib/server/subscription-admin';
import { getSubscriptionStatus } from '@/lib/subscription-domain';

export const runtime = 'nodejs';

async function requireAdmin(request: NextRequest) {
  const decoded = await verifyBearerToken(request);
  const db = getAdminDb();
  const snap = await db.collection('users').doc(decoded.uid).get();
  if (decoded.isAdmin !== true && snap.data()?.isAdmin !== true) throw new Error('Administrator access required.');
  return decoded;
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === 'string' ? body.uid : '';
    const planId = typeof body.planId === 'string' ? body.planId : '';
    if (!uid) return NextResponse.json({ error: 'uid is required.' }, { status: 400 });

    const targetSnap = await getAdminDb().collection('users').doc(uid).get();
    if (!targetSnap.exists) return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    const target = targetSnap.data() || {};

    if (!planId) {
      if (target.subscriptionSource === 'stripe' && target.subscriptionStatus === 'active' && target.stripeSubscriptionId) {
        return NextResponse.json({ error: 'This is a payment-backed subscription. Use billing management or the payment cancellation flow instead of an administrator revoke.' }, { status: 409 });
      }
      await deactivateSubscription(uid, { source: 'admin', grantedBy: decoded.uid });
      await recordSubscriptionAdminAction({ actorUid: decoded.uid, targetUid: uid, action: 'revoke' });
      return NextResponse.json({ success: true, status: 'inactive', source: 'admin' });
    }

    const plan = await getSubscriptionPlan(planId);
    if (!plan) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    if (target.subscriptionSource === 'stripe' && target.subscriptionStatus === 'active' && target.stripeSubscriptionId) {
      return NextResponse.json({ error: 'This member already has an active paid subscription. Manage or cancel the payment subscription before applying an administrator grant.' }, { status: 409 });
    }
    const parseDate = (value: unknown): string | null | undefined => {
      if (typeof value !== 'string' || !value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    };
    const parsedStart = parseDate(body.startDate);
    const parsedEnd = parseDate(body.endDate);
    if (parsedStart === undefined || parsedEnd === undefined) return NextResponse.json({ error: 'Start or end date is not a valid date.' }, { status: 400 });
    const startDate = parsedStart || new Date().toISOString();
    const endDate = parsedEnd;
    if (endDate && new Date(endDate).getTime() <= new Date(startDate).getTime()) return NextResponse.json({ error: 'End date must be after the start date.' }, { status: 400 });
    const status = getSubscriptionStatus(startDate, endDate);
    await applySubscriptionToUser(uid, plan, {
      status,
      startDate,
      endDate,
      cancelAtPeriodEnd: false,
      source: 'admin',
      grantedBy: decoded.uid,
    });
    await recordSubscriptionAdminAction({
      actorUid: decoded.uid,
      targetUid: uid,
      action: 'grant',
      planId: plan.id,
      startDate,
      endDate,
    });
    return NextResponse.json({ success: true, planId: plan.id, source: 'admin' });
  } catch (error: any) {
    const status = error?.message === 'Administrator access required.' ? 403 : authErrorStatus(error);
    return NextResponse.json({ error: error?.message || 'Subscription assignment failed.' }, { status });
  }
}
