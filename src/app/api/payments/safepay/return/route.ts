import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/server/app-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{6,128}$/;

/**
 * Safepay sends the customer back here after paying - by GET or by an HTML form POST. A page route cannot receive a
 * POST, so this endpoint turns either into a plain redirect to the order screen. It changes NOTHING about the order:
 * the signed webhook alone confirms the payment, and the order screen refreshes itself until it does.
 */
function handle(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const orderId = params.get('orderId') || '';
  const key = params.get('k') || '';
  const base = getAppUrl(request);
  if (!ID.test(orderId)) return NextResponse.redirect(new URL('/dashboard/orders', base), 303);
  const dest = key && ID.test(key)
    ? `/track-order?orderId=${encodeURIComponent(orderId)}&k=${encodeURIComponent(key)}&payment=processing`
    : `/dashboard/orders?orderId=${encodeURIComponent(orderId)}&payment=processing`;
  return NextResponse.redirect(new URL(dest, base), 303);
}

export { handle as GET, handle as POST };
