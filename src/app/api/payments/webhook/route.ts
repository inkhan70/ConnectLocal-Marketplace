import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { notifyOrderParties } from '@/lib/server/notifications';
import { applyPaymentEvent, type PaymentEventKind } from '@/lib/server/order-payments';

export const runtime = 'nodejs';

function secretMatches(provided: string | null, secret: string) {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'Payment webhook is not configured.' }, { status: 503 });
    if (!secretMatches(request.headers.get('x-payment-webhook-secret'), secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

    const event = await request.json();
    const orderId = String(event.orderId || '');
    const status = String(event.status || '') as PaymentEventKind;
    if (!orderId || !['paid', 'failed', 'refunded'].includes(status)) return NextResponse.json({ error: 'Invalid payment event.' }, { status: 400 });

    const result = await applyPaymentEvent(getAdminDb(), orderId, status, { provider: event.provider, transactionId: event.transactionId || null });
    if (!result.found) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    if (result.changed) {
      await notifyOrderParties({ ...result.order, id: orderId }, { title: `Payment ${status}`, body: `Payment status for order ${orderId}: ${status}.`, type: 'payment_status' });
    }
    return NextResponse.json({ success: true, changed: result.changed });
  } catch (error: any) {
    console.error('Payment webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
