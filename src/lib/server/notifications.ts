import { getAdminDb } from './firebase-admin';

// Notifications are best-effort: a failure here must never turn an already-committed
// order/payment action into an error response.
export async function notifyUser(userId: string, input: { title: string; body: string; type: string; orderId?: string }) {
  if (!userId || userId.startsWith('guest_')) return;
  try {
    const db = getAdminDb();
    await db.collection('notifications').add({ userId, ...input, read: false, createdAt: new Date() });
  } catch (error) {
    console.error('Notification failed:', error);
  }
}

export async function notifyOrderParties(order: any, input: { title: string; body: string; type: string }) {
  await Promise.all([
    notifyUser(String(order.buyerId || ''), { ...input, orderId: order.id }),
    notifyUser(String(order.businessId || ''), { ...input, orderId: order.id }),
  ]);
}
