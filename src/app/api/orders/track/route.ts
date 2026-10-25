import { NextRequest, NextResponse } from 'next/server';
import { classifyError, getAdminDb } from '@/lib/server/firebase-admin';
import { readVerificationCode, requireOrderBuyer } from '@/lib/server/order-secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANDOVER_STATUSES = ['paid', 'processing', 'ready_for_pickup', 'out_for_delivery'];

function iso(value: any) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value ?? null;
}

/**
 * GET /api/orders/track?orderId=...   (header `x-guest-key` for guests, or a Bearer token for the signed-in buyer)
 * A sanitised view of one order for its buyer, including the verification code while a handover is still pending.
 */
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId') || '';
    const db = getAdminDb();
    const access = await requireOrderBuyer(db, request, orderId, request.headers.get('x-guest-key'));
    const o = access.order;

    let sellerName = 'Seller';
    try {
      const seller = await db.collection('users').doc(String(o.businessId)).get();
      sellerName = String(seller.data()?.businessName || seller.data()?.fullName || 'Seller');
    } catch { /* name is cosmetic */ }

    const showCode = HANDOVER_STATUSES.includes(String(o.status)) && o.verificationRequired !== false;
    return NextResponse.json({
      order: {
        id: access.id,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        deliveryMethod: o.deliveryMethod,
        deliveryAddress: o.deliveryAddress || null,
        items: (o.items || []).map((i: any) => ({ name: i.name || i.productName || i.varietyName, varietyName: i.varietyName, quantity: i.quantity, price: i.price ?? i.unitPrice })),
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        totalCost: o.totalCost,
        currency: o.currency,
        createdAt: iso(o.createdAt),
        sellerName,
        isGuestOrder: !!o.isGuestOrder,
      },
      verificationCode: showCode ? await readVerificationCode(db, access.id, o) : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const c = classifyError(error);
    return NextResponse.json({ error: c.message, code: c.code }, { status: c.status });
  }
}
