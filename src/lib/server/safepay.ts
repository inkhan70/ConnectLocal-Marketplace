import crypto from 'crypto';

/**
 * Safepay webhook helpers.
 * Contract (Safepay developer docs): each webhook carries an `X-SFPY-SIGNATURE` header = hex HMAC-SHA512 of the RAW
 * request body, keyed with the endpoint's shared secret (Safepay dashboard -> Developers -> Endpoints). The body is
 * `{ token, client_id, type, endpoint, notification: { tracker, reference, state, amount, currency, fee, net, ... } }`
 * and `notification.state === 'PAID'` means the payment succeeded. Amounts are decimal strings in major units.
 */
export function verifySafepaySignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const provided = signature.trim().toLowerCase();
  return provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export interface SafepayNotification {
  type: string;
  tracker: string;
  state: string;
  reference: string | null;
  amountMinor: number | null;
  currency: string | null;
  feeMinor: number | null;
  netMinor: number | null;
}

const toMinor = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export function parseSafepayEvent(body: any): SafepayNotification | null {
  const n = body?.notification ?? body?.data?.notification;
  const tracker = typeof n?.tracker === 'string' ? n.tracker : '';
  if (!tracker) return null;
  return {
    type: String(body?.type || ''),
    tracker,
    state: String(n.state || '').toUpperCase(),
    reference: n.reference != null ? String(n.reference) : null,
    amountMinor: toMinor(n.amount),
    currency: n.currency ? String(n.currency).toUpperCase() : null,
    feeMinor: toMinor(n.fee),
    netMinor: toMinor(n.net),
  };
}
