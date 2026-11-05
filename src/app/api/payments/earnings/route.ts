import { NextRequest, NextResponse } from 'next/server';
import { authErrorStatus, getAdminDb, safeMessage, verifyBearerToken } from '@/lib/server/firebase-admin';
import { getPlatformFeeConfig } from '@/lib/server/payment-config';
import { loadOrderStatuses, toLedgerRow } from '@/lib/server/payout-data';
import { maskAccount, summarizeEarnings } from '@/lib/settlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/payments/earnings - the signed-in member's own online earnings, payouts and (masked) payout account. */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request);
    const db = getAdminDb();
    const ledger = await db.collection('paymentTransactions').where('sellerId', '==', decoded.uid).limit(500).get();
    const rows = ledger.docs.map(toLedgerRow);
    const statuses = await loadOrderStatuses(db, rows.map((r) => r.orderId));
    const totals = summarizeEarnings(rows, statuses);

    const payoutSnap = await db.collection('payouts').where('sellerId', '==', decoded.uid).limit(100).get();
    const payouts = payoutSnap.docs
      .map((d) => { const p: any = d.data(); return { id: d.id, amountMinor: p.amountMinor, currency: p.currency, reference: p.reference, method: p.method, orderCount: p.orderCount, paidAt: p.paidAt?.toDate ? p.paidAt.toDate().toISOString() : null }; })
      .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));

    const accountSnap = await db.collection('payoutAccounts').doc(decoded.uid).get();
    const a: any = accountSnap.exists ? accountSnap.data() : null;
    const account = a ? { method: a.method, accountTitle: a.accountTitle, bankName: a.bankName || '', maskedNumber: maskAccount(a.accountNumber) } : null;

    const feeConfig = await getPlatformFeeConfig(db);
    return NextResponse.json({ totals, payouts, account, feePercent: feeConfig.commissionPercent, serviceChargePercent: feeConfig.serviceChargePercent, truncated: ledger.size >= 500 });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to load earnings.') }, { status: authErrorStatus(error) });
  }
}
