import { NextRequest, NextResponse } from 'next/server';
import { classifyError, getAdminDb } from '@/lib/server/firebase-admin';
import { readVerificationCode, requireOrderBuyer } from '@/lib/server/order-secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/{orderId}/verification
 * Returns the handover verification code to the BUYER only (Bearer token) or to a guest presenting the guest key
 * (header `x-guest-key`). Sellers and administrators are deliberately refused: the seller must be told the code in
 * person, which is what proves the goods reached the right person.
 */
export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const db = getAdminDb();
    const access = await requireOrderBuyer(db, request, params.orderId, request.headers.get('x-guest-key'));
    const code = await readVerificationCode(db, access.id, access.order);
    return NextResponse.json({ code, status: access.order.status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const c = classifyError(error);
    return NextResponse.json({ error: c.message, code: c.code }, { status: c.status });
  }
}
