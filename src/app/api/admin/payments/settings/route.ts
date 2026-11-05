import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, requireAdmin, safeMessage } from '@/lib/server/firebase-admin';
import { clampPercent, getPlatformFeeConfig } from '@/lib/server/payment-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await getPlatformFeeConfig(getAdminDb()));
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to load payment settings.') }, { status: authErrorStatus(error) });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const commissionPercent = clampPercent(body.commissionPercent, NaN);
    const serviceChargePercent = clampPercent(body.serviceChargePercent, NaN);
    if (!Number.isFinite(commissionPercent) || !Number.isFinite(serviceChargePercent)) {
      return NextResponse.json({ error: 'Commission and service charge must be numbers from 0 to 50.' }, { status: 422 });
    }

    const db = getAdminDb();
    await db.collection('appSettings').doc('payments').set({
      commissionPercent,
      serviceChargePercent,
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ commissionPercent, serviceChargePercent });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to save payment settings.') }, { status: authErrorStatus(error) });
  }
}
