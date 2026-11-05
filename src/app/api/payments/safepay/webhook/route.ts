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
    const event = parseSafepayEvent(body);
    if (!event) return NextResponse.json({ received: true, ignored: 'no tracker' });

    const db = getAdminDb();
    const found = await db.collection('orders').where('paymentTracker', '==', event.tracker).limit(1).get();
    if (found.empty) return NextResponse.json({ error: 'Order not found for this tracker.' }, { status: 404 }); // Safepay retries
    const orderId = found.docs[0].id;
    if (found.docs[0].data().paymentMethod !== 'safepay') return NextResponse.json({ received: true, ignored: 'not a Safepay order' });

    if (event.state !== 'PAID') return NextResponse.json({ received: true, ignored: `state ${event.state || 'unknown'}` });

    const result = await applyPaymentEvent(
      db, orderId, 'paid',
      { provider: 'safepay', sessionId: event.tracker, transactionId: event.reference, providerFeeMinor: event.feeMinor, providerNetMinor: event.netMinor },
      { amountMinor: event.amountMinor, currency: event.currency },
    );
    if (result.mismatch) console.error(`Safepay payment for order ${orderId} did not match the order total/currency; order left unpaid and flagged.`);
    if (result.changed) {
      await notifyOrderParties({ ...result.order, id: orderId }, { title: 'Payment received', body: `Payment for order ${orderId} was confirmed.`, type: 'payment_received' });
    }
    return NextResponse.json({ received: true, changed: result.changed });
  } catch (error) {
    console.error('Safepay webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
