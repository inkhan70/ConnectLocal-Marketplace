import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { notifyOrderParties } from '@/lib/server/notifications';
import { applyPaymentEvent } from '@/lib/server/order-payments';
import { parseSafepayEvent, verifySafepaySignature } from '@/lib/server/safepay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/safepay/webhook
 * The ONLY thing that marks a Safepay order as paid. The browser (or the customer returning from Safepay) can never
 * declare a payment successful: we verify the HMAC signature, find OUR order by the tracker we stored when the payment
 * was created, and then check the paid amount and currency against the order before it is marked paid.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'Safepay webhook is not configured.' }, { status: 503 });

    const raw = await request.text();
    if (!verifySafepaySignature(raw, request.headers.get('x-sfpy-signature'), secret)) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    let body: any;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 }); }
    const db = getAdminDb();
    await db.collection('paymentProviderConfigs').doc('safepay_GLOBAL').set({ providerId: 'safepay', country: 'GLOBAL', webhookVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
    const event = parseSafepayEvent(body);
    if (!event) return NextResponse.json({ received: true, ignored: 'no tracker' });

    const found = await db.collection('orders').where('paymentTracker', '==', event.tracker).limit(1).get();
    if (found.empty) return NextResponse.json({ error: 'Order not found for this tracker.' }, { status: 404 }); // Safepay retries
    const orderId = found.docs[0].id;
    if (found.docs[0].data().paymentMethod !== 'safepay') return NextResponse.json({ received: true, ignored: 'not a Safepay order' });

    const failureStates = new Set(['FAILED', 'DECLINED', 'CANCELLED', 'CANCELED', 'EXPIRED']);
    const refundStates = new Set(['REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK']);
    if (event.state === 'PAID' && (event.amountMinor == null || !event.currency)) return NextResponse.json({ error: 'Safepay event is missing amount or currency.' }, { status: 422 });
    if (event.state !== 'PAID' && !failureStates.has(event.state) && !refundStates.has(event.state)) return NextResponse.json({ received: true, ignored: `state ${event.state || 'unknown'}` });

    const kind: 'paid' | 'refunded' | 'failed' = event.state === 'PAID' ? 'paid' : refundStates.has(event.state) ? 'refunded' : 'failed';
    const result = await applyPaymentEvent(
      db, orderId, kind,
      { provider: 'safepay', sessionId: event.tracker, transactionId: event.reference, providerFeeMinor: event.feeMinor, providerNetMinor: event.netMinor },
      kind === 'paid' ? { amountMinor: event.amountMinor, currency: event.currency } : undefined,
    );
    if (result.mismatch) console.error(`Safepay payment for order ${orderId} did not match the order total/currency; order left unpaid and flagged.`);
    if (result.changed) {
      const title = kind === 'paid' ? 'Payment received' : kind === 'refunded' ? 'Payment refunded' : 'Payment failed';
      await notifyOrderParties({ ...result.order, id: orderId }, { title, body: `Payment for order ${orderId} was ${kind === 'paid' ? 'confirmed' : kind}.`, type: kind === 'paid' ? 'payment_received' : 'payment_failed' });
    }
    return NextResponse.json({ received: true, changed: result.changed });
  } catch (error) {
    console.error('Safepay webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
