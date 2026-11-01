/**
 * Which payment methods can actually work on THIS deployment.
 * Online methods appear only when the server holds working credentials, so a buyer is never offered (or charged
 * an order reservation for) a provider that cannot complete. JazzCash / Easypaisa are not offered until their
 * provider-specific adapters exist.
 */
export type PaymentMethodValue = 'cod' | 'stripe' | 'paypal' | 'safepay';

export interface PaymentMethodOption { value: PaymentMethodValue; label: string; description: string }

export function getEnabledPaymentMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodOption[] {
  const methods: PaymentMethodOption[] = [{ value: 'cod', label: 'Cash on Delivery', description: 'Pay the seller when you receive your order.' }];
  if (env.STRIPE_SECRET_KEY) methods.push({ value: 'stripe', label: 'Credit / Debit Card', description: 'Secure card payment (Stripe).' });
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) methods.push({ value: 'paypal', label: 'PayPal', description: 'Pay with your PayPal account.' });
  if (env.SAFEPAY_SECRET_KEY && env.SAFEPAY_PUBLIC_KEY) methods.push({ value: 'safepay', label: 'Safepay', description: 'Pay securely in PKR with Safepay.' });
  return methods;
}

export function isPaymentMethodEnabled(method: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return getEnabledPaymentMethods(env).some((m) => m.value === method);
}
