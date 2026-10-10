import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { planToEntitlements, SubscriptionPlanRecord, SubscriptionStatus } from '@/lib/subscription-domain';

export async function getSubscriptionPlan(planId: string): Promise<SubscriptionPlanRecord | null> {
  const db = getAdminDb();
  const snap = await db.collection('subscriptionPlans').doc(planId).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const plan = { id: snap.id, ...data } as SubscriptionPlanRecord;
  if (plan.active === false) return null;
  return plan;
}

export async function applySubscriptionToUser(uid: string, plan: SubscriptionPlanRecord, options?: {
  status?: SubscriptionStatus;
  startDate?: string;
  endDate?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  source?: 'admin' | 'stripe' | 'system';
  grantedBy?: string | null;
}) {
  const db = getAdminDb();
  const entitlements = planToEntitlements(plan);
  const startDate = options?.startDate || new Date().toISOString();
  const status = options?.status || 'active';
  await db.collection('users').doc(uid).set({
    membershipTier: entitlements.membershipTier,
    subscriptionPlanId: plan.id,
    subscriptionStatus: status,
    subscriptionStartDate: startDate,
    subscriptionEndDate: options?.endDate ?? null,
    storageLimitBytes: entitlements.storageLimitBytes,
    maxImages: entitlements.maxImages,
    maxListings: entitlements.maxListings,
    subscriptionFeatures: entitlements.features,
    ...(options?.stripeCustomerId !== undefined ? { stripeCustomerId: options.stripeCustomerId } : {}),
    ...(options?.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: options.stripeSubscriptionId } : {}),
    subscriptionSource: options?.source || 'system',
    ...(options?.grantedBy !== undefined ? { subscriptionGrantedBy: options.grantedBy } : {}),
    ...(options?.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: options.cancelAtPeriodEnd } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function recordSubscriptionAdminAction(options: {
  actorUid: string;
  targetUid: string;
  action: 'grant' | 'revoke';
  planId?: string;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const db = getAdminDb();
  await db.collection('subscriptionAudit').add({
    actorUid: options.actorUid,
    targetUid: options.targetUid,
    action: options.action,
    planId: options.planId || null,
    startDate: options.startDate || null,
    endDate: options.endDate || null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function deactivateSubscription(uid: string, options?: { source?: 'admin' | 'system'; grantedBy?: string | null }) {
  const db = getAdminDb();
  const community = await getSubscriptionPlan('community');
  if (!community) throw new Error('Community plan is not configured.');
  await applySubscriptionToUser(uid, community, { status: 'inactive', endDate: null, stripeSubscriptionId: null, cancelAtPeriodEnd: false, source: options?.source || 'system', grantedBy: options?.grantedBy ?? null });
}
