import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, safeMessage, readJsonBody } from '@/lib/server/firebase-admin';
import { requireOrderBuyer } from '@/lib/server/order-secrets';
import { isPaymentMethodEnabled } from '@/lib/server/payment-config';
import type { DocumentReference } from 'firebase-admin/firestore';
import { getAppUrl } from '@/lib/server/app-url';

export const runtime = 'nodejs';

type Method = 'jazzcash' | 'easypaisa' | 'stripe' | 'paypal' | 'cod';

function jsonError(message: string, status = 400) { return NextResponse.json({ success: false, error: message }, { status }); }

export async function POST(request: NextRequest) {
  try {
    const { orderId, guestKey } = await readJsonBody(request);
    if (!orderId) return jsonError('orderId is required.');

    // The buyer is either a signed-in account (Bearer token) or a guest holding the order's guest key.
    const db = getAdminDb();
    const access = await requireOrderBuyer(db, request, String(orderId), guestKey ? String(guestKey) : null);
    const ref = db.collection('orders').doc(String(orderId));
    const order: any = access.order;
    const snap = { id: String(orderId) };
    const returnPath = access.kind === 'guest'
      ? { success: `/track-order?orderId=${encodeURIComponent(snap.id)}&k=${encodeURIComponent(String(guestKey))}&payment=success`, cancel: `/track-order?orderId=${encodeURIComponent(snap.id)}&k=${encodeURIComponent(String(guestKey))}&payment=cancelled` }
      : { success: `/dashboard/orders?payment=success&orderId=${encodeURIComponent(snap.id)}`, cancel: `/dashboard/orders?payment=cancelled&orderId=${encodeURIComponent(snap.id)}` };
    if (order.status !== 'pending_payment') return jsonError('This order does not require payment.', 409);

    const method = order.paymentMethod as Method;
    const total = Number(order.totalCost);
    const currency = String(order.currency || process.env.MARKETPLACE_CURRENCY || 'USD').trim().toUpperCase();
    if (!Number.isFinite(total) || total <= 0 || total > 10_000_000) return jsonError('The order total is invalid.', 422);
    if (!/^[A-Z]{3}$/.test(currency)) return jsonError('The order currency is invalid.', 422);
    if (method === 'cod') {
      await ref.update({ paymentStatus: 'cod_pending', status: 'paid', updatedAt: new Date() });
      return NextResponse.json({ success: true, provider: 'cod', status: 'paid' });
    }

    if (!isPaymentMethodEnabled(method)) return jsonError('This payment method is not available right now. Please choose another one.', 503);
    const appUrl = getAppUrl(request);
    if (method === 'stripe') return createStripePayment(ref, order, snap.id, appUrl, returnPath);
    if (method === 'paypal') return createPayPalPayment(ref, order, snap.id, appUrl, returnPath);
    if (method === 'jazzcash' || method === 'easypaisa') {
      const configured = process.env[`${method.toUpperCase()}_CHECKOUT_URL`];
      if (!configured) return jsonError(`${method === 'jazzcash' ? 'JazzCash' : 'Easypaisa'} sandbox credentials/checkout endpoint are not configured yet. The order remains safely pending payment.`, 503);
      return jsonError('The selected wallet adapter is configured by the merchant but its provider-specific signing/field mapping must be supplied before production activation.', 503);
    }
    return jsonError('Unsupported payment method.');
  } catch (error: any) {
    console.error('Checkout error:', error);
    return jsonError(safeMessage(error, 'Payment processing failed.'), authErrorStatus(error));
  }
}

async function createStripePayment(ref: DocumentReference, order: any, orderId: string, appUrl: string, returnPath: { success: string; cancel: string }) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const total = Number(order.totalCost);
  const currency = String(order.currency || process.env.MARKETPLACE_CURRENCY || 'USD').trim().toUpperCase();
  if (!secret) return jsonError('Stripe sandbox is not configured. Set STRIPE_SECRET_KEY on the server.', 503);
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${appUrl}${returnPath.success}`);
  params.set('cancel_url', `${appUrl}${returnPath.cancel}`);
  params.set('line_items[0][price_data][currency]', currency.toLowerCase());
  params.set('line_items[0][price_data][product_data][name]', `ConnectLocal order ${orderId}`);
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(total * 100)));
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[orderId]', String(orderId));
  // Copy the order id onto the PaymentIntent too. Some Stripe configurations
  // deliver payment_intent.succeeded without checkout.session.completed.
  params.set('payment_intent_data[metadata][orderId]', String(orderId));
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `checkout_${String(orderId)}` }, body: params });
  const data = await response.json();
  if (!response.ok) return jsonError((data?.error?.message || 'Stripe could not create the payment.'), 502);
  await ref.update({ paymentProvider: 'stripe', paymentSessionId: data.id, updatedAt: new Date() });
  return NextResponse.json({ success: true, provider: 'stripe', checkoutUrl: data.url, paymentSessionId: data.id });
}

async function createPayPalPayment(ref: DocumentReference, order: any, orderId: string, appUrl: string, returnPath: { success: string; cancel: string }) {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const base = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
  const total = Number(order.totalCost);
  const currency = String(order.currency || process.env.MARKETPLACE_CURRENCY || 'USD').trim().toUpperCase();
  if (!client || !secret) return jsonError('PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the server.', 503);

  const basic = Buffer.from(`${client}:${secret}`).toString('base64');
  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) return jsonError('PayPal authentication failed.', 502);

  const paymentResponse = await fetch(`${base}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `paypal_${String(orderId)}` }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: orderId, amount: { currency_code: currency, value: total.toFixed(2) }, description: `ConnectLocal order ${orderId}` }], application_context: { user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: `${appUrl}${returnPath.success.replace('payment=success', 'payment=paypal')}`, cancel_url: `${appUrl}${returnPath.cancel}` } }) });
  const paymentData = await paymentResponse.json();
  if (!paymentResponse.ok) return jsonError('PayPal could not create the payment.', 502);
  await ref.update({ paymentProvider: 'paypal', paymentOrderId: paymentData.id, updatedAt: new Date() });
  return NextResponse.json({ success: true, provider: 'paypal', orderId: paymentData.id, links: paymentData.links || [] });
}
