import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken, getAdminDb, HttpError } from '@/lib/server/firebase-admin';

const allowedProviders = new Set(['pexels', 'pixabay']);
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyBearerToken(request);
    const body = await request.json();
    const provider = String(body.provider || '');
    const sourceUrl = String(body.sourceUrl || '');
    const imageUrl = String(body.imageUrl || '');
    const previewUrl = String(body.previewUrl || '');
    if (!allowedProviders.has(provider) || !/^https:\/\//.test(sourceUrl) || !/^https:\/\//.test(imageUrl) || !/^https:\/\//.test(previewUrl)) return NextResponse.json({ error: 'Invalid image reference.' }, { status: 400 });
    const sourceHost = new URL(sourceUrl).hostname;
    const imageHost = new URL(imageUrl).hostname;
    const allowedHosts = provider === 'pexels' ? ['pexels.com', 'images.pexels.com'] : ['pixabay.com', 'cdn.pixabay.com'];
    if (![sourceHost, imageHost].every((host) => allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)))) return NextResponse.json({ error: 'Image source is not allowed.' }, { status: 400 });
    const ref = getAdminDb().collection('users').doc(user.uid).collection('savedImages').doc(`${provider}_${String(body.id).slice(0, 80)}`);
    await ref.set({ provider, externalId: String(body.id).slice(0, 80), imageUrl, previewUrl, sourceUrl, creatorName: String(body.creatorName || '').slice(0, 120), attribution: String(body.attribution || '').slice(0, 240), savedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ saved: true });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    return NextResponse.json({ error: error?.message || 'Could not save image.' }, { status });
  }
}
