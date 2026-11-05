/** @jest-environment node */
const store = new Map<string, any>();
const fakeDb = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      async get() { const d = store.get(`${name}/${id}`); return { exists: d !== undefined, data: () => d }; },
      async set(v: any, opt?: any) { const k = `${name}/${id}`; store.set(k, opt?.merge ? { ...(store.get(k) || {}), ...v } : v); },
    }),
  }),
};
jest.mock('@/lib/server/firebase-admin', () => ({
  getAdminDb: () => fakeDb,
  requireAdmin: async () => ({ uid: 'admin1' }),
  authErrorStatus: () => 500,
  safeMessage: (e: any) => String(e?.message || e),
}));
import { POST } from '@/app/api/admin/payments/providers/route';

const post = (body: any) => POST({ json: async () => body } as any).then((r: any) => r.json());

describe('admin provider settings never clobber an existing approval', () => {
  beforeEach(() => store.clear());

  test('adding a country configuration keeps the approval and the enabled flag that were already given', async () => {
    await post({ providerId: 'safepay', country: 'PK', enabled: true, merchantApproved: true });
    await post({ providerId: 'safepay', country: 'PK', currencies: ['pkr'] }); // what the "Add configuration" form sends
    expect(store.get('paymentProviderConfigs/safepay_PK')).toMatchObject({ enabled: true, merchantApproved: true, currencies: ['PKR'] });
  });

  test('toggling one switch changes only that field', async () => {
    await post({ providerId: 'safepay', country: 'GLOBAL', enabled: true, merchantApproved: true });
    await post({ providerId: 'safepay', country: 'GLOBAL', enabled: false });
    expect(store.get('paymentProviderConfigs/safepay_GLOBAL')).toMatchObject({ enabled: false, merchantApproved: true });
  });

  test('a brand-new configuration starts enabled but NOT approved', async () => {
    await post({ providerId: 'safepay', country: 'PK' });
    expect(store.get('paymentProviderConfigs/safepay_PK')).toMatchObject({ enabled: true, merchantApproved: false });
  });

  test('rejects unknown providers and bad country codes', async () => {
    expect((await post({ providerId: 'nope', country: 'PK' })).error).toMatch(/Unsupported/);
    expect((await post({ providerId: 'safepay', country: 'PAK' })).error).toMatch(/ISO country/);
  });
});
