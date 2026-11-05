import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { getCountrySuggestion } from '@/lib/server/provider-capabilities';
import { getEnabledPaymentMethods, isPaymentMethodAvailable } from '@/lib/server/payment-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/payments/methods - the payment options this deployment can really process (no secrets). */
export async function GET(request: NextRequest) {
  const country = /^[A-Z]{2}$/.test(request.nextUrl.searchParams.get('country') || '') ? request.nextUrl.searchParams.get('country')! : getCountrySuggestion(request.headers);
  const currency = (request.nextUrl.searchParams.get('currency') || (country === 'PK' ? 'PKR' : 'USD')).toUpperCase();
  const db = getAdminDb();
  const methods = [];
  for (const method of getEnabledPaymentMethods()) {
    if (await isPaymentMethodAvailable(db, method.value, country, currency)) methods.push(method);
  }
  return NextResponse.json({ methods, country, currency }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
