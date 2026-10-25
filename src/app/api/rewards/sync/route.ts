import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyBearerToken, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';
import { awardGhostCoinsForCompletedOrder } from '@/lib/server/rewards';

export const runtime = 'nodejs';

/**
 * Reconciles completed orders for the signed-in buyer. This is intentionally
 * idempotent so it can repair orders completed before a reward write succeeded.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    // Keep this to one filter so the reconciliation does not require a manual
    // Firestore composite index in an existing deployment.
    const snapshot = await db.collection('orders').where('buyerId', '==', decoded.uid).get();

    let awarded = 0;
    for (const order of snapshot.docs) {
      if (order.data().status !== 'completed') continue;
      const result = await awardGhostCoinsForCompletedOrder(db, order.id);
      awarded += result.awarded;
    }

    return NextResponse.json({ success: true, awarded });
  } catch (error: any) {
    return NextResponse.json({ error: safeMessage(error, 'Could not sync Ghost Coins.') }, { status: authErrorStatus(error) });
  }
}
