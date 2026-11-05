/** @jest-environment node */
import crypto from 'crypto';
import { verifySafepaySignature, parseSafepayEvent } from '@/lib/server/safepay';
import { applyPaymentEvent } from '@/lib/server/order-payments';
import { getEnabledPaymentMethods } from '@/lib/server/payment-config';
import { PAYMENT_METHODS } from '@/lib/order-domain';
import { bucketForOrderStatus, computePlatformFeeMinor, maskAccount, selectPayable, sellerNetMinor, summarizeEarnings, validatePayoutAccount, type LedgerRow } from '@/lib/settlement';

// The sample payload published in Safepay's SDK docs.
const SAMPLE = JSON.stringify({ token: 'CNK4P631F43C73AIIF7G', client_id: 'sec_x', type: 'payment:created', endpoint: 'https://example.com', notification: { tracker: 'track_69b331f2', reference: '969025', intent: 'CYBERSOURCE', fee: '32.77', net: '967.23', user: 'a@b.c', state: 'PAID', amount: '1000.00', currency: 'PKR', metadata: { source: 'checkout' } }, delivery_attempts: 1 });
const sign = (raw: string, secret: string) => crypto.createHmac('sha512', secret).update(raw).digest('hex');

describe('Safepay webhook verification', () => {
  test('accepts only a correct HMAC-SHA512 of the raw body', () => {
    expect(verifySafepaySignature(SAMPLE, sign(SAMPLE, 's3cret'), 's3cret')).toBe(true);
    expect(verifySafepaySignature(SAMPLE, sign(SAMPLE, 'other'), 's3cret')).toBe(false);
    expect(verifySafepaySignature(SAMPLE + ' ', sign(SAMPLE, 's3cret'), 's3cret')).toBe(false); // body tampered
    expect(verifySafepaySignature(SAMPLE, 'abc', 's3cret')).toBe(false);
    expect(verifySafepaySignature(SAMPLE, null, 's3cret')).toBe(false);
    expect(verifySafepaySignature(SAMPLE, sign(SAMPLE, 's3cret'), '')).toBe(false);
  });
  test('parses tracker, state, amounts in minor units and Safepay fee/net', () => {
    expect(parseSafepayEvent(JSON.parse(SAMPLE))).toEqual({ type: 'payment:created', tracker: 'track_69b331f2', state: 'PAID', reference: '969025', amountMinor: 100000, currency: 'PKR', feeMinor: 3277, netMinor: 96723 });
    expect(parseSafepayEvent({ type: 'x' })).toBeNull();
  });
});

describe('Safepay is a real payment option', () => {
  test('orders accept it, and it is offered only when its webhook secret is set (the webhook is the only confirmation)', () => {
    expect(PAYMENT_METHODS).toContain('safepay');
    const base = { SAFEPAY_SECRET_KEY: 'a', SAFEPAY_PUBLIC_KEY: 'b' } as any;
    expect(getEnabledPaymentMethods(base).map((m) => m.value)).toEqual(['cod']);
    expect(getEnabledPaymentMethods({ ...base, SAFEPAY_WEBHOOK_SECRET: 'c' }).map((m) => m.value)).toEqual(['cod', 'safepay']);
  });
});

// ---- minimal in-memory Firestore for the order + ledger flow ----
class FakeDb {
  store = new Map<string, any>();
  collection(name: string) { return { doc: (id: string) => this.ref(name, id) }; }
  ref(name: string, id: string) {
    const path = `${name}/${id}`; const store = this.store;
    return {
      id, path,
      async get() { const d = store.get(path); return { exists: d !== undefined, id, data: () => d, ref: this }; },
      async set(v: any, opt?: any) { store.set(path, opt?.merge ? { ...(store.get(path) || {}), ...v } : v); },
      async update(v: any) { store.set(path, { ...(store.get(path) || {}), ...v }); },
    };
  }
  async runTransaction(fn: any) {
    const writes: Array<() => Promise<void>> = [];
    await fn({ get: (r: any) => r.get(), update: (r: any, v: any) => writes.push(() => r.update(v)) });
    for (const w of writes) await w();
  }
}

describe('Safepay payment -> order -> ledger -> earnings', () => {
  const setup = () => {
    const db = new FakeDb();
    db.store.set('orders/o1', { status: 'pending_payment', totalCost: 1000, currency: 'PKR', businessId: 'seller1', paymentMethod: 'safepay', ledgerTransactionId: 't1', items: [] });
    db.store.set('paymentTransactions/t1', { orderId: 'o1', sellerId: 'seller1', currency: 'PKR', amountMinor: 100000, platformFeeMinor: 5000, sellerAmountMinor: 95000, status: 'pending' });
    return db;
  };
  const paid = (db: FakeDb, amountMinor = 100000, currency = 'PKR') =>
    applyPaymentEvent(db as any, 'o1', 'paid', { provider: 'safepay', sessionId: 'track_1', transactionId: 'ref1', providerFeeMinor: 3277, providerNetMinor: 96723 }, { amountMinor, currency });

  test('a verified PAID event confirms the order, closes the ledger row as held, and a repeat changes nothing', async () => {
    const db = setup();
    const first = await paid(db);
    expect(first).toMatchObject({ found: true, changed: true });
    expect(db.store.get('orders/o1')).toMatchObject({ status: 'paid', paymentStatus: 'paid', paymentProvider: 'safepay', paymentTransactionId: 'ref1' });
    expect(db.store.get('paymentTransactions/t1')).toMatchObject({ status: 'succeeded', settlementStatus: 'held', providerReference: 'ref1', providerFeeMinor: 3277 });
    expect((await paid(db)).changed).toBe(false); // webhook retry
  });

  test('wrong amount or currency never marks the order paid', async () => {
    const db = setup();
    expect((await paid(db, 99999)).mismatch).toBe(true);
    expect((await paid(db, 100000, 'USD')).mismatch).toBe(true);
    expect(db.store.get('orders/o1')).toMatchObject({ status: 'cancelled', paymentStatus: 'failed', paymentMismatch: true, needsRefund: true });
    expect(db.store.get('paymentTransactions/t1').status).toBe('pending');
  });

  test('earnings: held until handover, then available, then paid out once', async () => {
    const db = setup(); await paid(db);
    const row = (): LedgerRow => ({ id: 't1', orderId: 'o1', ...db.store.get('paymentTransactions/t1') });
    expect(summarizeEarnings([row()], { o1: 'paid' })).toEqual([{ currency: 'PKR', heldMinor: 95000, availableMinor: 0, paidOutMinor: 0, count: 1 }]);
    expect(selectPayable([row()], { o1: 'processing' }, 'PKR')).toHaveLength(0);
    expect(summarizeEarnings([row()], { o1: 'completed' })[0]).toMatchObject({ availableMinor: 95000, heldMinor: 0 });
    expect(selectPayable([row()], { o1: 'delivered' }, 'PKR').map(sellerNetMinor)).toEqual([95000]); // platform fee is never paid out
    expect(selectPayable([{ ...row(), settlementStatus: 'paid_out' }], { o1: 'completed' }, 'PKR')).toHaveLength(0); // never twice
    expect(summarizeEarnings([{ ...row(), settlementStatus: 'paid_out' }], { o1: 'completed' })[0].paidOutMinor).toBe(95000);
  });

  test('a refund before payout reverses the ledger row; a refund after payout is flagged for recovery', async () => {
    const a = setup(); await paid(a);
    await applyPaymentEvent(a as any, 'o1', 'refunded', { provider: 'safepay' });
    expect(a.store.get('paymentTransactions/t1')).toMatchObject({ status: 'refunded', settlementStatus: 'reversed' });

    const b = setup(); await paid(b);
    b.store.set('paymentTransactions/t1', { ...b.store.get('paymentTransactions/t1'), settlementStatus: 'paid_out' });
    await applyPaymentEvent(b as any, 'o1', 'refunded', { provider: 'safepay' });
    expect(b.store.get('paymentTransactions/t1')).toMatchObject({ status: 'refunded', settlementStatus: 'paid_out', refundedAfterPayout: true });
  });
});

describe('settlement helpers', () => {
  test('order status -> bucket', () => {
    expect(['paid', 'processing', 'out_for_delivery', 'refund_requested'].map(bucketForOrderStatus)).toEqual(['held', 'held', 'held', 'held']);
    expect(['delivered', 'picked_up', 'completed', 'refund_rejected'].map(bucketForOrderStatus)).toEqual(['available', 'available', 'available', 'available']);
    expect(['cancelled', 'refund_approved', 'refunded'].map(bucketForOrderStatus)).toEqual(['reversed', 'reversed', 'reversed']);
  });
  test('platform fee is a clamped percentage of the goods', () => {
    expect(computePlatformFeeMinor(100000, 0)).toBe(0);
    expect(computePlatformFeeMinor(100000, 5)).toBe(5000);
    expect(computePlatformFeeMinor(100000, 99)).toBe(50000); // capped at 50%
    expect(computePlatformFeeMinor(100000, NaN)).toBe(0);
  });
  test('payout details are validated for Pakistan', () => {
    expect(validatePayoutAccount({ method: 'bank', accountTitle: 'Ali Khan', accountNumber: 'PK36 SCBL 0000 0011 2345 6702', bankName: 'SCB' }).ok).toBe(true);
    expect(validatePayoutAccount({ method: 'bank', accountTitle: 'Ali Khan', accountNumber: '12', bankName: 'SCB' }).ok).toBe(false);
    expect(validatePayoutAccount({ method: 'bank', accountTitle: 'Ali Khan', accountNumber: '0123456789' }).ok).toBe(false); // bank name required
    const jc = validatePayoutAccount({ method: 'jazzcash', accountTitle: 'Ali Khan', accountNumber: '+92 300 1234567' });
    expect(jc.ok && jc.value.accountNumber).toBe('03001234567');
    expect(validatePayoutAccount({ method: 'easypaisa', accountTitle: 'Ali Khan', accountNumber: '12345' }).ok).toBe(false);
    expect(validatePayoutAccount({ method: 'paypal', accountTitle: 'Ali Khan', accountNumber: '0300' }).ok).toBe(false);
    expect(maskAccount('03001234567')).toBe('•••••••4567');
  });
});
