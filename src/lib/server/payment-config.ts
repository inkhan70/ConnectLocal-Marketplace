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

const CREDENTIAL_HINT: Record<string, string> = {
  stripe: 'Set STRIPE_SECRET_KEY in the deployment environment.',
  paypal: 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the deployment environment.',
  safepay: 'Set SAFEPAY_SECRET_KEY, SAFEPAY_PUBLIC_KEY and SAFEPAY_WEBHOOK_SECRET in the deployment environment, then redeploy.',
};

/**
 * The country / currency a SELLER sells in. The member confirms it on Dashboard -> Payments (`businessCountry`,
 * `businessCurrency`); that always wins. Older profile fields (`countryCode`, `currencyCode`) are the fallback. Every
 * place that asks "which payment methods apply to this seller?" (buyer list, order creation, member page) uses THIS
 * function, so the answer cannot differ between screens.
 */
export function sellerPaymentProfile(seller: any, fallback: { country?: string; currency?: string } = {}): { country: string; currency: string; confirmed: boolean } {
  const confirmedCountry = /^[A-Za-z]{2}$/.test(String(seller?.businessCountry || '')) ? String(seller.businessCountry).toUpperCase() : '';
  const confirmedCurrency = /^[A-Za-z]{3}$/.test(String(seller?.businessCurrency || '')) ? String(seller.businessCurrency).toUpperCase() : '';
  const profileCountry = /^[A-Za-z]{2}$/.test(String(seller?.countryCode || seller?.country || '')) ? String(seller.countryCode || seller.country).toUpperCase() : '';
  const profileCurrency = /^[A-Za-z]{3}$/.test(String(seller?.currencyCode || '')) ? String(seller.currencyCode).toUpperCase() : '';
  const currency = confirmedCurrency || (confirmedCountry === 'PK' && !profileCurrency ? 'PKR' : profileCurrency) || (fallback.currency || '').toUpperCase() || 'USD';
  const country = confirmedCountry || profileCountry || (currency === 'PKR' ? 'PK' : (fallback.country || '').toUpperCase()) || 'US';
  return { country, currency, confirmed: Boolean(confirmedCountry && confirmedCurrency) };
}

type StoredConfig = { enabled?: boolean; merchantApproved?: boolean; currencies?: string[]; webhookVerifiedAt?: string | null; [key: string]: unknown };

/**
 * Effective admin configuration for a provider in a country. A country document overrides the GLOBAL one only for the
 * fields it actually sets, and webhook verification belongs to the integration (not to a country), so it is read from
 * either document.
 */
export async function loadEffectiveProviderConfig(db: Firestore, method: string, country: string): Promise<StoredConfig | null> {
  const [globalSnap, countrySnap] = await Promise.all([
    db.collection('paymentProviderConfigs').doc(`${method}_GLOBAL`).get(),
    db.collection('paymentProviderConfigs').doc(`${method}_${country.toUpperCase()}`).get(),
  ]);
  const g = globalSnap.exists ? (globalSnap.data() as StoredConfig) : null;
  const c = countrySnap.exists ? (countrySnap.data() as StoredConfig) : null;
  if (!g && !c) return null;
  const merged: StoredConfig = { ...(g || {}) };
  for (const [key, value] of Object.entries(c || {})) if (value !== undefined) merged[key] = value;
  if (!c?.currencies?.length) merged.currencies = g?.currencies || [];
  merged.webhookVerifiedAt = c?.webhookVerifiedAt || g?.webhookVerifiedAt || null;
  return merged;
}

export interface ReadinessCheck { key: string; label: string; ok: boolean; detail?: string }
export interface ProviderReadiness { method: string; available: boolean; reason: string | null; checks: ReadinessCheck[] }

/** Every requirement for a provider to be offered to buyers, and which ones are not met yet. Single source of truth. */
export async function getProviderReadiness(db: Firestore, method: string, country: string, currency: string, env: NodeJS.ProcessEnv = process.env): Promise<ProviderReadiness> {
  const normalizedCountry = country.toUpperCase();
  const normalizedCurrency = currency.toUpperCase();
  const checks: ReadinessCheck[] = [];
  if (method === 'cod') return { method, available: true, reason: null, checks: [{ key: 'cod', label: 'Cash on Delivery needs no setup', ok: true }] };

  checks.push({ key: 'credentials', label: 'Server credentials configured', ok: credentialsReady(method, env), detail: CREDENTIAL_HINT[method] });

  const capability = DEFAULT_PROVIDER_CAPABILITIES.find((provider) => provider.id === method);
  const countryOk = Boolean(capability && (capability.countries.includes('*') || capability.countries.includes(normalizedCountry)));
  const currencyOk = Boolean(capability && (capability.currencies.includes('*') || capability.currencies.includes(normalizedCurrency)));
  checks.push({ key: 'region', label: `Supports ${normalizedCountry} / ${normalizedCurrency}`, ok: countryOk && currencyOk, detail: capability ? `${capability.label} supports ${capability.countries.join(', ')} in ${capability.currencies.join(', ')}.` : 'Provider has no adapter in this app yet.' });

  const config = await loadEffectiveProviderConfig(db, method, normalizedCountry);
  const mustBeConfigured = method === 'safepay'; // Safepay is never offered until the admin has approved it and its webhook has been seen
  if (mustBeConfigured || config) {
    checks.push({ key: 'enabled', label: 'Enabled by admin', ok: config?.enabled === true, detail: 'Admin -> Payment Providers: switch the provider on.' });
    checks.push({ key: 'approved', label: 'Merchant approved', ok: config?.merchantApproved === true, detail: 'Admin -> Payment Providers: tick "Merchant approved" once the provider has approved your merchant account.' });
    if (config?.currencies?.length) checks.push({ key: 'config_currency', label: `Admin currencies include ${normalizedCurrency}`, ok: config.currencies.includes(normalizedCurrency), detail: `Allowed by admin: ${config.currencies.join(', ')}.` });
  }
  if (method === 'safepay') {
    checks.push({ key: 'webhook', label: 'Webhook verified', ok: Boolean(config?.webhookVerifiedAt), detail: 'Add the webhook endpoint in the Safepay dashboard and send a test event (or run scripts/simulate-safepay-webhook.cjs). It turns green after the first correctly signed webhook.' });
  }
  const failing = checks.find((check) => !check.ok);
  return { method, available: !failing, reason: failing ? `${failing.label}: not met. ${failing.detail || ''}`.trim() : null, checks };
}

export async function isPaymentMethodAvailable(db: Firestore, method: string, country: string, currency: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  return (await getProviderReadiness(db, method, country, currency, env)).available;
}
