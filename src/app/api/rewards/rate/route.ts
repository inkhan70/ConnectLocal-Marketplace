import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { getGhostCoinPkrValue } from '@/lib/rewards-domain';
import { calculateGhostCoinLocalValueLive, detectIpCurrency } from '@/lib/server/currency-location';

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const snap = await db.collection('users').doc(decoded.uid).get();
    const profile: any = snap.data() || {};
    const location = await detectIpCurrency(request, profile);
    const unit = await calculateGhostCoinLocalValueLive(1, location.currency, getGhostCoinPkrValue());

    return NextResponse.json({
      currency: location.currency,
      countryCode: location.countryCode,
      countryName: location.countryName,
      locationSource: location.source,
      ghostCoinPkrValue: getGhostCoinPkrValue(),
      pkrValue: unit.pkrValue,
      usdValue: unit.usdValue,
      localCoinValue: unit.localValue,
      usdToPkr: unit.usdToPkr,
      usdToLocal: unit.usdToLocal,
      rateFetchedAt: unit.rateFetchedAt,
      nextRateUpdateAt: unit.nextRateUpdateAt,
      configured: true,
      fxSource: 'ExchangeRate-API Open Access',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load reward rate.' }, { status: authErrorStatus(error) === 401 ? 401 : 502 });
  }
}
