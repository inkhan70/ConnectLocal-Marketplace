import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, requireAdmin, authErrorStatus, safeMessage } from '@/lib/server/firebase-admin';
import { DEFAULT_PROVIDER_CAPABILITIES } from '@/lib/server/provider-capabilities';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const snap = await getAdminDb().collection('paymentProviderConfigs').get();
    const overrides = new Map(snap.docs.map((doc) => [doc.id, doc.data()]));
    return NextResponse.json({ providers: DEFAULT_PROVIDER_CAPABILITIES.map((provider) => ({ ...provider, ...(overrides.get(provider.id) || {}) })) });
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
    const patch = { enabled: Boolean(body.enabled), currencies: Array.isArray(body.currencies) ? body.currencies.filter((value: unknown) => /^[A-Z]{3}$/.test(String(value))) : [], updatedAt: new Date().toISOString(), updatedBy: admin.uid };
    await getAdminDb().collection('paymentProviderConfigs').doc(providerId).set(patch, { merge: true });
    return NextResponse.json({ success: true, providerId, ...patch });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to save provider settings.') }, { status: authErrorStatus(error) });
  }
}
