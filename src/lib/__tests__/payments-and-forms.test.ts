/** @jest-environment node */
import { getEnabledPaymentMethods, isPaymentMethodEnabled } from '@/lib/server/payment-config';
import { getProductFormProfile } from '@/lib/product-form-profile';

describe('payment methods offered', () => {
  test('only cash on delivery without provider credentials (JazzCash/Easypaisa are never offered)', () => {
    expect(getEnabledPaymentMethods({} as any).map((m) => m.value)).toEqual(['cod']);
    expect(isPaymentMethodEnabled('jazzcash', { STRIPE_SECRET_KEY: 'x' } as any)).toBe(false);
  });
  test('card and PayPal appear when configured', () => {
    const env = { STRIPE_SECRET_KEY: 'sk_test', PAYPAL_CLIENT_ID: 'a', PAYPAL_CLIENT_SECRET: 'b' } as any;
    expect(getEnabledPaymentMethods(env).map((m) => m.value)).toEqual(['cod', 'stripe', 'paypal']);
    expect(isPaymentMethodEnabled('stripe', env)).toBe(true);
    expect(isPaymentMethodEnabled('paypal', { PAYPAL_CLIENT_ID: 'a' } as any)).toBe(false);
  });
});

describe('product form by business type', () => {
  test('service providers get the service form', () => {
    for (const p of [{ role: 'services' }, { role: 'company', dashboardType: 'services' }]) {
      const f = getProductFormProfile(p);
      expect(f.mode).toBe('service');
      expect(f.addTitle).toBe('Add a New Service');
    }
  });
  test('every other business keeps the original product form unchanged', () => {
    for (const p of [{ role: 'shopkeeper', dashboardType: 'health' }, { role: 'wholesaler' }, { role: 'company', dashboardType: 'food' }, null, undefined]) {
      const f = getProductFormProfile(p as any);
      expect(f.mode).toBe('goods');
      expect(f.addTitle).toBe('Add a New Product');
      expect(f.nameLabel).toBe('Product Name / Brand');
    }
  });
});
