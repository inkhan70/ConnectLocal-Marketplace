import {
  DEFAULT_SUBSCRIPTION_PLANS,
  canStoreImage,
  canUseListing,
  getSubscriptionStatus,
} from '@/lib/subscription-domain';

describe('ConnectLocal subscription entitlements', () => {
  test('recommended plan quotas are correct', () => {
    const community = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'community')!;
    const basic = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'basic')!;
    const plus = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'plus')!;
    const pro = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'pro')!;

    expect(community.storageLimitBytes).toBe(80 * 1024 * 1024);
    expect(community.maxImages).toBe(15);
    expect(basic.storageLimitBytes).toBe(400 * 1024 * 1024);
    expect(basic.maxImages).toBe(100);
    expect(plus.storageLimitBytes).toBe(1024 * 1024 * 1024);
    expect(plus.maxImages).toBe(250);
    expect(pro.maxImages).toBeNull();
    expect(pro.maxListings).toBeNull();
  });

  test('listing quota blocks only after the configured limit', () => {
    const basic = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'basic')!;
    expect(canUseListing(basic, 49)).toBe(true);
    expect(canUseListing(basic, 50)).toBe(false);
    expect(canUseListing(basic, 500)).toBe(false);
  });

  test('unlimited listing plans stay available', () => {
    const pro = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'pro')!;
    expect(canUseListing(pro, 100000)).toBe(true);
  });

  test('image quota checks both count and storage', () => {
    const community = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.id === 'community')!;
    expect(canStoreImage(community, 14, 70 * 1024 * 1024, 9 * 1024 * 1024)).toBe(true);
    expect(canStoreImage(community, 15, 70 * 1024 * 1024, 1)).toBe(false);
    expect(canStoreImage(community, 14, 79 * 1024 * 1024, 2 * 1024 * 1024)).toBe(false);
  });

  test('subscription date status is deterministic', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getSubscriptionStatus()).toBe('inactive');
    expect(getSubscriptionStatus(future)).toBe('inactive');
    expect(getSubscriptionStatus(past)).toBe('active');
    expect(getSubscriptionStatus(past, future)).toBe('active');
    expect(getSubscriptionStatus(past, past)).toBe('expired');
  });
});
