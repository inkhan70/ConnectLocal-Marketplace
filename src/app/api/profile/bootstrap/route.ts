import { NextRequest, NextResponse } from 'next/server';
import { describeServerError, getAdminAuth, getAdminDb, hasAdminClaim, verifyBearerToken } from '@/lib/server/firebase-admin';
import { bootstrapProfile, sanitizeHints } from '@/lib/server/admin-bootstrap';
import { readRealtimeCategories } from '@/lib/server/category-rtdb';
import { resolveChosenType } from '@/lib/category-live';
import { findSubcategory } from '@/lib/subcategories';

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
    const hints = sanitizeHints(body?.profile);
    // Read the live list BEFORE the Firestore transaction (the transaction must not do slow external reads).
    let liveList: Awaited<ReturnType<typeof readRealtimeCategories>> = [];
    if (hints.subcategoryId) {
      try { liveList = await readRealtimeCategories(); } catch (e) { console.error('Live categories unavailable for bootstrap:', e); }
    }
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
      hints,
      (id, role) => resolveChosenType(liveList, id, role) || findSubcategory(id),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('Profile bootstrap failed:', error?.code, error?.message, error);
    const { status, code, message } = describeServerError(error);
    return NextResponse.json({ error: message === 'Unable to complete the request.' ? 'Unable to initialise profile.' : message, code }, { status });
  }
}
