#!/usr/bin/env node
/**
 * Sends a correctly SIGNED Safepay "payment PAID" webhook to your running app, so you can test the member checkout ->
 * order paid -> earnings flow locally without waiting for Safepay to call you.
 *
 *   SAFEPAY_WEBHOOK_SECRET=<same value as in .env.local> \
 *   node scripts/simulate-safepay-webhook.cjs --tracker track_xxx --amount 1000.00 [--currency PKR] [--url http://localhost:3000]
 *
 * --tracker  the order's Safepay tracker: it is the `beacon=` value in the Safepay checkout URL that opens when you press Pay
 *            (also stored on the order as `paymentTracker` in Firestore).
 * --amount   the order total exactly as charged (decimal, major units).
 * Add --state FAILED to see that non-PAID events are ignored. Use a wrong --amount to see the mismatch protection.
 */
const crypto = require('crypto');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };

const secret = process.env.SAFEPAY_WEBHOOK_SECRET;
const tracker = arg('tracker');
const amount = arg('amount');
if (!secret || !tracker || !amount) { console.error('Need SAFEPAY_WEBHOOK_SECRET (env), --tracker and --amount.'); process.exit(1); }
const url = `${(arg('url', 'http://localhost:3000')).replace(/\/$/, '')}/api/payments/safepay/webhook`;

const body = JSON.stringify({
  token: 'SIMULATED', client_id: 'sec_simulated', type: 'payment:created', endpoint: url,
  notification: { tracker, reference: `SIM${Date.now()}`, intent: 'CYBERSOURCE', fee: '0.00', net: amount, state: arg('state', 'PAID'), amount, currency: arg('currency', 'PKR'), metadata: { source: 'checkout' } },
  delivery_attempts: 1,
});
const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');

fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SFPY-SIGNATURE': signature }, body })
  .then(async (r) => console.log(r.status, await r.text()))
  .catch((e) => { console.error('Request failed:', e.message); process.exit(1); });
