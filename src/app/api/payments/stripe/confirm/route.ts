import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { requireOrderBuyer } from '@/lib/server/order-secrets';
import { applyPaymentEvent } from '@/lib/server/order-payments';
import { notifyOrderParties } from '@/lib/server/notifications';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || '');
    const guestKey = body.guestKey ? String(body.guestKey) : null;
    if (!orderId) return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });

    const db = getAdminDb();
    const access = await requireOrderBuyer(db, request, orderId, guestKey);
    const order = access.order as any;
    if (order.paymentMethod !== 'stripe') return NextResponse.json({ error: 'This order does not use Stripe.' }, { status: 409 });
    if (order.status !== 'pending_payment') return NextResponse.json({ success: true, status: order.status });

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
    if (!order.paymentSessionId) return NextResponse.json({ error: 'Stripe checkout session is missing.' }, { status: 409 });

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(String(order.paymentSessionId))}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
    const session = await response.json();
    if (!response.ok) return NextResponse.json({ error: session?.error?.message || 'Could not verify the Stripe payment.' }, { status: 502 });
    if (session.metadata?.orderId !== orderId) return NextResponse.json({ error: 'Stripe session does not belong to this order.' }, { status: 409 });
    if (session.payment_status !== 'paid') return NextResponse.json({ success: true, status: 'pending_payment', paymentStatus: session.payment_status || 'pending' });

    const result = await applyPaymentEvent(db, orderId, 'paid', {
      provider: 'stripe',
      sessionId: session.id,
      transactionId: session.payment_intent || null,
    }, {
      amountMinor: typeof session.amount_total === 'number' ? session.amount_total : null,
      currency: session.currency || null,
    });
    if (result.mismatch) return NextResponse.json({ error: 'The paid amount does not match the order.' }, { status: 409 });
    if (result.changed) await notifyOrderParties({ ...result.order, id: orderId }, { title: 'Payment received', body: `Payment for order ${orderId} was confirmed.`, type: 'payment_received' });
    return NextResponse.json({ success: true, status: 'paid' });
  } catch (error: any) {
    console.error('Stripe confirmation error:', error);
    return NextResponse.json({ error: error?.message || 'Payment confirmation failed.' }, { status: 500 });
  }
}
