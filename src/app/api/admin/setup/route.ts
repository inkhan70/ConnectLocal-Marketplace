import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
let adminApp: any;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
} catch (error) {
  console.log('Firebase Admin not initialized - using client SDK fallback');
}

export async function POST(request: NextRequest) {
  try {
    const { email, setAdmin } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Security: Check if this is the first admin setup (no admins exist yet)
    // or if the request is authenticated as an admin
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_SETUP_KEY;

    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (adminApp) {
      try {
        // Use Firebase Admin SDK
        const adminAuth = getAuth(adminApp);
        const adminDb = getAdminFirestore(adminApp);

        // Get user by email
        const userRecord = await adminAuth.getUserByEmail(email);
        
        // Update user in Firestore
        const userRef = adminDb.collection('users').doc(userRecord.uid);
        await userRef.update({
          isAdmin: setAdmin !== false,
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          message: `User ${email} ${setAdmin !== false ? 'set as admin' : 'removed as admin'}`,
          uid: userRecord.uid,
        });
      } catch (error) {
        console.error('Firebase Admin error:', error);
        return NextResponse.json(
          { error: 'Failed to update user' },
          { status: 500 }
        );
      }
    } else {
      // Fallback: Return error if Admin SDK is not available
      return NextResponse.json(
        { error: 'Admin setup not available. Please set FIREBASE_SERVICE_ACCOUNT_KEY' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Error in admin setup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check admin status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (adminApp) {
      const adminAuth = getAuth(adminApp);
      const adminDb = getAdminFirestore(adminApp);

      const userRecord = await adminAuth.getUserByEmail(email);
      const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();

      return NextResponse.json({
        email,
        uid: userRecord.uid,
        isAdmin: userDoc.data()?.isAdmin || false,
      });
    } else {
      return NextResponse.json(
        { error: 'Admin setup not available' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { error: 'User not found or error occurred' },
      { status: 404 }
    );
  }
}
