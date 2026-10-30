import { NextRequest, NextResponse } from 'next/server';
import { getCapabilitiesForCountry, getCountrySuggestion } from '@/lib/server/provider-capabilities';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('country');
  const country = /^[A-Z]{2}$/.test(requested || '') ? requested! : getCountrySuggestion(request.headers);
  return NextResponse.json({ country, source: requested ? 'business_selection' : 'ip_suggestion', providers: getCapabilitiesForCountry(country) });
}
