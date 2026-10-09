import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

function hasValidSetupKey(request: NextRequest) {
  const adminKey = process.env.ADMIN_SETUP_KEY;
  if (!adminKey) return false;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${adminKey}`);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export async function POST(request: NextRequest) {
  try {
    if (!hasValidSetupKey(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, setAdmin } = await request.json().catch(() => ({}));
    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const userRecord = await adminAuth.getUserByEmail(email);
    const isAdmin = setAdmin !== false;

    // set+merge so an admin can be created even if the profile document does not exist yet.
    await adminDb.collection('users').doc(userRecord.uid).set({ isAdmin, updatedAt: new Date().toISOString() }, { merge: true });
    await adminAuth.setCustomUserClaims(userRecord.uid, { ...(userRecord.customClaims || {}), isAdmin });

    return NextResponse.json({
      success: true,
      message: `User ${email} ${isAdmin ? 'set as admin' : 'removed as admin'}`,
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error('Error in admin setup:', error);
    if (error?.code === 'auth/user-not-found') return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (String(error?.message || '').includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({ error: 'Admin setup not available. Please set FIREBASE_SERVICE_ACCOUNT_KEY' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// GET endpoint to check admin status
export async function GET(request: NextRequest) {
  try {
    if (!hasValidSetupKey(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const email = new URL(request.url).searchParams.get('email');
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const userRecord = await getAdminAuth().getUserByEmail(email);
    const userDoc = await getAdminDb().collection('users').doc(userRecord.uid).get();
    return NextResponse.json({ email, uid: userRecord.uid, isAdmin: userDoc.data()?.isAdmin || false });
  } catch (error: any) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ error: 'User not found or error occurred' }, { status: 404 });
  }
}
