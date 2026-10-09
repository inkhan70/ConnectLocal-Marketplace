import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminAuth, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { bootstrapProfile, sanitizeHints } from '@/lib/server/admin-bootstrap';

export const runtime = 'nodejs';

/**
 * Called by the client right after email sign-up, Google sign-in/sign-up and sign-in of a user whose profile
 * is missing. The caller's identity comes ONLY from the verified Firebase ID token; the request body can supply
 * harmless profile text (name, address, chosen role) but never admin/privilege fields.
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
        isAdminClaim: (decoded as any).isAdmin === true,
      },
      sanitizeHints(body?.profile),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Profile bootstrap failed:', error);
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : 'Unable to initialise profile.' }, { status });
  }
}
