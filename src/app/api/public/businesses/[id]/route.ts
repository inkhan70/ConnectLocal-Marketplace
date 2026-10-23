import { NextRequest, NextResponse } from 'next/server';
import { classifyError, getAdminDb } from '@/lib/server/firebase-admin';
import { toPublicBusiness } from '@/lib/server/public-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/public/businesses/{uid} - the public view of one business, or 404 when it is not a public business. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = String(params.id || '');
    if (!id || id.includes('/') || id.length > 128) return NextResponse.json({ error: 'Invalid business id.' }, { status: 400 });
    const snap = await getAdminDb().collection('users').doc(id).get();
    const business = snap.exists ? toPublicBusiness(snap.id, snap.data()) : null;
    if (!business) return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    return NextResponse.json(
      { business },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
    );
  } catch (error: any) {
    console.error('Public business lookup failed:', error);
    const c = classifyError(error);
    return NextResponse.json({ error: c.message, code: c.code }, { status: c.status });
  }
}
