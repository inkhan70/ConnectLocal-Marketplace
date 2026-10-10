import type { NextRequest } from 'next/server';

export interface IpCurrencyContext {
  countryCode: string;
  countryName: string;
  currency: string;
  source: 'ip-header' | 'ipapi' | 'profile-fallback';
}

type FxSnapshot = {
  rates: Record<string, number>;
  fetchedAt: number;
  nextUpdateAt?: number;
};

let fxCache: FxSnapshot | null = null;

function normalizeCurrency(value?: string) {
  const currency = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function getTrustedHeader(request: NextRequest, names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')[0]?.trim();
  return (
    getTrustedHeader(request, ['cf-connecting-ip', 'true-client-ip', 'x-real-ip']) ||
    firstForwarded ||
    null
  );
}

/**
 * Detect country/currency from the request IP. Cloudflare/Vercel country headers
 * are preferred; ipapi is used when the hosting platform does not provide them.
 */
export async function detectIpCurrency(request: NextRequest, profile?: any): Promise<IpCurrencyContext> {
  const headerCountry = getTrustedHeader(request, ['x-vercel-ip-country', 'cf-ipcountry']);
  const headerCurrency = null;
  if (headerCountry && /^[A-Z]{2}$/i.test(headerCountry)) {
    return {
      countryCode: headerCountry.toUpperCase(),
      countryName: '',
      currency: headerCurrency || currencyForCountry(headerCountry),
      source: 'ip-header',
    };
  }

  const ip = getClientIp(request);
  try {
    const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'ConnectLocal/1.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data: any = await response.json();
      const countryCode = String(data.country_code || data.country || '').toUpperCase();
      const currency = normalizeCurrency(data.currency) || currencyForCountry(countryCode);
      if (/^[A-Z]{2}$/.test(countryCode) && currency) {
        return {
          countryCode,
          countryName: String(data.country_name || ''),
          currency,
          source: 'ipapi',
        };
      }
    }
  } catch {
    // Fall through to the signed-in profile. IP geolocation is presentation
    // context, not an authentication or authorization mechanism.
  }

  const profileCountry = String(profile?.countryCode || '').toUpperCase();
  const profileCurrency = normalizeCurrency(profile?.currencyCode) || currencyForCountry(profileCountry) || 'USD';
  return {
    countryCode: profileCountry || 'US',
    countryName: '',
    currency: profileCurrency,
    source: 'profile-fallback',
  };
}

export function currencyForCountry(countryCode?: string) {
  const code = String(countryCode || '').toUpperCase();
  const map: Record<string, string> = {
    PK: 'PKR', US: 'USD', CA: 'CAD', GB: 'GBP', AE: 'AED', SA: 'SAR', IN: 'INR',
    DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
    AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', SG: 'SGD', MY: 'MYR', ID: 'IDR',
    TR: 'TRY', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', NG: 'NGN', BD: 'BDT', LK: 'LKR',
  };
  return map[code] || 'USD';
}

export async function getLiveUsdRates(): Promise<FxSnapshot> {
  const now = Date.now();
  if (fxCache && (!fxCache.nextUpdateAt || now < fxCache.nextUpdateAt)) return fxCache;

  const response = await fetch('https://open.er-api.com/v6/latest/USD', {
    headers: { Accept: 'application/json', 'User-Agent': 'ConnectLocal/1.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`FX provider returned HTTP ${response.status}.`);
  const data: any = await response.json();
  if (data?.result !== 'success' || !data?.rates) throw new Error('FX provider returned an invalid rate set.');

  fxCache = {
    rates: data.rates as Record<string, number>,
    fetchedAt: now,
    nextUpdateAt: Number(data.time_next_update_unix) > 0 ? Number(data.time_next_update_unix) * 1000 : now + 6 * 60 * 60 * 1000,
  };
  return fxCache;
}

export async function calculateGhostCoinLocalValueLive(coins: number, currency: string, coinPkrValue = 10) {
  const normalized = normalizeCurrency(currency) || 'USD';
  const snapshot = await getLiveUsdRates();
  const usdToPkr = Number(snapshot.rates.PKR);
  const usdToLocal = Number(snapshot.rates[normalized]);
  if (!(usdToPkr > 0) || !(usdToLocal > 0)) throw new Error(`No live FX rate is available for ${normalized}.`);

  const pkrValue = Math.max(0, Math.floor(coins)) * coinPkrValue;
  const usdValue = pkrValue / usdToPkr;
  const localValue = usdValue * usdToLocal;
  return {
    currency: normalized,
    pkrValue,
    usdValue: Math.round(usdValue * 10000) / 10000,
    localValue: Math.round(localValue * 100) / 100,
    usdToPkr,
    usdToLocal,
    rateFetchedAt: snapshot.fetchedAt,
    nextRateUpdateAt: snapshot.nextUpdateAt,
  };
}
