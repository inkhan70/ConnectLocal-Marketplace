/**
 * Which payment methods can actually work on THIS deployment.
 * Online methods appear only when the server holds working credentials, so a buyer is never offered (or charged
 * an order reservation for) a provider that cannot complete. JazzCash / Easypaisa are not offered until their
 * provider-specific adapters exist.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { DEFAULT_PROVIDER_CAPABILITIES } from '@/lib/server/provider-capabilities';

export type PaymentMethodValue = 'cod' | 'stripe' | 'paypal' | 'safepay';

export interface PlatformFeeConfig {
  commissionPercent: number;
  serviceChargePercent: number;
  updatedAt?: string | null;
}

export function clampPercent(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(50, Math.max(0, Math.round(n * 100) / 100)) : fallback;
}

export async function getPlatformFeeConfig(db: Firestore, env: NodeJS.ProcessEnv = process.env): Promise<PlatformFeeConfig> {
  const fallback = {
    commissionPercent: clampPercent(env.PLATFORM_FEE_PERCENT),
    serviceChargePercent: clampPercent(env.PLATFORM_SERVICE_CHARGE_PERCENT),
  };
  const snap = await db.collection('appSettings').doc('payments').get();
  const data = snap.exists ? snap.data() as any : null;
  if (!data) return fallback;
  return {
    commissionPercent: clampPercent(data.commissionPercent, fallback.commissionPercent),
    serviceChargePercent: clampPercent(data.serviceChargePercent, fallback.serviceChargePercent),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null,
  };
}

export interface PaymentMethodOption { value: PaymentMethodValue; label: string; description: string }

export function getEnabledPaymentMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodOption[] {
  const methods: PaymentMethodOption[] = [{ value: 'cod', label: 'Cash on Delivery', description: 'Pay the seller when you receive your order.' }];
  if (env.STRIPE_SECRET_KEY) methods.push({ value: 'stripe', label: 'Credit / Debit Card', description: 'Secure card payment (Stripe).' });
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) methods.push({ value: 'paypal', label: 'PayPal', description: 'Pay with your PayPal account.' });
  // Offered only when the webhook secret is set too: the webhook is the ONLY thing that confirms a Safepay payment.
  if (env.SAFEPAY_SECRET_KEY && env.SAFEPAY_PUBLIC_KEY && env.SAFEPAY_WEBHOOK_SECRET) methods.push({ value: 'safepay', label: 'Safepay', description: 'Pay securely in PKR with Safepay.' });
  return methods;
}

export function isPaymentMethodEnabled(method: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return getEnabledPaymentMethods(env).some((m) => m.value === method);
}

function credentialsReady(method: string, env: NodeJS.ProcessEnv): boolean {
  if (method === 'stripe') return Boolean(env.STRIPE_SECRET_KEY);
  if (method === 'paypal') return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  if (method === 'safepay') return Boolean(env.SAFEPAY_SECRET_KEY && env.SAFEPAY_PUBLIC_KEY && env.SAFEPAY_WEBHOOK_SECRET);
  return method === 'cod';
}

export async function isPaymentMethodAvailable(db: Firestore, method: string, country: string, currency: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!credentialsReady(method, env)) return false;
  if (method === 'cod') return true;
  const normalizedCountry = country.toUpperCase();
  const normalizedCurrency = currency.toUpperCase();
  const [globalSnap, countrySnap] = await Promise.all([
    db.collection('paymentProviderConfigs').doc(`${method}_GLOBAL`).get(),
    db.collection('paymentProviderConfigs').doc(`${method}_${normalizedCountry}`).get(),
  ]);
  const config = countrySnap.exists ? countrySnap.data() as any : globalSnap.exists ? globalSnap.data() as any : null;
  if (config && config.enabled !== true) return false;
  if (config?.currencies?.length && !config.currencies.includes(normalizedCurrency)) return false;
  if (config && config.merchantApproved !== true) return false;
  const capability = DEFAULT_PROVIDER_CAPABILITIES.find((provider) => provider.id === method);
  if (!capability || !(capability.countries.includes('*') || capability.countries.includes(normalizedCountry)) || !(capability.currencies.includes('*') || capability.currencies.includes(normalizedCurrency))) return false;
  if (method === 'safepay' && config && !config.webhookVerifiedAt) return false;
  return true;
}
