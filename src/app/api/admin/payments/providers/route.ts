import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireAdmin, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';
import { DEFAULT_PROVIDER_CAPABILITIES } from '@/lib/server/provider-capabilities';
import { getProviderReadiness } from '@/lib/server/payment-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredProviderConfig = { id: string; country: string; providerId: string; [key: string]: unknown };

/**
 * GET ?country=PK&currency=PKR
 * Besides the saved configuration, returns for each provider whether buyers in that country/currency are offered it and,
 * if not, exactly which requirement is missing (the same check the buyer's checkout and the order API use).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = getAdminDb();
    const country = /^[A-Za-z]{2}$/.test(request.nextUrl.searchParams.get('country') || '') ? request.nextUrl.searchParams.get('country')!.toUpperCase() : 'PK';
    const currency = /^[A-Za-z]{3}$/.test(request.nextUrl.searchParams.get('currency') || '') ? request.nextUrl.searchParams.get('currency')!.toUpperCase() : (country === 'PK' ? 'PKR' : 'USD');
    const snap = await db.collection('paymentProviderConfigs').get();
    const configurations: StoredProviderConfig[] = snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return { id: doc.id, country: String(data.country || 'GLOBAL'), providerId: String(data.providerId || ''), ...data };
    });
    const overrides = new Map(configurations.filter((config) => config.country === 'GLOBAL').map((config) => [String(config.providerId), config]));
    const providers = await Promise.all(DEFAULT_PROVIDER_CAPABILITIES.map(async (provider) => ({
      ...provider,
      ...(overrides.get(provider.id) || {}),
      readiness: await getProviderReadiness(db, provider.id, country, currency),
    })));
    return NextResponse.json({ providers, configurations, checked: { country, currency } });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to load provider settings.') }, { status: authErrorStatus(error) });
  }
}

/**
 * POST { providerId, country, enabled?, merchantApproved?, currencies? }
 * Only the fields that are sent are changed, so adding or editing a country configuration can never silently clear an
 * approval that was already given. A brand-new configuration starts unapproved.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const providerId = String(body.providerId || '');
    if (!DEFAULT_PROVIDER_CAPABILITIES.some((provider) => provider.id === providerId)) return NextResponse.json({ error: 'Unsupported provider.' }, { status: 422 });
    const country = String(body.country || 'GLOBAL').toUpperCase();
    if (country !== 'GLOBAL' && !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: 'Use a valid ISO country code.' }, { status: 422 });

    const ref = getAdminDb().collection('paymentProviderConfigs').doc(`${providerId}_${country}`);
    const existing = await ref.get();
    const patch: Record<string, unknown> = { providerId, country, updatedAt: new Date().toISOString(), updatedBy: admin.uid };
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    else if (!existing.exists) patch.enabled = true;
    if (typeof body.merchantApproved === 'boolean') patch.merchantApproved = body.merchantApproved;
    else if (!existing.exists) patch.merchantApproved = false;
    if (Array.isArray(body.currencies)) patch.currencies = body.currencies.map((value: unknown) => String(value).trim().toUpperCase()).filter((value: string) => /^[A-Z]{3}$/.test(value));
    else if (!existing.exists) patch.currencies = [];
    await ref.set(patch, { merge: true });
    return NextResponse.json({ success: true, ...patch });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to save provider settings.') }, { status: authErrorStatus(error) });
  }
}
