import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpError, verifyBearerToken } from '@/lib/server/firebase-admin';

/**
 * Order secrets live in `orderSecrets/{orderId}`, a collection that Firestore rules deny to every client.
 * They hold:
 *  - `code`: the handover verification key. Only the BUYER (or a guest holding the guest key) may read it; the seller
 *    must be given it in person and type it in to complete the handover, so the seller can never self-verify.
 *  - `guestKeyHash`: SHA-256 of the guest access key (guests have no account; the key is their proof of ownership).
 */
export function newGuestKey(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function normaliseCode(code: unknown): string {
  return String(code ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export type OrderAccess =
  | { kind: 'buyer'; uid: string; order: any }
  | { kind: 'guest'; order: any };

/**
 * Proves the caller is THE BUYER of an order: either a signed-in buyer (Bearer token matching order.buyerId) or a guest
 * presenting the guest key issued when the order was created. Throws HttpError 400/401/403/404 otherwise.
 */
export async function requireOrderBuyer(db: Firestore, request: Request, orderId: string, guestKey?: string | null): Promise<OrderAccess & { id: string }> {
  if (!orderId) throw new HttpError(400, 'order_required', 'orderId is required.');
  const snap = await db.collection('orders').doc(orderId).get();
  if (!snap.exists) throw new HttpError(404, 'order_not_found', 'Order not found.');
  const order: any = snap.data();

  if (request.headers.get('authorization')) {
    const decoded = await verifyBearerToken(request);
    if (order.buyerId !== decoded.uid) throw new HttpError(403, 'not_order_owner', 'You do not own this order.');
    return { kind: 'buyer', uid: decoded.uid, order, id: snap.id };
  }

  if (!order.isGuestOrder) throw new HttpError(401, 'unauthenticated', 'Authentication required.');
  if (!guestKey) throw new HttpError(401, 'guest_key_required', 'The guest order key is required.');
  const secrets = await db.collection('orderSecrets').doc(orderId).get();
  const stored = String(secrets.data()?.guestKeyHash || '');
  if (!stored || !safeEqual(stored, hashKey(guestKey))) throw new HttpError(403, 'guest_key_invalid', 'The guest order key is not valid.');
  return { kind: 'guest', order, id: snap.id };
}

/** The verification code for an order (new orders: orderSecrets; legacy orders: the old `pickupCode` field). */
export async function readVerificationCode(db: Firestore, orderId: string, order: any): Promise<string> {
  const secrets = await db.collection('orderSecrets').doc(orderId).get();
  return String(secrets.data()?.code || order?.pickupCode || '');
}
