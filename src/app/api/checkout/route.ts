import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import type { DocumentReference } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

type Method = 'jazzcash' | 'easypaisa' | 'stripe' | 'paypal' | 'cod';

function jsonError(message: string, status = 400) { return NextResponse.json({ success: false, error: message }, { status }); }

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const { orderId } = await request.json();
    if (!orderId) return jsonError('orderId is required.');

    const db = getAdminDb();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Order not found.', 404);
    const order: any = snap.data();
    if (order.buyerId !== decoded.uid) return jsonError('You do not own this order.', 403);
    if (order.status !== 'pending_payment') return jsonError('This order does not require payment.', 409);

    const method = order.paymentMethod as Method;
    if (method === 'cod') {
      await ref.update({ paymentStatus: 'cod_pending', status: 'paid', updatedAt: new Date() });
      return NextResponse.json({ success: true, provider: 'cod', status: 'paid' });
    }

    if (method === 'stripe') return createStripePayment(ref, order);
    if (method === 'paypal') return createPayPalPayment(ref, order);
    if (method === 'jazzcash' || method === 'easypaisa') {
      const configured = process.env[`${method.toUpperCase()}_CHECKOUT_URL`];
      if (!configured) return jsonError(`${method === 'jazzcash' ? 'JazzCash' : 'Easypaisa'} sandbox credentials/checkout endpoint are not configured yet. The order remains safely pending payment.`, 503);
      return jsonError('The selected wallet adapter is configured by the merchant but its provider-specific signing/field mapping must be supplied before production activation.', 503);
    }
    return jsonError('Unsupported payment method.');
  } catch (error: any) {
    console.error('Checkout error:', error);
    return jsonError(error?.message || 'Payment processing failed.', authErrorStatus(error));
  }
}

async function createStripePayment(ref: DocumentReference, order: any) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return jsonError('Stripe sandbox is not configured. Set STRIPE_SECRET_KEY on the server.', 503);
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/orders?payment=success&orderId=${encodeURIComponent(order.id)}`);
  params.set('cancel_url', `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/orders?payment=cancelled&orderId=${encodeURIComponent(order.id)}`);
  params.set('line_items[0][price_data][currency]', String(order.currency || process.env.MARKETPLACE_CURRENCY || 'usd').toLowerCase());
  params.set('line_items[0][price_data][product_data][name]', `ConnectLocal order ${order.id}`);
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(Number(order.totalCost) * 100)));
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[orderId]', String(order.id));
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const data = await response.json();
  if (!response.ok) return jsonError(data?.error?.message || 'Stripe could not create the payment.', 502);
  await ref.update({ paymentProvider: 'stripe', paymentSessionId: data.id, updatedAt: new Date() });
  return NextResponse.json({ success: true, provider: 'stripe', checkoutUrl: data.url, paymentSessionId: data.id });
}

async function createPayPalPayment(ref: DocumentReference, order: any) {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const base = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
  if (!client || !secret) return jsonError('PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server.', 503);

  const basic = Buffer.from(`${client}:${secret}`).toString('base64');
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) return jsonError('PayPal authentication failed.', 502);

  const currency = String(order.currency || process.env.MARKETPLACE_CURRENCY || 'USD').toUpperCase();
  const paymentResponse = await fetch(`${base}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, amount: { currency_code: currency, value: Number(order.totalCost).toFixed(2) }, description: `ConnectLocal order ${order.id}` }] }) });
  const paymentData = await paymentResponse.json();
  if (!paymentResponse.ok) return jsonError('PayPal could not create the payment.', 502);
  await ref.update({ paymentProvider: 'paypal', paymentOrderId: paymentData.id, updatedAt: new Date() });
  return NextResponse.json({ success: true, provider: 'paypal', orderId: paymentData.id, links: paymentData.links || [] });
}
