export type SubscriptionStatus = 'active' | 'inactive' | 'expired' | 'past_due' | 'cancelled';
export type MembershipTier = 'community' | 'basic' | 'plus' | 'pro';

export interface SubscriptionEntitlements {
  membershipTier: MembershipTier;
  storageLimitBytes: number;
  maxImages: number | null;
  maxListings: number | null;
  features: string[];
}

export interface SubscriptionPlanRecord extends SubscriptionEntitlements {
  id: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  interval?: 'month';
  priority?: number;
  active?: boolean;
  stripePriceId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanRecord[] = [
  {
    id: 'community',
    name: 'Community',
    description: 'Free tools to establish your business on ConnectLocal.',
    price: 0,
    currency: 'USD',
    interval: 'month',
    membershipTier: 'community',
    storageLimitBytes: 80 * 1024 * 1024,
    maxImages: 15,
    maxListings: 10,
    priority: 0,
    active: true,
    features: [
      'Basic business profile',
      'Up to 15 active images',
      '80 MB storage',
      'Basic customer contact',
      'Standard marketplace visibility',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Affordable business-growth tools for small businesses.',
    price: 2,
    currency: 'USD',
    interval: 'month',
    membershipTier: 'basic',
    storageLimitBytes: 400 * 1024 * 1024,
    maxImages: 100,
    maxListings: 50,
    priority: 10,
    active: true,
    features: [
      'Up to 100 active images',
      '400 MB storage',
      'Improved business visibility',
      'Customer messaging and lead tools',
      'Basic business analytics',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'More visibility and customer tools for growing businesses.',
    price: 4,
    currency: 'USD',
    interval: 'month',
    membershipTier: 'plus',
    storageLimitBytes: 1 * 1024 * 1024 * 1024,
    maxImages: 250,
    maxListings: 200,
    priority: 20,
    active: true,
    features: [
      'Up to 250 active images',
      '1 GB storage',
      'Enhanced business visibility',
      'Advanced customer and lead tools',
      'Business analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Maximum business tools for established and high-volume members.',
    price: 10,
    currency: 'USD',
    interval: 'month',
    membershipTier: 'pro',
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    maxImages: null,
    maxListings: null,
    priority: 30,
    active: true,
    features: [
      'Unlimited active images',
      '5 GB storage included',
      'Maximum business visibility',
      'Advanced customer and lead tools',
      'Advanced business analytics',
      'Priority business features',
    ],
  },
];

export function planToEntitlements(plan: SubscriptionPlanRecord): SubscriptionEntitlements {
  return {
    membershipTier: plan.membershipTier,
    storageLimitBytes: plan.storageLimitBytes,
    maxImages: plan.maxImages,
    maxListings: plan.maxListings,
    features: Array.isArray(plan.features) ? plan.features : [],
  };
}

export function getSubscriptionStatus(startDate?: string | null, endDate?: string | null): SubscriptionStatus {
  if (!startDate) return 'inactive';
  const start = new Date(startDate).getTime();
  if (!Number.isFinite(start) || start > Date.now()) return 'inactive';
  if (endDate) {
    const end = new Date(endDate).getTime();
    if (Number.isFinite(end) && end <= Date.now()) return 'expired';
  }
  return 'active';
}

export function canUseListing(entitlements: SubscriptionEntitlements, currentListings: number): boolean {
  return entitlements.maxListings == null || currentListings < entitlements.maxListings;
}

export function canStoreImage(entitlements: SubscriptionEntitlements, currentImageCount: number, currentStorageBytes: number, imageBytes: number): boolean {
  const imageCountOk = entitlements.maxImages == null || currentImageCount < entitlements.maxImages;
  const storageOk = currentStorageBytes + imageBytes <= entitlements.storageLimitBytes;
  return imageCountOk && storageOk;
}
