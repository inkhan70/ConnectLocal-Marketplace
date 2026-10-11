export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'picked_up',
  'completed',
  'cancelled',
  'refund_requested',
  'refund_approved',
  'refunded',
  'refund_rejected',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_METHODS = [
  'cod',
  'jazzcash',
  'easypaisa',
  'stripe',
  'paypal',
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type DeliveryMethod = 'seller_delivery' | 'pickup';

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refund_requested'],
  processing: ['ready_for_pickup', 'out_for_delivery', 'cancelled', 'refund_requested'],
  ready_for_pickup: ['picked_up', 'cancelled', 'refund_requested'],
  out_for_delivery: ['delivered', 'cancelled', 'refund_requested'],
  delivered: ['completed', 'refund_requested'],
  picked_up: ['completed', 'refund_requested'],
  completed: ['refund_requested'],
  cancelled: [],
  refund_requested: ['refund_approved', 'refund_rejected'],
  refund_approved: ['refunded'],
  refunded: [],
  refund_rejected: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from]?.includes(to) ?? false;
}

export function canBuyerRequestRefund(status: OrderStatus) {
  return ['paid', 'processing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'picked_up', 'completed'].includes(status);
}

export function canCancelOrder(status: OrderStatus) {
  return ['pending_payment', 'paid', 'processing', 'ready_for_pickup'].includes(status);
}

export function generatePickupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) throw new Error('Secure random number generation is unavailable.');
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export function haversineKm(a?: { latitude?: number; longitude?: number }, b?: { latitude?: number; longitude?: number }) {
  if (a?.latitude == null || a.longitude == null || b?.latitude == null || b.longitude == null) return null;
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function calculateDeliveryFee(args: {
  method: DeliveryMethod;
  subtotal: number;
  seller: { latitude?: number; longitude?: number; deliveryBaseFee?: number; deliveryPerKm?: number; deliveryFreeAbove?: number; maxDeliveryFee?: number };
  buyer?: { latitude?: number; longitude?: number };
}) {
  if (args.method === 'pickup') return { fee: 0, distanceKm: 0, estimated: false };
  const base = Math.max(0, Number(args.seller.deliveryBaseFee ?? 0));
  const perKm = Math.max(0, Number(args.seller.deliveryPerKm ?? 0));
  const freeAbove = Number(args.seller.deliveryFreeAbove ?? 0);
  if (freeAbove > 0 && args.subtotal >= freeAbove) return { fee: 0, distanceKm: null, estimated: true };

  const distanceKm = haversineKm(args.seller, args.buyer);
  const fee = distanceKm == null ? base : base + distanceKm * perKm;
  const maxFee = Number(args.seller.maxDeliveryFee ?? 0);
  const capped = maxFee > 0 ? Math.min(fee, maxFee) : fee;
  return { fee: Math.round(capped * 100) / 100, distanceKm, estimated: distanceKm == null };
}
