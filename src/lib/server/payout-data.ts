import type { Firestore } from 'firebase-admin/firestore';
import type { LedgerRow } from '@/lib/settlement';

export const toLedgerRow = (doc: { id: string; data: () => any }): LedgerRow => {
  const d = doc.data() || {};
  return {
    id: doc.id, orderId: String(d.orderId || ''), sellerId: d.sellerId, currency: String(d.currency || ''),
    amountMinor: Number(d.amountMinor || 0), platformFeeMinor: Number(d.platformFeeMinor || 0),
    sellerAmountMinor: typeof d.sellerAmountMinor === 'number' ? d.sellerAmountMinor : undefined,
    status: String(d.status || ''), settlementStatus: d.settlementStatus, payoutId: d.payoutId ?? null,
  };
};

/** Current status of each order (batched reads). Missing orders are simply absent from the map. */
export async function loadOrderStatuses(db: Firestore, orderIds: string[]): Promise<Record<string, string | undefined>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => db.collection('orders').doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) if (snap.exists) out[snap.id] = (snap.data() as any)?.status;
  }
  return out;
}
