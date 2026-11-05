import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb, requireAdmin } from '@/lib/server/firebase-admin';
import { applyPaymentEvent } from '@/lib/server/order-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Called by a protected scheduler or an admin to release abandoned payment reservations. */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  try {
    if (!cronSecret || bearer !== cronSecret) await requireAdmin(request);
    const cutoff = Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);
    const db = getAdminDb();
    const snapshot = await db.collection('orders').where('status', '==', 'pending_payment').limit(2000).get();
    let expired = 0;
    let scanned = 0;
    for (const order of snapshot.docs) {
      const createdAt = order.data().createdAt;
      const createdMillis = typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : Date.parse(String(createdAt || ''));
      if (!Number.isFinite(createdMillis) || createdMillis > cutoff.toMillis()) continue;
      scanned += 1;
      const result = await applyPaymentEvent(db, order.id, 'failed', { provider: String(order.data().paymentMethod || 'system'), transactionId: null });
      if (result.changed) expired += 1;
    }
    return NextResponse.json({ success: true, expired, scanned });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to expire pending orders.' }, { status: 401 });
  }
}
