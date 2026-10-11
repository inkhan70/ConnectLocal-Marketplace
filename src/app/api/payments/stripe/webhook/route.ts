import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { notifyOrderParties } from '@/lib/server/notifications';
import { applyPaymentEvent } from '@/lib/server/order-payments';
import { applySubscriptionToUser, deactivateSubscription, getSubscriptionPlan } from '@/lib/server/subscription-admin';

function verifyStripeSignature(raw: string, header: string, secret: string) {
  const timestamp = header.split(',').map((part) => part.trim()).find((part) => part.startsWith('t='))?.slice(2);
  const signatures = header.split(',').map((part) => part.trim()).filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return signatures.some((signature) => signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}

function subscriptionStatusFromStripe(status: string): 'active' | 'inactive' | 'expired' | 'past_due' | 'cancelled' {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  if (status === 'canceled') return 'cancelled';
  return 'inactive';
}

async function findUserByStripeSubscription(subscriptionId: string) {
  const db = getAdminDb();
  const snap = await db.collection('users').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
}

async function retrieveStripeSubscription(subscriptionId: string) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function handleSubscriptionEvent(event: any) {
  const object = event.data?.object || {};
  let subscription = object;
  let uid = object.metadata?.uid || object.client_reference_id;
  let planId = object.metadata?.planId;
  let subscriptionId = object.id || object.subscription;

  if (event.type === 'checkout.session.completed') {
    if (object.mode !== 'subscription' || !object.subscription) return false;
    subscriptionId = object.subscription;
    const retrieved = await retrieveStripeSubscription(String(subscriptionId));
    if (retrieved) subscription = retrieved;
    uid = uid || subscription.metadata?.uid;
    planId = planId || subscription.metadata?.planId;
  }

  let userDoc = uid ? getAdminDb().collection('users').doc(String(uid)) : null;
  if (!userDoc && subscriptionId) userDoc = await findUserByStripeSubscription(String(subscriptionId));
  if (!userDoc) return false;

  const userSnap = await userDoc.get();
  if (!userSnap.exists) return false;
  const user = userSnap.data() || {};
  uid = userSnap.id;

  if (event.type === 'customer.subscription.deleted') {
    await deactivateSubscription(uid);
    return true;
  }

  if (!planId && user.subscriptionPlanId) planId = user.subscriptionPlanId;
  if (!planId) return false;
  const plan = await getSubscriptionPlan(String(planId));
  if (!plan) return false;

  const periodEnd = Number(subscription.current_period_end || 0);
  const start = Number(subscription.start_date || subscription.created || Math.floor(Date.now() / 1000));
  await applySubscriptionToUser(uid, plan, {
    status: subscriptionStatusFromStripe(String(subscription.status || 'active')),
    startDate: new Date(start * 1000).toISOString(),
    endDate: periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null,
    stripeCustomerId: subscription.customer ? String(subscription.customer) : (user.stripeCustomerId || null),
    stripeSubscriptionId: String(subscriptionId),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    source: 'stripe',
    grantedBy: null,
  });
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
    const raw = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature || !verifyStripeSignature(raw, signature, secret)) return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 401 });
    const event = JSON.parse(raw);

    const subscriptionEvents = new Set([
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]);
    if (subscriptionEvents.has(event.type) && (event.type !== 'checkout.session.completed' || event.data?.object?.mode === 'subscription')) {
      await handleSubscriptionEvent(event);
      return NextResponse.json({ received: true });
    }

    const object = event.data?.object || {};
    const db = getAdminDb();

    // Refunds are reported on the charge, which carries the PaymentIntent id we stored on the order.
    if (event.type === 'charge.refunded') {
      const paymentIntent = object.payment_intent ? String(object.payment_intent) : '';
      if (!paymentIntent || object.refunded !== true) return NextResponse.json({ received: true });
      const orderSnap = await db.collection('orders').where('paymentTransactionId', '==', paymentIntent).limit(1).get();
      if (orderSnap.empty) return NextResponse.json({ received: true });
      const refundedOrderId = orderSnap.docs[0].id;
      const refunded = await applyPaymentEvent(db, refundedOrderId, 'refunded', { provider: 'stripe', transactionId: paymentIntent });
      if (refunded.changed) await notifyOrderParties({ ...refunded.order, id: refundedOrderId }, { title: 'Refund completed', body: `Order ${refundedOrderId} has been refunded.`, type: 'refund_completed' });
      return NextResponse.json({ received: true });
    }

    const orderId = object.metadata?.orderId;
    if (!orderId) return NextResponse.json({ received: true });

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      // 'completed' can fire before delayed payment methods have actually settled.
      if (object.payment_status && object.payment_status !== 'paid') return NextResponse.json({ received: true });
      const result = await applyPaymentEvent(db, String(orderId), 'paid',
        { provider: 'stripe', sessionId: object.id, transactionId: object.payment_intent || null },
        { amountMinor: typeof object.amount_total === 'number' ? object.amount_total : null, currency: object.currency || null });
      if (!result.found) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      if (result.mismatch) console.error(`Stripe payment for order ${orderId} did not match the order total/currency; order left unpaid and flagged.`);
      if (result.changed) await notifyOrderParties({ ...result.order, id: orderId }, { title: 'Payment received', body: `Payment for order ${orderId} was confirmed.`, type: 'payment_received' });
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const result = await applyPaymentEvent(db, String(orderId), 'failed', { provider: 'stripe', sessionId: object.id });
      if (!result.found) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      if (result.changed) await notifyOrderParties({ ...result.order, id: orderId }, { title: 'Payment not completed', body: `Payment for order ${orderId} expired and the order was cancelled.`, type: 'payment_status' });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
