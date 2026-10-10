import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, hasAdminClaim, HttpError, verifyBearerToken } from '@/lib/server/firebase-admin';
import { bootstrapProfile, sanitizeHints } from '@/lib/server/admin-bootstrap';

export const runtime = 'nodejs';

/**
 * Called by the client right after email sign-up, Google sign-in/sign-up and sign-in of a user whose profile
 * is missing. The caller's identity comes ONLY from the verified Firebase ID token; the request body can supply
 * harmless profile text (name, address, chosen role) but never admin/privilege fields.
 *
 * Errors carry a stable `code` (and the client shows a matching message) so a failure on Vercel can be diagnosed
 * from the UI instead of a generic "Please try again".
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const result = await bootstrapProfile(
      getAdminDb(),
      getAdminAuth(),
      {
        uid: decoded.uid,
        email: decoded.email || null,
        emailVerified: decoded.email_verified === true,
        displayName: (decoded as any).name || null,
        claimIsAdmin: hasAdminClaim(decoded as any),
      },
      sanitizeHints(body?.profile),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Profile bootstrap failed:', error?.code, error?.message, error);
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Unable to initialise profile.', code: String(error?.code || 'server_error') },
      { status: 500 },
    );
  }
}
