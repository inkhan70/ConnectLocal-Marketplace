import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { DEFAULT_PROVIDER_CAPABILITIES, getCountrySuggestion } from '@/lib/server/provider-capabilities';
import { getEnabledPaymentMethods, isPaymentMethodAvailable } from '@/lib/server/payment-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/payments/methods - the payment options this deployment can really process (no secrets). */
export async function GET(request: NextRequest) {
  let country = /^[A-Z]{2}$/.test(request.nextUrl.searchParams.get('country') || '') ? request.nextUrl.searchParams.get('country')! : getCountrySuggestion(request.headers);
  let currency = (request.nextUrl.searchParams.get('currency') || (country === 'PK' ? 'PKR' : 'USD')).toUpperCase();
  const sellerId = request.nextUrl.searchParams.get('sellerId');
  const configuredMethods = getEnabledPaymentMethods();
  try {
    const db = getAdminDb();
    if (sellerId) {
      const seller = await db.collection('users').doc(sellerId).get();
      const sellerData = seller.data() as any;
      if (sellerData?.countryCode) country = String(sellerData.countryCode).toUpperCase();
      if (sellerData?.currencyCode) currency = String(sellerData.currencyCode).toUpperCase();
    }
    const methods = [];
    for (const method of configuredMethods) {
      if (await isPaymentMethodAvailable(db, method.value, country, currency)) methods.push(method);
    }
    return NextResponse.json({ methods, country, currency }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch {
    // The buyer UI can still show credential-backed choices during local preview; the order API remains authoritative.
    const methods = configuredMethods.filter((method) => {
      const capability = DEFAULT_PROVIDER_CAPABILITIES.find((provider) => provider.id === method.value);
      return capability && (capability.countries.includes('*') || capability.countries.includes(country)) && (capability.currencies.includes('*') || capability.currencies.includes(currency));
    });
    return NextResponse.json({ methods, country, currency, configurationPending: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
