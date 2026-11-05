import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyBearerToken, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';
import { getCapabilitiesForCountry, getCountrySuggestion } from '@/lib/server/provider-capabilities';
import { getEnabledPaymentMethods, getProviderReadiness, sellerPaymentProfile } from '@/lib/server/payment-config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const profile = await db.collection('users').doc(decoded.uid).get();
    const data = profile.data() || {};
    // What customers are offered is decided from the CONFIRMED business country/currency saved on this page.
    const paymentProfile = sellerPaymentProfile(data);
    const suggestedCountry = getCountrySuggestion(request.headers);
    const suggestion = { country: suggestedCountry, currency: suggestedCountry === 'PK' ? 'PKR' : 'USD' };
    const country = paymentProfile.confirmed ? paymentProfile.country : suggestion.country;
    const currency = paymentProfile.confirmed ? paymentProfile.currency : suggestion.currency;
    const accounts = await db.collection('providerAccounts').where('ownerId', '==', decoded.uid).get();

    // What your customers can pay with right now, and in plain words why an online option is missing.
    const customerMethods = [];
    for (const method of [{ value: 'cod', label: 'Cash on Delivery' }, ...getEnabledPaymentMethods().filter((m) => m.value !== 'cod')]) {
      const readiness = await getProviderReadiness(db, method.value, paymentProfile.country, paymentProfile.currency);
      const failing = readiness.checks.find((check) => !check.ok);
      customerMethods.push({
        value: method.value, label: method.label, available: readiness.available,
        reason: readiness.available ? null : failing?.key === 'region' ? `Not available for ${paymentProfile.country} / ${paymentProfile.currency}. ${failing.detail || ''}`.trim() : 'Not activated by the platform yet.',
      });
    }
    return NextResponse.json({
      country, currency, confirmed: paymentProfile.confirmed, suggestion,
      providers: getCapabilitiesForCountry(country), accounts: accounts.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      effective: { country: paymentProfile.country, currency: paymentProfile.currency }, customerMethods,
    });
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
