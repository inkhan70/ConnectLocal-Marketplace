import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export async function awardGhostCoinsForCompletedOrder(db: Firestore, orderId: string) {
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async transaction => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) return { awarded: 0, alreadyAwarded: false };
    const order: any = orderSnap.data();
    if (order.ghostCoinRewardAwarded === true) return { awarded: 0, alreadyAwarded: true };
    if (order.status !== 'completed' || !order.buyerId || String(order.buyerId).startsWith('guest_')) {
      return { awarded: 0, alreadyAwarded: false };
    }

    const buyerSnap = await transaction.get(db.collection('users').doc(String(order.buyerId)));
    if (!buyerSnap.exists) throw new Error('Buyer profile is missing.');

    const offer: any = order.ghostCoinOffer || {};
    const reward = Math.max(0, Math.floor(Number(offer.coinsPerSale || 0)));
    const minimumQuantity = Math.max(1, Math.floor(Number(offer.minimumQuantity || 1)));
    const quantity = (order.items || []).reduce((sum: number, item: any) => sum + Math.max(0, Math.floor(Number(item.quantity || 0))), 0);
    const enabled = offer.enabled === true && reward > 0 && quantity >= minimumQuantity;

    transaction.update(orderRef, {
      ghostCoinRewardAwarded: true,
      ghostCoinReward: enabled ? reward : 0,
      ghostCoinRewardQuantity: quantity,
      ghostCoinRewardAwardedAt: FieldValue.serverTimestamp(),
    });

    if (!enabled) return { awarded: 0, alreadyAwarded: false };

    transaction.update(buyerSnap.ref, {
      ghostCoins: FieldValue.increment(reward),
      totalGhostCoinsEarned: FieldValue.increment(reward),
    });
    return { awarded: reward, alreadyAwarded: false };
  });
}
