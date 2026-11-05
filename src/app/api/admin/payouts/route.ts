import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authErrorStatus, getAdminDb, requireAdmin, safeMessage } from '@/lib/server/firebase-admin';
import { loadOrderStatuses, toLedgerRow } from '@/lib/server/payout-data';
import { maskAccount, selectPayable, sellerNetMinor, summarizeEarnings, type LedgerRow } from '@/lib/settlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS_PER_PAYOUT = 400; // one Firestore transaction

/** GET /api/admin/payouts - members with money to pay out (full payout details are visible to admins only), plus history. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const db = getAdminDb();
    const open = await db.collection('paymentTransactions').where('status', '==', 'succeeded').limit(2000).get();
    const rows = open.docs.map(toLedgerRow).filter((r) => r.sellerId && r.settlementStatus !== 'paid_out');
    const statuses = await loadOrderStatuses(db, rows.map((r) => r.orderId));

    const bySeller = new Map<string, LedgerRow[]>();
    for (const row of rows) bySeller.set(row.sellerId as string, [...(bySeller.get(row.sellerId as string) || []), row]);

    const sellers = [];
    for (const [sellerId, sellerRows] of bySeller) {
      const totals = summarizeEarnings(sellerRows, statuses);
      if (!totals.some((t) => t.availableMinor > 0 || t.heldMinor > 0)) continue;
      const [user, account] = await Promise.all([db.collection('users').doc(sellerId).get(), db.collection('payoutAccounts').doc(sellerId).get()]);
      const u: any = user.data() || {}; const a: any = account.exists ? account.data() : null;
      sellers.push({ sellerId, name: u.businessName || u.fullName || sellerId, totals, account: a ? { method: a.method, accountTitle: a.accountTitle, bankName: a.bankName || '', accountNumber: a.accountNumber } : null });
    }
    sellers.sort((x, y) => (y.totals[0]?.availableMinor || 0) - (x.totals[0]?.availableMinor || 0));

    const hist = await db.collection('payouts').orderBy('paidAt', 'desc').limit(50).get();
    const payouts = hist.docs.map((d) => { const p: any = d.data(); return { id: d.id, sellerId: p.sellerId, sellerName: p.sellerName, amountMinor: p.amountMinor, currency: p.currency, reference: p.reference, method: p.method, accountMasked: p.accountMasked, orderCount: p.orderCount, paidAt: p.paidAt?.toDate ? p.paidAt.toDate().toISOString() : null }; });

    // Refunds that arrived after the seller was already paid need a manual recovery.
    const clawbacks = (await db.collection('paymentTransactions').where('refundedAfterPayout', '==', true).limit(50).get())
      .docs.map((d) => { const t: any = d.data(); return { orderId: t.orderId, sellerId: t.sellerId, amountMinor: sellerNetMinor(toLedgerRow(d)), currency: t.currency }; });

    return NextResponse.json({ sellers, payouts, clawbacks });
  } catch (error) {
    return NextResponse.json({ error: safeMessage(error, 'Unable to load payouts.') }, { status: authErrorStatus(error) });
  }
}

/**
 * POST /api/admin/payouts { sellerId, currency, reference }
 * Records that the admin has transferred the seller's AVAILABLE balance (outside the app: bank / JazzCash / Easypaisa /
 * Raast) and closes those ledger rows so they can never be paid twice. Runs in one transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const sellerId = String(body.sellerId || '');
    const currency = String(body.currency || '').toUpperCase();
    const reference = String(body.reference || '').trim().slice(0, 120);
    if (!sellerId || !/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'sellerId and currency are required.' }, { status: 400 });
    if (reference.length < 3) return NextResponse.json({ error: 'Enter the bank / wallet transfer reference so the payout can be reconciled.' }, { status: 400 });

    const db = getAdminDb();
    const [accountSnap, userSnap] = await Promise.all([db.collection('payoutAccounts').doc(sellerId).get(), db.collection('users').doc(sellerId).get()]);
    if (!accountSnap.exists) return NextResponse.json({ error: 'This member has not added payout details yet.' }, { status: 409 });
    const account: any = accountSnap.data();

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection('paymentTransactions').where('sellerId', '==', sellerId).limit(500));
      const rows = snap.docs.map(toLedgerRow);
      const orderRefs = [...new Set(rows.map((r) => r.orderId).filter(Boolean))].map((id) => db.collection('orders').doc(id));
      const orderSnaps = orderRefs.length ? await tx.getAll(...orderRefs) : [];
      const statuses: Record<string, string | undefined> = {};
      for (const o of orderSnaps) if (o.exists) statuses[o.id] = (o.data() as any)?.status;

      const payable = selectPayable(rows, statuses, currency).slice(0, MAX_ROWS_PER_PAYOUT);
      if (!payable.length) throw Object.assign(new Error('Nothing is available to pay out for this member.'), { status: 409 });
      const amountMinor = payable.reduce((sum, r) => sum + sellerNetMinor(r), 0);

      const payoutRef = db.collection('payouts').doc();
      tx.create(payoutRef, {
        sellerId, sellerName: (userSnap.data() as any)?.businessName || (userSnap.data() as any)?.fullName || '', currency, amountMinor, reference,
        method: account.method, accountTitle: account.accountTitle, accountMasked: maskAccount(account.accountNumber),
        orderIds: payable.map((r) => r.orderId), transactionIds: payable.map((r) => r.id), orderCount: payable.length,
        paidBy: admin.uid, paidAt: FieldValue.serverTimestamp(),
      });
      for (const row of payable) tx.update(db.collection('paymentTransactions').doc(row.id), { settlementStatus: 'paid_out', payoutId: payoutRef.id, paidOutAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return { payoutId: payoutRef.id, amountMinor, orderCount: payable.length };
    });

    return NextResponse.json({ success: true, ...result, currency });
  } catch (error: any) {
    if (error?.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: safeMessage(error, 'Unable to record the payout.') }, { status: authErrorStatus(error) });
  }
}
