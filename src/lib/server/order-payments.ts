import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export type PaymentEventKind = 'paid' | 'failed' | 'refunded';

export interface PaymentEventMeta {
  provider?: string;
  sessionId?: string | null;
  transactionId?: string | null;
}

/**
 * Applies a verified payment-provider event to an order, idempotently.
 *
 * Providers retry webhooks and may deliver them out of order, so every transition is
 * guarded by the order's current status:
 *  - paid:     only moves pending_payment -> paid. A payment arriving for an already
 *              cancelled order is flagged for refund instead of silently reviving the order.
 *  - failed:   only cancels a pending_payment order, and returns the reserved stock.
 *  - refunded: completes an approved refund; otherwise just records the provider state.
 */
export async function applyPaymentEvent(
  db: Firestore,
  orderId: string,
  kind: PaymentEventKind,
  meta: PaymentEventMeta = {},
  expected?: { amountMinor?: number | null; currency?: string | null },
): Promise<{ found: boolean; changed: boolean; order?: any; mismatch?: boolean }> {
  const ref = db.collection('orders').doc(orderId);
  let result: { found: boolean; changed: boolean; order?: any; mismatch?: boolean } = { found: false, changed: false };

  await db.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) { result = { found: false, changed: false }; return; }
    const order: any = snap.data();
    result = { found: true, changed: false, order };

    const providerFields: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (meta.provider) providerFields.paymentProvider = meta.provider;
    if (meta.sessionId) providerFields.paymentSessionId = meta.sessionId;
    if (meta.transactionId) providerFields.paymentTransactionId = meta.transactionId;

    if (kind === 'paid') {
      if (expected?.amountMinor != null && Math.round(Number(order.totalCost) * 100) !== expected.amountMinor) {
        result.mismatch = true;
        transaction.update(ref, { ...providerFields, paymentMismatch: true, audit: FieldValue.arrayUnion({ action: 'payment_amount_mismatch', actorId: 'system', at: new Date().toISOString() }) });
        return;
      }
      if (expected?.currency && String(order.currency || '').toUpperCase() !== expected.currency.toUpperCase()) {
        result.mismatch = true;
        transaction.update(ref, { ...providerFields, paymentMismatch: true, audit: FieldValue.arrayUnion({ action: 'payment_currency_mismatch', actorId: 'system', at: new Date().toISOString() }) });
        return;
      }
      if (order.status === 'pending_payment') {
        transaction.update(ref, { ...providerFields, status: 'paid', paymentStatus: 'paid', paidAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'payment_confirmed', actorId: 'system', at: new Date().toISOString() }) });
        result.changed = true;
      } else if (order.status === 'cancelled' && order.paymentStatus !== 'paid') {
        // Money was captured for an order that is already cancelled: keep it cancelled, flag it for a refund.
        transaction.update(ref, { ...providerFields, paymentStatus: 'paid', needsRefund: true, audit: FieldValue.arrayUnion({ action: 'payment_after_cancellation', actorId: 'system', at: new Date().toISOString() }) });
        result.changed = true;
      }
      return;
    }

    if (kind === 'failed') {
      if (order.status !== 'pending_payment') return;
      const items: any[] = order.items || [];
      const productSnaps = order.inventoryRestoredAt ? [] : await Promise.all(items.map(item => transaction.get(db.collection('products').doc(String(item.productId)))));
      const qtyByProduct = new Map<string, number>();
      for (const item of items) qtyByProduct.set(String(item.productId), (qtyByProduct.get(String(item.productId)) || 0) + Number(item.quantity || 0));
      const seen = new Set<string>();
      for (const productSnap of productSnaps) {
        if (!productSnap.exists || seen.has(productSnap.id)) continue;
        seen.add(productSnap.id);
        const product: any = productSnap.data();
        const inventory = Number(product.inventory || 0) + (qtyByProduct.get(productSnap.id) || 0);
        transaction.update(productSnap.ref, { inventory, status: inventory === 0 ? 'Out of Stock' : inventory <= Number(product.lowStockThreshold || 0) ? 'Low Stock' : 'Active', updatedAt: FieldValue.serverTimestamp() });
      }
      transaction.update(ref, { ...providerFields, status: 'cancelled', paymentStatus: 'failed', ...(order.inventoryRestoredAt ? {} : { inventoryRestoredAt: FieldValue.serverTimestamp() }), audit: FieldValue.arrayUnion({ action: 'payment_failed', actorId: 'system', at: new Date().toISOString() }) });
      result.changed = true;
      return;
    }

    if (kind === 'refunded') {
      if (order.paymentStatus === 'refunded' && order.status === 'refunded') return;
      const patch: Record<string, any> = { ...providerFields, paymentStatus: 'refunded', refundedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'provider_refund_confirmed', actorId: 'system', at: new Date().toISOString() }) };
      if (order.status === 'refund_approved') patch.status = 'refunded';
      transaction.update(ref, patch);
      result.changed = true;
    }
  });

  return result;
}
