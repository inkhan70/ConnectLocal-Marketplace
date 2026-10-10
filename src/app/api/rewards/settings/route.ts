import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, verifyBearerToken } from '@/lib/server/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const ref = db.collection('users').doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    const profile: any = snap.data();
    if (profile.isAdmin !== true && !['company','wholesaler','distributor','shopkeeper','services'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only seller accounts can configure Ghost Coin offers.' }, { status: 403 });
    }
    const body = await request.json();
    const reward = Math.floor(Number(body.ghostCoinRewardPerSale ?? 0));
    const minimumQuantity = Math.floor(Number(body.ghostCoinMinimumQuantity ?? 1));
    const enabled = body.ghostCoinOfferEnabled === true;
    if (!Number.isFinite(reward) || reward < 0 || reward > 1000000) return NextResponse.json({ error: 'Reward must be between 0 and 1,000,000 coins.' }, { status: 400 });
    if (!Number.isFinite(minimumQuantity) || minimumQuantity < 1 || minimumQuantity > 1000000000) return NextResponse.json({ error: 'Minimum quantity is invalid.' }, { status: 400 });
    if (enabled && reward === 0) return NextResponse.json({ error: 'Enable the offer only when the reward is greater than zero.' }, { status: 400 });
    await ref.update({ ghostCoinRewardPerSale: reward, ghostCoinMinimumQuantity: minimumQuantity, ghostCoinOfferEnabled: enabled });
    return NextResponse.json({ success: true, ghostCoinRewardPerSale: reward, ghostCoinMinimumQuantity: minimumQuantity, ghostCoinOfferEnabled: enabled });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not save reward offer.' }, { status: authErrorStatus(error) });
  }
}
