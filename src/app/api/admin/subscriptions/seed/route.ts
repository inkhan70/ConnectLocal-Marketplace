import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, requireAdmin } from '@/lib/server/firebase-admin';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-domain';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = getAdminDb();

    const batch = db.batch();
    for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
      batch.set(db.collection('subscriptionPlans').doc(plan.id), {
        ...plan,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
    return NextResponse.json({ success: true, plans: DEFAULT_SUBSCRIPTION_PLANS.map((plan) => plan.id) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Plan seeding failed.' }, { status: authErrorStatus(error) });
  }
}
