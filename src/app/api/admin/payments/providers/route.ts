import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireAdmin, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';
import { DEFAULT_PROVIDER_CAPABILITIES } from '@/lib/server/provider-capabilities';

export const runtime = 'nodejs';

type StoredProviderConfig = { id: string; country: string; providerId: string; [key: string]: unknown };

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const snap = await getAdminDb().collection('paymentProviderConfigs').get();
    const configurations: StoredProviderConfig[] = snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return { id: doc.id, country: String(data.country || 'GLOBAL'), providerId: String(data.providerId || ''), ...data };
    });
    const overrides = new Map(configurations.filter((config) => config.country === 'GLOBAL').map((config) => [String(config.providerId), config]));
    return NextResponse.json({ providers: DEFAULT_PROVIDER_CAPABILITIES.map((provider) => ({ ...provider, ...(overrides.get(provider.id) || {}) })), configurations });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to load provider settings.') }, { status: authErrorStatus(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    const providerId = String(body.providerId || '');
    const allowed = DEFAULT_PROVIDER_CAPABILITIES.some((provider) => provider.id === providerId);
    if (!allowed) return NextResponse.json({ error: 'Unsupported provider.' }, { status: 422 });
    const country = String(body.country || "GLOBAL").toUpperCase();
    if (country !== "GLOBAL" && !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: 'Use a valid ISO country code.' }, { status: 422 });
    const patch = { providerId, country, enabled: Boolean(body.enabled), currencies: Array.isArray(body.currencies) ? body.currencies.filter((value: unknown) => /^[A-Z]{3}$/.test(String(value))) : [], updatedAt: new Date().toISOString(), updatedBy: admin.uid };
    await getAdminDb().collection('paymentProviderConfigs').doc(`${providerId}_${country}`).set(patch, { merge: true });
    return NextResponse.json({ success: true, ...patch });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to save provider settings.') }, { status: authErrorStatus(error) });
  }
}
