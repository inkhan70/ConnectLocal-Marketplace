import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';
import { getGhostCoinPkrValue } from '@/lib/rewards-domain';
import { detectIpCurrency, getLiveUsdRates } from '@/lib/server/currency-location';

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const ref = db.collection('users').doc(decoded.uid);
    const profileSnap = await ref.get();
    if (!profileSnap.exists) throw new Error('Profile not found.');
    const profile: any = profileSnap.data() || {};
    const location = await detectIpCurrency(request, profile);
    const rates = await getLiveUsdRates();
    const coinPkrValue = getGhostCoinPkrValue();

    // Currency is derived server-side from IP (with profile fallback), never
    // from a browser-supplied currency value.
    const usdToPkr = Number(rates.rates.PKR);
    const usdToLocal = Number(rates.rates[location.currency]);
    if (!(usdToPkr > 0) || !(usdToLocal > 0)) throw new Error(`No live FX rate is available for ${location.currency}.`);

    const result = await db.runTransaction(async transaction => {
      const freshSnap = await transaction.get(ref);
      if (!freshSnap.exists) throw new Error('Profile not found.');
      const fresh: any = freshSnap.data() || {};
      const coins = Math.max(0, Math.floor(Number(fresh.ghostCoins || 0)));
      if (coins <= 0) throw new Error('You have no Ghost Coins to convert.');

      const pkrValue = coins * coinPkrValue;
      const usdValue = pkrValue / usdToPkr;
      const localValue = Math.round(usdValue * usdToLocal * 100) / 100;
      if (!Number.isFinite(localValue) || localValue < 0) throw new Error('The currency conversion result is invalid.');

      transaction.update(ref, {
        ghostCoins: 0,
        balance: Number(fresh.balance || 0) + localValue,
        balanceCurrency: location.currency,
        lastGhostCoinConversion: {
          coins, pkrValue, usdValue: Math.round(usdValue * 10000) / 10000, localValue,
          currency: location.currency, countryCode: location.countryCode,
          locationSource: location.source, usdToPkr, usdToLocal,
          rateFetchedAt: rates.fetchedAt, nextRateUpdateAt: rates.nextUpdateAt,
          at: new Date().toISOString(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { coins, pkrValue, usdValue: Math.round(usdValue * 10000) / 10000, localValue, currency: location.currency, usdToPkr, usdToLocal, rateFetchedAt: rates.fetchedAt, nextRateUpdateAt: rates.nextUpdateAt };
    });

    return NextResponse.json({ success: true, ...result, countryCode: location.countryCode, countryName: location.countryName, locationSource: location.source });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Conversion failed.' }, { status: authErrorStatus(error) === 401 ? 401 : 400 });
  }
}
