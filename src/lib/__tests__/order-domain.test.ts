import { canBuyerRequestRefund, canCancelOrder, canTransition, calculateDeliveryFee, generatePickupCode } from '@/lib/order-domain';

describe('order domain', () => {
  test('enforces safe status transitions', () => {
    expect(canTransition('pending_payment', 'paid')).toBe(true);
    expect(canTransition('pending_payment', 'completed')).toBe(false);
    expect(canTransition('ready_for_pickup', 'picked_up')).toBe(true);
  });

  test('refunds are only requested from eligible states', () => {
    expect(canBuyerRequestRefund('completed')).toBe(true);
    expect(canBuyerRequestRefund('cancelled')).toBe(false);
  });

  test('cancellation is limited to early states', () => {
    expect(canCancelOrder('processing')).toBe(true);
    expect(canCancelOrder('delivered')).toBe(false);
  });

  test('pickup has zero delivery fee', () => {
    expect(calculateDeliveryFee({ method: 'pickup', subtotal: 100, seller: {} })).toEqual({ fee: 0, distanceKm: 0, estimated: false });
  });

  test('distance delivery uses seller pricing and a cap', () => {
    const result = calculateDeliveryFee({ method: 'seller_delivery', subtotal: 100, seller: { latitude: 0, longitude: 0, deliveryBaseFee: 10, deliveryPerKm: 2, maxDeliveryFee: 20 }, buyer: { latitude: 0, longitude: 0.1 } });
    expect(result.fee).toBe(20);
    expect(result.distanceKm).toBeGreaterThan(10);
  });

  test('pickup codes are fixed length and exclude ambiguous characters', () => {
    const code = generatePickupCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
