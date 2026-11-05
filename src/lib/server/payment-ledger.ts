import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

export type PaymentStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled';

export async function createPendingTransaction(db: Firestore, input: { orderId: string; buyerId?: string; sellerId?: string; provider: string; country: string; currency: string; amountMinor: number; platformFeeMinor: number; idempotencyKey: string; }) {
  // Preserve compatibility with older random-ID rows, then use a deterministic ID plus a transaction for new rows.
  const existing = await db.collection('paymentTransactions').where('idempotencyKey', '==', input.idempotencyKey).limit(1).get();
  if (!existing.empty) return existing.docs[0];
  const id = crypto.createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 40);
  const ref = db.collection('paymentTransactions').doc(id);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.exists) transaction.create(ref, { ...input, sellerAmountMinor: Math.max(0, input.amountMinor - input.platformFeeMinor), status: 'pending' satisfies PaymentStatus, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  return ref;
}

export async function recordPaymentEvent(db: Firestore, transactionId: string, event: { status: PaymentStatus; providerReference?: string; eventId: string; rawType: string; }) {
  const eventRef = db.collection('paymentEvents').doc(event.eventId);
  const transactionRef = db.collection('paymentTransactions').doc(transactionId);
  const existing = await eventRef.get();
  if (existing.exists) return false;
  await db.runTransaction(async (tx) => {
    tx.create(eventRef, { transactionId, ...event, receivedAt: FieldValue.serverTimestamp() });
    tx.set(transactionRef, { status: event.status, providerReference: event.providerReference || null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return true;
}

/**
 * Keeps the ledger row in step with a verified payment event on its order (called by applyPaymentEvent).
 * The order is the source of truth for WHEN the seller can be paid; the ledger records WHAT was paid.
 */
export async function syncLedgerForOrder(
  db: Firestore,
  order: { ledgerTransactionId?: string },
  kind: 'paid' | 'failed' | 'refunded',
  meta: { transactionId?: string | null; providerFeeMinor?: number | null; providerNetMinor?: number | null } = {},
) {
  const id = order?.ledgerTransactionId;
  if (!id) return; // COD and older orders have no ledger row
  const ref = db.collection('paymentTransactions').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return;
  const current: any = snap.data() || {};
  const base = { updatedAt: FieldValue.serverTimestamp() } as Record<string, any>;
  if (kind === 'paid') {
    await ref.set({ ...base, status: 'succeeded', settlementStatus: current.settlementStatus === 'paid_out' ? 'paid_out' : 'held', paidAt: FieldValue.serverTimestamp(), providerReference: meta.transactionId || current.providerReference || null, ...(meta.providerFeeMinor != null ? { providerFeeMinor: meta.providerFeeMinor } : {}), ...(meta.providerNetMinor != null ? { providerNetMinor: meta.providerNetMinor } : {}) }, { merge: true });
  } else if (kind === 'failed') {
    await ref.set({ ...base, status: 'failed', settlementStatus: 'reversed' }, { merge: true });
  } else {
    // A refund that arrives AFTER the seller was already paid must be recovered by the admin: flag it, never hide it.
    await ref.set({ ...base, status: 'refunded', ...(current.settlementStatus === 'paid_out' ? { refundedAfterPayout: true } : { settlementStatus: 'reversed' }) }, { merge: true });
  }
}

export async function recordRefund(db: Firestore, input: { transactionId: string; amountMinor: number; providerReference?: string; reason?: string; }) {
  const ref = db.collection('paymentRefunds').doc();
  await ref.set({ ...input, status: 'pending', createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}
