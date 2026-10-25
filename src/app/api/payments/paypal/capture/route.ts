import { NextRequest, NextResponse } from 'next/server';
import { classifyError, getAdminDb, readJsonBody } from '@/lib/server/firebase-admin';
import { requireOrderBuyer } from '@/lib/server/order-secrets';
import { applyPaymentEvent } from '@/lib/server/order-payments';
import { notifyOrderParties } from '@/lib/server/notifications';

export const runtime = 'nodejs';

async function paypalToken() {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const base = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
  if (!client || !secret) throw Object.assign(new Error('PayPal is not configured.'), { code: 'paypal_not_configured' });
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error('PayPal authentication failed.'), { code: 'paypal_auth_failed' });
  return { token: data.access_token as string, base };
}

/**
 * POST /api/payments/paypal/capture  { orderId, paypalOrderId, guestKey? }
 * PayPal only authorises the payment when the customer approves it; the money moves when the merchant CAPTURES it.
 * This endpoint (called when PayPal returns the customer to the site) captures server-side, verifies amount, currency
 * and reference against OUR order, and only then marks the order paid. The browser never decides that.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, paypalOrderId, guestKey } = await readJsonBody(request);
    if (!orderId || !paypalOrderId) return NextResponse.json({ error: 'orderId and paypalOrderId are required.' }, { status: 400 });
    const db = getAdminDb();
    const access = await requireOrderBuyer(db, request, String(orderId), guestKey ? String(guestKey) : null);
    const order = access.order;
    if (order.paymentMethod !== 'paypal') return NextResponse.json({ error: 'This order is not a PayPal order.' }, { status: 409 });
    if (order.paymentOrderId !== String(paypalOrderId)) return NextResponse.json({ error: 'This PayPal payment does not belong to the order.' }, { status: 409 });
    if (order.paymentStatus === 'paid') return NextResponse.json({ success: true, status: order.status, alreadyPaid: true });

    const { token, base } = await paypalToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let response = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(String(paypalOrderId))}/capture`, { method: 'POST', headers: { ...headers, 'PayPal-Request-Id': `capture_${String(orderId)}` }, body: '{}' });
    let data: any = await response.json().catch(() => ({}));
    if (!response.ok && (data?.details || []).some((d: any) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
      response = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(String(paypalOrderId))}`, { headers });
      data = await response.json().catch(() => ({}));
    }
    if (!response.ok) return NextResponse.json({ error: 'PayPal could not capture the payment. You have not been charged; please try again.' }, { status: 502 });
    if (data.status !== 'COMPLETED') return NextResponse.json({ error: `The PayPal payment is ${String(data.status || 'not complete').toLowerCase()}.` }, { status: 409 });

    const unit = (data.purchase_units || [])[0] || {};
    const capture = (unit.payments?.captures || [])[0] || {};
    if (unit.reference_id && unit.reference_id !== String(orderId)) return NextResponse.json({ error: 'PayPal reference mismatch.' }, { status: 409 });
    const amountMinor = Math.round(Number(capture.amount?.value) * 100);
    const result = await applyPaymentEvent(db, String(orderId), 'paid', { provider: 'paypal', transactionId: capture.id || null }, { amountMinor, currency: capture.amount?.currency_code });
    if (result.mismatch) return NextResponse.json({ error: 'The captured amount does not match the order. Support has been flagged.' }, { status: 409 });
    if (result.changed) await notifyOrderParties({ ...order, id: String(orderId) }, { title: 'Payment received', body: `Order ${orderId} has been paid.`, type: 'payment_confirmed' });
    return NextResponse.json({ success: true, status: 'paid' });
  } catch (error: any) {
    console.error('PayPal capture failed:', error);
    const c = classifyError(error);
    return NextResponse.json({ error: c.message, code: c.code }, { status: c.status });
  }
}
