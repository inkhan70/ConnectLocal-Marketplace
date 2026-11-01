export type ProviderId = 'stripe' | 'paypal' | 'safepay' | 'jazzcash' | 'easypaisa' | 'cod';

export type ProviderCapability = {
  id: ProviderId;
  label: string;
  countries: string[];
  currencies: string[];
  platform: boolean;
  marketplace: boolean;
  onboarding: 'connect' | 'merchant_review' | 'none';
  status: 'enabled' | 'review_required' | 'disabled';
  note: string;
};

export const DEFAULT_PROVIDER_CAPABILITIES: ProviderCapability[] = [
  { id: 'stripe', label: 'Stripe', countries: ['US', 'GB', 'CA', 'AU', 'AE', 'SG'], currencies: ['USD', 'GBP', 'CAD', 'AUD', 'AED', 'SGD'], platform: true, marketplace: true, onboarding: 'connect', status: 'enabled', note: 'Marketplace onboarding is available only where Stripe Connect supports the seller country and your account.' },
  { id: 'paypal', label: 'PayPal', countries: ['*'], currencies: ['USD', 'GBP', 'EUR', 'CAD', 'AUD'], platform: true, marketplace: false, onboarding: 'merchant_review', status: 'enabled', note: 'Existing PayPal checkout remains available; marketplace payout onboarding requires separate approval.' },
  { id: 'safepay', label: 'Safepay', countries: ['PK'], currencies: ['PKR'], platform: true, marketplace: false, onboarding: 'merchant_review', status: 'enabled', note: 'Safepay checkout collects PKR payments for the platform. Member settlement requires Safepay marketplace approval and is tracked by the admin.' },
  { id: 'jazzcash', label: 'JazzCash', countries: ['PK'], currencies: ['PKR'], platform: false, marketplace: false, onboarding: 'merchant_review', status: 'review_required', note: 'Direct merchant collection may be available by contract. Marketplace split settlement and seller payouts require written JazzCash approval and an adapter.' },
  { id: 'easypaisa', label: 'Easypaisa', countries: ['PK'], currencies: ['PKR'], platform: false, marketplace: false, onboarding: 'merchant_review', status: 'review_required', note: 'Merchant API access is contract-based. Marketplace settlement and payout capability must be confirmed with Easypaisa before activation.' },
  { id: 'cod', label: 'Cash on Delivery', countries: ['*'], currencies: ['*'], platform: false, marketplace: true, onboarding: 'none', status: 'enabled', note: 'Fulfillment collection only; no online provider settlement.' },
];

export function getCountrySuggestion(headers: Headers): string {
  const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || headers.get('x-country-code');
  return /^[A-Z]{2}$/.test(country || '') ? country! : 'US';
}

export function getCapabilitiesForCountry(country: string, configs: ProviderCapability[] = DEFAULT_PROVIDER_CAPABILITIES) {
  const normalized = country.toUpperCase();
  return configs.filter((provider) => provider.countries.includes('*') || provider.countries.includes(normalized));
}

export function isMarketplaceProviderAvailable(provider: ProviderCapability, country: string, currency: string) {
  return provider.marketplace && (provider.countries.includes('*') || provider.countries.includes(country.toUpperCase())) && (provider.currencies.includes('*') || provider.currencies.includes(currency.toUpperCase())) && provider.status === 'enabled';
}
