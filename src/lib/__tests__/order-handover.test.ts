/** @jest-environment node */
import { NextRequest } from 'next/server';

// ---- minimal in-memory Firestore ----
const store = new Map<string, any>();
const fakeDb = {
  collection: (c: string) => ({
    doc: (id: string) => ({
      get: async () => ({ exists: store.has(`${c}/${id}`), id, data: () => store.get(`${c}/${id}`) }),
      update: async (patch: any) => {
        const cur = store.get(`${c}/${id}`) || {};
        const next: any = { ...cur };
        for (const [k, v] of Object.entries(patch)) {
          if (v && typeof v === 'object' && (v as any).__inc) next[k] = Number(cur[k] || 0) + (v as any).__inc;
          else if (v && typeof v === 'object' && (v as any).__ts) next[k] = 'TS';
          else if (v && typeof v === 'object' && (v as any).__union) next[k] = [...(cur[k] || []), (v as any).__union];
          else next[k] = v;
        }
        store.set(`${c}/${id}`, next);
      },
    }),
  }),
};

let currentUid = 'seller1';
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => ({ __ts: true }), increment: (n: number) => ({ __inc: n }), arrayUnion: (v: any) => ({ __union: v }) },
}));
jest.mock('@/lib/server/notifications', () => ({ notifyOrderParties: jest.fn(), notifyUser: jest.fn() }));
jest.mock('@/lib/server/rewards', () => ({ awardGhostCoinsForCompletedOrder: jest.fn(async () => ({ awarded: 0 })) }));
jest.mock('@/lib/server/firebase-admin', () => {
  const actual = jest.requireActual('@/lib/server/firebase-admin');
  return {
    ...actual,
    getAdminDb: () => fakeDb,
    isAdminCaller: async () => false,
    verifyBearerToken: async (req: Request) => {
      if (!req.headers.get('authorization')) throw new actual.HttpError(401, 'missing_token', 'Authentication required.');
      return { uid: currentUid };
    },
  };
});
jest.mock('firebase-admin/app', () => ({ cert: jest.fn(), getApps: () => [], initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('firebase-admin/storage', () => ({ getStorage: jest.fn() }));

import { POST } from '@/app/api/orders/[orderId]/route';
import { GET as getVerification } from '@/app/api/orders/[orderId]/verification/route';
import { hashKey, normaliseCode } from '@/lib/server/order-secrets';

const act = (orderId: string, uid: string, body: any) => {
  currentUid = uid;
  return POST(
    new NextRequest(`http://x/api/orders/${orderId}`, { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: { orderId } },
  );
};

beforeEach(() => {
  store.clear();
  store.set('orders/o1', { buyerId: 'buyer1', businessId: 'seller1', status: 'out_for_delivery', deliveryMethod: 'seller_delivery', verificationRequired: true, items: [] });
  store.set('orderSecrets/o1', { code: 'ABCD2345' });
  store.set('orders/p1', { buyerId: 'buyer1', businessId: 'seller1', status: 'ready_for_pickup', deliveryMethod: 'pickup', verificationRequired: true, items: [] });
  store.set('orderSecrets/p1', { code: 'PICK7777' });
  store.set('orders/legacy', { buyerId: 'buyer1', businessId: 'seller1', status: 'ready_for_pickup', deliveryMethod: 'pickup', pickupCode: 'OLD11111', items: [] });
});

describe('handover verification key', () => {
  test('seller completes a delivery with the buyer\'s code (spacing/case insensitive)', async () => {
    const res = await act('o1', 'seller1', { action: 'verify_handover', code: 'abcd-2345' });
    expect(res.status).toBe(200);
    expect(store.get('orders/o1')).toMatchObject({ status: 'completed', pickupVerified: true });
  });

  test('seller completes a pickup with the correct code', async () => {
    const res = await act('p1', 'seller1', { action: 'verify_handover', code: 'PICK7777' });
    expect(res.status).toBe(200);
    expect(store.get('orders/p1').status).toBe('completed');
  });

  test('a wrong code is rejected, counted, and locks out after 5 attempts', async () => {
    for (let i = 0; i < 5; i++) expect((await act('o1', 'seller1', { action: 'verify_handover', code: 'WRONG000' })).status).toBe(400);
    expect(store.get('orders/o1').verificationFailures).toBe(5);
    // even the right code is refused once locked
    expect((await act('o1', 'seller1', { action: 'verify_handover', code: 'ABCD2345' })).status).toBe(429);
    expect(store.get('orders/o1').status).toBe('out_for_delivery');
  });

  test('the buyer cannot verify their own handover; a stranger is refused', async () => {
    expect((await act('o1', 'buyer1', { action: 'verify_handover', code: 'ABCD2345' })).status).toBe(403);
    expect((await act('o1', 'stranger', { action: 'verify_handover', code: 'ABCD2345' })).status).toBe(403);
    expect(store.get('orders/o1').status).toBe('out_for_delivery');
  });

  test('a missing code is a 400, and the seller cannot bypass the code by marking delivered', async () => {
    expect((await act('o1', 'seller1', { action: 'verify_handover' })).status).toBe(400);
    const res = await act('o1', 'seller1', { action: 'transition', status: 'delivered' });
    expect(res.status).toBe(409);
    expect(store.get('orders/o1').status).toBe('out_for_delivery');
  });

  test('legacy orders (code stored on the order) still verify', async () => {
    const res = await act('legacy', 'seller1', { action: 'verify_pickup', pickupCode: 'old11111' });
    expect(res.status).toBe(200);
  });
});

describe('who can read the code', () => {
  const get = (orderId: string, headers: Record<string, string>, uid = 'buyer1') => {
    currentUid = uid;
    return getVerification(new NextRequest(`http://x/api/orders/${orderId}/verification`, { headers }), { params: { orderId } });
  };

  test('the signed-in buyer can read it; the seller cannot', async () => {
    const ok = await get('o1', { authorization: 'Bearer t' }, 'buyer1');
    expect(ok.status).toBe(200);
    expect((await ok.json()).code).toBe('ABCD2345');
    expect((await get('o1', { authorization: 'Bearer t' }, 'seller1')).status).toBe(403);
  });

  test('guests need the right guest key; wrong or missing keys are refused', async () => {
    store.set('orders/g1', { buyerId: 'guest_x', businessId: 'seller1', status: 'paid', isGuestOrder: true, items: [] });
    store.set('orderSecrets/g1', { code: 'GUEST999', guestKeyHash: hashKey('secret-key') });
    const ok = await get('g1', { 'x-guest-key': 'secret-key' });
    expect(ok.status).toBe(200);
    expect((await ok.json()).code).toBe('GUEST999');
    expect((await get('g1', { 'x-guest-key': 'nope' })).status).toBe(403);
    expect((await get('g1', {})).status).toBe(401);
    // a guest key never unlocks a registered buyer's order
    expect((await get('o1', { 'x-guest-key': 'secret-key' })).status).toBe(401);
  });
});

test('normaliseCode strips spaces and dashes and upper-cases', () => {
  expect(normaliseCode(' ab-cd 23 ')).toBe('ABCD23');
});
