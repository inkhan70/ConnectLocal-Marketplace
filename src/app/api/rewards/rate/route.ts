import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { getGhostCoinUsdValue } from '@/lib/rewards-domain';
import { calculateGhostCoinLocalValueLive, detectIpCurrency } from '@/lib/server/currency-location';

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const snap = await db.collection('users').doc(decoded.uid).get();
    const profile: any = snap.data() || {};
    const location = await detectIpCurrency(request, profile);
    const coinUsdValue = getGhostCoinUsdValue();
    const unit = await calculateGhostCoinLocalValueLive(1, location.currency, coinUsdValue);

    return NextResponse.json({
      currency: location.currency,
      countryCode: location.countryCode,
      countryName: location.countryName,
      locationSource: location.source,
      ghostCoinUsdValue: coinUsdValue,
      usdValue: unit.usdValue,
      localCoinValue: unit.localValue,
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
