import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { classifyError } from '@/lib/server/firebase-admin';
import { PUBLIC_BUSINESS_ROLES, PUBLIC_PROFILE_FIELDS, toPublicBusiness } from '@/lib/server/public-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/public/businesses?roles=company,shopkeeper&limit=300
 * Public directory of business members with ONLY public fields. Cached at the CDN for a minute so directory and
 * search traffic does not turn into one Firestore read per document per visitor.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const requested = (params.get('roles') || '').split(',').map((r) => r.trim()).filter(Boolean);
    const roles = requested.length
      ? requested.filter((r) => (PUBLIC_BUSINESS_ROLES as readonly string[]).includes(r))
      : [...PUBLIC_BUSINESS_ROLES];
    if (!roles.length) return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
    const limit = Math.min(Math.max(Math.floor(Number(params.get('limit')) || 300), 1), 500);

    const snap = await getAdminDb()
      .collection('users')
      .where('role', 'in', roles)
      .select(...PUBLIC_PROFILE_FIELDS.filter((f) => f !== 'uid'), 'isAdmin', 'role')
      .limit(limit)
      .get();

    const businesses = snap.docs.map((d) => toPublicBusiness(d.id, d.data())).filter(Boolean);
    return NextResponse.json(
      { businesses },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error: any) {
    console.error('Public business directory failed:', error);
    const c = classifyError(error);
    return NextResponse.json({ error: c.message, code: c.code }, { status: c.status });
  }
}
