import { NextResponse } from 'next/server';
import { getEnabledPaymentMethods } from '@/lib/server/payment-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/payments/methods - the payment options this deployment can really process (no secrets). */
export async function GET() {
  return NextResponse.json(
    { methods: getEnabledPaymentMethods() },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
