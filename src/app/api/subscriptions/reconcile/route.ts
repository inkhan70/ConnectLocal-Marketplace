import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionPlan, applySubscriptionToUser } from '@/lib/server/subscription-admin';
import { authErrorStatus, getAdminDb, safeMessage, verifyBearerToken } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

function statusFromStripe(status: string) {
  if (status === 'active' || status === 'trialing') return 'active' as const;
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due' as const;
  if (status === 'canceled') return 'cancelled' as const;
  return 'inactive' as const;
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId || !sessionId.startsWith('cs_')) return NextResponse.json({ success: false, error: 'A valid checkout session is required.' }, { status: 400 });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ success: false, error: 'Stripe subscriptions are not configured on the server.' }, { status: 503 });
    const sessionResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, { headers: { Authorization: `Bearer ${secret}` } });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok) return NextResponse.json({ success: false, error: 'Could not verify the Stripe checkout session.' }, { status: 502 });
    if (session.client_reference_id !== decoded.uid && session.metadata?.uid !== decoded.uid) return NextResponse.json({ success: false, error: 'Checkout session does not belong to this account.' }, { status: 403 });
    if (session.mode !== 'subscription' || session.payment_status !== 'paid' || !session.subscription) return NextResponse.json({ success: true, activated: false, pending: true });

    const subscription = typeof session.subscription === 'object' ? session.subscription : null;
    if (!subscription?.id) return NextResponse.json({ success: true, activated: false, pending: true });
    const planId = session.metadata?.planId || subscription.metadata?.planId;
    const plan = planId ? await getSubscriptionPlan(String(planId)) : null;
    if (!plan) return NextResponse.json({ success: false, error: 'The paid plan could not be verified.' }, { status: 409 });

    const userRef = getAdminDb().collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    const user = userSnap.data() || {};
    const periodEnd = Number(subscription.current_period_end || 0);
    const start = Number(subscription.start_date || subscription.created || Math.floor(Date.now() / 1000));
    await applySubscriptionToUser(decoded.uid, plan, {
      status: statusFromStripe(String(subscription.status || 'active')),
      startDate: new Date(start * 1000).toISOString(),
      endDate: periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null,
      stripeCustomerId: subscription.customer ? String(subscription.customer) : (user.stripeCustomerId || null),
      stripeSubscriptionId: String(subscription.id),
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      source: 'stripe',
      grantedBy: null,
    });
    return NextResponse.json({ success: true, activated: true, planId: plan.id });
  } catch (error: any) {
    console.error('Subscription reconciliation error:', error);
    return NextResponse.json({ success: false, error: safeMessage(error, 'Subscription reconciliation failed.') }, { status: authErrorStatus(error) });
  }
}
