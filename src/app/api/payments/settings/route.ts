import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyBearerToken, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';
import { getCapabilitiesForCountry } from '@/lib/server/provider-capabilities';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const profile = await db.collection('users').doc(decoded.uid).get();
    const data = profile.data() || {};
    const country = String(data.businessCountry || data.country || 'US').toUpperCase();
    const accounts = await db.collection('providerAccounts').where('ownerId', '==', decoded.uid).get();
    return NextResponse.json({ country, currency: data.businessCurrency || 'USD', providers: getCapabilitiesForCountry(country), accounts: accounts.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to load payment settings.') }, { status: authErrorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json();
    const country = String(body.country || '').toUpperCase();
    const currency = String(body.currency || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'Use a valid country and currency.' }, { status: 422 });
    const allowed = getCapabilitiesForCountry(country).some((provider) => provider.currencies.includes('*') || provider.currencies.includes(currency));
    if (!allowed) return NextResponse.json({ error: 'That currency is not supported by an available provider for this country.' }, { status: 422 });
    await getAdminDb().collection('users').doc(decoded.uid).set({ businessCountry: country, businessCurrency: currency, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true, country, currency });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to save payment settings.') }, { status: authErrorStatus(error) });
  }
}
