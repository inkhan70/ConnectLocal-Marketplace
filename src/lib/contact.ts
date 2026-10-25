/**
 * Contact-number handling for "message / call the seller" links.
 * Pure functions, shared by the browser (settings, buttons) and the server (public profile projection), so a number a
 * member typed in any common format always produces a working WhatsApp / call / SMS link - or no link at all, never a
 * broken one.
 */

/** International dialling codes by ISO country code (used to complete numbers typed in local format). */
export const DIAL_CODES: Record<string, string> = {
  PK: '92', IN: '91', BD: '880', LK: '94', NP: '977', AF: '93', AE: '971', SA: '966', QA: '974', KW: '965', OM: '968', BH: '973',
  TR: '90', EG: '20', NG: '234', KE: '254', ZA: '27', GH: '233', US: '1', CA: '1', GB: '44', IE: '353', FR: '33', DE: '49',
  ES: '34', IT: '39', NL: '31', AU: '61', NZ: '64', SG: '65', MY: '60', ID: '62', PH: '63', CN: '86', JP: '81', KR: '82', BR: '55',
  MX: '52', CO: '57', AR: '54', RU: '7',
};

export interface PhoneResult {
  ok: boolean;
  /** Digits only, international format without "+" (what wa.me needs), e.g. "923001234567". */
  digits?: string;
  /** "+923001234567" (what we store and show). */
  e164?: string;
  error?: string;
}

/**
 * Normalises whatever the member typed ("0300-1234567", "+92 300 1234567", "0092 300 1234567", "(555) 123-4567").
 * `countryCode` (ISO, e.g. "PK") completes numbers typed without a country code.
 */
export function normalizePhone(input: unknown, countryCode?: string | null): PhoneResult {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter a phone number.' };
  if (/[^\d+\-\s().]/.test(raw)) return { ok: false, error: 'Use digits only (spaces, dashes and + are fine).' };

  const hasPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  const dial = countryCode ? DIAL_CODES[String(countryCode).toUpperCase()] : undefined;

  if (hasPlus) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (dial) {
    if (digits.startsWith('0')) digits = dial + digits.replace(/^0+/, '');
    else if (!(digits.startsWith(dial) && digits.length >= dial.length + 8)) digits = dial + digits;
  } else {
    return { ok: false, error: 'Add the country code, for example +92 300 1234567.' };
  }

  if (!/^[1-9]\d{7,14}$/.test(digits)) return { ok: false, error: 'This does not look like a valid phone number.' };
  return { ok: true, digits, e164: `+${digits}` };
}

export function whatsappUrl(digits: string, message?: string): string {
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
export const telUrl = (digits: string) => `tel:+${digits}`;
export const smsUrl = (digits: string, body?: string) => (body ? `sms:+${digits}?body=${encodeURIComponent(body)}` : `sms:+${digits}`);

/** Human-friendly "+92 300 1234567" style preview (grouping is cosmetic only). */
export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  const known = Object.values(DIAL_CODES).sort((a, b) => b.length - a.length).find((c) => d.startsWith(c));
  if (!known) return `+${d}`;
  const rest = d.slice(known.length);
  return `+${known} ${rest.slice(0, 3)} ${rest.slice(3)}`.trim();
}

export interface SellerContact { whatsapp?: string; phone?: string }

/** Picks usable, normalised contact numbers out of a (public) profile. */
export function getSellerContact(profile: { contactWhatsapp?: string; contactPhone?: string; countryCode?: string } | null | undefined): SellerContact {
  const wa = normalizePhone(profile?.contactWhatsapp, profile?.countryCode);
  const ph = normalizePhone(profile?.contactPhone, profile?.countryCode);
  return { whatsapp: wa.ok ? wa.digits : undefined, phone: ph.ok ? ph.digits : wa.ok ? wa.digits : undefined };
}
