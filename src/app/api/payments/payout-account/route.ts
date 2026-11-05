import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, safeMessage, verifyBearerToken } from '@/lib/server/firebase-admin';
import { maskAccount, validatePayoutAccount } from '@/lib/settlement';

export const runtime = 'nodejs';

/**
 * PUT /api/payments/payout-account - where the member wants to be paid.
 * Stored server-side only (`payoutAccounts/{uid}`, no client access) and never returned in full to the member; only
 * administrators who make the transfer can read it.
 */
export async function PUT(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const checked = validatePayoutAccount(await request.json().catch(() => ({})));
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 });
    await getAdminDb().collection('payoutAccounts').doc(decoded.uid).set({ ...checked.value, ownerId: decoded.uid, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, account: { method: checked.value.method, accountTitle: checked.value.accountTitle, bankName: checked.value.bankName, maskedNumber: maskAccount(checked.value.accountNumber) } });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to save payout details.') }, { status: authErrorStatus(error) });
  }
}
