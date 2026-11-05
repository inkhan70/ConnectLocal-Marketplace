/** @jest-environment node */
import { getProviderReadiness, isPaymentMethodAvailable, sellerPaymentProfile } from '@/lib/server/payment-config';

class FakeDb {
  store = new Map<string, any>();
  collection(name: string) { return { doc: (id: string) => this.ref(name, id) }; }
  ref(name: string, id: string) {
    const path = `${name}/${id}`; const store = this.store;
    return {
      id, path,
      async get() { const d = store.get(path); return { exists: d !== undefined, id, data: () => d }; },
      async set(v: any, opt?: any) { store.set(path, opt?.merge ? { ...(store.get(path) || {}), ...v } : v); },
    };
  }
}
const SAFEPAY_ENV = { SAFEPAY_SECRET_KEY: 'a', SAFEPAY_PUBLIC_KEY: 'b', SAFEPAY_WEBHOOK_SECRET: 'c' } as any;
const cfg = (db: FakeDb, id: string, v: any) => db.store.set(`paymentProviderConfigs/${id}`, v);
const available = (db: FakeDb, m: string, c: string, cur: string, env: any = SAFEPAY_ENV) => isPaymentMethodAvailable(db as any, m, c, cur, env);

describe('which country/currency applies to a seller', () => {
  test('the member-confirmed business settings win over the sign-up defaults', () => {
    // A Karachi seller who signed in with Google: profile defaulted to USD, then confirmed PK/PKR on Dashboard -> Payments.
    expect(sellerPaymentProfile({ countryCode: '', currencyCode: 'USD', businessCountry: 'PK', businessCurrency: 'PKR' })).toEqual({ country: 'PK', currency: 'PKR', confirmed: true });
  });
  test('an unconfirmed seller with no country keeps the neutral default (and is flagged unconfirmed)', () => {
    expect(sellerPaymentProfile({ countryCode: '', currencyCode: 'USD' })).toEqual({ country: 'US', currency: 'USD', confirmed: false });
  });
  test('older profiles that already carry PK/PKR keep working', () => {
    expect(sellerPaymentProfile({ countryCode: 'PK', currencyCode: 'PKR' })).toMatchObject({ country: 'PK', currency: 'PKR', confirmed: false });
  });
});

describe('provider readiness (what buyers are offered)', () => {
  test('cash on delivery is always available', async () => {
    expect(await available(new FakeDb(), 'cod', 'PK', 'PKR', {})).toBe(true);
  });

  test('Safepay is hidden until it is enabled, approved AND its webhook has been verified - and says which is missing', async () => {
    const db = new FakeDb();
    let r = await getProviderReadiness(db as any, 'safepay', 'PK', 'PKR', SAFEPAY_ENV);
    expect(r.available).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['enabled', 'approved', 'webhook']);

    cfg(db, 'safepay_GLOBAL', { enabled: true, merchantApproved: true, currencies: ['PKR'] });
    r = await getProviderReadiness(db as any, 'safepay', 'PK', 'PKR', SAFEPAY_ENV);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['webhook']);
    expect(r.reason).toMatch(/Webhook verified/);

    cfg(db, 'safepay_GLOBAL', { enabled: true, merchantApproved: true, currencies: ['PKR'], webhookVerifiedAt: '2026-11-06T00:00:00Z' });
    expect(await available(db, 'safepay', 'PK', 'PKR')).toBe(true);
  });

  test('REGRESSION: a country configuration no longer hides Safepay forever (verification lives on the integration)', async () => {
    const db = new FakeDb();
    cfg(db, 'safepay_GLOBAL', { enabled: true, merchantApproved: true, currencies: ['PKR'], webhookVerifiedAt: '2026-11-06T00:00:00Z' });
    // Admin added a Pakistan configuration (it has no webhook flag and does not repeat the approval).
    cfg(db, 'safepay_PK', { providerId: 'safepay', country: 'PK', enabled: true, currencies: ['PKR'] });
    expect(await available(db, 'safepay', 'PK', 'PKR')).toBe(true);
  });

  test('a country configuration can still switch a provider off explicitly', async () => {
    const db = new FakeDb();
    cfg(db, 'safepay_GLOBAL', { enabled: true, merchantApproved: true, webhookVerifiedAt: 'x' });
    cfg(db, 'safepay_PK', { enabled: true, merchantApproved: false });
    expect(await available(db, 'safepay', 'PK', 'PKR')).toBe(false);
  });

  test('Safepay is only for PKR, whatever the admin configured', async () => {
    const db = new FakeDb();
    cfg(db, 'safepay_GLOBAL', { enabled: true, merchantApproved: true, webhookVerifiedAt: 'x' });
    expect(await available(db, 'safepay', 'PK', 'USD')).toBe(false);
    expect(await available(db, 'safepay', 'US', 'USD')).toBe(false);
  });

  test('missing server credentials hide a provider even when approved', async () => {
    const db = new FakeDb();
    cfg(db, 'safepay_GLOBAL', { enabled: true, merchantApproved: true, webhookVerifiedAt: 'x' });
    expect(await available(db, 'safepay', 'PK', 'PKR', { SAFEPAY_SECRET_KEY: 'a', SAFEPAY_PUBLIC_KEY: 'b' })).toBe(false);
  });

  test('Stripe still works with no admin restriction in supported regions and never in Pakistan', async () => {
    const db = new FakeDb();
    const env = { STRIPE_SECRET_KEY: 'sk' } as any;
    expect(await available(db, 'stripe', 'US', 'USD', env)).toBe(true);
    expect(await available(db, 'stripe', 'PK', 'PKR', env)).toBe(false);
  });
});
