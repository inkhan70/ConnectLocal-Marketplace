import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { canBuyerRequestRefund, canCancelOrder, canTransition, type OrderStatus } from '@/lib/order-domain';
import { notifyOrderParties, notifyUser } from '@/lib/server/notifications';
import { awardGhostCoinsForCompletedOrder } from '@/lib/server/rewards';

async function isAdminUser(db: Firestore, uid: string) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists && snap.data()?.isAdmin === true;
}

// Statuses a seller (or admin) may set through the generic "transition" action.
// 'paid' comes only from payment confirmation, 'picked_up'/'completed' only from the
// verified pickup / buyer-confirmed delivery actions, and refund states only from the refund flow.
const MANUAL_TRANSITIONS = new Set<OrderStatus>(['processing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled']);

async function cancelAndRestoreStock(db: Firestore, ref: FirebaseFirestore.DocumentReference, actorId: string) {
  await db.runTransaction(async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists) throw new Error('Order not found.');
    const data: any = current.data();
    if (!canCancelOrder(data.status as OrderStatus)) throw new Error('This order cannot be cancelled now.');
    const productRefs = (data.items || []).map((item: any) => db.collection('products').doc(String(item.productId)));
    const productSnaps = data.inventoryRestoredAt ? [] : await Promise.all(productRefs.map((r: any) => transaction.get(r)));
    const restored = new Map<string, number>();
    for (const item of data.items || []) restored.set(String(item.productId), (restored.get(String(item.productId)) || 0) + Number(item.quantity || 0));
    for (const snap of productSnaps as any[]) {
      if (!snap.exists) continue;
      const product: any = snap.data();
      const inventory = Number(product.inventory || 0) + (restored.get(snap.id) || 0);
      transaction.update(snap.ref, { inventory, status: inventory === 0 ? 'Out of Stock' : inventory <= Number(product.lowStockThreshold || 0) ? 'Low Stock' : 'Active', updatedAt: FieldValue.serverTimestamp() });
    }
    transaction.update(ref, {
      status: 'cancelled',
      ...(data.inventoryRestoredAt ? {} : { inventoryRestoredAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
      audit: FieldValue.arrayUnion({ action: 'order_cancelled', actorId, at: new Date().toISOString() }),
    });
  });
}

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const ref = db.collection('orders').doc(params.orderId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const order: any = snap.data();
    const body = await request.json();
    const action = String(body.action || '');
    const admin = await isAdminUser(db, decoded.uid);

    if (![order.buyerId, order.businessId].includes(decoded.uid) && !admin) return NextResponse.json({ error: 'Not authorized for this order.' }, { status: 403 });

    if (action === 'cancel') {
      if (decoded.uid !== order.buyerId || !canCancelOrder(order.status as OrderStatus)) return NextResponse.json({ error: 'This order cannot be cancelled now.' }, { status: 409 });
      // A captured online payment must go through the refund flow, otherwise the buyer would lose the money.
      if (order.paymentMethod !== 'cod' && order.paymentStatus === 'paid') {
        return NextResponse.json({ error: 'This order has already been paid online. Please request a refund instead.' }, { status: 409 });
      }
      await cancelAndRestoreStock(db, ref, decoded.uid);
      await notifyOrderParties({ ...order, id: params.orderId }, { title: 'Order cancelled', body: `Order ${params.orderId} was cancelled.`, type: 'order_cancelled' });
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    if (action === 'refund_request') {
      if (decoded.uid !== order.buyerId || !canBuyerRequestRefund(order.status as OrderStatus)) return NextResponse.json({ error: 'This order is not eligible for a refund request.' }, { status: 409 });
      await ref.update({ status: 'refund_requested', refundReason: String(body.reason || 'Customer requested refund'), updatedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'refund_requested', actorId: decoded.uid, at: new Date().toISOString() }) });
      await notifyUser(String(order.businessId), { title: 'Refund requested', body: `Buyer requested a refund for order ${params.orderId}.`, type: 'refund_requested', orderId: params.orderId });
      return NextResponse.json({ success: true, status: 'refund_requested' });
    }

    if (action === 'refund_decision') {
      if (!admin) return NextResponse.json({ error: 'Only an administrator can approve or reject refunds.' }, { status: 403 });
      if (order.status !== 'refund_requested') return NextResponse.json({ error: 'This order has no pending refund request.' }, { status: 409 });
      const approved = body.approved === true;
      const next = approved ? 'refund_approved' : 'refund_rejected';
      await ref.update({ status: next, refundDecision: approved ? 'approved' : 'rejected', refundDecisionBy: decoded.uid, refundDecisionAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: next, actorId: decoded.uid, at: new Date().toISOString() }) });
      await notifyOrderParties({ ...order, id: params.orderId }, { title: approved ? 'Refund approved' : 'Refund rejected', body: `Refund request for order ${params.orderId} was ${approved ? 'approved' : 'rejected'}.`, type: 'refund_decision' });
      return NextResponse.json({ success: true, status: next });
    }

    if (action === 'mark_refunded') {
      if (!admin) return NextResponse.json({ error: 'Only an administrator can complete a refund.' }, { status: 403 });
      if (order.status !== 'refund_approved') return NextResponse.json({ error: 'This refund has not been approved.' }, { status: 409 });
      if (order.paymentMethod !== 'cod') return NextResponse.json({ error: 'Online payments are marked refunded automatically once the payment provider confirms the refund.' }, { status: 409 });
      await ref.update({ status: 'refunded', paymentStatus: 'refunded', refundedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'refunded', actorId: decoded.uid, at: new Date().toISOString() }) });
      await notifyOrderParties({ ...order, id: params.orderId }, { title: 'Order refunded', body: `Order ${params.orderId} has been refunded.`, type: 'refund_completed' });
      return NextResponse.json({ success: true, status: 'refunded' });
    }

    if (action === 'transition') {
      if (decoded.uid !== order.businessId && !admin) return NextResponse.json({ error: 'Only the seller or administrator can change fulfillment status.' }, { status: 403 });
      const next = String(body.status) as OrderStatus;
      if (!MANUAL_TRANSITIONS.has(next)) return NextResponse.json({ error: `Status "${next}" cannot be set manually.` }, { status: 403 });
      if (!canTransition(order.status as OrderStatus, next)) return NextResponse.json({ error: `Invalid order transition: ${order.status} -> ${next}` }, { status: 409 });
      if (next === 'ready_for_pickup' && order.deliveryMethod !== 'pickup') return NextResponse.json({ error: 'Only pickup orders can be marked ready for pickup.' }, { status: 409 });
      if ((next === 'out_for_delivery' || next === 'delivered') && order.deliveryMethod !== 'seller_delivery') return NextResponse.json({ error: 'Only delivery orders can be sent out for delivery.' }, { status: 409 });
      if (next === 'cancelled') {
        if (order.paymentMethod !== 'cod' && order.paymentStatus === 'paid') return NextResponse.json({ error: 'This order was paid online. The buyer must request a refund.' }, { status: 409 });
        await cancelAndRestoreStock(db, ref, decoded.uid);
        await notifyOrderParties({ ...order, id: params.orderId }, { title: 'Order cancelled', body: `Order ${params.orderId} was cancelled by the seller.`, type: 'order_cancelled' });
        return NextResponse.json({ success: true, status: 'cancelled' });
      }
      await ref.update({ status: next, updatedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'status_changed', actorId: decoded.uid, from: order.status, to: next, at: new Date().toISOString() }) });
      await notifyOrderParties({ ...order, id: params.orderId }, { title: `Order ${next.replaceAll('_', ' ')}`, body: `Order ${params.orderId} changed to ${next.replaceAll('_', ' ')}.`, type: 'order_status_changed' });
      return NextResponse.json({ success: true, status: next });
    }

    if (action === 'confirm_delivery') {
      if (decoded.uid !== order.buyerId || order.status !== 'delivered' || order.deliveryMethod !== 'seller_delivery') return NextResponse.json({ error: 'This order is not awaiting delivery confirmation.' }, { status: 409 });
      await ref.update({ status: 'completed', deliveryConfirmedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'delivery_confirmed', actorId: decoded.uid, at: new Date().toISOString() }) });
      const reward = await awardGhostCoinsForCompletedOrder(db, params.orderId);
      if (reward.awarded > 0) await notifyUser(String(order.buyerId), { title: 'Ghost Coins earned', body: `You earned ${reward.awarded} Ghost Coins from this seller offer.`, type: 'ghost_coin_reward', orderId: params.orderId });
      await notifyOrderParties({ ...order, id: params.orderId }, { title: 'Delivery confirmed', body: `Order ${params.orderId} is complete.`, type: 'delivery_confirmed' });
      return NextResponse.json({ success: true, status: 'completed' });
    }

    if (action === 'verify_pickup') {
      if (decoded.uid !== order.businessId && !admin) return NextResponse.json({ error: 'Only the seller can verify pickup.' }, { status: 403 });
      if (order.deliveryMethod !== 'pickup' || order.status !== 'ready_for_pickup') return NextResponse.json({ error: 'This order is not ready for pickup verification.' }, { status: 409 });
      if (String(body.pickupCode || '').trim().toUpperCase() !== String(order.pickupCode || '').toUpperCase()) return NextResponse.json({ error: 'Pickup code does not match.' }, { status: 400 });
      await ref.update({ pickupVerified: true, pickupVerifiedAt: FieldValue.serverTimestamp(), pickupVerifiedBy: decoded.uid, status: 'completed', updatedAt: FieldValue.serverTimestamp(), audit: FieldValue.arrayUnion({ action: 'pickup_verified', actorId: decoded.uid, at: new Date().toISOString() }) });
      const reward = await awardGhostCoinsForCompletedOrder(db, params.orderId);
      if (reward.awarded > 0) await notifyUser(String(order.buyerId), { title: 'Ghost Coins earned', body: `You earned ${reward.awarded} Ghost Coins from this seller offer.`, type: 'ghost_coin_reward', orderId: params.orderId });
      await notifyOrderParties({ ...order, id: params.orderId }, { title: 'Pickup verified', body: `Order ${params.orderId} has been completed at pickup.`, type: 'pickup_verified' });
      return NextResponse.json({ success: true, status: 'completed' });
    }

    return NextResponse.json({ error: 'Unknown order action.' }, { status: 400 });
  } catch (error: any) {
    console.error('Order action failed:', error);
    const status = authErrorStatus(error);
    return NextResponse.json({ error: error?.message || 'Order action failed.' }, { status });
  }
}
