/**
 * Member earnings & payouts (pure logic, no Firebase).
 *
 * Money model: the platform collects the online payment (Safepay / Stripe / PayPal), the order is fulfilled, and the
 * seller is then paid out (bank / JazzCash / Easypaisa / Raast) by the admin. Every online payment has one
 * `paymentTransactions` ledger row:  gross = platform fee + seller amount.
 *
 * Where a payment sits is decided by the ORDER, so there is a single source of truth and no extra status to keep in sync:
 *   held      - paid, but the buyer has not received the goods yet (or a refund is still being decided)
 *   available - handed over (delivered / picked up / completed) or a refund was rejected: ready to pay out
 *   reversed  - cancelled / refund approved / refunded: the seller is owed nothing
 *   paid_out  - already included in a payout
 */
export type SettlementBucket = 'held' | 'available' | 'reversed';

const AVAILABLE = new Set(['delivered', 'picked_up', 'completed', 'refund_rejected']);
const REVERSED = new Set(['cancelled', 'refund_approved', 'refunded']);

export function bucketForOrderStatus(status: string | undefined | null): SettlementBucket {
  const s = String(status || '');
  if (AVAILABLE.has(s)) return 'available';
  if (REVERSED.has(s)) return 'reversed';
  return 'held';
}

/** Platform commission in minor units. `percent` comes from PLATFORM_FEE_PERCENT (default 0 = no commission). */
export function computePlatformFeeMinor(subtotalMinor: number, percent: number): number {
  const p = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 50) : 0;
  const base = Math.max(0, Math.round(Number(subtotalMinor) || 0));
  return Math.round((base * p) / 100);
}

export interface LedgerRow {
  id: string;
  orderId: string;
  sellerId?: string;
  currency: string;
  amountMinor: number;
  platformFeeMinor?: number;
  sellerAmountMinor?: number;
  status: string;            // pending | succeeded | failed | refunded ...
  settlementStatus?: string; // held | paid_out | reversed
  payoutId?: string | null;
}

export interface CurrencyTotals { currency: string; heldMinor: number; availableMinor: number; paidOutMinor: number; count: number }

/** What the seller would receive for a ledger row. The platform fee is never paid out. */
export const sellerNetMinor = (row: LedgerRow) =>
  Math.max(0, Number.isFinite(row.sellerAmountMinor as number) ? Number(row.sellerAmountMinor) : Number(row.amountMinor) - Number(row.platformFeeMinor || 0));

export function summarizeEarnings(rows: LedgerRow[], statusByOrder: Record<string, string | undefined>): CurrencyTotals[] {
  const totals = new Map<string, CurrencyTotals>();
  for (const row of rows) {
    if (row.status !== 'succeeded' && row.settlementStatus !== 'paid_out') continue;
    const currency = String(row.currency || '').toUpperCase() || 'N/A';
    const t = totals.get(currency) || { currency, heldMinor: 0, availableMinor: 0, paidOutMinor: 0, count: 0 };
    const net = sellerNetMinor(row);
    if (row.settlementStatus === 'paid_out') t.paidOutMinor += net;
    else {
      const bucket = bucketForOrderStatus(statusByOrder[row.orderId]);
      if (bucket === 'held') t.heldMinor += net;
      else if (bucket === 'available') t.availableMinor += net;
    }
    t.count += 1;
    totals.set(currency, t);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Ledger rows that can be included in a payout right now (one currency per payout). */
export function selectPayable(rows: LedgerRow[], statusByOrder: Record<string, string | undefined>, currency: string): LedgerRow[] {
  const wanted = currency.toUpperCase();
  return rows.filter((row) =>
    row.status === 'succeeded' &&
    row.settlementStatus !== 'paid_out' &&
    String(row.currency || '').toUpperCase() === wanted &&
    bucketForOrderStatus(statusByOrder[row.orderId]) === 'available' &&
    sellerNetMinor(row) > 0);
}

export type PayoutMethod = 'bank' | 'jazzcash' | 'easypaisa' | 'raast';
export const PAYOUT_METHODS: PayoutMethod[] = ['bank', 'jazzcash', 'easypaisa', 'raast'];

export function maskAccount(value: string): string {
  const v = String(value || '').replace(/\s+/g, '');
  return v.length <= 4 ? v : `${'•'.repeat(Math.max(4, v.length - 4))}${v.slice(-4)}`;
}

/** Validates payout details a member enters. Returns the cleaned value or an error message. */
export function validatePayoutAccount(input: any): { ok: true; value: { method: PayoutMethod; accountTitle: string; accountNumber: string; bankName: string } } | { ok: false; error: string } {
  const method = String(input?.method || '').toLowerCase() as PayoutMethod;
  if (!PAYOUT_METHODS.includes(method)) return { ok: false, error: 'Choose a payout method.' };
  const accountTitle = String(input?.accountTitle || '').trim().replace(/\s+/g, ' ');
  if (accountTitle.length < 3 || accountTitle.length > 80) return { ok: false, error: 'Enter the account holder name exactly as it appears on the account.' };
  const raw = String(input?.accountNumber || '').replace(/[\s-]/g, '').toUpperCase();
  let accountNumber = raw;
  if (method === 'bank') {
    if (/^PK\d{2}[A-Z]{4}\d{16}$/.test(raw)) accountNumber = raw;
    else if (/^\d{8,24}$/.test(raw)) accountNumber = raw;
    else return { ok: false, error: 'Enter a valid Pakistani IBAN (PK + 22 characters) or an 8-24 digit account number.' };
  } else {
    const mobile = raw.replace(/^\+?92/, '0');
    if (!/^03\d{9}$/.test(mobile)) return { ok: false, error: 'Enter the registered mobile number, for example 03XXXXXXXXX.' };
    accountNumber = mobile;
  }
  const bankName = String(input?.bankName || '').trim().slice(0, 80);
  if (method === 'bank' && !bankName) return { ok: false, error: 'Enter the bank name.' };
  return { ok: true, value: { method, accountTitle, accountNumber, bankName } };
}
