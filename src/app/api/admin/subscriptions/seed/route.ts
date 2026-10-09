import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { DEFAULT_SUBSCRIPTION_PLANS } from '@/lib/subscription-domain';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const adminSnap = await db.collection('users').doc(decoded.uid).get();
    if (decoded.isAdmin !== true && adminSnap.data()?.isAdmin !== true) {
      return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    }

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
    return NextResponse.json({ error: error?.message || 'Plan seeding failed.' }, { status: 500 });
  }
}
