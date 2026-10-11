import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionPlan, applySubscriptionToUser } from '@/lib/server/subscription-admin';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const planId = typeof body.planId === 'string' ? body.planId : '';
    if (!planId) return errorResponse('planId is required.');

    const db = getAdminDb();
    const userRef = db.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return errorResponse('Profile not found.', 404);
    const user = userSnap.data() || {};

    if (user.isAdmin === true) return errorResponse('Admin accounts do not use member subscriptions.', 403);
    if (!user.role || user.role === 'buyer') return errorResponse('Only business/service members can subscribe.', 403);

    const plan = await getSubscriptionPlan(planId);
    if (!plan) return errorResponse('Subscription plan not found or inactive.', 404);
    const hasActivePaidSubscription = user.subscriptionStatus === 'active' && !!user.stripeSubscriptionId;
    if (plan.price <= 0) {
      // Switching to a free plan locally would leave the Stripe subscription billing the member.
      if (hasActivePaidSubscription) return errorResponse('You have an active paid subscription. Use Manage Billing to cancel it before moving to a free plan.', 409);
      await applySubscriptionToUser(decoded.uid, plan, { status: 'active', source: 'system', grantedBy: null });
      return NextResponse.json({ success: true, activated: true, planId: plan.id });
    }

    if (hasActivePaidSubscription) {
      return errorResponse('You already have an active subscription. Use Manage Billing to change it without creating a second subscription.', 409);
    }

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return errorResponse('Stripe subscriptions are not configured on the server.', 503);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('success_url', `${appUrl}/dashboard/subscription?subscription=success&plan=${encodeURIComponent(plan.id)}`);
    params.set('cancel_url', `${appUrl}/dashboard/subscription?subscription=cancelled&plan=${encodeURIComponent(plan.id)}`);
    params.set('line_items[0][price_data][currency]', String(plan.currency || 'usd').toLowerCase());
    params.set('line_items[0][price_data][product_data][name]', `ConnectLocal ${plan.name}`);
    params.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(plan.price) * 100)));
    params.set('line_items[0][price_data][recurring][interval]', 'month');
    params.set('line_items[0][quantity]', '1');
    params.set('client_reference_id', decoded.uid);
    params.set('metadata[uid]', decoded.uid);
    params.set('metadata[planId]', plan.id);
    params.set('subscription_data[metadata][uid]', decoded.uid);
    params.set('subscription_data[metadata][planId]', plan.id);
    // Stripe rejects requests that send both `customer` and `customer_email`.
    if (user.stripeCustomerId) params.set('customer', String(user.stripeCustomerId));
    else if (user.email) params.set('customer_email', String(user.email));

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await response.json();
    if (!response.ok) return errorResponse(data?.error?.message || 'Stripe could not create the subscription checkout.', 502);

    await userRef.update({ pendingSubscriptionPlanId: plan.id, pendingSubscriptionSessionId: data.id, updatedAt: new Date() });
    return NextResponse.json({ success: true, checkoutUrl: data.url, sessionId: data.id, planId: plan.id });
  } catch (error: any) {
    console.error('Subscription checkout error:', error);
    return errorResponse(error?.message || 'Subscription checkout failed.', authErrorStatus(error));
  }
}
