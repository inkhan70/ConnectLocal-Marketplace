import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export type PaymentStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled';

export async function createPendingTransaction(db: Firestore, input: { orderId: string; buyerId?: string; sellerId?: string; provider: string; country: string; currency: string; amountMinor: number; platformFeeMinor: number; idempotencyKey: string; }) {
  const existing = await db.collection('paymentTransactions').where('idempotencyKey', '==', input.idempotencyKey).limit(1).get();
  if (!existing.empty) return existing.docs[0];
  const ref = db.collection('paymentTransactions').doc();
  await ref.set({ ...input, sellerAmountMinor: input.amountMinor - input.platformFeeMinor, status: 'pending' satisfies PaymentStatus, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
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

export async function recordRefund(db: Firestore, input: { transactionId: string; amountMinor: number; providerReference?: string; reason?: string; }) {
  const ref = db.collection('paymentRefunds').doc();
  await ref.set({ ...input, status: 'pending', createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}
