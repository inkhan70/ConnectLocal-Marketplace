/**
 * Public base URL used for payment-provider return URLs, billing-portal returns, etc.
 * Order: APP_URL / NEXT_PUBLIC_APP_URL -> the request's own (forwarded) host -> Vercel's production URL.
 * Always https in production and never localhost there, so providers (Stripe requires https for live mode)
 * never redirect a customer to an unusable address.
 */
function normalise(candidate: string | undefined | null, production: boolean): string | null {
  if (!candidate) return null;
  let value = candidate.trim().replace(/\/+$/, '');
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (production) {
      if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) return null;
      url.protocol = 'https:';
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function getAppUrl(request?: Request): string {
  const production = process.env.NODE_ENV === 'production';
  const configured = normalise(process.env.APP_URL, production) || normalise(process.env.NEXT_PUBLIC_APP_URL, production);
  if (configured) return configured;

  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const fromRequest = normalise(host ? `${proto || (production ? 'https' : 'http')}://${host}` : null, production);
    if (fromRequest) return fromRequest;
  }
  const vercel = normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL, production);
  if (vercel) return vercel;
  return 'http://localhost:3000';
}
