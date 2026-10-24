/** @jest-environment node */
import { classifyError, HttpError, readJsonBody, safeMessage } from '@/lib/server/firebase-admin';
import { getAppUrl } from '@/lib/server/app-url';
import { toPublicBusiness } from '@/lib/server/public-profile';
import { isValidCoordinate, filterBusinessesByDistance } from '@/lib/geolocation';
import { CATEGORY_LABELS, getBuiltInCategories, getSubcategoriesForCategory, resolveCategoryKey, subcategoriesMap } from '@/lib/subcategories';

jest.mock('firebase-admin/app', () => ({ cert: jest.fn(), getApps: () => [], initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('firebase-admin/firestore', () => ({ getFirestore: jest.fn() }));
jest.mock('firebase-admin/storage', () => ({ getStorage: jest.fn() }));

describe('classifyError (HTTP status protocol)', () => {
  test('HttpError keeps its status and code', () => {
    expect(classifyError(new HttpError(403, 'not_admin', 'no'))).toMatchObject({ status: 403, code: 'not_admin' });
  });
  test('own validation errors are client errors, not 500', () => {
    expect(classifyError(new Error('Product not found.')).status).toBe(404);
    expect(classifyError(new Error('Milk does not have enough stock.')).status).toBe(409);
    expect(classifyError(new Error('You have no Ghost Coins to convert.')).status).toBe(400);
  });
  test('Firestore PERMISSION_DENIED and Auth permission errors give actionable operator messages', () => {
    const fs = classifyError(Object.assign(new Error('7 PERMISSION_DENIED'), { code: 7 }));
    expect(fs).toMatchObject({ status: 500, code: 'firestore_permission_denied' });
    const au = classifyError(Object.assign(new Error('x'), { code: 'auth/insufficient-permission' }));
    expect(au.code).toBe('auth_permission_denied');
    expect(au.message).toMatch(/Firebase Authentication Admin/);
  });
  test('unexpected errors never leak internals', () => {
    const c = classifyError(new TypeError("Cannot read properties of undefined (reading 'x')"));
    expect(c.status).toBe(500);
    expect(c.message).not.toMatch(/Cannot read/);
    expect(safeMessage(new TypeError('boom'), 'Could not save product.')).toBe('Could not save product.');
  });
  test('malformed JSON bodies are a 400', async () => {
    const req = new Request('http://x/api', { method: 'POST', body: '{nope' });
    await expect(readJsonBody(req)).rejects.toMatchObject({ status: 400, code: 'invalid_json' });
  });
});

describe('getAppUrl', () => {
  const env = process.env;
  beforeEach(() => { process.env = { ...env }; delete process.env.APP_URL; delete process.env.NEXT_PUBLIC_APP_URL; delete process.env.VERCEL_URL; delete process.env.VERCEL_PROJECT_PRODUCTION_URL; });
  afterAll(() => { process.env = env; });

  test('uses configured URL, strips trailing slash and forces https in production', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.APP_URL = 'http://shop.example.com/';
    expect(getAppUrl()).toBe('https://shop.example.com');
  });
  test('ignores localhost in production and falls back to the forwarded host', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.APP_URL = 'http://localhost:3000';
    const req = new Request('http://internal/api', { headers: { 'x-forwarded-host': 'my-site.vercel.app', 'x-forwarded-proto': 'https' } });
    expect(getAppUrl(req)).toBe('https://my-site.vercel.app');
  });
});

describe('public profile projection', () => {
  test('exposes only allow-listed fields', () => {
    const out: any = toPublicBusiness('u1', {
      role: 'shopkeeper', businessName: 'Shop', email: 'a@b.c', phone: '123', balance: 50, stripeCustomerId: 'cus_1',
      isAdmin: false, permissions: ['x'], latitude: 0, longitude: 0,
    });
    expect(out).toMatchObject({ uid: 'u1', businessName: 'Shop', latitude: 0 });
    for (const secret of ['email', 'phone', 'balance', 'stripeCustomerId', 'permissions', 'isAdmin']) expect(out).not.toHaveProperty(secret);
  });
  test('buyers and admins are never public', () => {
    expect(toPublicBusiness('a', { role: 'buyer', businessName: 'x' })).toBeNull();
    expect(toPublicBusiness('b', { role: 'company', isAdmin: true })).toBeNull();
  });
});

describe('coordinates', () => {
  test('0 is valid, null/empty/out-of-range are not', () => {
    expect(isValidCoordinate(0, 0)).toBe(true);
    expect(isValidCoordinate('31.5', '74.3')).toBe(true);
    expect(isValidCoordinate(null, 74)).toBe(false);
    expect(isValidCoordinate('', '')).toBe(false);
    expect(isValidCoordinate(95, 10)).toBe(false);
  });
  test('businesses on the equator are not dropped from radius search', () => {
    const r = filterBusinessesByDistance([{ latitude: 0, longitude: 0.01 }], 0, 0, 100);
    expect(r).toHaveLength(1);
  });
});

describe('signup categories', () => {
  test('every built-in category has a label and at least one business type', () => {
    for (const { key, label } of getBuiltInCategories()) {
      expect(CATEGORY_LABELS[key]).toBeTruthy();
      expect(label).toBeTruthy();
      expect(subcategoriesMap[key].length).toBeGreaterThan(0);
    }
  });
  test('admin-typed category names resolve to a built-in category with business types', () => {
    expect(resolveCategoryKey('Medical')).toBe('medical');
    expect(resolveCategoryKey('Medical & Healthcare')).toBe('medical');
    expect(resolveCategoryKey('Healthcare')).toBe('medical');
    expect(resolveCategoryKey('Jewellery')).toBe('jewelry');
    expect(resolveCategoryKey('Food & Restaurants')).toBe('food');
    expect(resolveCategoryKey('zzz')).toBeNull();
    expect(getSubcategoriesForCategory('Medical & Healthcare').map((s) => s.id)).toEqual(expect.arrayContaining(['health_dentist', 'health_dental', 'health_doctor']));
  });
});
